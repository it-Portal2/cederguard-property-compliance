// Meetings CRUD shell.
//
// Endpoints:
//   • governanceListMeetings — seed-on-first-read, tenant-scoped.
//   • governanceGetMeeting — cross-tenant guard.
//   • governanceUpsertMeeting — field whitelist; owner-or-admin gate.
//   • governanceSoftDeleteMeeting — soft-delete + restore via the same
//                                     endpoint, reason ≥ 5
//                                     chars, server-side status guard
//                                     (cannot soft-delete a Held meeting
//                                     closes the gap flagged in
//                                      audit).
//   • governanceMarkMeetingHeld — Scheduled → Held.
//   • governanceCancelMeeting — Scheduled → Cancelled with reason.
//
// Storage: `meetings/{clientId_meetingId}` — composite ID + `clientId`
// field. 8b adds the `minutes` / `decisions` /
// `actionItems` / `linkedReportIds` / `linkedProjectIds` fields.

import * as XLSX from 'xlsx';
import type { ApiContext } from '../lib/context.js';
import { SEED_MEETINGS, type MeetingStatus } from '../lib/meetingsSeed.js';
import {
  parseMeetingsXlsx,
  type ParsedMeeting,
  type FrameworkBodyLite,
} from '../lib/meetingsXlsxImport.js';
import {
  isWorkingDay,
  nextWorkingDay,
  shiftIfNonWorking,
} from '../lib/ukBankHolidays.js';
import { appendHistoryRow } from '../lib/historyRows.js';
import type { ChangeKind } from '../../src/types/historicalReporting.js';

const MEETING_ID_RE = /^[a-z0-9_-]{1,80}$/i;

//  fire-and-forget history capture for meeting mutations.
// Called after the primary write succeeds. Errors are swallowed inside
// appendHistoryRow so a history failure never blocks the user's save.
function captureMeetingHistory(
  ctx: ApiContext,
  args: {
    meetingId: string;
    prevState: Record<string, any> | null;
    newState: Record<string, any> | null;
    changeKind: ChangeKind;
  },
): void {
  void appendHistoryRow(ctx, {
    kind: 'governanceDoc',
    collection: 'meetings',
    ownerScope: args.meetingId,
    prevState: args.prevState,
    newState: args.newState,
    changeKind: args.changeKind,
  });
}

const MEETING_WRITABLE_FIELDS = [
  'title',
  'governanceBodyId',
  'governanceBodyLabel',
  'date',
  'timeStart',
  'timeEnd',
  'location',
  'chairUid',
  'chairLabel',
  'attendees',
  'agenda',
] as const;

const VALID_STATUSES: MeetingStatus[] = ['Scheduled', 'Held', 'Cancelled'];
// Upsert can only flip between safe transitions (Scheduled). Held +
// Cancelled go through dedicated endpoints.
const PATCH_ALLOWED_STATUSES: MeetingStatus[] = ['Scheduled'];

function pickFields<T extends readonly string[]>(
  input: any,
  allowed: T,
): Record<string, any> {
  const out: Record<string, any> = {};
  if (!input || typeof input !== 'object') return out;
  for (const k of allowed) {
    if (k in input) out[k] = input[k];
  }
  return out;
}

function nowIso() {
  return new Date().toISOString();
}

function meetingDocId(ctx: ApiContext, id: string): string {
  return `${ctx.primaryUid}_${id}`;
}

function isOwnerOrAdmin(ctx: ApiContext, ownerUid?: string | null): boolean {
  if (ctx.isClientAdmin) return true;
  if (!ownerUid) return false;
  return ownerUid === ctx.uid;
}

// ── Seed-on-first-read ──────────────────────────────────────────────────

async function seedMeetingsIfMissing(ctx: ApiContext) {
  const probe = await ctx.db
    .collection('meetings')
    .where('clientId', '==', ctx.primaryUid)
    .limit(1)
    .get();
  if (!probe.empty) return;

  const ts = nowIso();
  const batch = ctx.db.batch();
  for (const seed of SEED_MEETINGS) {
    const ref = ctx.db.collection('meetings').doc(meetingDocId(ctx, seed.id));
    batch.set(ref, {
      id: seed.id,
      clientId: ctx.primaryUid,
      title: seed.title,
      governanceBodyId: seed.governanceBodyId,
      governanceBodyLabel: seed.governanceBodyLabel,
      date: seed.date,
      timeStart: seed.timeStart,
      timeEnd: seed.timeEnd,
      location: seed.location,
      chairUid: seed.chairUid,
      chairLabel: seed.chairLabel,
      status: seed.status,
      attendees: seed.attendees,
      agenda: seed.agenda,
      ownerUid: ctx.uid,
      softDeleted: seed.softDeleted,
      deletionReason: seed.deletionReason ?? null,
      deletedAt: null,
      deletedBy: null,
      heldAt: seed.status === 'Held' ? ts : null,
      heldBy: seed.status === 'Held' ? ctx.uid : null,
      cancelledAt: seed.status === 'Cancelled' ? ts : null,
      cancelledBy: seed.status === 'Cancelled' ? ctx.uid : null,
      cancellationReason:
        seed.status === 'Cancelled' ? 'Deferred — placeholder.' : null,
      createdAt: ts,
      createdBy: ctx.uid,
      updatedAt: ts,
      updatedBy: ctx.uid,
      seeded: true,
    });
  }
  await batch.commit();
}

// ── Endpoints ───────────────────────────────────────────────────────────

async function governanceListMeetings(_req: any, res: any, ctx: ApiContext) {
  try {
    await seedMeetingsIfMissing(ctx);
    const snap = await ctx.db
      .collection('meetings')
      .where('clientId', '==', ctx.primaryUid)
      .get();
    const items = snap.docs.map((d) => ({ _id: d.id, ...d.data() }));
    return res.status(200).json({ success: true, items });
  } catch (e: any) {
    console.error('[governanceListMeetings] failed:', e);
    return res.status(500).json({
      success: false,
      error: e?.message ?? 'Failed to load meetings.',
      code: 'LOAD_FAILED',
    });
  }
}

async function governanceGetMeeting(req: any, res: any, ctx: ApiContext) {
  try {
    const { meetingId } = req.body ?? {};
    if (!MEETING_ID_RE.test(meetingId ?? '')) {
      return res.status(400).json({
        success: false,
        error: 'meetingId required.',
        code: 'INVALID_INPUT',
      });
    }
    const ref = ctx.db
      .collection('meetings')
      .doc(meetingDocId(ctx, meetingId));
    const snap = await ref.get();
    if (!snap.exists) {
      return res
        .status(404)
        .json({ success: false, error: 'Meeting not found.', code: 'NOT_FOUND' });
    }
    const data = snap.data() ?? {};
    if (data.clientId !== ctx.primaryUid) {
      return res.status(403).json({
        success: false,
        error: 'Meeting belongs to another workspace.',
        code: 'FORBIDDEN',
      });
    }
    return res
      .status(200)
      .json({ success: true, item: { _id: ref.id, ...data } });
  } catch (e: any) {
    console.error('[governanceGetMeeting] failed:', e);
    return res.status(500).json({
      success: false,
      error: e?.message ?? 'Failed to load meeting.',
      code: 'LOAD_FAILED',
    });
  }
}

