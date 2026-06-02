import { FieldValue } from 'firebase-admin/firestore';
import { ApiContext } from '../lib/context.js';
import { logActivity } from '../lib/activityLog.js';

export const programmeRoutes: Record<string, (req: any, res: any, ctx: ApiContext) => Promise<any>> = {
  updateProgramme: async (req, res, ctx) => {
    const { db, uid, email, isAuthorizedForContext } = ctx;
    const { id, data } = req.body;
    if (!id || !data) return res.status(400).json({ error: 'Missing id or data' });

    if (!(await isAuthorizedForContext(id))) {
      return res.status(403).json({ error: 'Forbidden: You do not have access to this programme.' });
    }

    await db.collection('programmes').doc(id).update({ ...data, updatedAt: FieldValue.serverTimestamp() });
    const progName = data?.name ?? (await db.collection('programmes').doc(id).get()).data()?.name ?? null;
    await logActivity(ctx, 'programme_updated', {
      category: 'update',
      entityType: 'programme',
      entityId: id,
      entityName: progName,
      details: { changedFields: Object.keys(data || {}) },
    });
    return res.status(200).json({ success: true });
  },

  deleteProgramme: async (req, res, ctx) => {
    const { db, uid, email, isAuthorizedForContext } = ctx;
    const { id } = req.body;
    if (!id) return res.status(400).json({ error: 'Missing id' });

    if (!(await isAuthorizedForContext(id))) {
      return res.status(403).json({ error: 'Forbidden: You do not have access to delete this programme.' });
    }

    const deletedProgName = (await db.collection('programmes').doc(id).get()).data()?.name ?? null;
    await db.collection('programmes').doc(id).delete();
    await logActivity(ctx, 'programme_deleted', {
      category: 'delete',
      entityType: 'programme',
      entityId: id,
      entityName: deletedProgName,
    });
    return res.status(200).json({ success: true });
  },

  getProgrammeById: async (req, res, ctx) => {
    const { db, isAuthorizedForContext } = ctx;
    const { id } = req.body;
    if (!id) return res.status(400).json({ error: 'Missing id' });

    if (!(await isAuthorizedForContext(id))) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const doc = await db.collection('programmes').doc(id).get();
    if (!doc.exists) return res.status(404).json({ error: 'Programme not found' });

    return res.status(200).json({ success: true, data: { id: doc.id, ...doc.data() } });
  }
};
