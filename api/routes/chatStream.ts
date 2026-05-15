// AI Chat streaming endpoint.
// Action: chatStream
// Protocol: NDJSON over HTTP (one JSON object per line).
//
// Event lines emitted:
//   {"event":"text","data":{"delta":"..."}}
//   {"event":"tool","data":{"name":"...","status":"running"|"done","resultCount":N}}
//   {"event":"sources","data":{"citations":[{"kind":"...","id":"...","label":"...","route":"..."}]}}
//   {"event":"error","data":{"message":"..."}}
//   {"event":"done","data":{"messageId":"..."}}
//
// The Gemini tool-call loop runs until the model emits a final text turn
// with no additional functionCall parts (max 8 rounds to prevent runaway).

import { GoogleGenAI } from "@google/genai";
import type { ApiContext } from "../lib/context.js";
import { checkAndRecordChatMessage } from "../lib/chatRateLimit.js";
import {
  executeTool,
  getGeminiToolDeclarations,
  type ToolName,
} from "../lib/chatTools.js";

const CHAT_MODEL = "gemini-2.5-flash";
const MAX_TOOL_ROUNDS = 8;

// NDJSON event writer helper
function writeEvent(
  res: any,
  event: string,
  data: Record<string, any>,
) {
  res.write(JSON.stringify({ event, data }) + "\n");
}

// Build citation route from kind + id
function citationRoute(kind: string, id: string): string {
  switch (kind) {
    case "risk":
      return `/risk/register?riskId=${id}`;
    case "issue":
      return `/risk/issues?issueId=${id}`;
    case "compliance":
      return `/compliance/tracker?itemId=${id}`;
    case "project":
      return `/project/initiation?projectId=${id}`;
    case "programme":
      return `/programmes?programmeId=${id}`;
    case "kri":
      return `/monitoring/kri?kriId=${id}`;
    case "forwardPlan":
      return `/governance/forward-plan?itemId=${id}`;
    case "meeting":
      return `/governance/meetings?meetingId=${id}`;
    case "report":
      return `/governance/reports-list/${id}`;
    case "enquiry":
      return `/technical-assurance/enquiries/${id}`;
    case "rfi":
      return `/technical-assurance/rfis?rfiNumber=${id}`;
    case "task":
      return `/my-tasks`;
    default:
      return `/`;
  }
}

// Map tool name to citation kind
function toolNameToCitationKind(toolName: string): string {
  const map: Record<string, string> = {
    listAccessibleProjects: "project",
    getProjectDetails: "project",
    listAccessibleProgrammes: "programme",
    getProgrammeDetails: "programme",
    searchRisks: "risk",
    searchIssues: "issue",
    searchComplianceItems: "compliance",
    getKRIs: "kri",
    searchForwardPlanItems: "forwardPlan",
    searchMeetings: "meeting",
    searchReports: "report",
    searchTacEnquiries: "enquiry",
    searchRfis: "rfi",
    getMyTasks: "task",
    getMonthlyHistoricalSnapshot: "project",
    crossTenantListClients: "project",
    setQueryClientContext: "project",
  };
  return map[toolName] ?? "project";
}

// Extract citation records from a tool result
function extractCitations(
  toolName: string,
  result: any[],
): Array<{ kind: string; id: string; label: string; route: string }> {
  if (!Array.isArray(result)) return [];
  const kind = toolNameToCitationKind(toolName);
  return result.slice(0, 20).map((item: any) => {
    const id =
      item.id ??
      item.rfiNumber ??
      item.reference ??
      String(Math.random());
    const label =
      item.title ??
      item.name ??
      item.subject ??
      item.reference ??
      `${kind} ${id}`;
    return {
      kind,
      id: String(id),
      label: String(label).slice(0, 80),
      route: citationRoute(kind, String(id)),
    };
  });
}

export const chatStreamRoutes: Record<
  string,
  (req: any, res: any, ctx: ApiContext) => Promise<any>
