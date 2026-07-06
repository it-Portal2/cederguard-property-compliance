// Automatic detection & alert engine — cron endpoint.
//
// Generalises the governance chase engine (api/routes/governanceCron.ts) to
// the whole platform: on an hourly Vercel cron it walks every workspace, runs
// the pure detectors (api/lib/alertEngine/detectors.ts) over that workspace's
// compliance / tasks / incidents / risks, dedupes, persists a `detectedAlerts`
// row and pushes an FCM notification (+ in-app via the read APIs below).
//
// Locked: in-app + push only (no email); auto-surface + auto-notify — it does
// NOT auto-escalate into `assuranceAlerts` (that stays a human action and fires
// AI cost). Recipients default to the workspace owner + client admins until the
// client supplies the per-signal routing table (Q2.3).

import type { ApiContext } from '../lib/context.js';
import { loadAlertThresholds } from '../lib/alertConfig.js';
import {
  computeDetectedAlerts,
  type AlertSignalKind,
  type DetectedAlert,
} from '../lib/alertEngine/detectors.js';
import { logSystemActivity } from '../lib/activityLog.js';

const DEDUPE_WINDOW_HOURS = 24; // same signal on same entity ⇒ at most once/day
const COLLECTION = 'detectedAlerts';

const nowIso = () => new Date().toISOString();

// ── Cron auth (mirrors governanceCron) ────────────────────────────────────
function isAuthorisedCronCall(req: any, ctx: ApiContext): boolean {
  if (ctx.isAdmin) return true;
  const secret = process.env.CRON_SECRET;
  if (!secret) return true; // dev — no secret configured
  const auth = req?.headers?.authorization ?? req?.headers?.Authorization;
  if (typeof auth !== 'string') return false;
  return auth === `Bearer ${secret}`;
}

async function recentDuplicate(
  ctx: ApiContext,
  clientId: string,
  dedupeKey: string,
): Promise<boolean> {
  const cutoff = new Date(
    Date.now() - DEDUPE_WINDOW_HOURS * 60 * 60 * 1000,
  ).toISOString();
  const snap = await ctx.db
    .collection(COLLECTION)
    .where('clientId', '==', clientId)
    .where('dedupeKey', '==', dedupeKey)
    .where('createdAt', '>=', cutoff)
    .limit(1)
    .get();
  return !snap.empty;
}

interface AlertTarget {
  uid: string;
  fcmToken: string | null;
  prefs: any;
}

/** Default recipients until the routing table lands: workspace owner + client admins. */
async function resolveWorkspaceTargets(
  ctx: ApiContext,
  clientId: string,
): Promise<AlertTarget[]> {
  const uids = new Set<string>([clientId]);
  try {
    const snap = await ctx.db
      .collection('users')
      .where('clientId', '==', clientId)
      .limit(50)
      .get();
    for (const d of snap.docs) {
      if ((d.data() ?? {}).role === 'client_admin') uids.add(d.id);
    }
  } catch (err) {
    console.error('[alerts] recipient lookup failed', err);
  }
  const targets: AlertTarget[] = [];
  for (const uid of uids) {
    try {
      const u = (await ctx.db.collection('users').doc(uid).get()).data() ?? {};
      targets.push({
        uid,
        fcmToken: u.fcmToken ?? null,
        prefs: u.notificationPreferences ?? null,
      });
    } catch {
      /* skip unreadable user */
    }
  }
  return targets;
}

/** Opt-out: master `alerts:false` or per-signal `alertSignals[kind]:false`. Default opt-in. */
function alertsEnabled(prefs: any, kind: AlertSignalKind): boolean {
  if (prefs && typeof prefs === 'object') {
    if (prefs.alerts === false) return false;
    if (prefs.alertSignals && prefs.alertSignals[kind] === false) return false;
  }
  return true;
}

async function dispatchPush(
  ctx: ApiContext,
  target: AlertTarget,
  alert: DetectedAlert,
): Promise<{ messageId: string | null; error: string | null }> {
  if (!alertsEnabled(target.prefs, alert.signalKind)) {
    return { messageId: null, error: 'Recipient opted out' };
  }
  if (!target.fcmToken) return { messageId: null, error: 'No FCM token' };
  try {
    const messaging = ctx.getMessagingService();
    const messageId = await messaging.send({
      token: target.fcmToken,
      notification: {
        title: alert.severity === 'urgent' ? `Urgent: ${alert.entityTitle}` : alert.entityTitle,
        body: alert.message,
      },
      data: {
        signalKind: alert.signalKind,
        entityKind: alert.entityKind,
        entityId: alert.entityId,
        severity: alert.severity,
      },
    });
    return { messageId: typeof messageId === 'string' ? messageId : null, error: null };
  } catch (e: any) {
    console.error('[alerts] FCM send failed', e?.message ?? e);
    return { messageId: null, error: e?.message ?? 'FCM dispatch failed' };
  }
}

