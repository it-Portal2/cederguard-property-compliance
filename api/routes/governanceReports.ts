// Programme Governance — Reports CRUD shell (Phase 6a).
//
// Storage: `reports/{clientId_reportId}` — top-level collection with
// `clientId` field for cheap multi-tenant queries (lesson #10 pattern).
//
// CRUD scope for 6a:
//   • governanceListReports         — list (seeds 5 sample reports on first read)
//   • governanceGetReport           — single report
//   • governanceUpsertReport        — create + update; status restricted to
//                                     'Draft' here. State-machine transitions
//                                     (Submit, Approve, etc.) come in 6c via
//                                     dedicated endpoints (lesson #37).
//   • governanceSoftDeleteReport    — soft-delete with reason (rule §23 / §47)
//
// Authorisation: writes require `ctx.isAtLeastClientAdmin || isOwner`. For
// 6a, ownership is the report's `ownerUid`. Reads only require `isSignedIn`
// — server enforces tenant scoping by `clientId === ctx.primaryUid`.
//
// ADD-never-MODIFY: this is a brand-new collection + endpoints. Nothing in
// existing collections, roles, fields, or routes is renamed or repurposed.

import type { ApiContext } from '../lib/context.js';
import { SEED_REPORTS, type ReportStatus, type SeedReport } from '../lib/reportsSeed.js';
import {
  getDemoContentForSection,
  approxWordCount,
} from '../lib/reportsDemoContent.js';
import {
  buildReportPdfBuffer,
  reportPdfFilename,
} from '../lib/reportPdf.js';
import { uploadAsset, readAssetAsDataUri } from '../lib/storage.js';
import { ensureFpItemFromReport } from './governanceForwardPlan.js';
import { appendHistoryRow } from '../lib/historyRows.js';
import type { ChangeKind } from '../../src/types/historicalReporting.js';

const REPORT_ID_RE = /^[a-z0-9_-]{1,80}$/i;

// HRC HR-4 — fire-and-forget history capture for report-doc mutations.
// Reports already version on submit/seal (Phase 6d), so this complements
// existing version snapshots by capturing every smaller mutation
// (Draft → InReview transitions, soft-delete, etc.) with prev/new state.
function captureReportHistory(
  ctx: ApiContext,
  args: {
    reportId: string;
    prevState: Record<string, any> | null;
    newState: Record<string, any> | null;
    changeKind: ChangeKind;
  },
): void {
  void appendHistoryRow(ctx, {
    kind: 'governanceDoc',
    collection: 'reports',
    ownerScope: args.reportId,
    prevState: args.prevState,
    newState: args.newState,
    changeKind: args.changeKind,
  });
}

const REPORT_WRITABLE_FIELDS = [
  'title',
  'scheme',
  'templateId',
  'templateLabel',
  'forwardPlanItemId',
  'forwardPlanItemLabel',
  'partClassification',
  'isHRB',
  'targetBoardDate',
  'targetMeetingId', // Phase 5.5b — optional meeting reference
  'reviewerUid',
  'reviewerLabel',
  // Status restricted: 6a allows only 'Draft'. State transitions land in 6c.
  'status',
] as const;

const VALID_PATCH_STATUSES: ReportStatus[] = ['Draft'];
const VALID_CLASSIFICATIONS = ['Open', 'Closed', 'Part 1 and 2'];
const ALL_REPORT_STATUSES: ReportStatus[] = [
  'Draft',
  'PendingSeniorPmReview',
  'InReview',
  'AmendmentsRequested',
  'Approved',
  'Sealed',
  'Withdrawn',
  'Abandoned',
];

function pickFields<T extends readonly string[]>(input: any, allowed: T): Record<string, any> {
  if (!input || typeof input !== 'object') return {};
  const out: Record<string, any> = {};
  for (const key of allowed) {
    if (key in input) out[key] = input[key];
  }
  return out;
}

function nowIso() {
  return new Date().toISOString();
}

function reportDocId(ctx: ApiContext, reportId: string): string {
  return `${ctx.primaryUid}_${reportId}`;
}

function isOwnerOrAdmin(ctx: ApiContext, ownerUid?: string | null): boolean {
  if (ctx.isClientAdmin) return true;
  if (!ownerUid) return false;
  return ownerUid === ctx.uid;
}

// ── Seed-on-first-read ────────────────────────────────────────────────────

async function seedReportsIfMissing(ctx: ApiContext) {
  const probe = await ctx.db
    .collection('reports')
    .where('clientId', '==', ctx.primaryUid)
    .limit(1)
    .get();
  if (!probe.empty) return;

  const batch = ctx.db.batch();
  const ts = nowIso();
  for (const seed of SEED_REPORTS) {
    const ref = ctx.db.collection('reports').doc(reportDocId(ctx, seed.id));
    batch.set(ref, seedToDoc(seed, ctx, ts));
  }
  await batch.commit();
}

function seedToDoc(seed: SeedReport, ctx: ApiContext, ts: string) {
  return {
    id: seed.id,
    clientId: ctx.primaryUid,
    title: seed.title,
    scheme: seed.scheme,
    // Real seeded template id (e.g. 'gw1') — server prefixes with clientId
    // when reading the template doc. Empty string falls back to null.
    templateId: seed.templateId ? seed.templateId : null,
    templateLabel: seed.templateLabel,
    forwardPlanItemId: seed.forwardPlanItemId ? seed.forwardPlanItemId : null,
    forwardPlanItemLabel: seed.forwardPlanItemLabel,
    status: seed.status,
    ownerUid: ctx.uid,
    ownerLabel: seed.ownerLabel,
    reviewerUid: null,
    reviewerLabel: seed.reviewerLabel ?? null,
    partClassification: seed.partClassification,
    isHRB: seed.isHRB,
    targetBoardDate: seed.targetBoardDate ?? null,
    softDeleted: seed.softDeleted,
    deletionReason: seed.deletionReason ?? null,
    deletedAt: seed.softDeleted ? ts : null,
    deletedBy: seed.softDeleted ? ctx.uid : null,
    submittedAt: null,
    approvedAt: null,
    sealedAt: null,
    abandonedAt: null,
    abandonmentReason: null,
    createdAt: ts,
    createdBy: ctx.uid,
    updatedAt: ts,
    updatedBy: ctx.uid,
    seeded: true,
  };
}

// ── Endpoints ─────────────────────────────────────────────────────────────

// Backfill-on-read: seeded reports created before the seed-link fix have
// `templateId: null` + `forwardPlanItemId: null`. This rewrites the
// missing IDs from SEED_REPORTS in a single batch on first read after
// the upgrade. Idempotent — once linked, subsequent reads skip every
// row immediately.
async function backfillSeededReportLinks(
  ctx: ApiContext,
  snap: FirebaseFirestore.QuerySnapshot,
): Promise<number> {
  let count = 0;
  let batch = ctx.db.batch();
  for (const doc of snap.docs) {
    const data = doc.data() as any;
    const id = data?.id as string | undefined;
    if (!id?.startsWith('rpt-')) continue;
    const seed = SEED_REPORTS.find((s) => s.id === id);
    if (!seed) continue;
    const updates: Record<string, any> = {};
    if (!data.templateId && seed.templateId) {
      updates.templateId = seed.templateId;
    }
    if (!data.templateLabel && seed.templateLabel) {
      updates.templateLabel = seed.templateLabel;
    }
    if (!data.forwardPlanItemId && seed.forwardPlanItemId) {
      updates.forwardPlanItemId = seed.forwardPlanItemId;
    }
    if (!data.forwardPlanItemLabel && seed.forwardPlanItemLabel) {
      updates.forwardPlanItemLabel = seed.forwardPlanItemLabel;
    }
    if (Object.keys(updates).length === 0) continue;
    batch.set(doc.ref, updates, { merge: true });
    // Mutate the in-memory data so the caller's response reflects the
    // backfill without a second read.
    Object.assign(data, updates);
    count += 1;
  }
  if (count > 0) await batch.commit();
  return count;
}

async function governanceListReports(_req: any, res: any, ctx: ApiContext) {
  try {
    await seedReportsIfMissing(ctx);
    const snap = await ctx.db
      .collection('reports')
      .where('clientId', '==', ctx.primaryUid)
      .get();
    // Auto-link any seeded reports that pre-date the seed-link fix.
    // No-op once everything is linked.
    await backfillSeededReportLinks(ctx, snap);
    const items = snap.docs.map((d) => ({ _id: d.id, ...d.data() }));
    return res.status(200).json({ success: true, items });
  } catch (e: any) {
    console.error('[governanceListReports] failed:', e);
    return res.status(500).json({
      success: false,
      error: e?.message ?? 'Failed to load reports.',
      code: 'LOAD_FAILED',
    });
  }
}

