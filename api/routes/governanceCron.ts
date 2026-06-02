// Chase engine cron endpoint.
//
// Two callers:
//   • Vercel cron, hourly (`/api?action=runChaseEngine`). Runs across
//     every workspace. In the v1 scope, "every workspace" = the set
//     of distinct `clientId` values that have governance docs in
//     Firestore. No private auth is required because Vercel cron
//     only triggers from within the deployment + the handler is
//     idempotent.
//   • Manual nudge (`/api?action=governanceNudgeItem`). PgM clicks
//     "Nudge" on a Dashboard inbox row → handler fires a one-off
//     chase regardless of the cron's queue.
//
// Idempotency: every chase write is keyed by `dedupeKey`; the same
// chase on the same item is suppressed if one fired in the last 12h.
//
// Notification dispatch in v1 = FCM push (already wired) + a
// `chaseEvents` Firestore log row. Real SMTP / Exchange wiring is
// Q9 ops track — the engine emits events, the channel layer ships
// them.

import type { ApiContext } from '../lib/context.js';
import { computeChaseEvents, URGENT_KINDS, type ChaseEvent } from '../lib/chaseEngine.js';
import { logSystemActivity } from '../lib/activityLog.js';

const DEDUPE_WINDOW_HOURS = 12;

function nowIso() {
  return new Date().toISOString();
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
    .collection('chaseEvents')
    .where('clientId', '==', clientId)
    .where('dedupeKey', '==', dedupeKey)
    .where('createdAt', '>=', cutoff)
    .limit(1)
    .get();
  return !snap.empty;
}

interface DispatchTarget {
  uid: string;
  fcmToken: string | null;
  /** when false, the user has opted out of chase notifications.
   *  We still log the chase to `chaseEvents` (audit) but skip dispatch.*/
  chaseEnabled: boolean;
}

async function resolveRecipients(
  ctx: ApiContext,
  clientId: string,
  ev: ChaseEvent,
  ownerUid: string | null,
): Promise<DispatchTarget[]> {
  const targets: DispatchTarget[] = [];

  const wantOwner = ev.recipient === 'owner' || ev.recipient === 'owner+pgm';
  const wantPgm = ev.recipient === 'pgm' || ev.recipient === 'owner+pgm';

  // Helper — read notification preferences off a user doc. Default
  // is opt-IN (chase enabled) so existing users keep getting chases
  // without having to flip anything. Explicit `false` opts out.
  const readPrefs = (data: Record<string, any>): boolean => {
    const np = data.notificationPreferences;
    if (np && typeof np === 'object') {
      if (np.chase === false) return false;
    }
    return true;
  };

  if (wantOwner && ownerUid) {
    try {
      const ownerDoc = await ctx.db.collection('users').doc(ownerUid).get();
      if (ownerDoc.exists) {
        const data = ownerDoc.data() ?? {};
        targets.push({
          uid: ownerUid,
          fcmToken: typeof data.fcmToken === 'string' ? data.fcmToken : null,
          chaseEnabled: readPrefs(data),
        });
      }
    } catch (err) {
      console.error('[chase] owner lookup failed', err);
    }
  }
  if (wantPgm) {
    // PgM = the workspace owner (clientId === primaryUid). Future
    // multi-PgM workspaces can swap this for `governanceListWorkspaceMembers`
    // filtered by role.
    try {
      const pgmDoc = await ctx.db.collection('users').doc(clientId).get();
      if (pgmDoc.exists && (!ownerUid || clientId !== ownerUid)) {
        const data = pgmDoc.data() ?? {};
        targets.push({
          uid: clientId,
          fcmToken: typeof data.fcmToken === 'string' ? data.fcmToken : null,
          chaseEnabled: readPrefs(data),
        });
      }
    } catch (err) {
      console.error('[chase] PgM lookup failed', err);
    }
  }
  return targets;
}

