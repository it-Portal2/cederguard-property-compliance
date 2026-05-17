// OpenRouter (OpenAI-compatible) backend driver for chat.
// One factory per request: pass the OpenRouter model id you want to call.
// The OpenAI npm package is used as the SDK client here ONLY because
// OpenRouter exposes an OpenAI-compatible API surface — there is no
// direct call to OpenAI's own endpoint anywhere in this file.

import OpenAI from "openai";
import type {
  ChatBackend,
  ChatMessageParam,
  NormalisedToolCall,
  ToolRoundResult,
} from "./chatBackend.js";

interface OpenRouterBackendOptions {
  openRouterClient: OpenAI;
  openRouterModelId: string;
  /** Sampling shared across both rounds. */
  temperature?: number;
  maxTokens?: number;
  /**
   * Per-end-user identifier (Firebase uid). Forwarded as the OpenAI `user`
   * field — OpenRouter passes this to upstream providers, some of which use
   * it for per-end-user rate-limit attribution rather than per-API-key.
   * Helps free-pool capacity distribution when many of our users share one key.
   */
  endUserId?: string;
}

// OpenRouter-specific request extensions. Not in the OpenAI SDK types, so we
// merge them via `any`. Documented at:
//   https://openrouter.ai/docs/api/reference/provider-routing
interface OpenRouterExtras {
  /** Never silently fall back from a :free model to a paid upstream. */
  provider?: { allow_fallbacks?: boolean };
  /** End-user identifier — forwarded to upstreams that support it. */
  user?: string;
}

export function createOpenRouterBackend(
  opts: OpenRouterBackendOptions,
): ChatBackend {
  const {
    openRouterClient,
    openRouterModelId,
    temperature = 0.4,
    // Bumped from 4096 → 8192 to match the Gemini backend so multi-section
    // structured answers fit in a single final round.
    maxTokens = 8192,
    endUserId,
  } = opts;

  // Common OpenRouter-only extras attached to every request.
  const openRouterExtras: OpenRouterExtras = {
    provider: { allow_fallbacks: false },
    ...(endUserId ? { user: endUserId } : {}),
  };

  async function nonStreamingCall(
    params: OpenAI.ChatCompletionCreateParamsNonStreaming,
  ): Promise<OpenAI.ChatCompletion> {
    // Merge OpenRouter-specific extras (user, provider routing flags) into
    // every call. SDK types don't know about these fields → `as any`.
    const enriched = { ...params, ...openRouterExtras } as typeof params;
    // No in-backend retry to a different provider — when OpenRouter fails,
    // we propagate the error and let chatStream's cascading fallback (free
    // auto-router → safety-net Gemini direct) handle recovery in a single
    // place. Keeps provider-selection logic from being split across files.
    return await openRouterClient.chat.completions.create(enriched);
  }

  async function streamingCall(
    params: OpenAI.ChatCompletionCreateParamsStreaming,
  ): Promise<AsyncIterable<OpenAI.ChatCompletionChunk>> {
    const enriched = { ...params, ...openRouterExtras };
    return (await openRouterClient.chat.completions.create(
      enriched as OpenAI.ChatCompletionCreateParamsStreaming,
    )) as unknown as AsyncIterable<OpenAI.ChatCompletionChunk>;
  }

  return {
    displayName: `OpenRouter[${openRouterModelId}]`,

    async runToolRound(history, toolDeclarations): Promise<ToolRoundResult> {
      const response = await nonStreamingCall({
        model: openRouterModelId,
        messages: history,
        temperature,
        max_tokens: maxTokens,
        ...(toolDeclarations.length > 0
          ? { tools: toolDeclarations, tool_choice: "auto" as const }
          : {}),
      });

      const choice = response.choices?.[0];
      const assistantMessage = (choice?.message ?? {
        role: "assistant",
        content: "",
      }) as ChatMessageParam;

      const rawToolCalls = (choice?.message.tool_calls ?? []).filter(
        (tc): tc is OpenAI.ChatCompletionMessageFunctionToolCall =>
          tc.type === "function",
      );
      const hasToolCalls =
        choice?.finish_reason === "tool_calls" && rawToolCalls.length > 0;

      const toolCalls: NormalisedToolCall[] = hasToolCalls
        ? rawToolCalls.map((tc) => ({
            id: tc.id,
            name: tc.function.name,
            argsJson: tc.function.arguments ?? "{}",
          }))
        : [];

      const contentText =
        typeof choice?.message.content === "string"
          ? choice.message.content
          : "";

      return { assistantMessage, toolCalls, contentText };
    },

    async runFinalStream(history, onDelta, isAborted) {
      // Tools deliberately omitted from this round — if the model decided
      // to answer directly we don't want a sneaky tool_call here that the
      // streaming path would drop on the floor.
      try {
        const stream = await streamingCall({
          model: openRouterModelId,
          messages: history,
          temperature,
          max_tokens: maxTokens,
          stream: true,
        });
        for await (const chunk of stream) {
          if (isAborted()) return;
          const delta = chunk.choices?.[0]?.delta?.content ?? "";
          if (delta) onDelta(delta);
        }
      } catch (err: any) {
        // Streaming unavailable — fall back to a non-streaming call and
        // chunk the response so the UI still gets progressive text.
        console.warn(
          "[openRouterBackend] streaming unavailable, chunking fallback:",
          err?.message,
        );
        const completion = await nonStreamingCall({
          model: openRouterModelId,
          messages: history,
          temperature,
          max_tokens: maxTokens,
        });
        const text = completion.choices?.[0]?.message?.content ?? "";
        const chunkSize = 50;
        for (let i = 0; i < text.length; i += chunkSize) {
          if (isAborted()) return;
          onDelta(text.slice(i, i + chunkSize));
        }
      }
    },
  };
}