async function governanceGetReport(req: any, res: any, ctx: ApiContext) {
  try {
    const { reportId } = req.body ?? {};
    if (!REPORT_ID_RE.test(reportId ?? '')) {
      return res.status(400).json({
        success: false,
        error: 'reportId required.',
        code: 'INVALID_INPUT',
      });
    }
    const ref = ctx.db.collection('reports').doc(reportDocId(ctx, reportId));
    const snap = await ref.get();
    if (!snap.exists) {
      return res.status(404).json({
        success: false,
        error: 'Report not found.',
        code: 'NOT_FOUND',
      });
    }
    const data = snap.data() ?? {};
    if (data.clientId !== ctx.primaryUid) {
      return res.status(403).json({
        success: false,
        error: 'Report belongs to another workspace.',
        code: 'FORBIDDEN',
      });
    }
    // Side-effect: if a PgM/admin (other than the owner) opens an InReview
    // report for the first time, stamp `firstViewedByPgmAt`. This closes
    // the PM's withdraw window (rule §38). Owner views don't count.
    if (
      data.status === 'InReview' &&
      ctx.isClientAdmin &&
      data.ownerUid !== ctx.uid &&
      !data.firstViewedByPgmAt
    ) {
      try {
        const ts = nowIso();
        await ref.set(
          {
            firstViewedByPgmAt: ts,
            firstViewedByPgmUid: ctx.uid,
          },
          { merge: true },
        );
        data.firstViewedByPgmAt = ts;
        data.firstViewedByPgmUid = ctx.uid;
        await writeReportAuditEvent(ctx, 'report.firstViewedByPgm', {
          reportId,
          beforeStatus: 'InReview',
          afterStatus: 'InReview',
        });
      } catch (markErr) {
        console.error('[reports] firstViewedByPgmAt mark failed:', markErr);
      }
    }
    // Same gate for the Senior PM stage. A user counts as "Senior PM" if
    // their role is `project_manager` AND `pmLevel === 'senior'` (the only
    // way seniority is tracked in this codebase — see roleConstants.ts).
    // Admins also trip this gate so the withdraw window closes once any
    // reviewer has opened the report.
    const callerRoleStr = (ctx.userData?.role ?? '') as string;
    const callerPmLevel = (ctx.userData?.pmLevel ?? '') as string;
    const isSeniorReviewer =
      ctx.isClientAdmin || isSeniorPmRole(callerRoleStr, callerPmLevel);
    if (
      data.status === 'PendingSeniorPmReview' &&
      isSeniorReviewer &&
      data.ownerUid !== ctx.uid &&
      !data.firstViewedBySpmAt
    ) {
      try {
        const ts = nowIso();
        await ref.set(
          {
            firstViewedBySpmAt: ts,
            firstViewedBySpmUid: ctx.uid,
          },
          { merge: true },
        );
        data.firstViewedBySpmAt = ts;
        data.firstViewedBySpmUid = ctx.uid;
        await writeReportAuditEvent(ctx, 'report.firstViewedBySpm', {
          reportId,
          beforeStatus: 'PendingSeniorPmReview',
          afterStatus: 'PendingSeniorPmReview',
        });
      } catch (markErr) {
        console.error('[reports] firstViewedBySpmAt mark failed:', markErr);
      }
    }
    return res.status(200).json({ success: true, item: { _id: snap.id, ...data } });
  } catch (e: any) {
    console.error('[governanceGetReport] failed:', e);
    return res.status(500).json({
      success: false,
      error: e?.message ?? 'Failed to load report.',
      code: 'LOAD_FAILED',
    });
  }
}

async function governanceUpsertReport(req: any, res: any, ctx: ApiContext) {
  try {
    const { reportId, patch } = req.body ?? {};
    if (!REPORT_ID_RE.test(reportId ?? '')) {
      return res.status(400).json({
        success: false,
        error: 'reportId must be 1–80 chars: letters, digits, underscore, hyphen.',
        code: 'INVALID_INPUT',
      });
    }
    if (!patch || typeof patch !== 'object') {
      return res.status(400).json({
        success: false,
        error: 'patch is required.',
        code: 'INVALID_INPUT',
      });
    }

    const safePatch = pickFields(patch, REPORT_WRITABLE_FIELDS);

    if (
      safePatch.partClassification &&
      !VALID_CLASSIFICATIONS.includes(safePatch.partClassification)
    ) {
      return res.status(400).json({
        success: false,
        error: 'partClassification must be Open | Closed | Part 1 and 2.',
        code: 'INVALID_INPUT',
      });
    }
    if (safePatch.status && !VALID_PATCH_STATUSES.includes(safePatch.status)) {
      return res.status(400).json({
        success: false,
        error:
          'Status changes other than Draft go through dedicated endpoints (Submit / Approve / etc.) — coming in 6c.',
        code: 'INVALID_STATE',
      });
    }
    if (safePatch.isHRB !== undefined && typeof safePatch.isHRB !== 'boolean') {
      return res.status(400).json({
        success: false,
        error: 'isHRB must be a boolean.',
        code: 'INVALID_INPUT',
      });
    }

    // Phase 5.5b — 72h lock (Q9 = a + 3-day rule). PM can change
    // `targetMeetingId` freely EXCEPT within 72 hours of the chosen
    // meeting date. After the lock, only the workspace admin can change
    // it. Server-enforced (lesson #75 — UI gate must agree, but server
    // is truth).
    if (
      safePatch.targetMeetingId !== undefined &&
      safePatch.targetMeetingId !== null &&
      typeof safePatch.targetMeetingId === 'string'
    ) {
      try {
        const meetingDoc = await ctx.db
          .collection('meetings')
          .doc(`${ctx.primaryUid}_${safePatch.targetMeetingId}`)
          .get();
        if (!meetingDoc.exists) {
          return res.status(400).json({
            success: false,
            error: 'Selected meeting not found in this workspace.',
            code: 'NOT_FOUND',
          });
        }
        const m = meetingDoc.data() ?? {};
        if (m.status === 'Cancelled') {
          return res.status(400).json({
            success: false,
            error: 'Selected meeting is cancelled — pick another.',
            code: 'INVALID_STATE',
          });
        }
        // 72h lock — applies to non-admin callers only.
        // KNOWN LIMITATION (5.5b post-audit): meeting times stored as
        // UK-local strings ("10:00") parsed here as UTC. During BST
        // (last Sun of Mar → last Sun of Oct), real meeting time is 1h
        // earlier than calculated, so the lock kicks in ~1h LATER than
        // ideal. Acceptable for a soft rule on a UK-only product;
        // proper TZ-aware fix lands in the Phase 12 polish pass when
        // we have a full date library budget.
        if (!ctx.isClientAdmin && typeof m.date === 'string') {
          const meetingTs = new Date(`${m.date}T${m.timeStart ?? '00:00'}:00Z`).getTime();
          const lockTs = meetingTs - 72 * 60 * 60 * 1000;
          if (Date.now() > lockTs) {
            return res.status(400).json({
              success: false,
              error:
                'This meeting is within 72 hours — only the Programme Manager can change the slot now.',
              code: 'LOCKED_72H',
            });
          }
        }
      } catch (e) {
        console.error('[governanceUpsertReport] meeting validate failed', e);
      }
    }

    const ref = ctx.db.collection('reports').doc(reportDocId(ctx, reportId));
    const snap = await ref.get();
    const exists = snap.exists;
    if (exists) {
      const data = snap.data() ?? {};
      if (data.clientId !== ctx.primaryUid) {
        return res.status(403).json({
          success: false,
          error: 'Report belongs to another workspace.',
          code: 'FORBIDDEN',
        });
      }
      if (!isOwnerOrAdmin(ctx, data.ownerUid)) {
        return res.status(403).json({
          success: false,
          error: 'Only the report owner or a Client Admin can edit this report.',
          code: 'FORBIDDEN',
        });
      }
      // Editing is locked to Draft state in 6a — mirrors the FP rule that
      // status transitions live in dedicated endpoints (lesson #37).
      if (data.status && data.status !== 'Draft') {
        return res.status(400).json({
          success: false,
          error:
            'This report is no longer in Draft. Editing in non-Draft states lands in 6c.',
          code: 'INVALID_STATE',
        });
      }
    } else {
      // Create — only Client Admin or signed-in PM can create. Default
      // owner = caller, status = Draft.
    }

    const ts = nowIso();
    const payload: Record<string, any> = {
      ...safePatch,
      id: reportId,
      clientId: ctx.primaryUid,
      updatedAt: ts,
      updatedBy: ctx.uid,
    };
    if (!exists) {
      payload.createdAt = ts;
      payload.createdBy = ctx.uid;
      payload.softDeleted = false;
      payload.status = 'Draft';
      payload.ownerUid = ctx.uid;
      payload.submittedAt = null;
      payload.approvedAt = null;
      payload.sealedAt = null;
      payload.abandonedAt = null;
      payload.abandonmentReason = null;
    }
    await ref.set(payload, { merge: true });
    const latest = (await ref.get()).data() ?? {};
    captureReportHistory(ctx, {
      reportId,
      prevState: exists ? (snap.data() ?? null) : null,
      newState: latest ?? null,
      changeKind: exists ? 'update' : 'create',
    });

    // Phase 5.5b — when `targetMeetingId` is set, auto-create or update
    // the linked Forward Plan item as `Proposed`. This is the "tell"
    // signal Anthony described — PM picks meeting on report → PgM sees
    // it in the FP page → confirms or declines.
    if (
      typeof latest.targetMeetingId === 'string' &&
      latest.targetMeetingId &&
      latest.id
    ) {
      try {
        await ensureFpItemFromReport(
          ctx,
          {
            id: latest.id as string,
            title: (latest.title ?? '') as string,
            scheme: (latest.scheme ?? '') as string,
            partClassification: (latest.partClassification ?? 'Open') as string,
            isHRB: !!latest.isHRB,
          },
          latest.targetMeetingId as string,
        );
      } catch (fpErr) {
        console.error('[governanceUpsertReport] FP auto-create failed', fpErr);
        // Non-fatal — report still saves; PM can re-pick meeting to retry.
      }
    }

    return res.status(200).json({ success: true, item: { _id: ref.id, ...latest } });
  } catch (e: any) {
    console.error('[governanceUpsertReport] failed:', e);
    return res.status(400).json({
      success: false,
      error: e?.message ?? 'Save failed.',
      code: 'SAVE_FAILED',
    });
  }
}

