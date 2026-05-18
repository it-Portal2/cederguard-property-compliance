// Cascading AI-operation router used by the legacy AI actions in
// api/routes/ai.ts. Replaces the previous inline Gemini-direct call so
// super-admins can curate a priority-ordered list of OpenRouter models
// from /admin without touching code.
//
// Cascade (in order — each step only runs if the previous one fails
// with a *retryable* error; non-retryable errors propagate immediately):
//
//   1. Each enabled entry in config.operationModels (admin-curated).
//   2. Hardcoded free auto-router: `openrouter/owl-alpha` via OpenRouter.
//   3. Hardcoded Gemini direct (GEMINI_API_KEY env, then geminiBackupKey).
//
// Steps 2 and 3 are the SAFETY NET — they are NOT in Firestore, NOT
// editable from the UI, and ALWAYS run after the admin list is exhausted.
// They guarantee a missing or all-failed admin list never breaks the app.
//
// Multimodal calls (inlineParts.length > 0) bypass the OpenRouter steps
// entirely and route straight to Gemini direct: OpenRouter's
// chat-completions API doesn't accept arbitrary inline file data the way
// Gemini's native API does.

import OpenAI from "openai";
import { GoogleGenAI } from "@google/genai";
import type { ApiContext } from "./context.js";
import {
  loadAIModelConfig,
  type OperationModelEntry,
} from "./aiModelConfig.js";

const FREE_AUTOROUTER_ID = "openrouter/owl-alpha";
const DEFAULT_TIMEOUT_MS = 90_000;

// ── Public types ──────────────────────────────────────────────────────────

export interface AIOperationConfig {
  temperature?: number;
  topP?: number;
  topK?: number;
  maxOutputTokens?: number;
  responseMimeType?: string;
  responseSchema?: unknown;
}

export interface AIOperationInlinePart {
  mimeType: string;
  data: string; // base64-encoded
}

export interface AIOperationOptions {
  ctx: ApiContext;
  prompt: string;
  inlineParts?: AIOperationInlinePart[];
  config?: AIOperationConfig;
  /** Override the per-attempt timeout. */
  timeoutMs?: number;
  /**
   * Optional override of the operation models list, primarily for tests.
   * Production callers always pass through ctx → loadAIModelConfig.
   */
  operationModelsOverride?: OperationModelEntry[];
  /**
   * Optional caller-supplied label for log lines (e.g. "analyzeCompliance",
   * "analyzeRisks"). Surfaces in the [aiOperationRouter] stdout so the
   * operator can verify which model handled which legacy AI op end-to-end.
   */
  action?: string;
}

export interface AIOperationResult {
  text: string;
  modelUsed: string;
  backend: "openrouter" | "google-direct";
}

/**
 * Cascade-and-return. Throws only when every step in the chain fails.
 */
