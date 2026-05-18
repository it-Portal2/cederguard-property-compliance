import { describe, it, expect } from 'vitest';
import {
  SEED_CONFIG,
  validateAIModelConfig,
  MAX_ENTRIES_PER_LIST,
  type AIModelConfig,
} from '../lib/aiModelConfig.js';

/** Deep clone helper so each test mutates a fresh copy of the seed. */
function cloneSeed(): AIModelConfig {
  return JSON.parse(JSON.stringify(SEED_CONFIG));
}

describe('validateAIModelConfig', () => {
  it('accepts the seed config verbatim', () => {
    const result = validateAIModelConfig(SEED_CONFIG);
    expect(result.valid).toBe(true);
  });

  it('rejects non-object payload', () => {
    expect(validateAIModelConfig(null).valid).toBe(false);
    expect(validateAIModelConfig('not-an-object').valid).toBe(false);
    expect(validateAIModelConfig(42).valid).toBe(false);
  });

  it('rejects missing chatModels array', () => {
    const result = validateAIModelConfig({ operationModels: [] });
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors.some((e) => e.includes('chatModels'))).toBe(true);
    }
  });

  it('rejects more than one enabled+default chat entry (must be exactly one)', () => {
    const cfg = cloneSeed();
    // Find the existing enabled+default and add a second one alongside it.
    const otherEnabledIdx = cfg.chatModels.findIndex(
      (m, i) => m.enabled && !m.isDefault,
    );
    cfg.chatModels[otherEnabledIdx].isDefault = true; // two defaults now
    const result = validateAIModelConfig(cfg);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors.some((e) => e.includes('exactly one'))).toBe(true);
    }
  });

  it('rejects zero enabled+default chat entries', () => {
    const cfg = cloneSeed();
    // Clear isDefault on every chatModels row.
    cfg.chatModels.forEach((m) => { m.isDefault = false; });
    const result = validateAIModelConfig(cfg);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors.some((e) => e.includes('exactly one'))).toBe(true);
    }
  });

  it('rejects duplicate chat ids', () => {
    const cfg = cloneSeed();
    cfg.chatModels[1].id = cfg.chatModels[0].id;
    const result = validateAIModelConfig(cfg);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors.some((e) => e.includes('duplicate'))).toBe(true);
    }
  });

  it('accepts google-direct backend on a saved entry (in-tenant Gemini)', () => {
    // The seed itself is all-openrouter, but the validator allows
    // google-direct on saved entries (it's the in-tenant Gemini option).
    // Construct a config with a synthetic google-direct entry alongside
    // the seed's free rows.
    const cfg = cloneSeed();
    cfg.chatModels.push({
      id: 'gemini-existing',
      label: 'Gemini (in-tenant)',
      group: 'default',
      backend: 'google-direct',
      modelString: 'gemini-2.5-flash', // free-text label, no pattern check
      enabled: true,
      isDefault: false,
    });
    expect(validateAIModelConfig(cfg).valid).toBe(true);
  });

  it('rejects bogus backend value', () => {
    const cfg = cloneSeed();
    (cfg.chatModels[0] as any).backend = 'magic-cloud';
    const result = validateAIModelConfig(cfg);
    expect(result.valid).toBe(false);
  });

  it('skips provider/model pattern check for google-direct entries', () => {
    const cfg = cloneSeed();
    // Convert the default DeepSeek row to a synthetic google-direct entry
    // with a free-text modelString (which is legal for google-direct since
    // the dispatcher routes by entry.backend, not by modelString).
    const defaultIdx = cfg.chatModels.findIndex((m) => m.enabled && m.isDefault);
    cfg.chatModels[defaultIdx].backend = 'google-direct';
    cfg.chatModels[defaultIdx].modelString = 'whatever-the-admin-typed';
    expect(validateAIModelConfig(cfg).valid).toBe(true);
  });

  it('still enforces provider/model pattern for openrouter entries', () => {
    const cfg = cloneSeed();
    // Pick any openrouter row in the seed — it must reject a bad pattern.
    const orIdx = cfg.chatModels.findIndex((m) => m.backend === 'openrouter');
    cfg.chatModels[orIdx].modelString = 'no-slash-here';
    const result = validateAIModelConfig(cfg);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors.some((e) => e.includes('provider/model'))).toBe(true);
    }
  });

  it('rejects label > 80 chars', () => {
    const cfg = cloneSeed();
    cfg.chatModels[0].label = 'x'.repeat(81);
    const result = validateAIModelConfig(cfg);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors.some((e) => e.includes('label'))).toBe(true);
    }
  });

  it('rejects modelString > 200 chars', () => {
    const cfg = cloneSeed();
    cfg.chatModels[0].modelString = 'provider/' + 'x'.repeat(200);
    const result = validateAIModelConfig(cfg);
    expect(result.valid).toBe(false);
  });

  // Pattern rejection moved into "still enforces provider/model pattern
  // for openrouter entries" below — kept here as a marker that the
  // openrouter-side check still runs.

  it('rejects more than MAX_ENTRIES_PER_LIST chat entries', () => {
    const cfg = cloneSeed();
    const oneOf = cfg.chatModels[0];
    while (cfg.chatModels.length <= MAX_ENTRIES_PER_LIST) {
      cfg.chatModels.push({ ...oneOf, id: `clone-${cfg.chatModels.length}`, isDefault: false });
    }
    const result = validateAIModelConfig(cfg);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors.some((e) => e.includes('at most'))).toBe(true);
    }
  });

  it('rejects bad group enum on chat entry', () => {
    const cfg = cloneSeed();
    (cfg.chatModels[0] as any).group = 'enterprise';
    const result = validateAIModelConfig(cfg);
    expect(result.valid).toBe(false);
  });

  it('accepts empty operationModels list', () => {
    const cfg = cloneSeed();
    cfg.operationModels = [];
    const result = validateAIModelConfig(cfg);
    expect(result.valid).toBe(true);
  });

  it('rejects negative meta cost values', () => {
    const cfg = cloneSeed();
    cfg.chatModels[0].meta = {
      contextLength: 100000,
      promptCostUsdPer1M: -1,
      completionCostUsdPer1M: 0,
      isFree: true,
    };
    const result = validateAIModelConfig(cfg);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors.some((e) => e.includes('non-negative'))).toBe(true);
    }
  });

  it('accepts well-formed meta block', () => {
    const cfg = cloneSeed();
    cfg.chatModels[0].meta = {
      contextLength: 1_000_000,
      promptCostUsdPer1M: 0,
      completionCostUsdPer1M: 0,
      isFree: true,
    };
    const result = validateAIModelConfig(cfg);
    expect(result.valid).toBe(true);
  });
});
