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
  /**
   * When true, enable provider web search on this call (OpenRouter web plugin /
   * Gemini googleSearch grounding) and return any source URLs in
   * `result.citations`. Intended for the free-form TEXT "gather" half of the
   * two-call fact-check — do NOT pair with a responseSchema (JSON mode +
   * grounding is rejected by the providers; the Gemini path drops the schema
   * defensively). Best-effort: a web failure never throws, it yields `[]`.
   */
  webSearch?: boolean;
}

/** A web source URL surfaced by provider grounding (OpenRouter / Gemini). */
export interface WebCitation {
  kind: "web";
  url: string;
  title: string;
  snippet?: string;
}

export interface AIOperationResult {
  text: string;
  modelUsed: string;
  backend: "openrouter" | "google-direct";
  /** Web sources captured when `webSearch` was requested (otherwise `[]`). */
  citations: WebCitation[];
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
    } else {
      console.info(
        `${tag} cascade order: ${enabledOps.map((e) => `${e.id}[${e.modelString}]`).join(" → ")} → free-autorouter → gemini-direct`,
      );
    }
    for (const entry of enabledOps) {
      console.info(`${tag} trying admin entry id=${entry.id} model=${entry.modelString}`);
      try {
        const { text, citations } = await callOpenRouterChatCompletion(
          opts.ctx,
          entry.modelString,
          opts,
        );
        console.info(`${tag} ✓ answered via openrouter[${entry.modelString}] (admin entry id=${entry.id})`);
        return { text, modelUsed: entry.modelString, backend: "openrouter", citations };
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
      const { text, citations } = await callOpenRouterChatCompletion(
        opts.ctx,
        FREE_AUTOROUTER_ID,
        opts,
      );
      console.info(`${tag} ✓ answered via openrouter[${FREE_AUTOROUTER_ID}] (safety-net auto-router)`);
      return { text, modelUsed: FREE_AUTOROUTER_ID, backend: "openrouter", citations };
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
    return {
      text: result.text,
      modelUsed: result.modelUsed,
      backend: "google-direct",
      citations: result.citations,
    };
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
 * to dodge silent free-model degradations. 400s from a specific upstream
 * mean "this model can't handle the request shape we sent" — the next
 * entry might accept it, so advance the cascade instead of giving up.
 */
function isRetryable(err: unknown): boolean {
  if (!err) return false;
  const e = err as any;
  const status = Number(e?.status ?? e?.response?.status ?? 0);
  if ([400, 429, 502, 503, 504, 529, 404].includes(status)) return true;
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
): Promise<{ text: string; citations: WebCitation[] }> {
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
  const isJsonMode = cfg.responseMimeType === "application/json";
  // Detect whether the caller wants a JSON ARRAY (e.g. analyzeRisks,
  // analyzeControls) vs a JSON OBJECT (e.g. analyzeCompliance) at the top
  // level. OpenAI's JSON mode (`response_format: { type: 'json_object' }`)
  // STRICTLY only supports objects, so for array-shaped schemas we have to:
  //   1. NOT send response_format
  //   2. Tell the model in the system message that an array is expected
  // For object schemas (and schemas not specified) we use JSON mode AND
  // pair it with a system message — OpenAI's JSON mode contract requires
  // a system message instructing the model to return JSON, otherwise the
  // upstream returns `400 Provider returned error`.
  // Branch by the schema's top-level type. The schema flows through from
  // routes/ai.ts (verified via the diagnostic log below). Do NOT use the
  // action name as a fallback — multiple AI service functions reuse the
  // same `analyzeRisks` action with different schemas (e.g.
  // `analyzeStrategicRisks` sends an object-shaped schema with nested
  // arrays via the same API endpoint).
  const schemaIsArray =
    isJsonMode && (cfg.responseSchema as any)?.type === "array";

  // `responseSchema` is a Gemini-only API parameter — OpenRouter / OpenAI
  // silently DROP it from the request body, so the upstream model never
  // sees the schema and ends up hallucinating a shape (e.g. echoing the
  // input back). To work around this we serialise the schema and embed
  // it in the system message as text so OpenRouter models can actually
  // read it. Limited to ~8000 chars so a giant nested schema can't blow
  // out the context window — that's enough for every schema we currently
  // send (the largest is ~3KB JSON).
  const schemaSerialised = cfg.responseSchema
    ? JSON.stringify(cfg.responseSchema).slice(0, 8000)
    : null;

  const systemMessage = isJsonMode
    ? schemaIsArray
      ? `You are a structured-output assistant. You MUST respond with a valid JSON ARRAY that strictly matches the schema below. Return ONLY the array — do not wrap it in additional keys or objects. Do not include any prose, markdown fences, or commentary outside the JSON.${schemaSerialised ? `\n\nSCHEMA (JSON Schema):\n${schemaSerialised}` : ""}`
      : `You are a structured-output assistant. You MUST respond with a single valid JSON OBJECT that strictly matches the schema below. Use EXACTLY the property names and structure shown — do NOT echo the user input back as the output, do NOT invent new top-level keys. Do not include any prose, markdown fences, or commentary outside the JSON.${schemaSerialised ? `\n\nSCHEMA (JSON Schema):\n${schemaSerialised}` : ""}`
    : null;

  console.info(
    `[aiOperationRouter] ${modelString} mode=${isJsonMode ? (schemaIsArray ? "json-array" : "json-object") : "text"} systemMessage=${systemMessage ? "yes" : "no"} response_format=${isJsonMode && !schemaIsArray ? "json_object" : "none"} schemaType=${(cfg.responseSchema as any)?.type ?? "<undefined>"} schemaKeys=${cfg.responseSchema ? Object.keys(cfg.responseSchema as any).join(",") : "<none>"}`,
  );

  const requestParams: any = {
    model: modelString,
    messages: systemMessage
      ? [
          { role: "system", content: systemMessage },
          { role: "user", content: opts.prompt },
        ]
      : [{ role: "user", content: opts.prompt }],
    temperature: cfg.temperature ?? 0.7,
    max_tokens: cfg.maxOutputTokens ?? 8192,
  };
  // Best-effort JSON mode mapping. OpenRouter forwards this to upstream
  // providers that support it; ones that don't will ignore it and emit
  // free-form text — parseAIResponse in the caller heals truncated JSON.
  // Skip for array-shaped schemas because OpenAI's JSON mode only accepts
  // objects (would otherwise return 400 or coerce the response to {}).
  if (isJsonMode && !schemaIsArray) {
    requestParams.response_format = { type: "json_object" };
  }
  // Enable OpenRouter's Exa-backed web plugin when the caller asked for web
  // sourcing (the two-call fact-check's Call 1). Source URLs come back as
  // `message.annotations[].url_citation`. Default 5 results (~$0.005/request).
  if (opts.webSearch) {
    requestParams.plugins = [{ id: "web" }];
  }

  const completion = await withTimeout(
    client.chat.completions.create(requestParams),
    opts.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    `OpenRouter[${modelString}] timed out`,
  );
  const text = completion.choices?.[0]?.message?.content ?? "";
  const citations = opts.webSearch
    ? extractOpenRouterCitations(completion.choices?.[0]?.message)
    : [];
  console.info(
    `[aiOperationRouter] ${modelString} response length=${text.length} citations=${citations.length} preview=${JSON.stringify(text.slice(0, 200))}`,
  );
  if (!text) {
    // Surface as retryable so the cascade falls through.
    const empty: any = new Error(`empty response from ${modelString}`);
    empty.status = 502;
    throw empty;
  }
  // Content-validation. OpenRouter / OpenAI silently drop the `responseSchema`
  // parameter (it's a Gemini-only feature), so an upstream model can return a
  // 200 with JSON that's the wrong shape (e.g. echoing the user's input back
  // as the output). Without this check the router would happily return that
  // garbage and the client would surface an error. Treating shape mismatches
  // as 502s lets the cascade fall through to the next entry — and ultimately
  // to Gemini direct (which natively enforces the schema).
  if (isJsonMode && cfg.responseSchema) {
    const mismatch = (reason: string) => {
      const e: any = new Error(`${modelString} response shape mismatch: ${reason}`);
      e.status = 502;
      return e;
    };
    const stripped = text
      .trim()
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();
    const firstChar = stripped[0];
    const expectedFirst = schemaIsArray ? "[" : "{";
    if (firstChar !== expectedFirst) {
      throw mismatch(
        `expected first char "${expectedFirst}", got ${JSON.stringify(firstChar)}`,
      );
    }
    // Try a fast structural check on the parsed top-level keys.
    try {
      const parsed = JSON.parse(stripped);
      if (schemaIsArray && !Array.isArray(parsed)) {
        throw mismatch(`expected array, got ${typeof parsed}`);
      }
      if (!schemaIsArray) {
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
          throw mismatch(`expected object, got ${Array.isArray(parsed) ? "array" : typeof parsed}`);
        }
        // If the schema declares required top-level keys, at least one of them
        // must be present — otherwise the model has clearly hallucinated a
        // different shape (this is what caught the input-echo bug).
        const required = (cfg.responseSchema as any)?.required;
        if (Array.isArray(required) && required.length > 0) {
          const hasAny = required.some((k: string) => k in parsed);
          if (!hasAny) {
            throw mismatch(
              `none of the required keys [${required.join(",")}] present (got keys: ${Object.keys(parsed).join(",") || "<none>"})`,
            );
          }
        }
      }
    } catch (parseErr: any) {
      // If JSON.parse blew up but the first char looked right, let
      // parseAIResponse downstream heal it — don't trigger fallback for
      // simple truncation. Only re-throw if we already wrapped it as a 502.
      if (parseErr?.status === 502) throw parseErr;
      console.warn(
        `[aiOperationRouter] ${modelString} response JSON.parse failed, deferring to downstream healer:`,
        parseErr?.message ?? parseErr,
      );
    }
  }
  return { text, citations };
}

// ── Gemini-direct call ────────────────────────────────────────────────────

async function callGoogleDirect(
  opts: AIOperationOptions,
): Promise<{ text: string; modelUsed: string; citations: WebCitation[] }> {
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
  // Failover parity for web sourcing: enable Google Search grounding when the
  // caller asked for web search. Grounding + a JSON responseSchema are mutually
  // exclusive on Gemini, so drop the schema here (webSearch is only used for the
  // free-form Call-1 gather, which has no schema — this is purely defensive).
  if (opts.webSearch) {
    delete generationConfig.responseSchema;
    delete generationConfig.responseMimeType;
    generationConfig.tools = [{ googleSearch: {} }];
  }

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
      const citations = opts.webSearch ? extractGeminiCitations(result) : [];
      return { text, modelUsed: `gemini-direct/${modelName}`, citations };
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

// ── Web-citation extraction (best-effort — never throws) ───────────────────

/** Map OpenRouter `message.annotations[].url_citation` → WebCitation[]. */
function extractOpenRouterCitations(message: any): WebCitation[] {
  try {
    const anns = message?.annotations;
    if (!Array.isArray(anns)) return [];
    const out: WebCitation[] = [];
    for (const a of anns) {
      const u = a?.url_citation;
      if (a?.type === "url_citation" && u?.url) {
        out.push({
          kind: "web",
          url: String(u.url),
          title: String(u.title || u.url),
          snippet:
            typeof u.content === "string" ? u.content.slice(0, 500) : undefined,
        });
      }
    }
    return out;
  } catch {
    return [];
  }
}

/** Map Gemini `groundingMetadata.groundingChunks[].web` → WebCitation[]. */
function extractGeminiCitations(result: any): WebCitation[] {
  try {
    const chunks =
      result?.candidates?.[0]?.groundingMetadata?.groundingChunks;
    if (!Array.isArray(chunks)) return [];
    const out: WebCitation[] = [];
    for (const c of chunks) {
      const w = c?.web;
      if (w?.uri) {
        out.push({ kind: "web", url: String(w.uri), title: String(w.title || w.uri) });
      }
    }
    return out;
  } catch {
    return [];
  }
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
