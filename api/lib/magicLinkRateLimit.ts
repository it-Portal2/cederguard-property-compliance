import { createHash } from "crypto";
import { getDB } from "./context.js";

// Fixed-window rate limiter for the pre-auth magic-link send endpoint.
// Storage: Firestore `magicLinkRateLimits/{key}` — { count, windowStartMs, lastAt }.
// This endpoint is UNAUTHENTICATED (no ctx), so abuse is bounded two ways at once:
//   • per-email  — 3 sends / 15 min  (stops mailbox-bombing one address)
//   • per-IP     — 15 sends / 60 min (stops one client enumerating many addresses)
// A request is allowed only if BOTH windows are under their cap.
//
// Mirrors api/lib/chatRateLimit.ts (fixed-window, tiny scalar payload, transactional
// so retries are idempotent). The caller always returns success to the user regardless,
// so a denial simply skips the email send — never surfaced to the client.

const EMAIL_WINDOW_MS = 15 * 60 * 1000;
const EMAIL_MAX = 3;
const IP_WINDOW_MS = 60 * 60 * 1000;
const IP_MAX = 15;

// Firestore doc IDs can't contain '/', have length limits, and shouldn't leak raw
// PII. Hash each identifier to a stable, safe id.
function docId(kind: "email" | "ip", value: string): string {
  const h = createHash("sha256").update(value).digest("hex").slice(0, 40);
  return `${kind}_${h}`;
}

async function checkAndCharge(
  db: ReturnType<typeof getDB>,
  id: string,
  windowMs: number,
  max: number,
  now: number,
): Promise<boolean> {
  const ref = db.collection("magicLinkRateLimits").doc(id);
  return db.runTransaction(async (tx) => {
    const doc = await tx.get(ref);
    const data = doc.exists ? (doc.data() ?? {}) : {};
    const windowStartMs: number =
      typeof data.windowStartMs === "number" ? data.windowStartMs : 0;
    const count: number = typeof data.count === "number" ? data.count : 0;

    const windowExpired = !windowStartMs || now - windowStartMs >= windowMs;
    const effectiveCount = windowExpired ? 0 : count;
    const effectiveWindowStart = windowExpired ? now : windowStartMs;

    if (effectiveCount >= max) return false;

    const payload = {
      count: effectiveCount + 1,
      windowStartMs: effectiveWindowStart,
      lastAt: now,
    };
    if (doc.exists) tx.update(ref, payload);
    else tx.set(ref, payload);
    return true;
  });
}

/**
 * Returns whether a magic-link send is permitted for this (email, ip) pair, charging
 * both windows. Never throws — on any Firestore error it fails OPEN (returns true) so a
 * transient outage can't block legitimate sign-ins; the send path degrades gracefully
 * elsewhere (Resend no-ops if unconfigured) and the caller always answers success.
 */
export async function checkMagicLinkRateLimit(
  email: string,
  ip: string,
): Promise<boolean> {
  try {
    const db = getDB();
    const now = Date.now();
    const normalizedEmail = email.trim().toLowerCase();
    const emailOk = await checkAndCharge(
      db,
      docId("email", normalizedEmail),
      EMAIL_WINDOW_MS,
      EMAIL_MAX,
      now,
    );
    // Always charge the IP window too, even when the email window already denied —
    // a client hammering one address still consumes its per-IP budget.
    const safeIp = ip && ip.trim() ? ip.trim() : "unknown";
    const ipOk = await checkAndCharge(
      db,
      docId("ip", safeIp),
      IP_WINDOW_MS,
      IP_MAX,
      now,
    );
    return emailOk && ipOk;
  } catch (e: any) {
    console.warn("magicLink.ratelimit.error", e?.message ?? String(e));
    return true;
  }
}
