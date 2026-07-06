import crypto from 'crypto';
import { FieldValue } from 'firebase-admin/firestore';
import { ApiContext } from '../lib/context.js';
import { logActivity } from '../lib/activityLog.js';
import { decryptSecret, isEncryptionConfigured } from '../lib/integrations/crypto.js';
import { postJson } from '../lib/integrations/http.js';
import {
  IntegrationProvider,
  INTEGRATION_PROVIDERS,
  isProvider,
  readIntegrationsRaw,
  getProviderRaw,
  saveProvider,
  patchProvider,
  disconnectProvider,
  maskAll,
  maskProvider,
} from '../lib/integrations/store.js';

/** Manage gate: tenant-wide config → Client Admin (and Super Admin, folded into isClientAdmin). */
function canManage(ctx: ApiContext): boolean {
  return ctx.isClientAdmin;
}

/** Decrypt a stored secret without letting raw OpenSSL error text reach the client. */
function safeDecrypt(enc: string): string {
  try {
    return decryptSecret(enc);
  } catch {
    throw new Error('Could not read the stored credential — please re-enter it.');
  }
}

const POWERBI_SCOPES = ['all', 'risks', 'compliance', 'governance', 'resource'];

const APP_URL = (process.env.APP_URL || 'https://cedarguard.co.uk').replace(/\/+$/, '');

// Non-secret config keys accepted from the client, per provider (whitelist — anything
// else is dropped so junk / accidental secrets never land in the config object).
const ALLOWED_CONFIG: Record<IntegrationProvider, string[]> = {
  slack: ['label', 'enabled', 'syncCategories'],
  teams: ['label', 'enabled', 'syncCategories', 'cardStyle'],
  googleCalendar: ['label', 'enabled', 'syncCategories', 'calendarId', 'defaultDurationMin'],
  outlookCalendar: ['label', 'enabled', 'syncCategories', 'tenantId', 'clientId', 'mailbox', 'calendarId', 'secretExpiry'],
  sharepoint: ['label', 'enabled', 'syncCategories', 'tenantId', 'clientId', 'siteHost', 'sitePath', 'siteId', 'folderPath', 'pushDocs', 'secretExpiry'],
  powerbi: ['label', 'enabled', 'dataScope'],
};

function pickConfig(provider: IntegrationProvider, config: any): Record<string, any> {
  const out: Record<string, any> = {};
  if (config && typeof config === 'object') {
    for (const k of ALLOWED_CONFIG[provider]) {
      if (config[k] !== undefined) out[k] = config[k];
    }
  }
  return out;
}

const TEAMS_HOST_SUFFIXES = ['.logic.azure.com', '.powerplatform.com', '.azure-apihub.net', 'webhook.office.com'];

function validateWebhookHost(provider: 'slack' | 'teams', url: string): string | null {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return 'That does not look like a valid URL.';
  }
  if (u.protocol !== 'https:') return 'The webhook URL must use HTTPS.';
  const host = u.hostname.toLowerCase();
  if (provider === 'slack') {
    if (host !== 'hooks.slack.com') return 'A Slack webhook URL must be on hooks.slack.com.';
  } else {
    if (!TEAMS_HOST_SUFFIXES.some((s) => host === s || host.endsWith(s))) {
      return 'That does not look like a Microsoft Teams Workflow webhook URL.';
    }
  }
  return null;
}