async function governanceUpsertMeeting(req: any, res: any, ctx: ApiContext) {
  try {
    const { meetingId, patch } = req.body ?? {};
    if (!MEETING_ID_RE.test(meetingId ?? '')) {
      return res.status(400).json({
        success: false,
        error: 'meetingId required.',
        code: 'INVALID_INPUT',
      });
    }
    const safePatch = pickFields(patch, MEETING_WRITABLE_FIELDS);

    // Server-side validation — every required string non-empty,
    // status (if sent) restricted to safe transitions, attendees +
    // agenda are arrays.
    if (typeof safePatch.title === 'string') {
      safePatch.title = safePatch.title.trim();
      if (!safePatch.title) {
        return res.status(400).json({
          success: false,
          error: 'Title is required.',
          code: 'INVALID_INPUT',
        });
      }
    }
    if (
      patch?.status !== undefined &&
      !PATCH_ALLOWED_STATUSES.includes(patch.status as MeetingStatus)
    ) {
      return res.status(400).json({
        success: false,
        error:
          'Status changes other than Scheduled go through dedicated endpoints.',
        code: 'INVALID_STATE',
      });
    }
    if (safePatch.attendees && !Array.isArray(safePatch.attendees)) {
      return res.status(400).json({
        success: false,
        error: 'attendees must be an array.',
        code: 'INVALID_INPUT',
      });
    }
    if (safePatch.agenda && !Array.isArray(safePatch.agenda)) {
      return res.status(400).json({
        success: false,
        error: 'agenda must be an array.',
        code: 'INVALID_INPUT',
      });
    }

    const ref = ctx.db
      .collection('meetings')
      .doc(meetingDocId(ctx, meetingId));
    const snap = await ref.get();
    const exists = snap.exists;
    if (exists) {
      const data = snap.data() ?? {};
      if (data.clientId !== ctx.primaryUid) {
        return res.status(403).json({
          success: false,
          error: 'Meeting belongs to another workspace.',
          code: 'FORBIDDEN',
        });
      }
      if (!isOwnerOrAdmin(ctx, data.ownerUid)) {
        return res.status(403).json({
          success: false,
          error:
            'Only the meeting owner or a Client Admin can edit this meeting.',
          code: 'FORBIDDEN',
        });
      }
      // Held + Cancelled meetings are immutable on this endpoint —
      // change reasons (e.g. minutes correction) go through the
      // dedicated minutes endpoint in 8b. Audit-safe.
      if (data.status && data.status !== 'Scheduled') {
        return res.status(400).json({
          success: false,
          error:
            'This meeting is no longer Scheduled. Held / Cancelled meetings cannot be edited.',
          code: 'INVALID_STATE',
        });
      }
    }

    const ts = nowIso();
    const payload: Record<string, any> = {
      ...safePatch,
      id: meetingId,
      clientId: ctx.primaryUid,
      updatedAt: ts,
      updatedBy: ctx.uid,
    };
    if (!exists) {
      payload.createdAt = ts;
      payload.createdBy = ctx.uid;
      payload.ownerUid = ctx.uid;
      payload.status = 'Scheduled';
      payload.softDeleted = false;
      payload.deletionReason = null;
      payload.deletedAt = null;
      payload.deletedBy = null;
      payload.heldAt = null;
      payload.heldBy = null;
      payload.cancelledAt = null;
      payload.cancelledBy = null;
      payload.cancellationReason = null;
      // Default arrays so the doc shape is consistent across creates.
      if (!payload.attendees) payload.attendees = [];
      if (!payload.agenda) payload.agenda = [];
    }
    await ref.set(payload, { merge: true });
    const latest = (await ref.get()).data();
    captureMeetingHistory(ctx, {
      meetingId,
      prevState: exists ? (snap.data() ?? null) : null,
      newState: latest ?? null,
      changeKind: exists ? 'update' : 'create',
    });
    return res
      .status(200)
      .json({ success: true, item: { _id: ref.id, ...latest } });
  } catch (e: any) {
    console.error('[governanceUpsertMeeting] failed:', e);
    return res.status(500).json({
      success: false,
      error: e?.message ?? 'Save failed.',
      code: 'SAVE_FAILED',
    });
  }
}

async function governanceSoftDeleteMeeting(
  req: any,
  res: any,
  ctx: ApiContext,
) {
  try {
    const { meetingId, reason, restore } = req.body ?? {};
    if (!MEETING_ID_RE.test(meetingId ?? '')) {
      return res.status(400).json({
        success: false,
        error: 'meetingId required.',
        code: 'INVALID_INPUT',
      });
    }
    const wantRestore = restore === true;
    const trimmedReason = typeof reason === 'string' ? reason.trim() : '';
    if (!wantRestore && trimmedReason.length < 5) {
      return res.status(400).json({
        success: false,
        error: 'A deletion reason of at least 5 characters is required.',
        code: 'INVALID_INPUT',
      });
    }

    const ref = ctx.db
      .collection('meetings')
      .doc(meetingDocId(ctx, meetingId));
    const snap = await ref.get();
    if (!snap.exists) {
      return res
        .status(404)
        .json({ success: false, error: 'Meeting not found.', code: 'NOT_FOUND' });
    }
    const data = snap.data() ?? {};
    if (data.clientId !== ctx.primaryUid) {
      return res.status(403).json({
        success: false,
        error: 'Meeting belongs to another workspace.',
        code: 'FORBIDDEN',
      });
    }
    if (!isOwnerOrAdmin(ctx, data.ownerUid)) {
      return res.status(403).json({
        success: false,
        error:
          'Only the meeting owner or a Client Admin can delete this meeting.',
        code: 'FORBIDDEN',
      });
    }
    // CLOSED PHASE 7 GAP — server-side status guard. Soft-deleting a
    // Held meeting would orphan its minutes + decisions + action
    // items. The proper exit is to keep the record + add a
    // correction in 8b's minutes endpoint.
    if (!wantRestore && data.status === 'Held') {
      return res.status(400).json({
        success: false,
        error:
          'Held meetings cannot be soft-deleted — their minutes are part of the audit record.',
        code: 'INVALID_STATE',
      });
    }

    const ts = nowIso();
    const update: Record<string, any> = wantRestore
      ? {
          softDeleted: false,
          deletionReason: null,
          deletedAt: null,
          deletedBy: null,
          updatedAt: ts,
          updatedBy: ctx.uid,
        }
      : {
          softDeleted: true,
          deletionReason: trimmedReason,
          deletedAt: ts,
          deletedBy: ctx.uid,
          updatedAt: ts,
          updatedBy: ctx.uid,
        };
    await ref.set(update, { merge: true });
    const latest = (await ref.get()).data();
    captureMeetingHistory(ctx, {
      meetingId,
      prevState: data,
      newState: latest ?? null,
      changeKind: wantRestore ? 'restore' : 'softDelete',
    });
    return res
      .status(200)
      .json({ success: true, item: { _id: ref.id, ...latest } });
  } catch (e: any) {
    console.error('[governanceSoftDeleteMeeting] failed:', e);
    return res.status(500).json({
      success: false,
      error: e?.message ?? 'Delete failed.',
      code: 'DELETE_FAILED',
    });
  }
}

