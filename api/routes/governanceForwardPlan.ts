// Programme Governance — Forward Plan endpoints.
//
// Storage: `forwardPlanItems/{clientId_itemId}` — top-level collection with
// `clientId` field for cheap multi-tenant queries (lesson #10 pattern).
//
// CRUD:
//   • governanceListForwardPlanItems  — list (seeds 5 sample items on first read)
//   • governanceGetForwardPlanItem    — single item
//   • governanceUpsertForwardPlanItem — create + update + publish
//   • governanceSoftDeleteForwardPlanItem — soft-delete with reason (rule §23)
//   • governanceMarkForwardPlanItemDecided — flip status to 'Decided'
//
// Authorisation: writes require `ctx.isClientAdmin` (PgM/super-admin); reads
// only require `isSignedIn` so PMs can browse the FP for their projects.

import type { ApiContext } from '../lib/context.js';
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

const ITEM_ID_RE = /^[a-z0-9_-]{1,80}$/i;

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
  // status is allowed via patch but only between Draft / Published. Other
  // transitions go through dedicated endpoints (mark-as-decided, soft-delete).
  'status',
] as const;

const VALID_PATCH_STATUSES: ForwardPlanStatus[] = ['Draft', 'Published'];
const VALID_ENTRY_TYPES = ['New', 'Change', 'Delete'];
const VALID_CLASSIFICATIONS = ['Open', 'Closed', 'Part 1 and 2'];
const VALID_ROUTING_MODES = ['sequential', 'parallel'];
const VALID_GATE_STATUSES = ['scheduled', 'held', 'deferred', 'na'];

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
  // Strip optional `data:...;base64,` prefix so clients can send either.
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
      written += 1;
    }
    await batch.commit();

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
    createdAt: ts,
    createdBy: ctx.uid,
    updatedAt: ts,
    updatedBy: ctx.uid,
    importedAt: ts,
    importedBy: ctx.uid,
  };
}

export const governanceForwardPlanRoutes: Record<string, any> = {
  governanceListForwardPlanItems,
  governanceGetForwardPlanItem,
  governanceUpsertForwardPlanItem,
  governanceSoftDeleteForwardPlanItem,
  governanceMarkForwardPlanItemDecided,
  governanceImportForwardPlanDryRun,
  governanceImportForwardPlanCommit,
};
