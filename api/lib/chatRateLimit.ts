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

export type RateLimitResult =
  | { allowed: true; remaining: number; resetAt: number | null }
  | { allowed: false; remaining: 0; resetAt: number; retryAfterSeconds: number };

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
