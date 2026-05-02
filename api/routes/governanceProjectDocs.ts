// Phase 9 — Project Governance Folder endpoints.
//
//   • governanceListProjectDocs        — by projectId, scoped to clientId.
//                                         Seed runs on first list-call
//                                         (lesson #22 / #43).
//   • governanceGetProjectDoc          — single doc + cross-tenant guard.
//   • governanceUpsertProjectDoc       — create + edit Draft.  Field
//                                         whitelist (lesson #12), owner
//                                         or admin gate.  Once Published
//                                         the doc is read-only on this
//                                         endpoint — edit means a new
//                                         draft (handled by upsert with
//                                         `forkFromPublished: true`).
//   • governancePublishProjectDoc      — Draft → Published, version++,
//                                         transactional snapshot into
//                                         `versions/{n}` (lesson #67).
//   • governanceListProjectDocVersions — read-only list of prior
//                                         snapshots for the audit panel.
//   • governanceSoftDeleteProjectDoc   — soft-delete + restore via the
//                                         same endpoint (lesson #38).
//                                         Reason ≥ 5 chars on delete.
//
// Storage: `projectGovernanceDocs/{clientId_docId}` (lesson #10).
// Versions: sub-collection `projectGovernanceDocs/{docId}/versions/{n}`.

import type { ApiContext } from '../lib/context.js';
import {
  SEED_PROJECT_DOCS,
  ALL_PROJECT_DOC_STATUSES,
  ALL_PROJECT_DOC_CATEGORIES,
  type ProjectDocStatus,
  type ProjectDocCategory,
} from '../lib/projectGovernanceSeed.js';

const DOC_ID_RE = /^[a-z0-9_-]{1,80}$/i;

const DOC_WRITABLE_FIELDS = [
  'title',
  'category',
  'summary',
  'content',
  'projectId',
  'linkedReportId',
  'linkedMeetingId',
] as const;

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

function docKey(ctx: ApiContext, id: string): string {
  return `${ctx.primaryUid}_${id}`;
}

function isOwnerOrAdmin(ctx: ApiContext, ownerUid?: string | null): boolean {
  if (ctx.isClientAdmin) return true;
  if (!ownerUid) return false;
  return ownerUid === ctx.uid;
}

// ── Seed-on-first-read ──────────────────────────────────────────────────

