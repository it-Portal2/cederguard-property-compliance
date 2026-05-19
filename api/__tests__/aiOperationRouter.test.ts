/**
 * Cascading-fallback tests for runAIOperation.
 *
 * SDK clients are mocked at the module level so each test drives the
 * cascade by configuring the per-attempt outcome on the mocks (success,
 * retryable error, non-retryable error) without touching the network.
 */

import { vi, describe, it, expect, beforeEach } from 'vitest';

// ── Module-level mocks ────────────────────────────────────────────────────
// Hoisted by vitest so they're in place before the router imports the SDKs.

const openaiCreate = vi.fn();
const geminiGenerate = vi.fn();

// Both SDKs are used via `new Ctor(...)` inside the router, so the mock
// implementations must be real constructable functions, not arrow factories.
vi.mock('openai', () => {
  function MockOpenAI(this: any) {
    this.chat = { completions: { create: openaiCreate } };
  }
  return { default: MockOpenAI };
});

vi.mock('@google/genai', () => {
  function MockGoogleGenAI(this: any) {
    this.models = { generateContent: geminiGenerate };
  }
  return { GoogleGenAI: MockGoogleGenAI };
});

// loadAIModelConfig defaults to reading Firestore via ctx.db. We override
// per-test using opts.operationModelsOverride so we never need a stubbed
// Firestore here — the router accepts that override for exactly this
// purpose.

import {
  runAIOperation,
  _internal,
  type AIOperationOptions,
} from '../lib/aiOperationRouter.js';
import type { OperationModelEntry } from '../lib/aiModelConfig.js';

// ── Fixtures ──────────────────────────────────────────────────────────────

function makeCtx() {
  return {
    db: { doc: () => ({ get: async () => ({ exists: false }) }) } as any,
    uid: 'u',
    email: 'u@example.com',
    userData: {},
    primaryUid: 'u',
    isAdmin: false,
    isClientAdmin: false,
    SYSTEM_ADMIN_EMAILS: [],
    isAuthorizedForContext: vi.fn(),
    getAuthService: vi.fn(),
    getMessagingService: vi.fn(),
  } as any;
}

function makeOpts(over: Partial<AIOperationOptions> = {}): AIOperationOptions {
  return {
    ctx: makeCtx(),
    prompt: 'Test prompt',
    timeoutMs: 5_000,
    ...over,
  };
}

const opEntry = (id: string, modelString: string, enabled = true): OperationModelEntry => ({
  id,
  label: id,
  backend: 'openrouter',
  modelString,
  enabled,
});

function openrouterSuccess(text: string) {
  return { choices: [{ message: { content: text } }] };
}

function retryableHttp(status: number) {
  const e: any = new Error(`HTTP ${status}`);
  e.status = status;
  return e;
}

function geminiSuccess(text: string) {
  return { candidates: [{ content: { parts: [{ text }] } }] };
}

beforeEach(() => {
  openaiCreate.mockReset();
  geminiGenerate.mockReset();
  process.env.OPENROUTER_API_KEY = 'test-or-key';
  process.env.GEMINI_API_KEY = 'test-gemini-key';
});

// ── isRetryable predicate ────────────────────────────────────────────────

describe('_internal.isRetryable', () => {
  it('treats 400/429/502/503/504/529/404 as retryable', () => {
    // 400 is in the retryable set because it means "this specific upstream
    // model can't handle the request shape we sent" — the next cascade
    // entry might accept the same payload (e.g. a different provider or a
    // model that supports JSON mode), so we advance instead of giving up.
    for (const status of [400, 429, 502, 503, 504, 529, 404]) {
      const e: any = new Error('x');
      e.status = status;
      expect(_internal.isRetryable(e)).toBe(true);
    }
  });

  it('treats 401 as non-retryable (no message keyword)', () => {
    const e: any = new Error('Unauthorized');
    e.status = 401;
    expect(_internal.isRetryable(e)).toBe(false);
  });

  it('treats quota / overloaded / timeout / empty-response strings as retryable', () => {
    for (const msg of [
      'quota exceeded',
      'rate limit reached',
      'model is overloaded',
      'service unavailable',
      'request timed out',
      'empty response from upstream',
    ]) {
      expect(_internal.isRetryable(new Error(msg))).toBe(true);
    }
  });

  it('treats auth-error strings as retryable (so cascade can move on)', () => {
    expect(_internal.isRetryable(new Error('Invalid API key'))).toBe(true);
    expect(_internal.isRetryable(new Error('PERMISSION_DENIED for caller'))).toBe(true);
  });

  it('returns false for null / undefined', () => {
    expect(_internal.isRetryable(null)).toBe(false);
    expect(_internal.isRetryable(undefined)).toBe(false);
  });
});

// ── Cascade behaviour ────────────────────────────────────────────────────