async function governanceSoftDeleteReport(req: any, res: any, ctx: ApiContext) {
  try {
    const { reportId, reason, restore } = req.body ?? {};
    if (!REPORT_ID_RE.test(reportId ?? '')) {
      return res.status(400).json({
        success: false,
        error: 'reportId required.',
        code: 'INVALID_INPUT',
      });
    }
    const wantRestore = restore === true;
    const trimmedReason = typeof reason === 'string' ? reason.trim() : '';
    if (!wantRestore && trimmedReason.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'A deletion reason is required (audit rule §47).',
        code: 'INVALID_INPUT',
      });
    }

    const ref = ctx.db.collection('reports').doc(reportDocId(ctx, reportId));
    const snap = await ref.get();
    if (!snap.exists) {
      return res.status(404).json({
        success: false,
        error: 'Report not found.',
        code: 'NOT_FOUND',
      });
    }
    const data = snap.data() ?? {};
    if (data.clientId !== ctx.primaryUid) {
      return res.status(403).json({
        success: false,
        error: 'Report belongs to another workspace.',
        code: 'FORBIDDEN',
      });
    }
    if (!isOwnerOrAdmin(ctx, data.ownerUid)) {
      return res.status(403).json({
        success: false,
        error: 'Only the report owner or a Client Admin can delete this report.',
        code: 'FORBIDDEN',
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
    captureReportHistory(ctx, {
      reportId,
      prevState: data,
      newState: latest ?? null,
      changeKind: wantRestore ? 'restore' : 'softDelete',
    });
    return res.status(200).json({ success: true, item: { _id: ref.id, ...latest } });
  } catch (e: any) {
    console.error('[governanceSoftDeleteReport] failed:', e);
    return res.status(500).json({
      success: false,
      error: e?.message ?? 'Delete failed.',
      code: 'DELETE_FAILED',
    });
  }
}

// ── Section sub-collection (Phase 6b) ─────────────────────────────────────
//
// Storage: `reports/{reportDocId}/sections/{sectionId}` — content + meta
// per section. `sectionId` mirrors the template-section id so renders are
// stable across template-version changes.
//
// Lazy instantiation: first call to `governanceListReportSections` for a
// report that has a `templateId` set but no sections yet will copy the
// template's sections into the report. Idempotent — subsequent calls skip.
// Same pattern as Phase 0's seed-on-first-read.
//
// Auto-save: `governanceSaveReportSection` upserts content + wordCount +
// last-edited metadata. Called every 30s from the editor.

const SECTION_WRITABLE_FIELDS = [
  'content',
  'wordCount',
] as const;

function reportSectionId(sectionId: string): string {
  return sectionId.replace(/[^a-z0-9_-]/gi, '').slice(0, 80);
}

async function instantiateSectionsIfMissing(
  ctx: ApiContext,
  reportRef: FirebaseFirestore.DocumentReference,
) {
  const data = (await reportRef.get()).data();
  if (!data) return;
  const templateId = data.templateId;
  if (!templateId) return;

  const sectionsRef = reportRef.collection('sections');
  const probe = await sectionsRef.limit(1).get();
  if (!probe.empty) return; // already instantiated

  // Pull the template doc — same composite-id pattern as templates collection.
  const templateRef = ctx.db.collection('reportTemplates').doc(`${ctx.primaryUid}_${templateId}`);
  const templateSnap = await templateRef.get();
  if (!templateSnap.exists) {
    console.warn(`[reports] cannot instantiate — template ${templateId} not found`);
    return;
  }
  const template = templateSnap.data();
  const sections = Array.isArray(template?.sections) ? template.sections : [];
  if (sections.length === 0) return;

  // Caller's report id (without clientId prefix) — used to look up demo
  // content keyed by the seed report id.
  const reportShortId = (data?.id as string | undefined) ?? '';

  const batch = ctx.db.batch();
  const ts = nowIso();
  for (const sec of sections) {
    if (!sec?.id) continue;
    const sectionDocId = reportSectionId(sec.id);
    if (!sectionDocId) continue;
    const ref = sectionsRef.doc(sectionDocId);
    // If this seeded report has demo content for this section, use it so
    // the editor lands populated. Otherwise start with an empty Tiptap
    // doc the author fills in.
    const demo = getDemoContentForSection(reportShortId, sec.id);
    const content = demo ?? { type: 'doc', content: [{ type: 'paragraph' }] };
    const wordCount = demo ? approxWordCount(demo) : 0;
    batch.set(ref, {
      sectionId: sec.id,
      order: typeof sec.order === 'number' ? sec.order : 0,
      name: sec.name ?? '',
      guidance: sec.guidance ?? '',
      mandatory: !!sec.mandatory,
      statutory: !!sec.statutory,
      aiDraftAllowed: !!sec.aiDraftAllowed,
      complianceCheck: !!sec.complianceCheck,
      content,
      wordCount,
      lastEditedAt: demo ? ts : null,
      lastEditedBy: demo ? ctx.uid : null,
      createdAt: ts,
      createdBy: ctx.uid,
    });
  }
  await batch.commit();
}

// Backfill demo content into already-instantiated empty sections of seeded
// reports. Triggered after the Aspen Court demo content was added — any
// section with `wordCount === 0` AND a matching DEMO_CONTENT entry gets
// the demo JSON written. Idempotent — once content > 0 words, skips.
async function backfillDemoContentForSections(
  ctx: ApiContext,
  reportRef: FirebaseFirestore.DocumentReference,
  reportShortId: string,
  snap: FirebaseFirestore.QuerySnapshot,
): Promise<number> {
  let count = 0;
  const batch = ctx.db.batch();
  const ts = nowIso();
  for (const doc of snap.docs) {
    const data = doc.data() as any;
    const sectionId = data?.sectionId as string | undefined;
    if (!sectionId) continue;
    if ((data?.wordCount ?? 0) > 0) continue; // already populated
    const demo = getDemoContentForSection(reportShortId, sectionId);
    if (!demo) continue;
    batch.set(
      doc.ref,
      {
        content: demo,
        wordCount: approxWordCount(demo),
        lastEditedAt: ts,
        lastEditedBy: ctx.uid,
      },
      { merge: true },
    );
    count += 1;
  }
  if (count > 0) {
    await batch.commit();
    // Bump report-level updatedAt so the list view shows fresh activity.
    await reportRef.set({ updatedAt: ts, updatedBy: ctx.uid }, { merge: true });
  }
  return count;
}

async function governanceListReportSections(req: any, res: any, ctx: ApiContext) {
  try {
    const { reportId } = req.body ?? {};
    if (!REPORT_ID_RE.test(reportId ?? '')) {
      return res.status(400).json({
        success: false,
        error: 'reportId required.',
        code: 'INVALID_INPUT',
      });
    }
    const reportRef = ctx.db.collection('reports').doc(reportDocId(ctx, reportId));
    const reportSnap = await reportRef.get();
    if (!reportSnap.exists) {
      return res.status(404).json({
        success: false,
        error: 'Report not found.',
        code: 'NOT_FOUND',
      });
    }
    const reportData = reportSnap.data() ?? {};
    if (reportData.clientId !== ctx.primaryUid) {
      return res.status(403).json({
        success: false,
        error: 'Report belongs to another workspace.',
        code: 'FORBIDDEN',
      });
    }
    await instantiateSectionsIfMissing(ctx, reportRef);
    let snap = await reportRef.collection('sections').get();
    // One-time content backfill for seeded reports whose sections were
    // instantiated empty before demo content was added.
    const reportShortId = (reportData?.id as string) ?? '';
    const backfilled = await backfillDemoContentForSections(
      ctx,
      reportRef,
      reportShortId,
      snap,
    );
    if (backfilled > 0) {
      // Re-read so the response carries the freshly-populated content.
      snap = await reportRef.collection('sections').get();
    }
    const sections = snap.docs
      .map((d) => ({ _id: d.id, ...d.data() }))
      .sort((a: any, b: any) => (a.order ?? 0) - (b.order ?? 0));
    return res.status(200).json({ success: true, sections });
  } catch (e: any) {
    console.error('[governanceListReportSections] failed:', e);
    return res.status(500).json({
      success: false,
      error: e?.message ?? 'Failed to load sections.',
      code: 'LOAD_FAILED',
    });
  }
}

async function governanceSaveReportSection(req: any, res: any, ctx: ApiContext) {
  try {
    const { reportId, sectionId, patch } = req.body ?? {};
    if (!REPORT_ID_RE.test(reportId ?? '')) {
      return res.status(400).json({
        success: false,
        error: 'reportId required.',
        code: 'INVALID_INPUT',
      });
    }
    const cleanSectionId = reportSectionId(sectionId ?? '');
    if (!cleanSectionId) {
      return res.status(400).json({
        success: false,
        error: 'sectionId required.',
        code: 'INVALID_INPUT',
      });
    }
    if (!patch || typeof patch !== 'object') {
      return res.status(400).json({
        success: false,
        error: 'patch is required.',
        code: 'INVALID_INPUT',
      });
    }
    const reportRef = ctx.db.collection('reports').doc(reportDocId(ctx, reportId));
    const reportSnap = await reportRef.get();
    if (!reportSnap.exists) {
      return res.status(404).json({
        success: false,
        error: 'Report not found.',
        code: 'NOT_FOUND',
      });
    }
    const data = reportSnap.data() ?? {};
    if (data.clientId !== ctx.primaryUid) {
      return res.status(403).json({
        success: false,
        error: 'Report belongs to another workspace.',
        code: 'FORBIDDEN',
      });
    }
    if (!isOwnerOrAdmin(ctx, data.ownerUid)) {
      return res.status(403).json({
        success: false,
        error: 'Only the report owner or a Client Admin can edit this report.',
        code: 'FORBIDDEN',
      });
    }
    if (data.status && data.status !== 'Draft') {
      return res.status(400).json({
        success: false,
        error: 'Cannot edit sections — report is not in Draft.',
        code: 'INVALID_STATE',
      });
    }
    const safe = pickFields(patch, SECTION_WRITABLE_FIELDS);
    const ts = nowIso();
    const sectionRef = reportRef.collection('sections').doc(cleanSectionId);
    await sectionRef.set(
      {
        ...safe,
        lastEditedAt: ts,
        lastEditedBy: ctx.uid,
      },
      { merge: true },
    );
    // Bump report-level updatedAt so list view shows fresh activity.
    await reportRef.set({ updatedAt: ts, updatedBy: ctx.uid }, { merge: true });
    const latest = (await sectionRef.get()).data();
    return res.status(200).json({
      success: true,
      section: { _id: sectionRef.id, ...latest },
    });
  } catch (e: any) {
    console.error('[governanceSaveReportSection] failed:', e);
    return res.status(400).json({
      success: false,
      error: e?.message ?? 'Save failed.',
      code: 'SAVE_FAILED',
    });
  }
}

// ── State machine transitions (Phase 6c) ──────────────────────────────────
//
// Status flow:
//   Draft
//     → Submit               → InReview      (owner)
//     → Abandon              → Abandoned     (owner | admin)
//   InReview
//     → Withdraw             → Draft         (owner, within 1h, PgM not yet viewed)
//     → Request amendments   → AmendmentsRequested  (PgM | admin)
//     → Approve              → Approved      (PgM | admin)
//     → Abandon              → Abandoned     (PgM | admin)
//   AmendmentsRequested
//     → Submit (resubmit)    → InReview      (owner)
//     → Withdraw             → Draft         (owner)
//     → Abandon              → Abandoned     (owner | admin)
//   Approved
//     → Abandon              → Abandoned     (admin only — sealed report needs unlock first, lands in 6e)
//
// Every transition writes an `auditEvents` doc. Endpoints reject any
// state mismatch with `INVALID_STATE`.

const WITHDRAW_WINDOW_MS = 60 * 60 * 1000; // 1h

interface TransitionMeta {
  reportId: string;
  beforeStatus: ReportStatus;
  afterStatus: ReportStatus;
  extra?: Record<string, any>;
}

async function writeReportAuditEvent(
  ctx: ApiContext,
  action: string,
  meta: TransitionMeta,
) {
  try {
    const ref = ctx.db.collection('auditEvents').doc();
    await ref.set({
      clientId: ctx.primaryUid,
      actorUid: ctx.uid,
      action,
      entityType: 'report',
      entityId: meta.reportId,
      meta: {
        before: meta.beforeStatus,
        after: meta.afterStatus,
        ...(meta.extra ?? {}),
      },
      createdAt: nowIso(),
    });
  } catch (err) {
    // Audit failures don't roll back the transition — log + continue.
    console.error('[reports] audit write failed:', err);
  }
}

async function loadReportForTransition(
  ctx: ApiContext,
  reportId: string,
  res: any,
): Promise<{ ref: FirebaseFirestore.DocumentReference; data: any } | null> {
  if (!REPORT_ID_RE.test(reportId ?? '')) {
    res.status(400).json({
      success: false,
      error: 'reportId required.',
      code: 'INVALID_INPUT',
    });
    return null;
  }
  const ref = ctx.db.collection('reports').doc(reportDocId(ctx, reportId));
  const snap = await ref.get();
  if (!snap.exists) {
    res.status(404).json({
      success: false,
      error: 'Report not found.',
      code: 'NOT_FOUND',
    });
    return null;
  }
  const data = snap.data() ?? {};
  if (data.clientId !== ctx.primaryUid) {
    res.status(403).json({
      success: false,
      error: 'Report belongs to another workspace.',
      code: 'FORBIDDEN',
    });
    return null;
  }
  return { ref, data };
}

// Reads the linked template's `requireSeniorPmReview` flag. Returns false
// when there's no templateId or the template is missing.
async function templateRequiresSeniorPmReview(
  ctx: ApiContext,
  templateId: string | null | undefined,
): Promise<boolean> {
  if (!templateId) return false;
  try {
    const tplRef = ctx.db
      .collection('reportTemplates')
      .doc(`${ctx.primaryUid}_${templateId}`);
    const tplSnap = await tplRef.get();
    if (!tplSnap.exists) return false;
    return (tplSnap.data() ?? {}).requireSeniorPmReview === true;
  } catch (err) {
    console.error('[reports] template lookup failed in submit:', err);
    return false;
  }
}

// PM submits Draft (or re-submits AmendmentsRequested). Routes to either
// PendingSeniorPmReview (if the linked template flags it) or directly to
// InReview. AmendmentsRequested resubmissions skip the Senior PM stage —
// the PgM is already in the loop and we don't ping-pong.
async function governanceSubmitReport(req: any, res: any, ctx: ApiContext) {
  try {
    const { reportId } = req.body ?? {};
    const loaded = await loadReportForTransition(ctx, reportId, res);
    if (!loaded) return;
    const { ref, data } = loaded;
    if (!isOwnerOrAdmin(ctx, data.ownerUid)) {
      return res.status(403).json({
        success: false,
        error: 'Only the report owner can submit.',
        code: 'FORBIDDEN',
      });
    }
    const before = data.status as ReportStatus;
    if (before !== 'Draft' && before !== 'AmendmentsRequested') {
      return res.status(400).json({
        success: false,
        error: `Cannot submit from ${before}. Only Draft or AmendmentsRequested can be submitted.`,
        code: 'INVALID_STATE',
      });
    }
    // First-time submit from Draft AND template requires Senior PM review
    // → route via Senior PM. Resubmission from AmendmentsRequested goes
    // straight back to PgM (no ping-pong).
    const requiresSpm =
      before === 'Draft' &&
      (await templateRequiresSeniorPmReview(ctx, data.templateId));
    const target: ReportStatus = requiresSpm ? 'PendingSeniorPmReview' : 'InReview';

    const ts = nowIso();
    await ref.set(
      {
        status: target,
        submittedAt: ts,
        submittedBy: ctx.uid,
        // Reset both stage view markers so withdraw windows are fresh.
        firstViewedByPgmAt: null,
        firstViewedByPgmUid: null,
        firstViewedBySpmAt: null,
        firstViewedBySpmUid: null,
        updatedAt: ts,
        updatedBy: ctx.uid,
      },
      { merge: true },
    );
    await writeReportAuditEvent(
      ctx,
      target === 'PendingSeniorPmReview' ? 'report.submitToSeniorPm' : 'report.submit',
      {
        reportId,
        beforeStatus: before,
        afterStatus: target,
      },
    );
    const latest = (await ref.get()).data();
    captureReportHistory(ctx, {
      reportId,
      prevState: typeof data !== 'undefined' ? (data ?? null) : null,
      newState: latest ?? null,
      changeKind: 'update',
    });
    return res.status(200).json({ success: true, item: { _id: ref.id, ...latest } });
  } catch (e: any) {
    console.error('[governanceSubmitReport] failed:', e);
    return res.status(400).json({
      success: false,
      error: e?.message ?? 'Submit failed.',
      code: 'SUBMIT_FAILED',
    });
  }
}

// Owner withdraws an InReview submission back to Draft. Requires:
//   • caller is owner (or admin override)
//   • within WITHDRAW_WINDOW_MS of submittedAt
//   • PgM has NOT yet opened the report (firstViewedByPgmAt is null)
async function governanceWithdrawReport(req: any, res: any, ctx: ApiContext) {
  try {
    const { reportId } = req.body ?? {};
    const loaded = await loadReportForTransition(ctx, reportId, res);
    if (!loaded) return;
    const { ref, data } = loaded;
    if (!isOwnerOrAdmin(ctx, data.ownerUid)) {
      return res.status(403).json({
        success: false,
        error: 'Only the report owner can withdraw.',
        code: 'FORBIDDEN',
      });
    }
    const before = data.status as ReportStatus;
    if (before !== 'InReview' && before !== 'PendingSeniorPmReview') {
      return res.status(400).json({
        success: false,
        error: `Cannot withdraw from ${before}. Only InReview / PendingSeniorPmReview submissions can be withdrawn.`,
        code: 'INVALID_STATE',
      });
    }
    if (!ctx.isClientAdmin) {
      // Admin override skips both gates; otherwise enforce them.
      const submittedAtMs = data.submittedAt
        ? new Date(data.submittedAt).getTime()
        : 0;
      const withinWindow = Date.now() - submittedAtMs <= WITHDRAW_WINDOW_MS;
      if (!withinWindow) {
        return res.status(400).json({
          success: false,
          error: 'Withdraw window expired (1 hour after submission).',
          code: 'WITHDRAW_EXPIRED',
        });
      }
      // Two distinct view-gates depending on which review stage we're at.
      if (before === 'InReview' && data.firstViewedByPgmAt) {
        return res.status(400).json({
          success: false,
          error:
            'Programme Manager has already opened this report — withdraw is no longer allowed. Ask them to Request amendments instead.',
          code: 'WITHDRAW_PGM_VIEWED',
        });
      }
      if (before === 'PendingSeniorPmReview' && data.firstViewedBySpmAt) {
        return res.status(400).json({
          success: false,
          error:
            'Senior Project Manager has already opened this report — withdraw is no longer allowed.',
          code: 'WITHDRAW_SPM_VIEWED',
        });
      }
    }
    const ts = nowIso();
    await ref.set(
      {
        status: 'Draft',
        // Clear submission markers so the next submit looks fresh.
        submittedAt: null,
        submittedBy: null,
        firstViewedByPgmAt: null,
        firstViewedByPgmUid: null,
        updatedAt: ts,
        updatedBy: ctx.uid,
      },
      { merge: true },
    );
    await writeReportAuditEvent(ctx, 'report.withdraw', {
      reportId,
      beforeStatus: before,
      afterStatus: 'Draft',
    });
    const latest = (await ref.get()).data();
    captureReportHistory(ctx, {
      reportId,
      prevState: typeof data !== 'undefined' ? (data ?? null) : null,
      newState: latest ?? null,
      changeKind: 'update',
    });
    return res.status(200).json({ success: true, item: { _id: ref.id, ...latest } });
  } catch (e: any) {
    console.error('[governanceWithdrawReport] failed:', e);
    return res.status(400).json({
      success: false,
      error: e?.message ?? 'Withdraw failed.',
      code: 'WITHDRAW_FAILED',
    });
  }
}

// PgM/admin requests amendments → AmendmentsRequested + writes amendments.
async function governanceRequestAmendments(req: any, res: any, ctx: ApiContext) {
  try {
    const { reportId, amendments } = req.body ?? {};
    if (!Array.isArray(amendments) || amendments.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'At least one amendment is required.',
        code: 'INVALID_INPUT',
      });
    }
    const loaded = await loadReportForTransition(ctx, reportId, res);
    if (!loaded) return;
    const { ref, data } = loaded;
    if (!ctx.isClientAdmin) {
      return res.status(403).json({
        success: false,
        error: 'Only a Programme Manager can request amendments.',
        code: 'FORBIDDEN',
      });
    }
    const before = data.status as ReportStatus;
    if (before !== 'InReview') {
      return res.status(400).json({
        success: false,
        error: `Cannot request amendments from ${before}. Report must be InReview.`,
        code: 'INVALID_STATE',
      });
    }
    const ts = nowIso();
    const batch = ctx.db.batch();
    let createdCount = 0;
    for (const a of amendments) {
      const text = typeof a?.text === 'string' ? a.text.trim() : '';
      if (!text) continue;
      const sectionId =
        typeof a?.sectionId === 'string' && a.sectionId ? a.sectionId : null;
      const aRef = ctx.db.collection('amendments').doc();
      batch.set(aRef, {
        clientId: ctx.primaryUid,
        reportId,
        sectionId,
        text,
        status: 'open',
        authorUid: ctx.uid,
        createdAt: ts,
        resolvedAt: null,
        resolvedBy: null,
      });
      createdCount += 1;
    }
    if (createdCount === 0) {
      return res.status(400).json({
        success: false,
        error: 'All amendments were empty after trimming.',
        code: 'INVALID_INPUT',
      });
    }
    batch.set(
      ref,
      {
        status: 'AmendmentsRequested',
        amendmentsRequestedAt: ts,
        amendmentsRequestedBy: ctx.uid,
        updatedAt: ts,
        updatedBy: ctx.uid,
      },
      { merge: true },
    );
    await batch.commit();
    await writeReportAuditEvent(ctx, 'report.requestAmendments', {
      reportId,
      beforeStatus: before,
      afterStatus: 'AmendmentsRequested',
      extra: { count: createdCount },
    });
    const latest = (await ref.get()).data();
    return res.status(200).json({
      success: true,
      item: { _id: ref.id, ...latest },
      created: createdCount,
    });
  } catch (e: any) {
    console.error('[governanceRequestAmendments] failed:', e);
    return res.status(400).json({
      success: false,
      error: e?.message ?? 'Request amendments failed.',
      code: 'AMEND_FAILED',
    });
  }
}

