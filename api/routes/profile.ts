import { FieldValue } from 'firebase-admin/firestore';
import { ApiContext } from '../lib/context.js';

export const profileRoutes: Record<string, (req: any, res: any, ctx: ApiContext) => Promise<any>> = {
  saveProfile: async (req, res, ctx) => {
    const { db, uid, email, userData, primaryUid, isAdmin, SYSTEM_ADMIN_EMAILS, isAuthorizedForContext, getAuthService, getMessagingService } = ctx;
    const { profile } = req.body;
        if (!profile) return res.status(400).json({ error: 'Missing profile data' });
        
        // Whitelist allowed fields to prevent privilege escalation
        const allowedFields = ['displayName', 'photoURL', 'phoneNumber', 'bio', 'onboardingCompleted', 'theme', 'geminiBackupKey', 'fcmToken'];
        const sanitizedProfile: any = {};
        allowedFields.forEach(field => {
          if (profile[field] !== undefined) sanitizedProfile[field] = profile[field];
        });

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
            const requestedRole = invData?.role || 'project_manager';

            await db.collection('users').doc(uid).set({
              email,
              role: requestedRole,
              clientId: invData?.clientId || invData?.invitedBy,
              updatedAt: new Date().toISOString()
            }, { merge: true });

            profileData = {
              ...profileData,
              email,
              role: requestedRole,
              clientId: invData?.clientId || invData?.invitedBy
            };

            // If it was a workspace-level invitation (no projectId), delete it
            if (!invData?.projectId) {
              await db.collection('invitations').doc(invSnap.docs[0].id).delete();
            }
          } else {
            // No invitation and no role: assign default Project Manager role
            await db.collection('users').doc(uid).set({
              email,
              role: 'project_manager',
              updatedAt: new Date().toISOString()
            }, { merge: true });

            profileData = {
              ...profileData,
              email,
              role: 'project_manager'
            };
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
