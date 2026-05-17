// AI Chat streaming endpoint.
// Action: chatStream
// Protocol: NDJSON over HTTP (one JSON object per line).
//
// Event lines emitted:
//   {"event":"text","data":{"delta":"..."}}
//   {"event":"tool","data":{"name":"...","callId":"...","status":"running"|"done","argsPreview":"...","resultCount":N}}
//   {"event":"sources","data":{"citations":[{"kind":"...","id":"...","label":"...","route":"..."}]}}
//   {"event":"error","data":{"message":"..."}}
//   {"event":"done","data":{"messageId":"...","remaining":N}}
//
// AI provider dispatch:
//   - Direct @google/genai (uses existing GEMINI_API_KEY) — default + safety net
//   - OpenRouter (OpenAI-compatible) for the free model rows
// Cascading fallback when the selected model fails: free OpenRouter →
// free auto-router → Gemini-existing → friendly error.

import OpenAI from "openai";
import { randomUUID } from "node:crypto";
import type { ApiContext } from "../lib/context.js";
import { checkAndRecordChatMessage } from "../lib/chatRateLimit.js";
import {
  executeTool,
  getOpenAIToolDeclarations,
  type ToolName,
} from "../lib/chatTools.js";
import {
  CHAT_MODELS,
  DEFAULT_MODEL_ID,
  SAFETY_NET_MODEL_ID,
  FREE_AUTOROUTER_OPENROUTER_ID,
  type ChatModelOption,
} from "../../src/components/chat/composerModels.js";
import type { ChatBackend, ChatMessageParam } from "../lib/chatBackend.js";
import { createOpenRouterBackend } from "../lib/openRouterBackend.js";
import { createGoogleDirectBackend } from "../lib/googleDirectBackend.js";

// Bumped from 6 → 8 so the AI can chain multi-tool discovery for open-ended
// "tell me about X" / "summarise X" queries without hitting the round cap.
const MAX_TOOL_ROUNDS = 8;

// Server-side input budget. Free-tier models cap input around 8k tokens.
// Over-trim on the safe side: 16 messages, 4000 chars each, ~32k total.
const MAX_HISTORY_MESSAGES = 16;
const MAX_CHARS_PER_MESSAGE = 4000;
const MAX_TOTAL_HISTORY_CHARS = 32_000;

// ── NDJSON helpers ─────────────────────────────────────────────────────────

function writeEvent(res: any, event: string, data: Record<string, any>) {
  res.write(JSON.stringify({ event, data }) + "\n");
}

// ── Citation helpers ───────────────────────────────────────────────────────

function citationRoute(kind: string, id: string): string {
  switch (kind) {
    case "risk":        return `/risk/register?riskId=${id}`;
    case "issue":       return `/risk/issues?issueId=${id}`;
    case "compliance":  return `/compliance/tracker?itemId=${id}`;
    case "project":     return `/project/initiation?projectId=${id}`;
    case "programme":   return `/programmes?programmeId=${id}`;
    case "kri":         return `/monitoring/kri?kriId=${id}`;
    case "forwardPlan": return `/governance/forward-plan?itemId=${id}`;
    case "meeting":     return `/governance/meetings?meetingId=${id}`;
    case "report":      return `/governance/reports-list/${id}`;
    case "enquiry":     return `/technical-assurance/enquiries/${id}`;
    case "rfi":         return `/technical-assurance/rfis?rfiNumber=${id}`;
    case "task":        return `/my-tasks`;
    default:            return `/`;
  }
}

function toolNameToCitationKind(toolName: string): string {
  const map: Record<string, string> = {
    listAccessibleProjects:       "project",
    getProjectDetails:            "project",
    listAccessibleProgrammes:     "programme",
    getProgrammeDetails:          "programme",
    searchRisks:                  "risk",
    searchIssues:                 "issue",
    searchComplianceItems:        "compliance",
    getKRIs:                      "kri",
    searchForwardPlanItems:       "forwardPlan",
    searchMeetings:               "meeting",
    searchReports:                "report",
    searchTacEnquiries:           "enquiry",
    searchRfis:                   "rfi",
    getMyTasks:                   "task",
    getMonthlyHistoricalSnapshot: "project",
    crossTenantListClients:       "project",
  };
  return map[toolName] ?? "project";
}

