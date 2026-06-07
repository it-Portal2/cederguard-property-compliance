import { describe, it, expect, vi, beforeEach } from 'vitest';
import { adminRoutes } from '../routes/admin.js';
import { SEED_CONFIG } from '../lib/aiModelConfig.js';

// ── Shared mock helpers ────────────────────────────────────────────────────
// The admin routes interact with Firestore through ctx.db, with FieldValue
// shimmed in by firebase-admin. We don't need a real Firestore — only a
// stub that records calls and returns plausible shapes.

function makeRes() {
  const headers: Record<string, string> = {};
  let statusCode = 0;
  let body: any = undefined;
  return {
    setHeader: (k: string, v: string) => { headers[k] = v; },
    status(code: number) { statusCode = code; return this; },
    json(payload: any) { body = payload; return this; },
    get statusCode() { return statusCode; },
    get body() { return body; },
  } as any;
}

function makeCtx(overrides: Partial<{
  isAdmin: boolean;
  isClientAdmin: boolean;
  uid: string;
  primaryUid: string;
  email: string;
  userData: Record<string, any>;
  docExists: boolean;
  docData: any;
  setCalls: any[];
  addCalls: any[];
}> = {}) {
  const setCalls: any[] = overrides.setCalls ?? [];
  const addCalls: any[] = overrides.addCalls ?? [];

  const docMock = {
    get: vi.fn().mockResolvedValue({
      exists: overrides.docExists ?? false,
      data: () => overrides.docData ?? undefined,
    }),
    set: vi.fn((data: any) => { setCalls.push(data); return Promise.resolve(); }),
  };

  const collectionMock = {
    add: vi.fn((data: any) => { addCalls.push(data); return Promise.resolve({ id: 'audit-1' }); }),
  };

  const db = {
    doc: vi.fn(() => docMock),
    collection: vi.fn(() => collectionMock),
  };

  return {
    db,
    uid: overrides.uid ?? 'admin-uid',
    email: overrides.email ?? 'admin@example.com',
    userData: overrides.userData ?? { role: 'admin' },
    primaryUid: overrides.primaryUid ?? overrides.uid ?? 'admin-uid',
    isAdmin: overrides.isAdmin ?? true,
    isClientAdmin: overrides.isClientAdmin ?? true,
    SYSTEM_ADMIN_EMAILS: [],
    isAuthorizedForContext: vi.fn().mockResolvedValue(true),
    getAuthService: vi.fn(),
    getMessagingService: vi.fn(),
    _setCalls: setCalls,
    _addCalls: addCalls,
  } as any;
}

describe('adminGetAIModelConfig', () => {
  it('rejects non-admin caller with 403', async () => {
    const res = makeRes();
    const ctx = makeCtx({ isAdmin: false });
    await adminRoutes.adminGetAIModelConfig({} as any, res, ctx);
    expect(res.statusCode).toBe(403);
    expect(res.body?.error).toBe('Forbidden');
  });

  it('returns the seed when the doc is missing — does not write', async () => {
    const res = makeRes();
    const ctx = makeCtx({ docExists: false });
    await adminRoutes.adminGetAIModelConfig({} as any, res, ctx);
    expect(res.statusCode).toBe(200);
    expect(res.body?.success).toBe(true);
    expect(res.body?.config?.chatModels?.length).toBe(SEED_CONFIG.chatModels.length);
    // Confirm we did NOT write the seed to Firestore on a read.
    expect((ctx as any)._setCalls.length).toBe(0);
  });

  it('returns the stored doc when present', async () => {
    const res = makeRes();
    const stored = {
      chatModels: [
        {
          id: 'free-x',
          label: 'Custom',
          group: 'free',
          backend: 'openrouter',
          modelString: 'custom/model:free',
          enabled: true,
          isDefault: true,
        },
      ],
      operationModels: [],
      updatedAt: { _seconds: 0, _nanoseconds: 0 },
      updatedBy: 'someone',
    };
    const ctx = makeCtx({ docExists: true, docData: stored });
    await adminRoutes.adminGetAIModelConfig({} as any, res, ctx);
    expect(res.statusCode).toBe(200);
    expect(res.body?.config?.chatModels?.[0]?.id).toBe('free-x');
  });
});

