import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../lib/activityLog.js', () => ({
  logActivity: vi.fn(async () => {}),
  logArrayChanges: vi.fn(async () => {}),
}));
vi.mock('firebase-admin/firestore', () => ({
  FieldValue: { serverTimestamp: () => 'SERVER_TS' },
  Timestamp: { fromMillis: (ms: number) => ({ _ms: ms }) },
}));
// The TAC module drags in heavy deps; only isTacElevated is used here.
vi.mock('../routes/technicalAssurance.js', () => ({ isTacElevated: () => false }));

import { agentRoutes } from '../routes/agents.js';
import type { AgentSuggestionDoc } from '../../shared/types/agents.js';

// ── In-memory Firestore double (equality queries + transactions) ─────────────
function makeDb(store: Record<string, Record<string, any>>) {
  let auto = 0;
  const col = (name: string) => {
    store[name] = store[name] || {};
    const docApi = (id?: string) => {
      const did = id || `auto-${++auto}`;
      return {
        id: did,
        get: async () => ({ exists: did in store[name], id: did, data: () => store[name][did] }),
        set: async (payload: any) => { store[name][did] = { ...payload }; },
        update: async (payload: any) => { store[name][did] = { ...(store[name][did] || {}), ...payload }; },
        delete: async () => { delete store[name][did]; },
        collection: (sub: string) => col(`${name}/${did}/${sub}`),
      };
    };
    return {
      doc: docApi,
      where(field: string, _op: string, val: any) {
        const self: any = {
          _filters: [{ field, val }],
          where(f: string, _o: string, v: any) { self._filters.push({ field: f, val: v }); return self; },
          limit: () => self,
          get: async () => ({
            get empty() { return this.docs.length === 0; },
            docs: Object.entries(store[name])
              .filter(([, d]: any) => self._filters.every((f: any) => d[f.field] === f.val))
              .map(([id, d]: any) => ({ id, data: () => d })),
          }),
        };
        return self;
      },
    };
  };
  return {
    collection: col,
    batch: () => ({ set() {}, update() {}, commit: async () => {} }),
    runTransaction: async (fn: any) => fn({
      get: async (ref: any) => ref.get(),
      update: (ref: any, payload: any) => ref.update(payload),
    }),
  };
}

function makeCtx(role: string, store: Record<string, Record<string, any>>, authorized = true) {
  return {
    db: makeDb(store),
    uid: 'u1',
    primaryUid: 'tenant1',
    email: 'pm@example.com',
    userData: { role, displayName: 'Pat M' },
    isAuthorizedForContext: async () => authorized,
  } as any;
}

function makeRes() {
  const res: any = { statusCode: 200, body: null };
  res.status = (c: number) => { res.statusCode = c; return res; };
  res.json = (b: any) => { res.body = b; return res; };
  return res;
}

function seedSuggestion(store: Record<string, Record<string, any>>, over: Partial<AgentSuggestionDoc> = {}) {
  const s: AgentSuggestionDoc = {
    id: 'sug-1', clientId: 'tenant1', contextKind: 'project', contextId: 'proj1',
    agentKey: 'riskIncident', runId: 'run-1', requestedByUid: 'u1', requestType: 'risk',
    outputType: 'capaTask', title: 'Fix the fire door', rationale: 'Overdue survey.',
    payload: { title: 'Fix the fire door', description: 'Book the survey', capaType: 'Corrective' },
    editedPayload: null, citations: { records: [], documents: [], web: [] },
    confidence: 0.7, assumptions: [], missingEvidence: [], reviewStatus: 'draft',
    reviewer: null, applied: null, createdAt: '2026-07-01', updatedAt: '2026-07-01', ...over,
  };
  store.agentSuggestions = { 'sug-1': s };
  return s;
}

beforeEach(() => vi.clearAllMocks());

describe('agentReviewSuggestion', () => {
  it('rejects a non-PM caller', async () => {
    const store: any = {}; seedSuggestion(store);
    const res = makeRes();
    await agentRoutes.agentReviewSuggestion(
      { body: { suggestionId: 'sug-1', decision: 'accepted' } }, res, makeCtx('viewer', store));
    expect(res.statusCode).toBe(403);
  });

  it('requires a reason to reject', async () => {
    const store: any = {}; seedSuggestion(store);
    const res = makeRes();
    await agentRoutes.agentReviewSuggestion(
      { body: { suggestionId: 'sug-1', decision: 'rejected' } }, res, makeCtx('project_manager', store));
    expect(res.statusCode).toBe(400);
  });

  it('accepts a draft and records the reviewer', async () => {
    const store: any = {}; seedSuggestion(store);
    const res = makeRes();
    await agentRoutes.agentReviewSuggestion(
      { body: { suggestionId: 'sug-1', decision: 'accepted' } }, res, makeCtx('project_manager', store));
    expect(res.statusCode).toBe(200);
    expect(store.agentSuggestions['sug-1'].reviewStatus).toBe('accepted');
    expect(store.agentSuggestions['sug-1'].reviewer.uid).toBe('u1');
  });

  it('keeps the original payload and records a diff on edit', async () => {
    const store: any = {}; seedSuggestion(store);
    const res = makeRes();
    await agentRoutes.agentReviewSuggestion(
      { body: { suggestionId: 'sug-1', decision: 'edited', editedPayload: { title: 'Fix the fire door TODAY', description: 'Book the survey', capaType: 'Corrective' } } },
      res, makeCtx('project_manager', store));
    expect(res.statusCode).toBe(200);
    const saved = store.agentSuggestions['sug-1'];
    expect(saved.payload.title).toBe('Fix the fire door');           // original untouched
    expect(saved.editedPayload.title).toBe('Fix the fire door TODAY');
    expect(saved.reviewer.editDiff).toContainEqual({ field: 'title', from: 'Fix the fire door', to: 'Fix the fire door TODAY' });
  });

  it('refuses an illegal transition (rejected → accepted)', async () => {
    const store: any = {}; seedSuggestion(store, { reviewStatus: 'rejected' });
    const res = makeRes();
    await agentRoutes.agentReviewSuggestion(
      { body: { suggestionId: 'sug-1', decision: 'accepted' } }, res, makeCtx('project_manager', store));
    expect(res.statusCode).toBe(409);
  });
});

