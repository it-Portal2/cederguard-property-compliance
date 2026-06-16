import { FieldValue } from 'firebase-admin/firestore';
import { ApiContext } from '../lib/context.js';
import { logActivity } from '../lib/activityLog.js';
import { ROLE_STRINGS } from '../../shared/constants/roleConstants.js';
import { parseResourceSchemeXlsx } from '../lib/resourceSchemeXlsxImport.js';

function decodeBase64(b64: string): Buffer {
  return Buffer.from(String(b64).replace(/^data:.*;base64,/, ''), 'base64');
}

/**
 * Resource Planner — tenant-scoped persistence.
 *
 * Schemes + the assumptions doc are scoped to the org by `clientId === ctx.primaryUid`
 * (the same tenant key the TAC / programmes routes use). View = any authenticated user
 * in the tenant. Edit/create/delete + assumptions = Client Admin / Programme Manager /
 * Super Admin only (client answer 16). All writes `logActivity` awaited before the response.
 */

const SCHEMES = 'resourceSchemes';
const ASSUMPTIONS = 'resourceAssumptions';

/** Edit gate: Super Admin / Client Admin / Enterprise (via isClientAdmin) + Programme Manager. */
function canManageRP(ctx: ApiContext): boolean {
  return (
    ctx.isClientAdmin ||
    ctx.userData?.role === ROLE_STRINGS.PROGRAMME_MANAGER
  );
}

export const resourcePlannerRoutes: Record<
  string,
  (req: any, res: any, ctx: ApiContext) => Promise<any>