async function dispatchPush(
  ctx: ApiContext,
  target: DispatchTarget,
  ev: ChaseEvent,
): Promise<{ messageId: string | null; error: string | null }> {
  // respect opt-out. The chase event still lands in the
  // audit log so we can prove we never harassed a muted user.
  if (!target.chaseEnabled) {
    return { messageId: null, error: 'Recipient opted out of chase notifications' };
  }
  if (!target.fcmToken) {
    return { messageId: null, error: 'No FCM token' };
  }
  try {
    const messaging = ctx.getMessagingService();
    const messageId = await messaging.send({
      token: target.fcmToken,
      notification: {
        title:
          ev.severity === 'urgent'
            ? `Urgent: ${ev.itemTitle}`
            : ev.severity === 'warning'
              ? `Reminder: ${ev.itemTitle}`
              : ev.itemTitle,
        body: ev.message,
      },
      data: {
        kind: ev.kind,
        itemKind: ev.itemKind,
        itemId: ev.itemId,
        severity: ev.severity,
      },
    });
    return { messageId: typeof messageId === 'string' ? messageId : null, error: null };
  } catch (e: any) {
    console.error('[chase] FCM send failed', e?.message ?? e);
    return { messageId: null, error: e?.message ?? 'FCM dispatch failed' };
  }
}

interface PerWorkspaceResult {
  clientId: string;
  emitted: number;
  suppressedAsDuplicate: number;
  delivered: number;
  failed: number;
}

async function processWorkspace(
  ctx: ApiContext,
  clientId: string,
  options: { onlyForItemId?: string } = {},
): Promise<PerWorkspaceResult> {
  const result: PerWorkspaceResult = {
    clientId,
    emitted: 0,
    suppressedAsDuplicate: 0,
    delivered: 0,
    failed: 0,
  };

  const [reportsSnap, fpSnap, meetingsSnap] = await Promise.all([
    ctx.db
      .collection('reports')
      .where('clientId', '==', clientId)
      .get(),
    ctx.db
      .collection('forwardPlanItems')
      .where('clientId', '==', clientId)
      .get(),
    ctx.db
      .collection('meetings')
      .where('clientId', '==', clientId)
      .get(),
  ]);

  const reports = reportsSnap.docs.map((d) => ({
    id: d.data().id ?? d.id,
    title: d.data().title ?? 'Untitled',
    status: d.data().status ?? '',
    ownerUid: d.data().ownerUid ?? null,
    targetBoardDate: d.data().targetBoardDate ?? null,
    softDeleted: !!d.data().softDeleted,
  }));
  const fpItems = fpSnap.docs.map((d) => ({
    id: d.data().id ?? d.id,
    title: d.data().title ?? 'Untitled',
    status: d.data().status ?? '',
    targetDecisionDate: d.data().targetDecisionDate ?? null,
    isKeyDecision: !!d.data().isKeyDecision,
    softDeleted: !!d.data().softDeleted,
  }));
  const meetings = meetingsSnap.docs.map((d) => ({
    id: d.data().id ?? d.id,
    title: d.data().title ?? null,
    status: d.data().status ?? '',
    date: d.data().date ?? null,
    timeStart: d.data().timeStart ?? null,
    agenda: d.data().agenda ?? null,
    softDeleted: !!d.data().softDeleted,
  }));

  let events = computeChaseEvents({ now: new Date(), reports, fpItems, meetings });
  if (options.onlyForItemId) {
    events = events.filter((e) => e.itemId === options.onlyForItemId);
  }
  result.emitted = events.length;

  // Owner uid lookup table for resolveRecipients.
  const ownerByItem = new Map<string, string | null>();
  for (const r of reports) ownerByItem.set(`report:${r.id}`, r.ownerUid);
  // FP items + meetings — chase recipients are workspace-scoped (PgM
  // is the workspace owner); the engine dispatches via `recipient`.

  for (const ev of events) {
    if (await recentDuplicate(ctx, clientId, ev.dedupeKey)) {
      result.suppressedAsDuplicate += 1;
      continue;
    }
    const ownerUid =
      ev.itemKind === 'report'
        ? ownerByItem.get(`report:${ev.itemId}`) ?? null
        : null;
    const targets = await resolveRecipients(ctx, clientId, ev, ownerUid);

    // Persist the chase log row first — the FCM dispatch is best-effort.
    let chaseRefId: string | null = null;
    try {
      const ref = ctx.db.collection('chaseEvents').doc();
      const baseRow = {
        clientId,
        dedupeKey: ev.dedupeKey,
        kind: ev.kind,
        recipientMode: ev.recipient,
        itemKind: ev.itemKind,
        itemId: ev.itemId,
        itemTitle: ev.itemTitle,
        message: ev.message,
        severity: ev.severity,
        urgent: URGENT_KINDS.includes(ev.kind),
        scheduledFor: ev.scheduledFor,
        createdAt: nowIso(),
        recipientUids: targets.map((t) => t.uid),
        deliveryAttempts: [] as Array<{ uid: string; messageId: string | null; error: string | null; at: string }>,
      };
      await ref.set(baseRow);
      chaseRefId = ref.id;
    } catch (err) {
      console.error('[chase] log write failed', err);
      result.failed += 1;
      continue;
    }

    const attempts: Array<{ uid: string; messageId: string | null; error: string | null; at: string }> = [];
    for (const t of targets) {
      const out = await dispatchPush(ctx, t, ev);
      attempts.push({ uid: t.uid, ...out, at: nowIso() });
      if (out.error === null) result.delivered += 1;
      else result.failed += 1;
    }
    if (chaseRefId) {
      try {
        await ctx.db
          .collection('chaseEvents')
          .doc(chaseRefId)
          .set({ deliveryAttempts: attempts, dispatchedAt: nowIso() }, { merge: true });
      } catch (err) {
        console.error('[chase] log update failed', err);
      }
    }
  }

  return result;
}

