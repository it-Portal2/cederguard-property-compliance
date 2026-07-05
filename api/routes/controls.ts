import { FieldValue } from 'firebase-admin/firestore';
import { ApiContext } from '../lib/context.js';
import { logActivity } from '../lib/activityLog.js';
import { ROLE_STRINGS } from '../../shared/constants/roleConstants.js';

const CONTROLS = 'controls';

/** Edit gate: Client Admin / Super Admin (via isClientAdmin) + any PM-level role (PM+). */
function canManageControls(ctx: ApiContext): boolean {
  const role = ctx.userData?.role;
  return (
    ctx.isClientAdmin ||
    role === ROLE_STRINGS.PROGRAMME_MANAGER ||
    role === ROLE_STRINGS.PROJECT_MANAGER ||
    role === ROLE_STRINGS.SENIOR_PM ||
    role === ROLE_STRINGS.SENIOR_PROJECT_MANAGER ||
    role === ROLE_STRINGS.ASSISTANT_PM ||
    role === ROLE_STRINGS.PROJECT_COORDINATOR
  );
}

/** Whitelist + coerce the persisted shape so a client can't write clientId/createdAt or junk. */
function sanitizeControl(input: any) {
  const str = (v: any, max: number) => (v ? String(v).slice(0, max) : '');
  // Cap array length + element length so a write can't bloat the document.
  const arr = (v: any) =>
    (Array.isArray(v) ? v : [])
      .map((x) => String(x).slice(0, 200))
      .filter(Boolean)
      .slice(0, 500);
  return {
    title: String(input.title).trim().slice(0, 300),
    reference: str(input.reference, 100).trim(),
    description: str(input.description, 10000),
    owner: str(input.owner, 200),
    status: str(input.status, 50) || 'Not Tested',
    complianceGroup: str(input.complianceGroup, 50),
    projectId: input.projectId ? String(input.projectId) : null,
    programmeId: input.programmeId ? String(input.programmeId) : null,
    projectName: str(input.projectName, 300) || null,
    linkedRegulationIds: arr(input.linkedRegulationIds),
    linkedRiskIds: arr(input.linkedRiskIds),
    evidenceIds: arr(input.evidenceIds),
    origin: input.origin === 'ai-suggestion' ? 'ai-suggestion' : 'manual',
    sourceRiskId: input.sourceRiskId ? String(input.sourceRiskId).slice(0, 100) : null,
    lastReviewDate: input.lastReviewDate ? String(input.lastReviewDate).slice(0, 30) : null,
  };
}

export const controlsRoutes: Record<
  string,
  (req: any, res: any, ctx: ApiContext) => Promise<any>
> = {
  controlsList: async (_req, res, ctx) => {
    const { db, primaryUid } = ctx;
    const snap = await db
      .collection(CONTROLS)
      .where('clientId', '==', primaryUid)
      .get();
    const controls = snap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .sort((a: any, b: any) =>
        String(a.title || '').localeCompare(String(b.title || '')),
      );
    return res.status(200).json({ success: true, controls });
  },

  controlsUpsert: async (req, res, ctx) => {
    const { db, primaryUid } = ctx;
    if (!canManageControls(ctx)) {
      return res
        .status(403)
        .json({ error: 'Forbidden: insufficient role to edit controls.' });
    }
    const { control } = req.body || {};
    if (!control || !control.title || !String(control.title).trim()) {
      return res.status(400).json({ error: 'Missing control or control.title' });
    }

    const id: string = control.id || db.collection(CONTROLS).doc().id;
    const ref = db.collection(CONTROLS).doc(id);
    const existing = await ref.get();
    // Ownership guard: never let an upsert hijack another tenant's doc id.
    if (existing.exists && existing.data()?.clientId !== primaryUid) {
      return res
        .status(403)
        .json({ error: 'Forbidden: control belongs to another tenant.' });
    }

    const payload: any = {
      ...sanitizeControl(control),
      clientId: primaryUid,
      updatedAt: FieldValue.serverTimestamp(),
    };

    // A control may be tagged to a project/programme — only to one the caller can access.
    if (payload.projectId && !(await ctx.isAuthorizedForContext(payload.projectId))) {
      return res
        .status(403)
        .json({ error: 'Forbidden: not authorised for the tagged project.' });
    }
    if (payload.programmeId && !(await ctx.isAuthorizedForContext(payload.programmeId))) {
      return res
        .status(403)
        .json({ error: 'Forbidden: not authorised for the tagged programme.' });
    }
    if (!existing.exists) payload.createdAt = FieldValue.serverTimestamp();
    await ref.set(payload, { merge: true });

    await logActivity(ctx, existing.exists ? 'control_updated' : 'control_created', {
      category: existing.exists ? 'update' : 'create',
      entityType: 'control',
      entityId: id,
      entityName: payload.title,
    });
    return res.status(200).json({ success: true, id });
  },

  controlsDelete: async (req, res, ctx) => {
    const { db, primaryUid } = ctx;
    if (!canManageControls(ctx)) {
      return res
        .status(403)
        .json({ error: 'Forbidden: insufficient role to delete controls.' });
    }
    const { id } = req.body || {};
    if (!id) return res.status(400).json({ error: 'Missing id' });

    const ref = db.collection(CONTROLS).doc(id);
    const doc = await ref.get();
    if (!doc.exists) return res.status(404).json({ error: 'Control not found' });
    if (doc.data()?.clientId !== primaryUid) {
      return res
        .status(403)
        .json({ error: 'Forbidden: control belongs to another tenant.' });
    }
    const title = doc.data()?.title ?? null;
    await ref.delete();

    await logActivity(ctx, 'control_deleted', {
      category: 'delete',
      entityType: 'control',
      entityId: id,
      entityName: title,
    });
    return res.status(200).json({ success: true });
  },
};
