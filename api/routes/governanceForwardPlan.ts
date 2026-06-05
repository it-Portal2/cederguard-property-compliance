// Programme Governance — Forward Plan endpoints.
//
// Storage: `forwardPlanItems/{clientId_itemId}` — top-level collection with
// `clientId` field for cheap multi-tenant queries.
//
// CRUD:
//   • governanceListForwardPlanItems — list (seeds 5 sample items on first read)
//   • governanceGetForwardPlanItem — single item
//   • governanceUpsertForwardPlanItem — create + update + publish
//   • governanceSoftDeleteForwardPlanItem — soft-delete with reason (rule §23)
//   • governanceMarkForwardPlanItemDecided — flip status to 'Decided'
//
// Authorisation: writes require `ctx.isClientAdmin` (PgM/super-admin); reads
// only require `isSignedIn` so PMs can browse the FP for their projects.

import type { ApiContext } from '../lib/context.js';
import { logActivity } from '../lib/activityLog.js';
import {
  SEED_FORWARD_PLAN_ITEMS,
  withCouncilPrefixedBodyKeys,
  type ForwardPlanStatus,
  type SeedForwardPlanItem,
} from '../lib/forwardPlanSeed.js';
import {
  parseForwardPlanXlsx,
  type ParsedItem,
  type ParsedRow,
} from '../lib/forwardPlanXlsxImport.js';
import { appendHistoryRow } from '../lib/historyRows.js';
import type { ChangeKind } from '../../shared/types/historicalReporting.js';

const ITEM_ID_RE = /^[a-z0-9_-]{1,80}$/i;

//  fire-and-forget history capture for FP item mutations.
// Called after the primary write succeeds. Errors are swallowed inside
// appendHistoryRow so a history failure never blocks the user's save.
function captureFpHistory(
  ctx: ApiContext,
  args: {
    itemId: string;
    prevState: Record<string, any> | null;
    newState: Record<string, any> | null;
    changeKind: ChangeKind;
  },
): void {
  void appendHistoryRow(ctx, {
    kind: 'governanceDoc',
    collection: 'forwardPlanItems',
    ownerScope: args.itemId,
    prevState: args.prevState,
    newState: args.newState,
    changeKind: args.changeKind,
  });
}

// Whitelist locks down which client-supplied fields persist. Fields the
// server controls (status, isKeyDecision, soft-delete state, decided
// timestamps, audit) are deliberately excluded.
const FP_WRITABLE_FIELDS = [
  'title',
  'scheme',
  'reportType',
  'typeOfEntry',
  'classification',
  'isHRB',
  'wards',
  'value',
  'targetDecisionDate',
  'decisionRoute',
  'routingMode',
  'boardGates',
  'strategicLead',
  'reportAuthor',
  'representingOfficer',
  'decisionMaker',
  'otherMeetings',
  'comments',
  'fileLink',
  'decisionLink',
  // Excel Column F. Independent of `status`.
  'approvalStatus',
  // status is allowed via patch but only between Draft / Published. Other
  // transitions go through dedicated endpoints (mark-as-decided, soft-delete).
  'status',
] as const;

const VALID_PATCH_STATUSES: ForwardPlanStatus[] = ['Draft', 'Published'];
const VALID_ENTRY_TYPES = ['New', 'Change', 'Delete'];
const VALID_CLASSIFICATIONS = ['Open', 'Closed', 'Part 1 and 2'];
const VALID_ROUTING_MODES = ['sequential', 'parallel'];
const VALID_GATE_STATUSES = ['scheduled', 'held', 'deferred', 'na'];
const VALID_APPROVAL_STATUSES = ['Pending', 'Approved'];

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

function fpDocId(ctx: ApiContext, itemId: string): string {
  return `${ctx.primaryUid}_${itemId}`;
}

// Server-computed key-decision flag (rule §11 + §16). Always overrides any
// client-supplied value to prevent label-tampering.
function computeIsKeyDecision(item: {
  value?: number;
  wards?: string[];
  isHRB?: boolean;
}): boolean {
  if ((item.value ?? 0) > 500_000) return true;
  if (Array.isArray(item.wards) && item.wards.length >= 2) return true;
  if (item.isHRB === true) return true;
  return false;
}

// Sanitise board gates — strip unknown statuses, undefined values, and
// non-string body IDs to keep the doc shape clean.
function sanitiseBoardGates(input: any): Record<string, any> {
  if (!input || typeof input !== 'object') return {};
  const out: Record<string, any> = {};
  for (const [bodyId, raw] of Object.entries(input)) {
    if (typeof bodyId !== 'string' || !bodyId) continue;
    if (!raw || typeof raw !== 'object') continue;
    const r = raw as any;
    const status = VALID_GATE_STATUSES.includes(r.status) ? r.status : 'scheduled';
    const cleaned: Record<string, any> = { status };
    if (typeof r.targetDate === 'string' && r.targetDate) cleaned.targetDate = r.targetDate;
    if (typeof r.outcome === 'string' && r.outcome) cleaned.outcome = r.outcome;
    out[bodyId] = cleaned;
  }
  return out;
}

// ── Seed-on-first-read ────────────────────────────────────────────────────