// PgM/admin approves → Approved.
async function governanceApproveReport(req: any, res: any, ctx: ApiContext) {
  try {
    const { reportId } = req.body ?? {};
    const loaded = await loadReportForTransition(ctx, reportId, res);
    if (!loaded) return;
    const { ref, data } = loaded;
    if (!ctx.isClientAdmin) {
      return res.status(403).json({
        success: false,
        error: 'Only a Programme Manager can approve.',
        code: 'FORBIDDEN',
      });
    }
    const before = data.status as ReportStatus;
    if (before !== 'InReview') {
      return res.status(400).json({
        success: false,
        error: `Cannot approve from ${before}. Report must be InReview.`,
        code: 'INVALID_STATE',
      });
    }
    const ts = nowIso();
    await ref.set(
      {
        status: 'Approved',
        approvedAt: ts,
        approvedBy: ctx.uid,
        updatedAt: ts,
        updatedBy: ctx.uid,
      },
      { merge: true },
    );
    await writeReportAuditEvent(ctx, 'report.approve', {
      reportId,
      beforeStatus: before,
      afterStatus: 'Approved',
    });
    const latest = (await ref.get()).data();
    captureReportHistory(ctx, {
      reportId,
      prevState: typeof data !== 'undefined' ? (data ?? null) : null,
      newState: latest ?? null,
      changeKind: 'update',
    });
    return res.status(200).json({ success: true, item: { _id: ref.id, ...latest } });
  } catch (e: any) {
    console.error('[governanceApproveReport] failed:', e);
    return res.status(400).json({
      success: false,
      error: e?.message ?? 'Approve failed.',
      code: 'APPROVE_FAILED',
    });
  }
}

