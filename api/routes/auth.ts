import { ApiContext, getAuthService } from '../lib/context.js';
import crypto from 'crypto';
import { logActivity } from '../lib/activityLog.js';
import { checkMagicLinkRateLimit } from '../lib/magicLinkRateLimit.js';
import { renderEmail, sendEmail, escapeHtml } from '../lib/email.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const APP_URL = (process.env.APP_URL || 'https://cedarguard.co.uk').replace(/\/+$/, '');

// Non-secret display preview of an API key: first 8 + last 4 chars.
export function maskKey(key: string): string {
  return key.length > 12 ? `${key.slice(0, 8)}...${key.slice(-4)}` : key;
}

// Pre-auth magic-link send. Reachable WITHOUT a token (dispatched from the
// index.ts pre-auth block, before createContext). Generates a single-use
// Firebase sign-in link server-side and delivers it through the branded Resend
// template (the same mechanism as the access-request approval email). It ALWAYS
// responds { success: true } — it never reveals whether the address has an
// account, nor whether the rate limit tripped (no account enumeration).
export async function handleSendMagicLink(req: any, res: any): Promise<any> {
  try {
    const rawEmail = typeof req.body?.email === 'string' ? req.body.email.trim() : '';
    const email = rawEmail.toLowerCase();
    if (!email || email.length > 254 || !EMAIL_RE.test(email)) {
      return res.status(200).json({ success: true });
    }

    const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
    const allowed = await checkMagicLinkRateLimit(email, ip);
    if (!allowed) {
      return res.status(200).json({ success: true });
    }

    // Server-controlled continue URL only (never taken from the request) so the
    // emailed link can't be turned into an open redirect.
    const link = await getAuthService().generateSignInWithEmailLink(email, {
      url: `${APP_URL}/login`,
      handleCodeInApp: true,
    });

    await sendEmail({
      to: email,
      subject: 'Your CedarGuard sign-in link',
      html: renderEmail({
        previewText: 'Your secure sign-in link for CedarGuard.',
        heading: 'Sign in to CedarGuard',
        bodyHtml: `<p style="margin:0 0 12px;">Click the button below to sign in to CedarGuard. This link is single-use and expires shortly.</p>
<p style="margin:0 0 12px;">If you didn't request this, you can safely ignore this email — no changes will be made to your account.</p>`,
        cta: { label: 'Sign in to CedarGuard', url: link },
      }),
    });

    return res.status(200).json({ success: true });
  } catch (e: any) {
    // Never leak the failure reason to an unauthenticated caller.
    console.error('magicLink.send.error', e?.message ?? String(e));
    return res.status(200).json({ success: true });
  }
}

export const authRoutes: Record<string, (req: any, res: any, ctx: ApiContext) => Promise<any>> = {
  generateApiKey: async (req, res, ctx) => {
    const { db, uid, email, userData } = ctx;
    const { name } = req.body;

    if (userData?.role === 'viewer') {
      return res.status(403).json({ error: 'Forbidden: Viewers cannot generate API keys' });
    }
    
    // Industry-standard: store only a SHA-256 hash, never the plaintext key.
    // The key is shown to the user exactly once (below) and can't be recovered.
    // Doc id is a random uuid (safe to expose for revoke); the request-time
    // lookup in context.ts finds the key by its hash.
    const token = `cdR_${crypto.randomBytes(32).toString('hex')}`;
    const keyHash = crypto.createHash('sha256').update(token).digest('hex');
    const id = crypto.randomUUID();
    const cleanName = (typeof name === 'string' ? name.trim().slice(0, 100) : '') || 'API Key';
    const prefix = maskKey(token);

    await db.collection('apiKeys').doc(id).set({
      id,
      uid,
      name: cleanName,
      keyHash,
      prefix,
      createdAt: new Date().toISOString(),
      lastUsed: null,
    });

    await logActivity(ctx, 'api_key_created', {
      category: 'auth',
      entityType: 'apiKey',
      entityId: prefix,
      entityName: cleanName,
    });

    return res.status(200).json({ success: true, key: token });
  },

  getApiKeys: async (req, res, ctx) => {
    const { db, uid } = ctx;
    const snap = await db.collection('apiKeys').where('uid', '==', uid).get();

    // Never return the full key. New (hashed) docs carry a random `id` + stored
    // `prefix`. Legacy docs stored the plaintext key AS the doc id and have no
    // prefix — mask the id so they still display; the migration (B3) rewrites
    // them to random ids with no plaintext.
    const keys = snap.docs.map(doc => {
      const d = doc.data();
      return {
        id: doc.id,
        name: d.name || 'API Key',
        createdAt: d.createdAt,
        lastUsed: d.lastUsed ?? null,
        prefix: d.prefix || maskKey(doc.id),
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
      const keyName = keyDoc.data()?.name || 'API Key';
      await db.collection('apiKeys').doc(keyId).delete();
      await logActivity(ctx, 'api_key_revoked', {
        category: 'auth',
        entityType: 'apiKey',
        entityId: String(keyId).slice(0, 12) + '…',
        entityName: keyName,
      });
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
    await logActivity(ctx, 'account_deleted', {
      category: 'delete',
      entityType: 'user',
      entityId: uidToDelete,
      entityName: uidToDelete === uid ? (email || uid) : uidToDelete,
      details: { selfDelete: uidToDelete === uid },
    });

    return res.status(200).json({ success: true, message: 'User account completely erased.' });
  },
};