async function seedForwardPlanIfMissing(ctx: ApiContext) {
  const probe = await ctx.db
    .collection('forwardPlanItems')
    .where('clientId', '==', ctx.primaryUid)
    .limit(1)
    .get();
  if (!probe.empty) return;

  const batch = ctx.db.batch();
  const ts = nowIso();
  for (const seed of SEED_FORWARD_PLAN_ITEMS) {
    const ref = ctx.db.collection('forwardPlanItems').doc(fpDocId(ctx, seed.id));
    const item = seedToDoc(seed, ctx, ts);
    batch.set(ref, item);
  }
  await batch.commit();
}

function seedToDoc(seed: SeedForwardPlanItem, ctx: ApiContext, ts: string) {
  const isKey = computeIsKeyDecision(seed);
  return {
    id: seed.id,
    clientId: ctx.primaryUid,
    title: seed.title,
    scheme: seed.scheme,
    reportType: seed.reportType,
    typeOfEntry: seed.typeOfEntry,
    classification: seed.classification,
    isHRB: seed.isHRB,
    wards: seed.wards,
    value: seed.value,
    targetDecisionDate: seed.targetDecisionDate,
    decisionRoute: seed.decisionRoute,
    routingMode: seed.routingMode,
    boardGates: withCouncilPrefixedBodyKeys(seed.boardGates, ctx.primaryUid),
    strategicLead: seed.strategicLead,
    reportAuthor: seed.reportAuthor,
    representingOfficer: seed.representingOfficer ?? '',
    decisionMaker: seed.decisionMaker ?? '',
    status: seed.status,
    decidedAt: seed.decidedAt ?? null,
    decisionOutcome: seed.decisionOutcome ?? null,
    softDeleted: seed.softDeleted,
    deletionReason: seed.deletionReason ?? null,
    deletedAt: seed.softDeleted ? ts : null,
    deletedBy: seed.softDeleted ? ctx.uid : null,
    isKeyDecision: isKey,
    otherMeetings: seed.otherMeetings ?? '',
    comments: seed.comments ?? '',
    fileLink: seed.fileLink ?? '',
    decisionLink: seed.decisionLink ?? '',
    // Excel Column F. Carried through from seed; null when
    // the seed didn't set it (most starter rows).
    approvalStatus: seed.approvalStatus ?? null,
    // .5b/5.5c — demo data on new shape (Q34). Resolves
    // `meetingId` etc. to ctx where applicable so the same seed file
    // works across workspaces.
    meetingId: seed.meetingId ?? null,
    reportId: seed.reportId ?? null,
    requestedBy: seed.requestedBy === '__seed__' ? ctx.uid : seed.requestedBy ?? null,
    requestedAt: seed.requestedBy ? ts : null,
    lastDeclineReason: seed.lastDeclineReason ?? null,
    lastDeclinedBy: seed.lastDeclinedBy === '__seed__' ? ctx.uid : seed.lastDeclinedBy ?? null,
    lastDeclinedAt: seed.lastDeclinedAt ?? null,
    needsRerouting: !!seed.needsRerouting,
    createdAt: ts,
    createdBy: ctx.uid,
    updatedAt: ts,
    seeded: true,
  };
}

// ── Endpoints ─────────────────────────────────────────────────────────────

async function governanceListForwardPlanItems(_req: any, res: any, ctx: ApiContext) {
  try {
    await seedForwardPlanIfMissing(ctx);
    const snap = await ctx.db
      .collection('forwardPlanItems')
      .where('clientId', '==', ctx.primaryUid)
      .get();
    const items = snap.docs.map((d) => ({ _id: d.id, ...d.data() }));
    return res.status(200).json({ success: true, items });
  } catch (e: any) {
    console.error('[governanceListForwardPlanItems] failed:', e);
    return res.status(500).json({
      success: false,
      error: e?.message ?? 'Failed to load Forward Plan.',
      code: 'LOAD_FAILED',
    });
  }
}

async function governanceGetForwardPlanItem(req: any, res: any, ctx: ApiContext) {
  try {
    const { itemId } = req.body ?? {};
    if (!ITEM_ID_RE.test(itemId ?? '')) {
      return res.status(400).json({
        success: false,
        error: 'itemId required.',
        code: 'INVALID_INPUT',
      });
    }
    const ref = ctx.db.collection('forwardPlanItems').doc(fpDocId(ctx, itemId));
    const snap = await ref.get();
    if (!snap.exists) {
      return res.status(404).json({
        success: false,
        error: 'Forward Plan item not found.',
        code: 'NOT_FOUND',
      });
    }
    const data = snap.data() ?? {};
    if (data.clientId !== ctx.primaryUid) {
      return res.status(403).json({
        success: false,
        error: 'Item belongs to another workspace.',
        code: 'FORBIDDEN',
      });
    }
    return res.status(200).json({ success: true, item: { _id: snap.id, ...data } });
  } catch (e: any) {
    console.error('[governanceGetForwardPlanItem] failed:', e);
    return res.status(500).json({
      success: false,
      error: e?.message ?? 'Failed to load item.',
      code: 'LOAD_FAILED',
    });
  }
}

