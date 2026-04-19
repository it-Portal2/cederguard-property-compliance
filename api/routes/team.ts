import { FieldValue } from 'firebase-admin/firestore';
import { ApiContext } from '../lib/context.js';

export const teamRoutes: Record<string, (req: any, res: any, ctx: ApiContext) => Promise<any>> = {
  inviteProjectManager: async (req, res, ctx) => {
    const { db, uid, email } = ctx;
    const { pmEmail, pmName, pmRole } = req.body;
    
    if (!pmEmail) return res.status(400).json({ error: 'Missing pmEmail' });
    
    const normalizedEmail = pmEmail.trim().toLowerCase();
    await db.collection('invitations').add({
      email: normalizedEmail,
      name: pmName || '',
      invitedBy: uid,
      invitedByEmail: email,
      role: pmRole || 'project_manager',
      clientId: uid,
      createdAt: new Date().toISOString()
    });

    db.collection('activityLogs').add({ 
      type: 'pm_invited', 
      uid, 
      email, 
      pmEmail: normalizedEmail, 
      timestamp: new Date().toISOString() 
    }).catch(console.error);

    return res.status(200).json({ success: true });
  },

  clientGetPMs: async (req, res, ctx) => {
    const { db, primaryUid } = ctx;

    const pmsSnap = await db.collection('users')
      .where('clientId', '==', primaryUid)
      .where('role', '==', 'project_manager')
      .get();
    const pms = pmsSnap.docs.map(doc => ({ uid: doc.id, ...doc.data() }));

    // Also grab pending invitations
    const invSnap = await db.collection('invitations').where('clientId', '==', primaryUid).get();
    const pending = invSnap.docs.map(doc => ({ 
      uid: null, 
      id: doc.id, 
      email: doc.data().email, 
      name: doc.data().name || '', 
      status: 'pending', 
      ...doc.data() 
    }));

    return res.status(200).json({ success: true, pms, pending });
  },

  clientGetTeam: async (req, res, ctx) => {
    const { db, primaryUid } = ctx;
    const ALL_PM_ROLES = ['project_manager', 'senior_pm', 'senior_project_manager', 'assistant_pm', 'project_coordinator'];

    const teamSnap = await db.collection('users').where('clientId', '==', primaryUid).get();
    const team = teamSnap.docs
      .map(doc => ({ uid: doc.id, ...doc.data() }))
      .filter((u: any) => ALL_PM_ROLES.includes(u.role));

    // Pending invitations for this client
    const invSnap = await db.collection('invitations').where('clientId', '==', primaryUid).get();
    const pending = invSnap.docs.map(doc => ({
      uid: null,
      id: doc.id,
      email: doc.data().email,
      name: doc.data().name || '',
      role: doc.data().role || 'project_manager',
      status: 'pending',
      createdAt: doc.data().createdAt || null,
    }));

    return res.status(200).json({ success: true, team, pending });
  },

  clientRemoveUser: async (req, res, ctx) => {
    const { db, uid, email } = ctx;
    const { targetUid } = req.body;
    
    if (!targetUid) return res.status(400).json({ error: 'Missing targetUid' });

    const targetDoc = await db.collection('users').doc(targetUid).get();
    if (!targetDoc.exists) return res.status(404).json({ error: 'User not found' });
    const targetData = targetDoc.data() || {};

    // Safety: only remove users who belong to this client
    if (targetData.clientId !== uid) {
      return res.status(403).json({ error: 'Forbidden: This user does not belong to your organisation.' });
    }

    // Safety: never allow removing admin-level accounts
    const PROTECTED_ROLES = ['admin', 'client_admin'];
    if (PROTECTED_ROLES.includes(targetData.role || '')) {
      return res.status(403).json({ error: 'Forbidden: Cannot remove admin-level users.' });
    }

    await db.collection('users').doc(targetUid).update({ clientId: null });
    db.collection('activityLogs').add({ 
      type: 'team_member_removed', 
      uid, 
      email, 
      targetUid, 
      timestamp: new Date().toISOString() 
    }).catch(console.error);
    
    return res.status(200).json({ success: true });
  },

  clientUpdateUserRole: async (req, res, ctx) => {
    const { db, uid, email } = ctx;
    const { targetUid, role } = req.body;
    
    if (!targetUid || !role) return res.status(400).json({ error: 'Missing targetUid or role' });

    // Prevent privilege escalation — Client Admins CAN ONLY assign PM-level roles
    const ALLOWED_ROLES = ['project_manager', 'senior_pm', 'senior_project_manager', 'assistant_pm', 'project_coordinator'];
    if (!ALLOWED_ROLES.includes(role)) {
      return res.status(403).json({ error: 'Forbidden: You cannot assign this role.' });
    }

    const targetDoc = await db.collection('users').doc(targetUid).get();
    if (!targetDoc.exists) return res.status(404).json({ error: 'User not found' });

    // Only update users in your own organisation
    if (targetDoc.data()?.clientId !== uid) {
      return res.status(403).json({ error: 'Forbidden: This user does not belong to your organisation.' });
    }

    await db.collection('users').doc(targetUid).update({ role });
    db.collection('activityLogs').add({ 
      type: 'team_member_role_updated', 
      uid, 
      email, 
      targetUid, 
      role, 
      timestamp: new Date().toISOString() 
    }).catch(console.error);
    
    return res.status(200).json({ success: true });
  },

  getAssignablePMs: async (req, res, ctx) => {
    const { db, uid, email, userData, isAdmin, primaryUid } = ctx;
    const isClientAdmin = userData?.role === 'client_admin' || userData?.role === 'enterprise';

    // Include all roles that can be assigned to manage a project.
    // 'pro' and 'enterprise' are billing/account tiers, not job roles — excluded
    // so account owners don't clutter the PM assignment dropdown.
    const pmRoles = [
      'project_manager', 'senior_pm', 'senior_project_manager',
      'assistant_pm', 'assistant_project_manager',
      'project_coordinator', 'client_admin'
    ];

    let query = db.collection('users').where('role', 'in', pmRoles);

    // Scope to this organisation for non-admin users.
    // The query already restricts to pmRoles so admin role can never come from here.
    if (!isAdmin) {
      query = query.where('clientId', '==', primaryUid);
    }

    const snap = await query.get();
    const users = snap.docs.map(doc => ({
      uid: doc.id,
      email: doc.data().email,
      role: doc.data().role,
      displayName: doc.data().displayName || doc.data().companyName || doc.data().email
    }));

    // Ensure the org owner (client_admin) is always in the assignable list.
    // The Firestore query filters by clientId, but the org owner has no clientId on
    // their own doc (they ARE the tenant root), so they won't appear in the query
    // results without this guard.
    // Guard is role-checked: only add the user if their role is in pmRoles — prevents
    // platform-level admin/super_admin users from being injected into the list.
    if (!users.find(u => u.uid === primaryUid)) {
      const adminDoc = await db.collection('users').doc(primaryUid).get();
      const docRole = adminDoc.data()?.role || '';
      if (adminDoc.exists && pmRoles.includes(docRole)) {
        users.push({
          uid: primaryUid,
          email: adminDoc.data()?.email,
          role: docRole,
          displayName: adminDoc.data()?.displayName || adminDoc.data()?.companyName || adminDoc.data()?.email
        });
      } else if (isClientAdmin && pmRoles.includes(userData.role) && !users.find(u => u.uid === uid)) {
        users.push({
          uid,
          email,
          role: userData.role,
          displayName: userData.displayName || userData.companyName || email
        });
      }
    }

    return res.status(200).json({ success: true, users });
  },

  clientGetProgrammeManagers: async (req, res, ctx) => {
    const { db, isAdmin, primaryUid } = ctx;
    
    // Programme Managers and Client Admins can manage programmes
    const roles = ['programme_manager', 'client_admin', 'enterprise', 'admin'];
    let query = db.collection('users').where('role', 'in', roles);

    if (!isAdmin) {
      query = query.where('clientId', '==', primaryUid);
    }

    const snap = await query.get();
    const users = snap.docs.map(doc => ({
      uid: doc.id,
      email: doc.data().email,
      role: doc.data().role,
      displayName: doc.data().displayName || doc.data().companyName || doc.data().email
    }));

    return res.status(200).json({ success: true, users });
  },

  clientGetInvoices: async (req, res, ctx) => {
    const { db, uid } = ctx;
    
    const snap = await db.collection('invoices')
      .where('clientId', '==', uid)
      .orderBy('createdAt', 'desc')
      .get();

    const invoices = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    return res.status(200).json({ success: true, invoices });
  },
};