function extractCitations(
  toolName: string,
  result: any[],
): Array<{ kind: string; id: string; label: string; route: string }> {
  if (!Array.isArray(result)) return [];
  const kind = toolNameToCitationKind(toolName);
  const out: Array<{ kind: string; id: string; label: string; route: string }> = [];
  for (const item of result.slice(0, 20)) {
    if (!item || typeof item !== "object") continue;
    // Skip the synthetic _truncated marker emitted by search tools.
    if ((item as any)._truncated) continue;
    // Real ID required — never fabricate. A made-up id would route to a 404
    // chip and quietly break the audit trail the citation is supposed to give.
    const rawId = item.id ?? item.rfiNumber ?? item.reference;
    if (rawId == null || rawId === "") continue;
    const id = String(rawId);
    const label =
      item.title ?? item.name ?? item.subject ?? item.reference ?? `${kind} ${id}`;
    out.push({
      kind,
      id,
      label: String(label).slice(0, 80),
      route: citationRoute(kind, id),
    });
  }
  return out;
}

// ── Tool-arg preview (sent to the UI's activity timeline) ──────────────────

function summarizeArgs(args: Record<string, unknown>): string | undefined {
  if (!args || typeof args !== "object") return undefined;
  const entries = Object.entries(args).filter(([, v]) => v != null && v !== "");
  if (!entries.length) return undefined;
  return entries
    .slice(0, 3)
    .map(([k, v]) => {
      const s = typeof v === "string" ? v : String(v);
      return `${k}: ${s.slice(0, 30)}`;
    })
    .join(" · ")
    .slice(0, 80);
}

function friendlyMessageFor(err: any): string {
  const msg = err?.message ?? "";
  const status = err?.status;
  if (status === 429 || msg.includes("quota") || msg.includes("rate"))
    return "AI quota exceeded. Please try again shortly.";
  if (status === 503 || msg.includes("overloaded") || msg.includes("unavailable"))
    return "AI service is temporarily busy. Please try again.";
  return "An error occurred while generating the response.";
}

// ── Backend dispatch ───────────────────────────────────────────────────────

interface BackendBuildContext {
  envOpenRouterKey: string;
  envOpenAiKey: string;
  userOpenRouterKey: string;
  userOpenAiKey: string;
  envGeminiKey: string;
  userGeminiKey: string;
}

function buildGoogleBackend(bctx: BackendBuildContext): ChatBackend {
  // Env first, user profile backup second — mirrors the rotation pattern
  // used by geminiBriefing.ts and the legacy AI route.
  return createGoogleDirectBackend({
    apiKeys: [bctx.envGeminiKey, bctx.userGeminiKey],
  });
}

function pickBackend(
  option: ChatModelOption,
  bctx: BackendBuildContext,
  endUserId?: string,
): ChatBackend {
  if (option.backend === "google-direct") {
    return buildGoogleBackend(bctx);
  }
  if (option.backend === "openrouter") {
    return buildOpenRouterBackend(option.openRouterId!, bctx, endUserId);
  }
  throw new Error("disabled model picked — should be unreachable");
}

function buildOpenRouterBackend(
  openRouterModelId: string,
  bctx: BackendBuildContext,
  endUserId?: string,
): ChatBackend {
  const orKey = bctx.envOpenRouterKey || bctx.userOpenRouterKey;
  const aiKey = bctx.envOpenAiKey || bctx.userOpenAiKey;
  if (!orKey && !aiKey) {
    throw new Error("OpenRouter / OpenAI keys not configured");
  }

  const openRouterClient = orKey
    ? new OpenAI({
        baseURL: "https://openrouter.ai/api/v1",
        apiKey: orKey,
        defaultHeaders: {
          "HTTP-Referer": "https://cedarguard.app",
          "X-Title": "CedarGuard",
        },
      })
    : null;
  const openAiClient = aiKey ? new OpenAI({ apiKey: aiKey }) : null;

  // If no OpenRouter key but we DO have OpenAI direct, route through OpenAI
  // as the primary. Otherwise use OpenRouter as primary with OpenAI fallback.
  if (!openRouterClient && openAiClient) {
    return createOpenRouterBackend({
      openRouterClient: openAiClient,
      openRouterModelId: "openai/gpt-4o-mini",
      endUserId,
    });
  }
  return createOpenRouterBackend({
    openRouterClient: openRouterClient!,
    openRouterModelId,
    openAiClient: openAiClient ?? undefined,
    openAiModelId: openAiClient ? "gpt-4o-mini" : undefined,
    endUserId,
  });
}