async function governanceUpsertForwardPlanItem(req: any, res: any, ctx: ApiContext) {
  try {
    if (!ctx.isClientAdmin) {
      return res.status(403).json({
        success: false,
        error: 'Only Client Admin can edit the Forward Plan.',
        code: 'FORBIDDEN',
      });
    }
    const { itemId, patch } = req.body ?? {};
    if (!ITEM_ID_RE.test(itemId ?? '')) {
      return res.status(400).json({
        success: false,
        error: 'itemId must be 1–80 chars: letters, digits, underscore, hyphen.',
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

    const safePatch = pickFields(patch, FP_WRITABLE_FIELDS);

    // Enum validation — anything outside the locked sets falls back to defaults.
    if (safePatch.typeOfEntry && !VALID_ENTRY_TYPES.includes(safePatch.typeOfEntry)) {
      return res.status(400).json({
        success: false,
        error: 'typeOfEntry must be New | Change | Delete.',
        code: 'INVALID_INPUT',
      });
    }
    if (
      safePatch.classification &&
      !VALID_CLASSIFICATIONS.includes(safePatch.classification)
    ) {
      return res.status(400).json({
        success: false,
        error: 'classification must be Open | Closed | Part 1 and 2.',
        code: 'INVALID_INPUT',
      });
    }
    if (
      safePatch.routingMode &&
      !VALID_ROUTING_MODES.includes(safePatch.routingMode)
    ) {
      return res.status(400).json({
        success: false,
        error: 'routingMode must be sequential | parallel.',
        code: 'INVALID_INPUT',
      });
    }
    if (safePatch.status && !VALID_PATCH_STATUSES.includes(safePatch.status)) {
      return res.status(400).json({
        success: false,
        error: 'status must be Draft or Published. Use mark-as-decided / soft-delete for other transitions.',
        code: 'INVALID_INPUT',
      });
    }
    // Approval Status (Excel Column F). null/undefined clears
    // the field; otherwise must be one of the locked enum values.
    if (
      safePatch.approvalStatus !== undefined &&
      safePatch.approvalStatus !== null &&
      !VALID_APPROVAL_STATUSES.includes(safePatch.approvalStatus)
    ) {
      return res.status(400).json({
        success: false,
        error: 'approvalStatus must be Pending, Approved, or null.',
        code: 'INVALID_INPUT',
      });
    }
    if (safePatch.value !== undefined && typeof safePatch.value !== 'number') {
      return res.status(400).json({
        success: false,
        error: 'value must be a number.',
        code: 'INVALID_INPUT',
      });
    }
    if (safePatch.wards !== undefined && !Array.isArray(safePatch.wards)) {
      return res.status(400).json({
        success: false,
        error: 'wards must be an array of strings.',
        code: 'INVALID_INPUT',
      });
    }
    if (safePatch.boardGates !== undefined) {
      safePatch.boardGates = sanitiseBoardGates(safePatch.boardGates);
    }

    const ref = ctx.db.collection('forwardPlanItems').doc(fpDocId(ctx, itemId));
    const snap = await ref.get();
    const exists = snap.exists;
    if (exists && snap.data()?.clientId !== ctx.primaryUid) {
      return res.status(403).json({
        success: false,
        error: 'Item belongs to another workspace.',
        code: 'FORBIDDEN',
      });
    }

    // Merge stored values into a working copy so the auto-flag uses the
    // post-patch state (e.g. caller raises value past £500k → flag flips
    // even if they didn't touch wards / HRB).
    const merged = { ...(snap.data() ?? {}), ...safePatch };
    const isKey = computeIsKeyDecision(merged);

    const payload: Record<string, any> = {
      ...safePatch,
      id: itemId,
      clientId: ctx.primaryUid,
      isKeyDecision: isKey,
      updatedAt: nowIso(),
      updatedBy: ctx.uid,
    };
    if (!exists) {
      payload.createdAt = nowIso();
      payload.createdBy = ctx.uid;
      payload.softDeleted = false;
      // Default status to Draft on create unless caller explicitly published.
      if (!payload.status) payload.status = 'Draft';
    }
    await ref.set(payload, { merge: true });
    const latest = (await ref.get()).data();
    captureFpHistory(ctx, {
      itemId,
      prevState: exists ? (snap.data() ?? null) : null,
      newState: latest ?? null,
      changeKind: exists ? 'update' : 'create',
    });
    await logActivity(ctx, exists ? 'forward_plan_item_updated' : 'forward_plan_item_created', {
      category: exists ? 'update' : 'create',
      entityType: 'forwardPlanItem',
      entityId: itemId,
      entityName: latest?.title || itemId,
    });
    return res.status(200).json({ success: true, item: { _id: ref.id, ...latest } });
  } catch (e: any) {
    console.error('[governanceUpsertForwardPlanItem] failed:', e);
    return res.status(400).json({
      success: false,
      error: e?.message ?? 'Save failed.',
      code: 'SAVE_FAILED',
    });
  }
}

async function governanceSoftDeleteForwardPlanItem(req: any, res: any, ctx: ApiContext) {
  try {
    if (!ctx.isClientAdmin) {
      return res.status(403).json({
        success: false,
        error: 'Only Client Admin can remove Forward Plan items.',
        code: 'FORBIDDEN',
      });
    }
    const { itemId, reason, restore } = req.body ?? {};
    if (!ITEM_ID_RE.test(itemId ?? '')) {
      return res.status(400).json({
        success: false,
        error: 'itemId required.',
        code: 'INVALID_INPUT',
      });
    }
    const wantRestore = restore === true;
    const trimmedReason = typeof reason === 'string' ? reason.trim() : '';
    if (!wantRestore && trimmedReason.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'A deletion reason is required (audit rule §23).',
        code: 'INVALID_INPUT',
      });
    }

    const ref = ctx.db.collection('forwardPlanItems').doc(fpDocId(ctx, itemId));
    const snap = await ref.get();
    if (!snap.exists) {
      return res.status(404).json({
        success: false,
        error: 'Item not found.',
        code: 'NOT_FOUND',
      });
    }
    if (snap.data()?.clientId !== ctx.primaryUid) {
      return res.status(403).json({
        success: false,
        error: 'Item belongs to another workspace.',
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
    captureFpHistory(ctx, {
      itemId,
      prevState: snap.data() ?? null,
      newState: latest ?? null,
      changeKind: wantRestore ? 'restore' : 'softDelete',
    });
    await logActivity(ctx, wantRestore ? 'forward_plan_item_restored' : 'forward_plan_item_deleted', {
      category: wantRestore ? 'update' : 'delete',
      entityType: 'forwardPlanItem',
      entityId: itemId,
      entityName: latest?.title || itemId,
      details: wantRestore ? undefined : { reason: trimmedReason },
    });
    return res.status(200).json({ success: true, item: { _id: ref.id, ...latest } });
  } catch (e: any) {
    console.error('[governanceSoftDeleteForwardPlanItem] failed:', e);
    return res.status(500).json({
      success: false,
      error: e?.message ?? 'Delete failed.',
      code: 'DELETE_FAILED',
    });
  }
}

async function governanceMarkForwardPlanItemDecided(req: any, res: any, ctx: ApiContext) {
  try {
    if (!ctx.isClientAdmin) {
      return res.status(403).json({
        success: false,
        error: 'Only Client Admin can mark items as decided.',
        code: 'FORBIDDEN',
      });
    }
    const { itemId, outcome } = req.body ?? {};
    if (!ITEM_ID_RE.test(itemId ?? '')) {
      return res.status(400).json({
        success: false,
        error: 'itemId required.',
        code: 'INVALID_INPUT',
      });
    }
    const ref = ctx.db.collection('forwardPlanItems').doc(fpDocId(ctx, itemId));
    const snap = await ref.get();
    if (!snap.exists) {
      return res.status(404).json({
        success: false,
        error: 'Item not found.',
        code: 'NOT_FOUND',
      });
    }
    const data = snap.data() ?? {};
    if (data.clientId !== ctx.primaryUid) {
      return res.status(403).json({
        success: false,
        error: 'Item belongs to another workspace.',
        code: 'FORBIDDEN',
      });
    }
    if (data.status !== 'Published') {
      return res.status(400).json({
        success: false,
        error: 'Only Published items can be marked as Decided.',
        code: 'INVALID_STATE',
      });
    }
    const ts = nowIso();
    await ref.set(
      {
        status: 'Decided',
        decidedAt: ts,
        decidedBy: ctx.uid,
        decisionOutcome: typeof outcome === 'string' ? outcome.trim() : '',
        updatedAt: ts,
        updatedBy: ctx.uid,
      },
      { merge: true },
    );
    const latest = (await ref.get()).data();
    captureFpHistory(ctx, {
      itemId,
      prevState: data,
      newState: latest ?? null,
      changeKind: 'update',
    });
    return res.status(200).json({ success: true, item: { _id: ref.id, ...latest } });
  } catch (e: any) {
    console.error('[governanceMarkForwardPlanItemDecided] failed:', e);
    return res.status(500).json({
      success: false,
      error: e?.message ?? 'Mark-as-decided failed.',
      code: 'STATE_FAILED',
    });
  }
}

// ── Excel import ──────────────────────────────────────────────────────────
// Two-step flow (never auto-commits):
//   1. governanceImportForwardPlanDryRun — parse + validate + preview
//   2. governanceImportForwardPlanCommit — re-parse + write non-error rows
//
// Client transport: base64-encoded xlsx buffer in `fileBase64`. Max file
// size is bounded at 5MB raw (≈ 7MB base64) to prevent memory exhaustion.

const MAX_XLSX_BYTES = 5 * 1024 * 1024;

async function loadFrameworkBodiesLite(ctx: ApiContext) {
  const snap = await ctx.db
    .collection('governanceBodies')
    .where('clientId', '==', ctx.primaryUid)
    .get();
  return snap.docs.map((d) => ({
    _id: d.id,
    ...(d.data() as { id?: string; name?: string; tier?: string }),
  }));
}

function decodeXlsxPayload(fileBase64: unknown): Buffer | null {
  if (typeof fileBase64 !== 'string' || !fileBase64) return null;
  // Strip optional `data:.;base64,` prefix so clients can send either.
  const commaIdx = fileBase64.indexOf(',');
  const b64 = commaIdx >= 0 && fileBase64.startsWith('data:')
    ? fileBase64.slice(commaIdx + 1)
    : fileBase64;
  try {
    const buf = Buffer.from(b64, 'base64');
    if (buf.length === 0 || buf.length > MAX_XLSX_BYTES) return null;
    return buf;
  } catch {
    return null;
  }
}

async function governanceImportForwardPlanDryRun(
  req: any,
  res: any,
  ctx: ApiContext,
) {
  try {
    if (!ctx.isClientAdmin) {
      return res.status(403).json({
        success: false,
        error: 'Only Client Admin can import Forward Plans.',
        code: 'FORBIDDEN',
      });
    }
    const { fileBase64 } = req.body ?? {};
    const buf = decodeXlsxPayload(fileBase64);
    if (!buf) {
      return res.status(400).json({
        success: false,
        error: 'A valid .xlsx file (≤ 5MB) is required.',
        code: 'INVALID_INPUT',
      });
    }
    const bodies = await loadFrameworkBodiesLite(ctx);
    if (bodies.length === 0) {
      return res.status(400).json({
        success: false,
        error:
          'Publish your Governance Framework first — the importer needs bodies to resolve board-date columns.',
        code: 'NO_FRAMEWORK',
      });
    }
    const { rows, summary } = parseForwardPlanXlsx(buf, bodies);
    return res.status(200).json({
      success: true,
      rows: rows.map((r) => ({
        sheetRow: r.sheetRow,
        flags: r.flags,
        // Return a UI-friendly item summary (don't ship the full shape to
        // the client — they re-upload the file for commit; server re-parses).
        preview: {
          id: r.item.id,
          title: r.item.title,
          scheme: r.item.scheme,
          reportType: r.item.reportType,
          value: r.item.value,
          targetDecisionDate: r.item.targetDecisionDate,
          classification: r.item.classification,
          isHRB: r.item.isHRB,
          wardsCount: r.item.wards.length,
          gatesCount: Object.keys(r.item.boardGates).length,
        },
      })),
      summary,
    });
  } catch (e: any) {
    console.error('[governanceImportForwardPlanDryRun] failed:', e);
    return res.status(400).json({
      success: false,
      error: e?.message ?? 'Failed to parse the Excel file.',
      code: 'PARSE_FAILED',
    });
  }
}

async function governanceImportForwardPlanCommit(
  req: any,
  res: any,
  ctx: ApiContext,
) {
  try {
    if (!ctx.isClientAdmin) {
      return res.status(403).json({
        success: false,
        error: 'Only Client Admin can import Forward Plans.',
        code: 'FORBIDDEN',
      });
    }
    const { fileBase64 } = req.body ?? {};
    const buf = decodeXlsxPayload(fileBase64);
    if (!buf) {
      return res.status(400).json({
        success: false,
        error: 'A valid .xlsx file (≤ 5MB) is required.',
        code: 'INVALID_INPUT',
      });
    }
    const bodies = await loadFrameworkBodiesLite(ctx);
    if (bodies.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Publish your Governance Framework first.',
        code: 'NO_FRAMEWORK',
      });
    }
    // Re-parse on commit — never trust client-held rows. Only the same
    // uploaded bytes are the source of truth.
    const { rows } = parseForwardPlanXlsx(buf, bodies);
    const commitable: ParsedRow[] = rows.filter(
      (r) => !r.flags.some((f) => f.severity === 'error'),
    );
    if (commitable.length === 0) {
      return res.status(400).json({
        success: false,
        error:
          'No importable rows — every row has at least one error. Fix the sheet and retry.',
        code: 'NOTHING_TO_IMPORT',
      });
    }
    // Check collisions against existing FP items — duplicate slugs get a
    // numeric suffix so re-imports don't overwrite.
    const existingSnap = await ctx.db
      .collection('forwardPlanItems')
      .where('clientId', '==', ctx.primaryUid)
      .get();
    const existingIds = new Set(existingSnap.docs.map((d) => (d.data() as any).id));

    const ts = nowIso();
    const batch = ctx.db.batch();
    let written = 0;
    // Track imported items so we can fire history rows after the batch
    // commit. Each imported item is brand new — prevState=null,
    // changeKind='create'.
    const importedForHistory: Array<{ id: string; doc: Record<string, any> }> = [];
    for (const row of commitable) {
      let id = row.item.id;
      // Suffix on collision.
      let attempt = 1;
      while (existingIds.has(id)) {
        id = `${row.item.id}-${attempt}`;
        attempt += 1;
        if (attempt > 50) break;
      }
      existingIds.add(id);
      const ref = ctx.db.collection('forwardPlanItems').doc(fpDocId(ctx, id));
      const item = parsedItemToDoc(row.item, id, ctx, ts);
      batch.set(ref, item);
      importedForHistory.push({ id, doc: item });
      written += 1;
    }
    await batch.commit();

    //  fire one history row per imported item. Best-effort,
    // doesn't await each call to keep response time tight; appendHistoryRow
    // swallows errors internally.
    for (const { id, doc } of importedForHistory) {
      captureFpHistory(ctx, {
        itemId: id,
        prevState: null,
        newState: doc,
        changeKind: 'create',
      });
    }

    // Audit trail — single entry for the whole import.
    try {
      const auditRef = ctx.db.collection('auditEvents').doc();
      await auditRef.set({
        clientId: ctx.primaryUid,
        actorUid: ctx.uid,
        action: 'forwardPlan.importXlsx',
        meta: {
          written,
          skipped: rows.length - commitable.length,
          totalRows: rows.length,
        },
        createdAt: ts,
      });
    } catch (auditErr) {
      console.error('[import] audit write failed:', auditErr);
    }

    return res.status(200).json({
      success: true,
      written,
      skipped: rows.length - commitable.length,
      totalRows: rows.length,
    });
  } catch (e: any) {
    console.error('[governanceImportForwardPlanCommit] failed:', e);
    return res.status(400).json({
      success: false,
      error: e?.message ?? 'Import commit failed.',
      code: 'COMMIT_FAILED',
    });
  }
}

function parsedItemToDoc(
  parsed: ParsedItem,
  id: string,
  ctx: ApiContext,
  ts: string,
) {
  const isKey = computeIsKeyDecision(parsed);
  return {
    id,
    clientId: ctx.primaryUid,
    title: parsed.title,
    scheme: parsed.scheme,
    reportType: parsed.reportType,
    typeOfEntry: parsed.typeOfEntry,
    classification: parsed.classification,
    isHRB: parsed.isHRB,
    wards: parsed.wards,
    value: parsed.value,
    targetDecisionDate: parsed.targetDecisionDate || null,
    decisionRoute: parsed.decisionRoute,
    routingMode: parsed.routingMode,
    boardGates: parsed.boardGates,
    strategicLead: parsed.strategicLead,
    reportAuthor: parsed.reportAuthor,
    representingOfficer: parsed.representingOfficer,
    decisionMaker: parsed.decisionMaker,
    status: parsed.status,
    isKeyDecision: isKey,
    softDeleted: false,
    otherMeetings: parsed.otherMeetings,
    comments: parsed.comments,
    fileLink: parsed.fileLink,
    decisionLink: parsed.decisionLink,
    // Excel Column F. Importer normalises to Pending /
    // Approved / null; commit just persists the parsed value.
    approvalStatus: parsed.approvalStatus,
    createdAt: ts,
    createdBy: ctx.uid,
    updatedAt: ts,
    updatedBy: ctx.uid,
    importedAt: ts,
    importedBy: ctx.uid,
  };
}

// ── Proposed/Confirm/Decline/Withdraw flow ─────────────────

const PROPOSED_PENDING_STATES: ForwardPlanStatus[] = ['Proposed'];

function isOwnerOrAdmin(ctx: ApiContext, ownerUid?: string | null): boolean {
  if (ctx.isClientAdmin) return true;
  if (!ownerUid) return false;
  return ownerUid === ctx.uid;
}

/**
 * auto-create or update an FP item when a PM picks a
 * meeting on a report. Status lands as `Proposed` (Q3 = a strict
 * approval). Inherits what we can from the report; PgM fills the
 * rest on Confirm.
 * Idempotency: if a Proposed/Draft FP item already exists for this
 * `reportId`, update it (re-pointing meetingId, flipping back to
 * Proposed). Never duplicates.
 */
export async function ensureFpItemFromReport(
  ctx: ApiContext,
  report: {
    id: string;
    title: string;
    scheme: string;
    partClassification: string;
    isHRB: boolean;
  },
  meetingId: string | null,
): Promise<void> {
  const ts = nowIso();

  // BUG FIX (5.5b post-audit): if the PM CLEARED `targetMeetingId`
  // (passed null) but a Proposed FP item still references this report,
  // soft-delete that FP item — otherwise it sits as a zombie pending
  // request the PgM has to clean up by hand. Silent fix per audit.
  if (!meetingId) {
    try {
      const orphanSnap = await ctx.db
        .collection('forwardPlanItems')
        .where('clientId', '==', ctx.primaryUid)
        .where('reportId', '==', report.id)
        .where('status', '==', 'Proposed')
        .get();
      const batch = ctx.db.batch();
      let count = 0;
      for (const d of orphanSnap.docs) {
        const data = d.data() ?? {};
        if (data.softDeleted) continue;
        batch.set(
          d.ref,
          {
            softDeleted: true,
            deletionReason: 'PM cleared the meeting reference on the report.',
            deletedAt: ts,
            deletedBy: ctx.uid,
            updatedAt: ts,
            updatedBy: ctx.uid,
          },
          { merge: true },
        );
        count += 1;
      }
      if (count > 0) await batch.commit();
    } catch (orphanErr) {
      console.error('[ensureFpItemFromReport] orphan cleanup failed', orphanErr);
    }
    return;
  }

  // Look for an existing FP item linked to this report (any status).
  const snap = await ctx.db
    .collection('forwardPlanItems')
    .where('clientId', '==', ctx.primaryUid)
    .where('reportId', '==', report.id)
    .get();

  const existing = snap.docs.find((d) => !d.data()?.softDeleted);

  // Resolve target meeting date (used for `targetDecisionDate` mirror).
  let targetDecisionDate: string | null = null;
  try {
    const meetingDoc = await ctx.db
      .collection('meetings')
      .doc(`${ctx.primaryUid}_${meetingId}`)
      .get();
    if (meetingDoc.exists) {
      targetDecisionDate = (meetingDoc.data()?.date ?? null) as string | null;
    }
  } catch (e) {
    console.error('[ensureFpItemFromReport] meeting lookup failed', e);
  }

  if (existing) {
    // Update — re-point + flip back to Proposed for PgM re-confirm.
    const data = existing.data() ?? {};
    if (data.meetingId === meetingId && data.status === 'Proposed') {
      // Idempotent — nothing to change.
      return;
    }
    await existing.ref.set(
      {
        meetingId,
        targetDecisionDate: targetDecisionDate ?? data.targetDecisionDate ?? null,
        status: 'Proposed',
        requestedBy: ctx.uid,
        requestedAt: ts,
        // Clear any decline-state when PM re-pitches.
        lastDeclineReason: null,
        lastDeclinedBy: null,
        lastDeclinedAt: null,
        needsRerouting: false,
        updatedAt: ts,
        updatedBy: ctx.uid,
      },
      { merge: true },
    );
    //  capture the re-point as an update history row.
    try {
      const latest = (await existing.ref.get()).data();
      captureFpHistory(ctx, {
        itemId: data.id ?? existing.id,
        prevState: data,
        newState: latest ?? null,
        changeKind: 'update',
      });
    } catch {}
    return;
  }

  // Create — auto-inherit fields from the report.
  const itemId = `fp-${report.id}-${Math.floor(Math.random() * 36 ** 4).toString(36)}`;
  const ref = ctx.db.collection('forwardPlanItems').doc(fpDocId(ctx, itemId));
  // BUG FIX (5.5b post-audit): compute isKeyDecision from the inherited
  // fields. Earlier hardcoded `false` lost the HRB → key-decision rule
  // (rule §11 + §16) for HRB reports until a PgM edited the FP item.
  const isKey = computeIsKeyDecision({
    value: 0,
    wards: [],
    isHRB: !!report.isHRB,
  });
  await ref.set({
    id: itemId,
    clientId: ctx.primaryUid,
    title: report.title,
    scheme: report.scheme,
    reportType: '',
    typeOfEntry: 'New',
    classification: report.partClassification,
    isHRB: !!report.isHRB,
    wards: [],
    value: 0,
    targetDecisionDate,
    decisionRoute: '',
    routingMode: 'sequential',
    boardGates: {}, // legacy fallback empty for new items
    strategicLead: '',
    reportAuthor: '',
    status: 'Proposed' as ForwardPlanStatus,
    isKeyDecision: isKey,
    softDeleted: false,
    deletionReason: null,
    deletedAt: null,
    deletedBy: null,
    meetingId,
    reportId: report.id,
    requestedBy: ctx.uid,
    requestedAt: ts,
    createdAt: ts,
    createdBy: ctx.uid,
    updatedAt: ts,
    updatedBy: ctx.uid,
  });
  //  capture create as a history row.
  try {
    const latest = (await ref.get()).data();
    captureFpHistory(ctx, {
      itemId,
      prevState: null,
      newState: latest ?? null,
      changeKind: 'create',
    });
  } catch {}
}

async function loadFpItemForTransition(
  ctx: ApiContext,
  itemId: string,
  res: any,
  allowedStatuses: ForwardPlanStatus[],
  ownerCheck: 'owner-or-admin' | 'admin-only' | 'requester-only' = 'owner-or-admin',
): Promise<{ ref: FirebaseFirestore.DocumentReference; data: any } | null> {
  if (typeof itemId !== 'string' || !itemId) {
    res.status(400).json({
      success: false,
      error: 'itemId required.',
      code: 'INVALID_INPUT',
    });
    return null;
  }
  const ref = ctx.db.collection('forwardPlanItems').doc(fpDocId(ctx, itemId));
  const snap = await ref.get();
  if (!snap.exists) {
    res.status(404).json({
      success: false,
      error: 'Forward Plan item not found.',
      code: 'NOT_FOUND',
    });
    return null;
  }
  const data = snap.data() ?? {};
  if (data.clientId !== ctx.primaryUid) {
    res.status(403).json({
      success: false,
      error: 'Item belongs to another workspace.',
      code: 'FORBIDDEN',
    });
    return null;
  }
  if (ownerCheck === 'admin-only' && !ctx.isClientAdmin) {
    res.status(403).json({
      success: false,
      error: 'Only a Client Admin can perform this action.',
      code: 'FORBIDDEN',
    });
    return null;
  }
  if (ownerCheck === 'requester-only' && data.requestedBy !== ctx.uid) {
    res.status(403).json({
      success: false,
      error: 'Only the PM who raised the request can withdraw it.',
      code: 'FORBIDDEN',
    });
    return null;
  }
  if (
    ownerCheck === 'owner-or-admin' &&
    !isOwnerOrAdmin(ctx, data.requestedBy ?? data.createdBy)
  ) {
    res.status(403).json({
      success: false,
      error: 'Only the owner or a Client Admin can perform this action.',
      code: 'FORBIDDEN',
    });
    return null;
  }
  if (!allowedStatuses.includes(data.status as ForwardPlanStatus)) {
    res.status(400).json({
      success: false,
      error: `This action requires the item to be in one of: ${allowedStatuses.join(', ')}.`,
      code: 'INVALID_STATE',
    });
    return null;
  }
  return { ref, data };
}

async function governanceConfirmFpItem(req: any, res: any, ctx: ApiContext) {
  try {
    if (!ctx.isClientAdmin) {
      return res.status(403).json({
        success: false,
        error: 'Only a Client Admin can confirm a request.',
        code: 'FORBIDDEN',
      });
    }
    const { itemId } = req.body ?? {};
    const loaded = await loadFpItemForTransition(
      ctx,
      itemId,
      res,
      PROPOSED_PENDING_STATES,
      'admin-only',
    );
    if (!loaded) return;
    const ts = nowIso();
    await loaded.ref.set(
      {
        status: 'Published' as ForwardPlanStatus,
        confirmedAt: ts,
        confirmedBy: ctx.uid,
        updatedAt: ts,
        updatedBy: ctx.uid,
      },
      { merge: true },
    );

    // Sync to meeting.linkedReportIds — append if not present.
    const data = loaded.data;
    if (data.meetingId && data.reportId) {
      try {
        const meetingRef = ctx.db
          .collection('meetings')
          .doc(`${ctx.primaryUid}_${data.meetingId}`);
        const meetingSnap = await meetingRef.get();
        if (meetingSnap.exists) {
          const m = meetingSnap.data() ?? {};
          const linked: string[] = Array.isArray(m.linkedReportIds)
            ? m.linkedReportIds
            : [];
          if (!linked.includes(data.reportId)) {
            await meetingRef.set(
              {
                linkedReportIds: [...linked, data.reportId],
                updatedAt: ts,
                updatedBy: ctx.uid,
              },
              { merge: true },
            );
          }
        }
      } catch (linkErr) {
        console.error('[governanceConfirmFpItem] link sync failed', linkErr);
      }
    }

    // Audit row (Q25 = yes).
    try {
      await ctx.db.collection('auditEvents').add({
        clientId: ctx.primaryUid,
        action: 'forwardPlan.confirmed',
        actorUid: ctx.uid,
        timestamp: ts,
        meta: { itemId, reportId: data.reportId, meetingId: data.meetingId },
      });
    } catch (auditErr) {
      console.error('[governanceConfirmFpItem] audit failed', auditErr);
    }

    const latest = (await loaded.ref.get()).data();
    captureFpHistory(ctx, {
      itemId,
      prevState: loaded.data ?? null,
      newState: latest ?? null,
      changeKind: 'update',
    });
    return res.status(200).json({ success: true, item: { _id: loaded.ref.id, ...latest } });
  } catch (e: any) {
    console.error('[governanceConfirmFpItem] failed:', e);
    return res.status(500).json({
      success: false,
      error: e?.message ?? 'Confirm failed.',
      code: 'CONFIRM_FAILED',
    });
  }
}

async function governanceDeclineFpItem(req: any, res: any, ctx: ApiContext) {
  try {
    if (!ctx.isClientAdmin) {
      return res.status(403).json({
        success: false,
        error: 'Only a Client Admin can decline a request.',
        code: 'FORBIDDEN',
      });
    }
    const { itemId, reason } = req.body ?? {};
    const trimmedReason = typeof reason === 'string' ? reason.trim() : '';
    if (trimmedReason.length < 5) {
      return res.status(400).json({
        success: false,
        error: 'A decline reason of at least 5 characters is required.',
        code: 'INVALID_INPUT',
      });
    }
    const loaded = await loadFpItemForTransition(
      ctx,
      itemId,
      res,
      PROPOSED_PENDING_STATES,
      'admin-only',
    );
    if (!loaded) return;
    const ts = nowIso();
    // Q10 = c — flip back to Draft (PM-owned again, no separate Declined state).
    await loaded.ref.set(
      {
        status: 'Draft' as ForwardPlanStatus,
        lastDeclineReason: trimmedReason,
        lastDeclinedBy: ctx.uid,
        lastDeclinedAt: ts,
        updatedAt: ts,
        updatedBy: ctx.uid,
      },
      { merge: true },
    );
    try {
      await ctx.db.collection('auditEvents').add({
        clientId: ctx.primaryUid,
        action: 'forwardPlan.declined',
        actorUid: ctx.uid,
        timestamp: ts,
        meta: { itemId, reason: trimmedReason },
      });
    } catch (auditErr) {
      console.error('[governanceDeclineFpItem] audit failed', auditErr);
    }
    const latest = (await loaded.ref.get()).data();
    captureFpHistory(ctx, {
      itemId,
      prevState: loaded.data ?? null,
      newState: latest ?? null,
      changeKind: 'update',
    });
    return res.status(200).json({ success: true, item: { _id: loaded.ref.id, ...latest } });
  } catch (e: any) {
    console.error('[governanceDeclineFpItem] failed:', e);
    return res.status(500).json({
      success: false,
      error: e?.message ?? 'Decline failed.',
      code: 'DECLINE_FAILED',
    });
  }
}

async function governanceWithdrawFpItem(req: any, res: any, ctx: ApiContext) {
  try {
    const { itemId } = req.body ?? {};
    const loaded = await loadFpItemForTransition(
      ctx,
      itemId,
      res,
      PROPOSED_PENDING_STATES,
      'requester-only',
    );
    if (!loaded) return;
    const ts = nowIso();
    // Q21 = c — soft-delete + audit (PgM sees the trail).
    await loaded.ref.set(
      {
        softDeleted: true,
        deletionReason: 'PM withdrew the request.',
        deletedAt: ts,
        deletedBy: ctx.uid,
        updatedAt: ts,
        updatedBy: ctx.uid,
      },
      { merge: true },
    );
    try {
      await ctx.db.collection('auditEvents').add({
        clientId: ctx.primaryUid,
        action: 'forwardPlan.withdrawn',
        actorUid: ctx.uid,
        timestamp: ts,
        meta: {
          itemId,
          reportId: loaded.data.reportId,
          meetingId: loaded.data.meetingId,
        },
      });
    } catch (auditErr) {
      console.error('[governanceWithdrawFpItem] audit failed', auditErr);
    }
    const latest = (await loaded.ref.get()).data();
    captureFpHistory(ctx, {
      itemId,
      prevState: loaded.data ?? null,
      newState: latest ?? null,
      changeKind: 'softDelete',
    });
    return res.status(200).json({ success: true, item: { _id: loaded.ref.id, ...latest } });
  } catch (e: any) {
    console.error('[governanceWithdrawFpItem] failed:', e);
    return res.status(500).json({
      success: false,
      error: e?.message ?? 'Withdraw failed.',
      code: 'WITHDRAW_FAILED',
    });
  }
}

export const governanceForwardPlanRoutes: Record<string, any> = {
  governanceListForwardPlanItems,
  governanceGetForwardPlanItem,
  governanceUpsertForwardPlanItem,
  governanceSoftDeleteForwardPlanItem,
  governanceMarkForwardPlanItemDecided,
  governanceImportForwardPlanDryRun,
  governanceImportForwardPlanCommit,
  // Proposed/Confirm/Decline/Withdraw flow
  governanceConfirmFpItem,
  governanceDeclineFpItem,
  governanceWithdrawFpItem,
};
