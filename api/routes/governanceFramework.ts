// Programme Governance — Framework / Body / Thresholds / ToR endpoints.
//
// Scope rules:
//   • A framework is identified by `clientId` (one canonical framework per
//     council). We keep the working doc at `frameworks/{clientId}` plus a
//     `frameworks/{clientId}/versions/{n}` history subcollection. Publishing
//     snapshots the current state into the next version.
//   • Governance bodies live in a top-level `governanceBodies/{bodyId}`
//     collection with `clientId` + `frameworkId` fields so queries stay cheap.
//   • Terms of Reference (ToR) are versioned per body: `termsOfReference/{torId}`
//     with `ownerBodyId` + `version` + `status`.
//
// Authorisation: all writes require `ctx.isClientAdmin` (PgM/super-admin).
// Reads require only `isSignedIn` so Project Managers can see the framework
// their report has to route through.

import type { ApiContext } from '../lib/context.js';
import { logActivity } from '../lib/activityLog.js';
import {
  SEED_BODIES,
  SEED_THRESHOLDS,
  TIER_COLOURS,
  type BodyTier,
  type SeedBody,
  type SeedThreshold,
} from '../lib/frameworkSeed.js';
import {
  renderFrameworkDiagram,
  renderFrameworkConstitution,
  type FrameworkPdfInput,
} from '../lib/frameworkPdfRenderer.js';
import { readAssetAsDataUri, assetPaths } from '../lib/storage.js';
import { appendHistoryRow } from '../lib/historyRows.js';
import type { ChangeKind } from '../../shared/types/historicalReporting.js';

const BODY_ID_RE = /^[a-z0-9_-]{1,80}$/i;
const STAMP_LIKE_RE = /^[a-z0-9_-]{1,80}$/i;

//  fire-and-forget history capture for framework + ToR mutations.
// Bodies and thresholds are children of the framework — their changes are
// captured against the framework doc's history so a single timeline tells
// the whole story. ToRs are a separate collection per types.
function captureFrameworkHistory(
  ctx: ApiContext,
  args: {
    prevState: Record<string, any> | null;
    newState: Record<string, any> | null;
    changeKind: ChangeKind;
  },
): void {
  void appendHistoryRow(ctx, {
    kind: 'governanceDoc',
    collection: 'framework',
    ownerScope: ctx.primaryUid, // one framework per workspace
    prevState: args.prevState,
    newState: args.newState,
    changeKind: args.changeKind,
  });
}

function captureTorHistory(
  ctx: ApiContext,
  args: {
    torId: string;
    prevState: Record<string, any> | null;
    newState: Record<string, any> | null;
    changeKind: ChangeKind;
  },
): void {
  void appendHistoryRow(ctx, {
    kind: 'governanceDoc',
    collection: 'tors',
    ownerScope: args.torId,
    prevState: args.prevState,
    newState: args.newState,
    changeKind: args.changeKind,
  });
}

// Allow-listed writable fields per entity. Anything a client sends outside
// these keys is silently dropped before we hit Firestore — prevents clients
// from sneaking `isAdmin`, `clientId`, etc. into the doc via a crafted patch.
const BODY_WRITABLE_FIELDS = [
  'name',
  'tier',
  'cadence',
  'chair',
  'authority',
  'acceptedReportTypes',
  'standingItems',
  'colorHex',
  'cabinetMemberPortfolio',
  'stepSequence',
] as const;

const THRESHOLD_WRITABLE_FIELDS = [
  'bandLabel',
  'bandMin',
  'bandMax',
  'decisionRoute',
  'reportTypes',
  'notes',
] as const;

const TOR_WRITABLE_FIELDS = [
  'purpose',
  'scope',
  'authorityLevel',
  'decisionRights',
  'operatingPrinciples',
] as const;