// Owner or PgM abandons → Abandoned. Reason required.
async function governanceAbandonReport(req: any, res: any, ctx: ApiContext) {
  try {
    const { reportId, reason } = req.body ?? {};
    const trimmedReason = typeof reason === 'string' ? reason.trim() : '';
    if (!trimmedReason) {
      return res.status(400).json({
        success: false,
        error: 'A reason is required to abandon a report (audit rule §47).',
        code: 'INVALID_INPUT',
      });
    }
    const loaded = await loadReportForTransition(ctx, reportId, res);
    if (!loaded) return;
    const { ref, data } = loaded;
    if (!isOwnerOrAdmin(ctx, data.ownerUid)) {
      return res.status(403).json({
        success: false,
        error: 'Only the report owner or a Client Admin can abandon this report.',
        code: 'FORBIDDEN',
      });
    }
    const before = data.status as ReportStatus;
    if (before === 'Approved' || before === 'Sealed') {
      // Sealed reports need unlock-for-correction first (lands in 6e).
      return res.status(400).json({
        success: false,
        error:
          'Approved / Sealed reports cannot be abandoned. Use the unlock-for-correction flow (Phase 6e).',
        code: 'INVALID_STATE',
      });
    }
    if (before === 'Abandoned' || before === 'Withdrawn') {
      return res.status(400).json({
        success: false,
        error: `Already ${before}.`,
        code: 'INVALID_STATE',
      });
    }
    const ts = nowIso();
    await ref.set(
      {
        status: 'Abandoned',
        abandonedAt: ts,
        abandonedBy: ctx.uid,
        abandonmentReason: trimmedReason,
        updatedAt: ts,
        updatedBy: ctx.uid,
      },
      { merge: true },
    );
    await writeReportAuditEvent(ctx, 'report.abandon', {
      reportId,
      beforeStatus: before,
      afterStatus: 'Abandoned',
      extra: { reason: trimmedReason },
    });
    const latest = (await ref.get()).data();
    captureReportHistory(ctx, {
      reportId,
      prevState: typeof data !== 'undefined' ? (data ?? null) : null,
      newState: latest ?? null,
      changeKind: 'update',
    });
    return res.status(200).json({ success: true, item: { _id: ref.id, ...latest } });
  } catch (e: any) {
    console.error('[governanceAbandonReport] failed:', e);
    return res.status(400).json({
      success: false,
      error: e?.message ?? 'Abandon failed.',
      code: 'ABANDON_FAILED',
    });
  }
}