export async function runAIOperation(
  opts: AIOperationOptions,
): Promise<AIOperationResult> {
  const isMultimodal = !!(opts.inlineParts && opts.inlineParts.length > 0);
  const tag = `[aiOperationRouter]${opts.action ? ` action=${opts.action}` : ""}`;
  if (isMultimodal) {
    console.info(`${tag} multimodal request — bypassing OpenRouter, routing to Gemini direct`);
  }

  if (!isMultimodal) {
    // ── Step 1 — admin-curated operationModels in priority order ─────
    const opModels =
      opts.operationModelsOverride ??
      (await loadAIModelConfig(opts.ctx)).operationModels ??
      [];
    const enabledOps = opModels.filter((e) => e.enabled);
    if (enabledOps.length === 0) {
      console.info(`${tag} no enabled operation models in admin config — proceeding directly to safety-net cascade`);
    }
    for (const entry of enabledOps) {
      console.info(`${tag} trying admin entry id=${entry.id} model=${entry.modelString}`);
      try {
        const text = await callOpenRouterChatCompletion(
          opts.ctx,
          entry.modelString,
          opts,
        );
        console.info(`${tag} ✓ answered via openrouter[${entry.modelString}] (admin entry id=${entry.id})`);
        return { text, modelUsed: entry.modelString, backend: "openrouter" };
      } catch (err) {
        if (!isRetryable(err)) {
          console.error(`${tag} entry ${entry.id} failed non-retryably, propagating:`, (err as any)?.message ?? err);
          throw err;
        }
        console.warn(
          `${tag} entry ${entry.id} (${entry.modelString}) failed retryably, advancing cascade:`,
          (err as any)?.message ?? err,
        );
      }
    }

    // ── Step 2 — hardcoded free auto-router via OpenRouter ───────────
    console.info(`${tag} admin list exhausted — trying free auto-router (${FREE_AUTOROUTER_ID})`);
    try {
      const text = await callOpenRouterChatCompletion(
        opts.ctx,
        FREE_AUTOROUTER_ID,
        opts,
      );
      console.info(`${tag} ✓ answered via openrouter[${FREE_AUTOROUTER_ID}] (safety-net auto-router)`);
      return { text, modelUsed: FREE_AUTOROUTER_ID, backend: "openrouter" };
    } catch (err) {
      console.warn(
        `${tag} free auto-router failed, falling through to Gemini direct:`,
        (err as any)?.message ?? err,
      );
    }
  }

  // ── Step 3 — hardcoded Gemini direct (env key, then user backup) ───
  console.info(`${tag} trying Gemini direct (safety-net)`);
  try {
    const result = await callGoogleDirect(opts);
    console.info(`${tag} ✓ answered via ${result.modelUsed} (safety-net Gemini direct)`);
    return { text: result.text, modelUsed: result.modelUsed, backend: "google-direct" };
  } catch (err) {
    console.error(`${tag} ✗ all AI providers failed`);
    throw new Error(
      "All AI providers failed: " + ((err as any)?.message ?? String(err)),
    );
  }
}

// ── Retry classifier ──────────────────────────────────────────────────────

/**
 * "Retryable" here means "try the NEXT step in the cascade", not "retry the
 * same model". Free models 429 frequently and 503s are transient — we move
 * on rather than wait. Empty-content responses are also treated retryable
 * to dodge silent free-model degradations.
 */
function isRetryable(err: unknown): boolean {
  if (!err) return false;
  const e = err as any;
  const status = Number(e?.status ?? e?.response?.status ?? 0);
  if ([429, 502, 503, 504, 529, 404].includes(status)) return true;
  const msg = String(e?.message ?? "").toLowerCase();
  if (!msg) return false;
  if (msg.includes("quota") || msg.includes("rate limit")) return true;
  if (msg.includes("overloaded") || msg.includes("unavailable")) return true;
  if (msg.includes("timed out") || msg.includes("timeout")) return true;
  if (msg.includes("empty response") || msg.includes("empty completion")) return true;
  if (
    msg.includes("api key") ||
    msg.includes("permission_denied") ||
    msg.includes("authentication")
  ) {
    // Auth errors against a specific upstream → try the next entry.
    return true;
  }
  return false;
}

// ── OpenRouter call ───────────────────────────────────────────────────────

async function callOpenRouterChatCompletion(
  _ctx: ApiContext,
  modelString: string,
  opts: AIOperationOptions,
): Promise<string> {
  const apiKey = (process.env.OPENROUTER_API_KEY ?? "").trim();
  if (!apiKey) throw new Error("OPENROUTER_API_KEY not configured");

  const client = new OpenAI({
    baseURL: "https://openrouter.ai/api/v1",
    apiKey,
    defaultHeaders: {
      "HTTP-Referer": "https://cedarguard.app",
      "X-Title": "CedarGuard",
    },
  });

  const cfg = opts.config ?? {};
  const requestParams: any = {
    model: modelString,
    messages: [{ role: "user", content: opts.prompt }],
    temperature: cfg.temperature ?? 0.7,
    max_tokens: cfg.maxOutputTokens ?? 8192,
  };
  // Best-effort JSON mode mapping. OpenRouter forwards this to upstream
  // providers that support it; ones that don't will ignore it and emit
  // free-form text — parseAIResponse in the caller heals truncated JSON.
  if (cfg.responseMimeType === "application/json") {
    requestParams.response_format = { type: "json_object" };
  }

  const completion = await withTimeout(
    client.chat.completions.create(requestParams),
    opts.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    `OpenRouter[${modelString}] timed out`,
  );
  const text = completion.choices?.[0]?.message?.content ?? "";
  if (!text) {
    // Surface as retryable so the cascade falls through.
    const empty: any = new Error(`empty response from ${modelString}`);
    empty.status = 502;
    throw empty;
  }
  return text;
}

