import { describe, it, expect, vi } from 'vitest';

vi.mock('firebase-admin/firestore', () => ({
  FieldValue: { serverTimestamp: () => 'SERVER_TS' },
  Timestamp: { fromMillis: (ms: number) => ({ _ms: ms }) },
}));

import '../lib/agents/defs/index.js';
import { getAgent } from '../lib/agents/registry.js';
import { escalationAdapter } from '../lib/agents/adapters/escalationAdapter.js';
import { getAdapter } from '../lib/agents/adapters/index.js';
import type { AgentSuggestionDoc } from '../../shared/types/agents.js';

function makeCtx(tenantDocs: Record<string, any[]> = {}, contextArrays: Record<string, any[]> = {}) {
  const col = (name: string) => ({
    doc: (id: string) => ({
      get: async () => {
        // context array doc: projects/{id}/data/{collection}
        return { exists: false, data: () => undefined };
      },
      collection: (sub: string) => col(`${name}/${id}/${sub}`),
    }),
    where: (_f: string, _o: string, val: any) => {
      const q: any = {
        limit: () => q,
        get: async () => ({
          docs: (tenantDocs[name] || [])
            .filter((r) => (r.clientId ?? val) === val || name === 'evidence')
            .map((r) => ({ id: r.id, data: () => r })),
        }),
      };
      return q;
    },
  });
  // context arrays served via projects/{id}/data/{collection}
  const db = {
    collection: (name: string) => {
      if (name === 'projects') {
        return {
          doc: (_pid: string) => ({
            collection: () => ({
              doc: (coll: string) => ({
                get: async () => ({
                  exists: !!contextArrays[coll],
                  data: () => ({ data: contextArrays[coll] || [] }),
                }),
              }),
            }),
          }),
        };
      }
      return col(name);
    },
  };
  return { db, uid: 'u1', primaryUid: 'tenant1', email: 'x@x.com', userData: { role: 'project_manager' } } as any;
}

const scope = { kind: 'project' as const, contextId: 'proj1' };

describe('agent registry', () => {
  it('registers all seven agents', () => {
    for (const key of ['riskIncident', 'compliance', 'governance', 'evidence', 'technical', 'monitoring', 'delivery']) {
      expect(getAgent(key), key).toBeTruthy();
    }
  });

  it('leaves unknown agents unregistered', () => {
    expect(getAgent('nonsense')).toBeUndefined();
  });

  it('every agent only emits output types it has words for, and the Technical Companion needs a question', () => {
    expect(getAgent('technical')!.needsInput).toBe(true);
    expect(getAgent('technical')!.allowedOutputTypes).toEqual(['technicalAnswer']);
    // Monitoring can run portfolio-wide; risk/incident cannot.
    expect(getAgent('monitoring')!.scopeKinds).toContain('portfolio');
    expect(getAgent('riskIncident')!.scopeKinds).not.toContain('portfolio');
  });
});

describe('compliance agent', () => {
  it('fences compliance items and forbids marking complete', async () => {
    const ctx = makeCtx({ controls: [] }, { complianceItems: [{ id: 'CI-1', name: 'Gas cert', stage: 'Information Gap', evidenceRequired: true }] });
    const bundle = await getAgent('compliance')!.retrieve(ctx, scope, {});
    expect(bundle.validIds.has('CI-1')).toBe(true);
    const spec = getAgent('compliance')!.buildPrompt(bundle, scope, {});
    expect(spec.prompt).toMatch(/obligation complete/i);
    expect(spec.prompt).toMatch(/never mark a control verified/i);
  });
});

describe('governance agent', () => {
  it('reads workspace-wide reports/meetings and forbids approving reports', async () => {
    const ctx = makeCtx({
      reports: [{ id: 'REP-1', clientId: 'tenant1', title: 'Q2 Board', status: 'Draft' }],
      meetings: [{ id: 'M-1', clientId: 'tenant1', title: 'Board', status: 'Scheduled' }],
      controls: [],
    });
    const bundle = await getAgent('governance')!.retrieve(ctx, scope, {});
    expect(bundle.validIds.has('REP-1')).toBe(true);
    expect(bundle.validIds.has('M-1')).toBe(true);
    const spec = getAgent('governance')!.buildPrompt(bundle, scope, {});
    expect(spec.prompt).toMatch(/never approve a report or issue a statutory position/i);
  });
});

describe('evidence agent', () => {
  it('cross-references records against evidence on record', async () => {
    const ctx = makeCtx(
      { controls: [{ id: 'C-1', clientId: 'tenant1', title: 'Fire doors', evidenceIds: [] }], incidents: [], evidence: [] },
      { complianceItems: [{ id: 'CI-1', name: 'EICR', evidenceRequired: true }] },
    );
    const bundle = await getAgent('evidence')!.retrieve(ctx, scope, {});
    expect(bundle.validIds.has('C-1')).toBe(true);
    expect(bundle.validIds.has('CI-1')).toBe(true);
    expect(getAgent('evidence')!.allowedOutputTypes).toContain('evidenceGap');
  });
});

describe('escalation adapter', () => {
  const s = { id: 'sug-1', clientId: 'tenant1', contextKind: 'project', contextId: 'proj1', title: 'Failed control', rationale: 'x' } as AgentSuggestionDoc;

  it('is wired for the escalation output type', () => {
    expect(getAdapter('escalation')).toBe(escalationAdapter);
  });

  it('can raise an Open escalation but not resolve or dismiss one', () => {
    expect(escalationAdapter.prohibited({ status: 'Resolved' } as any, s)).toMatch(/resolve|dismiss/i);
    expect(escalationAdapter.prohibited({ status: 'Open' } as any, s)).toBeNull();
    expect(escalationAdapter.prohibited({} as any, s)).toBeNull();
  });

  it('sanitizes to a safe alert shape with a clamped severity', () => {
    const clean = escalationAdapter.sanitize({ title: 'X', severity: 'Nonsense' } as any, s);
    expect(clean.severity).toBe('Medium');
  });
});