async function governanceMarkMeetingHeld(
  req: any,
  res: any,
  ctx: ApiContext,
) {
  try {
    const { meetingId } = req.body ?? {};
    if (!MEETING_ID_RE.test(meetingId ?? '')) {
      return res.status(400).json({
        success: false,
        error: 'meetingId required.',
        code: 'INVALID_INPUT',
      });
    }
    const ref = ctx.db
      .collection('meetings')
      .doc(meetingDocId(ctx, meetingId));
    const snap = await ref.get();
    if (!snap.exists) {
      return res
        .status(404)
        .json({ success: false, error: 'Meeting not found.', code: 'NOT_FOUND' });
    }
    const data = snap.data() ?? {};
    if (data.clientId !== ctx.primaryUid) {
      return res.status(403).json({
        success: false,
        error: 'Meeting belongs to another workspace.',
        code: 'FORBIDDEN',
      });
    }
    if (!isOwnerOrAdmin(ctx, data.ownerUid)) {
      return res.status(403).json({
        success: false,
        error: 'Only the meeting owner or a Client Admin can mark this meeting as held.',
        code: 'FORBIDDEN',
      });
    }
    if (data.status !== 'Scheduled') {
      return res.status(400).json({
        success: false,
        error: 'Only Scheduled meetings can be marked as held.',
        code: 'INVALID_STATE',
      });
    }
    const ts = nowIso();
    await ref.set(
      {
        status: 'Held',
        heldAt: ts,
        heldBy: ctx.uid,
        updatedAt: ts,
        updatedBy: ctx.uid,
      },
      { merge: true },
    );
    const latest = (await ref.get()).data();
    captureMeetingHistory(ctx, {
      meetingId,
      prevState: data,
      newState: latest ?? null,
      changeKind: 'update',
    });
    return res
      .status(200)
      .json({ success: true, item: { _id: ref.id, ...latest } });
  } catch (e: any) {
    console.error('[governanceMarkMeetingHeld] failed:', e);
    return res.status(500).json({
      success: false,
      error: e?.message ?? 'Action failed.',
      code: 'ACTION_FAILED',
    });
  }
}

async function governanceCancelMeeting(
  req: any,
  res: any,
  ctx: ApiContext,
) {
  try {
    const { meetingId, reason } = req.body ?? {};
    if (!MEETING_ID_RE.test(meetingId ?? '')) {
      return res.status(400).json({
        success: false,
        error: 'meetingId required.',
        code: 'INVALID_INPUT',
      });
    }
    const trimmedReason = typeof reason === 'string' ? reason.trim() : '';
    if (trimmedReason.length < 5) {
      return res.status(400).json({
        success: false,
        error: 'A cancellation reason of at least 5 characters is required.',
        code: 'INVALID_INPUT',
      });
    }
    const ref = ctx.db
      .collection('meetings')
      .doc(meetingDocId(ctx, meetingId));
    const snap = await ref.get();
    if (!snap.exists) {
      return res
        .status(404)
        .json({ success: false, error: 'Meeting not found.', code: 'NOT_FOUND' });
    }
    const data = snap.data() ?? {};
    if (data.clientId !== ctx.primaryUid) {
      return res.status(403).json({
        success: false,
        error: 'Meeting belongs to another workspace.',
        code: 'FORBIDDEN',
      });
    }
    if (!isOwnerOrAdmin(ctx, data.ownerUid)) {
      return res.status(403).json({
        success: false,
        error:
          'Only the meeting owner or a Client Admin can cancel this meeting.',
        code: 'FORBIDDEN',
      });
    }
    if (data.status !== 'Scheduled') {
      return res.status(400).json({
        success: false,
        error: 'Only Scheduled meetings can be cancelled.',
        code: 'INVALID_STATE',
      });
    }
    const ts = nowIso();
    await ref.set(
      {
        status: 'Cancelled',
        cancelledAt: ts,
        cancelledBy: ctx.uid,
        cancellationReason: trimmedReason,
        updatedAt: ts,
        updatedBy: ctx.uid,
      },
      { merge: true },
    );

    // flag linked FP items + reports for re-routing.
    // Q5 = a (manual re-route via banner), Q16 = a (auto-decline
    // Proposed items so PgM doesn't have to clean them up by hand).
    let flaggedFpItems = 0;
    let flaggedReports = 0;
    try {
      // FP items pointing at this meeting.
      const fpSnap = await ctx.db
        .collection('forwardPlanItems')
        .where('clientId', '==', ctx.primaryUid)
        .where('meetingId', '==', meetingId)
        .get();
      const fpBatch = ctx.db.batch();
      for (const d of fpSnap.docs) {
        const fp = d.data() ?? {};
        if (fp.softDeleted) continue;
        const update: Record<string, any> = {
          needsRerouting: true,
          updatedAt: ts,
          updatedBy: ctx.uid,
        };
        // Q16 = a — Proposed items awaiting confirm flip back to Draft
        // with the cancellation as `lastDeclineReason`. PM picks new meeting.
        if (fp.status === 'Proposed') {
          update.status = 'Draft';
          update.lastDeclineReason = `Linked meeting cancelled: ${trimmedReason}`;
          update.lastDeclinedBy = ctx.uid;
          update.lastDeclinedAt = ts;
        }
        fpBatch.set(d.ref, update, { merge: true });
        flaggedFpItems += 1;
      }
      if (flaggedFpItems > 0) await fpBatch.commit();

      // Reports referencing this meeting via targetMeetingId.
      const repSnap = await ctx.db
        .collection('reports')
        .where('clientId', '==', ctx.primaryUid)
        .where('targetMeetingId', '==', meetingId)
        .get();
      const repBatch = ctx.db.batch();
      for (const d of repSnap.docs) {
        const r = d.data() ?? {};
        if (r.softDeleted) continue;
        repBatch.set(
          d.ref,
          {
            needsRerouting: true,
            updatedAt: ts,
            updatedBy: ctx.uid,
          },
          { merge: true },
        );
        flaggedReports += 1;
      }
      if (flaggedReports > 0) await repBatch.commit();
    } catch (cascadeErr) {
      // Non-fatal — meeting still gets cancelled even if the cascade
      // hits a Firestore hiccup. Log loud so it surfaces in monitoring.
      console.error('[governanceCancelMeeting] cascade flag failed', cascadeErr);
    }

    // Audit row.
    try {
      await ctx.db.collection('auditEvents').add({
        clientId: ctx.primaryUid,
        action: 'meeting.cancelled',
        actorUid: ctx.uid,
        timestamp: ts,
        meta: {
          meetingId,
          reason: trimmedReason,
          flaggedFpItems,
          flaggedReports,
        },
      });
    } catch (auditErr) {
      console.error('[governanceCancelMeeting] audit failed', auditErr);
    }

    const latest = (await ref.get()).data();
    captureMeetingHistory(ctx, {
      meetingId,
      prevState: data,
      newState: latest ?? null,
      changeKind: 'update',
    });
    return res.status(200).json({
      success: true,
      item: { _id: ref.id, ...latest },
      flaggedFpItems,
      flaggedReports,
    });
  } catch (e: any) {
    console.error('[governanceCancelMeeting] failed:', e);
    return res.status(500).json({
      success: false,
      error: e?.message ?? 'Cancel failed.',
      code: 'ACTION_FAILED',
    });
  }
}