// ── Amendments (Phase 6c) ─────────────────────────────────────────────────

async function governanceListAmendments(req: any, res: any, ctx: ApiContext) {
  try {
    const { reportId } = req.body ?? {};
    if (!REPORT_ID_RE.test(reportId ?? '')) {
      return res.status(400).json({
        success: false,
        error: 'reportId required.',
        code: 'INVALID_INPUT',
      });
    }
    // Cross-tenant guard: load the report first to confirm clientId.
    const reportRef = ctx.db.collection('reports').doc(reportDocId(ctx, reportId));
    const reportSnap = await reportRef.get();
    if (!reportSnap.exists) {
      return res.status(404).json({
        success: false,
        error: 'Report not found.',
        code: 'NOT_FOUND',
      });
    }
    if ((reportSnap.data() ?? {}).clientId !== ctx.primaryUid) {
      return res.status(403).json({
        success: false,
        error: 'Report belongs to another workspace.',
        code: 'FORBIDDEN',
      });
    }
    const snap = await ctx.db
      .collection('amendments')
      .where('clientId', '==', ctx.primaryUid)
      .where('reportId', '==', reportId)
      .get();
    const amendments = snap.docs
      .map((d) => ({ _id: d.id, ...d.data() }))
      .sort((a: any, b: any) =>
        (a.createdAt ?? '').localeCompare(b.createdAt ?? ''),
      );
    return res.status(200).json({ success: true, amendments });
  } catch (e: any) {
    console.error('[governanceListAmendments] failed:', e);
    return res.status(500).json({
      success: false,
      error: e?.message ?? 'Failed to load amendments.',
      code: 'LOAD_FAILED',
    });
  }
}

async function governanceResolveAmendment(req: any, res: any, ctx: ApiContext) {
  try {
    const { amendmentId } = req.body ?? {};
    if (typeof amendmentId !== 'string' || !amendmentId) {
      return res.status(400).json({
        success: false,
        error: 'amendmentId required.',
        code: 'INVALID_INPUT',
      });
    }
    const aRef = ctx.db.collection('amendments').doc(amendmentId);
    const aSnap = await aRef.get();
    if (!aSnap.exists) {
      return res.status(404).json({
        success: false,
        error: 'Amendment not found.',
        code: 'NOT_FOUND',
      });
    }
    const aData = aSnap.data() ?? {};
    if (aData.clientId !== ctx.primaryUid) {
      return res.status(403).json({
        success: false,
        error: 'Amendment belongs to another workspace.',
        code: 'FORBIDDEN',
      });
    }
    // PM (owner of the related report) or admin can resolve. Cheaper to
    // load the report once than to plumb owner into amendment doc.
    const reportRef = ctx.db
      .collection('reports')
      .doc(reportDocId(ctx, aData.reportId));
    const reportSnap = await reportRef.get();
    const reportData = reportSnap.exists ? (reportSnap.data() ?? {}) : {};
    if (!isOwnerOrAdmin(ctx, reportData.ownerUid)) {
      return res.status(403).json({
        success: false,
        error: 'Only the report owner or a Client Admin can resolve an amendment.',
        code: 'FORBIDDEN',
      });
    }
    const ts = nowIso();
    await aRef.set(
      {
        status: 'resolved',
        resolvedAt: ts,
        resolvedBy: ctx.uid,
      },
      { merge: true },
    );
    const latest = (await aRef.get()).data();
    return res.status(200).json({
      success: true,
      amendment: { _id: aRef.id, ...latest },
    });
  } catch (e: any) {
    console.error('[governanceResolveAmendment] failed:', e);
    return res.status(400).json({
      success: false,
      error: e?.message ?? 'Resolve failed.',
      code: 'RESOLVE_FAILED',
    });
  }
}

// ── PDF rendering + signing (Phase 6d) ────────────────────────────────────
//
// Two endpoints:
//   • governanceRenderReportPdf  — preview (no state change). Anyone with
//     access can render at any state; watermark reflects current status.
//   • governanceSignPartA        — Strategic Director / admin only. Must
//     be in Approved state. Resolves signer's signature, generates the
//     sealed PDF, uploads to Storage, flips status → Sealed, and writes a
//     Golden Thread record for HRB projects.

async function governanceRenderReportPdf(req: any, res: any, ctx: ApiContext) {
  try {
    const { reportId, noWatermark, redactPart2 } = req.body ?? {};
    if (!REPORT_ID_RE.test(reportId ?? '')) {
      return res.status(400).json({
        success: false,
        error: 'reportId required.',
        code: 'INVALID_INPUT',
      });
    }
    const reportRef = ctx.db.collection('reports').doc(reportDocId(ctx, reportId));
    const snap = await reportRef.get();
    if (!snap.exists) {
      return res.status(404).json({
        success: false,
        error: 'Report not found.',
        code: 'NOT_FOUND',
      });
    }
    const data = snap.data() ?? {};
    if (data.clientId !== ctx.primaryUid) {
      return res.status(403).json({
        success: false,
        error: 'Report belongs to another workspace.',
        code: 'FORBIDDEN',
      });
    }
    // For Sealed reports the signature is already baked in. For everything
    // else we still resolve the SD's signature so a Part A preview shows
    // what it would look like — but the watermark makes clear it's a draft.
    let partASignatureDataUri: string | null = null;
    if (data.sealedBy) {
      try {
        partASignatureDataUri = await readAssetAsDataUri(
          `userAssets/${data.sealedBy}/signature.png`,
        );
      } catch {
        partASignatureDataUri = null;
      }
    }
    const { buffer } = await buildReportPdfBuffer(ctx, {
      reportId,
      status: data.status ?? 'Draft',
      partASignatureDataUri,
      // Caller can opt out of the status watermark — used by the preview
      // modal's "show/hide" toggle. Sealed PDFs already have no watermark.
      watermarkOverride: noWatermark === true ? null : undefined,
      redactPart2: redactPart2 === true,
    });
    return res.status(200).json({
      success: true,
      pdfBase64: buffer.toString('base64'),
      byteLength: buffer.byteLength,
      filename: reportPdfFilename(data),
    });
  } catch (e: any) {
    console.error('[governanceRenderReportPdf] failed:', e);
    return res.status(400).json({
      success: false,
      error: e?.message ?? 'PDF render failed.',
      code: 'RENDER_FAILED',
    });
  }
}

async function governanceSignPartA(req: any, res: any, ctx: ApiContext) {
  try {
    const { reportId } = req.body ?? {};
    const loaded = await loadReportForTransition(ctx, reportId, res);
    if (!loaded) return;
    const { ref, data } = loaded;
    // Per plan §8: signPart allowed for Strategic Director + Super User.
    // We map "Strategic Director" to userData.role === 'strategic_director'
    // OR caller is admin (covers Client Admin + Super Admin overrides).
    const callerRole = ctx.userData?.role as string | undefined;
    const isStrategicDirector =
      callerRole === 'strategic_director' || ctx.isClientAdmin;
    if (!isStrategicDirector) {
      return res.status(403).json({
        success: false,
        error: 'Only a Strategic Director (or admin) can sign Part A.',
        code: 'FORBIDDEN',
      });
    }
    const before = data.status as ReportStatus;
    if (before !== 'Approved') {
      return res.status(400).json({
        success: false,
        error: `Cannot sign from ${before}. Report must be Approved before sign-off.`,
        code: 'INVALID_STATE',
      });
    }
    // Resolve signer's signature image.
    const signatureDataUri = await readAssetAsDataUri(
      `userAssets/${ctx.uid}/signature.png`,
    );
    if (!signatureDataUri) {
      return res.status(400).json({
        success: false,
        error:
          'No signature on file. Upload your signature image in Profile Settings before signing.',
        code: 'NO_SIGNATURE',
      });
    }

    // Generate the sealed PDF (no watermark — this is the canonical copy).
    const { buffer } = await buildReportPdfBuffer(ctx, {
      reportId,
      status: 'Sealed',
      partASignatureDataUri: signatureDataUri,
      watermarkOverride: null,
    });

    // Upload the sealed PDF to Storage.
    const sealedPath = `reportSeals/${ctx.primaryUid}/${reportId}.pdf`;
    const uploadResult = await uploadAsset(sealedPath, buffer, 'application/pdf');

    const ts = nowIso();
    const update: Record<string, any> = {
      status: 'Sealed',
      sealedAt: ts,
      sealedBy: ctx.uid,
      sealedPdfPath: sealedPath,
      sealedPdfUrl: uploadResult?.url ?? null,
      updatedAt: ts,
      updatedBy: ctx.uid,
    };
    await ref.set(update, { merge: true });

    // Write a Signature audit record alongside the report doc — useful for
    // FOI / Scrutiny later. Top-level `signatures` collection.
    try {
      const sigRef = ctx.db.collection('signatures').doc();
      await sigRef.set({
        clientId: ctx.primaryUid,
        reportId,
        signerUid: ctx.uid,
        part: 'A',
        timestamp: ts,
        sealedPdfPath: sealedPath,
      });
    } catch (sigErr) {
      console.error('[reports] signature record write failed:', sigErr);
    }

    // HRB Golden Thread write — immutable WORM chain (rule §49 / §50).
    if (data.isHRB) {
      try {
        const gtRef = ctx.db.collection('goldenThread').doc();
        // Find the previous Golden Thread record for this report (if any)
        // so the chain has previousHash semantics. Simple linkage via
        // previousId for now; full hash-chain validation lands in Phase 10.
        const priorSnap = await ctx.db
          .collection('goldenThread')
          .where('clientId', '==', ctx.primaryUid)
          .where('reportId', '==', reportId)
          .get();
        const previousId =
          priorSnap.docs.length > 0
            ? priorSnap.docs[priorSnap.docs.length - 1].id
            : null;
        await gtRef.set({
          clientId: ctx.primaryUid,
          reportId,
          version: priorSnap.docs.length + 1,
          previousId,
          decidedAt: ts,
          signerUid: ctx.uid,
          sealedPdfPath: sealedPath,
          payload: {
            title: data.title ?? '',
            templateId: data.templateId ?? null,
            templateLabel: data.templateLabel ?? '',
            forwardPlanItemId: data.forwardPlanItemId ?? null,
            isHRB: true,
            partClassification: data.partClassification ?? 'Open',
            ownerUid: data.ownerUid ?? null,
            approvedAt: data.approvedAt ?? null,
            approvedBy: data.approvedBy ?? null,
          },
          createdAt: ts,
        });
      } catch (gtErr) {
        console.error('[reports] golden thread write failed:', gtErr);
      }
    }

    await writeReportAuditEvent(ctx, 'report.signPartA', {
      reportId,
      beforeStatus: before,
      afterStatus: 'Sealed',
      extra: { isHRB: !!data.isHRB, sealedPdfPath: sealedPath },
    });

    const latest = (await ref.get()).data();
    captureReportHistory(ctx, {
      reportId,
      prevState: typeof data !== 'undefined' ? (data ?? null) : null,
      newState: latest ?? null,
      changeKind: 'update',
    });
    return res.status(200).json({ success: true, item: { _id: ref.id, ...latest } });
  } catch (e: any) {
    console.error('[governanceSignPartA] failed:', e);
    return res.status(400).json({
      success: false,
      error: e?.message ?? 'Sign Part A failed.',
      code: 'SIGN_FAILED',
    });
  }
}

