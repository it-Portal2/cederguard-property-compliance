import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { ApiContext } from '../lib/context.js';
import crypto from 'crypto';
import { appendHistoryRow } from '../lib/historyRows.js';
import { uploadAsset } from '../lib/storage.js';
import {
  HRC_LEGACY_COLLECTIONS,
  type LegacyCollection,
} from '../../shared/types/historicalReporting.js';
import {
  detectSevereTransitions,
  writeSevereEscalations,
} from '../lib/riskSevereEscalation.js';
import { logActivity, logArrayChanges } from '../lib/activityLog.js';

// Legacy single-array collections persisted via the generic saveData
// chokepoint that need field-level history captured pre-mutation.
const HRC_TRACKED_LEGACY_COLLECTIONS: ReadonlyArray<string> = HRC_LEGACY_COLLECTIONS;

export const dataRoutes: Record<string, (req: any, res: any, ctx: ApiContext) => Promise<any>> = {
  saveData: async (req, res, ctx) => {
    const { db, uid, email, primaryUid, isAuthorizedForContext } = ctx;
    const { collection, data, projectId } = req.body;
    if (!collection || data === undefined) return res.status(400).json({ error: 'Missing collection or data' });

    let pathRef: FirebaseFirestore.DocumentReference | undefined;
    if (projectId) {
      if (!(await isAuthorizedForContext(projectId))) {
        return res.status(403).json({ error: 'Forbidden: You do not have access to this project.' });
      }
      pathRef = db.collection('projects').doc(projectId).collection('data').doc(collection);

      // Capture pre-mutation array state for tracked legacy collections
      // (risks, complianceItems, issues, kris) so a future point-in-time
      // query can replay state at any timestamp. Reads BEFORE writing so
      // prevState reflects the actual pre-mutation doc. Best-effort:
      // appendHistoryRow swallows errors so a history failure never
      // blocks the user's save.
      const isHrcTracked =
        HRC_TRACKED_LEGACY_COLLECTIONS.includes(collection) && data !== undefined;
      let hrcPrevArray: unknown[] | null = null;
      if (isHrcTracked) {
        try {
          const existing = await pathRef.get();
          const existingArr = existing.exists ? (existing.data() as any)?.data : null;
          hrcPrevArray = Array.isArray(existingArr) ? existingArr : null;
        } catch (err) {
          console.error('[hrc] saveData prev-state read failed:', err);
        }
      }

      if (data === null) {
        await pathRef.delete();
      } else {
        await pathRef.set({ data, updatedAt: Timestamp.fromMillis(Date.now()) });
      }

      if (isHrcTracked) {
        const newArr = data === null ? null : (Array.isArray(data) ? data : []);
        const changeKind =
          data === null
            ? 'softDelete'
            : hrcPrevArray === null
              ? 'create'
              : 'update';
        // Fire-and-forget — caller doesn't await and we don't await
        // either, since errors are swallowed inside appendHistoryRow.
        void appendHistoryRow(ctx, {
          kind: 'legacyArray',
          collection: collection as LegacyCollection,
          ownerScope: projectId,
          prevState: hrcPrevArray,
          newState: newArr,
          changeKind,
        });
      }

      // Activity log: for the item-array collections, diff old vs new to record
      // WHICH item (by name) was created/updated/deleted + by whom. For the
      // non-array complianceAnalysis, log a single update event.
      if (['risks', 'issues', 'complianceItems', 'kris'].includes(collection) && data !== null) {
        await logArrayChanges(ctx, collection, projectId, hrcPrevArray, data);
      } else if (collection === 'complianceAnalysis') {
        await logActivity(ctx, 'compliance_analysis_saved', {
          category: 'update',
          entityType: 'compliance',
          entityId: projectId,
          details: { project: projectId },
        });
      }

      // Severe-risk escalation: when a saved risks array contains a risk
      // that transitioned INTO Severe state (Impact = 5 on gross or residual),
      // write a severeRiskAlerts row plus an activity log entry and resolve
      // Strategic Director recipients. Idempotent — re-saves of an
      // already-Severe risk do not re-trigger.
      let severeNotified: { count: number; recipientCount: number } | undefined;
      if (
        collection === 'risks' &&
        Array.isArray(data) &&
        data.length > 0
      ) {
        try {
          const transitions = detectSevereTransitions(hrcPrevArray, data);
          if (transitions.length > 0) {
            // Programme vs project context: detect by reading the project doc.
            // If the contextId resolves to a project, it's project-kind; if it
            // resolves to a programme, it's programme-kind. Fall back to
            // project-kind when unclear (most common case).
            let contextKind: 'project' | 'programme' = 'project';
            try {
              const progDoc = await db.collection('programmes').doc(projectId).get();
              if (progDoc.exists) contextKind = 'programme';
            } catch (err) {
              console.error('[rsc-d] context-kind probe failed:', err);
            }
            const summary = await writeSevereEscalations(ctx, {
              transitions,
              contextId: projectId,
              contextKind,
            });
            if (summary.alertCount > 0) {
              severeNotified = {
                count: summary.alertCount,
                recipientCount: summary.recipientCount,
              };
            }
          }
        } catch (err) {
          // Never block save on Severe-detection failure.
          console.error('[rsc-d] severe-escalation pipeline failed:', err);
        }
      }

      return res.status(200).json({ success: true, ...(severeNotified ? { severeNotified } : {}) });
    } else if (collection === 'programmes') {
      // Standardize: programmes stored as documents in top-level collection indexed by clientId
      if (Array.isArray(data)) {
        for (const programme of data) {
          const isNew = !programme.id;
          const progId = programme.id || `PROG-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
          await db.collection('programmes').doc(progId).set({
            ...programme,
            id: progId,
            clientId: primaryUid,
            userId: uid,
            updatedAt: FieldValue.serverTimestamp()
          }, { merge: true });
          await logActivity(ctx, isNew ? 'programme_created' : 'programme_updated', {
            category: isNew ? 'create' : 'update',
            entityType: 'programme',
            entityId: progId,
            entityName: programme.name ?? null,
          });
        }
        return res.status(200).json({ success: true });
      } else {
        // Single programme update
        const isNew = !data.id;
        const progId = data.id || `PROG-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
        await db.collection('programmes').doc(progId).set({
          ...data,
          id: progId,
          clientId: primaryUid,
          userId: uid,
          updatedAt: FieldValue.serverTimestamp()
        }, { merge: true });
        await logActivity(ctx, isNew ? 'programme_created' : 'programme_updated', {
          category: isNew ? 'create' : 'update',
          entityType: 'programme',
          entityId: progId,
          entityName: data.name ?? null,
        });
        return res.status(200).json({ success: true, id: progId });
      }
    } else if (['systemMappings', 'globalRisks'].includes(collection)) {
      // Standardize shared organization data to top-level collections
      pathRef = db.collection(collection).doc(primaryUid);
    } else {
      // Legacy subcollection storage for other personal data
      pathRef = db.collection('users').doc(uid).collection('data').doc(collection);
    }

    if (pathRef) {
      if (data === null) {
        await pathRef.delete();
      } else {
        await pathRef.set({ data });
      }
    }

    // Log meaningful save events (legacy / non-project-scoped path)
    if (['risks', 'issues', 'complianceItems', 'complianceAnalysis'].includes(collection)) {
      const count = Array.isArray(data) ? data.length : (data ? 1 : 0);
      await logActivity(ctx, `${collection}_saved`, {
        category: 'update',
        entityType: collection,
        entityId: projectId || 'legacy',
        details: { count, scope: 'legacy' },
      });
    }
    return res.status(200).json({ success: true });
  },

  getData: async (req, res, ctx) => {
    const { db, uid, email, primaryUid, isAdmin, isClientAdmin, isAuthorizedForContext } = ctx;
    const { collection, projectId } = req.body;
    if (!collection) return res.status(400).json({ error: 'Missing collection' });

    if (projectId) {
      if (!(await isAuthorizedForContext(projectId))) {
        return res.status(403).json({ error: 'Forbidden: You do not have access to this project.' });
      }
      const pathRef = db.collection('projects').doc(projectId).collection('data').doc(collection);
      const doc = await pathRef.get();
      return res.status(200).json({
        success: true,
        data: doc.exists ? doc.data()?.data : null,
      });
    } else if (collection === 'programmes') {
      const pmFilter = req.body.pmFilter; // Optional filter for fetching a specific manager's programmes

      if (isClientAdmin && !pmFilter) {
        // Client Admins and Enterprise users see all programmes in their organisation by default
        const allSnap = await db.collection('programmes').where('clientId', '==', primaryUid).get();
        return res.status(200).json({ success: true, data: allSnap.docs.map(d => ({ id: d.id, ...d.data() })) });
      }

      // Fetch from top-level collection gated by clientId (scoped), userId, or pm
      // For PMs/Programme Managers, we ONLY want their own or the filtered ones.
      const queries = [];

      if (pmFilter) {
        // Fetch programmes where the specified filter matches creator or manager
        queries.push(db.collection('programmes').where('clientId', '==', primaryUid).where('userId', '==', pmFilter).get());
        queries.push(db.collection('programmes').where('clientId', '==', primaryUid).where('creatorId', '==', pmFilter).get());
      } else {
        // Default: just my own programmes
        queries.push(db.collection('programmes').where('userId', '==', uid).get());
        queries.push(db.collection('programmes').where('creatorId', '==', uid).get());
        if (email) {
          queries.push(db.collection('programmes').where('pm', '==', email).get());
          queries.push(db.collection('programmes').where('userId', '==', email).get());
        }
      }
      
      const snaps = await Promise.all(queries);
      const programmesMap = new Map();
      
      snaps.forEach(snap => {
        snap.docs.forEach(doc => {
          programmesMap.set(doc.id, { id: doc.id, ...doc.data() });
        });
      });
      
      return res.status(200).json({ success: true, data: Array.from(programmesMap.values()) });
    } else if (collection === 'projects') {
      if (isAdmin) {
        const allSnap = await db.collection('projects').get();
        return res.status(200).json({ success: true, data: allSnap.docs.map(d => ({ id: d.id, ...d.data() })) });
      }

      const queries = [];
      if (isClientAdmin) {
        // Client Admins see all projects in their organization
        queries.push(db.collection('projects').where('clientId', '==', primaryUid).get());
        
        // Also fetch project assignments via identifiers
        const orgUsersSnap = await db.collection('users').where('clientId', '==', primaryUid).get();
        const allMemberIdentifiers = orgUsersSnap.docs.map(d => d.id);
        orgUsersSnap.docs.forEach(d => { if (d.data()?.email) allMemberIdentifiers.push(d.data().email.toLowerCase()); });

        if (!allMemberIdentifiers.includes(primaryUid)) allMemberIdentifiers.push(primaryUid);
        if (!allMemberIdentifiers.includes(uid)) allMemberIdentifiers.push(uid);
        if (email && !allMemberIdentifiers.includes(email)) allMemberIdentifiers.push(email);

        const uniqueIdentifiers = Array.from(new Set(allMemberIdentifiers));
        for (let i = 0; i < uniqueIdentifiers.length; i += 10) {
          const chunk = uniqueIdentifiers.slice(i, i + 10);
          queries.push(db.collection('projects').where('userId', 'in', chunk).get());
        }
      } else {
        // Project Managers see only their own projects or assigned ones
        queries.push(db.collection('projects').where('userId', '==', uid).get());
        queries.push(db.collection('projects').where('creatorId', '==', uid).get());
        if (email) {
          queries.push(db.collection('projects').where('pm', '==', email).get());
          queries.push(db.collection('projects').where('userId', '==', email).get());
        }
      }
      
      const snaps = await Promise.all(queries);
      const projectMap = new Map();
      
      snaps.forEach(snap => {
        snap.docs.forEach(doc => {
          projectMap.set(doc.id, { id: doc.id, ...doc.data() });
        });
      });
      
      return res.status(200).json({ success: true, data: Array.from(projectMap.values()) });
    } else {
      let doc;
      if (['systemMappings', 'globalRisks'].includes(collection)) {
        doc = await db.collection(collection).doc(primaryUid).get();
        if (!doc.exists) {
          doc = await db.collection('users').doc(primaryUid).collection('data').doc(collection).get();
        }
      } else {
        doc = await db.collection('users').doc(uid).collection('data').doc(collection).get();
      }
      
      return res.status(200).json({ success: true, data: doc.exists ? doc.data()?.data : null });
    }
  },

  getEvidence: async (req, res, ctx) => {
    const { db, uid, email, primaryUid, isAdmin, isAuthorizedForContext } = ctx;
    const { projectId } = req.body;
    const isAggregate = !projectId || projectId === 'all' || projectId === 'portfolio';

    if (isAggregate) {
      if (isAdmin) {
        const snap = await db.collection('evidence').orderBy('createdAt', 'desc').limit(150).get();
        return res.status(200).json({ success: true, data: snap.docs.map(d => ({ id: d.id, ...d.data() })) });
      }

      const projSnap = await db.collection('projects').where('clientId', '==', primaryUid).get();
      const ownedProjSnap = await db.collection('projects').where('userId', '==', uid).get();
      const progSnap = await db.collection('programmes').where('clientId', '==', primaryUid).get();
      
      let authorizedIds = Array.from(new Set([
        ...projSnap.docs.map(d => d.id), 
        ...ownedProjSnap.docs.map(d => d.id),
        ...progSnap.docs.map(d => d.id)
      ]));

      if (authorizedIds.length === 0) return res.status(200).json({ success: true, data: [] });

      let allEvidence: any[] = [];
      for (let i = 0; i < authorizedIds.length; i += 30) {
        const chunk = authorizedIds.slice(i, i + 30);
        const snap = await db.collection('evidence').where('project', 'in', chunk).limit(300).get();
        allEvidence = [...allEvidence, ...snap.docs.map(d => ({ id: d.id, ...d.data() }))];
      }
      
      return res.status(200).json({ success: true, data: allEvidence });
    }

    const isAuthorized = await isAuthorizedForContext(projectId);
    if (!isAuthorized) {
      return res.status(403).json({ error: 'Forbidden: You do not have access to this project or programme.' });
    }

    let targetContextIds = [projectId];
    const progDoc = await db.collection('programmes').doc(projectId).get();
    if (progDoc.exists) {
      const projectsSnap = await db.collection('projects').where('programmeId', '==', projectId).get();
      const pids = projectsSnap.docs.map(d => d.id);
      if (pids.length > 0) {
        targetContextIds = [...targetContextIds, ...pids];
      }
    }

    let data: any[] = [];
    if (targetContextIds.length > 30) {
      for (let i = 0; i < targetContextIds.length; i += 30) {
        const chunk = targetContextIds.slice(i, i + 30);
        const snap = await db.collection('evidence').where('project', 'in', chunk).get();
        data = [...data, ...snap.docs.map(doc => ({ id: doc.id, ...doc.data() }))];
      }
    } else {
      const snap = await db.collection('evidence').where('project', 'in', targetContextIds).get();
      data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    }

    // Meaningful view-access log (Option A): someone opened a specific project's
    // evidence. Aggregate/dashboard reads above are intentionally not logged.
    await logActivity(ctx, 'evidence_viewed', {
      category: 'read',
      entityType: 'project',
      entityId: projectId,
      entityName: (await db.collection('projects').doc(projectId).get()).data()?.name ?? null,
      details: { count: data.length },
    });

    return res.status(200).json({ success: true, data });
  },

  addEvidence: async (req, res, ctx) => {
    const { db, uid, email, isAuthorizedForContext } = ctx;
    const { projectId, document, file } = req.body;
    if (!projectId || !document) return res.status(400).json({ error: 'Missing data' });

    if (!(await isAuthorizedForContext(projectId))) {
      return res.status(403).json({ error: 'Forbidden: You do not have access to upload evidence here.' });
    }

    // Two call shapes:
    //   (a) External link (no file payload) — { projectId, document: { name, url,
    //       storagePath:'external-link', type:'link', ... } }. Just write the
    //       Firestore record.
    //   (b) File upload — { projectId, document: { name, type, ... }, file: {
    //       base64, mime } }. Decode + upload to GCS via uploadAsset with
    //       makePublic, store the returned public URL on the Firestore doc
    //       so the client can render the download link directly without an
    //       extra API hop. Paths include a 13-digit millisecond timestamp +
    //       sanitized filename so the URLs are not practically guessable.
    let finalDocument: any = { ...document };
    if (file && typeof file.base64 === 'string' && file.base64.length > 0) {
      const mime = typeof file.mime === 'string' && file.mime.length > 0
        ? file.mime
        : 'application/octet-stream';

      // Accept both bare base64 and `data:.;base64,.` URIs (parity with
      // tacFileUpload.decodeBase64TacFile).
      const dataUriMatch = file.base64.match(/^data:[^;]+;base64,(.+)$/);
      const payload = dataUriMatch ? dataUriMatch[1] : file.base64;

      let buffer: Buffer;
      try {
        buffer = Buffer.from(payload, 'base64');
      } catch (e: any) {
        return res.status(400).json({ error: `Invalid base64 payload: ${e?.message ?? 'unknown'}` });
      }
      if (buffer.length === 0) {
        return res.status(400).json({ error: 'Decoded file is empty.' });
      }
      // Server-side enforcement of the 3 MB per-file cap. Client validates
      // before send for UX, but the server is the source of truth.
      const MAX_FILE_BYTES = 3 * 1024 * 1024;
      if (buffer.length > MAX_FILE_BYTES) {
        const sizeMb = (buffer.length / 1024 / 1024).toFixed(1);
        return res.status(400).json({
          error: `File is too large (${sizeMb} MB). Maximum is 3 MB per file.`,
        });
      }

      const sanitizedName = String(document.name || 'file').replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 200);
      const timestamp = Date.now();
      const storagePath = `evidence/${projectId}/${timestamp}_${sanitizedName}`;

      let uploadedUrl = '';
      try {
        const result = await uploadAsset(storagePath, buffer, mime, { makePublic: true });
        uploadedUrl = result.url;
      } catch (err: any) {
        console.error('[addEvidence] upload failed:', err?.message || err);
        return res.status(500).json({ error: `Upload failed: ${err?.message ?? 'unknown'}` });
      }

      finalDocument = {
        ...finalDocument,
        storagePath,
        // Public GCS URL — stable, cacheable, works from any origin.
        // Same pattern as governance branding. Path includes a 13-digit
        // millisecond timestamp + sanitized filename, so URLs are not
        // practically guessable. If stricter privacy is needed in the
        // future (true per-request auth), switch to server-streamed
        // downloads via an API route. The V4 signed-URL alternative is
        // unreliable on this stack — see api/routes/storage.ts header
        // comment for the SignatureDoesNotMatch story.
        url: uploadedUrl,
        size: buffer.length,
        type: finalDocument.type || mime,
      };
    }

    const docRef = await db.collection('evidence').add({
      ...finalDocument,
      project: projectId,
      userId: uid,
      uploadedBy: email,
      createdAt: FieldValue.serverTimestamp(),
    });
    await logActivity(ctx, 'evidence_added', {
      category: 'create',
      entityType: 'evidence',
      entityId: docRef.id,
      entityName: document.name || 'Evidence document',
      details: { projectId, isLink: finalDocument.storagePath === 'external-link' },
    });
    return res.status(200).json({ success: true, id: docRef.id });
  },

  deleteEvidence: async (req, res, ctx) => {
    const { db, isAuthorizedForContext, getStorageBucket } = ctx;
    const { docId } = req.body;
    if (!docId) return res.status(400).json({ error: 'Missing docId' });

    const evidenceDoc = await db.collection('evidence').doc(docId).get();
    if (!evidenceDoc.exists) return res.status(200).json({ success: true });

    const evidenceData = evidenceDoc.data();
    if (!(await isAuthorizedForContext(evidenceData?.project))) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    // Delete the GCS object first (best-effort) — closes the storage-orphan
    // hole that existed when this lived on the client side: previously the
    // Firestore doc was deleted but the file behind it persisted forever.
    // Failure here doesn't block the Firestore delete; the doc-delete is
    // what makes the file invisible to users.
    const storagePath = evidenceData?.storagePath;
    if (storagePath && storagePath !== 'external-link') {
      try {
        await getStorageBucket().file(storagePath).delete({ ignoreNotFound: true });
      } catch (err: any) {
        console.warn('[deleteEvidence] storage object delete failed (continuing):', err?.message || err);
      }
    }

    await db.collection('evidence').doc(docId).delete();
    await logActivity(ctx, 'evidence_deleted', {
      category: 'delete',
      entityType: 'evidence',
      entityId: docId,
      entityName: evidenceData?.name || 'Evidence document',
      details: { projectId: evidenceData?.project ?? null },
    });
    return res.status(200).json({ success: true });
  },

  updateEvidence: async (req, res, ctx) => {
    const { db, isAuthorizedForContext } = ctx;
    const { docId, updates } = req.body;
    if (!docId || !updates) return res.status(400).json({ error: 'Missing data' });
    
    const evidenceDoc = await db.collection('evidence').doc(docId).get();
    if (!evidenceDoc.exists) return res.status(404).json({ error: 'Document not found' });
    
    const evidenceData = evidenceDoc.data();
    if (!(await isAuthorizedForContext(evidenceData?.project))) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    
    await db.collection('evidence').doc(docId).set({
      ...updates,
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });

    await logActivity(ctx, 'evidence_updated', {
      category: 'update',
      entityType: 'evidence',
      entityId: docId,
      entityName: updates.name || evidenceData?.name || 'Evidence document',
      details: { projectId: evidenceData?.project ?? null, changedFields: Object.keys(updates || {}) },
    });
    return res.status(200).json({ success: true });
  },

  getSystemMappings: async (req, res, ctx) => {
    const { db, primaryUid } = ctx;
    const doc = await db.collection('systemMappings').doc(primaryUid).get();
    if (doc.exists) {
      const mappings = doc.data()?.data || [];
      return res.status(200).json({ success: true, mappings });
    }
    
    const snap = await db.collection('systemMappings').get();
    const mappings = snap.docs.filter(d => d.id !== primaryUid).map(doc => ({ id: doc.id, ...doc.data() }));
    return res.status(200).json({ success: true, mappings });
  },
};
