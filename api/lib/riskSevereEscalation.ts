// Severe-risk escalation routing — +
// answer: when a risk's Gross OR Residual Impact = 5 ("Severe"
// band), the Strategic Director assigned to the project/programme must be
// notified immediately.
//
// Routing rule ( + directive "risks for projects are different
// from the risk for programs"):
//   For programme-level risks (isProgrammeLevel === true) → SDs in the
//     workspace whose role/extraRoles contain `strategic_director`.
//   For project-level risks → same workspace-level SDs.
//   Fallback: if no SDs are found, route to ClientAdmins so the escalation
//     is never lost.
//
// This module is server-side only. It is consumed by the risk-save endpoint
// in when the matrix-derived Impact rating crosses into Severe.

import { FieldValue } from "firebase-admin/firestore";
import type { ApiContext } from "./context";
import { logSystemActivity } from "./activityLog.js";

export type SevereEscalationRouteKind = "project_sd" | "programme_sd" | "pgm_fallback";

export interface SevereEscalationRecipient {
  uid: string;
  email?: string;
  name?: string;
  role?: string;
  routedAs: SevereEscalationRouteKind;
  /** Device token for FCM push (null when the user has none registered). */
  fcmToken?: string | null;
  /** false when the user has opted out of alert notifications. */
  notifyEnabled?: boolean;
}

interface RiskLike {
  id?: string;
  projectId?: string | null;
  programmeId?: string | null;
  isProgrammeLevel?: boolean | null;
  grossI?: number | null;
  residualI?: number | null;
}

/**
 * Returns true when EITHER gross OR residual Impact rating is 5.
 * Mirrors the client-side `isSevereImpact` helper in riskScoringMatrix.ts.
 */
export function isSevereRisk(risk: RiskLike): boolean {
  const g = Number(risk.grossI) || 0;
  const r = Number(risk.residualI) || 0;
  return g >= 5 || r >= 5;
}

/**
 * Resolves the list of Strategic Director recipients for a Severe-risk
 * notification. Reads the workspace's users collection, filters by canonical
 * role + extraRoles, and returns a deduplicated list with route metadata.
 * Falls back to ClientAdmins (`role === 'client_admin'`) when no SDs are
 * assigned to the workspace, so the escalation always reaches someone.
 * NOTE: this is a pure read against `users/{uid}` docs. Notification
 * dispatch (FCM + email) is wired in via the existing
 * `sendNotification` action at api/routes/notifications.ts.
 */
export async function findStrategicDirectorRecipients(
  ctx: ApiContext,
  risk: RiskLike,
): Promise<SevereEscalationRecipient[]> {
  const clientId = ctx.primaryUid;
  if (!clientId) return [];

  // Workspace-scoped user scan capped at 500 to bound latency on large
  // tenants. Strategic Directors are a small fixed set; even busy workspaces
  // sit well under this cap.
  const usersSnap = await ctx.db
    .collection("users")
    .where("clientId", "==", clientId)
    .limit(500)
    .get();

  const sds: SevereEscalationRecipient[] = [];
  const fallbacks: SevereEscalationRecipient[] = [];
  const routeKind: SevereEscalationRouteKind = risk.isProgrammeLevel
    ? "programme_sd"
    : "project_sd";

  for (const doc of usersSnap.docs) {
    const u = doc.data() as Record<string, unknown>;
    const uid = doc.id;
    const role = String(u.role ?? "");
    const extras: string[] = Array.isArray(u.extraRoles)
      ? (u.extraRoles as unknown[]).map((x) => String(x))
      : [];
    const isSd = role === "strategic_director" || extras.includes("strategic_director");
    const isClientAdmin = role === "client_admin" || role === "admin" || role === "super_admin";

    const np = u.notificationPreferences as Record<string, unknown> | undefined;
    const notifyEnabled = !(
      np &&
      typeof np === "object" &&
      (np.alerts === false ||
        (np.alertSignals &&
          (np.alertSignals as Record<string, unknown>)["risk-severe"] === false))
    );
    const base: SevereEscalationRecipient = {
      uid,
      email: typeof u.email === "string" ? u.email : undefined,
      name: typeof u.name === "string" ? u.name : undefined,
      role,
      routedAs: routeKind,
      fcmToken: typeof u.fcmToken === "string" ? u.fcmToken : null,
      notifyEnabled,
    };

    if (isSd) sds.push(base);
    else if (isClientAdmin) {
      fallbacks.push({ ...base, routedAs: "pgm_fallback" });
    }
  }

  if (sds.length > 0) return sds;
  return fallbacks;
}

/**
 * Detects risks that have NEWLY transitioned into Severe state on this save
 * (i.e. their gross OR residual Impact = 5 in the new array, AND they were
 * either absent OR not previously Severe in the pre-mutation array).
 *
 * Idempotent: a risk that was already Severe in the previous save won't
 * trigger another notification. A risk that's been edited but stayed Severe
 * also won't re-trigger. Only the transition from non-Severe → Severe
 * (or first creation at Severe) fires.
 */
export function detectSevereTransitions(
  prevArr: unknown[] | null,
  newArr: unknown[],
): RiskLike[] {
  const prevSevereIds = new Set<string>();
  if (Array.isArray(prevArr)) {
    for (const r of prevArr) {
      const risk = r as RiskLike;
      if (risk?.id && isSevereRisk(risk)) {
        prevSevereIds.add(String(risk.id));
      }
    }
  }
  const transitions: RiskLike[] = [];
  for (const r of newArr) {
    const risk = r as RiskLike;
    if (!risk || !risk.id) continue;
    if (!isSevereRisk(risk)) continue;
    if (prevSevereIds.has(String(risk.id))) continue;
    transitions.push(risk);
  }
  return transitions;
}

