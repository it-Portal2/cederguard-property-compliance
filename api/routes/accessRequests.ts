import { ApiContext } from '../lib/context.js';
import { logActivity } from '../lib/activityLog.js';
import { sendEmail, escapeHtml, renderEmail } from '../lib/email.js';

const APP_URL = (process.env.APP_URL || 'https://cedarguard.co.uk').replace(/\/+$/, '');
import { adminRoutes } from './admin.js';

const ACCESS_REQUESTS = 'accessRequests';

async function resolveTenantAdmins(db: any, clientId: string): Promise<{ uid: string; email: string }[]> {
  const snap = await db.collection('users')
    .where('clientId', '==', clientId)
    .where('role', 'in', ['client_admin', 'enterprise'])
    .get();
  const admins: { uid: string; email: string }[] = snap.docs
    .map((d: any) => ({ uid: d.id, email: d.data()?.email }))
    .filter((a: any) => a.email);

  // The tenant owner (root account) typically has no `clientId` pointing at
  // itself, so it wouldn't be found by the query above — include it directly.
  const ownerDoc = await db.collection('users').doc(clientId).get();
  if (ownerDoc.exists) {
    const ownerData = ownerDoc.data() || {};
    if (ownerData.email && !admins.find((a) => a.uid === clientId)) {
      admins.push({ uid: clientId, email: ownerData.email });
    }
  }
  return admins;
}

