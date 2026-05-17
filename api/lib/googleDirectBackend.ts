// Direct Gemini backend driver for chat.
// Uses the project's existing `@google/genai` SDK. Accepts an ordered list
// of API keys (env first, user-supplied backup second — mirrors the
// rotation pattern in geminiBriefing.ts). On any auth/permission failure
// from the first key (e.g. "API key reported as leaked", 401, 403,
// PERMISSION_DENIED, INVALID_ARGUMENT for the key) the next key in the
// list is tried. Other error classes (rate limit, model 404, network)
// surface immediately so the outer cascading fallback in chatStream
// kicks in (auto-router → ... → friendly error).
//
// Translates the in-memory OpenAI-shaped history to Gemini's Content[]
// shape so the chat tool-call loop in chatStream.ts stays backend-agnostic.

import { GoogleGenAI, type Content, type Part, type FunctionDeclaration } from "@google/genai";
import type OpenAI from "openai";
import type {
  ChatBackend,
  ChatMessageParam,
  NormalisedToolCall,
  ToolRoundResult,
} from "./chatBackend.js";

// Latest publicly-available Gemini Flash. Pinned here so we don't accidentally
// pull a deprecated id from elsewhere; bump when Google releases a newer flash.
const DEFAULT_GEMINI_MODEL = process.env.GEMINI_CHAT_MODEL ?? "gemini-2.5-flash";

interface GoogleDirectOptions {
  /** Ordered list of API keys to try. Empty / undefined / blank entries skipped. */
  apiKeys: ReadonlyArray<string | undefined | null>;
  modelId?: string;
  temperature?: number;
  maxOutputTokens?: number;
}

/**
 * Returns true when the SDK error indicates the API key itself is the
 * problem — wrong key, leaked key, blocked, billing disabled, etc.
 * We rotate to the next key on these; everything else (rate limit,
 * model 404, network) surfaces so the outer chat loop can route to
 * its own fallbacks.
 */
function isAuthRotationError(err: any): boolean {
  if (!err) return false;
  const status = err?.status ?? err?.code;
  if (status === 401 || status === 403) return true;
  const msg = String(err?.message ?? "").toLowerCase();
  if (!msg) return false;
  return (
    msg.includes("permission_denied") ||
    msg.includes("permission denied") ||
    msg.includes("api key not valid") ||
    msg.includes("api_key_invalid") ||
    msg.includes("invalid api key") ||
    msg.includes("leaked") ||
    msg.includes("api key was reported") ||
    msg.includes("billing") ||
    msg.includes("disabled") ||
    msg.includes("403") ||
    msg.includes("401")
  );
}

export function createGoogleDirectBackend(
  opts: GoogleDirectOptions,
): ChatBackend {
  const modelId = opts.modelId ?? DEFAULT_GEMINI_MODEL;
  const temperature = opts.temperature ?? 0.4;
  // Bumped from 4096 → 8192 so multi-section "tell me about X" answers
  // (Overview / Status / Risks / Compliance / Recent Activity / Next Steps)
  // have room to land in a single turn.
  const maxOutputTokens = opts.maxOutputTokens ?? 8192;

  const cleanedKeys = (opts.apiKeys ?? [])
    .map((k) => (k ?? "").trim())
    .filter((k) => k.length > 0);

  if (cleanedKeys.length === 0) {
    throw new Error(
      "AI_NOT_CONFIGURED: No Gemini API key supplied (env or user backup).",
    );
  }

  const clients = cleanedKeys.map((apiKey) => new GoogleGenAI({ apiKey }));

  // Iterates clients in order, retrying ONLY on auth-rotation errors.
  async function tryClients<T>(
    run: (client: GoogleGenAI, idx: number) => Promise<T>,
  ): Promise<T> {
    let lastError: any = new Error("No clients available");
    for (let i = 0; i < clients.length; i++) {
      try {
        return await run(clients[i], i);
      } catch (err: any) {
        lastError = err;
        if (!isAuthRotationError(err)) {
          throw err;
        }
        if (i < clients.length - 1) {
          console.warn(
            `[googleDirectBackend] key #${i + 1} rejected (${err?.message ?? "auth error"}); rotating to next key`,
          );
        }
      }
    }
    throw lastError;
  }

  return {
    displayName: `Gemini[${modelId}]`,

    async runToolRound(history, toolDeclarations): Promise<ToolRoundResult> {
      const { systemInstruction, contents } = translateHistory(history);
      const tools = translateToolDeclarations(toolDeclarations);

      const response = await tryClients((client) =>
        client.models.generateContent({
          model: modelId,
          contents,
          config: {
            temperature,
            maxOutputTokens,
            ...(systemInstruction ? { systemInstruction } : {}),
            ...(tools ? { tools: [{ functionDeclarations: tools }] } : {}),
          },
        }),
      );

      const functionCalls = response.functionCalls ?? [];
      const contentText = (response.text ?? "").toString();

      const assistantMessage = functionCallsToOpenAiAssistantMessage(
        functionCalls,
        contentText,
      );

      const toolCalls: NormalisedToolCall[] = functionCalls.map((fc, idx) => ({
        id: fc.id ?? `gemini-call-${Date.now().toString(36)}-${idx}`,
        name: fc.name ?? "",
        argsJson: JSON.stringify(fc.args ?? {}),
      }));

      return { assistantMessage, toolCalls, contentText };
    },

    async runFinalStream(history, onDelta, isAborted) {
      const { systemInstruction, contents } = translateHistory(history);

      try {
        const stream = await tryClients((client) =>
          client.models.generateContentStream({
            model: modelId,
            contents,
            config: {
              temperature,
              maxOutputTokens,
              ...(systemInstruction ? { systemInstruction } : {}),
            },
          }),
        );
        for await (const chunk of stream) {
          if (isAborted()) return;
          const text = (chunk.text ?? "").toString();
          if (text) onDelta(text);
        }
      } catch (err: any) {
        // If the failure was an auth-rotation error and we ran out of
        // keys, surface it for the outer loop. Otherwise treat as a
        // streaming-unavailable case and fall back to chunked non-stream.
        if (isAuthRotationError(err)) throw err;
        console.warn(
          "[googleDirectBackend] streaming unavailable, falling back to chunked non-stream:",
          err?.message,
        );
        const response = await tryClients((client) =>
          client.models.generateContent({
            model: modelId,
            contents,
            config: {
              temperature,
              maxOutputTokens,
              ...(systemInstruction ? { systemInstruction } : {}),
            },
          }),
        );
        const text = (response.text ?? "").toString();
        const chunkSize = 50;
        for (let i = 0; i < text.length; i += chunkSize) {
          if (isAborted()) return;
          onDelta(text.slice(i, i + chunkSize));
        }
      }
    },
  };
}

