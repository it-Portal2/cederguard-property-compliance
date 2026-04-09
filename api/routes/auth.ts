import { ApiContext } from '../lib/context.js';
import crypto from 'crypto';

export const authRoutes: Record<string, (req: any, res: any, ctx: ApiContext) => Promise<any>> = {
  generateApiKey: async (req, res, ctx) => {
    const { db, uid, email, userData } = ctx;
    const { name } = req.body;

    if (userData?.role === 'viewer') {
      return res.status(403).json({ error: 'Forbidden: Viewers cannot generate API keys' });
    }
    
    // Generate a random 32 character hex string
    const cryptoContent = crypto.randomBytes(32).toString('hex');
    const token = `cdR_${cryptoContent}`;

    await db.collection('apiKeys').doc(token).set({
      uid,
      name: (typeof name === 'string' ? name.trim().slice(0, 100) : '') || 'API Key',
      createdAt: new Date().toISOString()
    });

    db.collection('activityLogs').add({ 
      type: 'api_key_created', 
      uid, 
      email, 
      timestamp: new Date().toISOString() 
    }).catch(console.error);
    
    return res.status(200).json({ success: true, key: token });
  },

  getApiKeys: async (req, res, ctx) => {
    const { db, uid } = ctx;
    const snap = await db.collection('apiKeys').where('uid', '==', uid).get();
    
    // Do not return the full key to the frontend for security, only a preview
    const keys = snap.docs.map(doc => {
      const fullKey = doc.id;
      return {
        id: fullKey,
        name: doc.data().name || 'API Key',
        createdAt: doc.data().createdAt,
        prefix: fullKey.substring(0, 8) + '...' + fullKey.substring(fullKey.length - 4)
      };
    });
    return res.status(200).json({ success: true, keys });
  },

  revokeApiKey: async (req, res, ctx) => {
    const { db, uid, email } = ctx;
    const { keyId } = req.body;
    if (!keyId) return res.status(400).json({ error: 'Missing keyId' });

    const keyDoc = await db.collection('apiKeys').doc(keyId).get();
    if (keyDoc.exists && keyDoc.data()?.uid === uid) {
      await db.collection('apiKeys').doc(keyId).delete();
      db.collection('activityLogs').add({ 
        type: 'api_key_revoked', 
        uid, 
        email, 
        timestamp: new Date().toISOString() 
      }).catch(console.error);
    }
    return res.status(200).json({ success: true });
  },

  deleteUserAccount: async (req, res, ctx) => {
    const { db, uid, email, getAuthService, isAdmin } = ctx;
    const { targetUid } = req.body;
    
    let uidToDelete = uid;
    if (targetUid && targetUid !== uid) {
      if (!isAdmin) {
        return res.status(403).json({ error: 'Forbidden: Only super admins can delete other users' });
      }
      uidToDelete = targetUid;
    }

    // 1. Delete all projects where userId == uidToDelete (they are the explicit owner)
    // Note: Projects created by this user but owned by a Client Admin (userId = Client Admin) are kept.
    const projectsSnap = await db.collection('projects').where('userId', '==', uidToDelete).get();
    for (const pDoc of projectsSnap.docs) {
       const pid = pDoc.id;
       // Delete evidence linked to this project
       const evidenceSnap = await db.collection('evidence').where('project', '==', pid).get();
       for (const eDoc of evidenceSnap.docs) {
           await eDoc.ref.delete();
       }
       // Delete all subcollection data stored under projects/{pid}/data/
       const dataSnap = await db.collection('projects').doc(pid).collection('data').get();
       for (const dDoc of dataSnap.docs) {
           await dDoc.ref.delete();
       }
       await pDoc.ref.delete();
    }

    // 1b. Delete top-level programme docs owned by this user
    const programmesSnap = await db.collection('programmes').where('userId', '==', uidToDelete).get();
    for (const progDoc of programmesSnap.docs) {
      await progDoc.ref.delete();
    }

    // 2. Delete nested data maps in the users collection
    const collectionsToClear = [
      'programmes', 'systemMappings', 'globalRisks', 'preferences',
      'complianceItems', 'complianceAnalysis', 'risks', 'issues',
      'kris', 'tasks', 'lessonsLearned',
    ];
    for (const coll of collectionsToClear) {
       await db.collection('users').doc(uidToDelete).collection('data').doc(coll).delete();
    }

    // 3. Delete the main user document
    await db.collection('users').doc(uidToDelete).delete();

    // 4. Delete all API keys belonging to this user
    const apiKeysSnap = await db.collection('apiKeys').where('uid', '==', uidToDelete).get();
    for (const keyDoc of apiKeysSnap.docs) {
       await keyDoc.ref.delete();
    }

    // 5. Delete Firebase Auth User Record (revoke refresh tokens first to invalidate live sessions)
    try {
       await getAuthService().revokeRefreshTokens(uidToDelete);
       await getAuthService().deleteUser(uidToDelete);
    } catch (authErr) {
       console.error('Failed to delete user from Firebase Auth. It might already be removed.', authErr);
    }

    // 6. Log deletion
    db.collection('activityLogs').add({
       type: 'account_deleted',
       uid, 
       email, 
       targetUid: uidToDelete,
       timestamp: new Date().toISOString()
    }).catch(console.error);

    return res.status(200).json({ success: true, message: 'User account completely erased.' });
  },
};
