import { FieldValue } from 'firebase-admin/firestore';
import crypto from 'crypto';
import { ApiContext } from '../lib/context.js';
import { sendEmail, escapeHtml, renderEmail } from '../lib/email.js';
import { logActivity } from '../lib/activityLog.js';
import { uploadAsset } from '../lib/storage.js';

const APP_URL = (process.env.APP_URL || 'https://cedarguard.co.uk').replace(/\/+$/, '');
const CTO_EMAIL = process.env.CTO_EMAIL || 'cto@cedarguard.co.uk';

function generateTicketCode(): string {
  const now = new Date();
  const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let suffix = '';
  for (let i = 0; i < 4; i++) {
    suffix += chars[Math.floor(Math.random() * chars.length)];
  }
  return `CG-TKT-${dateStr}-${suffix}`;
}

export const supportTicketsRoutes: Record<string, (req: any, res: any, ctx: ApiContext) => Promise<any>> = {
  // ── 1. Create Support Ticket ──────────────────────────────────────────────
  createSupportTicket: async (req, res, ctx) => {
    const { db, uid, email, displayName, primaryUid, isAdmin } = ctx;
    const {
      subject,
      category = 'technical_issue',
      featureArea,
      issueType,
      priority = 'medium',
      description,
      projectRef,
      propertyRef,
      stepsToReproduce,
      impact,
      contactPhone,
    } = req.body || {};

    if (!subject || typeof subject !== 'string' || !subject.trim()) {
      return res.status(400).json({ error: 'Subject is required' });
    }
    if (!description || typeof description !== 'string' || !description.trim()) {
      return res.status(400).json({ error: 'Description is required' });
    }

    // Get user profile organization and role
    let orgName = '';
    let userRole = 'user';
    try {
      const userDoc = await db.collection('users').doc(uid).get();
      if (userDoc.exists) {
        const udata = userDoc.data() || {};
        userRole = udata.role || 'user';
        orgName = udata.organizationName || udata.councilName || udata.company || udata.clientName || '';
      }
    } catch {
      // Non-fatal profile lookup
    }
    if (!orgName) {
      orgName = 'CedarGuard Workspace';
    }

    const ticketCode = generateTicketCode();
    const cleanSubject = subject.trim();
    const cleanDescription = description.trim();
    const resolvedRef = projectRef ? String(projectRef).trim() : (propertyRef ? String(propertyRef).trim() : null);
    const cleanCategory = featureArea && issueType
      ? `${featureArea}: ${issueType}`
      : String(category || 'technical_issue').trim();
    const cleanPriority = ['low', 'medium', 'high', 'critical'].includes(priority) ? priority : 'medium';
    const callerName = displayName || email.split('@')[0] || 'User';

    const slaMap: Record<string, string> = {
      critical: 'Within 2 Hours (Urgent Technical Escalation)',
      high: 'Within 8-12 Hours (High Priority)',
      medium: 'Within 24 Hours (Standard Support)',
      low: 'Within 48 Hours (General Inquiry)',
    };
    const slaText = slaMap[cleanPriority] || 'Within 24 Hours';

    // ── Attachment processing ──
    const { attachment } = req.body || {};
    let attachmentUrl: string | null = null;
    let attachmentName: string | null = null;
    let attachmentType: string | null = null;

    if (attachment && typeof attachment.base64 === 'string' && attachment.base64.trim()) {
      try {
        const rawBase64 = attachment.base64.replace(/^data:[^;]+;base64,/, '');
        const buffer = Buffer.from(rawBase64, 'base64');
        const safeName = (attachment.name || 'screenshot.png').replace(/[^a-zA-Z0-9.-]/g, '_');
        const mime = attachment.type || 'image/png';
        const storagePath = `support-tickets/${ticketCode}/${Date.now()}_${safeName}`;
        const uploadResult = await uploadAsset(storagePath, buffer, mime, { makePublic: true });
        attachmentUrl = uploadResult?.url || null;
        attachmentName = attachment.name || safeName;
        attachmentType = mime;
      } catch (uploadErr) {
        console.error('[createSupportTicket] Attachment upload failed (non-fatal):', uploadErr);
      }
    }

    const initialMessages = [
      {
        id: crypto.randomUUID(),
        senderId: uid,
        senderName: callerName,
        senderEmail: email,
        senderRole: userRole,
        isAdmin: false,
        text: cleanDescription,
        attachmentUrl,
        attachmentName,
        attachmentType,
        createdAt: new Date().toISOString(),
      },
      {
        id: crypto.randomUUID(),
        senderId: 'system',
        senderName: 'CedarGuard Support Desk',
        senderEmail: 'support@cedarguard.co.uk',
        senderRole: 'support_admin',
        isAdmin: true,
        text: `Hello ${callerName}, your ticket has been assigned reference ${ticketCode}. Our engineering and technical team is actively reviewing your request. Target update window: ${slaText}. You can post replies or additional screenshots directly in this chat thread.`,
        createdAt: new Date(Date.now() + 500).toISOString(),
      },
    ];

    const ticketData = {
      ticketCode,
      subject: cleanSubject,
      category: cleanCategory,
      featureArea: featureArea ? String(featureArea).trim() : null,
      issueType: issueType ? String(issueType).trim() : null,
      priority: cleanPriority,
      status: 'open',
      description: cleanDescription,
      attachmentUrl: attachmentUrl || null,
      attachmentName: attachmentName || null,
      attachmentType: attachmentType || null,
      projectRef: resolvedRef,
      propertyRef: resolvedRef,
      stepsToReproduce: stepsToReproduce ? String(stepsToReproduce).trim() : null,
      impact: impact ? String(impact).trim() : null,
      contactPhone: contactPhone ? String(contactPhone).trim() : null,
      userId: uid,
      userEmail: email,
      userName: callerName,
      userRole,
      clientId: primaryUid || uid,
      clientName: orgName,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      resolvedAt: null,
      resolvedBy: null,
      resolutionNotes: null,
      messages: initialMessages,
    };

    const docRef = await db.collection('support_tickets').add(ticketData);

    // ── Resend Transactional Email #1: Confirmation to User ──
    try {
      const userHtml = renderEmail({
        previewText: `[${ticketCode}] CedarGuard support ticket received: ${cleanSubject}`,
        heading: `Support Ticket Acknowledged: ${ticketCode}`,
        bodyHtml: `
          <p style="margin:0 0 16px;">Dear ${escapeHtml(callerName)},</p>
          <p style="margin:0 0 16px;">Thank you for contacting CedarGuard Technical Support. Your ticket has been logged into our support queue and assigned for review.</p>
          
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0;border:1px solid #e2e8f0;border-radius:8px;background:#f8fafc;">
            <tr>
              <td style="padding:12px 16px;border-bottom:1px solid #e2e8f0;font-size:13px;color:#64748b;width:30%;"><strong>Ticket Reference</strong></td>
              <td style="padding:12px 16px;border-bottom:1px solid #e2e8f0;font-size:13px;color:#0f172a;font-weight:600;"><span style="font-family:monospace;background:#e2e8f0;padding:2px 6px;border-radius:4px;">${escapeHtml(ticketCode)}</span></td>
            </tr>
            <tr>
              <td style="padding:12px 16px;border-bottom:1px solid #e2e8f0;font-size:13px;color:#64748b;"><strong>Subject</strong></td>
              <td style="padding:12px 16px;border-bottom:1px solid #e2e8f0;font-size:13px;color:#0f172a;">${escapeHtml(cleanSubject)}</td>
            </tr>
            <tr>
              <td style="padding:12px 16px;border-bottom:1px solid #e2e8f0;font-size:13px;color:#64748b;"><strong>Priority / Urgency</strong></td>
              <td style="padding:12px 16px;border-bottom:1px solid #e2e8f0;font-size:13px;color:#0f172a;text-transform:capitalize;">${escapeHtml(cleanPriority)}</td>
            </tr>
            <tr>
              <td style="padding:12px 16px;border-bottom:1px solid #e2e8f0;font-size:13px;color:#64748b;"><strong>Target SLA</strong></td>
              <td style="padding:12px 16px;border-bottom:1px solid #e2e8f0;font-size:13px;color:#0f172a;">${escapeHtml(slaText)}</td>
            </tr>
            ${resolvedRef ? `
            <tr>
              <td style="padding:12px 16px;border-bottom:1px solid #e2e8f0;font-size:13px;color:#64748b;"><strong>Project / Programme</strong></td>
              <td style="padding:12px 16px;border-bottom:1px solid #e2e8f0;font-size:13px;color:#0f172a;">${escapeHtml(resolvedRef)}</td>
            </tr>` : ''}
            <tr>
              <td style="padding:12px 16px;font-size:13px;color:#64748b;"><strong>Details</strong></td>
              <td style="padding:12px 16px;font-size:13px;color:#334155;line-height:1.5;">${escapeHtml(cleanDescription)}</td>
            </tr>
          </table>

          <p style="margin:16px 0 0;font-size:13px;color:#64748b;">You can monitor progress, add additional context, or review updates directly in your CedarGuard dashboard.</p>
        `,
        cta: {
          label: 'Track Ticket in CedarGuard',
          url: `${APP_URL}/support-tickets`,
        },
      });

      await sendEmail({
        to: email,
        subject: `[${ticketCode}] Support Ticket Acknowledged: ${cleanSubject}`,
        html: userHtml,
      });
    } catch (err: any) {
      console.error('[createSupportTicket] User confirmation email failed (non-fatal):', err?.message || err);
    }

    // ── Resend Transactional Email #2: Alert to CTO & Escalation Team ──
    try {
      const ctoHtml = renderEmail({
        previewText: `[NEW TICKET - ${cleanPriority.toUpperCase()}] ${ticketCode}: ${cleanSubject}`,
        heading: `New Support Ticket Logged: ${ticketCode}`,
        bodyHtml: `
          <p style="margin:0 0 16px;">A new support ticket has been submitted on CedarGuard Platform.</p>
          
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0;border:1px solid #e2e8f0;border-radius:8px;background:#f8fafc;">
            <tr>
              <td style="padding:10px 14px;border-bottom:1px solid #e2e8f0;font-size:13px;color:#64748b;width:30%;"><strong>Ticket ID</strong></td>
              <td style="padding:10px 14px;border-bottom:1px solid #e2e8f0;font-size:13px;color:#0f172a;font-weight:bold;">${escapeHtml(ticketCode)}</td>
            </tr>
            <tr>
              <td style="padding:10px 14px;border-bottom:1px solid #e2e8f0;font-size:13px;color:#64748b;"><strong>Requester</strong></td>
              <td style="padding:10px 14px;border-bottom:1px solid #e2e8f0;font-size:13px;color:#0f172a;">${escapeHtml(callerName)} (${escapeHtml(email)})</td>
            </tr>
            <tr>
              <td style="padding:10px 14px;border-bottom:1px solid #e2e8f0;font-size:13px;color:#64748b;"><strong>Council / Org</strong></td>
              <td style="padding:10px 14px;border-bottom:1px solid #e2e8f0;font-size:13px;color:#0f172a;">${escapeHtml(orgName)}</td>
            </tr>
            <tr>
              <td style="padding:10px 14px;border-bottom:1px solid #e2e8f0;font-size:13px;color:#64748b;"><strong>Category</strong></td>
              <td style="padding:10px 14px;border-bottom:1px solid #e2e8f0;font-size:13px;color:#0f172a;">${escapeHtml(cleanCategory)}</td>
            </tr>
            <tr>
              <td style="padding:10px 14px;border-bottom:1px solid #e2e8f0;font-size:13px;color:#64748b;"><strong>Priority</strong></td>
              <td style="padding:10px 14px;border-bottom:1px solid #e2e8f0;font-size:13px;color:#b91c1c;font-weight:600;text-transform:uppercase;">${escapeHtml(cleanPriority)}</td>
            </tr>
            ${resolvedRef ? `
            <tr>
              <td style="padding:10px 14px;border-bottom:1px solid #e2e8f0;font-size:13px;color:#64748b;"><strong>Project / Programme</strong></td>
              <td style="padding:10px 14px;border-bottom:1px solid #e2e8f0;font-size:13px;color:#0f172a;">${escapeHtml(resolvedRef)}</td>
            </tr>` : ''}
            <tr>
              <td style="padding:10px 14px;font-size:13px;color:#64748b;"><strong>Issue Details</strong></td>
              <td style="padding:10px 14px;font-size:13px;color:#334155;line-height:1.5;">${escapeHtml(cleanDescription)}</td>
            </tr>
          </table>
        `,
        cta: {
          label: 'Open Platform Admin Panel',
          url: `${APP_URL}/admin`,
        },
      });

      await sendEmail({
        to: CTO_EMAIL,
        subject: `[NEW TICKET: ${cleanPriority.toUpperCase()}] ${ticketCode}: ${cleanSubject} (${orgName})`,
        html: ctoHtml,
      });
    } catch (err: any) {
      console.error('[createSupportTicket] CTO notification email failed (non-fatal):', err?.message || err);
    }

    await logActivity(ctx, 'support_ticket_created', {
      category: 'create',
      entityType: 'support_ticket',
      entityId: docRef.id,
      entityName: `${ticketCode} - ${cleanSubject}`,
      details: {
        ticketCode,
        priority: cleanPriority,
        category: cleanCategory,
      },
    });

    return res.status(200).json({
      success: true,
      ticket: {
        id: docRef.id,
        ticketCode,
        subject: cleanSubject,
        category: cleanCategory,
        priority: cleanPriority,
        status: 'open',
        createdAt: new Date().toISOString(),
      },
    });
  },

  // ── 2. Get My Support Tickets (Caller or Caller's Org) ─────────────────────
  getMySupportTickets: async (req, res, ctx) => {
    const { db, uid, primaryUid } = ctx;

    try {
      let snap;
      if (primaryUid && primaryUid !== uid) {
        snap = await db
          .collection('support_tickets')
          .where('clientId', '==', primaryUid)
          .limit(100)
          .get();
      } else {
        snap = await db
          .collection('support_tickets')
          .where('userId', '==', uid)
          .limit(100)
          .get();
      }

      const tickets = snap.docs.map(doc => {
        const d = doc.data();
        return {
          id: doc.id,
          ...d,
          createdAt: d.createdAt?.toDate ? d.createdAt.toDate().toISOString() : d.createdAt,
          updatedAt: d.updatedAt?.toDate ? d.updatedAt.toDate().toISOString() : d.updatedAt,
          resolvedAt: d.resolvedAt?.toDate ? d.resolvedAt.toDate().toISOString() : d.resolvedAt,
        };
      });

      // In-memory sort avoids requiring composite index in Firestore
      tickets.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());

      return res.status(200).json({ success: true, tickets });
    } catch (e: any) {
      console.error('[getMySupportTickets] Error:', e);
      return res.status(500).json({ success: false, error: e.message || 'Failed to fetch tickets' });
    }
  },

  // ── 3. Get Support Ticket Details ─────────────────────────────────────────
  getSupportTicketDetails: async (req, res, ctx) => {
    const { db, uid, primaryUid, isAdmin } = ctx;
    const { id, ticketCode } = req.body || {};

    if (!id && !ticketCode) {
      return res.status(400).json({ error: 'Missing ticket ID or ticket code' });
    }

    try {
      let ticketDoc: any = null;
      if (id) {
        ticketDoc = await db.collection('support_tickets').doc(id).get();
      } else {
        const snap = await db.collection('support_tickets').where('ticketCode', '==', ticketCode).limit(1).get();
        if (!snap.empty) {
          ticketDoc = snap.docs[0];
        }
      }

      if (!ticketDoc || !ticketDoc.exists) {
        return res.status(404).json({ error: 'Ticket not found' });
      }

      const ticketData = ticketDoc.data() || {};

      // Security check: author, same organization, or admin
      const isAuthor = ticketData.userId === uid;
      const isSameOrg = ticketData.clientId === primaryUid;
      if (!isAuthor && !isSameOrg && !isAdmin) {
        return res.status(403).json({ error: 'Forbidden: Access to this ticket is restricted' });
      }

      return res.status(200).json({
        success: true,
        ticket: {
          id: ticketDoc.id,
          ...ticketData,
          createdAt: ticketData.createdAt?.toDate ? ticketData.createdAt.toDate().toISOString() : ticketData.createdAt,
          updatedAt: ticketData.updatedAt?.toDate ? ticketData.updatedAt.toDate().toISOString() : ticketData.updatedAt,
          resolvedAt: ticketData.resolvedAt?.toDate ? ticketData.resolvedAt.toDate().toISOString() : ticketData.resolvedAt,
        },
      });
    } catch (e: any) {
      console.error('[getSupportTicketDetails] Error:', e);
      return res.status(500).json({ success: false, error: e.message });
    }
  },

  // ── 4. Add Message to Ticket Thread ───────────────────────────────────────
  addSupportTicketMessage: async (req, res, ctx) => {
    const { db, uid, email, displayName, primaryUid, isAdmin } = ctx;
    const { id, message, newStatus, attachment } = req.body || {};

    if (!id || (!message && !attachment)) {
      return res.status(400).json({ error: 'Ticket id and message or attachment are required' });
    }

    try {
      const ticketRef = db.collection('support_tickets').doc(id);
      const ticketDoc = await ticketRef.get();

      if (!ticketDoc.exists) {
        return res.status(404).json({ error: 'Ticket not found' });
      }

      const ticketData = ticketDoc.data() || {};
      const isAuthor = ticketData.userId === uid;
      const isSameOrg = ticketData.clientId === primaryUid;

      if (!isAuthor && !isSameOrg && !isAdmin) {
        return res.status(403).json({ error: 'Forbidden' });
      }

      const senderName = displayName || email.split('@')[0] || (isAdmin ? 'CedarGuard Support' : 'User');
      const cleanMessage = String(message || '').trim();

      // Attachment processing
      let attachmentUrl: string | null = null;
      let attachmentName: string | null = null;
      let attachmentType: string | null = null;

      if (attachment && typeof attachment.base64 === 'string' && attachment.base64.trim()) {
        try {
          const rawBase64 = attachment.base64.replace(/^data:[^;]+;base64,/, '');
          const buffer = Buffer.from(rawBase64, 'base64');
          const safeName = (attachment.name || 'attachment.png').replace(/[^a-zA-Z0-9.-]/g, '_');
          const mime = attachment.type || 'image/png';
          const storagePath = `support-tickets/${ticketData.ticketCode || id}/${Date.now()}_${safeName}`;
          const uploadResult = await uploadAsset(storagePath, buffer, mime, { makePublic: true });
          attachmentUrl = uploadResult?.url || null;
          attachmentName = attachment.name || safeName;
          attachmentType = mime;
        } catch (uploadErr) {
          console.error('[addSupportTicketMessage] Attachment upload failed (non-fatal):', uploadErr);
        }
      }

      const newMsg = {
        id: crypto.randomUUID(),
        senderId: uid,
        senderName,
        senderEmail: email,
        senderRole: isAdmin ? 'support_admin' : (ticketData.userRole || 'user'),
        isAdmin: !!isAdmin,
        text: cleanMessage,
        attachmentUrl,
        attachmentName,
        attachmentType,
        createdAt: new Date().toISOString(),
      };

      const updatePayload: any = {
        messages: FieldValue.arrayUnion(newMsg),
        updatedAt: FieldValue.serverTimestamp(),
      };

      if (isAdmin && newStatus && ['open', 'in_progress', 'waiting_on_client', 'resolved', 'closed'].includes(newStatus)) {
        updatePayload.status = newStatus;
        if (newStatus === 'resolved' || newStatus === 'closed') {
          updatePayload.resolvedAt = FieldValue.serverTimestamp();
          updatePayload.resolvedBy = email;
        }
      }

      await ticketRef.update(updatePayload);

      // ── Resend Email Notification of New Message ──
      try {
        const targetEmail = isAdmin ? ticketData.userEmail : CTO_EMAIL;
        const heading = isAdmin
          ? `CedarGuard Support Reply: ${ticketData.ticketCode}`
          : `New Client Message on Ticket: ${ticketData.ticketCode}`;

        const notifHtml = renderEmail({
          previewText: `New message on support ticket ${ticketData.ticketCode}`,
          heading,
          bodyHtml: `
            <p style="margin:0 0 12px;"><strong>${escapeHtml(senderName)}</strong> added a response to ticket <strong>${escapeHtml(ticketData.ticketCode)}</strong>:</p>
            <div style="background:#f8fafc;border-left:4px solid #4f46e5;padding:12px 16px;border-radius:4px;font-size:14px;color:#334155;line-height:1.6;margin:16px 0;">
              ${escapeHtml(cleanMessage)}
            </div>
            ${newStatus ? `<p style="font-size:13px;color:#64748b;">Ticket status updated to: <strong style="text-transform:capitalize;color:#0f172a;">${escapeHtml(newStatus.replace('_', ' '))}</strong></p>` : ''}
          `,
          cta: {
            label: isAdmin ? 'View Ticket' : 'Open Admin Panel',
            url: isAdmin ? `${APP_URL}/contact` : `${APP_URL}/admin`,
          },
        });

        await sendEmail({
          to: targetEmail,
          subject: `[${ticketData.ticketCode}] Update: ${ticketData.subject}`,
          html: notifHtml,
        });
      } catch (err) {
        console.error('[addSupportTicketMessage] Notification email failed (non-fatal):', err);
      }

      return res.status(200).json({ success: true, message: newMsg });
    } catch (e: any) {
      console.error('[addSupportTicketMessage] Error:', e);
      return res.status(500).json({ success: false, error: e.message });
    }
  },

  // ── 5. Admin: Get All Support Tickets ─────────────────────────────────────
  adminGetSupportTickets: async (req, res, ctx) => {
    const { db, isAdmin } = ctx;
    if (!isAdmin) return res.status(403).json({ error: 'Forbidden: Admin access required' });

    try {
      const snap = await db.collection('support_tickets').orderBy('createdAt', 'desc').limit(500).get();

      const tickets = snap.docs.map(doc => {
        const d = doc.data();
        return {
          id: doc.id,
          ...d,
          createdAt: d.createdAt?.toDate ? d.createdAt.toDate().toISOString() : d.createdAt,
          updatedAt: d.updatedAt?.toDate ? d.updatedAt.toDate().toISOString() : d.updatedAt,
          resolvedAt: d.resolvedAt?.toDate ? d.resolvedAt.toDate().toISOString() : d.resolvedAt,
        };
      });

      return res.status(200).json({ success: true, tickets });
    } catch (e: any) {
      console.error('[adminGetSupportTickets] Error:', e);
      return res.status(500).json({ success: false, error: e.message });
    }
  },

  // ── 6. Admin: Update Ticket Status & Resolution Notes ─────────────────────
  adminUpdateSupportTicketStatus: async (req, res, ctx) => {
    const { db, isAdmin, email, displayName } = ctx;
    const { id, status, resolutionNotes } = req.body || {};

    if (!isAdmin) return res.status(403).json({ error: 'Forbidden: Admin access required' });
    if (!id || !status) return res.status(400).json({ error: 'Missing ticket id or status' });

    try {
      const ticketRef = db.collection('support_tickets').doc(id);
      const ticketDoc = await ticketRef.get();

      if (!ticketDoc.exists) {
        return res.status(404).json({ error: 'Ticket not found' });
      }

      const ticketData = ticketDoc.data() || {};
      const isResolved = status === 'resolved' || status === 'closed';

      const updatePayload: any = {
        status,
        updatedAt: FieldValue.serverTimestamp(),
      };

      if (resolutionNotes !== undefined) {
        updatePayload.resolutionNotes = resolutionNotes ? String(resolutionNotes).trim() : null;
      }

      if (isResolved) {
        updatePayload.resolvedAt = FieldValue.serverTimestamp();
        updatePayload.resolvedBy = email;
      }

      // Add a resolution message to the thread if notes provided
      if (resolutionNotes && String(resolutionNotes).trim()) {
        const adminMsg = {
          id: crypto.randomUUID(),
          senderId: ctx.uid,
          senderName: displayName || 'CedarGuard Technical Lead',
          senderEmail: email,
          senderRole: 'support_admin',
          isAdmin: true,
          text: `[Resolution Update - ${status.toUpperCase()}]: ${String(resolutionNotes).trim()}`,
          createdAt: new Date().toISOString(),
        };
        updatePayload.messages = FieldValue.arrayUnion(adminMsg);
      }

      await ticketRef.update(updatePayload);

      // Email the user that their ticket has been updated / resolved
      try {
        const statusLabel = status.replace('_', ' ').toUpperCase();
        const userHtml = renderEmail({
          previewText: `Your CedarGuard support ticket ${ticketData.ticketCode} status: ${statusLabel}`,
          heading: `Ticket Status Update: ${ticketData.ticketCode}`,
          bodyHtml: `
            <p style="margin:0 0 16px;">Dear ${escapeHtml(ticketData.userName || 'Client')},</p>
            <p style="margin:0 0 16px;">Your support ticket <strong>${escapeHtml(ticketData.ticketCode)}</strong> (${escapeHtml(ticketData.subject)}) has been updated to status: <strong style="color:${isResolved ? '#059669' : '#4f46e5'};">${escapeHtml(statusLabel)}</strong>.</p>
            ${resolutionNotes ? `
            <div style="background:#f0fdf4;border:1px solid #bbf7d0;padding:12px 16px;border-radius:8px;font-size:13px;color:#166534;line-height:1.6;margin:16px 0;">
              <strong>Technical Resolution / Response:</strong><br />
              ${escapeHtml(resolutionNotes)}
            </div>` : ''}
            <p style="font-size:13px;color:#64748b;">If you need any further assistance with this matter, you can reply directly within the portal.</p>
          `,
          cta: {
            label: 'View Ticket in CedarGuard',
            url: `${APP_URL}/contact`,
          },
        });

        await sendEmail({
          to: ticketData.userEmail,
          subject: `[${ticketData.ticketCode}] Status Update (${statusLabel}): ${ticketData.subject}`,
          html: userHtml,
        });
      } catch (err) {
        console.error('[adminUpdateSupportTicketStatus] Email notification failed (non-fatal):', err);
      }

      await logActivity(ctx, 'support_ticket_status_updated', {
        category: 'update',
        entityType: 'support_ticket',
        entityId: id,
        entityName: `${ticketData.ticketCode} - ${status}`,
        details: { status, resolutionNotes: resolutionNotes || null },
      });

      return res.status(200).json({ success: true });
    } catch (e: any) {
      console.error('[adminUpdateSupportTicketStatus] Error:', e);
      return res.status(500).json({ success: false, error: e.message });
    }
  },
};