export const accessRequestsRoutes: Record<string, (req: any, res: any, ctx: ApiContext) => Promise<any>> = {

  // Any signed-in viewer may call this — must stay in VIEWER_ALLOWED_ACTIONS.
  // Read-only: does the caller already have a pending request? Lets the
  // Request Access modal show the "already submitted, please wait" state on
  // open instead of re-prompting the form. Must stay in VIEWER_ALLOWED_ACTIONS.
  getMyAccessRequest: async (req, res, ctx) => {
    const { db, uid } = ctx;
    const snap = await db.collection(ACCESS_REQUESTS)
      .where('uid', '==', uid)
      .where('status', '==', 'pending')
      .limit(1)
      .get();
    if (snap.empty) return res.status(200).json({ success: true, pending: false, request: null });
    const doc = snap.docs[0];
    return res.status(200).json({ success: true, pending: true, request: { id: doc.id, ...doc.data() } });
  },

  createAccessRequest: async (req, res, ctx) => {
    const { db, uid, email, userData, primaryUid } = ctx;
    const { reason, attemptedAction } = req.body || {};
    const cappedReason = reason ? String(reason).slice(0, 500) : null;
    const cappedAttemptedAction = attemptedAction ? String(attemptedAction).slice(0, 100) : null;
    const displayLabel = userData?.displayName || email;

    // One pending request per user — re-requesting while already pending is a no-op.
    const existing = await db.collection(ACCESS_REQUESTS)
      .where('uid', '==', uid)
      .where('status', '==', 'pending')
      .limit(1)
      .get();
    if (!existing.empty) {
      const doc = existing.docs[0];
      return res.status(200).json({ success: true, request: { id: doc.id, ...doc.data() }, alreadyPending: true });
    }

    const now = new Date().toISOString();
    const docRef = await db.collection(ACCESS_REQUESTS).add({
      uid,
      email,
      displayName: userData?.displayName || null,
      clientId: primaryUid,
      requestedRole: 'project_manager',
      status: 'pending',
      reason: cappedReason,
      attemptedAction: cappedAttemptedAction,
      createdAt: now,
      reviewedAt: null,
      reviewedBy: null,
      reviewerEmail: null,
    });

    await logActivity(ctx, 'access_request_created', {
      category: 'create',
      entityType: 'accessRequest',
      entityId: docRef.id,
      entityName: displayLabel,
      details: { requestedRole: 'project_manager', attemptedAction: cappedAttemptedAction },
    });

    try {
      const admins = await resolveTenantAdmins(db, primaryUid);
      const reasonBlock = cappedReason
        ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0 4px;"><tr><td style="background:#f8fafc;border:1px solid #e5e7eb;border-radius:8px;padding:12px 16px;font-size:13px;line-height:1.6;color:#475569;"><span style="display:block;font-weight:600;color:#334155;margin-bottom:4px;">Reason provided</span>${escapeHtml(cappedReason)}</td></tr></table>`
        : `<p style="margin:16px 0 4px;font-size:13px;color:#94a3b8;">No reason was provided.</p>`;
      const adminHtml = renderEmail({
        previewText: `${displayLabel} has requested Project Manager access.`,
        heading: 'New access request',
        bodyHtml: `<p style="margin:0 0 4px;"><strong>${escapeHtml(displayLabel)}</strong> has requested <strong>Project Manager</strong> access to your CedarGuard workspace.</p>${reasonBlock}`,
        cta: { label: 'Review in Admin Panel', url: `${APP_URL}/admin` },
      });
      for (const admin of admins) {
        await sendEmail({
          to: admin.email,
          subject: `Access request from ${displayLabel}`,
          html: adminHtml,
        });
      }
    } catch (e: any) {
      console.error('[createAccessRequest] admin notification failed (non-fatal):', e?.message || e);
    }

    return res.status(200).json({ success: true, request: { id: docRef.id } });
  },

  adminGetAccessRequests: async (req, res, ctx) => {
    const { db, isAdmin } = ctx;
    if (!isAdmin) return res.status(403).json({ error: 'Forbidden' });

    const snap = await db.collection(ACCESS_REQUESTS).orderBy('createdAt', 'desc').limit(500).get();
    const requests = snap.docs.map((d: any) => ({ id: d.id, ...d.data() }));
    return res.status(200).json({ success: true, requests });
  },

  adminApproveAccessRequest: async (req, res, ctx) => {
    const { db, uid, email, isAdmin } = ctx;
    if (!isAdmin) return res.status(403).json({ error: 'Forbidden' });

    const { requestId } = req.body || {};
    if (!requestId) return res.status(400).json({ error: 'Missing requestId' });

    const reqRef = db.collection(ACCESS_REQUESTS).doc(requestId);
    const reqDoc = await reqRef.get();
    if (!reqDoc.exists) return res.status(404).json({ error: 'Access request not found' });
    const reqData: any = reqDoc.data();

    if (reqData.status !== 'pending') {
      return res.status(200).json({ success: true, status: reqData.status, unchanged: true });
    }

    // Reuse adminPromoteUser's role-transition logic in-process rather than
    // duplicating it — it already handles the client_admin/super_admin
    // permission rules correctly.
    let promoteOk = true;
    let promoteError: string | null = null;
    const fakeRes = {
      status: (code: number) => ({
        json: (body: any) => {
          if (code >= 400) { promoteOk = false; promoteError = body?.error || 'Promotion failed'; }
          return body;
        },
      }),
    };
    await adminRoutes.adminPromoteUser(
      { body: { targetUid: reqData.uid, newRole: 'project_manager' } },
      fakeRes,
      ctx,
    );
    if (!promoteOk) return res.status(500).json({ error: promoteError || 'Failed to promote user' });

    const now = new Date().toISOString();
    await reqRef.set({
      status: 'approved',
      reviewedAt: now,
      reviewedBy: uid,
      reviewerEmail: email,
    }, { merge: true });

    await logActivity(ctx, 'access_request_approved', {
      category: 'approve',
      entityType: 'accessRequest',
      entityId: requestId,
      entityName: reqData.displayName || reqData.email,
      details: { promotedTo: 'project_manager' },
    });

    try {
      await sendEmail({
        to: reqData.email,
        subject: 'Your CedarGuard access request was approved',
        html: renderEmail({
          previewText: 'Your Project Manager access has been approved.',
          heading: 'Access approved',
          bodyHtml: `<p style="margin:0 0 12px;">Hi ${escapeHtml(reqData.displayName || 'there')},</p><p style="margin:0 0 12px;">Your request for <strong>Project Manager</strong> access to CedarGuard has been approved.</p><p style="margin:0;">Please refresh CedarGuard — or sign out and back in — to see your new permissions.</p>`,
          cta: { label: 'Open CedarGuard', url: APP_URL },
        }),
      });
    } catch (e: any) {
      console.error('[adminApproveAccessRequest] email failed (non-fatal):', e?.message || e);
    }

    return res.status(200).json({ success: true, status: 'approved' });
  },

  adminRejectAccessRequest: async (req, res, ctx) => {
    const { db, uid, email, isAdmin } = ctx;
    if (!isAdmin) return res.status(403).json({ error: 'Forbidden' });

    const { requestId, reason } = req.body || {};
    if (!requestId) return res.status(400).json({ error: 'Missing requestId' });

    const reqRef = db.collection(ACCESS_REQUESTS).doc(requestId);
    const reqDoc = await reqRef.get();
    if (!reqDoc.exists) return res.status(404).json({ error: 'Access request not found' });
    const reqData: any = reqDoc.data();

    if (reqData.status !== 'pending') {
      return res.status(200).json({ success: true, status: reqData.status, unchanged: true });
    }

    const cappedReason = reason ? String(reason).slice(0, 500) : null;
    const now = new Date().toISOString();
    await reqRef.set({
      status: 'rejected',
      reviewedAt: now,
      reviewedBy: uid,
      reviewerEmail: email,
      ...(cappedReason ? { rejectionReason: cappedReason } : {}),
    }, { merge: true });

    await logActivity(ctx, 'access_request_rejected', {
      category: 'approve',
      entityType: 'accessRequest',
      entityId: requestId,
      entityName: reqData.displayName || reqData.email,
      details: { reason: cappedReason },
    });

    try {
      const reasonBlock = cappedReason
        ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0 4px;"><tr><td style="background:#f8fafc;border:1px solid #e5e7eb;border-radius:8px;padding:12px 16px;font-size:13px;line-height:1.6;color:#475569;"><span style="display:block;font-weight:600;color:#334155;margin-bottom:4px;">Reason</span>${escapeHtml(cappedReason)}</td></tr></table>`
        : '';
      await sendEmail({
        to: reqData.email,
        subject: 'Update on your CedarGuard access request',
        html: renderEmail({
          previewText: 'An update on your CedarGuard access request.',
          heading: 'Access request declined',
          bodyHtml: `<p style="margin:0 0 12px;">Hi ${escapeHtml(reqData.displayName || 'there')},</p><p style="margin:0 0 4px;">After review, your request for <strong>Project Manager</strong> access to CedarGuard was not approved at this time.</p>${reasonBlock}<p style="margin:16px 0 0;">If you believe this was in error, please contact your workspace admin.</p>`,
        }),
      });
    } catch (e: any) {
      console.error('[adminRejectAccessRequest] email failed (non-fatal):', e?.message || e);
    }

    return res.status(200).json({ success: true, status: 'rejected' });
  },
};
