// Phase 8a — Meetings CRUD shell.
//
// Endpoints:
//   • governanceListMeetings        — seed-on-first-read, tenant-scoped.
//   • governanceGetMeeting          — cross-tenant guard.
//   • governanceUpsertMeeting       — field whitelist; owner-or-admin gate.
//   • governanceSoftDeleteMeeting   — soft-delete + restore via the same
//                                     endpoint (lesson #38), reason ≥ 5
//                                     chars, server-side status guard
//                                     (cannot soft-delete a Held meeting
//                                     — closes the gap flagged in
//                                     Phase 7's audit).
//   • governanceMarkMeetingHeld     — Scheduled → Held (lesson #37).
//   • governanceCancelMeeting       — Scheduled → Cancelled with reason.
//
// Storage: `meetings/{clientId_meetingId}` — composite ID + `clientId`
// field (lesson #10). 8b adds the `minutes` / `decisions` /
// `actionItems` / `linkedReportIds` / `linkedProjectIds` fields.

import type { ApiContext } from '../lib/context.js';
import { SEED_MEETINGS, type MeetingStatus } from '../lib/meetingsSeed.js';

const MEETING_ID_RE = /^[a-z0-9_-]{1,80}$/i;

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
// Cancelled go through dedicated endpoints (lesson #37).
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
    const latest = (await ref.get()).data();
    return res
      .status(200)
      .json({ success: true, item: { _id: ref.id, ...latest } });
  } catch (e: any) {
    console.error('[governanceCancelMeeting] failed:', e);
    return res.status(500).json({
      success: false,
      error: e?.message ?? 'Cancel failed.',
      code: 'ACTION_FAILED',
    });
  }
}

// ── Phase 8b · minutes / decisions / action items / links ───────────────

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
// — change of mind becomes a fresh meeting on a new date.
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
// lesson #38 (one endpoint, status transitions inside).
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

// Phase 8c — Workspace member picker.
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

export const governanceMeetingsRoutes: Record<string, any> = {
  governanceListMeetings,
  governanceGetMeeting,
  governanceUpsertMeeting,
  governanceSoftDeleteMeeting,
  governanceMarkMeetingHeld,
  governanceCancelMeeting,
  // Phase 8b
  governanceSaveMeetingMinutes,
  governanceAddMeetingDecision,
  governanceDeleteMeetingDecision,
  governanceAddMeetingActionItem,
  governanceToggleMeetingActionItem,
  governanceDeleteMeetingActionItem,
  governanceUpdateMeetingLinks,
  governanceListWorkspaceMembers,
};

export { VALID_STATUSES };
