// Unified AI client — OpenRouter (free, primary) → OpenAI (fallback).
// Both providers use the OpenAI-compatible API so the same SDK handles both.

import OpenAI from "openai";

export type InlinePart = { mimeType: string; data: string };

export interface CompletionOptions {
  systemPrompt: string;
  userPrompt: string;
  inlineParts?: InlinePart[];
  temperature?: number;
  maxTokens?: number;
  jsonMode?: boolean;
  userOpenRouterKey?: string;
  userOpenAiKey?: string;
}

const OPENROUTER_BASE = "https://openrouter.ai/api/v1";

// Default free model on OpenRouter — override with OPENROUTER_MODEL env var
const DEFAULT_OPENROUTER_MODEL =
  process.env.OPENROUTER_MODEL ?? "meta-llama/llama-3.3-70b-instruct:free";
const DEFAULT_OPENAI_MODEL = process.env.OPENAI_MODEL ?? "gpt-4o-mini";

function makeOpenRouterClient(apiKey: string): OpenAI {
  return new OpenAI({
    baseURL: OPENROUTER_BASE,
    apiKey,
    defaultHeaders: {
      "HTTP-Referer": "https://cedarguard.app",
      "X-Title": "CedarGuard",
    },
  });
}

function makeOpenAIClient(apiKey: string): OpenAI {
  return new OpenAI({ apiKey });
}

function buildMessages(
  systemPrompt: string,
  userPrompt: string,
  inlineParts: InlinePart[] = [],
): OpenAI.ChatCompletionMessageParam[] {
  const userContent: OpenAI.ChatCompletionContentPart[] = [
    { type: "text", text: userPrompt },
  ];

  for (const part of inlineParts) {
    // Only image/* types are universally supported for vision; skip PDFs
    if (part.mimeType.startsWith("image/")) {
      userContent.push({
        type: "image_url",
        image_url: { url: `data:${part.mimeType};base64,${part.data}` },
      });
    }
  }

  const userMsg: OpenAI.ChatCompletionMessageParam = {
    role: "user",
    content:
      userContent.length === 1
        ? (userContent[0] as OpenAI.ChatCompletionContentPartText).text
        : userContent,
  };

  return [{ role: "system", content: systemPrompt }, userMsg];
}

async function runCompletion(
  client: OpenAI,
  model: string,
  messages: OpenAI.ChatCompletionMessageParam[],
  opts: CompletionOptions,
): Promise<string> {
  const response = await client.chat.completions.create({
    model,
    messages,
    temperature: opts.temperature ?? 0.7,
    max_tokens: opts.maxTokens ?? 8192,
    ...(opts.jsonMode
      ? { response_format: { type: "json_object" as const } }
      : {}),
  });
  return response.choices[0]?.message?.content ?? "";
}

// Single entry-point for non-streaming completions (used by ai.ts routes).
export async function generateCompletion(opts: CompletionOptions): Promise<string> {
  const sysOrKey = (process.env.OPENROUTER_API_KEY ?? "").trim();
  const sysAiKey = (process.env.OPENAI_API_KEY ?? "").trim();
  const userOrKey = (opts.userOpenRouterKey ?? "").trim();
  const userAiKey = (opts.userOpenAiKey ?? "").trim();

  const orKey = sysOrKey || userOrKey;
  const aiKey = sysAiKey || userAiKey;

  if (!orKey && !aiKey) {
    throw new Error("AI_NOT_CONFIGURED: No OpenRouter or OpenAI API key set");
  }

  const messages = buildMessages(opts.systemPrompt, opts.userPrompt, opts.inlineParts);

  // Try OpenRouter first
  if (orKey) {
    try {
      const client = makeOpenRouterClient(orKey);
      return await runCompletion(client, DEFAULT_OPENROUTER_MODEL, messages, opts);
    } catch (err: any) {
      const retryable =
        err?.status === 429 ||
        err?.status === 503 ||
        err?.status === 529 ||
        err?.message?.includes("quota") ||
        err?.message?.includes("overloaded");
      if (!retryable) throw err;
      console.warn("[aiClient] OpenRouter failed, falling back to OpenAI:", err?.message);
      if (!aiKey) throw err; // no fallback available
    }
  }

  // Fallback: OpenAI
  const client = makeOpenAIClient(aiKey!);
  return await runCompletion(client, DEFAULT_OPENAI_MODEL, messages, opts);
}

// Returns a ready-to-use OpenAI client + model string for chatStream.
// Caller provides resolved keys (allows chatStream to check availability first).
export interface ChatClientResult {
  client: OpenAI;
  model: string;
  fallbackClient?: OpenAI;
  fallbackModel?: string;
}

export function createChatClient(
  openRouterKey: string,
  openAiKey: string,
): ChatClientResult {
  if (openRouterKey) {
    return {
      client: makeOpenRouterClient(openRouterKey),
      model: DEFAULT_OPENROUTER_MODEL,
      ...(openAiKey
        ? {
            fallbackClient: makeOpenAIClient(openAiKey),
            fallbackModel: DEFAULT_OPENAI_MODEL,
          }
        : {}),
    };
  }
  return {
    client: makeOpenAIClient(openAiKey),
    model: DEFAULT_OPENAI_MODEL,
  };
}
