import { FieldValue } from 'firebase-admin/firestore';
import { ApiContext } from '../lib/context.js';
import { ROLE_STRINGS, PM_LEVELS } from '../../src/lib/roleConstants.js';
import { logActivity } from '../lib/activityLog.js';

const canonicalOf = (role?: string | null): string => {
  switch (role) {
    case ROLE_STRINGS.ADMIN:
      return 'super_admin';
    case ROLE_STRINGS.CLIENT_ADMIN:
    case ROLE_STRINGS.PROGRAMME_MANAGER:
      return 'client_admin';
    case ROLE_STRINGS.PROJECT_MANAGER:
    case ROLE_STRINGS.SENIOR_PM:
    case ROLE_STRINGS.SENIOR_PROJECT_MANAGER:
    case ROLE_STRINGS.ASSISTANT_PM:
    case 'assistant_pm':
    case ROLE_STRINGS.PROJECT_COORDINATOR:
      return 'project_manager';
    case ROLE_STRINGS.ENTERPRISE:
      return 'enterprise';
    case ROLE_STRINGS.VIEWER:
      return 'viewer';
    default:
      return 'project_manager';
  }
};

const isSupervisorCanonical = (role?: string | null) => {
  const c = canonicalOf(role);
  return c === 'super_admin' || c === 'client_admin';
};

