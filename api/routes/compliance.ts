import { FieldValue } from 'firebase-admin/firestore';
import { ApiContext } from '../lib/context.js';

export const complianceRoutes: Record<string, (req: any, res: any, ctx: ApiContext) => Promise<any>> = {
  getComplianceLibrary: async (req, res, ctx) => {
    const { db, uid, email, userData, primaryUid, SYSTEM_ADMIN_EMAILS, isAuthorizedForContext, getAuthService, getMessagingService } = ctx;
    const snap = await db.collection('compliance_library').get();
        const library = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        return res.status(200).json({ success: true, library });
  },

  upsertComplianceLibraryItem: async (req, res, ctx) => {
    const { db, uid, email, userData, primaryUid, isAdmin, SYSTEM_ADMIN_EMAILS, isAuthorizedForContext } = ctx;
    const { item } = req.body;
        if (!item || !item.id) return res.status(400).json({ error: 'Missing item or id' });

        if (!isAdmin) return res.status(403).json({ error: 'Forbidden: Admin access required' });

        await db.collection('compliance_library').doc(item.id).set({
          ...item,
          updatedAt: FieldValue.serverTimestamp(),
          updatedBy: email
        }, { merge: true });

        db.collection('activityLogs').add({ type: 'compliance_library_updated', uid, email, itemId: item.id, timestamp: new Date().toISOString() }).catch(console.error);
        return res.status(200).json({ success: true });
  },

  deleteComplianceLibraryItem: async (req, res, ctx) => {
    const { db, uid, email, userData, primaryUid, isAdmin, SYSTEM_ADMIN_EMAILS, isAuthorizedForContext } = ctx;
    const { id } = req.body;
        if (!id) return res.status(400).json({ error: 'Missing id' });

        if (!isAdmin) return res.status(403).json({ error: 'Forbidden: Admin access required' });

        await db.collection('compliance_library').doc(id).delete();
        db.collection('activityLogs').add({ type: 'compliance_library_deleted', uid, email, itemId: id, timestamp: new Date().toISOString() }).catch(console.error);
        return res.status(200).json({ success: true });
  },

  getComplianceDomains: async (req, res, ctx) => {
    const { db, uid, email, userData, primaryUid, SYSTEM_ADMIN_EMAILS, isAuthorizedForContext, getAuthService, getMessagingService } = ctx;
    const snap = await db.collection('compliance_domains').orderBy('label', 'asc').get();
        const domains = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        return res.status(200).json({ success: true, domains });
  },

  upsertComplianceDomain: async (req, res, ctx) => {
    const { db, uid, email, isAdmin } = ctx;
    const { domain } = req.body;
    if (!domain || !domain.id) return res.status(400).json({ error: 'Missing domain or id' });

    if (!isAdmin) return res.status(403).json({ error: 'Forbidden: Admin access required' });

    await db.collection('compliance_domains').doc(domain.id).set({
      ...domain,
      updatedAt: FieldValue.serverTimestamp()
    });

    return res.status(200).json({ success: true });
  },
};