> = {
  // ---- Schemes ----------------------------------------------------------------
  resourceListSchemes: async (_req, res, ctx) => {
    const { db, primaryUid } = ctx;
    const snap = await db
      .collection(SCHEMES)
      .where('clientId', '==', primaryUid)
      .get();
    const schemes = snap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .sort((a: any, b: any) => String(a.name || '').localeCompare(String(b.name || '')));
    return res.status(200).json({ success: true, schemes });
  },

  resourceUpsertScheme: async (req, res, ctx) => {
    const { db, primaryUid } = ctx;
    if (!canManageRP(ctx)) {
      return res.status(403).json({ error: 'Forbidden: insufficient role to edit schemes.' });
    }
    const { scheme } = req.body || {};
    if (!scheme || !scheme.name) {
      return res.status(400).json({ error: 'Missing scheme or scheme.name' });
    }

    const id: string = scheme.id || db.collection(SCHEMES).doc().id;
    const ref = db.collection(SCHEMES).doc(id);
    const existing = await ref.get();
    // Ownership guard: never let an upsert hijack another tenant's doc id.
    if (existing.exists && existing.data()?.clientId !== primaryUid) {
      return res.status(403).json({ error: 'Forbidden: scheme belongs to another tenant.' });
    }

    const { id: _omit, ...fields } = scheme;
    const payload: any = {
      ...fields,
      clientId: primaryUid,
      updatedAt: FieldValue.serverTimestamp(),
    };
    if (!existing.exists) payload.createdAt = FieldValue.serverTimestamp();
    await ref.set(payload, { merge: true });

    await logActivity(ctx, existing.exists ? 'resource_scheme_updated' : 'resource_scheme_created', {
      category: existing.exists ? 'update' : 'create',
      entityType: 'resource_scheme',
      entityId: id,
      entityName: scheme.name,
    });
    return res.status(200).json({ success: true, id });
  },

  resourceDeleteScheme: async (req, res, ctx) => {
    const { db, primaryUid } = ctx;
    if (!canManageRP(ctx)) {
      return res.status(403).json({ error: 'Forbidden: insufficient role to delete schemes.' });
    }
    const { id } = req.body || {};
    if (!id) return res.status(400).json({ error: 'Missing id' });

    const ref = db.collection(SCHEMES).doc(id);
    const doc = await ref.get();
    if (!doc.exists) return res.status(404).json({ error: 'Scheme not found' });
    if (doc.data()?.clientId !== primaryUid) {
      return res.status(403).json({ error: 'Forbidden: scheme belongs to another tenant.' });
    }
    const name = doc.data()?.name ?? null;
    await ref.delete();

    await logActivity(ctx, 'resource_scheme_deleted', {
      category: 'delete',
      entityType: 'resource_scheme',
      entityId: id,
      entityName: name,
    });
    return res.status(200).json({ success: true });
  },

  // ---- Assumptions (one doc per tenant) --------------------------------------
  resourceGetAssumptions: async (_req, res, ctx) => {
    const { db, primaryUid } = ctx;
    const doc = await db.collection(ASSUMPTIONS).doc(primaryUid).get();
    return res.status(200).json({
      success: true,
      assumptions: doc.exists ? doc.data()?.assumptions ?? null : null,
    });
  },

  resourceSaveAssumptions: async (req, res, ctx) => {
    const { db, primaryUid } = ctx;
    if (!canManageRP(ctx)) {
      return res.status(403).json({ error: 'Forbidden: insufficient role to edit assumptions.' });
    }
    const { assumptions } = req.body || {};
    if (!assumptions) return res.status(400).json({ error: 'Missing assumptions' });

    await db.collection(ASSUMPTIONS).doc(primaryUid).set(
      { assumptions, clientId: primaryUid, updatedAt: FieldValue.serverTimestamp() },
      { merge: true },
    );

    await logActivity(ctx, 'resource_assumptions_saved', {
      category: 'update',
      entityType: 'resource_assumptions',
      entityId: primaryUid,
      entityName: 'Resource Planner assumptions',
    });
    return res.status(200).json({ success: true });
  },

  // ---- Excel import (dry-run preview, then commit) ---------------------------
  resourceImportSchemesDryRun: async (req, res, ctx) => {
    if (!canManageRP(ctx)) {
      return res.status(403).json({ error: 'Forbidden: insufficient role to import schemes.' });
    }
    const { base64 } = req.body || {};
    if (!base64) return res.status(400).json({ error: 'Missing base64 file payload' });
    try {
      const { rows, summary } = parseResourceSchemeXlsx(decodeBase64(base64));
      return res.status(200).json({ success: true, rows, summary });
    } catch (e: any) {
      return res.status(400).json({ error: `Could not read spreadsheet: ${e?.message || e}` });
    }
  },

  resourceImportSchemesCommit: async (req, res, ctx) => {
    const { db, primaryUid } = ctx;
    if (!canManageRP(ctx)) {
      return res.status(403).json({ error: 'Forbidden: insufficient role to import schemes.' });
    }
    const { base64 } = req.body || {};
    if (!base64) return res.status(400).json({ error: 'Missing base64 file payload' });

    let parsed;
    try {
      parsed = parseResourceSchemeXlsx(decodeBase64(base64));
    } catch (e: any) {
      return res.status(400).json({ error: `Could not read spreadsheet: ${e?.message || e}` });
    }

    // Only commit rows without errors (blank-name rows are skipped).
    const commitable = parsed.rows.filter(
      (r) => !r.flags.some((f) => f.severity === 'error'),
    );

    let written = 0;
    for (let i = 0; i < commitable.length; i += 400) {
      const chunk = commitable.slice(i, i + 400);
      const batch = db.batch();
      for (const row of chunk) {
        const { id, ...fields } = row.item;
        const ref = db.collection(SCHEMES).doc(id);
        batch.set(ref, {
          ...fields,
          clientId: primaryUid,
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        });
        written += 1;
      }
      await batch.commit();
    }

    await logActivity(ctx, 'resource_schemes_imported', {
      category: 'create',
      entityType: 'resource_scheme',
      entityId: primaryUid,
      entityName: `${written} scheme(s) imported`,
      details: {
        written,
        skipped: parsed.rows.length - written,
        total: parsed.summary.totalRows,
      },
    });
    return res.status(200).json({ success: true, written, skipped: parsed.rows.length - written });
  },
};