describe('adminUpdateAIModelConfig', () => {
  beforeEach(() => {
    // Reset module-level state inside admin.ts caches between tests by
    // re-importing is overkill; the cache key includes a fresh cacheBuster
    // after every save so cross-test pollution is bounded already.
  });

  it('rejects non-admin caller with 403', async () => {
    const res = makeRes();
    const ctx = makeCtx({ isAdmin: false });
    await adminRoutes.adminUpdateAIModelConfig({ body: { config: SEED_CONFIG } } as any, res, ctx);
    expect(res.statusCode).toBe(403);
  });

  it('rejects invalid payload with 400 + error list', async () => {
    const res = makeRes();
    const ctx = makeCtx();
    await adminRoutes.adminUpdateAIModelConfig(
      { body: { config: { chatModels: 'not-an-array', operationModels: [] } } } as any,
      res,
      ctx,
    );
    expect(res.statusCode).toBe(400);
    expect(res.body?.success).toBe(false);
    expect(Array.isArray(res.body?.errors)).toBe(true);
  });

  it('writes the doc + audit-log entry on valid payload', async () => {
    const res = makeRes();
    const ctx = makeCtx();
    await adminRoutes.adminUpdateAIModelConfig(
      { body: { config: SEED_CONFIG } } as any,
      res,
      ctx,
    );
    expect(res.statusCode).toBe(200);
    expect((ctx as any)._setCalls.length).toBe(1);
    const written = (ctx as any)._setCalls[0];
    expect(written.updatedBy).toBe('admin-uid');
    expect((ctx as any)._addCalls.length).toBe(1);
    const audit = (ctx as any)._addCalls[0];
    expect(audit.action).toBe('adminConfig.updateAIModelConfig');
    expect(audit.actorUid).toBe('admin-uid');
  });
});

describe('getActiveChatModels', () => {
  it('is callable by non-admin users (auth-only, no super-admin gate)', async () => {
    const res = makeRes();
    const ctx = makeCtx({ isAdmin: false, isClientAdmin: false });
    await adminRoutes.getActiveChatModels({} as any, res, ctx);
    expect(res.statusCode).toBe(200);
    expect(res.body?.success).toBe(true);
  });

  it('returns empty list + hasAdminConfig:false when no admin doc exists (no seed substitution)', async () => {
    const res = makeRes();
    const ctx = makeCtx({ docExists: false, primaryUid: 'unique-empty-tenant' });
    await adminRoutes.getActiveChatModels({} as any, res, ctx);
    expect(res.statusCode).toBe(200);
    expect(res.body?.success).toBe(true);
    expect(res.body?.hasAdminConfig).toBe(false);
    expect(res.body?.chatModels?.length).toBe(0);
    expect(res.body?.defaultModelId).toBeNull();
  });

  it('reports hasAdminConfig:true when a curated doc exists', async () => {
    const res = makeRes();
    const customDoc = {
      chatModels: [
        { id: 'a', label: 'A', group: 'free', backend: 'openrouter', modelString: 'p/a', enabled: true, isDefault: true },
      ],
      operationModels: [],
    };
    const ctx = makeCtx({ docExists: true, docData: customDoc, primaryUid: 'unique-tenant-flag' });
    await adminRoutes.getActiveChatModels({} as any, res, ctx);
    expect(res.statusCode).toBe(200);
    expect(res.body?.hasAdminConfig).toBe(true);
  });

  it('returns only enabled chat models + the admin-marked default', async () => {
    const res = makeRes();
    const customDoc = {
      chatModels: [
        { id: 'a', label: 'A', group: 'free', backend: 'openrouter', modelString: 'p/a', enabled: true, isDefault: true },
        { id: 'b', label: 'B', group: 'free', backend: 'openrouter', modelString: 'p/b', enabled: false, isDefault: false },
      ],
      operationModels: [],
    };
    const ctx = makeCtx({ docExists: true, docData: customDoc, primaryUid: 'unique-tenant-1' });
    await adminRoutes.getActiveChatModels({} as any, res, ctx);
    expect(res.statusCode).toBe(200);
    expect(res.body?.chatModels?.length).toBe(1);
    expect(res.body?.chatModels?.[0]?.id).toBe('a');
    expect(res.body?.defaultModelId).toBe('a');
  });
});

describe('adminGetOpenRouterCatalog', () => {
  it('rejects non-admin caller with 403', async () => {
    const res = makeRes();
    const ctx = makeCtx({ isAdmin: false });
    await adminRoutes.adminGetOpenRouterCatalog({ body: {} } as any, res, ctx);
    expect(res.statusCode).toBe(403);
  });
});