// TTL purge for the chase audit log. Anything older than
// `maxAgeDays` is deleted, capped at `maxDeletes` per tick so we
// don't blow the Firestore 500-op batch limit. Returns the actual
// delete count.
async function purgeOldChaseEvents(
  ctx: ApiContext,
  maxAgeDays: number,
  maxDeletes: number,
): Promise<number> {
  const cutoff = new Date(
    Date.now() - maxAgeDays * 24 * 60 * 60 * 1000,
  ).toISOString();
  const snap = await ctx.db
    .collection('chaseEvents')
    .where('createdAt', '<', cutoff)
    .limit(maxDeletes)
    .get();
  if (snap.empty) return 0;
  const batch = ctx.db.batch();
  for (const d of snap.docs) batch.delete(d.ref);
  await batch.commit();
  return snap.size;
}

// ── Endpoints ───────────────────────────────────────────────────────────

// Vercel cron sends `Authorization: Bearer <CRON_SECRET>`
// when `CRON_SECRET` is set. When the env var is missing (local dev),
// we keep the handler permissive so devs can still hit the endpoint.
//
// Hardening rule: if a `CRON_SECRET` is configured AND the caller is
// neither an authenticated admin nor a holder of the secret, reject.
// Any signed-in caller can still trigger their own workspace (the
// `else` branch below) because the existing dispatcher already
// validates the Firebase ID token before reaching this handler.
function isAuthorisedCronCall(req: any, ctx: ApiContext): boolean {
  if (ctx.isAdmin) return true;
  const secret = process.env.CRON_SECRET;
  if (!secret) return true; // dev mode — no secret configured
  const auth = req?.headers?.authorization ?? req?.headers?.Authorization;
  if (typeof auth !== 'string') return false;
  const expected = `Bearer ${secret}`;
  return auth === expected;
}

