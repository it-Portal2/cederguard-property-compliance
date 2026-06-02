import { FieldValue } from 'firebase-admin/firestore';
import { ApiContext } from '../lib/context.js';
import { logActivity } from '../lib/activityLog.js';

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

        await logActivity(ctx, 'compliance_library_updated', {
          category: 'update',
          entityType: 'complianceLibraryItem',
          entityId: item.id,
          entityName: item.name || item.title || item.requirement || item.id,
          details: { adminAction: true },
        });
        return res.status(200).json({ success: true });
  },

  deleteComplianceLibraryItem: async (req, res, ctx) => {
    const { db, uid, email, userData, primaryUid, isAdmin, SYSTEM_ADMIN_EMAILS, isAuthorizedForContext } = ctx;
    const { id } = req.body;
        if (!id) return res.status(400).json({ error: 'Missing id' });

        if (!isAdmin) return res.status(403).json({ error: 'Forbidden: Admin access required' });

        const deletedLibItem = (await db.collection('compliance_library').doc(id).get()).data();
        await db.collection('compliance_library').doc(id).delete();
        await logActivity(ctx, 'compliance_library_deleted', {
          category: 'delete',
          entityType: 'complianceLibraryItem',
          entityId: id,
          entityName: deletedLibItem?.name || deletedLibItem?.title || id,
          details: { adminAction: true },
        });
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
