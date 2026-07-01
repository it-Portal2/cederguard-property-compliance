import { FieldValue } from 'firebase-admin/firestore';
import { ApiContext } from '../context.js';
import { encryptSecret } from './crypto.js';

export const INTEGRATIONS_COLLECTION = 'integrations';

export const INTEGRATION_PROVIDERS = [
  'googleCalendar',
  'outlookCalendar',
  'slack',
  'teams',
  'sharepoint',
  'powerbi',
] as const;

export type IntegrationProvider = (typeof INTEGRATION_PROVIDERS)[number];

export function isProvider(x: any): x is IntegrationProvider {
  return INTEGRATION_PROVIDERS.includes(x);
}

// Which fields are secrets (encrypted, `<field>Enc`, never returned to the client).
const SECRET_FIELDS: Record<IntegrationProvider, string[]> = {
  googleCalendar: ['serviceAccountJson'],
  outlookCalendar: ['clientSecret'],
  slack: ['webhookUrl'],
  teams: ['webhookUrl'],
  sharepoint: ['clientSecret'],
  powerbi: [],
};

/** Read the whole per-tenant integrations doc (raw — includes encrypted secrets; server-only). */
export async function readIntegrationsRaw(ctx: ApiContext): Promise<Record<string, any>> {
  const doc = await ctx.db.collection(INTEGRATIONS_COLLECTION).doc(ctx.primaryUid).get();
  if (!doc.exists) return {};
  const data = doc.data() || {};
  return data.providers || {};
}

/** Raw provider sub-object (includes `<field>Enc`) — for server-side send/sync/test. */
export async function getProviderRaw(
  ctx: ApiContext,
  provider: IntegrationProvider,
): Promise<Record<string, any> | null> {
  const all = await readIntegrationsRaw(ctx);
  return all[provider] || null;
}

/**
 * Create/update one provider. Config fields are stored as-is; any secret field
 * present in `secrets` (non-empty) is encrypted into `<field>Enc`. Omitting a
 * secret leaves the stored one untouched (so a config-only edit never wipes the
 * saved credential).
 */
export async function saveProvider(
  ctx: ApiContext,
  provider: IntegrationProvider,
  input: { config?: Record<string, any>; secrets?: Record<string, any> },
): Promise<void> {
  const ref = ctx.db.collection(INTEGRATIONS_COLLECTION).doc(ctx.primaryUid);

  // Ownership guard: never let a save hijack a doc that somehow belongs elsewhere.
  const existing = await ref.get();
  if (existing.exists && existing.data()?.clientId !== ctx.primaryUid) {
    throw new Error('Integrations record belongs to another tenant.');
  }

  const patch: Record<string, any> = {
    ...(input.config || {}),
    updatedAt: new Date().toISOString(),
  };

  for (const field of SECRET_FIELDS[provider]) {
    const val = input.secrets?.[field];
    if (typeof val === 'string' && val.trim()) {
      patch[`${field}Enc`] = encryptSecret(val.trim());
    }
  }

  await ref.set(
    {
      clientId: ctx.primaryUid,
      updatedAt: FieldValue.serverTimestamp(),
      providers: { [provider]: patch },
    },
    { merge: true },
  );
}

/** Patch server-managed fields on a provider (lastError / lastSyncAt / feedKeyId, etc.). */
export async function patchProvider(
  ctx: ApiContext,
  provider: IntegrationProvider,
  patch: Record<string, any>,
): Promise<void> {
  const ref = ctx.db.collection(INTEGRATIONS_COLLECTION).doc(ctx.primaryUid);
  await ref.set(
    { clientId: ctx.primaryUid, providers: { [provider]: patch } },
    { merge: true },
  );
}

/** Remove a provider connection entirely (clears its config + encrypted secrets). */
export async function disconnectProvider(
  ctx: ApiContext,
  provider: IntegrationProvider,
): Promise<void> {
  const ref = ctx.db.collection(INTEGRATIONS_COLLECTION).doc(ctx.primaryUid);
  await ref.set({ clientId: ctx.primaryUid }, { merge: true });
  await ref.update({ [`providers.${provider}`]: FieldValue.delete() });
}

const requiredForConnected: Record<IntegrationProvider, (d: Record<string, any>) => boolean> = {
  slack: (d) => !!d.webhookUrlEnc,
  teams: (d) => !!d.webhookUrlEnc,
  googleCalendar: (d) => !!d.serviceAccountJsonEnc && !!d.calendarId,
  outlookCalendar: (d) => !!d.clientSecretEnc && !!d.tenantId && !!d.clientId && !!d.mailbox,
  sharepoint: (d) =>
    !!d.clientSecretEnc && !!d.tenantId && !!d.clientId && (!!d.siteId || (!!d.siteHost && !!d.sitePath)),
  powerbi: (d) => !!d.feedKeyId,
};

/**
 * Client-safe view of a provider: strips every `<field>Enc` secret and exposes
 * only booleans (`has<Field>`) plus non-secret config + status. Secrets NEVER
 * leave the server.
 */
// Fields that are themselves credentials and must never be returned, even
// though they don't carry the `Enc` suffix (e.g. the Power BI feed key is a
// bearer token embedded in the feed URL).
const SENSITIVE_PLAIN_FIELDS = new Set(['feedKeyId']);

export function maskProvider(provider: IntegrationProvider, data: Record<string, any> | null | undefined) {
  const d = data || {};
  const config: Record<string, any> = {};
  const secretFlags: Record<string, boolean> = {};
  for (const [k, v] of Object.entries(d)) {
    if (k.endsWith('Enc')) {
      const base = k.slice(0, -3);
      secretFlags[`has${base.charAt(0).toUpperCase()}${base.slice(1)}`] = !!v;
    } else if (SENSITIVE_PLAIN_FIELDS.has(k)) {
      // Never expose the value — only whether it is set.
      if (k === 'feedKeyId') secretFlags.hasFeed = !!v;
    } else if (k !== 'updatedAt') {
      config[k] = v;
    }
  }
  return {
    provider,
    enabled: !!d.enabled,
    connected: requiredForConnected[provider](d),
    config,
    ...secretFlags,
    lastError: d.lastError ?? null,
    lastSyncAt: d.lastSyncAt ?? null,
  };
}

/** Masked status for every provider (the payload the Integrations page renders). */
export function maskAll(raw: Record<string, any>) {
  const out: Record<string, ReturnType<typeof maskProvider>> = {};
  for (const p of INTEGRATION_PROVIDERS) {
    out[p] = maskProvider(p, raw[p]);
  }
  return out;
}