async function governanceRescheduleMeeting(
  req: any,
  res: any,
  ctx: ApiContext,
) {
  try {
    const { meetingId, newDate, newTimeStart, newTimeEnd, reason } = req.body ?? {};
    if (!MEETING_ID_RE.test(meetingId ?? '')) {
      return res.status(400).json({
        success: false,
        error: 'meetingId required.',
        code: 'INVALID_INPUT',
      });
    }
    if (typeof newDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(newDate)) {
      return res.status(400).json({
        success: false,
        error: 'newDate must be ISO yyyy-mm-dd.',
        code: 'INVALID_INPUT',
      });
    }
    const trimmedReason = typeof reason === 'string' ? reason.trim() : '';
    if (trimmedReason.length < 5) {
      return res.status(400).json({
        success: false,
        error: 'A reschedule reason of at least 5 characters is required.',
        code: 'INVALID_INPUT',
      });
    }
    const ref = ctx.db.collection('meetings').doc(meetingDocId(ctx, meetingId));
    const snap = await ref.get();
    if (!snap.exists) {
      return res
        .status(404)
        .json({ success: false, error: 'Meeting not found.', code: 'NOT_FOUND' });
    }
    const data = snap.data() ?? {};
    if (data.clientId !== ctx.primaryUid) {
      return res.status(403).json({
        success: false,
        error: 'Meeting belongs to another workspace.',
        code: 'FORBIDDEN',
      });
    }
    if (!isOwnerOrAdmin(ctx, data.ownerUid)) {
      return res.status(403).json({
        success: false,
        error:
          'Only the meeting owner or a Client Admin can reschedule this meeting.',
        code: 'FORBIDDEN',
      });
    }
    if (data.status !== 'Scheduled') {
      return res.status(400).json({
        success: false,
        error: 'Only Scheduled meetings can be rescheduled.',
        code: 'INVALID_STATE',
      });
    }
    const ts = nowIso();
    const oldDate = data.date as string | undefined;
    const oldTimeStart = data.timeStart as string | undefined;
    const oldTimeEnd = data.timeEnd as string | undefined;

    const update: Record<string, any> = {
      date: newDate,
      updatedAt: ts,
      updatedBy: ctx.uid,
      // Append to a `rescheduleHistory` so the trail survives multiple
      // moves. Audit-clean — every move is recorded with reason.
      rescheduleHistory: [
        ...(Array.isArray(data.rescheduleHistory) ? data.rescheduleHistory : []),
        {
          at: ts,
          by: ctx.uid,
          reason: trimmedReason,
          fromDate: oldDate ?? null,
          fromTimeStart: oldTimeStart ?? null,
          fromTimeEnd: oldTimeEnd ?? null,
          toDate: newDate,
          toTimeStart: newTimeStart ?? oldTimeStart ?? null,
          toTimeEnd: newTimeEnd ?? oldTimeEnd ?? null,
        },
      ],
    };
    if (typeof newTimeStart === 'string' && /^\d{2}:\d{2}$/.test(newTimeStart)) {
      update.timeStart = newTimeStart;
    }
    if (typeof newTimeEnd === 'string' && /^\d{2}:\d{2}$/.test(newTimeEnd)) {
      update.timeEnd = newTimeEnd;
    }
    await ref.set(update, { merge: true });

    // Sync linked FP items' targetDecisionDate so the rendered list
    // stays accurate. Linked items keep their `meetingId` — they just
    // get the new date mirrored.
    try {
      const fpSnap = await ctx.db
        .collection('forwardPlanItems')
        .where('clientId', '==', ctx.primaryUid)
        .where('meetingId', '==', meetingId)
        .get();
      if (!fpSnap.empty) {
        const fpBatch = ctx.db.batch();
        for (const d of fpSnap.docs) {
          fpBatch.set(
            d.ref,
            {
              targetDecisionDate: newDate,
              updatedAt: ts,
              updatedBy: ctx.uid,
            },
            { merge: true },
          );
        }
        await fpBatch.commit();
      }
    } catch (cascadeErr) {
      console.error('[governanceRescheduleMeeting] cascade failed', cascadeErr);
    }

    try {
      await ctx.db.collection('auditEvents').add({
        clientId: ctx.primaryUid,
        action: 'meeting.rescheduled',
        actorUid: ctx.uid,
        timestamp: ts,
        meta: {
          meetingId,
          fromDate: oldDate ?? null,
          toDate: newDate,
          reason: trimmedReason,
        },
      });
    } catch (auditErr) {
      console.error('[governanceRescheduleMeeting] audit failed', auditErr);
    }

    const latest = (await ref.get()).data();
    captureMeetingHistory(ctx, {
      meetingId,
      prevState: data,
      newState: latest ?? null,
      changeKind: 'update',
    });
    return res
      .status(200)
      .json({ success: true, item: { _id: ref.id, ...latest } });
  } catch (e: any) {
    console.error('[governanceRescheduleMeeting] failed:', e);
    return res.status(500).json({
      success: false,
      error: e?.message ?? 'Reschedule failed.',
      code: 'ACTION_FAILED',
    });
  }
}

// ── minutes / decisions / action items / links ───────────────

function makeChildId(prefix: string): string {
  // Same id-generator pattern used elsewhere — short slug + base36
  // millisecond suffix. Idempotency handled by the caller (push to
  // array; never two clicks within the same ms).
  return `${prefix}-${Date.now().toString(36)}-${Math.floor(
    Math.random() * 1_000,
  ).toString(36)}`;
}

async function loadEditableMeeting(
  ctx: ApiContext,
  meetingId: string,
  res: any,
  allowedStatuses: MeetingStatus[],
): Promise<{ ref: FirebaseFirestore.DocumentReference; data: any } | null> {
  if (!MEETING_ID_RE.test(meetingId ?? '')) {
    res.status(400).json({
      success: false,
      error: 'meetingId required.',
      code: 'INVALID_INPUT',
    });
    return null;
  }
  const ref = ctx.db.collection('meetings').doc(meetingDocId(ctx, meetingId));
  const snap = await ref.get();
  if (!snap.exists) {
    res
      .status(404)
      .json({ success: false, error: 'Meeting not found.', code: 'NOT_FOUND' });
    return null;
  }
  const data = snap.data() ?? {};
  if (data.clientId !== ctx.primaryUid) {
    res.status(403).json({
      success: false,
      error: 'Meeting belongs to another workspace.',
      code: 'FORBIDDEN',
    });
    return null;
  }
  if (!isOwnerOrAdmin(ctx, data.ownerUid)) {
    res.status(403).json({
      success: false,
      error: 'Only the meeting owner or a Client Admin can change this meeting.',
      code: 'FORBIDDEN',
    });
    return null;
  }
  if (!allowedStatuses.includes(data.status as MeetingStatus)) {
    res.status(400).json({
      success: false,
      error: `This action requires the meeting to be in one of: ${allowedStatuses.join(', ')}.`,
      code: 'INVALID_STATE',
    });
    return null;
  }
  return { ref, data };
}