> = {
  chatStream: async (req, res, ctx) => {
    // ── 1. Rate limit ─────────────────────────────────────────────────
    const rateResult = await checkAndRecordChatMessage(ctx);
    if (!rateResult.allowed) {
      // Use NDJSON even for rate limit so client can parse uniformly
      res.setHeader("Content-Type", "application/x-ndjson");
      res.setHeader("Transfer-Encoding", "chunked");
      res.setHeader("X-Accel-Buffering", "no");
      res.status(429);
      writeEvent(res, "error", {
        message: `Rate limit reached. You may send your next message in ${rateResult.retryAfterSeconds} seconds.`,
        code: "RATE_LIMITED",
        retryAfterSeconds: rateResult.retryAfterSeconds,
        resetAt: rateResult.resetAt,
      });
      writeEvent(res, "done", { messageId: null });
      res.end();
      return;
    }

    // ── 2. Validate request body ──────────────────────────────────────
    const { messages, scopeContext } = req.body;
    if (!Array.isArray(messages) || messages.length === 0) {
      res.status(400).json({ error: "messages array is required" });
      return;
    }

    // Sanitize messages: allow only role + text content (no arbitrary objects)
    const safeMessages = messages
      .filter(
        (m: any) =>
          m &&
          (m.role === "user" || m.role === "model") &&
          typeof m.text === "string" &&
          m.text.trim().length > 0,
      )
      .slice(-40) // Keep last 40 turns max to stay within context
      .map((m: any) => ({
        role: m.role as "user" | "model",
        parts: [{ text: m.text.trim().slice(0, 8000) }],
      }));

    if (!safeMessages.length) {
      res.status(400).json({ error: "No valid messages after sanitization" });
      return;
    }

    // ── 3. Set streaming headers ──────────────────────────────────────
    res.setHeader("Content-Type", "application/x-ndjson");
    res.setHeader("Transfer-Encoding", "chunked");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("X-Accel-Buffering", "no"); // Disable nginx proxy buffering
    res.status(200);

    // ── 4. Build system prompt ────────────────────────────────────────
    const { uid, email, userData, isAdmin, isClientAdmin } = ctx;
    const userRole = userData?.role ?? "project_manager";
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
1. ALWAYS use the available tools to fetch real data before answering factual questions. Do not guess or invent data.
2. Be concise and professional. Use UK English spelling.
3. When listing items, use structured bullet points or numbered lists.
4. Reference specific record IDs, names, or references whenever possible — the UI renders these as clickable citation chips.
5. You are READ-ONLY — you cannot create, modify, or delete any records.
6. If the user asks you to do something outside your capabilities (write to the system, send emails, make decisions), politely explain that you can only query and summarise data.
7. Respect data boundaries — only surface data the user has legitimate access to.
8. If a query returns no results, say so clearly and suggest alternative searches.`;

    // ── 5. Gemini tool-calling loop ───────────────────────────────────
    const apiKey = process.env.GEMINI_API_KEY || userData?.geminiBackupKey;
    if (!apiKey) {
      writeEvent(res, "error", { message: "AI service not configured" });
      writeEvent(res, "done", { messageId: null });
      res.end();
      return;
    }

    const ai = new GoogleGenAI({ apiKey });
    const toolDeclarations = getGeminiToolDeclarations(ctx);

    // Accumulate all citations across tool calls in this turn
    const allCitations: Array<{
      kind: string;
      id: string;
      label: string;
      route: string;
    }> = [];

    // The conversation history to send to Gemini
    let contents = [...safeMessages];

    try {
      for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
        const response = await ai.models.generateContent({
          model: CHAT_MODEL,
          contents,
          config: {
            systemInstruction,
            temperature: 0.4,
            maxOutputTokens: 4096,
            tools: toolDeclarations.length > 0
              ? [{ functionDeclarations: toolDeclarations }]
              : undefined,
          },
        });

        const candidate = response.candidates?.[0];
        if (!candidate) {
          writeEvent(res, "error", { message: "No response from AI" });
          break;
        }

        const parts = candidate.content?.parts ?? [];
        let hasFunctionCall = false;
        let textAccumulated = "";

        // Process each part from the model
        for (const part of parts) {
          if (part.text) {
            textAccumulated += part.text;
          }
          if (part.functionCall) {
            hasFunctionCall = true;
          }
        }

        // Stream any text parts immediately
        if (textAccumulated) {
          // Stream in chunks for a typewriter effect
          const chunkSize = 60;
          for (let i = 0; i < textAccumulated.length; i += chunkSize) {
            writeEvent(res, "text", {
              delta: textAccumulated.slice(i, i + chunkSize),
            });
          }
        }

        // If no function calls, we're done
        if (!hasFunctionCall) {
          break;
        }

        // Execute tool calls and collect function responses
        const functionResponses: any[] = [];

        for (const part of parts) {
          if (!part.functionCall) continue;

          const toolName = part.functionCall.name as ToolName;
          const toolArgs = (part.functionCall.args ?? {}) as Record<string, any>;

          // Notify client that we're running a tool
          writeEvent(res, "tool", { name: toolName, status: "running" });

          const { result, error } = await executeTool(ctx, toolName, toolArgs);

          const resultCount = Array.isArray(result) ? result.length : result ? 1 : 0;
          writeEvent(res, "tool", {
            name: toolName,
            status: "done",
            resultCount,
            ...(error ? { error } : {}),
          });

          // Gather citations from this tool's results
          if (Array.isArray(result) && result.length > 0) {
            const citations = extractCitations(toolName, result);
            allCitations.push(...citations);
          }

          functionResponses.push({
            functionResponse: {
              name: toolName,
              response: error
                ? { error }
                : { result: result ?? null },
            },
          });
        }

        // Feed function responses back into the conversation
        // Append the model's tool-call turn and the function responses
        contents = [
          ...contents,
          { role: "model" as const, parts },
          { role: "user" as const, parts: functionResponses },
        ];
      }
    } catch (err: any) {
      console.error("[chatStream] Gemini error:", err?.message);
      writeEvent(res, "error", {
        message:
          err?.message?.includes("quota") || err?.status === 429
            ? "AI quota exceeded. Please try again shortly."
            : "An error occurred while generating the response.",
      });
    }

    // ── 6. Emit validated citations ───────────────────────────────────
    if (allCitations.length > 0) {
      // Deduplicate by kind+id
      const seen = new Set<string>();
      const uniqueCitations = allCitations.filter((c) => {
        const key = `${c.kind}:${c.id}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      writeEvent(res, "sources", { citations: uniqueCitations.slice(0, 30) });
    }

    // ── 7. Done ───────────────────────────────────────────────────────
    const messageId = `m-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
    writeEvent(res, "done", {
      messageId,
      remaining: rateResult.remaining,
    });
    res.end();
  },
};