function pickFields<T extends readonly string[]>(
  input: any,
  allowed: T,
): Record<string, any> {
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

function frameworkDoc(ctx: ApiContext) {
  return ctx.db.collection('frameworks').doc(ctx.primaryUid);
}

// Create the starter framework on first access. Runs inside a transaction
// so two simultaneous first-visits can't double-seed (check-then-write race).
async function seedIfMissing(ctx: ApiContext) {
  const fwRef = frameworkDoc(ctx);
  const thresholdsRefs = SEED_THRESHOLDS.map((t) =>
    fwRef.collection('thresholds').doc(t.id),
  );
  const bodyRefs = SEED_BODIES.map((b) =>
    ctx.db.collection('governanceBodies').doc(`${ctx.primaryUid}_${b.id}`),
  );

  await ctx.db.runTransaction(async (txn) => {
    const snap = await txn.get(fwRef);
    if (snap.exists) return;

    const ts = nowIso();
    txn.set(fwRef, {
      clientId: ctx.primaryUid,
      version: 1,
      status: 'draft',
      createdAt: ts,
      createdBy: ctx.uid,
      updatedAt: ts,
      seeded: true,
    });
    SEED_BODIES.forEach((body, i) => {
      txn.set(bodyRefs[i], {
        ...body,
        clientId: ctx.primaryUid,
        frameworkId: ctx.primaryUid,
        createdAt: ts,
        updatedAt: ts,
      });
    });
    SEED_THRESHOLDS.forEach((t, i) => {
      txn.set(thresholdsRefs[i], { ...t, createdAt: ts });
    });
  });
}

async function governanceGetFramework(_req: any, res: any, ctx: ApiContext) {
  try {
    await seedIfMissing(ctx);
    const fwSnap = await frameworkDoc(ctx).get();
    const framework = fwSnap.data() ?? null;

    const [bodiesSnap, thresholdsSnap] = await Promise.all([
      ctx.db
        .collection('governanceBodies')
        .where('clientId', '==', ctx.primaryUid)
        .get(),
      frameworkDoc(ctx).collection('thresholds').get(),
    ]);

    const bodies = bodiesSnap.docs.map((d) => ({ _id: d.id, ...d.data() }));

    // ToRs keyed by body. We fetch BOTH draft + published in one query so
    // the editor can load the in-progress draft (if any) while the status
    // badge can still show the "previously published" context.
    const torSnap = await ctx.db
      .collection('termsOfReference')
      .where('clientId', '==', ctx.primaryUid)
      .where('status', 'in', ['draft', 'published'])
      .get();

    // `torByBodyId` = active version per body: draft if one exists, else
    //                 the current published version.
    // `publishedByBodyId` = last published version per body (for badge
    //                      context when the active is a draft).
    const torByBodyId: Record<string, any> = {};
    const publishedByBodyId: Record<string, any> = {};
    for (const doc of torSnap.docs) {
      const data = { _id: doc.id, ...doc.data() } as any;
      const ownerId = data.ownerBodyId;
      if (!ownerId) continue;
      if (data.status === 'published') {
        publishedByBodyId[ownerId] = data;
      }
      const existing = torByBodyId[ownerId];
      // Prefer draft over published when both exist.
      if (
        !existing ||
        (data.status === 'draft' && existing.status === 'published')
      ) {
        torByBodyId[ownerId] = data;
      }
    }

    const thresholds = thresholdsSnap.docs.map((d) => ({ _id: d.id, ...d.data() }));

    return res.status(200).json({
      success: true,
      framework,
      bodies,
      thresholds,
      tors: torByBodyId,
      publishedTors: publishedByBodyId,
    });
  } catch (e: any) {
    console.error('[governanceGetFramework] failed:', e);
    return res.status(500).json({
      success: false,
      error: e?.message ?? 'Failed to load framework.',
      code: 'LOAD_FAILED',
    });
  }
}

async function governancePublishFramework(_req: any, res: any, ctx: ApiContext) {
  try {
    if (!ctx.isClientAdmin) {
      return res.status(403).json({
        success: false,
        error: 'Only Client Admin can publish the framework.',
        code: 'FORBIDDEN',
      });
    }
    const fwRef = frameworkDoc(ctx);

    // Pre-compute query refs outside the transaction. The transaction itself
    // reads framework + bodies + thresholds, then writes snapshot +
    // framework update — all atomic. Prevents two rapid Publish clicks
    // from racing on version numbering.
    const bodiesQuery = ctx.db
      .collection('governanceBodies')
      .where('clientId', '==', ctx.primaryUid);
    const thresholdsColl = fwRef.collection('thresholds');

    let prevFrameworkState: Record<string, any> | null = null;
    const nextVersion = await ctx.db.runTransaction(async (txn) => {
      const snap = await txn.get(fwRef);
      if (!snap.exists) {
        throw new Error('No draft framework to publish.');
      }
      const data = snap.data() ?? {};
      prevFrameworkState = data;
      const current = (data.version ?? 1) as number;
      const next = current + 1;

      const [bodiesSnap, thresholdsSnap] = await Promise.all([
        txn.get(bodiesQuery),
        txn.get(thresholdsColl),
      ]);

      // Preserve _id so future restore flows can round-trip.
      const bodies = bodiesSnap.docs.map((d) => ({ _id: d.id, ...d.data() }));
      const thresholds = thresholdsSnap.docs.map((d) => ({
        _id: d.id,
        ...d.data(),
      }));

      const versionRef = fwRef.collection('versions').doc(String(next));
      const ts = nowIso();
      txn.set(versionRef, {
        at: ts,
        by: ctx.uid,
        previousVersion: current,
        bodies,
        thresholds,
      });
      txn.set(
        fwRef,
        {
          version: next,
          status: 'published',
          publishedAt: ts,
          publishedBy: ctx.uid,
          updatedAt: ts,
        },
        { merge: true },
      );
      return next;
    });

    //  capture publish as a framework history row.
    const fwAfter = (await fwRef.get()).data() ?? null;
    captureFrameworkHistory(ctx, {
      prevState: prevFrameworkState,
      newState: fwAfter,
      changeKind: 'update',
    });
    await logActivity(ctx, 'framework_published', {
      category: 'approve',
      entityType: 'framework',
      entityName: 'Governance framework',
      details: { version: nextVersion },
    });
    return res.status(200).json({ success: true, version: nextVersion });
  } catch (e: any) {
    console.error('[governancePublishFramework] failed:', e);
    return res.status(500).json({
      success: false,
      error: e?.message ?? 'Publish failed.',
      code: 'PUBLISH_FAILED',
    });
  }
}

async function governanceUpsertBody(req: any, res: any, ctx: ApiContext) {
  try {
    if (!ctx.isClientAdmin) {
      return res.status(403).json({
        success: false,
        error: 'Only Client Admin can edit the framework.',
        code: 'FORBIDDEN',
      });
    }
    const { bodyId, patch } = req.body ?? {};
    if (!BODY_ID_RE.test(bodyId ?? '')) {
      return res.status(400).json({
        success: false,
        error: 'bodyId must be 1–80 chars: letters, digits, underscore, hyphen.',
        code: 'INVALID_INPUT',
      });
    }
    if (!patch || typeof patch !== 'object') {
      return res.status(400).json({
        success: false,
        error: 'patch object is required.',
        code: 'INVALID_INPUT',
      });
    }
    // Drop every field not in the allow-list before merging.
    const safePatch = pickFields(patch, BODY_WRITABLE_FIELDS);
    // Validate tier if provided.
    if (safePatch.tier && !['political', 'corporate', 'programme', 'project'].includes(safePatch.tier)) {
      return res.status(400).json({
        success: false,
        error: 'tier must be political | corporate | programme | project.',
        code: 'INVALID_INPUT',
      });
    }

    const docId = `${ctx.primaryUid}_${bodyId}`;
    const ref = ctx.db.collection('governanceBodies').doc(docId);
    const exists = (await ref.get()).exists;

    const payload: Record<string, any> = {
      ...safePatch,
      id: bodyId,
      clientId: ctx.primaryUid,
      frameworkId: ctx.primaryUid,
      updatedAt: nowIso(),
    };
    if (!exists) {
      payload.createdAt = nowIso();
      payload.createdBy = ctx.uid;
      if (safePatch.tier && !safePatch.colorHex) {
        payload.colorHex = TIER_COLOURS[safePatch.tier as BodyTier];
      }
    }
    await ref.set(payload, { merge: true });

    // Bump framework's updatedAt so UI knows there's unpublished change.
    const fwBefore = (await frameworkDoc(ctx).get()).data() ?? null;
    await frameworkDoc(ctx).set(
      { updatedAt: nowIso(), status: 'draft' },
      { merge: true },
    );

    const latest = (await ref.get()).data();
    //  body changes are framework changes; capture against
    // framework history so the timeline shows the body edit alongside
    // the framework's draft/published status flip.
    captureFrameworkHistory(ctx, {
      prevState: fwBefore,
      newState: { ...(fwBefore ?? {}), updatedAt: payload.updatedAt, status: 'draft', _bodyEdited: { bodyId, exists } },
      changeKind: exists ? 'update' : 'create',
    });
    await logActivity(ctx, exists ? 'governance_body_updated' : 'governance_body_created', {
      category: exists ? 'update' : 'create',
      entityType: 'governanceBody',
      entityId: bodyId,
      entityName: latest?.name || bodyId,
    });
    return res.status(200).json({ success: true, body: { _id: docId, ...latest } });
  } catch (e: any) {
    console.error('[governanceUpsertBody] failed:', e);
    return res.status(400).json({
      success: false,
      error: e?.message ?? 'Body save failed.',
      code: 'SAVE_FAILED',
    });
  }
}

async function governanceDeleteBody(req: any, res: any, ctx: ApiContext) {
  try {
    if (!ctx.isClientAdmin) {
      return res.status(403).json({
        success: false,
        error: 'Only Client Admin can edit the framework.',
        code: 'FORBIDDEN',
      });
    }
    const { bodyId } = req.body ?? {};
    if (!BODY_ID_RE.test(bodyId ?? '')) {
      return res.status(400).json({
        success: false,
        error: 'bodyId is required.',
        code: 'INVALID_INPUT',
      });
    }
    const docId = `${ctx.primaryUid}_${bodyId}`;
    const ref = ctx.db.collection('governanceBodies').doc(docId);
    const snap = await ref.get();
    if (!snap.exists) {
      return res.status(200).json({ success: true });
    }
    // Safety — never allow a cross-tenant delete through a crafted bodyId.
    if (snap.data()?.clientId !== ctx.primaryUid) {
      return res.status(403).json({
        success: false,
        error: 'Body belongs to another workspace.',
        code: 'FORBIDDEN',
      });
    }
    const bodyDataBefore = snap.data() ?? null;
    await ref.delete();
    const fwBefore = (await frameworkDoc(ctx).get()).data() ?? null;
    await frameworkDoc(ctx).set(
      { updatedAt: nowIso(), status: 'draft' },
      { merge: true },
    );
    captureFrameworkHistory(ctx, {
      prevState: fwBefore,
      newState: { ...(fwBefore ?? {}), status: 'draft', _bodyDeleted: { bodyId, body: bodyDataBefore } },
      changeKind: 'update',
    });
    await logActivity(ctx, 'governance_body_deleted', {
      category: 'delete',
      entityType: 'governanceBody',
      entityId: bodyId,
      entityName: bodyDataBefore?.name || bodyId,
    });
    return res.status(200).json({ success: true });
  } catch (e: any) {
    console.error('[governanceDeleteBody] failed:', e);
    return res.status(500).json({
      success: false,
      error: e?.message ?? 'Delete failed.',
      code: 'DELETE_FAILED',
    });
  }
}

async function governanceUpsertThreshold(req: any, res: any, ctx: ApiContext) {
  try {
    if (!ctx.isClientAdmin) {
      return res.status(403).json({
        success: false,
        error: 'Only Client Admin can edit the framework.',
        code: 'FORBIDDEN',
      });
    }
    const { thresholdId, patch } = req.body ?? {};
    if (!STAMP_LIKE_RE.test(thresholdId ?? '')) {
      return res.status(400).json({
        success: false,
        error: 'thresholdId must be 1–80 chars.',
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
    const safePatch = pickFields(patch, THRESHOLD_WRITABLE_FIELDS);
    // Sanity-check numeric bounds so the client can't stash strings in the
    // numeric fields and break the sort order.
    if ('bandMin' in safePatch && safePatch.bandMin != null && typeof safePatch.bandMin !== 'number') {
      return res.status(400).json({
        success: false,
        error: 'bandMin must be a number or null.',
        code: 'INVALID_INPUT',
      });
    }
    if ('bandMax' in safePatch && safePatch.bandMax != null && typeof safePatch.bandMax !== 'number') {
      return res.status(400).json({
        success: false,
        error: 'bandMax must be a number or null.',
        code: 'INVALID_INPUT',
      });
    }
    const ref = frameworkDoc(ctx).collection('thresholds').doc(thresholdId);
    const thresholdBefore = (await ref.get()).data() ?? null;
    await ref.set(
      { ...safePatch, id: thresholdId, updatedAt: nowIso() },
      { merge: true },
    );
    const fwBefore = (await frameworkDoc(ctx).get()).data() ?? null;
    await frameworkDoc(ctx).set(
      { updatedAt: nowIso(), status: 'draft' },
      { merge: true },
    );
    const latest = (await ref.get()).data();
    captureFrameworkHistory(ctx, {
      prevState: fwBefore,
      newState: { ...(fwBefore ?? {}), status: 'draft', _thresholdEdited: { thresholdId, was: thresholdBefore } },
      changeKind: thresholdBefore ? 'update' : 'create',
    });
    await logActivity(ctx, thresholdBefore ? 'authority_threshold_updated' : 'authority_threshold_created', {
      category: thresholdBefore ? 'update' : 'create',
      entityType: 'authorityThreshold',
      entityId: thresholdId,
      entityName: latest?.label || latest?.name || thresholdId,
    });
    return res.status(200).json({ success: true, threshold: { _id: thresholdId, ...latest } });
  } catch (e: any) {
    console.error('[governanceUpsertThreshold] failed:', e);
    return res.status(400).json({
      success: false,
      error: e?.message ?? 'Threshold save failed.',
      code: 'SAVE_FAILED',
    });
  }
}

async function governanceDeleteThreshold(req: any, res: any, ctx: ApiContext) {
  try {
    if (!ctx.isClientAdmin) {
      return res.status(403).json({
        success: false,
        error: 'Only Client Admin can edit the framework.',
        code: 'FORBIDDEN',
      });
    }
    const { thresholdId } = req.body ?? {};
    if (!STAMP_LIKE_RE.test(thresholdId ?? '')) {
      return res.status(400).json({
        success: false,
        error: 'thresholdId is required.',
        code: 'INVALID_INPUT',
      });
    }
    const tRef = frameworkDoc(ctx).collection('thresholds').doc(thresholdId);
    const thresholdBefore = (await tRef.get()).data() ?? null;
    await tRef.delete();
    const fwBefore = (await frameworkDoc(ctx).get()).data() ?? null;
    await frameworkDoc(ctx).set(
      { updatedAt: nowIso(), status: 'draft' },
      { merge: true },
    );
    captureFrameworkHistory(ctx, {
      prevState: fwBefore,
      newState: { ...(fwBefore ?? {}), status: 'draft', _thresholdDeleted: { thresholdId, was: thresholdBefore } },
      changeKind: 'update',
    });
    await logActivity(ctx, 'authority_threshold_deleted', {
      category: 'delete',
      entityType: 'authorityThreshold',
      entityId: thresholdId,
      entityName: thresholdBefore?.label || thresholdBefore?.name || thresholdId,
    });
    return res.status(200).json({ success: true });
  } catch (e: any) {
    console.error('[governanceDeleteThreshold] failed:', e);
    return res.status(500).json({
      success: false,
      error: e?.message ?? 'Delete failed.',
      code: 'DELETE_FAILED',
    });
  }
}

// ── Terms of Reference (versioned) ────────────────────────────────────────

async function governanceListToRVersions(req: any, res: any, ctx: ApiContext) {
  try {
    const { ownerBodyId } = req.body ?? {};
    if (!BODY_ID_RE.test(ownerBodyId ?? '')) {
      return res.status(400).json({
        success: false,
        error: 'ownerBodyId required.',
        code: 'INVALID_INPUT',
      });
    }
    const snap = await ctx.db
      .collection('termsOfReference')
      .where('clientId', '==', ctx.primaryUid)
      .where('ownerBodyId', '==', ownerBodyId)
      .get();
    const versions = snap.docs
      .map((d) => ({ _id: d.id, ...d.data() }))
      .sort((a: any, b: any) => (b.version ?? 0) - (a.version ?? 0));
    return res.status(200).json({ success: true, versions });
  } catch (e: any) {
    console.error('[governanceListToRVersions] failed:', e);
    return res.status(500).json({
      success: false,
      error: e?.message ?? 'List failed.',
      code: 'LOAD_FAILED',
    });
  }
}

async function governanceUpsertToR(req: any, res: any, ctx: ApiContext) {
  try {
    if (!ctx.isClientAdmin) {
      return res.status(403).json({
        success: false,
        error: 'Only Client Admin can edit ToR.',
        code: 'FORBIDDEN',
      });
    }
    const { ownerBodyId, patch, publish } = req.body ?? {};
    if (!BODY_ID_RE.test(ownerBodyId ?? '')) {
      return res.status(400).json({
        success: false,
        error: 'ownerBodyId required.',
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

    const safePatch = pickFields(patch, TOR_WRITABLE_FIELDS);
    const allVersionsQuery = ctx.db
      .collection('termsOfReference')
      .where('clientId', '==', ctx.primaryUid)
      .where('ownerBodyId', '==', ownerBodyId);

    // Read-then-write atomically so two rapid Publish clicks can't both land
    // on the same version number or both leave two `published` docs behind.
    const result = await ctx.db.runTransaction(async (txn) => {
      const allSnap = await txn.get(allVersionsQuery);

      let docRef;
      let version: number;
      let isNewDoc = false;
      const existingDraft = allSnap.docs.find((d) => d.data().status === 'draft');

      let prevTorState: Record<string, any> | null = null;
      if (existingDraft) {
        docRef = existingDraft.ref;
        version = (existingDraft.data().version ?? 0) as number;
        prevTorState = existingDraft.data() ?? null;
      } else {
        const maxVersion = allSnap.docs.reduce(
          (m, d) => Math.max(m, (d.data().version ?? 0) as number),
          0,
        );
        version = maxVersion + 1;
        docRef = ctx.db.collection('termsOfReference').doc();
        isNewDoc = true;
      }

      const ts = nowIso();
      const payload: Record<string, any> = {
        ...safePatch,
        ownerBodyId,
        clientId: ctx.primaryUid,
        version,
        status: publish ? 'published' : 'draft',
        updatedAt: ts,
        updatedBy: ctx.uid,
      };
      if (publish) {
        payload.publishedAt = ts;
        payload.publishedBy = ctx.uid;
      }
      if (isNewDoc) {
        payload.createdAt = ts;
      }
      txn.set(docRef, payload, { merge: true });

      // If publishing, supersede every OTHER currently-published version in
      // the same transaction so we never leave two `published` docs behind.
      if (publish) {
        for (const d of allSnap.docs) {
          if (d.id !== docRef.id && d.data().status === 'published') {
            txn.update(d.ref, { status: 'superseded', supersededAt: ts });
          }
        }
      }

      return { docId: docRef.id, payload, prevTorState, isNewDoc };
    });

    //  capture ToR mutation as a tor history row.
    captureTorHistory(ctx, {
      torId: result.docId,
      prevState: result.prevTorState,
      newState: result.payload,
      changeKind: result.isNewDoc ? 'create' : 'update',
    });

    await logActivity(ctx, result.isNewDoc ? 'tor_created' : 'tor_updated', {
      category: result.payload?.status === 'published' ? 'approve' : (result.isNewDoc ? 'create' : 'update'),
      entityType: 'termsOfReference',
      entityId: result.docId,
      entityName: result.payload?.title || result.payload?.name || result.docId,
      details: { status: result.payload?.status ?? null },
    });
    return res.status(200).json({
      success: true,
      tor: { _id: result.docId, ...result.payload },
    });
  } catch (e: any) {
    console.error('[governanceUpsertToR] failed:', e);
    return res.status(400).json({
      success: false,
      error: e?.message ?? 'ToR save failed.',
      code: 'SAVE_FAILED',
    });
  }
}

// ── Framework PDF exports ─────────────────────────────────────────────────

async function buildPdfInput(ctx: ApiContext): Promise<FrameworkPdfInput> {
  const fwRef = frameworkDoc(ctx);
  const [fwSnap, bodiesSnap, thresholdsSnap, torSnap, ownerSnap, logoDataUri] = await Promise.all([
    fwRef.get(),
    ctx.db
      .collection('governanceBodies')
      .where('clientId', '==', ctx.primaryUid)
      .get(),
    fwRef.collection('thresholds').get(),
    ctx.db
      .collection('termsOfReference')
      .where('clientId', '==', ctx.primaryUid)
      .where('status', '==', 'published')
      .get(),
    ctx.db.collection('users').doc(ctx.primaryUid).get(),
    readAssetAsDataUri(assetPaths.councilLogo(ctx.primaryUid)).catch(() => null),
  ]);

  const fw = fwSnap.data() ?? {};
  const bodies = bodiesSnap.docs.map((d) => d.data() as any);
  const thresholds = thresholdsSnap.docs.map((d) => d.data() as any);
  const tors: Record<string, any> = {};
  for (const d of torSnap.docs) {
    const data = d.data() as any;
    if (data.ownerBodyId) tors[data.ownerBodyId] = data;
  }
  const ownerData = ownerSnap.data() ?? {};
  const councilName =
    (ownerData.orgName as string) ||
    (ownerData.displayName as string) ||
    'Your council';

  return {
    councilName,
    version: (fw.version ?? 1) as number,
    publishedAt: (fw.publishedAt as string | undefined) ?? undefined,
    councilLogoDataUri: logoDataUri ?? null,
    bodies,
    thresholds,
    tors,
  };
}

async function governanceExportFrameworkDiagram(_req: any, res: any, ctx: ApiContext) {
  try {
    const input = await buildPdfInput(ctx);
    const buffer = renderFrameworkDiagram(input);
    return res.status(200).json({
      success: true,
      pdfBase64: buffer.toString('base64'),
      byteLength: buffer.byteLength,
      generatedAt: nowIso(),
      filename: `governance-framework-v${input.version}-diagram.pdf`,
    });
  } catch (e: any) {
    console.error('[governanceExportFrameworkDiagram] failed:', e);
    return res.status(500).json({
      success: false,
      error: e?.message ?? 'Diagram export failed.',
      code: 'EXPORT_FAILED',
    });
  }
}

async function governanceExportFrameworkConstitution(_req: any, res: any, ctx: ApiContext) {
  try {
    const input = await buildPdfInput(ctx);
    const buffer = renderFrameworkConstitution(input);
    return res.status(200).json({
      success: true,
      pdfBase64: buffer.toString('base64'),
      byteLength: buffer.byteLength,
      generatedAt: nowIso(),
      filename: `governance-framework-v${input.version}-constitution.pdf`,
    });
  } catch (e: any) {
    console.error('[governanceExportFrameworkConstitution] failed:', e);
    return res.status(500).json({
      success: false,
      error: e?.message ?? 'Constitution export failed.',
      code: 'EXPORT_FAILED',
    });
  }
}

export const governanceFrameworkRoutes: Record<string, any> = {
  governanceGetFramework,
  governancePublishFramework,
  governanceUpsertBody,
  governanceDeleteBody,
  governanceUpsertThreshold,
  governanceDeleteThreshold,
  governanceListToRVersions,
  governanceUpsertToR,
  governanceExportFrameworkDiagram,
  governanceExportFrameworkConstitution,
};

// Re-export seed constants so they can be imported by UI components that need
// tier labels/colours without reaching into the seed file directly.
export {
  TIER_COLOURS,
  type BodyTier,
  type SeedBody,
  type SeedThreshold,
} from '../lib/frameworkSeed.js';