// Tiptap minutes JSON. Editable on both Scheduled (pre-meeting draft)
// and Held (capturing what happened). Cancelled meetings are read-only
// change of mind becomes a fresh meeting on a new date.
async function governanceSaveMeetingMinutes(
  req: any,
  res: any,
  ctx: ApiContext,
) {
  try {
    const { meetingId, content, wordCount } = req.body ?? {};
    const loaded = await loadEditableMeeting(ctx, meetingId, res, [
      'Scheduled',
      'Held',
    ]);
    if (!loaded) return;
    const ts = nowIso();
    await loaded.ref.set(
      {
        minutes: {
          content: content ?? null,
          wordCount: typeof wordCount === 'number' ? wordCount : 0,
          lastEditedAt: ts,
          lastEditedBy: ctx.uid,
        },
        updatedAt: ts,
        updatedBy: ctx.uid,
      },
      { merge: true },
    );
    const latest = (await loaded.ref.get()).data();
    captureMeetingHistory(ctx, {
      meetingId,
      prevState: loaded.data ?? null,
      newState: latest ?? null,
      changeKind: 'update',
    });
    return res
      .status(200)
      .json({ success: true, item: { _id: loaded.ref.id, ...latest } });
  } catch (e: any) {
    console.error('[governanceSaveMeetingMinutes] failed:', e);
    return res.status(500).json({
      success: false,
      error: e?.message ?? 'Save failed.',
      code: 'SAVE_FAILED',
    });
  }
}

async function governanceAddMeetingDecision(
  req: any,
  res: any,
  ctx: ApiContext,
) {
  try {
    const { meetingId, text } = req.body ?? {};
    const trimmed = typeof text === 'string' ? text.trim() : '';
    if (trimmed.length < 3) {
      return res.status(400).json({
        success: false,
        error: 'Decision text required (min 3 chars).',
        code: 'INVALID_INPUT',
      });
    }
    const loaded = await loadEditableMeeting(ctx, meetingId, res, ['Held']);
    if (!loaded) return;
    const ts = nowIso();
    const decision = {
      id: makeChildId('dec'),
      text: trimmed,
      takenAt: ts,
      takenBy: ctx.uid,
    };
    const decisions = Array.isArray(loaded.data.decisions)
      ? [...loaded.data.decisions, decision]
      : [decision];
    await loaded.ref.set(
      {
        decisions,
        updatedAt: ts,
        updatedBy: ctx.uid,
      },
      { merge: true },
    );
    const latest = (await loaded.ref.get()).data();
    captureMeetingHistory(ctx, {
      meetingId,
      prevState: loaded.data ?? null,
      newState: latest ?? null,
      changeKind: 'update',
    });
    return res
      .status(200)
      .json({ success: true, item: { _id: loaded.ref.id, ...latest } });
  } catch (e: any) {
    console.error('[governanceAddMeetingDecision] failed:', e);
    return res.status(500).json({
      success: false,
      error: e?.message ?? 'Action failed.',
      code: 'SAVE_FAILED',
    });
  }
}

async function governanceDeleteMeetingDecision(
  req: any,
  res: any,
  ctx: ApiContext,
) {
  try {
    const { meetingId, decisionId } = req.body ?? {};
    if (typeof decisionId !== 'string' || !decisionId) {
      return res.status(400).json({
        success: false,
        error: 'decisionId required.',
        code: 'INVALID_INPUT',
      });
    }
    const loaded = await loadEditableMeeting(ctx, meetingId, res, ['Held']);
    if (!loaded) return;
    const decisions = (loaded.data.decisions ?? []).filter(
      (d: any) => d.id !== decisionId,
    );
    const ts = nowIso();
    await loaded.ref.set(
      {
        decisions,
        updatedAt: ts,
        updatedBy: ctx.uid,
      },
      { merge: true },
    );
    const latest = (await loaded.ref.get()).data();
    captureMeetingHistory(ctx, {
      meetingId,
      prevState: loaded.data ?? null,
      newState: latest ?? null,
      changeKind: 'update',
    });
    return res
      .status(200)
      .json({ success: true, item: { _id: loaded.ref.id, ...latest } });
  } catch (e: any) {
    console.error('[governanceDeleteMeetingDecision] failed:', e);
    return res.status(500).json({
      success: false,
      error: e?.message ?? 'Action failed.',
      code: 'SAVE_FAILED',
    });
  }
}

async function governanceAddMeetingActionItem(
  req: any,
  res: any,
  ctx: ApiContext,
) {
  try {
    const { meetingId, text, ownerLabel, dueDate } = req.body ?? {};
    const trimmedText = typeof text === 'string' ? text.trim() : '';
    if (trimmedText.length < 3) {
      return res.status(400).json({
        success: false,
        error: 'Action text required (min 3 chars).',
        code: 'INVALID_INPUT',
      });
    }
    const trimmedOwner =
      typeof ownerLabel === 'string' ? ownerLabel.trim() : '';
    const trimmedDue = typeof dueDate === 'string' ? dueDate.trim() : '';
    const loaded = await loadEditableMeeting(ctx, meetingId, res, ['Held']);
    if (!loaded) return;
    const ts = nowIso();
    const actionItem = {
      id: makeChildId('act'),
      text: trimmedText,
      ownerLabel: trimmedOwner,
      ownerUid: null,
      dueDate: trimmedDue || null,
      status: 'open' as const,
      createdAt: ts,
      createdBy: ctx.uid,
      resolvedAt: null,
      resolvedBy: null,
    };
    const actionItems = Array.isArray(loaded.data.actionItems)
      ? [...loaded.data.actionItems, actionItem]
      : [actionItem];
    await loaded.ref.set(
      {
        actionItems,
        updatedAt: ts,
        updatedBy: ctx.uid,
      },
      { merge: true },
    );
    const latest = (await loaded.ref.get()).data();
    captureMeetingHistory(ctx, {
      meetingId,
      prevState: loaded.data ?? null,
      newState: latest ?? null,
      changeKind: 'update',
    });
    return res
      .status(200)
      .json({ success: true, item: { _id: loaded.ref.id, ...latest } });
  } catch (e: any) {
    console.error('[governanceAddMeetingActionItem] failed:', e);
    return res.status(500).json({
      success: false,
      error: e?.message ?? 'Action failed.',
      code: 'SAVE_FAILED',
    });
  }
}

// Toggle action item open ↔ resolved. Reuses the same endpoint per
//  (one endpoint, status transitions inside).
async function governanceToggleMeetingActionItem(
  req: any,
  res: any,
  ctx: ApiContext,
) {
  try {
    const { meetingId, actionItemId } = req.body ?? {};
    if (typeof actionItemId !== 'string' || !actionItemId) {
      return res.status(400).json({
        success: false,
        error: 'actionItemId required.',
        code: 'INVALID_INPUT',
      });
    }
    const loaded = await loadEditableMeeting(ctx, meetingId, res, ['Held']);
    if (!loaded) return;
    const ts = nowIso();
    const items = (loaded.data.actionItems ?? []).map((a: any) => {
      if (a.id !== actionItemId) return a;
      const flipping = a.status === 'open';
      return {
        ...a,
        status: flipping ? 'done' : 'open',
        resolvedAt: flipping ? ts : null,
        resolvedBy: flipping ? ctx.uid : null,
      };
    });
    await loaded.ref.set(
      {
        actionItems: items,
        updatedAt: ts,
        updatedBy: ctx.uid,
      },
      { merge: true },
    );
    const latest = (await loaded.ref.get()).data();
    captureMeetingHistory(ctx, {
      meetingId,
      prevState: loaded.data ?? null,
      newState: latest ?? null,
      changeKind: 'update',
    });
    return res
      .status(200)
      .json({ success: true, item: { _id: loaded.ref.id, ...latest } });
  } catch (e: any) {
    console.error('[governanceToggleMeetingActionItem] failed:', e);
    return res.status(500).json({
      success: false,
      error: e?.message ?? 'Action failed.',
      code: 'SAVE_FAILED',
    });
  }
}