export const integrationsRoutes: Record<string, (req: any, res: any, ctx: ApiContext) => Promise<any>> = {
  integrationsGetStatus: async (_req, res, ctx) => {
    const raw = await readIntegrationsRaw(ctx);
    const manage = canManage(ctx);
    return res.status(200).json({
      success: true,
      integrations: maskAll(raw),
      canManage: manage,
      // Only surface server-config details to managers.
      ...(manage ? { encryptionReady: isEncryptionConfigured() } : {}),
    });
  },

  integrationSaveProvider: async (req, res, ctx) => {
    if (!canManage(ctx)) {
      return res.status(403).json({ error: 'Only a workspace admin can manage integrations.' });
    }
    if (!isEncryptionConfigured()) {
      return res.status(500).json({ error: 'Server is missing INTEGRATIONS_ENC_KEY — integration credentials cannot be stored securely.' });
    }
    const { provider, config, secrets } = req.body || {};
    if (!isProvider(provider)) return res.status(400).json({ error: 'Unknown integration provider.' });

    const cleanConfig = pickConfig(provider, config);
    const cleanSecrets: Record<string, any> = {};

    // Provider-specific validation of any secret being (re)set.
    if (provider === 'slack' || provider === 'teams') {
      const url = secrets?.webhookUrl;
      if (typeof url === 'string' && url.trim()) {
        const err = validateWebhookHost(provider, url.trim());
        if (err) return res.status(400).json({ error: err });
        cleanSecrets.webhookUrl = url.trim();
      }
    } else if (provider === 'googleCalendar') {
      const rawKey = secrets?.serviceAccountJson;
      if (typeof rawKey === 'string' && rawKey.trim()) {
        let parsed: any;
        try {
          parsed = JSON.parse(rawKey);
        } catch {
          return res.status(400).json({ error: 'The service-account key must be valid JSON.' });
        }
        if (!parsed.client_email || !parsed.private_key) {
          return res.status(400).json({ error: 'That JSON is missing client_email / private_key — upload the service-account key file.' });
        }
        cleanSecrets.serviceAccountJson = rawKey.trim();
        cleanConfig.clientEmail = parsed.client_email; // non-secret, for display
      }
    } else if (provider === 'outlookCalendar' || provider === 'sharepoint') {
      const s = secrets?.clientSecret;
      if (typeof s === 'string' && s.trim()) cleanSecrets.clientSecret = s.trim();
    } else if (provider === 'powerbi') {
      if (cleanConfig.dataScope !== undefined && !POWERBI_SCOPES.includes(String(cleanConfig.dataScope))) {
        return res.status(400).json({ error: 'Invalid data scope.' });
      }
    }

    try {
      await saveProvider(ctx, provider, { config: cleanConfig, secrets: cleanSecrets });
    } catch (e: any) {
      return res.status(500).json({ error: e?.message || 'Could not save integration.' });
    }

    await logActivity(ctx, 'integration_saved', {
      category: 'update',
      entityType: 'integration',
      entityId: provider,
      entityName: provider,
    });

    const updated = await getProviderRaw(ctx, provider);
    return res.status(200).json({ success: true, integration: maskProvider(provider, updated) });
  },

  integrationDisconnect: async (req, res, ctx) => {
    if (!canManage(ctx)) {
      return res.status(403).json({ error: 'Only a workspace admin can manage integrations.' });
    }
    const { provider } = req.body || {};
    if (!isProvider(provider)) return res.status(400).json({ error: 'Unknown integration provider.' });

    // Clean up a Power BI feed key when disconnecting.
    if (provider === 'powerbi') {
      const raw = await getProviderRaw(ctx, provider);
      const feedKeyId = raw?.feedKeyId;
      if (feedKeyId) await ctx.db.collection('apiKeys').doc(feedKeyId).delete().catch(() => {});
    }

    await disconnectProvider(ctx, provider);
    await logActivity(ctx, 'integration_disconnected', {
      category: 'delete',
      entityType: 'integration',
      entityId: provider,
      entityName: provider,
    });
    return res.status(200).json({ success: true });
  },

  integrationTest: async (req, res, ctx) => {
    if (!canManage(ctx)) {
      return res.status(403).json({ error: 'Only a workspace admin can test integrations.' });
    }
    const { provider } = req.body || {};
    if (!isProvider(provider)) return res.status(400).json({ error: 'Unknown integration provider.' });

    const raw = await getProviderRaw(ctx, provider);
    if (!raw) return res.status(400).json({ error: 'Save the integration before testing it.' });

    try {
      // Slack / Teams — send a real test message to the webhook.
      if (provider === 'slack' || provider === 'teams') {
        if (!raw.webhookUrlEnc) return res.status(400).json({ error: 'Add the webhook URL first.' });
        const url = safeDecrypt(raw.webhookUrlEnc);
        const payload =
          provider === 'slack'
            ? { text: '✅ CedarGuard is connected. This is a test message.' }
            : {
                type: 'message',
                attachments: [
                  {
                    contentType: 'application/vnd.microsoft.card.adaptive',
                    content: {
                      $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
                      type: 'AdaptiveCard',
                      version: '1.4',
                      body: [
                        { type: 'TextBlock', weight: 'Bolder', text: 'CedarGuard connected ✅' },
                        { type: 'TextBlock', wrap: true, text: 'This is a test message from your CedarGuard workspace.' },
                      ],
                    },
                  },
                ],
              };
        const r = await postJson(url, payload);
        await patchProvider(ctx, provider, {
          lastError: r.ok ? null : `Test failed (HTTP ${r.status})`,
          lastSyncAt: r.ok ? new Date().toISOString() : raw.lastSyncAt ?? null,
        });
        if (!r.ok) {
          return res.status(200).json({ success: false, message: `The provider rejected the test (HTTP ${r.status}). Check the webhook URL.` });
        }
        return res.status(200).json({ success: true, message: 'Test message sent — check the channel.' });
      }

      // Google — structural credential check (a live calendar write is verified during sync).
      if (provider === 'googleCalendar') {
        if (!raw.serviceAccountJsonEnc || !raw.calendarId) {
          return res.status(200).json({ success: false, message: 'Add the service-account key and Calendar ID first.' });
        }
        const parsed = JSON.parse(safeDecrypt(raw.serviceAccountJsonEnc));
        return res.status(200).json({
          success: true,
          message: `Credentials look valid (service account ${parsed.client_email}). Calendar access is verified on the first sync.`,
        });
      }

      // Microsoft app-credential providers — structural check.
      if (provider === 'outlookCalendar' || provider === 'sharepoint') {
        const missing: string[] = [];
        if (!raw.tenantId) missing.push('Tenant ID');
        if (!raw.clientId) missing.push('Client ID');
        if (!raw.clientSecretEnc) missing.push('Client Secret');
        if (provider === 'outlookCalendar' && !raw.mailbox) missing.push('Mailbox');
        if (provider === 'sharepoint' && !raw.siteId && !(raw.siteHost && raw.sitePath)) missing.push('Site');
        if (missing.length) {
          return res.status(200).json({ success: false, message: `Still needed: ${missing.join(', ')}.` });
        }
        return res.status(200).json({ success: true, message: 'Credentials complete. A live connection is verified on the first sync.' });
      }

      // Power BI — has a feed key.
      if (provider === 'powerbi') {
        if (!raw.feedKeyId) return res.status(200).json({ success: false, message: 'Generate a feed key first.' });
        return res.status(200).json({ success: true, message: 'Feed key is active. Connect Power BI using the feed URL.' });
      }
    } catch (e: any) {
      return res.status(200).json({ success: false, message: e?.message || 'Test failed.' });
    }
    return res.status(400).json({ error: 'Nothing to test.' });
  },

  integrationGenerateFeedKey: async (_req, res, ctx) => {
    if (!canManage(ctx)) {
      return res.status(403).json({ error: 'Only a workspace admin can manage integrations.' });
    }
    const raw = await getProviderRaw(ctx, 'powerbi');
    // Revoke any existing feed key first (rotation).
    if (raw?.feedKeyId) await ctx.db.collection('apiKeys').doc(raw.feedKeyId).delete().catch(() => {});

    // Hashed at rest (same scheme as the general API keys): store only the
    // SHA-256 hash under a random doc id. The plaintext token still travels in
    // the feed URL below; the future feed consumer must hash-lookup by keyHash.
    const token = `cdR_${crypto.randomBytes(32).toString('hex')}`;
    const keyHash = crypto.createHash('sha256').update(token).digest('hex');
    const id = crypto.randomUUID();
    await ctx.db.collection('apiKeys').doc(id).set({
      id,
      uid: ctx.uid,
      name: 'Power BI Feed',
      scope: 'powerbi_feed',
      clientId: ctx.primaryUid,
      keyHash,
      prefix: `${token.slice(0, 8)}...${token.slice(-4)}`,
      createdAt: new Date().toISOString(),
      lastUsed: null,
    });
    // feedKeyId is the doc id (uuid) so rotation/disconnect can delete by id.
    await patchProvider(ctx, 'powerbi', { feedKeyId: id, enabled: true, updatedAt: FieldValue.serverTimestamp() });

    await logActivity(ctx, 'integration_feed_key_generated', {
      category: 'auth',
      entityType: 'integration',
      entityId: 'powerbi',
      entityName: 'Power BI feed key',
    });

    const dataset = raw?.dataScope && raw.dataScope !== 'all' ? String(raw.dataScope) : 'all';
    const url = `${APP_URL}/api/powerbi/feed?dataset=${encodeURIComponent(dataset)}&key=${token}`;
    return res.status(200).json({ success: true, key: token, url });
  },

  integrationRevokeFeedKey: async (_req, res, ctx) => {
    if (!canManage(ctx)) {
      return res.status(403).json({ error: 'Only a workspace admin can manage integrations.' });
    }
    const raw = await getProviderRaw(ctx, 'powerbi');
    if (raw?.feedKeyId) await ctx.db.collection('apiKeys').doc(raw.feedKeyId).delete().catch(() => {});
    await patchProvider(ctx, 'powerbi', { feedKeyId: FieldValue.delete(), enabled: false });
    await logActivity(ctx, 'integration_feed_key_revoked', {
      category: 'auth',
      entityType: 'integration',
      entityId: 'powerbi',
      entityName: 'Power BI feed key',
    });
    return res.status(200).json({ success: true });
  },
};

// Re-export so route registration + future phases can import the provider list.
export { INTEGRATION_PROVIDERS };
