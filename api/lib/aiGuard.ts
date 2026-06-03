// Deterministic input guardrail for the AI chat — runs BEFORE the main model
// (defense-in-depth on top of the system-prompt rules). Two checks, in parallel:
//
//   1. Safety  — Meta **Llama Guard** via OpenRouter (open-weight, US/Meta — so it
//      respects the "no API-centred Chinese models" rule and rides the existing
//      OPENROUTER_API_KEY). Returns safe / unsafe(+category).
//   2. Topic   — a tiny yes/no relevance classifier (is this about the platform's
//      compliance / risk / governance data?) via the operation router, to hard-
//      block harmless-but-off-topic prompts (recipes, chit-chat, coding help…).
//
// FAIL-OPEN: if a classifier call errors (model unavailable, no key, timeout) the
// request is allowed — the system-prompt rules remain the backstop — and the
// failure is logged. So the guard can never take chat down.

import OpenAI from "openai";
import type { ApiContext } from "./context.js";
import { runAIOperation } from "./aiOperationRouter.js";

// Configurable: any OpenRouter-hosted Llama Guard build. Kept as a const so an
// operator can swap the exact revision without touching call sites.
// NOTE: verified against the live OpenRouter catalog + this account's key —
// `llama-guard-4-12b` accepts our simple {role:"user"} format and returns
// "safe" / "unsafe\nS<cat>". (`llama-guard-3-8b` is Cloudflare-only here and
// 400s on this format, so do not switch back without re-testing the provider.)
const LLAMA_GUARD_MODEL = "meta-llama/llama-guard-4-12b";

const ON_TOPIC_SCOPE =
  "projects, programmes, risks, issues, compliance items, KRIs, governance records " +
  "(forward plan, meetings, reports, templates, framework, project docs, archive), " +
  "technical assurance enquiries, RFIs, and tasks in a UK construction / property " +
  "compliance & risk management platform";

export type GuardReason = "safe" | "unsafe" | "off-topic";
export interface GuardResult {
  allow: boolean;
  reason: GuardReason;
  category?: string;
}

/** Llama Guard safety classification of the user message. Throws on transport error. */
async function llamaGuardSafe(
  userText: string,
): Promise<{ safe: boolean; category?: string }> {
  const apiKey = (process.env.OPENROUTER_API_KEY ?? "").trim();
  if (!apiKey) return { safe: true }; // no key → fail-open
  const client = new OpenAI({
    baseURL: "https://openrouter.ai/api/v1",
    apiKey,
    defaultHeaders: {
      "HTTP-Referer": "https://cedarguard.app",
      "X-Title": "CedarGuard",
    },
  });
  const completion = await client.chat.completions.create({
    model: LLAMA_GUARD_MODEL,
    messages: [{ role: "user", content: userText.slice(0, 4000) }],
    max_tokens: 32,
    temperature: 0,
  });
  // Llama Guard replies "safe" or "unsafe\n<S-category>".
  const out = (completion.choices?.[0]?.message?.content ?? "")
    .trim()
    .toLowerCase();
  if (out.startsWith("unsafe")) {
    const category = out.split(/\s+/)[1];
    return { safe: false, category };
  }
  return { safe: true };
}

/** Lightweight yes/no relevance check via the operation router. Throws on error. */
async function isOnTopic(ctx: ApiContext, userText: string): Promise<boolean> {
  const routed = await runAIOperation({
    ctx,
    action: "chatTopicGuard",
    prompt:
      `You are a strict topic classifier for a compliance & risk SaaS whose assistant ONLY answers about: ${ON_TOPIC_SCOPE}.\n\n` +
      `Is the following user message a request related to that domain/data (greetings and follow-ups that lead to it count as YES)? ` +
      `Answer with ONLY the single word "yes" or "no".\n\nUSER MESSAGE:\n${userText.slice(0, 2000)}`,
    config: { temperature: 0, maxOutputTokens: 4 },
  });
  return /\byes\b/i.test(routed.text || "");
}

/**
 * Screen a user chat message. Returns `{ allow:false }` for unsafe or off-topic
 * input (the caller streams a canned decline and skips the main model).
 */
export async function screenChatInput(
  ctx: ApiContext,
  userText: string,
): Promise<GuardResult> {
  const text = String(userText || "").trim();
  if (!text) return { allow: true, reason: "safe" };

  const [safety, onTopic] = await Promise.all([
    llamaGuardSafe(text).catch((e): { safe: boolean; category?: string } => {
      console.warn("[aiGuard] safety check failed (fail-open):", e?.message ?? e);
      return { safe: true };
    }),
    isOnTopic(ctx, text).catch((e) => {
      console.warn("[aiGuard] topic check failed (fail-open):", e?.message ?? e);
      return true;
    }),
  ]);

  if (!safety.safe)
    return { allow: false, reason: "unsafe", category: safety.category };
  if (!onTopic) return { allow: false, reason: "off-topic" };
  return { allow: true, reason: "safe" };
}
