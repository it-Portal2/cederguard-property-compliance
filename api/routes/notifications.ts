import { FieldValue } from 'firebase-admin/firestore';
import { ApiContext } from '../lib/context.js';

export const notificationsRoutes: Record<string, (req: any, res: any, ctx: ApiContext) => Promise<any>> = {
  
  registerDeviceToken: async (req, res, ctx) => {
    const { db, uid } = ctx;
    const { fcmToken, platform } = req.body;
    
    if (!fcmToken) return res.status(400).json({ error: 'Missing fcmToken' });
    
    await db.collection('users').doc(uid).update({
      fcmToken,
      lastTokenUpdate: FieldValue.serverTimestamp(),
      platform: platform || 'web'
    });
    
    return res.status(200).json({ success: true });
  },

  sendPushNotification: async (req, res, ctx) => {
    const { userData, getMessagingService } = ctx;
    const { targetUid, title, body, data } = req.body;
    
    if (!userData.role || userData.role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden: Admin access required' });
    }
    
    const targetUserDoc = await ctx.db.collection('users').doc(targetUid).get();
    if (!targetUserDoc.exists) return res.status(404).json({ error: 'Target user not found' });
    
    const targetData = targetUserDoc.data() || {};
    if (!targetData.fcmToken) return res.status(400).json({ error: 'Target user has no registered device token' });
    
    const response = await getMessagingService().send({
      token: targetData.fcmToken,
      notification: { title, body },
      data: data || {}
    });
    
    return res.status(200).json({ success: true, messageId: response });
  },

  sendNotification: async (req, res, ctx) => {
    const { userData, getMessagingService } = ctx;
    const { fcmToken, title, body } = req.body;
    
    if (!fcmToken) return res.status(400).json({ error: 'Missing fcmToken' });
    
    if (userData.role !== 'admin' && userData.role !== 'client_admin') {
       return res.status(403).json({ error: 'Forbidden: Insufficient privileges' });
    }

    const response = await getMessagingService().send({
      token: fcmToken,
      notification: { title: title || 'New Alert', body: body || 'You have a new message' }
    });
    return res.status(200).json({ success: true, messageId: response });
  },
};
