import crypto from 'crypto';

const ALGO = 'aes-256-gcm';

// The AES-256 key is derived from the raw env secret via SHA-256, so the env
// value can be any length/format and we always get exactly 32 bytes. The secret
// must be set in production — a missing key is a hard error (we never store
// integration secrets in plaintext).
function getKey(): Buffer {
  const raw = process.env.INTEGRATIONS_ENC_KEY;
  if (!raw || raw.length < 16) {
    throw new Error(
      'INTEGRATIONS_ENC_KEY is not configured (set a strong random secret to enable integration credential storage).',
    );
  }
  return crypto.createHash('sha256').update(raw).digest();
}

/** Encrypt a UTF-8 secret → `iv:tag:ciphertext` (all base64). */
export function encryptSecret(plaintext: string): string {
  const key = getKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const enc = Buffer.concat([cipher.update(String(plaintext), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('base64')}:${tag.toString('base64')}:${enc.toString('base64')}`;
}

/** Decrypt a value produced by {@link encryptSecret}. Throws on tamper/format error. */
export function decryptSecret(payload: string): string {
  const key = getKey();
  const [ivB64, tagB64, dataB64] = String(payload).split(':');
  if (!ivB64 || !tagB64 || !dataB64) {
    throw new Error('Malformed encrypted secret.');
  }
  const decipher = crypto.createDecipheriv(ALGO, key, Buffer.from(ivB64, 'base64'));
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
  return Buffer.concat([
    decipher.update(Buffer.from(dataB64, 'base64')),
    decipher.final(),
  ]).toString('utf8');
}

/** True when the encryption key is configured — used to surface a clear setup error. */
export function isEncryptionConfigured(): boolean {
  const raw = process.env.INTEGRATIONS_ENC_KEY;
  return !!raw && raw.length >= 16;
}