describe('runAIOperation cascade', () => {
  it('returns the first enabled operation entry that succeeds', async () => {
    openaiCreate.mockResolvedValueOnce(openrouterSuccess('first-success'));
    const result = await runAIOperation(
      makeOpts({ operationModelsOverride: [opEntry('a', 'provider/a')] }),
    );
    expect(result.text).toBe('first-success');
    expect(result.modelUsed).toBe('provider/a');
    expect(result.backend).toBe('openrouter');
    expect(openaiCreate).toHaveBeenCalledTimes(1);
    expect(geminiGenerate).not.toHaveBeenCalled();
  });

  it('falls through to the next entry on a retryable error', async () => {
    openaiCreate
      .mockRejectedValueOnce(retryableHttp(429)) // entry a → 429
      .mockResolvedValueOnce(openrouterSuccess('second-success')); // entry b → ok
    const result = await runAIOperation(
      makeOpts({
        operationModelsOverride: [opEntry('a', 'provider/a'), opEntry('b', 'provider/b')],
      }),
    );
    expect(result.text).toBe('second-success');
    expect(result.modelUsed).toBe('provider/b');
    expect(openaiCreate).toHaveBeenCalledTimes(2);
  });

  it('skips disabled entries entirely', async () => {
    openaiCreate.mockResolvedValueOnce(openrouterSuccess('from-b'));
    const result = await runAIOperation(
      makeOpts({
        operationModelsOverride: [
          opEntry('a', 'provider/a', /* enabled */ false),
          opEntry('b', 'provider/b'),
        ],
      }),
    );
    expect(result.modelUsed).toBe('provider/b');
    expect(openaiCreate).toHaveBeenCalledTimes(1);
  });

  it('propagates non-retryable errors without trying the rest of the chain', async () => {
    // 401 is still non-retryable (no auth-error message keyword either),
    // so it propagates without the cascade trying entry b or the safety
    // net. 400 used to be non-retryable here but is now reclassified as
    // retryable to defeat the "first entry rejects JSON mode → whole
    // pipeline fails" trap.
    const fatal: any = new Error('Unauthorized');
    fatal.status = 401;
    openaiCreate.mockRejectedValueOnce(fatal);

    await expect(
      runAIOperation(
        makeOpts({
          operationModelsOverride: [opEntry('a', 'provider/a'), opEntry('b', 'provider/b')],
        }),
      ),
    ).rejects.toThrow(/Unauthorized/);

    // Did NOT advance to entry b, and did NOT try the safety net.
    expect(openaiCreate).toHaveBeenCalledTimes(1);
    expect(geminiGenerate).not.toHaveBeenCalled();
  });

  it('falls through admin list to the free auto-router on full retryable failure', async () => {
    openaiCreate
      .mockRejectedValueOnce(retryableHttp(429)) // entry a fails
      .mockResolvedValueOnce(openrouterSuccess('autorouter-text')); // auto-router succeeds
    const result = await runAIOperation(
      makeOpts({ operationModelsOverride: [opEntry('a', 'provider/a')] }),
    );
    expect(result.text).toBe('autorouter-text');
    expect(result.modelUsed).toBe('openrouter/owl-alpha');
    expect(openaiCreate).toHaveBeenCalledTimes(2);
  });

  it('falls through admin list + auto-router to Gemini direct as the last step', async () => {
    openaiCreate
      .mockRejectedValueOnce(retryableHttp(429)) // admin entry
      .mockRejectedValueOnce(retryableHttp(503)); // auto-router
    geminiGenerate.mockResolvedValueOnce(geminiSuccess('gemini-safety-net'));
    const result = await runAIOperation(
      makeOpts({ operationModelsOverride: [opEntry('a', 'provider/a')] }),
    );
    expect(result.text).toBe('gemini-safety-net');
    expect(result.backend).toBe('google-direct');
    expect(geminiGenerate).toHaveBeenCalledTimes(1);
  });

  it('throws when every step in the cascade fails', async () => {
    openaiCreate
      .mockRejectedValueOnce(retryableHttp(429))
      .mockRejectedValueOnce(retryableHttp(503));
    geminiGenerate.mockRejectedValueOnce(retryableHttp(503));
    await expect(
      runAIOperation(
        makeOpts({ operationModelsOverride: [opEntry('a', 'provider/a')] }),
      ),
    ).rejects.toThrow(/All AI providers failed/);
  });

  it('routes straight to Gemini direct when inlineParts are present (skips OpenRouter)', async () => {
    geminiGenerate.mockResolvedValueOnce(geminiSuccess('multimodal-result'));
    const result = await runAIOperation(
      makeOpts({
        operationModelsOverride: [opEntry('a', 'provider/a')],
        inlineParts: [{ mimeType: 'application/pdf', data: 'BASE64' }],
      }),
    );
    expect(result.backend).toBe('google-direct');
    expect(result.text).toBe('multimodal-result');
    // OpenRouter was NEVER called even though there was an admin entry.
    expect(openaiCreate).not.toHaveBeenCalled();
    expect(geminiGenerate).toHaveBeenCalledTimes(1);
  });

  it('treats an empty completion as retryable (cascade moves on)', async () => {
    openaiCreate
      .mockResolvedValueOnce(openrouterSuccess('')) // empty → treated retryable
      .mockResolvedValueOnce(openrouterSuccess('second-attempt-text'));
    const result = await runAIOperation(
      makeOpts({
        operationModelsOverride: [opEntry('a', 'provider/a'), opEntry('b', 'provider/b')],
      }),
    );
    expect(result.text).toBe('second-attempt-text');
    expect(result.modelUsed).toBe('provider/b');
  });
});