export const teamRoutes: Record<string, (req: any, res: any, ctx: ApiContext) => Promise<any>> = {
  // Invite always creates a canonical project_manager. Supervisor binds via programmeIds.
  inviteProjectManager: async (req, res, ctx) => {
    const { db, uid, email, isAdmin } = ctx;
    const { pmEmail, pmName, pmLevel, programmeIds } = req.body;

    if (!pmEmail) return res.status(400).json({ error: 'Missing pmEmail' });

    const normalizedEmail = pmEmail.trim().toLowerCase();
    const level = PM_LEVELS.includes(pmLevel) ? pmLevel : 'standard';

    // Validate programmeIds — caller must own each programme (bypass for super_admin)
    const validProgrammeIds: string[] = [];
    if (Array.isArray(programmeIds) && programmeIds.length > 0) {
      for (const pid of programmeIds) {
        if (typeof pid !== 'string' || !pid) continue;
        const progDoc = await db.collection('programmes').doc(pid).get();
        if (!progDoc.exists) continue;
        const pData = progDoc.data() || {};
        const ownsIt =
          pData.userId === uid ||
          pData.creatorId === uid ||
          pData.createdBy === uid;
        if (isAdmin || ownsIt) {
          validProgrammeIds.push(pid);
        } else {
          return res.status(403).json({ error: `Forbidden: You do not own programme ${pid}` });
        }
      }
    }

    await db.collection('invitations').add({
      email: normalizedEmail,
      name: pmName || '',
      invitedBy: uid,
      invitedByEmail: email,
      role: ROLE_STRINGS.PROJECT_MANAGER,
      pmLevel: level,
      programmeIds: validProgrammeIds,
      clientId: uid,
      createdAt: new Date().toISOString(),
    });

    await logActivity(ctx, 'pm_invited', {
      category: 'create',
      entityType: 'invitation',
      entityId: normalizedEmail,
      entityName: pmName || normalizedEmail,
      details: { invitedEmail: normalizedEmail, pmLevel: level, programmeIds: validProgrammeIds },
    });

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
      ...doc.data(),
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

    const invSnap = await db.collection('invitations').where('clientId', '==', primaryUid).get();
    const pending = invSnap.docs.map(doc => ({
      uid: null,
      id: doc.id,
      email: doc.data().email,
      name: doc.data().name || '',
      role: doc.data().role || 'project_manager',
      pmLevel: doc.data().pmLevel || 'standard',
      programmeIds: doc.data().programmeIds || [],
      status: 'pending',
      createdAt: doc.data().createdAt || null,
    }));

    return res.status(200).json({ success: true, team, pending });
  },

  updateInvite: async (req, res, ctx) => {
    const { db, uid, email, isAdmin } = ctx;
    const { inviteId, pmLevel, programmeIds, name } = req.body;

    if (!inviteId) return res.status(400).json({ error: 'Missing inviteId' });

    const inviteDoc = await db.collection('invitations').doc(inviteId).get();
    if (!inviteDoc.exists) return res.status(404).json({ error: 'Invitation not found' });

    const invData = inviteDoc.data() || {};
    if (!isAdmin && invData.clientId !== uid) {
      return res.status(403).json({ error: 'Forbidden: This invitation does not belong to your organisation.' });
    }

    const updates: any = { updatedAt: new Date().toISOString() };
    if (typeof name === 'string') updates.name = name;
    if (pmLevel && PM_LEVELS.includes(pmLevel)) updates.pmLevel = pmLevel;

    if (Array.isArray(programmeIds)) {
      const validProgrammeIds: string[] = [];
      for (const pid of programmeIds) {
        if (typeof pid !== 'string' || !pid) continue;
        const progDoc = await db.collection('programmes').doc(pid).get();
        if (!progDoc.exists) continue;
        const pData = progDoc.data() || {};
        const ownsIt =
          pData.userId === uid ||
          pData.creatorId === uid ||
          pData.createdBy === uid;
        if (isAdmin || ownsIt) {
          validProgrammeIds.push(pid);
        } else {
          return res.status(403).json({ error: `Forbidden: You do not own programme ${pid}` });
        }
      }
      updates.programmeIds = validProgrammeIds;
    }

    await db.collection('invitations').doc(inviteId).set(updates, { merge: true });
    await logActivity(ctx, 'invite_updated', {
      category: 'update',
      entityType: 'invitation',
      entityId: inviteId,
      entityName: invData.name || invData.email,
      details: { invitedEmail: invData.email, changedFields: Object.keys(updates) },
    });

    return res.status(200).json({ success: true });
  },

  cancelInvite: async (req, res, ctx) => {
    const { db, uid, email, isAdmin } = ctx;
    const { inviteId } = req.body;

    if (!inviteId) return res.status(400).json({ error: 'Missing inviteId' });

    const inviteDoc = await db.collection('invitations').doc(inviteId).get();
    if (!inviteDoc.exists) return res.status(404).json({ error: 'Invitation not found' });

    const invData = inviteDoc.data() || {};
    if (!isAdmin && invData.clientId !== uid) {
      return res.status(403).json({ error: 'Forbidden: This invitation does not belong to your organisation.' });
    }

    await db.collection('invitations').doc(inviteId).delete();
    await logActivity(ctx, 'invite_cancelled', {
      category: 'delete',
      entityType: 'invitation',
      entityId: inviteId,
      entityName: invData.name || invData.email,
      details: { invitedEmail: invData.email },
    });

    return res.status(200).json({ success: true });
  },

  clientRemoveUser: async (req, res, ctx) => {
    const { db, uid, email } = ctx;
    const { targetUid } = req.body;

    if (!targetUid) return res.status(400).json({ error: 'Missing targetUid' });

    const targetDoc = await db.collection('users').doc(targetUid).get();
    if (!targetDoc.exists) return res.status(404).json({ error: 'User not found' });
    const targetData = targetDoc.data() || {};

    if (targetData.clientId !== uid) {
      return res.status(403).json({ error: 'Forbidden: This user does not belong to your organisation.' });
    }

    const PROTECTED_ROLES = ['admin', 'client_admin'];
    if (PROTECTED_ROLES.includes(targetData.role || '')) {
      return res.status(403).json({ error: 'Forbidden: Cannot remove admin-level users.' });
    }

    await db.collection('users').doc(targetUid).update({ clientId: null });
    await logActivity(ctx, 'team_member_removed', {
      category: 'delete',
      entityType: 'user',
      entityId: targetUid,
      entityName: targetData.displayName || targetData.email || targetUid,
      details: { removedRole: targetData.role ?? null },
    });

    return res.status(200).json({ success: true });
  },

  clientUpdateUserRole: async (req, res, ctx) => {
    const { db, uid, email } = ctx;
    const { targetUid, role } = req.body;

    if (!targetUid || !role) return res.status(400).json({ error: 'Missing targetUid or role' });

    const ALLOWED_ROLES = ['project_manager', 'senior_pm', 'senior_project_manager', 'assistant_pm', 'project_coordinator'];
    if (!ALLOWED_ROLES.includes(role)) {
      return res.status(403).json({ error: 'Forbidden: You cannot assign this role.' });
    }

    const targetDoc = await db.collection('users').doc(targetUid).get();
    if (!targetDoc.exists) return res.status(404).json({ error: 'User not found' });

    if (targetDoc.data()?.clientId !== uid) {
      return res.status(403).json({ error: 'Forbidden: This user does not belong to your organisation.' });
    }

    const roleTargetData = targetDoc.data() || {};
    await db.collection('users').doc(targetUid).update({ role });
    await logActivity(ctx, 'team_member_role_updated', {
      category: 'update',
      entityType: 'user',
      entityId: targetUid,
      entityName: roleTargetData.displayName || roleTargetData.email || targetUid,
      details: { fromRole: roleTargetData.role ?? null, toRole: role },
    });

    return res.status(200).json({ success: true });
  },

  getAssignablePMs: async (req, res, ctx) => {
    const { db, uid, email, userData, isAdmin, primaryUid } = ctx;
    const isClientAdmin = userData?.role === 'client_admin' || userData?.role === 'enterprise';

    const pmRoles = [
      'project_manager', 'senior_pm', 'senior_project_manager',
      'assistant_pm', 'assistant_project_manager',
      'project_coordinator', 'client_admin',
    ];

    let query = db.collection('users').where('role', 'in', pmRoles);

    if (!isAdmin) {
      query = query.where('clientId', '==', primaryUid);
    }

    const snap = await query.get();
    const users = snap.docs.map(doc => ({
      uid: doc.id,
      email: doc.data().email,
      role: doc.data().role,
      displayName: doc.data().displayName || doc.data().companyName || doc.data().email,
    }));

    if (!users.find(u => u.uid === primaryUid)) {
      const adminDoc = await db.collection('users').doc(primaryUid).get();
      const docRole = adminDoc.data()?.role || '';
      if (adminDoc.exists && pmRoles.includes(docRole)) {
        users.push({
          uid: primaryUid,
          email: adminDoc.data()?.email,
          role: docRole,
          displayName: adminDoc.data()?.displayName || adminDoc.data()?.companyName || adminDoc.data()?.email,
        });
      } else if (isClientAdmin && pmRoles.includes(userData.role) && !users.find(u => u.uid === uid)) {
        users.push({
          uid,
          email,
          role: userData.role,
          displayName: userData.displayName || userData.companyName || email,
        });
      }
    }

    return res.status(200).json({ success: true, users });
  },

  // Returns programmes the caller belongs to (as PM via roster) or inviter (as supervisor),
  // unioned with user.supervisorUid → supervisor profile. For admins/client_admin, returns the
  // wider org-scoped supervisor list (old clientGetProgrammeManagers behaviour).
  clientGetMySupervisors: async (req, res, ctx) => {
    const { db, uid, userData, isAdmin, primaryUid } = ctx;

    const isCallerSupervisorTier = isAdmin || isSupervisorCanonical(userData?.role);

    if (isCallerSupervisorTier) {
      const roles = ['programme_manager', 'client_admin', 'enterprise', 'admin'];
      let query = db.collection('users').where('role', 'in', roles);
      if (!isAdmin) {
        query = query.where('clientId', '==', primaryUid);
      }
      const snap = await query.get();
      const users = snap.docs
        .map(d => ({
          uid: d.id,
          email: d.data().email,
          role: d.data().role,
          displayName: d.data().displayName || d.data().companyName || d.data().email,
        }))
        .filter(u => isSupervisorCanonical(u.role));
      return res.status(200).json({ success: true, users });
    }

    // Project-manager path — union of (roster-derived) + (user.supervisorUid)
    const foundIds = new Set<string>();
    const profiles: any[] = [];

    const progSnap = await db.collection('programmes')
      .where('assignedPMIds', 'array-contains', uid)
      .get();
    const supervisorUids = new Set<string>();
    progSnap.docs.forEach(d => {
      const p = d.data() || {};
      if (p.userId) supervisorUids.add(p.userId);
      if (p.creatorId) supervisorUids.add(p.creatorId);
    });

    if (userData?.supervisorUid) {
      supervisorUids.add(userData.supervisorUid);
    }

    for (const sid of supervisorUids) {
      if (!sid || foundIds.has(sid)) continue;
      const sDoc = await db.collection('users').doc(sid).get();
      if (!sDoc.exists) continue;
      const sData = sDoc.data() || {};
      if (!isSupervisorCanonical(sData.role)) continue;
      foundIds.add(sid);
      profiles.push({
        uid: sid,
        email: sData.email,
        role: sData.role,
        displayName: sData.displayName || sData.companyName || sData.email,
      });
    }

    return res.status(200).json({ success: true, users: profiles });
  },

  // Kept for back-compat; intersected with the caller's roster when caller is PM.
  clientGetProgrammeManagers: async (req, res, ctx) => {
    const { db, isAdmin, primaryUid } = ctx;

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
      displayName: doc.data().displayName || doc.data().companyName || doc.data().email,
    }));

    return res.status(200).json({ success: true, users });
  },

  // Step 2 resolver — programmes created by the given supervisor, intersected with
  // the caller's roster when caller is a project_manager.
  clientGetProgrammesByManager: async (req, res, ctx) => {
    const { db, uid, userData, isAdmin, primaryUid } = ctx;
    const { supervisorId } = req.body;

    if (!supervisorId) return res.status(200).json({ success: true, programmes: [] });

    const byUserId = await db.collection('programmes').where('userId', '==', supervisorId).get();
    const byCreatorId = await db.collection('programmes').where('creatorId', '==', supervisorId).get();

    const seen = new Map<string, any>();
    byUserId.docs.forEach(d => seen.set(d.id, { id: d.id, ...d.data() }));
    byCreatorId.docs.forEach(d => { if (!seen.has(d.id)) seen.set(d.id, { id: d.id, ...d.data() }); });

    let results = Array.from(seen.values());

    // Scope non-admins to their org
    if (!isAdmin) {
      results = results.filter((p: any) => !p.clientId || p.clientId === primaryUid);
    }

    // Intersect with caller's roster if caller is canonical project_manager
    if (!isAdmin && canonicalOf(userData?.role) === 'project_manager') {
      results = results.filter((p: any) =>
        Array.isArray(p.assignedPMIds) && p.assignedPMIds.includes(uid)
      );
    }

    return res.status(200).json({ success: true, programmes: results });
  },

  // Step 3 resolver — profiles of uids in assignedPMIds. Filters to canonical PM role.
  getPMsAssignedToProgramme: async (req, res, ctx) => {
    const { db, isAdmin, primaryUid } = ctx;
    const { programmeId } = req.body;

    if (!programmeId) return res.status(400).json({ error: 'Missing programmeId' });

    const progDoc = await db.collection('programmes').doc(programmeId).get();
    if (!progDoc.exists) return res.status(404).json({ error: 'Programme not found' });
    const prog = progDoc.data() || {};

    if (!isAdmin && prog.clientId && prog.clientId !== primaryUid) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const pmIds: string[] = Array.isArray(prog.assignedPMIds) ? prog.assignedPMIds : [];
    if (pmIds.length === 0) {
      return res.status(200).json({ success: true, users: [] });
    }

    const users: any[] = [];
    for (const pid of pmIds) {
      const uDoc = await db.collection('users').doc(pid).get();
      if (!uDoc.exists) continue;
      const uData = uDoc.data() || {};
      if (canonicalOf(uData.role) !== 'project_manager') continue;
      users.push({
        uid: pid,
        email: uData.email,
        role: uData.role,
        pmLevel: uData.pmLevel || null,
        displayName: uData.displayName || uData.companyName || uData.email,
      });
    }

    return res.status(200).json({ success: true, users });
  },

  addPMToProgramme: async (req, res, ctx) => {
    const { db, uid, email, isAdmin, primaryUid, userData } = ctx;
    const { programmeId, userId: targetUserId } = req.body;

    if (!programmeId || !targetUserId) {
      return res.status(400).json({ error: 'Missing programmeId or userId' });
    }

    const progDoc = await db.collection('programmes').doc(programmeId).get();
    if (!progDoc.exists) return res.status(404).json({ error: 'Programme not found' });
    const prog = progDoc.data() || {};

    const ownsProg = prog.userId === uid || prog.creatorId === uid || prog.createdBy === uid;
    const isOrgClientAdmin =
      canonicalOf(userData?.role) === 'client_admin' && prog.clientId === primaryUid;
    if (!isAdmin && !ownsProg && !isOrgClientAdmin) {
      return res.status(403).json({ error: 'Forbidden: You cannot edit this programme roster.' });
    }

    const targetDoc = await db.collection('users').doc(targetUserId).get();
    if (!targetDoc.exists) return res.status(404).json({ error: 'Target user not found' });
    const targetData = targetDoc.data() || {};

    if (!isAdmin && targetData.clientId && targetData.clientId !== primaryUid) {
      return res.status(403).json({ error: 'Forbidden: Target user outside your organisation.' });
    }

    await db.collection('programmes').doc(programmeId).update({
      assignedPMIds: FieldValue.arrayUnion(targetUserId),
    });

    // Backfill supervisorUid if null (self-registered PM being rostered for the first time)
    if (!targetData.supervisorUid) {
      await db.collection('users').doc(targetUserId).update({ supervisorUid: uid });
    }

    await logActivity(ctx, 'pm_added_to_programme', {
      category: 'update',
      entityType: 'user',
      entityId: targetUserId,
      entityName: targetData.displayName || targetData.email || targetUserId,
      details: { programmeId },
    });

    return res.status(200).json({ success: true });
  },

  removePMFromProgramme: async (req, res, ctx) => {
    const { db, uid, email, isAdmin, primaryUid, userData } = ctx;
    const { programmeId, userId: targetUserId } = req.body;

    if (!programmeId || !targetUserId) {
      return res.status(400).json({ error: 'Missing programmeId or userId' });
    }

    const progDoc = await db.collection('programmes').doc(programmeId).get();
    if (!progDoc.exists) return res.status(404).json({ error: 'Programme not found' });
    const prog = progDoc.data() || {};

    const ownsProg = prog.userId === uid || prog.creatorId === uid || prog.createdBy === uid;
    const isOrgClientAdmin =
      canonicalOf(userData?.role) === 'client_admin' && prog.clientId === primaryUid;
    if (!isAdmin && !ownsProg && !isOrgClientAdmin) {
      return res.status(403).json({ error: 'Forbidden: You cannot edit this programme roster.' });
    }

    await db.collection('programmes').doc(programmeId).update({
      assignedPMIds: FieldValue.arrayRemove(targetUserId),
    });

    const rmTarget = (await db.collection('users').doc(targetUserId).get()).data() || {};
    await logActivity(ctx, 'pm_removed_from_programme', {
      category: 'update',
      entityType: 'user',
      entityId: targetUserId,
      entityName: rmTarget.displayName || rmTarget.email || targetUserId,
      details: { programmeId },
    });

    return res.status(200).json({ success: true });
  },

  setPmLevel: async (req, res, ctx) => {
    const { db, uid, email, isAdmin, primaryUid, userData } = ctx;
    const { targetUid, pmLevel } = req.body;

    if (!targetUid || !pmLevel) return res.status(400).json({ error: 'Missing targetUid or pmLevel' });
    if (!PM_LEVELS.includes(pmLevel)) return res.status(400).json({ error: 'Invalid pmLevel' });

    const targetDoc = await db.collection('users').doc(targetUid).get();
    if (!targetDoc.exists) return res.status(404).json({ error: 'User not found' });
    const targetData = targetDoc.data() || {};

    const isTargetsSupervisor = targetData.supervisorUid === uid;
    const isOrgClientAdmin =
      canonicalOf(userData?.role) === 'client_admin' && targetData.clientId === primaryUid;

    if (!isAdmin && !isTargetsSupervisor && !isOrgClientAdmin) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    await db.collection('users').doc(targetUid).update({ pmLevel });

    await logActivity(ctx, 'pm_level_updated', {
      category: 'update',
      entityType: 'user',
      entityId: targetUid,
      entityName: targetData.displayName || targetData.email || targetUid,
      details: { fromPmLevel: targetData.pmLevel ?? null, toPmLevel: pmLevel },
    });

    return res.status(200).json({ success: true });
  },

  clientAssignSupervisor: async (req, res, ctx) => {
    const { db, uid, email, primaryUid, userData } = ctx;
    const { targetUid, supervisorUid } = req.body;

    if (!targetUid) return res.status(400).json({ error: 'Missing targetUid' });
    if (canonicalOf(userData?.role) !== 'client_admin') {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const targetDoc = await db.collection('users').doc(targetUid).get();
    if (!targetDoc.exists) return res.status(404).json({ error: 'User not found' });
    const targetData = targetDoc.data() || {};
    if (targetData.clientId !== primaryUid) {
      return res.status(403).json({ error: 'Forbidden: target outside your organisation' });
    }

    if (supervisorUid) {
      const supDoc = await db.collection('users').doc(supervisorUid).get();
      if (!supDoc.exists) return res.status(404).json({ error: 'Supervisor not found' });
      const supData = supDoc.data() || {};
      if (supData.clientId !== primaryUid && supDoc.id !== primaryUid) {
        return res.status(403).json({ error: 'Forbidden: supervisor outside your organisation' });
      }
      if (!isSupervisorCanonical(supData.role)) {
        return res.status(400).json({ error: 'Target user is not a valid supervisor' });
      }
    }

    await db.collection('users').doc(targetUid).update({
      supervisorUid: supervisorUid || null,
    });

    await logActivity(ctx, 'supervisor_assigned', {
      category: 'update',
      entityType: 'user',
      entityId: targetUid,
      entityName: targetData.displayName || targetData.email || targetUid,
      details: { supervisorUid: supervisorUid || null },
    });

    return res.status(200).json({ success: true });
  },

  clientUpdateMemberProfile: async (req, res, ctx) => {
    const { db, isAdmin, primaryUid, userData } = ctx;
    const { targetUid, displayName } = req.body;

    if (!targetUid) return res.status(400).json({ error: 'Missing targetUid' });
    if (typeof displayName !== 'string' || !displayName.trim()) {
      return res.status(400).json({ error: 'Invalid displayName' });
    }

    const targetDoc = await db.collection('users').doc(targetUid).get();
    if (!targetDoc.exists) return res.status(404).json({ error: 'User not found' });
    const targetData = targetDoc.data() || {};

    const isOrgClientAdmin =
      canonicalOf(userData?.role) === 'client_admin' && targetData.clientId === primaryUid;

    if (!isAdmin && !isOrgClientAdmin) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    await db.collection('users').doc(targetUid).update({
      displayName: displayName.trim(),
      updatedAt: new Date().toISOString(),
    });

    return res.status(200).json({ success: true });
  },

  clientResetWorkspaceData: async (_req, res, ctx) => {
    const { db, uid, email, primaryUid } = ctx;

    // Delete all projects owned by this org (+ their data subcollections + evidence)
    const projectsSnap = await db.collection('projects').where('clientId', '==', primaryUid).get();
    for (const projectDoc of projectsSnap.docs) {
      const dataSnap = await projectDoc.ref.collection('data').get();
      if (!dataSnap.empty) {
        const batch = db.batch();
        dataSnap.docs.forEach(d => batch.delete(d.ref));
        await batch.commit();
      }
      const evidenceSnap = await db.collection('evidence').where('project', '==', projectDoc.id).get();
      if (!evidenceSnap.empty) {
        for (let i = 0; i < evidenceSnap.docs.length; i += 500) {
          const batch = db.batch();
          evidenceSnap.docs.slice(i, i + 500).forEach(d => batch.delete(d.ref));
          await batch.commit();
        }
      }
      await projectDoc.ref.delete();
    }

    // Delete all programmes owned by this org
    const programmesSnap = await db.collection('programmes').where('clientId', '==', primaryUid).get();
    if (!programmesSnap.empty) {
      for (let i = 0; i < programmesSnap.docs.length; i += 500) {
        const batch = db.batch();
        programmesSnap.docs.slice(i, i + 500).forEach(d => batch.delete(d.ref));
        await batch.commit();
      }
    }

    // Delete all pending invitations for this org
    const invitesSnap = await db.collection('invitations').where('clientId', '==', primaryUid).get();
    if (!invitesSnap.empty) {
      const batch = db.batch();
      invitesSnap.docs.forEach(d => batch.delete(d.ref));
      await batch.commit();
    }

    await logActivity(ctx, 'workspace_reset', {
      category: 'delete',
      entityType: 'workspace',
      entityId: ctx.primaryUid,
      entityName: 'Workspace data',
      details: {
        projectsDeleted: projectsSnap.size,
        programmesDeleted: programmesSnap.size,
        invitesDeleted: invitesSnap.size,
      },
    });

    return res.status(200).json({ success: true });
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