async function governanceDeleteMeetingActionItem(
  req: any,
  res: any,
  ctx: ApiContext,
) {
  try {
    const { meetingId, actionItemId } = req.body ?? {};
    if (typeof actionItemId !== 'string' || !actionItemId) {
      return res.status(400).json({
        success: false,
        error: 'actionItemId required.',
        code: 'INVALID_INPUT',
      });
    }
    const loaded = await loadEditableMeeting(ctx, meetingId, res, ['Held']);
    if (!loaded) return;
    const ts = nowIso();
    const items = (loaded.data.actionItems ?? []).filter(
      (a: any) => a.id !== actionItemId,
    );
    await loaded.ref.set(
      {
        actionItems: items,
        updatedAt: ts,
        updatedBy: ctx.uid,
      },
      { merge: true },
    );
    const latest = (await loaded.ref.get()).data();
    captureMeetingHistory(ctx, {
      meetingId,
      prevState: loaded.data ?? null,
      newState: latest ?? null,
      changeKind: 'update',
    });
    return res
      .status(200)
      .json({ success: true, item: { _id: loaded.ref.id, ...latest } });
  } catch (e: any) {
    console.error('[governanceDeleteMeetingActionItem] failed:', e);
    return res.status(500).json({
      success: false,
      error: e?.message ?? 'Action failed.',
      code: 'SAVE_FAILED',
    });
  }
}

// Linked reports + projects. Allowed on Scheduled + Held (a meeting
// can have its agenda papers linked pre-meeting; minutes can refer to
// post-meeting linkage too). Cancelled = read-only.
async function governanceUpdateMeetingLinks(
  req: any,
  res: any,
  ctx: ApiContext,
) {
  try {
    const { meetingId, linkedReportIds, linkedProjectIds } = req.body ?? {};
    if (linkedReportIds !== undefined && !Array.isArray(linkedReportIds)) {
      return res.status(400).json({
        success: false,
        error: 'linkedReportIds must be an array.',
        code: 'INVALID_INPUT',
      });
    }
    if (linkedProjectIds !== undefined && !Array.isArray(linkedProjectIds)) {
      return res.status(400).json({
        success: false,
        error: 'linkedProjectIds must be an array.',
        code: 'INVALID_INPUT',
      });
    }
    const loaded = await loadEditableMeeting(ctx, meetingId, res, [
      'Scheduled',
      'Held',
    ]);
    if (!loaded) return;
    const ts = nowIso();
    const update: Record<string, any> = {
      updatedAt: ts,
      updatedBy: ctx.uid,
    };
    if (linkedReportIds !== undefined) {
      update.linkedReportIds = linkedReportIds.filter(
        (s: any) => typeof s === 'string',
      );
    }
    if (linkedProjectIds !== undefined) {
      update.linkedProjectIds = linkedProjectIds.filter(
        (s: any) => typeof s === 'string',
      );
    }
    await loaded.ref.set(update, { merge: true });
    const latest = (await loaded.ref.get()).data();
    captureMeetingHistory(ctx, {
      meetingId,
      prevState: loaded.data ?? null,
      newState: latest ?? null,
      changeKind: 'update',
    });
    return res
      .status(200)
      .json({ success: true, item: { _id: loaded.ref.id, ...latest } });
  } catch (e: any) {
    console.error('[governanceUpdateMeetingLinks] failed:', e);
    return res.status(500).json({
      success: false,
      error: e?.message ?? 'Save failed.',
      code: 'SAVE_FAILED',
    });
  }
}

// Workspace member picker.
// Returns every user in the caller's workspace (clientId scope) +
// optionally pending invitees, with a stable shape for any picker UI
// (attendees, action item owners, etc.). Cross-tenant safety: only
// returns users where users.clientId === ctx.primaryUid; the workspace
// owner doc is added explicitly because their `clientId` may point at
// themselves and not be in the where-query result.
async function governanceListWorkspaceMembers(
  _req: any,
  res: any,
  ctx: ApiContext,
) {
  try {
    const snap = await ctx.db
      .collection('users')
      .where('clientId', '==', ctx.primaryUid)
      .get();
    const seen = new Set<string>();
    const members: Array<{
      uid: string;
      name: string;
      email: string;
      role: string;
      pmLevel: string | null;
    }> = [];
    for (const d of snap.docs) {
      const data = d.data() ?? {};
      seen.add(d.id);
      members.push({
        uid: d.id,
        name: (data.name ?? '') as string,
        email: (data.email ?? '') as string,
        role: (data.role ?? 'unknown') as string,
        pmLevel: (data.pmLevel ?? null) as string | null,
      });
    }
    // Workspace owner — their user doc may live at users/{primaryUid}
    // without the `clientId` field pointing to themselves. Pull
    // explicitly + add if absent (same pattern as governanceListReviewers).
    if (!seen.has(ctx.primaryUid)) {
      try {
        const ownerSnap = await ctx.db
          .collection('users')
          .doc(ctx.primaryUid)
          .get();
        if (ownerSnap.exists) {
          const data = ownerSnap.data() ?? {};
          members.unshift({
            uid: ctx.primaryUid,
            name: (data.name ?? '') as string,
            email: (data.email ?? '') as string,
            role: (data.role ?? 'client_admin') as string,
            pmLevel: (data.pmLevel ?? null) as string | null,
          });
        }
      } catch (ownerErr) {
        console.error('[workspaceMembers] owner fallback failed:', ownerErr);
      }
    }
    members.sort((a, b) =>
      (a.name || a.email).localeCompare(b.name || b.email),
    );
    return res.status(200).json({ success: true, members });
  } catch (e: any) {
    console.error('[governanceListWorkspaceMembers] failed:', e);
    return res.status(500).json({
      success: false,
      error: e?.message ?? 'Failed to load workspace members.',
      code: 'LOAD_FAILED',
    });
  }
}

// ── Schedule view + bulk creation ──────────────────────────

// PgM-only gate — bulk-create + import + export are workspace-level
// operations. Server enforces, UI mirrors.
function requireClientAdmin(ctx: ApiContext, res: any): boolean {
  if (!ctx.isClientAdmin) {
    res.status(403).json({
      success: false,
      error: 'Only a Client Admin can perform schedule operations.',
      code: 'FORBIDDEN',
    });
    return false;
  }
  return true;
}

async function loadFrameworkBodies(ctx: ApiContext): Promise<FrameworkBodyLite[]> {
  const snap = await ctx.db
    .collection('governanceBodies')
    .where('clientId', '==', ctx.primaryUid)
    .get();
  return snap.docs.map((d) => {
    const data = d.data() ?? {};
    return {
      _id: d.id,
      id: data.id ?? d.id,
      name: data.name ?? '',
    };
  });
}

interface BulkCreateInput {
  governanceBodyId: string;
  pattern: 'weekly' | 'monthly' | 'quarterly';
  dayOfMonth?: number;     // 1-31, used for monthly + quarterly
  weekDay?: number;        // 0-6, Mon=1.Sun=0, used for weekly
  startDate: string;       // ISO yyyy-mm-dd
  numOccurrences: number;  // 1-60
  timeStart: string;       // HH:mm
  timeEnd: string;         // HH:mm
  location: string;
  chairLabel: string;
  shiftBankHolidays?: boolean; // Q11 = a (default true)
}