interface SevereEscalationWriteSummary {
  alertCount: number;
  recipientCount: number;
  riskIds: string[];
}

/**
 * Writes a Severe-risk escalation event to:
 *   1. `severeRiskAlerts/{alertId}` — permanent audit collection capturing
 *      every Severe transition with recipients + risk meta. Future surfaces
 *      (Severe-escalation review screen, SD inbox) read from here.
 *   2. `activityLogs/{auto}` — single summary entry for the existing admin
 *      activity stream (matches the existing logging pattern in saveData).
 *
 * Fire-and-forget — never blocks the user's save. Errors logged and
 * swallowed so a Severe-detection failure can't break a normal risk save.
 *
 * Returns a summary used by the saveData response so the client can show
 * a "Strategic Director notified" toast.
 */
export async function writeSevereEscalations(
  ctx: ApiContext,
  options: {
    transitions: RiskLike[];
    contextId: string;
    contextKind: "project" | "programme";
  },
): Promise<SevereEscalationWriteSummary> {
  const { transitions, contextId, contextKind } = options;
  const summary: SevereEscalationWriteSummary = {
    alertCount: 0,
    recipientCount: 0,
    riskIds: [],
  };
  if (transitions.length === 0) return summary;

  // Resolve recipients ONCE per save (same workspace + same SD pool for all
  // transitioned risks in the same save batch).
  const recipients = await findStrategicDirectorRecipients(ctx, transitions[0]);
  summary.recipientCount = recipients.length;

  // Per-risk alert rows so a future SD inbox can render line-items.
  const batch = ctx.db.batch();
  const now = FieldValue.serverTimestamp();
  for (const risk of transitions) {
    const alertRef = ctx.db.collection("severeRiskAlerts").doc();
    const grossI = Number(risk.grossI) || 0;
    const residualI = Number(risk.residualI) || 0;
    batch.set(alertRef, {
      clientId: ctx.primaryUid,
      contextId,
      contextKind,
      riskId: String(risk.id ?? ""),
      isProgrammeLevel: !!risk.isProgrammeLevel,
      grossI,
      residualI,
      triggeredBy: grossI >= 5 ? (residualI >= 5 ? "both" : "gross") : "residual",
      recipientUids: recipients.map((r) => r.uid),
      recipientRoute:
        recipients[0]?.routedAs ??
        (risk.isProgrammeLevel ? "programme_sd" : "project_sd"),
      raisedBy: ctx.uid ?? null,
      raisedAt: now,
      acknowledgedAt: null,
    });
    summary.alertCount += 1;
    summary.riskIds.push(String(risk.id ?? ""));
  }

  try {
    await batch.commit();
  } catch (err) {
    console.error("[rsc-d] severeRiskAlerts batch write failed:", err);
    // Reset summary so the response doesn't claim we wrote rows we didn't.
    return { alertCount: 0, recipientCount: 0, riskIds: [] };
  }

  // Dispatch — the actual notification (FCM push) + a unified `detectedAlerts`
  // row so the escalation shows in-app alongside the cron-detected signals.
  // Best-effort: a dispatch failure never affects the recorded audit rows.
  const nowIso = new Date().toISOString();
  await Promise.all(
    transitions.map(async (risk) => {
      const riskId = String(risk.id ?? "");
      const title = String((risk as any).title ?? (risk as any).name ?? "Risk");
      const message = `Risk "${title}" has escalated to Severe and needs Strategic Director attention.`;
      const writeAlert = ctx.db
        .collection("detectedAlerts")
        .add({
          clientId: ctx.primaryUid,
          signalKind: "risk-severe",
          dedupeKey: `risk-severe:${riskId}`,
          severity: "urgent",
          entityKind: "risk",
          entityId: riskId,
          entityTitle: title,
          projectId: (risk as any).projectId ?? null,
          message,
          thresholdUsed: "gross or residual impact = 5",
          createdAt: nowIso,
          recipientUids: recipients.map((r) => r.uid),
          deliveryAttempts: [],
          readBy: [],
        })
        .catch((err) => console.error("[rsc-d] detectedAlerts write failed:", err));
      const pushes = recipients
        .filter((r) => r.notifyEnabled !== false && r.fcmToken)
        .map((r) =>
          ctx
            .getMessagingService()
            .send({
              token: r.fcmToken as string,
              notification: { title: `Urgent: ${title}`, body: message },
              data: { signalKind: "risk-severe", entityKind: "risk", entityId: riskId, severity: "urgent" },
            })
            .catch((err: any) => console.error("[rsc-d] FCM send failed:", err)),
        );
      await Promise.all([writeAlert, ...pushes]);
    }),
  );

  // System activity entry — automatic escalation triggered by a risk save.
  await logSystemActivity(ctx, "risks_severe_escalation", {
    entityType: contextKind,
    entityId: contextId,
    entityName: `Severe risk escalation (${summary.alertCount})`,
    details: {
      severeRiskCount: summary.alertCount,
      recipientCount: summary.recipientCount,
      riskIds: summary.riskIds,
      triggeredBy: "saveData",
    },
  });

  return summary;
}