async function readContextArray(
  ctx: ApiContext,
  contextId: string,
  collection: string,
): Promise<any[]> {
  try {
    const doc = await ctx.db
      .collection('projects')
      .doc(contextId)
      .collection('data')
      .doc(collection)
      .get();
    const arr = doc.exists ? doc.data()?.data : null;
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

interface PerWorkspaceResult {
  clientId: string;
  emitted: number;
  suppressed: number;
  delivered: number;
  failed: number;
}

async function processWorkspace(
  ctx: ApiContext,
  clientId: string,
): Promise<PerWorkspaceResult> {
  const result: PerWorkspaceResult = {
    clientId,
    emitted: 0,
    suppressed: 0,
    delivered: 0,
    failed: 0,
  };

  // Context ids = the workspace's projects + programmes (both key project-style
  // data docs at projects/{id}/data/{collection}).
  const [projSnap, progSnap, incSnap] = await Promise.all([
    ctx.db.collection('projects').where('clientId', '==', clientId).get(),
    ctx.db.collection('programmes').where('clientId', '==', clientId).get(),
    ctx.db.collection('incidents').where('clientId', '==', clientId).get(),
  ]);
  const contextIds = [
    ...projSnap.docs.map((d) => d.id),
    ...progSnap.docs.map((d) => d.id),
  ];

  const complianceItems: any[] = [];
  const risks: any[] = [];
  const tasks: any[] = [];
  for (const cid of contextIds) {
    const [c, r, t] = await Promise.all([
      readContextArray(ctx, cid, 'complianceItems'),
      readContextArray(ctx, cid, 'risks'),
      readContextArray(ctx, cid, 'tasks'),
    ]);
    complianceItems.push(...c);
    risks.push(...r);
    tasks.push(...t);
  }
  const incidents = incSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

  const thresholds = await loadAlertThresholds(ctx, clientId);
  const alerts = computeDetectedAlerts(
    { complianceItems, tasks, incidents, risks },
    thresholds,
    new Date(),
  );
  result.emitted = alerts.length;

  const targets = await resolveWorkspaceTargets(ctx, clientId);

  for (const alert of alerts) {
    if (await recentDuplicate(ctx, clientId, alert.dedupeKey)) {
      result.suppressed += 1;
      continue;
    }
    // Persist the alert row first — dispatch is best-effort.
    let refId: string | null = null;
    try {
      const ref = ctx.db.collection(COLLECTION).doc();
      await ref.set({
        clientId,
        signalKind: alert.signalKind,
        dedupeKey: alert.dedupeKey,
        severity: alert.severity,
        entityKind: alert.entityKind,
        entityId: alert.entityId,
        entityTitle: alert.entityTitle,
        projectId: alert.projectId ?? null,
        message: alert.message,
        thresholdUsed: alert.thresholdUsed,
        createdAt: nowIso(),
        recipientUids: targets.map((t) => t.uid),
        deliveryAttempts: [],
        readBy: [],
      });
      refId = ref.id;
    } catch (err) {
      console.error('[alerts] row write failed', err);
      result.failed += 1;
      continue;
    }

    const attempts: Array<{ uid: string; messageId: string | null; error: string | null; at: string }> = [];
    for (const t of targets) {
      const out = await dispatchPush(ctx, t, alert);
      attempts.push({ uid: t.uid, ...out, at: nowIso() });
      if (out.error === null) result.delivered += 1;
      else result.failed += 1;
    }
    if (refId) {
      try {
        await ctx.db
          .collection(COLLECTION)
          .doc(refId)
          .set({ deliveryAttempts: attempts, dispatchedAt: nowIso() }, { merge: true });
      } catch (err) {
        console.error('[alerts] row update failed', err);
      }
    }
  }

  return result;
}

async function purgeOldAlerts(ctx: ApiContext, maxAgeDays: number, maxDeletes: number): Promise<number> {
  const cutoff = new Date(Date.now() - maxAgeDays * 24 * 60 * 60 * 1000).toISOString();
  const snap = await ctx.db
    .collection(COLLECTION)
    .where('createdAt', '<', cutoff)
    .limit(maxDeletes)
    .get();
  if (snap.empty) return 0;
  const batch = ctx.db.batch();
  for (const d of snap.docs) batch.delete(d.ref);
  await batch.commit();
  return snap.size;
}

// ── Endpoints ─────────────────────────────────────────────────────────────

async function runAlertEngine(req: any, res: any, ctx: ApiContext) {
  try {
    if (!isAuthorisedCronCall(req, ctx)) {
      return res.status(403).json({ success: false, error: 'Cron auth failed.', code: 'CRON_FORBIDDEN' });
    }
    const isPlatformAdmin = !!ctx.isAdmin;
    const workspaceIds: string[] = [];
    if (isPlatformAdmin) {
      try {
        const snap = await ctx.db.collection('users').limit(500).get();
        for (const d of snap.docs) {
          const data = d.data() ?? {};
          if (data.role === 'client_admin' || !data.linkedToOwnerUid) workspaceIds.push(d.id);
        }
      } catch (err) {
        console.error('[alerts] workspace discovery failed', err);
      }
    } else {
      workspaceIds.push(ctx.primaryUid);
    }

    const results: PerWorkspaceResult[] = [];
    for (const clientId of workspaceIds) {
      results.push(await processWorkspace(ctx, clientId));
    }

    let purged = 0;
    if (isPlatformAdmin) {
      try {
        purged = await purgeOldAlerts(ctx, 90, 200);
      } catch (err) {
        console.error('[alerts] TTL purge failed', err);
      }
    }

    await logSystemActivity(ctx, 'alert_engine_run', {
      entityType: 'system',
      entityName: 'Alert engine run',
      details: { workspaces: workspaceIds.length, purged },
    });

    return res.status(200).json({
      success: true,
      workspaces: workspaceIds.length,
      purged,
      totals: results.reduce(
        (acc, r) => ({
          emitted: acc.emitted + r.emitted,
          suppressed: acc.suppressed + r.suppressed,
          delivered: acc.delivered + r.delivered,
          failed: acc.failed + r.failed,
        }),
        { emitted: 0, suppressed: 0, delivered: 0, failed: 0 },
      ),
    });
  } catch (e: any) {
    console.error('[runAlertEngine] failed:', e);
    return res.status(500).json({ success: false, error: e?.message ?? 'Alert engine failed.', code: 'ALERT_FAILED' });
  }
}

/** Client read — the workspace's detected alerts (most recent first). */
async function listDetectedAlerts(_req: any, res: any, ctx: ApiContext) {
  try {
    const snap = await ctx.db
      .collection(COLLECTION)
      .where('clientId', '==', ctx.primaryUid)
      .get();
    const items = snap.docs
      .map((d) => ({ _id: d.id, ...d.data() }))
      .sort((a: any, b: any) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''))
      .slice(0, 200);
    return res.status(200).json({ success: true, items });
  } catch (e: any) {
    console.error('[listDetectedAlerts] failed:', e);
    return res.status(500).json({ success: false, error: e?.message ?? 'Failed to load alerts.', code: 'LOAD_FAILED' });
  }
}

/** Mark a detected alert read for the current user. */
async function markDetectedAlertRead(req: any, res: any, ctx: ApiContext) {
  try {
    const { id } = req.body ?? {};
    if (typeof id !== 'string' || !id) {
      return res.status(400).json({ success: false, error: 'id required.', code: 'INVALID_INPUT' });
    }
    const ref = ctx.db.collection(COLLECTION).doc(id);
    const doc = await ref.get();
    if (!doc.exists) return res.status(404).json({ success: false, error: 'Not found.' });
    if (doc.data()?.clientId !== ctx.primaryUid) {
      return res.status(403).json({ success: false, error: 'Forbidden.', code: 'FORBIDDEN' });
    }
    const readBy: string[] = Array.isArray(doc.data()?.readBy) ? doc.data()!.readBy : [];
    if (!readBy.includes(ctx.uid)) readBy.push(ctx.uid);
    await ref.set({ readBy }, { merge: true });
    return res.status(200).json({ success: true });
  } catch (e: any) {
    console.error('[markDetectedAlertRead] failed:', e);
    return res.status(500).json({ success: false, error: e?.message ?? 'Failed.', code: 'MARK_FAILED' });
  }
}

export const alertEngineRoutes: Record<string, any> = {
  runAlertEngine,
  listDetectedAlerts,
  markDetectedAlertRead,
};