// ── Main handler ───────────────────────────────────────────────────────────

export const chatStreamRoutes: Record<
  string,
  (req: any, res: any, ctx: ApiContext) => Promise<any>
> = {
  chatStream: async (req, res, ctx) => {
    // ── 1. Rate limit ─────────────────────────────────────────────────
    const rateResult = await checkAndRecordChatMessage(ctx);
    if (!rateResult.allowed) {
      const denied = rateResult as {
        allowed: false;
        remaining: 0;
        resetAt: number;
        retryAfterSeconds: number;
      };
      res.setHeader("Content-Type", "application/x-ndjson");
      res.setHeader("Transfer-Encoding", "chunked");
      res.setHeader("X-Accel-Buffering", "no");
      res.status(429);
      writeEvent(res, "error", {
        message: `Rate limit reached. You may send your next message in ${denied.retryAfterSeconds} seconds.`,
        code: "RATE_LIMITED",
        retryAfterSeconds: denied.retryAfterSeconds,
        resetAt: denied.resetAt,
      });
      writeEvent(res, "done", { messageId: null });
      res.end();
      return;
    }

    // ── 2. Validate body + apply input budget ─────────────────────────
    const { messages, scopeContext, model, extendedThinking } = req.body;
    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: "messages array is required" });
    }

    const cleaned: ChatMessageParam[] = [];
    let totalChars = 0;
    for (
      let i = messages.length - 1;
      i >= 0 && cleaned.length < MAX_HISTORY_MESSAGES;
      i--
    ) {
      const m = messages[i];
      if (!m) continue;
      if (m.role !== "user" && m.role !== "model") continue;
      if (typeof m.text !== "string") continue;
      const text = m.text.trim().slice(0, MAX_CHARS_PER_MESSAGE);
      if (!text) continue;
      if (totalChars + text.length > MAX_TOTAL_HISTORY_CHARS) break;
      totalChars += text.length;
      cleaned.unshift({
        role: (m.role === "model" ? "assistant" : "user") as "assistant" | "user",
        content: text,
      });
    }
    if (!cleaned.length) {
      return res.status(400).json({ error: "No valid messages after sanitization" });
    }

    // ── 3. Resolve model + log the requested vs effective id ──────────
    const requestedModelId =
      typeof model === "string" ? model : DEFAULT_MODEL_ID;
    const requested = CHAT_MODELS.find((m) => m.id === requestedModelId);
    const resolved: ChatModelOption =
      !requested || requested.disabled
        ? CHAT_MODELS.find((m) => m.id === SAFETY_NET_MODEL_ID)!
        : requested;
    const wantsExtendedThinking = extendedThinking === true;
    console.info(
      `[chatStream] uid=${ctx.uid} requestedModel=${requestedModelId} effectiveModel=${resolved.id} extendedThinking=${wantsExtendedThinking}`,
    );

    // ── 4. Headers ────────────────────────────────────────────────────
    res.setHeader("Content-Type", "application/x-ndjson");
    res.setHeader("Transfer-Encoding", "chunked");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("X-Accel-Buffering", "no");
    res.status(200);

    // ── 5. System prompt ──────────────────────────────────────────────
    const { email, userData } = ctx;
    // Default to the LEAST privileged role on a missing/blank role string.
    // The tool registry still gates per-tool, but the system prompt should
    // never claim PM-level access for someone without one.
    const userRole = userData?.role ?? "viewer";
    const userName = userData?.displayName ?? email;
    const orgName = userData?.organisation ?? "your organisation";

    const systemInstruction = `You are Cedar AI, an intelligent assistant built into CedarGuard — a compliance and risk management platform for the built environment (UK construction and property sector).

You help users query and understand their own data: projects, programmes, risks, compliance items, issues, KRIs, governance meetings, forward plan items, reports, technical assurance enquiries, RFIs, and tasks.

**Current user:** ${userName} (${email})
**Role:** ${userRole}
**Organisation:** ${orgName}
**Date (UTC):** ${new Date().toISOString().split("T")[0]}
**Scope context:** ${scopeContext ? JSON.stringify(scopeContext) : "Portfolio-wide (all accessible data)"}

**Behaviour rules:**
1. ALWAYS use the available tools to fetch real data before answering factual questions. Never invent or assume data.

**Programme ↔ project relationship — IMPORTANT:**
Programmes contain projects. Projects belong to one programme via their \`programmeId\` field. When the user asks about a PROGRAMME (e.g. "risks in Greater London Housing Renewal 2026", "compliance status of programme X", "issues on this programme"):
- **Do NOT say "I can only search by project"**. The search tools (\`searchRisks\`, \`searchIssues\`, \`searchComplianceItems\`, \`getKRIs\`, \`searchTacEnquiries\`, \`searchRfis\`) all accept a \`programmeId\` parameter that automatically expands to every project under that programme the user can access.
- For "what projects are in programme X", call \`listAccessibleProjects({ programmeId: "X" })\`.
- For "risks in programme X", call \`searchRisks({ programmeId: "X" })\` directly — no need to enumerate projects first.
- If you need both summary and detail, do them in parallel: \`getProgrammeDetails\` + \`searchRisks({programmeId})\` + \`listAccessibleProjects({programmeId})\`.

2. **NEVER include raw record IDs in your prose** (long alphanumeric strings like "ZSwVzYzTJyMnXa8YlVlo", "p-042", "rpt-cabinet-2026-03", etc.). Refer to records by their human-readable title or name only. The UI surfaces IDs separately as clickable chips — you do not need to mention them.
3. Use UK English spelling. Default to **rich, well-structured answers** with clear section headings (\`## Heading\`), short paragraphs, and bullet/numbered lists where helpful.
4. For open-ended questions like "tell me about X", "summarise X", "what's the status of X", "give me an overview":
   - Call MULTIPLE tools to gather full context: project details + linked risks + compliance items + KRIs + open issues + recent governance activity (forward plan items / meetings / reports / TAC enquiries) where relevant.
   - Then synthesise a structured response with sections (e.g. **Overview**, **Status & Progress**, **Risks**, **Compliance**, **Recent Activity**, **Outstanding Issues**, **Next Steps**).
   - Aim for thorough coverage — not a one-line summary. Don't stop after a single tool call when more context would help.
5. For narrow questions ("how many open risks?", "when is the next meeting?"), keep the answer tight and specific. Don't pad.
6. You are READ-ONLY — you cannot create, modify, or delete any records.
7. If a query returns no results, say so clearly and suggest alternative searches.
8. If asked to do something outside your capabilities, politely explain that you can only query and summarise data.
9. For date comparisons, today is ${new Date().toISOString().split("T")[0]}.`;

    const baseHistory: ChatMessageParam[] = [
      { role: "system", content: systemInstruction },
      ...cleaned,
    ];

    // ── 6. Backend keys + abort tracking ──────────────────────────────
    const bctx: BackendBuildContext = {
      envOpenRouterKey: (process.env.OPENROUTER_API_KEY ?? "").trim(),
      envOpenAiKey: (process.env.OPENAI_API_KEY ?? "").trim(),
      userOpenRouterKey: (userData?.openrouterApiKey ?? "").trim(),
      userOpenAiKey: (userData?.openaiApiKey ?? "").trim(),
      envGeminiKey: (process.env.GEMINI_API_KEY ?? "").trim(),
      userGeminiKey: (userData?.geminiBackupKey ?? "").trim(),
    };

    let clientAborted = false;
    const onClose = () => {
      clientAborted = true;
    };
    req.on("close", onClose);

    const allCitations: Array<{
      kind: string; id: string; label: string; route: string;
    }> = [];

    // ── 7. The run-chat-with-backend helper ───────────────────────────

    const toolDeclarations = getOpenAIToolDeclarations(ctx) as OpenAI.ChatCompletionTool[];

    // Track which backend actually answered the user (i.e. the one that
    // produced the final text). Logged at the end so ops can grep for
    // "answered via" to see real provider distribution including fallbacks.
    let answeringBackend: ChatBackend | null = null;

    async function runChatWith(backend: ChatBackend): Promise<void> {
      console.info(`[chatStream] trying backend: ${backend.displayName}`);
      let msgHistory: ChatMessageParam[] = [...baseHistory];

      for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
        if (clientAborted) return;

        const { assistantMessage, toolCalls, contentText } =
          await backend.runToolRound(msgHistory, toolDeclarations);
        if (clientAborted) return;

        if (toolCalls.length === 0) {
          // If the tool-round already produced text, emit it directly
          // (chunked so the UI still gets progressive text). Avoids a
          // wasted second AI call AND avoids losing the answer when
          // flaky free providers return empty on the streaming retry.
          if (contentText && contentText.length > 0) {
            const chunkSize = 40;
            for (let i = 0; i < contentText.length; i += chunkSize) {
              if (clientAborted) return;
              writeEvent(res, "text", { delta: contentText.slice(i, i + chunkSize) });
            }
            answeringBackend = backend;
            return;
          }
          // No text yet — re-issue as a streaming final round.
          let streamedChars = 0;
          await backend.runFinalStream(
            msgHistory,
            (delta) => {
              streamedChars += delta.length;
              writeEvent(res, "text", { delta });
            },
            () => clientAborted,
          );
          // Empty-response guard: if the provider returned 0 chars (free
          // models are flaky here), throw so the outer cascading fallback
          // can route to the next backend instead of leaving an empty bubble.
          if (!clientAborted && streamedChars === 0) {
            throw new Error("EMPTY_AI_RESPONSE: provider returned no content");
          }
          answeringBackend = backend;
          return;
        }

        // Append the assistant turn (carries tool_calls) to history.
        msgHistory = [...msgHistory, assistantMessage];

        // Emit "running" up-front for every tool call so the UI shows
        // them immediately rather than one-at-a-time.
        const parsedArgsPerCall: Record<string, Record<string, any>> = {};
        for (const tc of toolCalls) {
          let parsed: Record<string, any> = {};
          try {
            parsed = JSON.parse(tc.argsJson) || {};
          } catch {
            parsed = {};
          }
          parsedArgsPerCall[tc.id] = parsed;
          writeEvent(res, "tool", {
            name: tc.name,
            callId: tc.id,
            status: "running",
            argsPreview: summarizeArgs(parsed),
          });
        }

        // Execute tool calls concurrently — they're independent reads.
        const toolResults = await Promise.all(
          toolCalls.map(async (tc) => {
            const exec = await executeTool(
              ctx,
              tc.name as ToolName,
              parsedArgsPerCall[tc.id],
            );
            return { tc, exec };
          }),
        );
        if (clientAborted) return;

        for (const { tc, exec } of toolResults) {
          const { result, error } = exec;
          const resultCount = Array.isArray(result) ? result.length : result ? 1 : 0;
          writeEvent(res, "tool", {
            name: tc.name,
            callId: tc.id,
            status: "done",
            argsPreview: summarizeArgs(parsedArgsPerCall[tc.id]),
            resultCount,
            ...(error ? { error } : {}),
          });
          if (Array.isArray(result) && result.length > 0) {
            allCitations.push(...extractCitations(tc.name, result));
          }
          msgHistory = [
            ...msgHistory,
            {
              role: "tool",
              tool_call_id: tc.id,
              content: JSON.stringify(error ? { error } : { result: result ?? null }),
            },
          ];
        }
      }
      // Hit the round cap without a final answer — best-effort: stream
      // a graceful completion using the last accumulated history.
      console.warn("[chatStream] hit MAX_TOOL_ROUNDS without final answer");
      await backend.runFinalStream(
        msgHistory,
        (delta) => writeEvent(res, "text", { delta }),
        () => clientAborted,
      );
      answeringBackend = backend;
    }

    // ── 8. Cascading fallback chain ───────────────────────────────────

    function emitFallbackChip(
      callId: string,
      status: "running" | "done",
      argsPreview: string,
    ) {
      writeEvent(res, "tool", {
        name: "_fallback",
        callId,
        status,
        argsPreview,
      });
    }

    try {
      try {
        await runChatWith(pickBackend(resolved, bctx, ctx.uid));
      } catch (errPrimary: any) {
        if (clientAborted) throw errPrimary;
        console.warn(
          `[chatStream] primary backend failed for ${resolved.id}:`,
          errPrimary?.message,
        );

        // Step 3 — free OpenRouter id failed → try free auto-router
        if (
          resolved.backend === "openrouter" &&
          resolved.openRouterId !== FREE_AUTOROUTER_OPENROUTER_ID
        ) {
          const fbId = `fb-autorouter-${randomUUID().slice(0, 8)}`;
          emitFallbackChip(fbId, "running", "switching to Auto-router (free)");
          try {
            const autoRouterBackend = buildOpenRouterBackend(
              FREE_AUTOROUTER_OPENROUTER_ID,
              bctx,
              ctx.uid,
            );
            await runChatWith(autoRouterBackend);
            emitFallbackChip(fbId, "done", "Auto-router answered");
            return finalize();
          } catch (errFb: any) {
            emitFallbackChip(fbId, "done", "Auto-router unavailable");
            console.warn(
              "[chatStream] free auto-router failed:",
              errFb?.message,
            );
          }
        }

        // Step 4 — safety-net Gemini direct
        if (resolved.id !== SAFETY_NET_MODEL_ID) {
          const fbId = `fb-gemini-${randomUUID().slice(0, 8)}`;
          emitFallbackChip(fbId, "running", "switching to Gemini (existing config)");
          try {
            await runChatWith(buildGoogleBackend(bctx));
            emitFallbackChip(fbId, "done", "Gemini answered");
            return finalize();
          } catch (errSafety: any) {
            emitFallbackChip(fbId, "done", "Gemini unavailable");
            console.error(
              "[chatStream] safety-net Gemini also failed:",
              errSafety?.message,
            );
            writeEvent(res, "error", {
              message: "All AI providers unavailable. Please try again.",
            });
            return finalize();
          }
        }

        // Primary WAS the safety net — surface the friendly error
        writeEvent(res, "error", { message: friendlyMessageFor(errPrimary) });
      }
    } catch (outer: any) {
      console.error("[chatStream] outer error:", outer?.message);
      if (!clientAborted) {
        writeEvent(res, "error", { message: friendlyMessageFor(outer) });
      }
    } finally {
      req.off?.("close", onClose);
    }

    finalize();

    function finalize() {
      if (clientAborted) {
        console.info(
          `[chatStream] aborted by client (requested=${resolved.id}, answeringBackend=${answeringBackend?.displayName ?? "none"})`,
        );
        try { res.end(); } catch { /* socket already gone */ }
        return;
      }
      // One-line summary of which backend served the answer (useful for
      // ops to see fallback distribution: requested vs effective vs answered).
      console.info(
        `[chatStream] ✓ answered via ${answeringBackend?.displayName ?? "<error — no backend completed>"} (requested=${resolved.id})`,
      );
      // Deduplicate citations
      if (allCitations.length > 0) {
        const seen = new Set<string>();
        const uniqueCitations = allCitations.filter((c) => {
          const key = `${c.kind}:${c.id}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
        writeEvent(res, "sources", {
          citations: uniqueCitations.slice(0, 30),
        });
      }
      const messageId = `m-${randomUUID()}`;
      writeEvent(res, "done", {
        messageId,
        remaining: rateResult.remaining,
      });
      res.end();
    }
  },
};