describe('agentApplySuggestion', () => {
  it('refuses to apply a suggestion that is not accepted/edited', async () => {
    const store: any = {}; seedSuggestion(store, { reviewStatus: 'draft' });
    const res = makeRes();
    await agentRoutes.agentApplySuggestion(
      { body: { suggestionId: 'sug-1' } }, res, makeCtx('project_manager', store));
    expect(res.statusCode).toBe(409);
  });

  it('rejects a non-PM caller even on an accepted suggestion', async () => {
    const store: any = {}; seedSuggestion(store, { reviewStatus: 'accepted' });
    const res = makeRes();
    await agentRoutes.agentApplySuggestion(
      { body: { suggestionId: 'sug-1' } }, res, makeCtx('viewer', store));
    expect(res.statusCode).toBe(403);
  });

  it('refuses when the caller has lost access to the context', async () => {
    const store: any = {}; seedSuggestion(store, { reviewStatus: 'accepted' });
    const res = makeRes();
    await agentRoutes.agentApplySuggestion(
      { body: { suggestionId: 'sug-1' } }, res, makeCtx('project_manager', store, /*authorized*/ false));
    expect(res.statusCode).toBe(403);
  });

  it('applies an accepted CAPA task, writes it to the tasks array, and flips to applied', async () => {
    const store: any = {}; seedSuggestion(store, { reviewStatus: 'accepted' });
    const res = makeRes();
    await agentRoutes.agentApplySuggestion(
      { body: { suggestionId: 'sug-1' } }, res, makeCtx('project_manager', store));

    expect(res.statusCode).toBe(200);
    const tasks = store['projects/proj1/data']?.tasks?.data;
    expect(Array.isArray(tasks)).toBe(true);
    expect(tasks[0].title).toBe('Fix the fire door');
    // The agent can never pre-approve a CAPA: the approval fields are stripped and it
    // starts un-approved (a human approves it later through the normal CAPA flow).
    expect(tasks[0].capaStatus).not.toBe('Approved');
    expect(tasks[0].capaApprovedBy).toBeUndefined();
    expect(tasks[0].capaApprovedAt).toBeUndefined();
    expect(tasks[0].aiSuggestionId).toBe('sug-1');
    expect(store.agentSuggestions['sug-1'].reviewStatus).toBe('applied');
    expect(store.agentSuggestions['sug-1'].applied.collection).toBe('tasks');
  });

  it('is idempotent: a second apply does not write a duplicate task', async () => {
    const store: any = {}; seedSuggestion(store, { reviewStatus: 'accepted' });
    await agentRoutes.agentApplySuggestion({ body: { suggestionId: 'sug-1' } }, makeRes(), makeCtx('project_manager', store));
    // Force the status back to accepted to simulate a flip that never landed, then retry.
    store.agentSuggestions['sug-1'].reviewStatus = 'accepted';
    const res2 = makeRes();
    await agentRoutes.agentApplySuggestion({ body: { suggestionId: 'sug-1' } }, res2, makeCtx('project_manager', store));

    expect(res2.statusCode).toBe(200);
    expect(store['projects/proj1/data'].tasks.data).toHaveLength(1);   // still one task
  });

  it('never creates a compliance item in a completed stage, even when the model asked for it', async () => {
    const store: any = {};
    seedSuggestion(store, {
      reviewStatus: 'accepted',
      outputType: 'complianceItem',
      payload: { name: 'Gas safety cert', stage: 'Live' },      // model tried to pre-complete it
    });
    const res = makeRes();
    await agentRoutes.agentApplySuggestion(
      { body: { suggestionId: 'sug-1' } }, res, makeCtx('project_manager', store));

    expect(res.statusCode).toBe(200);
    const items = store['projects/proj1/data'].complianceItems.data;
    expect(items[0].stage).not.toBe('Live');
    expect(items[0].stage).toBe('Information Gap');
  });

  it('cannot apply an output type with no adapter (e.g. narrative)', async () => {
    const store: any = {}; seedSuggestion(store, { reviewStatus: 'accepted', outputType: 'narrative', payload: { text: 'summary' } });
    const res = makeRes();
    await agentRoutes.agentApplySuggestion(
      { body: { suggestionId: 'sug-1' } }, res, makeCtx('project_manager', store));
    expect(res.statusCode).toBe(400);
  });
});
