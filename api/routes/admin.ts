import { FieldValue } from 'firebase-admin/firestore';
import { ApiContext } from '../lib/context.js';
import crypto from 'crypto';
import { ROLE_STRINGS, PM_LEVELS } from '../../shared/constants/roleConstants.js';
import {
  CONFIG_DOC_PATH,
  SEED_CONFIG,
  loadAIModelConfig,
  validateAIModelConfig,
  bumpAIModelConfigCacheBuster,
  type AIModelConfig,
  type ChatModelEntry,
} from '../lib/aiModelConfig.js';
import { fetchOpenRouterCatalog } from '../lib/openRouterCatalog.js';
import { logActivity } from '../lib/activityLog.js';
import { runAIOperation } from '../lib/aiOperationRouter.js';

const canonicalOf = (role?: string | null): string => {
  const r = (role || "").trim().toLowerCase();
  switch (r) {
    case ROLE_STRINGS.ADMIN:
    case 'super_admin':
    case 'superadmin':
    case 'admin_employee':
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
    await logActivity(ctx, 'admin_project_deleted', {
      category: 'delete',
      entityType: 'project',
      entityId: id,
      entityName: projectData.name ?? null,
      details: { adminAction: true },
    });
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
    await logActivity(ctx, 'admin_programme_deleted', {
      category: 'delete',
      entityType: 'programme',
      entityId: id,
      entityName: progData.name ?? null,
      details: { adminAction: true },
    });
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

    // Cross-org transfer fix: if the new owner lives in a different org, also move the
    // project's clientId so authz checks keyed on clientId don't lock the new owner out.
    let newClientId = projectData.clientId;
    if (isAdmin && targetUser.uid) {
      const newOwnerDoc = await db.collection('users').doc(targetUser.uid).get();
      if (newOwnerDoc.exists) {
        const newOwnerData = newOwnerDoc.data() || {};
        const ownerClientId = newOwnerData.clientId || targetUser.uid;
        if (ownerClientId !== projectData.clientId) {
          newClientId = ownerClientId;
        }
      }
    }

    await db.collection('projects').doc(id).update({
      userId: targetUser.uid,
      pm: targetUser.email || projectData.pm,
      pmName: targetUser.displayName || targetUser.email || projectData.pmName,
      clientId: newClientId,
      updatedAt: FieldValue.serverTimestamp()
    });

    await logActivity(ctx, 'admin_project_transferred', {
      category: 'update',
      entityType: 'project',
      entityId: id,
      entityName: projectData.name ?? null,
      details: {
        adminAction: true,
        fromOwner: projectData.userId ?? null,
        toOwner: targetUser.uid,
        toOwnerEmail: targetUser.email ?? null,
      },
    });

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

    let newProgClientId = progData.clientId;
    if (isAdmin && targetUser.uid) {
      const newOwnerDoc = await db.collection('users').doc(targetUser.uid).get();
      if (newOwnerDoc.exists) {
        const newOwnerData = newOwnerDoc.data() || {};
        const ownerClientId = newOwnerData.clientId || targetUser.uid;
        if (ownerClientId !== progData.clientId) {
          newProgClientId = ownerClientId;
        }
      }
    }

    await db.collection('programmes').doc(id).update({
      userId: targetUser.uid,
      pm: targetUser.email || progData.pm,
      clientId: newProgClientId,
      updatedAt: FieldValue.serverTimestamp()
    });

    await logActivity(ctx, 'admin_programme_transferred', {
      category: 'update',
      entityType: 'programme',
      entityId: id,
      entityName: progData.name ?? null,
      details: {
        adminAction: true,
        fromOwner: progData.userId ?? null,
        toOwner: targetUser.uid,
        toOwnerEmail: targetUser.email ?? null,
      },
    });

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

    const updatedUser = (await db.collection('users').doc(targetUid).get()).data() || {};
    await logActivity(ctx, 'admin_user_update', {
      category: 'update',
      entityType: 'user',
      entityId: targetUid,
      entityName: updatedUser.displayName || updatedUser.email || targetUid,
      details: { adminAction: true, changedFields: Object.keys(updates || {}) },
    });

    return res.status(200).json({ success: true });
  },

  adminAssignSupervisor: async (req, res, ctx) => {
    const { db, uid, email, isAdmin } = ctx;
    if (!isAdmin) return res.status(403).json({ error: 'Forbidden' });

    const { targetUid, supervisorUid } = req.body;
    if (!targetUid) return res.status(400).json({ error: 'Missing targetUid' });

    const targetDoc = await db.collection('users').doc(targetUid).get();
    if (!targetDoc.exists) return res.status(404).json({ error: 'User not found' });

    if (supervisorUid) {
      const supDoc = await db.collection('users').doc(supervisorUid).get();
      if (!supDoc.exists) return res.status(404).json({ error: 'Supervisor not found' });
      const supCanonical = canonicalOf(supDoc.data()?.role);
      if (supCanonical !== 'super_admin' && supCanonical !== 'client_admin') {
        return res.status(400).json({ error: 'Target user is not a valid supervisor' });
      }
    }

    await db.collection('users').doc(targetUid).set({
      supervisorUid: supervisorUid || null,
      updatedAt: new Date().toISOString(),
    }, { merge: true });

    await logActivity(ctx, 'admin_supervisor_assigned', {
      category: 'update',
      entityType: 'user',
      entityId: targetUid,
      entityName: targetDoc.data()?.displayName || targetDoc.data()?.email || targetUid,
      details: { adminAction: true, supervisorUid: supervisorUid || null },
    });

    return res.status(200).json({ success: true });
  },

  adminPromoteUser: async (req, res, ctx) => {
    const { db, uid, email, userData, primaryUid, isAdmin } = ctx;
    const { targetUid, newRole, pmLevel } = req.body;

    if (!targetUid || !newRole) return res.status(400).json({ error: 'Missing targetUid or newRole' });

    const targetDoc = await db.collection('users').doc(targetUid).get();
    if (!targetDoc.exists) return res.status(404).json({ error: 'User not found' });
    const targetData = targetDoc.data() || {};

    const fromRole = targetData.role || null;
    const newCanonical = canonicalOf(newRole);
    const callerCanonical = canonicalOf(userData?.role);

    if (isAdmin) {
      // super_admin → can set any role
    } else if (callerCanonical === 'client_admin') {
      if (targetData.clientId !== primaryUid) {
        return res.status(403).json({ error: 'Forbidden: target outside your organisation' });
      }
      if (canonicalOf(fromRole) === 'super_admin') {
        return res.status(403).json({ error: 'Forbidden: cannot modify a super admin' });
      }
      if (newCanonical !== 'project_manager' && newCanonical !== 'client_admin') {
        return res.status(403).json({ error: 'Forbidden: client_admins can only flip between project_manager and client_admin' });
      }
    } else {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const effectiveRole =
      (newRole === 'super_admin' || newRole === 'superadmin' || newRole === 'admin' || newRole === 'admin_employee')
        ? 'admin'
        : newRole;

    const updates: any = {
      role: effectiveRole,
      updatedAt: new Date().toISOString(),
    };
    if (newCanonical === 'project_manager') {
      updates.pmLevel = PM_LEVELS.includes(pmLevel) ? pmLevel : targetData.pmLevel || 'standard';
    }

    await db.collection('users').doc(targetUid).set(updates, { merge: true });

    await logActivity(ctx, 'admin_user_promoted', {
      category: 'update',
      entityType: 'user',
      entityId: targetUid,
      entityName: targetData.displayName || targetData.email || targetUid,
      details: { adminAction: true, fromRole, toRole: effectiveRole, pmLevel: updates.pmLevel || null },
    });

    return res.status(200).json({ success: true });
  },

  adminGetActivity: async (req, res, ctx) => {
    const { db, isAdmin } = ctx;
    if (!isAdmin) return res.status(403).json({ error: 'Forbidden' });

    // Allow the client to request a larger window (the Observability/Activity
    // table paginates + filters client-side). Default 500, hard cap 2000.
    const requested = Number(req.body?.limit);
    const max = Math.min(Math.max(Number.isFinite(requested) ? requested : 500, 1), 2000);

    const snap = await db.collection('activityLogs').orderBy('timestamp', 'desc').limit(max).get();
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

    await logActivity(ctx, 'pricing_config_updated', {
      category: 'update',
      entityType: 'config',
      entityId: 'pricingConfig',
      entityName: 'Pricing configuration',
      details: { adminAction: true },
    });

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

    await logActivity(ctx, 'invoice_created', {
      category: 'create',
      entityType: 'invoice',
      entityId: docRef.id,
      entityName: invoice.invoiceNumber || invoice.number || docRef.id,
      details: { adminAction: true },
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

    const deletedInvoice = (await db.collection('invoices').doc(id).get()).data();
    await db.collection('invoices').doc(id).delete();

    await logActivity(ctx, 'invoice_deleted', {
      category: 'delete',
      entityType: 'invoice',
      entityId: id,
      entityName: deletedInvoice?.invoiceNumber || deletedInvoice?.number || id,
      details: { adminAction: true },
    });

    return res.status(200).json({ success: true });
  },

  // ── AI model configuration ────────────────────────────────────────────
  //
  // Single Firestore doc (adminConfig/aiModelConfig) holds two lists:
  // chatModels (the /chat dropdown) and operationModels (priority-ordered
  // targets used by legacy AI ops). Editable only by super-admin; read
  // surface for the dropdown (getActiveChatModels) is auth-only and
  // returns just the enabled chat entries + the admin-marked default.

  adminGetAIModelConfig: async (_req, res, ctx) => {
    const { isAdmin } = ctx;
    if (!isAdmin) return res.status(403).json({ error: 'Forbidden' });
    try {
      const config = await loadAIModelConfig(ctx);
      return res.status(200).json({ success: true, config, seedReturned: !config.updatedAt });
    } catch (e: any) {
      console.error('[adminGetAIModelConfig] failed:', e?.message);
      return res.status(500).json({ success: false, error: 'Failed to load AI model config' });
    }
  },

  adminUpdateAIModelConfig: async (req, res, ctx) => {
    const { db, uid, email, isAdmin } = ctx;
    if (!isAdmin) return res.status(403).json({ error: 'Forbidden' });
    const payload = req.body?.config;
    const validation = validateAIModelConfig(payload);
    if (!validation.valid) {
      return res.status(400).json({ success: false, errors: validation.errors });
    }
    try {
      const next: AIModelConfig = {
        ...(payload as AIModelConfig),
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: uid,
        updatedByEmail: email, // human label for the AI Models tab footer
      };
      await db.doc(CONFIG_DOC_PATH).set(next, { merge: false });
      bumpAIModelConfigCacheBuster();
      // Fire-and-forget audit trail. Never block the response on log failures.
      db.collection('auditEvents').add({
        actorUid: uid,
        action: 'adminConfig.updateAIModelConfig',
        ts: FieldValue.serverTimestamp(),
      }).catch((e) => console.error('[auditEvents] updateAIModelConfig log failed:', e?.message));
      return res.status(200).json({ success: true });
    } catch (e: any) {
      console.error('[adminUpdateAIModelConfig] failed:', e?.message);
      return res.status(500).json({ success: false, error: 'Failed to save AI model config' });
    }
  },

  getActiveChatModels: async (_req, res, ctx) => {
    // Any signed-in user — the dropdown needs to render for everyone.
    //
    // NO per-instance in-memory cache: this is a tiny, admin-authoritative
    // config doc read only when someone opens chat. A per-instance cache made
    // Vercel's multiple serverless instances disagree (one serving the new
    // list, another the stale one for up to the TTL), which surfaced in the UI
    // as a disabled/deleted model flickering in and out. Reading fresh from
    // Firestore on every request is cheap and strongly consistent, so an admin
    // add/disable/delete is reflected on the very next read.
    try {
      // Read the Firestore doc DIRECTLY (not via loadAIModelConfig, which
      // substitutes the in-memory SEED_CONFIG when the doc is missing). The
      // dropdown must reflect what an admin has ACTUALLY curated: when no doc
      // exists we return an empty list + hasAdminConfig:false so the client
      // falls back to its own free-only static list. (chatStream /
      // aiOperationRouter keep using loadAIModelConfig's seed fallback, so a
      // free model picked during this empty state still streams fine.)
      const snap = await ctx.db.doc(CONFIG_DOC_PATH).get();
      const data = snap.exists ? (snap.data() as { chatModels?: ChatModelEntry[] } | undefined) : undefined;
      const hasAdminConfig = !!(snap.exists && data && Array.isArray(data.chatModels));
      const enabled = hasAdminConfig
        ? (data!.chatModels || []).filter((m) => m.enabled)
        : [];
      const defaultEntry: ChatModelEntry | undefined =
        enabled.find((m) => m.isDefault) ?? enabled[0];
      const payload = {
        chatModels: enabled,
        defaultModelId: defaultEntry?.id ?? null,
        hasAdminConfig,
      };
      return res.status(200).json({ success: true, ...payload, cached: false });
    } catch (e: any) {
      console.error('[getActiveChatModels] failed:', e?.message);
      // Surface a safe fallback shape so the client can fall back to its
      // local registry without throwing in the UI.
      return res.status(500).json({ success: false, error: 'Failed to load active chat models' });
    }
  },

  adminGetOpenRouterCatalog: async (req, res, ctx) => {
    const { isAdmin } = ctx;
    if (!isAdmin) return res.status(403).json({ error: 'Forbidden' });
    const force = req.body?.force === true || req.query?.force === 'true';
    try {
      const result = await fetchOpenRouterCatalog({ force });
      return res.status(200).json({
        success: true,
        entries: result.entries,
        cached: result.cached,
        fetchedAt: result.fetchedAt,
      });
    } catch (e: any) {
      console.warn('[adminGetOpenRouterCatalog] upstream fetch failed:', e?.message);
      // Surface as a soft failure so the admin UI can render its hardcoded
      // curated fallback list instead of blocking the operator.
      return res.status(502).json({
        success: false,
        error: 'OpenRouter catalog temporarily unavailable',
      });
    }
  },

  // One-time, idempotent migration of legacy plaintext-doc-id API keys to the
  // hashed-at-rest scheme (B1/B2). A legacy doc stored the plaintext key AS its
  // id with no keyHash; here we derive keyHash = sha256(id), rewrite it under a
  // random doc id (no plaintext at rest), and delete the old doc. Existing keys
  // keep authenticating because context.ts finds them by the same hash.
  //
  // Skipped: docs that already carry `keyHash` (already migrated / new), and
  // SCOPED keys (Power BI feed) — those are referenced by `feedKeyId` in the
  // integration config, so moving their doc id would strand that link; they
  // don't authenticate the general /api endpoint anyway.
  adminMigrateApiKeyHashes: async (req, res, ctx) => {
    const { db, isAdmin } = ctx;
    if (!isAdmin) return res.status(403).json({ error: 'Forbidden' });

    const snap = await db.collection('apiKeys').get();
    let migrated = 0;
    let skipped = 0;
    for (const doc of snap.docs) {
      const d = doc.data() || {};
      if (d.keyHash || d.scope) { skipped++; continue; }

      const plaintext = doc.id;
      const keyHash = crypto.createHash('sha256').update(plaintext).digest('hex');
      const id = crypto.randomUUID();
      const prefix = plaintext.length > 12
        ? `${plaintext.slice(0, 8)}...${plaintext.slice(-4)}`
        : plaintext;

      await db.collection('apiKeys').doc(id).set({
        id,
        uid: d.uid,
        name: d.name || 'API Key',
        keyHash,
        prefix,
        createdAt: d.createdAt || new Date().toISOString(),
        lastUsed: d.lastUsed ?? null,
      });
      await db.collection('apiKeys').doc(doc.id).delete();
      migrated++;
    }

    await logActivity(ctx, 'api_keys_migrated', {
      category: 'system',
      entityType: 'apiKey',
      entityId: 'apiKeys',
      entityName: `API key hash migration (${migrated} migrated, ${skipped} skipped)`,
    });

    return res.status(200).json({ success: true, migrated, skipped });
  },

  // ── Admin AI Employee (Agentic Intelligence & CRUD Controller) ───────────
  adminAgentQuery: async (req, res, ctx) => {
    const { db, isAdmin, email, uid } = ctx;
    if (!isAdmin) return res.status(403).json({ error: 'Forbidden: Admin access required.' });

    const { prompt, history } = req.body || {};
    if (!prompt || typeof prompt !== 'string') {
      return res.status(400).json({ error: 'Missing prompt text' });
    }

    // 1. Multi-Collection Telemetry Aggregation
    const [usersSnap, logsSnap, ticketsSnap, projectsSnap, progsSnap, reqsSnap] = await Promise.all([
      db.collection('users').get(),
      db.collection('activityLogs').orderBy('timestamp', 'desc').limit(400).get(),
      db.collection('support_tickets').orderBy('createdAt', 'desc').limit(200).get(),
      db.collection('projects').get(),
      db.collection('programmes').get(),
      db.collection('access_requests').get(),
    ]);

    const users = usersSnap.docs.map(d => ({ uid: d.id, ...d.data() }));
    const logs = logsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    const tickets = ticketsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    const projects = projectsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    const programmes = progsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    const accessRequests = reqsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    // Role counts & activity time windows
    const roleCounts: Record<string, number> = {};
    const now = Date.now();
    const oneDayAgo = now - 24 * 60 * 60 * 1000;
    const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
    const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;

    let activeUsers24h = 0;
    let activeUsers7d = 0;
    let activeUsers30d = 0;
    const userActivityMap: Record<string, { count: number; timestamps: number[]; email: string; displayName?: string; role: string }> = {};

    users.forEach((u: any) => {
      const r = canonicalOf(u.role);
      roleCounts[r] = (roleCounts[r] || 0) + 1;
      const t = u.updatedAt ? new Date(u.updatedAt).getTime() : 0;
      if (t > oneDayAgo) activeUsers24h++;
      if (t > sevenDaysAgo) activeUsers7d++;
      if (t > thirtyDaysAgo) activeUsers30d++;
    });

    // Parse logs for active sessions and hour estimates
    logs.forEach((l: any) => {
      const uEmail = l.userEmail || l.userId || 'unknown';
      const t = l.timestamp ? new Date(l.timestamp).getTime() : 0;
      if (!userActivityMap[uEmail]) {
        userActivityMap[uEmail] = { count: 0, timestamps: [], email: uEmail, role: l.details?.role || 'user' };
      }
      userActivityMap[uEmail].count++;
      if (t > 0) userActivityMap[uEmail].timestamps.push(t);
    });

    // Estimate user active hours (clustering actions within 30-min active windows)
    let totalPlatformUsageHours = 0;
    const userUsageStats: Array<{ email: string; actions: number; estimatedHours: number }> = [];

    Object.entries(userActivityMap).forEach(([userEmail, data]) => {
      const sorted = data.timestamps.sort((a, b) => a - b);
      let minutes = 0;
      if (sorted.length > 0) {
        minutes = 5; // minimum session block
        for (let i = 1; i < sorted.length; i++) {
          const diff = (sorted[i] - sorted[i - 1]) / (1000 * 60);
          if (diff <= 30) {
            minutes += diff;
          } else {
            minutes += 5;
          }
        }
      }
      const hours = Math.round((minutes / 60) * 10) / 10;
      totalPlatformUsageHours += hours;
      userUsageStats.push({ email: userEmail, actions: data.count, estimatedHours: hours });
    });

    userUsageStats.sort((a, b) => b.estimatedHours - a.estimatedHours);

    // Support tickets analysis
    const ticketStatusCounts: Record<string, number> = { open: 0, in_progress: 0, waiting_client: 0, resolved: 0, closed: 0 };
    const ticketSeverityCounts: Record<string, number> = { critical: 0, high: 0, medium: 0, low: 0 };
    const ticketCategoryCounts: Record<string, number> = {};
    const unresolvedTickets: any[] = [];

    tickets.forEach((t: any) => {
      const s = t.status || 'open';
      const p = t.priority || 'medium';
      const c = t.category || 'technical_issue';
      ticketStatusCounts[s] = (ticketStatusCounts[s] || 0) + 1;
      ticketSeverityCounts[p] = (ticketSeverityCounts[p] || 0) + 1;
      ticketCategoryCounts[c] = (ticketCategoryCounts[c] || 0) + 1;
      if (s === 'open' || s === 'in_progress' || s === 'waiting_client') {
        unresolvedTickets.push({
          id: t.id,
          code: t.ticketCode || t.id,
          subject: t.subject,
          description: (t.description || '').slice(0, 350),
          category: c,
          priority: p,
          status: s,
          createdAt: t.createdAt,
          reportedBy: t.createdByEmail || t.createdByName,
          orgName: t.orgName,
          impact: t.impact,
          stepsToReproduce: t.stepsToReproduce,
        });
      }
    });

    const pendingAccessRequests = accessRequests.filter((a: any) => a.status === 'pending');
    const unassignedProjects = projects.filter((p: any) => !p.pm && !p.userId);

    const telemetryData = {
      userMetrics: {
        totalUsers: users.length,
        roleCounts,
        activeUsers24h,
        activeUsers7d,
        activeUsers30d,
        topActiveUsers: userUsageStats.slice(0, 8),
        totalUsageHoursLogged: Math.round(totalPlatformUsageHours * 10) / 10,
      },
      supportTicketsMetrics: {
        total: tickets.length,
        unresolvedCount: unresolvedTickets.length,
        statusCounts: ticketStatusCounts,
        severityCounts: ticketSeverityCounts,
        categoryCounts: ticketCategoryCounts,
        recentUnresolved: unresolvedTickets.slice(0, 10),
      },
      governanceMetrics: {
        totalProjects: projects.length,
        totalProgrammes: programmes.length,
        unassignedProjectsCount: unassignedProjects.length,
        pendingAccessRequestsCount: pendingAccessRequests.length,
        pendingAccessRequests: pendingAccessRequests.slice(0, 6).map((a: any) => ({
          id: a.id,
          email: a.email,
          displayName: a.displayName,
          reason: a.reason,
          createdAt: a.createdAt,
        })),
      },
    };

    const systemPrompt = `You are the CedarGuard Platform Executive AI Employee — an autonomous, highly capable, and secure administrative operations partner serving the Platform Super Administrator (${email}).
You have direct read access to platform-wide telemetry, user activity, usage duration, support tickets, root causes, projects, programmes, and access requests.

Here is the real-time aggregated snapshot from the platform database:
${JSON.stringify(telemetryData, null, 2)}

Users Sample (First 15 for administrative reference):
${JSON.stringify(users.slice(0, 15).map((u: any) => ({ uid: u.uid, email: u.email, displayName: u.displayName, role: u.role, clientId: u.clientId, supervisorUid: u.supervisorUid })), null, 2)}

Your Core Capabilities:
1. TELEMETRY & USAGE INQUIRIES:
- Answer exact metrics about user counts, active users (24h/7d/30d), and estimated usage hours (how much time users spend active on the platform).
- Detail what specific types of activity users are performing.

2. ROOT CAUSE ANALYSIS & PROBLEM DIAGNOSTICS:
- When asked about problems, bugs, or tickets reported by client admins or project managers, analyze the issue descriptions and steps to reproduce.
- Identify the underlying root cause (e.g., missing permissions, role mismatch, unassigned supervisor, regulatory data sync, browser cache, API configuration).
- Propose clear, permanent resolutions.

3. ADMINISTRATIVE ACTION PROPOSALS (CRUD WITH APPROVAL):
- You have CRUD administrative capabilities on the platform, BUT for safety, every mutation REQUIRES Super Admin approval.
- When the Super Admin asks you to take an action (e.g., promote a user, update a profile, assign a supervisor, resolve a support ticket, approve an access request, transfer a project), or when your diagnostic points to an immediate fix:
  Explain the rationale to the administrator AND include an action proposal code block in the following exact format:

\`\`\`action_proposal
{
  "actionType": "promote_user" | "update_user" | "assign_supervisor" | "resolve_ticket" | "approve_access_request" | "reject_access_request" | "transfer_project" | "transfer_programme",
  "title": "Clear action title",
  "description": "Short explanation of what this action will execute",
  "params": {
    /* For promote_user: targetUid, newRole, pmLevel */
    /* For update_user: targetUid, updates */
    /* For assign_supervisor: targetUid, supervisorUid */
    /* For resolve_ticket: ticketId, resolutionNotes, status */
    /* For approve_access_request: requestId */
    /* For reject_access_request: requestId, reason */
    /* For transfer_project / transfer_programme: id, targetUser: { uid, email } */
  },
  "dangerLevel": "low" | "medium" | "high",
  "impactSummary": "Impact on security, permissions, or system state."
}
\`\`\`

Tone & Quality:
- Executive, precise, structured, and insightful.
- Use markdown formatting, bullet points, and tables when helpful.
- If recommending changes to a specific user or ticket, always reference their UID or Ticket ID.`;

    const conversationHistory = Array.isArray(history)
      ? history.map((h: any) => `${h.role === 'user' ? 'Admin' : 'AI Employee'}: ${h.content}`).join('\n\n')
      : '';

    const fullPrompt = `${systemPrompt}

${conversationHistory ? `Conversation Context:\n${conversationHistory}\n\n` : ''}Admin: ${prompt}
AI Employee:`;

    try {
      const routed = await runAIOperation({
        ctx,
        prompt: fullPrompt,
        config: {
          temperature: 0.3,
          maxOutputTokens: 4096,
        },
        action: 'adminAgent',
      });

      const responseText = routed?.text || '';

      let proposedAction: any = null;
      const proposalMatch = responseText.match(/```action_proposal\s*([\s\S]*?)\s*```/);
      if (proposalMatch && proposalMatch[1]) {
        try {
          proposedAction = JSON.parse(proposalMatch[1]);
          proposedAction.id = `act_${crypto.randomBytes(4).toString('hex')}`;
        } catch (e) {
          console.warn('[adminAgentQuery] Failed to parse action_proposal JSON:', e);
        }
      }

      const cleanAnswer = responseText.replace(/```action_proposal[\s\S]*?```/g, '').trim();

      return res.status(200).json({
        success: true,
        answer: cleanAnswer,
        telemetry: telemetryData,
        proposedAction,
        modelUsed: routed?.modelUsed || 'cedarguard-ai',
      });
    } catch (err: any) {
      console.error('[adminAgentQuery] AI execution error:', err);
      return res.status(500).json({
        error: 'AI Employee operation failed: ' + (err.message || 'Unknown error'),
      });
    }
  },

  adminAgentExecuteAction: async (req, res, ctx) => {
    const { db, isAdmin, email, uid } = ctx;
    if (!isAdmin) return res.status(403).json({ error: 'Forbidden: Admin access required.' });

    const { actionType, params, confirmation } = req.body || {};
    if (!confirmation) {
      return res.status(400).json({ error: 'Admin confirmation required to execute agent action.' });
    }
    if (!actionType || !params) {
      return res.status(400).json({ error: 'Missing actionType or params' });
    }

    let actionResult: any = null;

    switch (actionType) {
      case 'promote_user': {
        const { targetUid, newRole, pmLevel } = params;
        if (!targetUid || !newRole) return res.status(400).json({ error: 'Missing targetUid or newRole' });
        let err: any = null;
        const fakeRes = {
          status: (code: number) => ({
            json: (b: any) => { if (code >= 400) err = b?.error || 'Promotion failed'; return b; }
          })
        };
        await adminRoutes.adminPromoteUser({ body: { targetUid, newRole, pmLevel } }, fakeRes, ctx);
        if (err) return res.status(500).json({ error: err });
        actionResult = { message: `User ${targetUid} successfully assigned role ${newRole}.` };
        break;
      }

      case 'update_user': {
        const { targetUid, updates } = params;
        if (!targetUid || !updates) return res.status(400).json({ error: 'Missing targetUid or updates' });
        let err: any = null;
        const fakeRes = {
          status: (code: number) => ({
            json: (b: any) => { if (code >= 400) err = b?.error || 'Update failed'; return b; }
          })
        };
        await adminRoutes.adminUpdateUser({ body: { targetUid, updates } }, fakeRes, ctx);
        if (err) return res.status(500).json({ error: err });
        actionResult = { message: `User ${targetUid} profile updated successfully.` };
        break;
      }

      case 'assign_supervisor': {
        const { targetUid, supervisorUid } = params;
        if (!targetUid) return res.status(400).json({ error: 'Missing targetUid' });
        let err: any = null;
        const fakeRes = {
          status: (code: number) => ({
            json: (b: any) => { if (code >= 400) err = b?.error || 'Assignment failed'; return b; }
          })
        };
        await adminRoutes.adminAssignSupervisor({ body: { targetUid, supervisorUid } }, fakeRes, ctx);
        if (err) return res.status(500).json({ error: err });
        actionResult = { message: `Supervisor ${supervisorUid || 'none'} assigned to user ${targetUid}.` };
        break;
      }

      case 'resolve_ticket': {
        const { ticketId, resolutionNotes, status } = params;
        if (!ticketId) return res.status(400).json({ error: 'Missing ticketId' });
        const ticketRef = db.collection('support_tickets').doc(ticketId);
        const ticketDoc = await ticketRef.get();
        if (!ticketDoc.exists) return res.status(404).json({ error: 'Support ticket not found' });

        const now = new Date().toISOString();
        const nextStatus = status || 'resolved';
        await ticketRef.set({
          status: nextStatus,
          resolutionNotes: resolutionNotes || 'Resolved via Admin AI Employee.',
          resolvedAt: now,
          resolvedBy: email,
          updatedAt: now,
        }, { merge: true });

        await logActivity(ctx, 'support_ticket_status_changed', {
          category: 'update',
          entityType: 'support_ticket',
          entityId: ticketId,
          entityName: ticketDoc.data()?.subject || ticketId,
          details: { adminAgentAction: true, status: nextStatus, resolutionNotes },
        });

        actionResult = { message: `Ticket ${ticketId} updated to status '${nextStatus}'.` };
        break;
      }

      case 'approve_access_request': {
        const { requestId } = params;
        if (!requestId) return res.status(400).json({ error: 'Missing requestId' });
        const reqRef = db.collection('access_requests').doc(requestId);
        const reqDoc = await reqRef.get();
        if (!reqDoc.exists) return res.status(404).json({ error: 'Access request not found' });
        const reqData: any = reqDoc.data();
        await adminRoutes.adminPromoteUser({ body: { targetUid: reqData.uid, newRole: reqData.requestedRole || 'project_manager' } }, { status: () => ({ json: (b: any) => b }) }, ctx);
        const now = new Date().toISOString();
        await reqRef.set({ status: 'approved', reviewedAt: now, reviewedBy: uid }, { merge: true });
        actionResult = { message: `Access request for ${reqData.email} approved.` };
        break;
      }

      case 'reject_access_request': {
        const { requestId, reason } = params;
        if (!requestId) return res.status(400).json({ error: 'Missing requestId' });
        const reqRef = db.collection('access_requests').doc(requestId);
        const reqDoc = await reqRef.get();
        if (!reqDoc.exists) return res.status(404).json({ error: 'Access request not found' });
        const now = new Date().toISOString();
        await reqRef.set({ status: 'rejected', reason: reason || 'Declined by Admin AI Employee', reviewedAt: now, reviewedBy: uid }, { merge: true });
        actionResult = { message: `Access request rejected.` };
        break;
      }

      case 'transfer_project': {
        const { id, targetUser } = params;
        if (!id || !targetUser) return res.status(400).json({ error: 'Missing project id or targetUser' });
        let err: any = null;
        await adminRoutes.adminTransferProject({ body: { id, targetUser } }, {
          status: (code: number) => ({
            json: (b: any) => { if (code >= 400) err = b?.error || 'Transfer failed'; return b; }
          })
        }, ctx);
        if (err) return res.status(500).json({ error: err });
        actionResult = { message: `Project ${id} transferred to ${targetUser.email || targetUser.uid}.` };
        break;
      }

      case 'transfer_programme': {
        const { id, targetUser } = params;
        if (!id || !targetUser) return res.status(400).json({ error: 'Missing programme id or targetUser' });
        let err: any = null;
        await adminRoutes.adminTransferProgramme({ body: { id, targetUser } }, {
          status: (code: number) => ({
            json: (b: any) => { if (code >= 400) err = b?.error || 'Transfer failed'; return b; }
          })
        }, ctx);
        if (err) return res.status(500).json({ error: err });
        actionResult = { message: `Programme ${id} transferred to ${targetUser.email || targetUser.uid}.` };
        break;
      }

      default:
        return res.status(400).json({ error: `Unsupported action type: ${actionType}` });
    }

    await logActivity(ctx, 'admin_agent_action_executed', {
      category: 'system',
      entityType: 'admin_agent',
      entityId: actionType,
      entityName: `Admin AI Employee: ${actionType}`,
      details: { executedBy: email, actionType, params, result: actionResult },
    });

    return res.status(200).json({ success: true, ...actionResult });
  },
};