function generateRecurringDates(input: BulkCreateInput): Array<{
  date: string;
  shiftedFrom?: string;
}> {
  const out: Array<{ date: string; shiftedFrom?: string }> = [];
  const start = new Date(`${input.startDate}T00:00:00Z`);
  if (Number.isNaN(start.getTime())) return out;

  for (let i = 0; i < input.numOccurrences; i += 1) {
    const cursor = new Date(start);
    if (input.pattern === 'weekly') {
      cursor.setUTCDate(cursor.getUTCDate() + i * 7);
    } else if (input.pattern === 'monthly') {
      cursor.setUTCMonth(cursor.getUTCMonth() + i);
      if (input.dayOfMonth) {
        cursor.setUTCDate(input.dayOfMonth);
      }
    } else {
      // quarterly
      cursor.setUTCMonth(cursor.getUTCMonth() + i * 3);
      if (input.dayOfMonth) {
        cursor.setUTCDate(input.dayOfMonth);
      }
    }
    const iso = cursor.toISOString().slice(0, 10);
    if (input.shiftBankHolidays !== false && !isWorkingDay(iso)) {
      out.push({ date: nextWorkingDay(iso), shiftedFrom: iso });
    } else {
      out.push({ date: iso });
    }
  }
  return out;
}

async function governanceBulkCreateRecurringMeetings(
  req: any,
  res: any,
  ctx: ApiContext,
) {
  try {
    if (!requireClientAdmin(ctx, res)) return;
    const input = req.body as BulkCreateInput;
    if (!input || typeof input !== 'object') {
      return res.status(400).json({
        success: false,
        error: 'Invalid input.',
        code: 'INVALID_INPUT',
      });
    }
    if (!input.governanceBodyId || typeof input.governanceBodyId !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'governanceBodyId is required.',
        code: 'INVALID_INPUT',
      });
    }
    if (!['weekly', 'monthly', 'quarterly'].includes(input.pattern)) {
      return res.status(400).json({
        success: false,
        error: 'pattern must be weekly, monthly, or quarterly.',
        code: 'INVALID_INPUT',
      });
    }
    if (
      typeof input.numOccurrences !== 'number' ||
      input.numOccurrences < 1 ||
      input.numOccurrences > 60
    ) {
      return res.status(400).json({
        success: false,
        error: 'numOccurrences must be between 1 and 60.',
        code: 'INVALID_INPUT',
      });
    }
    if (!input.startDate || !/^\d{4}-\d{2}-\d{2}$/.test(input.startDate)) {
      return res.status(400).json({
        success: false,
        error: 'startDate must be ISO yyyy-mm-dd.',
        code: 'INVALID_INPUT',
      });
    }

    // Resolve body label.
    const bodies = await loadFrameworkBodies(ctx);
    const body = bodies.find(
      (b) => b.id === input.governanceBodyId || b._id === input.governanceBodyId,
    );
    if (!body) {
      return res.status(400).json({
        success: false,
        error: 'Governance body not found in this workspace.',
        code: 'NOT_FOUND',
      });
    }

    const dates = generateRecurringDates(input);
    if (dates.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Could not generate any dates from the input.',
        code: 'INVALID_INPUT',
      });
    }

    const ts = nowIso();
    const batch = ctx.db.batch();
    const created: any[] = [];

    for (const d of dates) {
      const idSlug = `${(body.name ?? 'meeting')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 30)}-${d.date}`;
      const meetingId = `${idSlug}-${Math.floor(
        Math.random() * 36 ** 4,
      ).toString(36)}`;
      const ref = ctx.db
        .collection('meetings')
        .doc(meetingDocId(ctx, meetingId));
      const payload = {
        id: meetingId,
        clientId: ctx.primaryUid,
        title: `${body.name ?? 'Meeting'} · ${d.date}`,
        governanceBodyId: body.id ?? body._id,
        governanceBodyLabel: body.name ?? '',
        date: d.date,
        timeStart: input.timeStart || '10:00',
        timeEnd: input.timeEnd || '12:00',
        location: input.location ?? '',
        chairUid: null,
        chairLabel: input.chairLabel ?? '',
        status: 'Scheduled' as MeetingStatus,
        attendees: [],
        agenda: [],
        ownerUid: ctx.uid,
        softDeleted: false,
        deletionReason: null,
        deletedAt: null,
        deletedBy: null,
        heldAt: null,
        heldBy: null,
        cancelledAt: null,
        cancelledBy: null,
        cancellationReason: null,
        bulkCreated: true,
        shiftedFrom: d.shiftedFrom ?? null,
        createdAt: ts,
        createdBy: ctx.uid,
        updatedAt: ts,
        updatedBy: ctx.uid,
      };
      batch.set(ref, payload);
      created.push({ ...payload, _id: ref.id, _historyMeetingId: meetingId });
    }
    await batch.commit();
    //  fire one history row per created meeting after the batch
    // commits. Best-effort, doesn't await each call to keep response time
    // tight; appendHistoryRow swallows errors internally.
    for (const m of created) {
      captureMeetingHistory(ctx, {
        meetingId: m._historyMeetingId,
        prevState: null,
        newState: m,
        changeKind: 'create',
      });
    }
    return res.status(200).json({ success: true, created: created.length, meetings: created });
  } catch (e: any) {
    console.error('[governanceBulkCreateRecurringMeetings] failed:', e);
    return res.status(500).json({
      success: false,
      error: e?.message ?? 'Bulk create failed.',
      code: 'CREATE_FAILED',
    });
  }
}

// ── Excel import (dry-run + commit) ─────────────────────────────────────

const IMPORT_MAX_BYTES = 5 * 1024 * 1024; // 5 MB

function decodeBase64Buffer(b64: string): Buffer | null {
  try {
    const stripped = b64.replace(/^data:[^,]+,/, '');
    const buf = Buffer.from(stripped, 'base64');
    if (buf.length > IMPORT_MAX_BYTES) return null;
    return buf;
  } catch {
    return null;
  }
}

async function governanceImportMeetingsDryRun(
  req: any,
  res: any,
  ctx: ApiContext,
) {
  try {
    if (!requireClientAdmin(ctx, res)) return;
    const { fileBase64 } = req.body ?? {};
    if (typeof fileBase64 !== 'string' || !fileBase64) {
      return res.status(400).json({
        success: false,
        error: 'fileBase64 required.',
        code: 'INVALID_INPUT',
      });
    }
    const buf = decodeBase64Buffer(fileBase64);
    if (!buf) {
      return res.status(400).json({
        success: false,
        error: 'File too large or invalid base64 (max 5 MB).',
        code: 'FILE_TOO_LARGE',
      });
    }
    const bodies = await loadFrameworkBodies(ctx);
    if (bodies.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Set up the Governance Framework before importing — body column resolution requires bodies to exist.',
        code: 'FRAMEWORK_EMPTY',
      });
    }
    const { rows, summary } = parseMeetingsXlsx(buf, bodies);
    return res.status(200).json({ success: true, rows, summary });
  } catch (e: any) {
    console.error('[governanceImportMeetingsDryRun] failed:', e);
    return res.status(500).json({
      success: false,
      error: e?.message ?? 'Parse failed.',
      code: 'PARSE_FAILED',
    });
  }
}

