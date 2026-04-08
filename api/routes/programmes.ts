import { FieldValue } from 'firebase-admin/firestore';
import { ApiContext } from '../lib/context.js';

export const programmeRoutes: Record<string, (req: any, res: any, ctx: ApiContext) => Promise<any>> = {
  updateProgramme: async (req, res, ctx) => {
    const { db, uid, email, isAuthorizedForContext } = ctx;
    const { id, data } = req.body;
    if (!id || !data) return res.status(400).json({ error: 'Missing id or data' });

    if (!(await isAuthorizedForContext(id))) {
      return res.status(403).json({ error: 'Forbidden: You do not have access to this programme.' });
    }

    await db.collection('programmes').doc(id).update({ ...data, updatedAt: FieldValue.serverTimestamp() });
    db.collection('activityLogs').add({ type: 'programme_updated', uid, email, id, timestamp: new Date().toISOString() }).catch(console.error);
    return res.status(200).json({ success: true });
  },

  deleteProgramme: async (req, res, ctx) => {
    const { db, uid, email, isAuthorizedForContext } = ctx;
    const { id } = req.body;
    if (!id) return res.status(400).json({ error: 'Missing id' });

    if (!(await isAuthorizedForContext(id))) {
      return res.status(403).json({ error: 'Forbidden: You do not have access to delete this programme.' });
    }

    await db.collection('programmes').doc(id).delete();
    db.collection('activityLogs').add({ type: 'programme_deleted', uid, email, id, timestamp: new Date().toISOString() }).catch(console.error);
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