// ── Gemini-direct call ────────────────────────────────────────────────────

async function callGoogleDirect(
  opts: AIOperationOptions,
): Promise<{ text: string; modelUsed: string }> {
  const envKey = (process.env.GEMINI_API_KEY ?? "").trim();
  const userBackupKey = (opts.ctx.userData?.geminiBackupKey ?? "").trim();
  const keys = [envKey, userBackupKey].filter((k) => k.length > 0);
  if (keys.length === 0) {
    throw new Error("No Gemini API key configured");
  }

  // Try primary model first; if it fails on the env key, try the user
  // backup key. Mirrors the existing behaviour of geminiPrompt.
  const PRIMARY_MODEL = "gemini-2.5-flash";
  const BACKUP_MODEL = "gemini-2.5-flash-lite";

  const cfg = opts.config ?? {};
  const generationConfig: any = {
    temperature: cfg.temperature ?? 0.7,
    topP: cfg.topP ?? 0.95,
    topK: cfg.topK ?? 40,
    maxOutputTokens: cfg.maxOutputTokens ?? 8192,
  };
  if (cfg.responseMimeType) generationConfig.responseMimeType = cfg.responseMimeType;
  if (cfg.responseSchema) generationConfig.responseSchema = cfg.responseSchema;

  const parts: any[] = [{ text: opts.prompt }];
  for (const p of opts.inlineParts ?? []) {
    parts.push({ inlineData: { mimeType: p.mimeType, data: p.data } });
  }

  let lastErr: any = null;
  for (let i = 0; i < keys.length; i++) {
    const apiKey = keys[i];
    const modelName = i === 0 ? PRIMARY_MODEL : BACKUP_MODEL;
    try {
      const ai = new GoogleGenAI({ apiKey });
      const result: any = await withTimeout(
        ai.models.generateContent({
          model: modelName,
          contents: [{ parts }],
          config: generationConfig,
        }),
        opts.timeoutMs ?? DEFAULT_TIMEOUT_MS,
        `Gemini[${modelName}] timed out`,
      );
      const text = result.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
      if (!text) {
        const empty: any = new Error(`empty response from Gemini[${modelName}]`);
        empty.status = 502;
        throw empty;
      }
      return { text, modelUsed: `gemini-direct/${modelName}` };
    } catch (err) {
      lastErr = err;
      console.warn(
        `[aiOperationRouter] Gemini direct key #${i + 1} failed:`,
        (err as any)?.message ?? err,
      );
      // Try the next key only when the failure is auth-related; otherwise
      // propagate immediately (rate-limit / quota means both keys would
      // hit the same project).
      const msg = String((err as any)?.message ?? "").toLowerCase();
      const isAuthError =
        msg.includes("api key") ||
        msg.includes("permission_denied") ||
        msg.includes("authentication");
      if (!isAuthError) throw err;
    }
  }
  throw lastErr ?? new Error("Gemini direct unavailable");
}

// ── Misc helpers ──────────────────────────────────────────────────────────

function withTimeout<T>(
  p: Promise<T>,
  ms: number,
  reason: string,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(reason)), ms);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      },
    );
  });
}

// Exposed for tests so they can drive the cascade with stubbed adapters.
export const _internal = { isRetryable };