async function governanceImportMeetingsCommit(
  req: any,
  res: any,
  ctx: ApiContext,
) {
  try {
    if (!requireClientAdmin(ctx, res)) return;
    const { fileBase64 } = req.body ?? {};
    if (typeof fileBase64 !== 'string' || !fileBase64) {
      return res.status(400).json({
        success: false,
        error: 'fileBase64 required.',
        code: 'INVALID_INPUT',
      });
    }
    const buf = decodeBase64Buffer(fileBase64);
    if (!buf) {
      return res.status(400).json({
        success: false,
        error: 'File too large or invalid base64 (max 5 MB).',
        code: 'FILE_TOO_LARGE',
      });
    }
    const bodies = await loadFrameworkBodies(ctx);
    if (bodies.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Set up the Governance Framework before importing.',
        code: 'FRAMEWORK_EMPTY',
      });
    }
    // Re-parse on commit — never trust client-held rows.
    const { rows, summary } = parseMeetingsXlsx(buf, bodies);
    const valid = rows.filter(
      (r) => !r.flags.some((f) => f.severity === 'error'),
    );

    const ts = nowIso();
    let batch = ctx.db.batch();
    let written = 0;
    let opsInBatch = 0;
    const allWritten: any[] = [];

    for (const row of valid) {
      const m: ParsedMeeting = row.meeting;
      // Suffix the ID until unique within the workspace (avoids collisions
      // on re-import of the same file).
      let candidateId = m.id;
      let attempts = 0;
      // eslint-disable-next-line no-await-in-loop
      while (attempts < 8) {
        const ref = ctx.db
          .collection('meetings')
          .doc(meetingDocId(ctx, candidateId));
        // eslint-disable-next-line no-await-in-loop
        const existing = await ref.get();
        if (!existing.exists) break;
        candidateId = `${m.id}-${Math.floor(Math.random() * 36 ** 3).toString(
          36,
        )}`;
        attempts += 1;
      }
      const ref = ctx.db
        .collection('meetings')
        .doc(meetingDocId(ctx, candidateId));
      const payload = {
        id: candidateId,
        clientId: ctx.primaryUid,
        title: `${m.governanceBodyLabel || 'Meeting'} · ${m.date}`,
        governanceBodyId: m.governanceBodyId,
        governanceBodyLabel: m.governanceBodyLabel,
        date: m.date,
        timeStart: m.timeStart,
        timeEnd: m.timeEnd,
        location: m.location,
        chairUid: null,
        chairLabel: m.chairLabel,
        status: 'Scheduled' as MeetingStatus,
        attendees: m.attendees,
        agenda: [],
        ownerUid: ctx.uid,
        softDeleted: false,
        deletionReason: null,
        deletedAt: null,
        deletedBy: null,
        heldAt: null,
        heldBy: null,
        cancelledAt: null,
        cancelledBy: null,
        cancellationReason: null,
        importedAt: ts,
        importedBy: ctx.uid,
        createdAt: ts,
        createdBy: ctx.uid,
        updatedAt: ts,
        updatedBy: ctx.uid,
      };
      batch.set(ref, payload);
      allWritten.push({ ...payload, _id: ref.id, _historyMeetingId: candidateId });
      written += 1;
      opsInBatch += 1;
      // Firestore batch limit is 500 ops. Flush every 400 to leave headroom.
      if (opsInBatch >= 400) {
        // eslint-disable-next-line no-await-in-loop
        await batch.commit();
        batch = ctx.db.batch();
        opsInBatch = 0;
      }
    }
    if (opsInBatch > 0) await batch.commit();

    //  fire one history row per imported meeting after the
    // batch commits. Best-effort, doesn't block on errors.
    for (const m of allWritten) {
      captureMeetingHistory(ctx, {
        meetingId: m._historyMeetingId,
        prevState: null,
        newState: m,
        changeKind: 'create',
      });
    }

    // Single audit event for the import (non-blocking — best-effort).
    try {
      await ctx.db.collection('auditEvents').add({
        clientId: ctx.primaryUid,
        action: 'meetings.imported',
        actorUid: ctx.uid,
        timestamp: ts,
        meta: {
          written,
          skipped: rows.length - written,
          totalRows: rows.length,
        },
      });
    } catch (auditErr) {
      console.error('[importMeetingsCommit] audit write failed:', auditErr);
    }

    return res.status(200).json({
      success: true,
      written,
      skipped: rows.length - written,
      totalRows: rows.length,
      summary,
    });
  } catch (e: any) {
    console.error('[governanceImportMeetingsCommit] failed:', e);
    return res.status(500).json({
      success: false,
      error: e?.message ?? 'Import failed.',
      code: 'IMPORT_FAILED',
    });
  }
}

// ── Excel export ────────────────────────────────────────────────────────

async function governanceExportMeetingsXlsx(
  _req: any,
  res: any,
  ctx: ApiContext,
) {
  try {
    if (!requireClientAdmin(ctx, res)) return;
    const snap = await ctx.db
      .collection('meetings')
      .where('clientId', '==', ctx.primaryUid)
      .get();
    const meetings = snap.docs
      .map((d) => d.data() ?? {})
      .filter((m: any) => !m.softDeleted)
      .sort((a: any, b: any) => (a.date ?? '').localeCompare(b.date ?? ''));

    const data: Record<string, any>[] = meetings.map((m: any) => ({
      Body: m.governanceBodyLabel ?? '',
      Date: m.date ?? '',
      'Time Start': m.timeStart ?? '',
      'Time End': m.timeEnd ?? '',
      Location: m.location ?? '',
      Chair: m.chairLabel ?? '',
      Status: m.status ?? '',
      Attendees: Array.isArray(m.attendees)
        ? m.attendees.map((a: any) => a.label).join('; ')
        : '',
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Meetings');
    const buf: Buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    const fileBase64 = buf.toString('base64');
    const filename = `meetings-schedule-${nowIso().slice(0, 10)}.xlsx`;
    return res.status(200).json({ success: true, fileBase64, filename });
  } catch (e: any) {
    console.error('[governanceExportMeetingsXlsx] failed:', e);
    return res.status(500).json({
      success: false,
      error: e?.message ?? 'Export failed.',
      code: 'EXPORT_FAILED',
    });
  }
}

// Suppress unused-import warning — `shiftIfNonWorking` reserved for the
// preview UI to indicate which dates would be shifted before commit.
void shiftIfNonWorking;

export const governanceMeetingsRoutes: Record<string, any> = {
  governanceListMeetings,
  governanceGetMeeting,
  governanceUpsertMeeting,
  governanceSoftDeleteMeeting,
  governanceMarkMeetingHeld,
  governanceCancelMeeting,
  governanceRescheduleMeeting,
  governanceSaveMeetingMinutes,
  governanceAddMeetingDecision,
  governanceDeleteMeetingDecision,
  governanceAddMeetingActionItem,
  governanceToggleMeetingActionItem,
  governanceDeleteMeetingActionItem,
  governanceUpdateMeetingLinks,
  governanceListWorkspaceMembers,
  // Schedule view + bulk creation
  governanceBulkCreateRecurringMeetings,
  governanceImportMeetingsDryRun,
  governanceImportMeetingsCommit,
  governanceExportMeetingsXlsx,
};

export { VALID_STATUSES };
