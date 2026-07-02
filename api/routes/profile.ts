import { FieldValue } from 'firebase-admin/firestore';
import { ApiContext } from '../lib/context.js';

export const profileRoutes: Record<string, (req: any, res: any, ctx: ApiContext) => Promise<any>> = {
  saveProfile: async (req, res, ctx) => {
    const { db, uid, email, userData, primaryUid, isAdmin, SYSTEM_ADMIN_EMAILS, isAuthorizedForContext, getAuthService, getMessagingService } = ctx;
    const { profile } = req.body;
        if (!profile) return res.status(400).json({ error: 'Missing profile data' });
        
        // Whitelist allowed fields to prevent privilege escalation.
        // Org-identity fields (orgName/regNo/address/jurisdiction) are writable by
        // the owning user — no role/clientId leak possible from these strings.
        const allowedFields = [
          'displayName', 'photoURL', 'phoneNumber', 'bio',
          'onboardingCompleted', 'theme', 'geminiBackupKey', 'fcmToken',
          'orgName', 'regNo', 'address', 'jurisdiction',
        ];
        const sanitizedProfile: any = {};
        allowedFields.forEach(field => {
          if (profile[field] !== undefined) sanitizedProfile[field] = profile[field];
        });
        // sanitise nested `notificationPreferences.chase`.
        if (profile.notificationPreferences && typeof profile.notificationPreferences === 'object') {
          const np: Record<string, any> = {};
          if (typeof profile.notificationPreferences.chase === 'boolean') {
            np.chase = profile.notificationPreferences.chase;
          }
          if (Object.keys(np).length > 0) sanitizedProfile.notificationPreferences = np;
        }

        await db.collection('users').doc(uid).set(sanitizedProfile, { merge: true });
        return res.status(200).json({ success: true });
  },

  getProfile: async (req, res, ctx) => {
    const { db, uid, email, userData, primaryUid, isAdmin, SYSTEM_ADMIN_EMAILS, isAuthorizedForContext, getAuthService, getMessagingService } = ctx;
    let profileData: any = userData;

        // Ensure the admin user is correctly tagged if they aren't already
        if (isAdmin && profileData.role !== 'admin') {
           await db.collection('users').doc(uid).set({
              email,
              role: 'admin',
              updatedAt: new Date().toISOString()
            }, { merge: true });
            profileData = { ...profileData, email, role: 'admin' };
        } else if (!profileData.role) {
          // Check for invitations first if role is missing entirely
          const invSnap = await db.collection('invitations')
            .where('email', '==', email)
            .orderBy('createdAt', 'desc')
            .limit(1)
            .get();

          if (!invSnap.empty) {
            const invData = invSnap.docs[0].data();
            const clientId = invData?.clientId || invData?.invitedBy;
            const supervisorUid = invData?.invitedBy || null;
            const pmLevel = invData?.pmLevel || 'standard';
            // Invites always produce a canonical project_manager, regardless of any legacy role field.
            const role = 'project_manager';

            const now = new Date().toISOString();
            await db.collection('users').doc(uid).set({
              email,
              role,
              pmLevel,
              supervisorUid,
              clientId,
              updatedAt: now,
              ...(!profileData.createdAt ? { createdAt: now } : {}),
            }, { merge: true });

            profileData = {
              ...profileData,
              email,
              role,
              pmLevel,
              supervisorUid,
              clientId
            };

            // Best-effort: array-union this uid into each programme roster on the invite
            const programmeIds: string[] = Array.isArray(invData?.programmeIds) ? invData.programmeIds : [];
            for (const pid of programmeIds) {
              if (!pid || typeof pid !== 'string') continue;
              try {
                await db.collection('programmes').doc(pid).update({
                  assignedPMIds: FieldValue.arrayUnion(uid)
                });
              } catch (e) {
                console.warn(`[invite-consume] Failed to roster ${uid} into programme ${pid}:`, (e as any)?.message || e);
              }
            }

            // If it was a workspace-level invitation (no projectId), delete it
            if (!invData?.projectId) {
              await db.collection('invitations').doc(invSnap.docs[0].id).delete();
            }
          } else {
            // No invitation and no role: assign default read-only Viewer role.
            // Invitation-based signups above are unaffected — an admin explicitly
            // invited that person, so they still land as project_manager immediately.
            const now = new Date().toISOString();
            await db.collection('users').doc(uid).set({
              email,
              role: 'viewer',
              supervisorUid: null,
              updatedAt: now,
              ...(!profileData.createdAt ? { createdAt: now } : {}),
            }, { merge: true });

            profileData = {
              ...profileData,
              email,
              role: 'viewer',
              supervisorUid: null
            };
          }
        }

        // Backfill createdAt for existing users who predate the field
        if (!profileData.createdAt) {
          try {
            const authUser = await getAuthService().getUser(uid);
            const createdAt = authUser.metadata.creationTime || new Date().toISOString();
            await db.collection('users').doc(uid).update({ createdAt });
            profileData = { ...profileData, createdAt };
          } catch (e) {
            // non-fatal — just won't have a joined date this call
          }
        }

        return res.status(200).json({ success: true, profile: profileData });
  },

  savePreference: async (req, res, ctx) => {
    const { db, uid, email, userData, primaryUid, isAdmin, SYSTEM_ADMIN_EMAILS, isAuthorizedForContext, getAuthService, getMessagingService } = ctx;
    const { key, value } = req.body;
        if (!key) return res.status(400).json({ error: 'Missing key' });

        await db.collection('users').doc(uid).collection('data').doc('preferences').set({
          [key]: value,
          updatedAt: FieldValue.serverTimestamp()
        }, { merge: true });

        return res.status(200).json({ success: true });
  },

  getPreferences: async (req, res, ctx) => {
    const { db, uid, email, userData, primaryUid, isAdmin, SYSTEM_ADMIN_EMAILS, isAuthorizedForContext, getAuthService, getMessagingService } = ctx;
    const doc = await db.collection('users').doc(uid).collection('data').doc('preferences').get();
        return res.status(200).json({ success: true, preferences: doc.exists ? doc.data() : {} });
  },
};