// ── Reviewer picker (Phase 6c polish) ─────────────────────────────────────
//
// Lists users in the caller's workspace who can act as a report reviewer:
// the workspace owner (Programme Manager), any other client_admins, any
// senior PMs (pmLevel === 'senior'), and Strategic Directors. Pure read
// endpoint — no writes.

// Reviewer-eligible raw roles in this codebase. There's only one PM role
// (`project_manager`); seniority comes from `pmLevel === 'senior'` checked
// separately in `isEligibleReviewer`.
const REVIEWER_PRIMARY_ROLES = [
  'admin',
  'super_admin',
  'client_admin',
  'strategic_director',
];

function isEligibleReviewer(data: any): boolean {
  if (!data || typeof data !== 'object') return false;
  const role = (data.role ?? '') as string;
  if (REVIEWER_PRIMARY_ROLES.includes(role)) return true;
  // Senior PM = project_manager + pmLevel === 'senior'.
  if (isSeniorPmRole(role, data.pmLevel)) return true;
  // Multi-role: extraRoles may grant reviewer eligibility too (Round 5 Q15).
  if (Array.isArray(data.extraRoles)) {
    for (const r of data.extraRoles) {
      if (
        r === 'client_admin' ||
        r === 'super_admin' ||
        r === 'strategic_director'
      ) {
        return true;
      }
    }
  }
  return false;
}

function shapeReviewer(uid: string, data: any) {
  return {
    uid,
    name: (data?.name ?? data?.displayName ?? '') as string,
    email: (data?.email ?? '') as string,
    role: (data?.role ?? '') as string,
    pmLevel: (data?.pmLevel ?? null) as string | null,
    extraRoles: Array.isArray(data?.extraRoles) ? data.extraRoles : [],
  };
}

// ── Senior PM intermediate review (Phase 6e) ─────────────────────────────

// In this codebase there's only one PM role (`project_manager`); seniority
// is tracked via `pmLevel === 'senior'`. See [src/lib/roleConstants.ts]
// PM_LEVELS = ['senior', 'standard', 'assistant', 'coordinator'].
function isSeniorPmRole(role?: string, pmLevel?: string): boolean {
  return role === 'project_manager' && pmLevel === 'senior';
}

async function governanceSeniorPmApprove(req: any, res: any, ctx: ApiContext) {
  try {
    const { reportId } = req.body ?? {};
    const loaded = await loadReportForTransition(ctx, reportId, res);
    if (!loaded) return;
    const { ref, data } = loaded;
    const callerRole = (ctx.userData?.role ?? '') as string;
    const callerPmLevel = (ctx.userData?.pmLevel ?? '') as string;
    const allowed =
      ctx.isClientAdmin || isSeniorPmRole(callerRole, callerPmLevel);
    if (!allowed) {
      return res.status(403).json({
        success: false,
        error: 'Only a Senior Project Manager can complete this review.',
        code: 'FORBIDDEN',
      });
    }
    const before = data.status as ReportStatus;
    if (before !== 'PendingSeniorPmReview') {
      return res.status(400).json({
        success: false,
        error: `Cannot Senior-PM-approve from ${before}. Report must be PendingSeniorPmReview.`,
        code: 'INVALID_STATE',
      });
    }
    const ts = nowIso();
    await ref.set(
      {
        status: 'InReview',
        seniorPmApprovedAt: ts,
        seniorPmApprovedBy: ctx.uid,
        // Reset PgM-stage view marker for the new stage's withdraw window.
        firstViewedByPgmAt: null,
        firstViewedByPgmUid: null,
        updatedAt: ts,
        updatedBy: ctx.uid,
      },
      { merge: true },
    );
    await writeReportAuditEvent(ctx, 'report.seniorPmApprove', {
      reportId,
      beforeStatus: before,
      afterStatus: 'InReview',
    });
    const latest = (await ref.get()).data();
    captureReportHistory(ctx, {
      reportId,
      prevState: typeof data !== 'undefined' ? (data ?? null) : null,
      newState: latest ?? null,
      changeKind: 'update',
    });
    return res.status(200).json({ success: true, item: { _id: ref.id, ...latest } });
  } catch (e: any) {
    console.error('[governanceSeniorPmApprove] failed:', e);
    return res.status(400).json({
      success: false,
      error: e?.message ?? 'Senior PM approval failed.',
      code: 'SPM_APPROVE_FAILED',
    });
  }
}

async function governanceSeniorPmRequestAmendments(
  req: any,
  res: any,
  ctx: ApiContext,
) {
  try {
    const { reportId, amendments } = req.body ?? {};
    if (!Array.isArray(amendments) || amendments.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'At least one amendment is required.',
        code: 'INVALID_INPUT',
      });
    }
    const loaded = await loadReportForTransition(ctx, reportId, res);
    if (!loaded) return;
    const { ref, data } = loaded;
    const callerRole = (ctx.userData?.role ?? '') as string;
    const callerPmLevel = (ctx.userData?.pmLevel ?? '') as string;
    const allowed =
      ctx.isClientAdmin || isSeniorPmRole(callerRole, callerPmLevel);
    if (!allowed) {
      return res.status(403).json({
        success: false,
        error: 'Only a Senior Project Manager can request changes here.',
        code: 'FORBIDDEN',
      });
    }
    const before = data.status as ReportStatus;
    if (before !== 'PendingSeniorPmReview') {
      return res.status(400).json({
        success: false,
        error: `Cannot request amendments from ${before}. Report must be PendingSeniorPmReview.`,
        code: 'INVALID_STATE',
      });
    }
    const ts = nowIso();
    const batch = ctx.db.batch();
    let createdCount = 0;
    for (const a of amendments) {
      const text = typeof a?.text === 'string' ? a.text.trim() : '';
      if (!text) continue;
      const sectionId =
        typeof a?.sectionId === 'string' && a.sectionId ? a.sectionId : null;
      const aRef = ctx.db.collection('amendments').doc();
      batch.set(aRef, {
        clientId: ctx.primaryUid,
        reportId,
        sectionId,
        text,
        status: 'open',
        authorUid: ctx.uid,
        // Tag amendments raised at the Senior PM stage so the audit trail is
        // unambiguous downstream (vs PgM-stage amendments).
        stage: 'seniorPm',
        createdAt: ts,
        resolvedAt: null,
        resolvedBy: null,
      });
      createdCount += 1;
    }
    if (createdCount === 0) {
      return res.status(400).json({
        success: false,
        error: 'All amendments were empty after trimming.',
        code: 'INVALID_INPUT',
      });
    }
    batch.set(
      ref,
      {
        status: 'AmendmentsRequested',
        amendmentsRequestedAt: ts,
        amendmentsRequestedBy: ctx.uid,
        updatedAt: ts,
        updatedBy: ctx.uid,
      },
      { merge: true },
    );
    await batch.commit();
    await writeReportAuditEvent(ctx, 'report.seniorPmRequestAmendments', {
      reportId,
      beforeStatus: before,
      afterStatus: 'AmendmentsRequested',
      extra: { count: createdCount },
    });
    const latest = (await ref.get()).data();
    return res.status(200).json({
      success: true,
      item: { _id: ref.id, ...latest },
      created: createdCount,
    });
  } catch (e: any) {
    console.error('[governanceSeniorPmRequestAmendments] failed:', e);
    return res.status(400).json({
      success: false,
      error: e?.message ?? 'Request amendments failed.',
      code: 'SPM_AMEND_FAILED',
    });
  }
}

