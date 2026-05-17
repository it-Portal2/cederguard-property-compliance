// Fixed-window rate limiter for the AI Chat feature.
// Storage: Firestore `chatRateLimits/{uid}` — { count, windowStartMs, lastMessageAt }
// Limit: 20 messages per 60-minute window, per user. Window resets to "now"
// when the previous window has expired.
// Super admins (ctx.isAdmin) are exempt.
//
// Why fixed-window rather than the previous sliding event-array model:
//   • The old design wrote a growing array (up to 40 timestamps) to the same
//     Firestore doc on every message. A user spamming sends triggered Firestore's
//     "1 write/sec/doc" soft limit with TOO_MUCH_CONTENTION on retry.
//   • Fixed-window writes a tiny scalar payload, idempotent under retry, and
//     still gives the user an accurate countdown to the reset.
//   • Reset semantics are slightly less precise than sliding (a burst at the
//     window boundary can exceed the cap by ~one message). Acceptable trade-off
//     for hot-doc safety.

import type { ApiContext } from "./context.js";

const WINDOW_MS = 60 * 60 * 1000; // 1 hour
const MAX_MESSAGES = 20;

// Per-user daily token budget. Bounds variable-cost LLM spend even when the
// per-hour message cap is fully utilised (20 msgs/hr × 24h = 480 msgs/day
// could still be a 5-figure bill without this). Char→token approximation:
// ~4 chars per token. We pre-charge each message for its input chars plus a
// flat output-budget estimate (max output tokens per response ≈ 8k, but most
// answers are 500–2000; 2000 is a fair worst-case for accounting).
const DAILY_WINDOW_MS = 24 * 60 * 60 * 1000;
const USER_DAILY_TOKEN_BUDGET = (() => {
  const raw = Number(process.env.USER_DAILY_TOKEN_BUDGET);
  return Number.isFinite(raw) && raw > 0 ? raw : 500_000;
})();
const OUTPUT_TOKEN_BUDGET_PER_MESSAGE = 2_000;

export function estimateTokensForMessage(inputChars: number): number {
  return Math.ceil(inputChars / 4) + OUTPUT_TOKEN_BUDGET_PER_MESSAGE;
}

export type RateLimitResult =
  | { allowed: true; remaining: number; resetAt: number | null }
  | { allowed: false; remaining: 0; resetAt: number; retryAfterSeconds: number };

export type TokenBudgetResult =
  | { allowed: true; remainingTokens: number; resetAt: number | null }
  | {
      allowed: false;
      remainingTokens: 0;
      resetAt: number;
      retryAfterSeconds: number;
      budget: number;
    };

export async function checkAndRecordChatMessage(
  ctx: ApiContext,
): Promise<RateLimitResult> {
  if (ctx.isAdmin) {
    return { allowed: true, remaining: MAX_MESSAGES, resetAt: null };
  }

  const { db, uid } = ctx;
  const ref = db.collection("chatRateLimits").doc(uid);
  const now = Date.now();

  return db.runTransaction(async (tx) => {
    const doc = await tx.get(ref);
    const data = doc.exists ? (doc.data() ?? {}) : {};
    const windowStartMs: number =
      typeof data.windowStartMs === "number" ? data.windowStartMs : 0;
    const count: number = typeof data.count === "number" ? data.count : 0;

    const windowExpired = !windowStartMs || now - windowStartMs >= WINDOW_MS;
    const effectiveCount = windowExpired ? 0 : count;
    const effectiveWindowStart = windowExpired ? now : windowStartMs;

    if (effectiveCount >= MAX_MESSAGES) {
      const resetAt = effectiveWindowStart + WINDOW_MS;
      const retryAfterSeconds = Math.max(1, Math.ceil((resetAt - now) / 1000));
      return {
        allowed: false,
        remaining: 0,
        resetAt,
        retryAfterSeconds,
      };
    }

    const nextCount = effectiveCount + 1;
    const payload = {
      uid,
      count: nextCount,
      windowStartMs: effectiveWindowStart,
      lastMessageAt: now,
    };
    if (doc.exists) tx.update(ref, payload);
    else tx.set(ref, payload);

    return {
      allowed: true,
      remaining: MAX_MESSAGES - nextCount,
      resetAt: effectiveWindowStart + WINDOW_MS,
    };
  });
}

/**
 * Atomic check-and-charge of the per-user 24-hour token budget. Shares the
 * same chatRateLimits/{uid} doc as the message limiter (no extra hot doc).
 * Super admins are exempt — same as the message limiter.
 */
export async function checkAndChargeDailyTokens(
  ctx: ApiContext,
  estTokens: number,
): Promise<TokenBudgetResult> {
  if (ctx.isAdmin) {
    return { allowed: true, remainingTokens: USER_DAILY_TOKEN_BUDGET, resetAt: null };
  }

  const { db, uid } = ctx;
  const ref = db.collection("chatRateLimits").doc(uid);
  const now = Date.now();

  return db.runTransaction(async (tx) => {
    const doc = await tx.get(ref);
    const data = doc.exists ? (doc.data() ?? {}) : {};
    const dailyWindowStartMs: number =
      typeof data.dailyWindowStartMs === "number" ? data.dailyWindowStartMs : 0;
    const dailyTokens: number =
      typeof data.dailyTokens === "number" ? data.dailyTokens : 0;

    const windowExpired =
      !dailyWindowStartMs || now - dailyWindowStartMs >= DAILY_WINDOW_MS;
    const effectiveTokens = windowExpired ? 0 : dailyTokens;
    const effectiveWindowStart = windowExpired ? now : dailyWindowStartMs;

    if (effectiveTokens + estTokens > USER_DAILY_TOKEN_BUDGET) {
      const resetAt = effectiveWindowStart + DAILY_WINDOW_MS;
      const retryAfterSeconds = Math.max(1, Math.ceil((resetAt - now) / 1000));
      return {
        allowed: false,
        remainingTokens: 0,
        resetAt,
        retryAfterSeconds,
        budget: USER_DAILY_TOKEN_BUDGET,
      };
    }

    const nextTokens = effectiveTokens + estTokens;
    const payload: Record<string, any> = {
      uid,
      dailyTokens: nextTokens,
      dailyWindowStartMs: effectiveWindowStart,
      lastTokenChargeAt: now,
    };
    // Preserve the message-limiter fields if the doc already exists; otherwise
    // initialise them empty so a future checkAndRecordChatMessage call works
    // against a complete doc shape.
    if (doc.exists) tx.update(ref, payload);
    else tx.set(ref, { ...payload, count: 0, windowStartMs: 0, lastMessageAt: 0 });

    return {
      allowed: true,
      remainingTokens: USER_DAILY_TOKEN_BUDGET - nextTokens,
      resetAt: effectiveWindowStart + DAILY_WINDOW_MS,
    };
  });
}