// ── Translation helpers ────────────────────────────────────────────────────

interface TranslatedHistory {
  systemInstruction?: string;
  contents: Content[];
}

/**
 * Converts the OpenAI-shaped msg history that the chat loop carries to the
 * Content[] shape Gemini expects. Notably:
 *   - OpenAI "system"   → Gemini config.systemInstruction (separate field)
 *   - OpenAI "assistant" with tool_calls → Content{role:"model"} with
 *     functionCall parts
 *   - OpenAI "tool"     → Content{role:"user"} with functionResponse part
 *     (Gemini's convention — tool responses ride as user-side content)
 */
function translateHistory(history: ChatMessageParam[]): TranslatedHistory {
  let systemInstruction: string | undefined;
  const contents: Content[] = [];

  for (const msg of history) {
    if (msg.role === "system") {
      systemInstruction = concatTextContent(msg.content);
      continue;
    }

    if (msg.role === "user") {
      contents.push({
        role: "user",
        parts: [{ text: concatTextContent(msg.content) }],
      });
      continue;
    }

    if (msg.role === "assistant") {
      const parts: Part[] = [];
      const text = concatTextContent(msg.content);
      if (text) parts.push({ text });

      const toolCalls = (msg as OpenAI.ChatCompletionAssistantMessageParam).tool_calls ?? [];
      for (const tc of toolCalls) {
        if (tc.type !== "function") continue;
        let args: Record<string, unknown> = {};
        try {
          args = JSON.parse(tc.function.arguments ?? "{}");
        } catch {
          args = {};
        }
        parts.push({
          functionCall: { id: tc.id, name: tc.function.name, args },
        });
      }
      if (parts.length === 0) parts.push({ text: "" });
      contents.push({ role: "model", parts });
      continue;
    }

    if (msg.role === "tool") {
      const toolMsg = msg as OpenAI.ChatCompletionToolMessageParam;
      let parsed: any = {};
      try {
        parsed = JSON.parse(concatTextContent(toolMsg.content));
      } catch {
        parsed = { raw: concatTextContent(toolMsg.content) };
      }
      contents.push({
        role: "user",
        parts: [
          {
            functionResponse: {
              id: toolMsg.tool_call_id,
              name: "tool_response",
              response: parsed && typeof parsed === "object" ? parsed : { value: parsed },
            },
          },
        ],
      });
      continue;
    }

    // Any other role (developer, function) — fold to user text for safety.
    contents.push({
      role: "user",
      parts: [{ text: concatTextContent((msg as any).content) }],
    });
  }

  return { systemInstruction, contents };
}

function concatTextContent(content: unknown): string {
  if (content == null) return "";
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((part: any) => {
        if (typeof part === "string") return part;
        if (part && typeof part.text === "string") return part.text;
        return "";
      })
      .join("");
  }
  return "";
}

/**
 * Translates an OpenAI ChatCompletionTool[] to Gemini FunctionDeclaration[].
 * The shape is similar — drop the {type:"function"} wrapper, keep
 * name/description/parameters. Gemini accepts the same JSON-Schema for
 * parameters that OpenAI does, so no recursive re-shaping needed.
 */
function translateToolDeclarations(
  tools: OpenAI.ChatCompletionTool[],
): FunctionDeclaration[] | undefined {
  if (!tools || tools.length === 0) return undefined;
  return tools
    .filter((t) => t.type === "function")
    .map((t) => ({
      name: t.function.name,
      description: t.function.description,
      parameters: t.function.parameters as any,
    }));
}

/**
 * Rebuilds an OpenAI-shape assistant message from Gemini's response so the
 * chat loop's history append path doesn't need a separate code branch.
 */
function functionCallsToOpenAiAssistantMessage(
  functionCalls: Array<{ id?: string; name?: string; args?: Record<string, unknown> }>,
  text: string,
): ChatMessageParam {
  if (functionCalls.length === 0) {
    return { role: "assistant", content: text };
  }
  return {
    role: "assistant",
    content: text || null,
    tool_calls: functionCalls.map((fc, idx) => ({
      id: fc.id ?? `gemini-call-${Date.now().toString(36)}-${idx}`,
      type: "function" as const,
      function: {
        name: fc.name ?? "",
        arguments: JSON.stringify(fc.args ?? {}),
      },
    })),
  };
}
