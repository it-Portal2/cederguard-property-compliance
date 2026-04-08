import { FieldValue } from 'firebase-admin/firestore';
import { ApiContext } from '../lib/context.js';
import crypto from 'crypto';

export const adminRoutes: Record<string, (req: any, res: any, ctx: ApiContext) => Promise<any>> = {
  adminDeleteProject: async (req, res, ctx) => {
    const { db, uid, email, primaryUid, isClientAdmin, isAdmin } = ctx;
    const { id } = req.body;

    if (!isClientAdmin) return res.status(403).json({ error: 'Forbidden: Client Admin role required.' });
    if (!id) return res.status(400).json({ error: 'Missing id' });

    const projectDoc = await db.collection('projects').doc(id).get();
    if (!projectDoc.exists) return res.status(404).json({ error: 'Project not found' });
    
    const projectData = projectDoc.data() || {};
    if (projectData.clientId !== primaryUid && !isAdmin) {
        return res.status(403).json({ error: 'Forbidden: Resource belongs to another organization.' });
    }

    await db.collection('projects').doc(id).delete();
    db.collection('activityLogs').add({ type: 'admin_project_deleted', uid, email, projectId: id, timestamp: new Date().toISOString() }).catch(console.error);
    return res.status(200).json({ success: true });
  },

  adminDeleteProgramme: async (req, res, ctx) => {
    const { db, uid, email, primaryUid, isClientAdmin, isAdmin } = ctx;
    const { id } = req.body;

    if (!isClientAdmin) return res.status(403).json({ error: 'Forbidden: Client Admin role required.' });
    if (!id) return res.status(400).json({ error: 'Missing id' });

    const progDoc = await db.collection('programmes').doc(id).get();
    if (!progDoc.exists) return res.status(404).json({ error: 'Programme not found' });
    
    const progData = progDoc.data() || {};
    if (progData.clientId !== primaryUid && !isAdmin) {
        return res.status(403).json({ error: 'Forbidden: Resource belongs to another organization.' });
    }

    await db.collection('programmes').doc(id).delete();
    db.collection('activityLogs').add({ type: 'admin_programme_deleted', uid, email, id, timestamp: new Date().toISOString() }).catch(console.error);
    return res.status(200).json({ success: true });
  },

  adminTransferProject: async (req, res, ctx) => {
    const { db, uid, email, primaryUid, isClientAdmin, isAdmin } = ctx;
    const { id, targetUser } = req.body;
    if (!id || !targetUser?.uid) return res.status(400).json({ error: 'Missing project id or target user' });

    if (!isClientAdmin) return res.status(403).json({ error: 'Forbidden: Client Admin role required.' });

    const projectDoc = await db.collection('projects').doc(id).get();
    if (!projectDoc.exists) return res.status(404).json({ error: 'Project not found' });
    
    const projectData = projectDoc.data() || {};
    if (projectData.clientId !== primaryUid && !isAdmin) {
        return res.status(403).json({ error: 'Forbidden: Resource belongs to another organization.' });
    }

    await db.collection('projects').doc(id).update({
      userId: targetUser.uid,
      pm: targetUser.email || projectData.pm,
      pmName: targetUser.displayName || targetUser.email || projectData.pmName,
      updatedAt: FieldValue.serverTimestamp()
    });

    db.collection('activityLogs').add({ 
        type: 'admin_project_transferred', 
        uid, email, 
        projectId: id, 
        targetUid: targetUser.uid,
        timestamp: new Date().toISOString() 
    }).catch(console.error);
    
    return res.status(200).json({ success: true });
  },

  adminTransferProgramme: async (req, res, ctx) => {
    const { db, uid, email, primaryUid, isClientAdmin, isAdmin } = ctx;
    const { id, targetUser } = req.body;
    if (!id || !targetUser?.uid) return res.status(400).json({ error: 'Missing programme id or target user' });

    if (!isClientAdmin) return res.status(403).json({ error: 'Forbidden: Client Admin role required.' });

    const progDoc = await db.collection('programmes').doc(id).get();
    if (!progDoc.exists) return res.status(404).json({ error: 'Programme not found' });
    
    const progData = progDoc.data() || {};
    if (progData.clientId !== primaryUid && !isAdmin) {
        return res.status(403).json({ error: 'Forbidden: Resource belongs to another organization.' });
    }

    await db.collection('programmes').doc(id).update({
      userId: targetUser.uid,
      pm: targetUser.email || progData.pm,
      updatedAt: FieldValue.serverTimestamp()
    });

    db.collection('activityLogs').add({ 
        type: 'admin_programme_transferred', 
        uid, email, 
        id, 
        targetUid: targetUser.uid,
        timestamp: new Date().toISOString() 
    }).catch(console.error);
    
    return res.status(200).json({ success: true });
  },

  adminStats: async (req, res, ctx) => {
    const { db, isAdmin } = ctx;
    if (!isAdmin) return res.status(403).json({ error: 'Forbidden' });

    try {
      const fetchCount = async (coll: string) => {
        try {
          const snap = await db.collection(coll).count().get();
          return snap.data().count;
        } catch (e) {
          console.error(`Count failed for ${coll}:`, e);
          return 0;
        }
      };

      const [usersCount, projectsCount, activityCount] = await Promise.all([
        fetchCount('users'),
        fetchCount('projects'),
        fetchCount('activityLogs')
      ]);

      return res.status(200).json({
        success: true,
        stats: {
          users: usersCount,
          properties: projectsCount,
          activities: activityCount
        }
      });
    } catch (e: any) {
      console.error('Error fetching admin stats:', e);
      return res.status(500).json({ success: false, error: 'Failed to fetch overall stats: ' + e.message });
    }
  },

  adminGetUsers: async (req, res, ctx) => {
    const { db, isAdmin, getAuthService } = ctx;
    if (!isAdmin) return res.status(403).json({ error: 'Forbidden' });

    try {
      const authService = getAuthService();
      const listUsersResult = await authService.listUsers(1000);
      
      const users = await Promise.all(listUsersResult.users.map(async (userRecord) => {
        const userDoc = await db.collection('users').doc(userRecord.uid).get();
        const userData = userDoc.data() || {};
        return {
          uid: userRecord.uid,
          email: userRecord.email,
          displayName: userRecord.displayName || userData.displayName || 'Unnamed User',
          role: userData.role || 'user',
          createdAt: userRecord.metadata.creationTime,
          lastLogin: userRecord.metadata.lastSignInTime,
          disabled: userRecord.disabled,
          clientId: userData.clientId || null
        };
      }));

      return res.status(200).json({ success: true, users });
    } catch (e: any) {
      console.error('Error in adminGetUsers:', e);
      return res.status(500).json({ success: false, error: 'Failed to retrieve users: ' + (e.message || String(e)) });
    }
  },

  adminGetProjects: async (req, res, ctx) => {
    const { db, isAdmin } = ctx;
    if (!isAdmin) return res.status(403).json({ error: 'Forbidden' });

    const snap = await db.collection('projects').get();
    const projects = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    return res.status(200).json({ success: true, projects });
  },

  adminGetProgrammes: async (req, res, ctx) => {
    const { db, isAdmin } = ctx;
    if (!isAdmin) return res.status(403).json({ error: 'Forbidden' });

    const snap = await db.collection('programmes').get();
    const programmes = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    return res.status(200).json({ success: true, programmes });
  },

  adminUpdateUser: async (req, res, ctx) => {
    const { db, uid, email, isAdmin } = ctx;
    if (!isAdmin) return res.status(403).json({ error: 'Forbidden' });

    const { targetUid, updates } = req.body;
    if (!targetUid || !updates) return res.status(400).json({ error: 'Missing targetUid or updates' });

    await db.collection('users').doc(targetUid).set({
      ...updates,
      updatedAt: new Date().toISOString()
    }, { merge: true });

    // Log this admin action
    await db.collection('activityLogs').add({
      type: 'admin_user_update',
      adminUid: uid,
      adminEmail: email,
      targetUid,
      updates,
      timestamp: new Date().toISOString()
    });

    return res.status(200).json({ success: true });
  },

  adminGetActivity: async (req, res, ctx) => {
    const { db, isAdmin } = ctx;
    if (!isAdmin) return res.status(403).json({ error: 'Forbidden' });

    const snap = await db.collection('activityLogs').orderBy('timestamp', 'desc').limit(50).get();
    const logs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    return res.status(200).json({ success: true, logs });
  },

  adminGetMappings: async (req, res, ctx) => {
    const { db, isAdmin } = ctx;
    if (!isAdmin) return res.status(403).json({ error: 'Forbidden' });

    const snap = await db.collection('systemMappings').get();
    const mappings = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    return res.status(200).json({ success: true, mappings });
  },

  adminSaveMapping: async (req, res, ctx) => {
    const { db, primaryUid, isAdmin } = ctx;
    if (!isAdmin) return res.status(403).json({ error: 'Forbidden' });

    const { mapping } = req.body;
    if (!mapping) return res.status(400).json({ error: 'Missing mapping' });

    // Standardize to the organizations' mapping document instead of global collection
    const docRef = db.collection('systemMappings').doc(primaryUid);
    const doc = await docRef.get();
    let mappings = doc.exists ? (doc.data()?.data || []) : [];

    if (mapping.id) {
      mappings = mappings.map((m: any) => m.id === mapping.id ? { ...mapping, updatedAt: new Date().toISOString() } : m);
    } else {
      const newMapping = {
        ...mapping,
        id: `MAP-${crypto.randomBytes(4).toString('hex').toUpperCase()}`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      mappings.push(newMapping);
    }
    
    await docRef.set({ data: mappings }, { merge: true });
    return res.status(200).json({ success: true });
  },

  adminDeleteMapping: async (req, res, ctx) => {
    const { db, primaryUid, isAdmin } = ctx;
    if (!isAdmin) return res.status(403).json({ error: 'Forbidden' });

    const { id } = req.body;
    if (!id) return res.status(400).json({ error: 'Missing id' });

    const docRef = db.collection('systemMappings').doc(primaryUid);
    const doc = await docRef.get();
    if (doc.exists) {
      const mappings = (doc.data()?.data || []).filter((m: any) => m.id !== id);
      await docRef.set({ data: mappings }, { merge: true });
    }
    return res.status(200).json({ success: true });
  },

  adminGetPricingConfig: async (req, res, ctx) => {
    const { db, isAdmin } = ctx;
    if (!isAdmin) return res.status(403).json({ error: 'Forbidden' });

    const doc = await db.collection('platform').doc('pricingConfig').get();
    return res.status(200).json({ success: true, data: doc.exists ? doc.data() : null });
  },

  adminUpdatePricingConfig: async (req, res, ctx) => {
    const { db, email, isAdmin } = ctx;
    if (!isAdmin) return res.status(403).json({ error: 'Forbidden' });

    const { config } = req.body;
    if (!config || typeof config !== 'object') return res.status(400).json({ error: 'Missing or invalid config' });

    await db.collection('platform').doc('pricingConfig').set({
      ...config,
      updatedAt: new Date().toISOString(),
      updatedBy: email
    });

    db.collection('activityLogs').add({
      type: 'pricing_config_updated',
      uid: ctx.uid, email,
      timestamp: new Date().toISOString()
    }).catch(console.error);

    return res.status(200).json({ success: true });
  },

  adminCreateInvoice: async (req, res, ctx) => {
    const { db, uid, isAdmin } = ctx;
    if (!isAdmin) return res.status(403).json({ error: 'Forbidden' });

    const { invoice } = req.body;
    if (!invoice) return res.status(400).json({ error: 'Missing invoice data' });

    const docRef = await db.collection('invoices').add({
      ...invoice,
      createdBy: uid,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    return res.status(200).json({ success: true, id: docRef.id });
  },

  adminGetInvoices: async (req, res, ctx) => {
    const { db, isAdmin } = ctx;
    if (!isAdmin) return res.status(403).json({ error: 'Forbidden' });

    const snap = await db.collection('invoices').orderBy('createdAt', 'desc').get();
    const invoices = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    return res.status(200).json({ success: true, invoices });
  },

  adminDeleteInvoice: async (req, res, ctx) => {
    const { db, uid, email, isAdmin } = ctx;
    if (!isAdmin) return res.status(403).json({ error: 'Forbidden' });

    const { id } = req.body;
    if (!id) return res.status(400).json({ error: 'Missing invoice id' });

    await db.collection('invoices').doc(id).delete();

    db.collection('activityLogs').add({
      type: 'invoice_deleted',
      uid, email,
      invoiceId: id,
      timestamp: new Date().toISOString()
    }).catch(console.error);

    return res.status(200).json({ success: true });
  },
};
