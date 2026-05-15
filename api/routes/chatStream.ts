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
// AI provider: OpenRouter (free, primary) → OpenAI (fallback).
// Loop strategy:
//   • Tool-call rounds: non-streaming createCompletion (reliable tool_calls detection).
//   • Final text-only round: streaming createCompletion for real token streaming.
//   • Max MAX_TOOL_ROUNDS rounds to prevent runaway loops.

import OpenAI from "openai";
import type { ApiContext } from "../lib/context.js";
import { checkAndRecordChatMessage } from "../lib/chatRateLimit.js";
import {
  executeTool,
  getOpenAIToolDeclarations,
  type ToolName,
} from "../lib/chatTools.js";
import { createChatClient } from "../lib/aiClient.js";

const MAX_TOOL_ROUNDS = 6;

// NDJSON event writer — writes one JSON line and flushes
function writeEvent(res: any, event: string, data: Record<string, any>) {
  res.write(JSON.stringify({ event, data }) + "\n");
}

// Build citation route from kind + id
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
    setQueryClientContext:        "project",
  };
  return map[toolName] ?? "project";
}

function extractCitations(
  toolName: string,
  result: any[],
): Array<{ kind: string; id: string; label: string; route: string }> {
  if (!Array.isArray(result)) return [];
  const kind = toolNameToCitationKind(toolName);
  return result.slice(0, 20).map((item: any) => {
    const id = item.id ?? item.rfiNumber ?? item.reference ?? String(Math.random());
    const label =
      item.title ?? item.name ?? item.subject ?? item.reference ?? `${kind} ${id}`;
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
      const denied = rateResult as { allowed: false; remaining: 0; resetAt: number; retryAfterSeconds: number };
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

    // ── 2. Validate request body ──────────────────────────────────────
    const { messages, scopeContext } = req.body;
    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: "messages array is required" });
    }

    // Convert incoming {role:"user"|"model", text:""} to OpenAI format
    const openAIHistory: OpenAI.ChatCompletionMessageParam[] = messages
      .filter(
        (m: any) =>
          m &&
          (m.role === "user" || m.role === "model") &&
          typeof m.text === "string" &&
          m.text.trim().length > 0,
      )
      .slice(-40)
      .map((m: any) => ({
        role: (m.role === "model" ? "assistant" : "user") as "assistant" | "user",
        content: m.text.trim().slice(0, 8000),
      }));

    if (!openAIHistory.length) {
      return res.status(400).json({ error: "No valid messages after sanitization" });
    }

    // ── 3. Set streaming headers ──────────────────────────────────────
    res.setHeader("Content-Type", "application/x-ndjson");
    res.setHeader("Transfer-Encoding", "chunked");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("X-Accel-Buffering", "no");
    res.status(200);

    // ── 4. Build system prompt ────────────────────────────────────────
    const { email, userData } = ctx;
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
1. ALWAYS use the available tools to fetch real data before answering factual questions. Never invent or assume data.
2. Be concise and professional. Use UK English spelling.
3. When listing items, use structured bullet points or numbered lists.
4. Reference specific record IDs, names, or references — the UI renders these as clickable citation chips.
5. You are READ-ONLY — you cannot create, modify, or delete any records.
6. If asked to do something outside your capabilities, politely explain that you can only query and summarise data.
7. If a query returns no results, say so clearly and suggest alternative searches.
8. For date comparisons, today is ${new Date().toISOString().split("T")[0]}.`;

    // ── 5. Resolve AI provider keys ───────────────────────────────────
    const openRouterKey = (process.env.OPENROUTER_API_KEY ?? "").trim() ||
      (userData?.openrouterApiKey ?? "").trim();
    const openAiKey = (process.env.OPENAI_API_KEY ?? "").trim() ||
      (userData?.openaiApiKey ?? "").trim();

    if (!openRouterKey && !openAiKey) {
      writeEvent(res, "error", { message: "AI service not configured" });
      writeEvent(res, "done", { messageId: null });
      res.end();
      return;
    }

    const { client, model, fallbackClient, fallbackModel } = createChatClient(
      openRouterKey,
      openAiKey,
    );

    const toolDeclarations = getOpenAIToolDeclarations(ctx);
    const allCitations: Array<{
      kind: string; id: string; label: string; route: string;
    }> = [];

    const commonParams = {
      temperature: 0.4,
      max_tokens: 4096,
      ...(toolDeclarations.length > 0
        ? { tools: toolDeclarations, tool_choice: "auto" as const }
        : {}),
    };

    // Full message array — system message prepended
    let msgHistory: OpenAI.ChatCompletionMessageParam[] = [
      { role: "system", content: systemInstruction },
      ...openAIHistory,
    ];

    // Helper: try with primary client, fall back on quota/overload errors
    const doCompletion = async (
      params: OpenAI.ChatCompletionCreateParamsNonStreaming,
    ) => {
      try {
        return await client.chat.completions.create(params);
      } catch (err: any) {
        const retryable =
          err?.status === 429 || err?.status === 503 || err?.status === 529;
        if (retryable && fallbackClient) {
          console.warn("[chatStream] primary failed, using fallback:", err?.message);
          return await fallbackClient.chat.completions.create({
            ...params,
            model: fallbackModel!,
          });
        }
        throw err;
      }
    };

    const doStream = async (
      params: OpenAI.ChatCompletionCreateParamsStreaming,
    ) => {
      try {
        return client.chat.completions.create(params);
      } catch (err: any) {
        const retryable =
          err?.status === 429 || err?.status === 503 || err?.status === 529;
        if (retryable && fallbackClient) {
          return fallbackClient.chat.completions.create({
            ...params,
            model: fallbackModel!,
          });
        }
        throw err;
      }
    };

    try {
      for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
        // ── Non-streaming round (reliable tool_calls detection) ───────
        const response = await doCompletion({ model, messages: msgHistory, ...commonParams });

        const choice = response.choices?.[0];
        if (!choice) {
          writeEvent(res, "error", { message: "No response from AI" });
          break;
        }

        const assistantMsg = choice.message;
        const hasToolCalls =
          choice.finish_reason === "tool_calls" &&
          Array.isArray(assistantMsg.tool_calls) &&
          assistantMsg.tool_calls.some((tc) => tc.type === "function");

        if (!hasToolCalls) {
          // Final text-only round — re-issue as streaming
          const fallbackText = assistantMsg.content ?? "";
          if (fallbackText) {
            try {
              const stream = await doStream({
                model,
                messages: msgHistory,
                ...commonParams,
                stream: true,
              });
              for await (const chunk of stream) {
                const delta = chunk.choices?.[0]?.delta?.content ?? "";
                if (delta) writeEvent(res, "text", { delta });
              }
            } catch (streamErr: any) {
              // Streaming unavailable — emit the non-streamed text in chunks
              console.warn("[chatStream] streaming fallback:", streamErr?.message);
              const chunkSize = 50;
              for (let i = 0; i < fallbackText.length; i += chunkSize) {
                writeEvent(res, "text", { delta: fallbackText.slice(i, i + chunkSize) });
              }
            }
          }
          break;
        }

        // ── Execute tool calls ────────────────────────────────────────
        // Append assistant message with tool_calls to history
        msgHistory = [...msgHistory, assistantMsg];

        const functionCalls = (assistantMsg.tool_calls ?? []).filter(
          (tc): tc is OpenAI.ChatCompletionMessageFunctionToolCall =>
            tc.type === "function",
        );

        for (const toolCall of functionCalls) {
          const toolName = toolCall.function.name as ToolName;
          let toolArgs: Record<string, any> = {};
          try {
            toolArgs = JSON.parse(toolCall.function.arguments ?? "{}");
          } catch {
            toolArgs = {};
          }

          writeEvent(res, "tool", { name: toolName, status: "running" });
          const { result, error } = await executeTool(ctx, toolName, toolArgs);

          const resultCount = Array.isArray(result) ? result.length : result ? 1 : 0;
          writeEvent(res, "tool", {
            name: toolName,
            status: "done",
            resultCount,
            ...(error ? { error } : {}),
          });

          if (Array.isArray(result) && result.length > 0) {
            allCitations.push(...extractCitations(toolName, result));
          }

          // Append tool result message
          msgHistory = [
            ...msgHistory,
            {
              role: "tool",
              tool_call_id: toolCall.id,
              content: JSON.stringify(error ? { error } : { result: result ?? null }),
            },
          ];
        }
      }
    } catch (err: any) {
      console.error("[chatStream] error:", err?.message);
      writeEvent(res, "error", {
        message:
          err?.status === 429 || err?.message?.includes("quota")
            ? "AI quota exceeded. Please try again shortly."
            : err?.status === 503 || err?.message?.includes("overloaded")
            ? "AI service is temporarily busy. Please try again."
            : "An error occurred while generating the response.",
      });
    }

    // ── 6. Emit deduplicated citations ────────────────────────────────
    if (allCitations.length > 0) {
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
