import { FieldValue } from 'firebase-admin/firestore';
import { ApiContext } from '../lib/context.js';
import crypto from 'crypto';
import { ROLE_STRINGS, PM_LEVELS } from '../../src/lib/roleConstants.js';
import {
  CONFIG_DOC_PATH,
  SEED_CONFIG,
  loadAIModelConfig,
  validateAIModelConfig,
  bumpAIModelConfigCacheBuster,
  getAIModelConfigCacheBuster,
  type AIModelConfig,
  type ChatModelEntry,
} from '../lib/aiModelConfig.js';
import { fetchOpenRouterCatalog } from '../lib/openRouterCatalog.js';

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
    db.collection('activityLogs').add({ type: 'admin_project_deleted', uid, email, projectId: id, timestamp: new Date().toISOString() }).catch(console.error);
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
    db.collection('activityLogs').add({ type: 'admin_programme_deleted', uid, email, id, timestamp: new Date().toISOString() }).catch(console.error);
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

    db.collection('activityLogs').add({
        type: 'admin_project_transferred',
        uid, email, 
        projectId: id, 
        targetUid: targetUser.uid,
        timestamp: new Date().toISOString() 
    }).catch(console.error);
    
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

    db.collection('activityLogs').add({
        type: 'admin_programme_transferred',
        uid, email, 
        id, 
        targetUid: targetUser.uid,
        timestamp: new Date().toISOString() 
    }).catch(console.error);
    
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

    // Log this admin action
    await db.collection('activityLogs').add({
      type: 'admin_user_update',
      adminUid: uid,
      adminEmail: email,
      targetUid,
      updates,
      timestamp: new Date().toISOString()
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

    db.collection('activityLogs').add({
      type: 'admin_supervisor_assigned',
      uid,
      email,
      targetUid,
      supervisorUid: supervisorUid || null,
      timestamp: new Date().toISOString(),
    }).catch(console.error);

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

    const updates: any = {
      role: newRole,
      updatedAt: new Date().toISOString(),
    };
    if (newCanonical === 'project_manager') {
      updates.pmLevel = PM_LEVELS.includes(pmLevel) ? pmLevel : targetData.pmLevel || 'standard';
    }

    await db.collection('users').doc(targetUid).set(updates, { merge: true });

    db.collection('activityLogs').add({
      type: 'admin_user_promoted',
      uid,
      email,
      targetUid,
      fromRole,
      toRole: newRole,
      pmLevel: updates.pmLevel || null,
      timestamp: new Date().toISOString(),
    }).catch(console.error);

    return res.status(200).json({ success: true });
  },

  adminGetActivity: async (req, res, ctx) => {
    const { db, isAdmin } = ctx;
    if (!isAdmin) return res.status(403).json({ error: 'Forbidden' });

    const snap = await db.collection('activityLogs').orderBy('timestamp', 'desc').limit(50).get();
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

    db.collection('activityLogs').add({
      type: 'pricing_config_updated',
      uid: ctx.uid, email,
      timestamp: new Date().toISOString()
    }).catch(console.error);

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

    await db.collection('invoices').doc(id).delete();

    db.collection('activityLogs').add({
      type: 'invoice_deleted',
      uid, email,
      invoiceId: id,
      timestamp: new Date().toISOString()
    }).catch(console.error);

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
    // 60-second in-memory cache keyed by primaryUid + cache-buster.
    // Cache-buster is bumped by adminUpdateAIModelConfig so the next read
    // after a super-admin save is fresh.
    try {
      const cacheKey = `${ctx.primaryUid}::${getAIModelConfigCacheBuster()}`;
      const hit = _activeChatModelsCache.get(cacheKey);
      const now = Date.now();
      if (hit && now - hit.fetchedAt < ACTIVE_CHAT_MODELS_TTL_MS) {
        return res.status(200).json({
          success: true,
          chatModels: hit.payload.chatModels,
          defaultModelId: hit.payload.defaultModelId,
          cached: true,
        });
      }
      const config = await loadAIModelConfig(ctx);
      const enabled = (config.chatModels || []).filter((m) => m.enabled);
      const defaultEntry: ChatModelEntry | undefined =
        enabled.find((m) => m.isDefault) ?? enabled[0];
      const payload = {
        chatModels: enabled,
        defaultModelId: defaultEntry?.id ?? null,
      };
      _activeChatModelsCache.set(cacheKey, { fetchedAt: now, payload });
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
};

// Module-level cache for getActiveChatModels. Keyed by primaryUid so two
// tenants can't poison each other's view. TTL = 60s; explicit cache-buster
// (from aiModelConfig.bumpAIModelConfigCacheBuster) is folded into the key
// so a super-admin save invalidates every in-process slot at once.
const ACTIVE_CHAT_MODELS_TTL_MS = 60 * 1000;
const _activeChatModelsCache = new Map<
  string,
  { fetchedAt: number; payload: { chatModels: ChatModelEntry[]; defaultModelId: string | null } }
>();
