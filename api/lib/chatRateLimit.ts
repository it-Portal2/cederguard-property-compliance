// Sliding window rate limiter for the AI Chat feature.
// Storage: Firestore `chatRateLimits/{uid}` — { events: Timestamp[] }
// Limit: 20 messages per rolling 60-minute window, per user.
// Super admins (ctx.isAdmin) are exempt.

import { Timestamp, FieldValue } from "firebase-admin/firestore";
import type { ApiContext } from "./context.js";

const WINDOW_MS = 60 * 60 * 1000; // 1 hour in milliseconds
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
  const windowStart = now - WINDOW_MS;

  return db.runTransaction(async (tx) => {
    const doc = await tx.get(ref);
    const existing: Timestamp[] = doc.exists
      ? (doc.data()?.events ?? [])
      : [];

    // Keep only events within the rolling window
    const recent: Timestamp[] = existing.filter(
      (ts: Timestamp) => ts.toMillis() >= windowStart,
    );

    if (recent.length >= MAX_MESSAGES) {
      // Sort ascending so the oldest event tells us when the window opens
      const sorted = [...recent].sort((a, b) => a.toMillis() - b.toMillis());
      const oldestMs = sorted[0].toMillis();
      const resetAt = oldestMs + WINDOW_MS;
      const retryAfterSeconds = Math.ceil((resetAt - now) / 1000);
      return {
        allowed: false,
        remaining: 0,
        resetAt,
        retryAfterSeconds,
      };
    }

    // Record this message
    const newEvent = Timestamp.fromMillis(now);
    const updatedEvents = [...recent, newEvent].slice(-MAX_MESSAGES * 2); // cap array size

    if (doc.exists) {
      tx.update(ref, { events: updatedEvents });
    } else {
      tx.set(ref, { events: updatedEvents, uid });
    }

    return {
      allowed: true,
      remaining: MAX_MESSAGES - recent.length - 1,
      resetAt: null,
    };
  });
}

export function getRateLimitStatus(
  ctx: ApiContext,
  events: Timestamp[],
): { used: number; remaining: number; resetAt: number | null } {
  if (ctx.isAdmin) {
    return { used: 0, remaining: MAX_MESSAGES, resetAt: null };
  }
  const now = Date.now();
  const windowStart = now - WINDOW_MS;
  const recent = events.filter((ts) => ts.toMillis() >= windowStart);
  const used = recent.length;
  const remaining = Math.max(0, MAX_MESSAGES - used);

  if (used === 0) return { used, remaining, resetAt: null };

  const sorted = [...recent].sort((a, b) => a.toMillis() - b.toMillis());
  const resetAt = sorted[0].toMillis() + WINDOW_MS;
  return { used, remaining, resetAt };
}
