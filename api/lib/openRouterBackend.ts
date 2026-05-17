// OpenRouter (OpenAI-compatible) backend driver for chat.
// One factory per request: pass the OpenRouter model id you want to call,
// optionally pass an OpenAI direct client to fall back to on 429/503.

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
  /** Optional fallback for paid OpenAI ids when OpenRouter is overloaded. */
  openAiClient?: OpenAI;
  openAiModelId?: string;
  /** Sampling shared across both rounds. */
  temperature?: number;
  maxTokens?: number;
}

const RETRYABLE_STATUSES = new Set([429, 503, 529]);

export function createOpenRouterBackend(
  opts: OpenRouterBackendOptions,
): ChatBackend {
  const {
    openRouterClient,
    openRouterModelId,
    openAiClient,
    openAiModelId,
    temperature = 0.4,
    // Bumped from 4096 → 8192 to match the Gemini backend so multi-section
    // structured answers fit in a single final round.
    maxTokens = 8192,
  } = opts;

  const isRetryable = (err: any) =>
    !!err && RETRYABLE_STATUSES.has(err.status);

  async function nonStreamingCall(
    params: OpenAI.ChatCompletionCreateParamsNonStreaming,
  ): Promise<OpenAI.ChatCompletion> {
    try {
      return await openRouterClient.chat.completions.create(params);
    } catch (err: any) {
      if (isRetryable(err) && openAiClient && openAiModelId) {
        console.warn(
          "[openRouterBackend] primary failed, using OpenAI direct fallback:",
          err?.message,
        );
        return await openAiClient.chat.completions.create({
          ...params,
          model: openAiModelId,
        });
      }
      throw err;
    }
  }

  async function streamingCall(
    params: OpenAI.ChatCompletionCreateParamsStreaming,
  ) {
    try {
      return await openRouterClient.chat.completions.create(params);
    } catch (err: any) {
      if (isRetryable(err) && openAiClient && openAiModelId) {
        return await openAiClient.chat.completions.create({
          ...params,
          model: openAiModelId,
        });
      }
      throw err;
    }
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
