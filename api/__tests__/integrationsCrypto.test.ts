import { describe, it, expect, beforeAll } from 'vitest';

beforeAll(() => {
  process.env.INTEGRATIONS_ENC_KEY = 'test-integration-encryption-key-do-not-use-in-prod';
});

describe('integrations crypto', () => {
  it('round-trips a secret through encrypt/decrypt', async () => {
    const { encryptSecret, decryptSecret } = await import('../lib/integrations/crypto.js');
    const secret = 'https://hooks.slack.com/services/T00/B00/abcXYZ';
    const enc = encryptSecret(secret);
    expect(enc).not.toContain(secret);
    expect(enc.split(':')).toHaveLength(3);
    expect(decryptSecret(enc)).toBe(secret);
  });

  it('produces a different ciphertext each time (random IV)', async () => {
    const { encryptSecret } = await import('../lib/integrations/crypto.js');
    expect(encryptSecret('same')).not.toBe(encryptSecret('same'));
  });

  it('rejects a tampered ciphertext (auth tag)', async () => {
    const { encryptSecret, decryptSecret } = await import('../lib/integrations/crypto.js');
    const enc = encryptSecret('sensitive-value');
    const [iv, tag, data] = enc.split(':');
    const flipped = Buffer.from(data, 'base64');
    flipped[0] = flipped[0] ^ 0xff;
    const tampered = `${iv}:${tag}:${flipped.toString('base64')}`;
    expect(() => decryptSecret(tampered)).toThrow();
  });

  it('reports whether the key is configured', async () => {
    const { isEncryptionConfigured } = await import('../lib/integrations/crypto.js');
    expect(isEncryptionConfigured()).toBe(true);
  });
});