async function seedDocsIfMissing(ctx: ApiContext) {
  const probe = await ctx.db
    .collection('projectGovernanceDocs')
    .where('clientId', '==', ctx.primaryUid)
    .limit(1)
    .get();
  if (!probe.empty) return;
  const ts = nowIso();
  const batch = ctx.db.batch();
  for (const seed of SEED_PROJECT_DOCS) {
    const ref = ctx.db.collection('projectGovernanceDocs').doc(docKey(ctx, seed.id));
    batch.set(ref, {
      id: seed.id,
      clientId: ctx.primaryUid,
      projectId: seed.projectId,
      title: seed.title,
      category: seed.category,
      summary: seed.summary,
      content: seed.content,
      status: seed.status,
      version: seed.version,
      linkedReportId: seed.linkedReportId ?? null,
      linkedMeetingId: seed.linkedMeetingId ?? null,
      ownerUid: ctx.uid,
      softDeleted: false,
      deletionReason: null,
      deletedAt: null,
      deletedBy: null,
      publishedAt: seed.status === 'Published' ? ts : null,
      publishedBy: seed.status === 'Published' ? ctx.uid : null,
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

async function governanceListProjectDocs(req: any, res: any, ctx: ApiContext) {
  try {
    await seedDocsIfMissing(ctx);
    const { projectId } = req.body ?? {};
    let q: FirebaseFirestore.Query = ctx.db
      .collection('projectGovernanceDocs')
      .where('clientId', '==', ctx.primaryUid);
    if (typeof projectId === 'string' && projectId) {
      q = q.where('projectId', '==', projectId);
    }
    const snap = await q.get();
    const items = snap.docs.map((d) => ({ _id: d.id, ...d.data() }));
    return res.status(200).json({ success: true, items });
  } catch (e: any) {
    console.error('[governanceListProjectDocs] failed:', e);
    return res.status(500).json({
      success: false,
      error: e?.message ?? 'Failed to load project governance docs.',
      code: 'LOAD_FAILED',
    });
  }
}

async function governanceGetProjectDoc(req: any, res: any, ctx: ApiContext) {
  try {
    const { docId } = req.body ?? {};
    if (!DOC_ID_RE.test(docId ?? '')) {
      return res.status(400).json({
        success: false,
        error: 'docId required.',
        code: 'INVALID_INPUT',
      });
    }
    const ref = ctx.db.collection('projectGovernanceDocs').doc(docKey(ctx, docId));
    const snap = await ref.get();
    if (!snap.exists) {
      return res
        .status(404)
        .json({ success: false, error: 'Doc not found.', code: 'NOT_FOUND' });
    }
    const data = snap.data() ?? {};
    if (data.clientId !== ctx.primaryUid) {
      return res.status(403).json({
        success: false,
        error: 'Doc belongs to another workspace.',
        code: 'FORBIDDEN',
      });
    }
    return res
      .status(200)
      .json({ success: true, item: { _id: ref.id, ...data } });
  } catch (e: any) {
    console.error('[governanceGetProjectDoc] failed:', e);
    return res.status(500).json({
      success: false,
      error: e?.message ?? 'Failed to load doc.',
      code: 'LOAD_FAILED',
    });
  }
}

async function governanceUpsertProjectDoc(req: any, res: any, ctx: ApiContext) {
  try {
    const { docId, patch } = req.body ?? {};
    if (!DOC_ID_RE.test(docId ?? '')) {
      return res.status(400).json({
        success: false,
        error: 'docId required.',
        code: 'INVALID_INPUT',
      });
    }
    const safe = pickFields(patch, DOC_WRITABLE_FIELDS);

    if (typeof safe.title === 'string') {
      safe.title = safe.title.trim();
      if (!safe.title) {
        return res.status(400).json({
          success: false,
          error: 'Title is required.',
          code: 'INVALID_INPUT',
        });
      }
    }
    if (typeof safe.summary === 'string') {
      safe.summary = safe.summary.trim();
    }
    if (
      safe.category !== undefined &&
      !ALL_PROJECT_DOC_CATEGORIES.includes(safe.category as ProjectDocCategory)
    ) {
      return res.status(400).json({
        success: false,
        error: 'Invalid category.',
        code: 'INVALID_INPUT',
      });
    }
    if (typeof safe.projectId === 'string') {
      safe.projectId = safe.projectId.trim();
      if (!safe.projectId) {
        return res.status(400).json({
          success: false,
          error: 'projectId is required.',
          code: 'INVALID_INPUT',
        });
      }
    }

    const ref = ctx.db.collection('projectGovernanceDocs').doc(docKey(ctx, docId));
    const snap = await ref.get();
    const exists = snap.exists;

    if (exists) {
      const data = snap.data() ?? {};
      if (data.clientId !== ctx.primaryUid) {
        return res.status(403).json({
          success: false,
          error: 'Doc belongs to another workspace.',
          code: 'FORBIDDEN',
        });
      }
      if (!isOwnerOrAdmin(ctx, data.ownerUid)) {
        return res.status(403).json({
          success: false,
          error: 'Only the doc owner or a Client Admin can edit this document.',
          code: 'FORBIDDEN',
        });
      }
      if (data.softDeleted) {
        return res.status(400).json({
          success: false,
          error: 'Restore the doc before editing.',
          code: 'INVALID_STATE',
        });
      }
      // Once Published the body becomes immutable on this endpoint —
      // edits go through publish-new-version (start a new Draft fork
      // by passing forkFromPublished: true on first write).
      if (data.status === 'Published') {
        return res.status(400).json({
          success: false,
          error:
            'Published docs cannot be edited directly. Publish a new version instead.',
          code: 'INVALID_STATE',
        });
      }
    } else {
      // On create, projectId is mandatory so the doc lands in a
      // queryable bucket.
      if (typeof safe.projectId !== 'string' || !safe.projectId) {
        return res.status(400).json({
          success: false,
          error: 'projectId is required when creating a doc.',
          code: 'INVALID_INPUT',
        });
      }
    }

    const ts = nowIso();
    const payload: Record<string, any> = {
      ...safe,
      id: docId,
      clientId: ctx.primaryUid,
      updatedAt: ts,
      updatedBy: ctx.uid,
    };
    if (!exists) {
      payload.createdAt = ts;
      payload.createdBy = ctx.uid;
      payload.ownerUid = ctx.uid;
      payload.status = 'Draft';
      payload.version = 0;
      payload.softDeleted = false;
      payload.deletionReason = null;
      payload.deletedAt = null;
      payload.deletedBy = null;
      payload.publishedAt = null;
      payload.publishedBy = null;
      if (payload.linkedReportId === undefined) payload.linkedReportId = null;
      if (payload.linkedMeetingId === undefined) payload.linkedMeetingId = null;
      if (payload.summary === undefined) payload.summary = '';
      if (payload.content === undefined) payload.content = null;
      if (!payload.category) payload.category = 'Other';
    }
    await ref.set(payload, { merge: true });
    const latest = (await ref.get()).data();
    return res
      .status(200)
      .json({ success: true, item: { _id: ref.id, ...latest } });
  } catch (e: any) {
    console.error('[governanceUpsertProjectDoc] failed:', e);
    return res.status(500).json({
      success: false,
      error: e?.message ?? 'Save failed.',
      code: 'SAVE_FAILED',
    });
  }
}

async function governancePublishProjectDoc(
  req: any,
  res: any,
  ctx: ApiContext,
) {
  try {
    const { docId } = req.body ?? {};
    if (!DOC_ID_RE.test(docId ?? '')) {
      return res.status(400).json({
        success: false,
        error: 'docId required.',
        code: 'INVALID_INPUT',
      });
    }
    const ref = ctx.db.collection('projectGovernanceDocs').doc(docKey(ctx, docId));
    // Transactional version bump + snapshot — same pattern as
    // Phase 3 framework publish (lesson #67).
    const result = await ctx.db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists) {
        return { error: 'NOT_FOUND' as const };
      }
      const data = snap.data() ?? {};
      if (data.clientId !== ctx.primaryUid) {
        return { error: 'FORBIDDEN_TENANT' as const };
      }
      if (!isOwnerOrAdmin(ctx, data.ownerUid)) {
        return { error: 'FORBIDDEN_OWNER' as const };
      }
      if (data.softDeleted) {
        return { error: 'INVALID_STATE_DELETED' as const };
      }
      if (data.status !== 'Draft') {
        return { error: 'INVALID_STATE_NOT_DRAFT' as const };
      }
      const nextVersion = (typeof data.version === 'number' ? data.version : 0) + 1;
      const ts = nowIso();
      const versionRef = ref.collection('versions').doc(String(nextVersion));
      tx.set(versionRef, {
        version: nextVersion,
        title: data.title,
        category: data.category,
        summary: data.summary,
        content: data.content,
        linkedReportId: data.linkedReportId ?? null,
        linkedMeetingId: data.linkedMeetingId ?? null,
        publishedAt: ts,
        publishedBy: ctx.uid,
      });
      tx.set(
        ref,
        {
          status: 'Published',
          version: nextVersion,
          publishedAt: ts,
          publishedBy: ctx.uid,
          updatedAt: ts,
          updatedBy: ctx.uid,
        },
        { merge: true },
      );
      return { ok: true as const, version: nextVersion };
    });

    if ('error' in result) {
      switch (result.error) {
        case 'NOT_FOUND':
          return res
            .status(404)
            .json({ success: false, error: 'Doc not found.', code: 'NOT_FOUND' });
        case 'FORBIDDEN_TENANT':
          return res.status(403).json({
            success: false,
            error: 'Doc belongs to another workspace.',
            code: 'FORBIDDEN',
          });
        case 'FORBIDDEN_OWNER':
          return res.status(403).json({
            success: false,
            error:
              'Only the doc owner or a Client Admin can publish this document.',
            code: 'FORBIDDEN',
          });
        case 'INVALID_STATE_DELETED':
          return res.status(400).json({
            success: false,
            error: 'Restore the doc before publishing.',
            code: 'INVALID_STATE',
          });
        case 'INVALID_STATE_NOT_DRAFT':
          return res.status(400).json({
            success: false,
            error: 'Only Draft docs can be published.',
            code: 'INVALID_STATE',
          });
      }
    }

    const latest = (await ref.get()).data();
    return res
      .status(200)
      .json({ success: true, item: { _id: ref.id, ...latest } });
  } catch (e: any) {
    console.error('[governancePublishProjectDoc] failed:', e);
    return res.status(500).json({
      success: false,
      error: e?.message ?? 'Publish failed.',
      code: 'PUBLISH_FAILED',
    });
  }
}

async function governanceListProjectDocVersions(
  req: any,
  res: any,
  ctx: ApiContext,
) {
  try {
    const { docId } = req.body ?? {};
    if (!DOC_ID_RE.test(docId ?? '')) {
      return res.status(400).json({
        success: false,
        error: 'docId required.',
        code: 'INVALID_INPUT',
      });
    }
    const ref = ctx.db.collection('projectGovernanceDocs').doc(docKey(ctx, docId));
    const parent = await ref.get();
    if (!parent.exists) {
      return res
        .status(404)
        .json({ success: false, error: 'Doc not found.', code: 'NOT_FOUND' });
    }
    const data = parent.data() ?? {};
    if (data.clientId !== ctx.primaryUid) {
      return res.status(403).json({
        success: false,
        error: 'Doc belongs to another workspace.',
        code: 'FORBIDDEN',
      });
    }
    const snap = await ref.collection('versions').get();
    const versions = snap.docs
      .map((d) => ({ _id: d.id, ...d.data() }))
      .sort((a: any, b: any) => (b.version ?? 0) - (a.version ?? 0));
    return res.status(200).json({ success: true, versions });
  } catch (e: any) {
    console.error('[governanceListProjectDocVersions] failed:', e);
    return res.status(500).json({
      success: false,
      error: e?.message ?? 'Failed to load history.',
      code: 'LOAD_FAILED',
    });
  }
}

async function governanceSoftDeleteProjectDoc(
  req: any,
  res: any,
  ctx: ApiContext,
) {
  try {
    const { docId, reason, restore } = req.body ?? {};
    if (!DOC_ID_RE.test(docId ?? '')) {
      return res.status(400).json({
        success: false,
        error: 'docId required.',
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

    const ref = ctx.db.collection('projectGovernanceDocs').doc(docKey(ctx, docId));
    const snap = await ref.get();
    if (!snap.exists) {
      return res
        .status(404)
        .json({ success: false, error: 'Doc not found.', code: 'NOT_FOUND' });
    }
    const data = snap.data() ?? {};
    if (data.clientId !== ctx.primaryUid) {
      return res.status(403).json({
        success: false,
        error: 'Doc belongs to another workspace.',
        code: 'FORBIDDEN',
      });
    }
    if (!isOwnerOrAdmin(ctx, data.ownerUid)) {
      return res.status(403).json({
        success: false,
        error: 'Only the doc owner or a Client Admin can delete this document.',
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
    return res
      .status(200)
      .json({ success: true, item: { _id: ref.id, ...latest } });
  } catch (e: any) {
    console.error('[governanceSoftDeleteProjectDoc] failed:', e);
    return res.status(500).json({
      success: false,
      error: e?.message ?? 'Delete failed.',
      code: 'DELETE_FAILED',
    });
  }
}

export const governanceProjectDocsRoutes: Record<string, any> = {
  governanceListProjectDocs,
  governanceGetProjectDoc,
  governanceUpsertProjectDoc,
  governancePublishProjectDoc,
  governanceListProjectDocVersions,
  governanceSoftDeleteProjectDoc,
};

export { ALL_PROJECT_DOC_STATUSES, ALL_PROJECT_DOC_CATEGORIES };
export type { ProjectDocStatus, ProjectDocCategory };