async function runChaseEngine(req: any, res: any, ctx: ApiContext) {
  try {
    if (!isAuthorisedCronCall(req, ctx)) {
      return res.status(403).json({
        success: false,
        error: 'Cron auth failed.',
        code: 'CRON_FORBIDDEN',
      });
    }
    // V1 scope: process the caller's own workspace. When invoked via
    // Vercel cron we run as the platform admin account; the handler
    // walks every workspace. For the developer-triggered case, this
    // limit keeps the response tight.
    const isPlatformAdmin = !!ctx.isAdmin;
    const workspaceIds: string[] = [];
    if (isPlatformAdmin) {
      // Discover workspaces by enumerating distinct clientIds with
      // any governance entity. Cheap proxy: the `users` collection
      // already has one doc per workspace owner.
      try {
        const snap = await ctx.db.collection('users').limit(500).get();
        for (const d of snap.docs) {
          const data = d.data() ?? {};
          if (data.role === 'client_admin' || !data.linkedToOwnerUid) {
            workspaceIds.push(d.id);
          }
        }
      } catch (err) {
        console.error('[chase] workspace discovery failed', err);
      }
    } else {
      workspaceIds.push(ctx.primaryUid);
    }

    const results: PerWorkspaceResult[] = [];
    for (const clientId of workspaceIds) {
      const r = await processWorkspace(ctx, clientId);
      results.push(r);
    }

    // opportunistic 90-day TTL purge so the audit log
    // doesn't grow unbounded. Only the platform-admin cron path
    // runs this (single-workspace ad-hoc nudges keep the log
    // intact). Limit per tick = 200 deletes so we never blow the
    // 500-op batch ceiling.
    let purgedChaseEvents = 0;
    if (isPlatformAdmin) {
      try {
        purgedChaseEvents = await purgeOldChaseEvents(ctx, 90, 200);
      } catch (err) {
        console.error('[chase] TTL purge failed', err);
      }
    }

    await logSystemActivity(ctx, "chase_engine_run", {
      entityType: "system",
      entityName: "Chase engine run",
      details: { workspacesProcessed: workspaceIds.length, purgedChaseEvents },
    });

    return res.status(200).json({
      success: true,
      ranAt: nowIso(),
      workspaces: results,
      purgedChaseEvents,
      totals: results.reduce(
        (acc, r) => ({
          emitted: acc.emitted + r.emitted,
          suppressedAsDuplicate: acc.suppressedAsDuplicate + r.suppressedAsDuplicate,
          delivered: acc.delivered + r.delivered,
          failed: acc.failed + r.failed,
        }),
        { emitted: 0, suppressedAsDuplicate: 0, delivered: 0, failed: 0 },
      ),
    });
  } catch (e: any) {
    console.error('[runChaseEngine] failed:', e);
    return res.status(500).json({
      success: false,
      error: e?.message ?? 'Chase engine failed.',
      code: 'CRON_FAILED',
    });
  }
}

async function governanceNudgeItem(req: any, res: any, ctx: ApiContext) {
  try {
    const { itemId } = req.body ?? {};
    if (typeof itemId !== 'string' || !itemId) {
      return res.status(400).json({
        success: false,
        error: 'itemId required.',
        code: 'INVALID_INPUT',
      });
    }
    if (!ctx.isClientAdmin) {
      return res.status(403).json({
        success: false,
        error: 'Only Client Admin can manually nudge.',
        code: 'FORBIDDEN',
      });
    }
    const result = await processWorkspace(ctx, ctx.primaryUid, {
      onlyForItemId: itemId,
    });
    return res.status(200).json({ success: true, result });
  } catch (e: any) {
    console.error('[governanceNudgeItem] failed:', e);
    return res.status(500).json({
      success: false,
      error: e?.message ?? 'Nudge failed.',
      code: 'NUDGE_FAILED',
    });
  }
}

async function governanceListChaseEvents(_req: any, res: any, ctx: ApiContext) {
  try {
    const snap = await ctx.db
      .collection('chaseEvents')
      .where('clientId', '==', ctx.primaryUid)
      .get();
    const items = snap.docs
      .map((d) => ({ _id: d.id, ...d.data() }))
      .sort((a: any, b: any) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''))
      .slice(0, 100);
    return res.status(200).json({ success: true, items });
  } catch (e: any) {
    console.error('[governanceListChaseEvents] failed:', e);
    return res.status(500).json({
      success: false,
      error: e?.message ?? 'Failed to load chase log.',
      code: 'LOAD_FAILED',
    });
  }
}

export const governanceCronRoutes: Record<string, any> = {
  runChaseEngine,
  governanceNudgeItem,
  governanceListChaseEvents,
};