// ── Unlock for correction (Phase 6e, Round 5 Q17) ────────────────────────
//
// Sealed reports are immutable by default. PgM (own workspace) or super-
// admin can re-open one for correction. Loud audit event + permanent
// unlock-history banner so FOI / Scrutiny review is never misled about
// which "version" of a Sealed report a reader is looking at.

async function governanceUnlockReport(req: any, res: any, ctx: ApiContext) {
  try {
    const { reportId, reason } = req.body ?? {};
    const trimmedReason = typeof reason === 'string' ? reason.trim() : '';
    if (!trimmedReason || trimmedReason.length < 5) {
      return res.status(400).json({
        success: false,
        error: 'A clear reason (≥ 5 chars) is required to unlock a sealed report.',
        code: 'INVALID_INPUT',
      });
    }
    const loaded = await loadReportForTransition(ctx, reportId, res);
    if (!loaded) return;
    const { ref, data } = loaded;
    if (!ctx.isClientAdmin && !ctx.isAdmin) {
      return res.status(403).json({
        success: false,
        error:
          'Only a Programme Manager or super-admin can unlock a sealed report.',
        code: 'FORBIDDEN',
      });
    }
    const before = data.status as ReportStatus;
    if (before !== 'Sealed') {
      return res.status(400).json({
        success: false,
        error: `Cannot unlock from ${before}. Only Sealed reports can be unlocked.`,
        code: 'INVALID_STATE',
      });
    }
    const ts = nowIso();
    const newEntry = {
      at: ts,
      by: ctx.uid,
      reason: trimmedReason,
      // Snapshot the Sealed-state metadata so the history record is
      // self-describing if the report cycles through Sealed multiple times.
      previousSealedAt: data.sealedAt ?? null,
      previousSealedBy: data.sealedBy ?? null,
      previousSealedPdfPath: data.sealedPdfPath ?? null,
    };
    const history = Array.isArray(data.unlockHistory)
      ? [...data.unlockHistory, newEntry]
      : [newEntry];
    await ref.set(
      {
        status: 'Drafting' as any, // narrow legacy alias of 'Draft' kept for clarity
        // Use the canonical Draft state — matches our enum.
        // (Keep both lines harmless: the second `status` overwrites the first.)
      },
      { merge: true },
    );
    await ref.set(
      {
        status: 'Draft',
        unlockHistory: history,
        // Clear seal-specific fields so the next sign re-creates them
        // cleanly. The history entry above preserves the prior seal info.
        sealedAt: null,
        sealedBy: null,
        sealedPdfPath: null,
        sealedPdfUrl: null,
        // Approval is also reset so the report goes through the full
        // chain again. Author resubmits → PgM approves → SD signs.
        approvedAt: null,
        approvedBy: null,
        // Submission markers cleared too — fresh withdraw window when the
        // author resubmits.
        submittedAt: null,
        submittedBy: null,
        firstViewedByPgmAt: null,
        firstViewedByPgmUid: null,
        firstViewedBySpmAt: null,
        firstViewedBySpmUid: null,
        seniorPmApprovedAt: null,
        seniorPmApprovedBy: null,
        updatedAt: ts,
        updatedBy: ctx.uid,
      },
      { merge: true },
    );
    await writeReportAuditEvent(ctx, 'report.unlockedForCorrection', {
      reportId,
      beforeStatus: before,
      afterStatus: 'Draft',
      extra: {
        reason: trimmedReason,
        unlockCount: history.length,
        previousSealedAt: data.sealedAt ?? null,
      },
    });
    const latest = (await ref.get()).data();
    captureReportHistory(ctx, {
      reportId,
      prevState: typeof data !== 'undefined' ? (data ?? null) : null,
      newState: latest ?? null,
      changeKind: 'update',
    });
    return res.status(200).json({ success: true, item: { _id: ref.id, ...latest } });
  } catch (e: any) {
    console.error('[governanceUnlockReport] failed:', e);
    return res.status(400).json({
      success: false,
      error: e?.message ?? 'Unlock failed.',
      code: 'UNLOCK_FAILED',
    });
  }
}

// Phase 7 — My Reports.
// Returns every OPEN amendment whose linked report is owned by the
// signed-in user. Single round trip — UI uses this to render the
// "Feedback from PgM" side panel without N+1 amendment fetches.
// Cross-tenant safety: reports query is already scoped to clientId; we
// only enrich amendments that match my-report ids.
async function governanceListMyOpenAmendments(
  _req: any,
  res: any,
  ctx: ApiContext,
) {
  try {
    const reportSnap = await ctx.db
      .collection('reports')
      .where('clientId', '==', ctx.primaryUid)
      .where('ownerUid', '==', ctx.uid)
      .get();

    const myReportIds = new Set<string>();
    const reportMeta = new Map<
      string,
      { title: string; scheme: string; status: string; targetBoardDate: string | null }
    >();
    for (const d of reportSnap.docs) {
      const data = d.data() ?? {};
      if (data.softDeleted) continue;
      const id = (data.id ?? d.id) as string;
      myReportIds.add(id);
      reportMeta.set(id, {
        title: (data.title ?? '') as string,
        scheme: (data.scheme ?? '') as string,
        status: (data.status ?? 'Draft') as string,
        targetBoardDate: (data.targetBoardDate ?? null) as string | null,
      });
    }

    if (myReportIds.size === 0) {
      return res.status(200).json({ success: true, items: [] });
    }

    const amendSnap = await ctx.db
      .collection('amendments')
      .where('clientId', '==', ctx.primaryUid)
      .where('status', '==', 'open')
      .get();

    const items = amendSnap.docs
      .filter((d) => myReportIds.has((d.data() ?? {}).reportId))
      .map((d) => {
        const a = d.data() ?? {};
        const meta = reportMeta.get(a.reportId)!;
        return {
          _id: d.id,
          ...a,
          reportTitle: meta.title,
          reportScheme: meta.scheme,
          reportStatus: meta.status,
          reportTargetBoardDate: meta.targetBoardDate,
        };
      })
      .sort((a: any, b: any) =>
        (a.createdAt ?? '').localeCompare(b.createdAt ?? ''),
      );

    return res.status(200).json({ success: true, items });
  } catch (e: any) {
    console.error('[governanceListMyOpenAmendments] failed:', e);
    return res.status(500).json({
      success: false,
      error: e?.message ?? 'Failed to load amendments.',
      code: 'LOAD_FAILED',
    });
  }
}

async function governanceListReviewers(_req: any, res: any, ctx: ApiContext) {
  try {
    // Pull every user in the workspace (no role filter) and apply
    // eligibility in-memory so we catch role + pmLevel + extraRoles.
    const snap = await ctx.db
      .collection('users')
      .where('clientId', '==', ctx.primaryUid)
      .get();

    const reviewers: Array<ReturnType<typeof shapeReviewer>> = [];
    for (const d of snap.docs) {
      const data = d.data() ?? {};
      if (isEligibleReviewer(data)) {
        reviewers.push(shapeReviewer(d.id, data));
      }
    }

    // Workspace-owner fallback: their user doc may sit at users/{primaryUid}
    // without a `clientId` field that points back to themselves. Pull it
    // explicitly and add if eligible + not already present.
    if (!reviewers.some((u) => u.uid === ctx.primaryUid)) {
      try {
        const ownerSnap = await ctx.db
          .collection('users')
          .doc(ctx.primaryUid)
          .get();
        if (ownerSnap.exists) {
          const data = ownerSnap.data() ?? {};
          if (isEligibleReviewer(data)) {
            reviewers.unshift(shapeReviewer(ctx.primaryUid, data));
          }
        }
      } catch (ownerErr) {
        console.error('[reviewers] owner fallback failed:', ownerErr);
      }
    }

    reviewers.sort((a, b) =>
      (a.name || a.email).localeCompare(b.name || b.email),
    );
    return res.status(200).json({ success: true, reviewers });
  } catch (e: any) {
    console.error('[governanceListReviewers] failed:', e);
    return res.status(500).json({
      success: false,
      error: e?.message ?? 'Failed to load reviewers.',
      code: 'LOAD_FAILED',
    });
  }
}

export const governanceReportsRoutes: Record<string, any> = {
  governanceListReports,
  governanceGetReport,
  governanceUpsertReport,
  governanceSoftDeleteReport,
  governanceListReportSections,
  governanceSaveReportSection,
  governanceSubmitReport,
  governanceWithdrawReport,
  governanceRequestAmendments,
  governanceApproveReport,
  governanceAbandonReport,
  governanceListAmendments,
  governanceResolveAmendment,
  governanceRenderReportPdf,
  governanceSignPartA,
  governanceListReviewers,
  governanceSeniorPmApprove,
  governanceSeniorPmRequestAmendments,
  governanceUnlockReport,
  // Phase 7 · My Reports
  governanceListMyOpenAmendments,
};

// Re-export so the page knows the full enum without importing seed.
export { ALL_REPORT_STATUSES };
