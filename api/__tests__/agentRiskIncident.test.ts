import { describe, it, expect, vi } from 'vitest';

vi.mock('firebase-admin/firestore', () => ({
  FieldValue: { serverTimestamp: () => 'SERVER_TS' },
  Timestamp: { fromMillis: (ms: number) => ({ _ms: ms }) },
}));

import { riskIncidentAgent } from '../lib/agents/defs/riskIncident.js';
import { getAgent } from '../lib/agents/registry.js';
import { incidentAdapter } from '../lib/agents/adapters/incidentAdapter.js';
import '../lib/agents/defs/index.js';
import type { AgentSuggestionDoc } from '../../shared/types/agents.js';

// Firestore double serving the context array docs + tenant collections.
function makeCtx(data: {
  risks?: any[]; issues?: any[]; kris?: any[]; incidents?: any[]; controls?: any[];
}) {
  const store: Record<string, any> = {
    'projects/proj1/data/risks': { data: data.risks || [] },
    'projects/proj1/data/issues': { data: data.issues || [] },
    'projects/proj1/data/kris': { data: data.kris || [] },
  };
  const col = (name: string) => ({
    doc: (id: string) => ({
      get: async () => {
        const key = `${name}/${id}`;
        return { exists: key in store, id, data: () => store[key] };
      },
      collection: (sub: string) => col(`${name}/${id}/${sub}`),
      set: async (p: any, opts: any) => {
        const key = `${name}/${id}`;
        store[key] = opts?.merge ? { ...(store[key] || {}), ...p } : { ...p };
      },
    }),
    where: (_f: string, _o: string, val: any) => ({
      limit: () => ({
        get: async () => ({
          docs: (name === 'incidents' ? data.incidents : name === 'controls' ? data.controls : [])
            ?.filter((r: any) => (r.clientId ?? 'tenant1') === val)
            .map((r: any) => ({ id: r.id, data: () => r })) || [],
        }),
      }),
    }),
  });
  return { db: { collection: col }, uid: 'u1', primaryUid: 'tenant1', email: 'pm@x.com', userData: { role: 'project_manager' } } as any;
}

const scope = { kind: 'project' as const, contextId: 'proj1' };

describe('Risk & Incident agent', () => {
  it('is registered in the AGENTS map', () => {
    expect(getAgent('riskIncident')).toBe(riskIncidentAgent);
    expect(riskIncidentAgent.scopeKinds).toContain('project');
  });

  it('retrieves and fences records from every source, exposing their ids as citable', async () => {
    const ctx = makeCtx({
      risks: [{ id: 'R-1', title: 'Cladding', grossL: 4, grossI: 5, status: 'Open' }],
      incidents: [{ id: 'I-1', clientId: 'tenant1', title: 'Water ingress', severity: 'High', projectId: 'proj1' }],
      controls: [{ id: 'C-1', clientId: 'tenant1', title: 'Fire strategy', status: 'Effective', projectId: 'proj1' }],
    });

    const bundle = await riskIncidentAgent.retrieve(ctx, scope, {});

    expect(bundle.fenced).toContain('<RISKS>');
    expect(bundle.fenced).toContain('[R-1]');
    expect(bundle.fenced).toContain('<INCIDENTS>');
    expect(bundle.fenced).toContain('[I-1]');
    expect(bundle.validIds.has('R-1')).toBe(true);
    expect(bundle.validIds.has('I-1')).toBe(true);
    expect(bundle.validIds.has('C-1')).toBe(true);
    expect(bundle.recordCounts.risks).toBe(1);
  });

  it('only shows tenant + context incidents (permission inheritance)', async () => {
    const ctx = makeCtx({
      incidents: [
        { id: 'I-1', clientId: 'tenant1', title: 'Ours', projectId: 'proj1' },
        { id: 'I-2', clientId: 'OTHER', title: 'Other tenant', projectId: 'proj1' },
        { id: 'I-3', clientId: 'tenant1', title: 'Other project', projectId: 'projX' },
      ],
    });
    const bundle = await riskIncidentAgent.retrieve(ctx, scope, {});
    expect(bundle.validIds.has('I-1')).toBe(true);
    expect(bundle.validIds.has('I-2')).toBe(false); // other tenant filtered by query
    expect(bundle.validIds.has('I-3')).toBe(false); // other project filtered in memory
  });

  it('builds a prompt that forbids closing incidents and downgrading risks', async () => {
    const ctx = makeCtx({ risks: [{ id: 'R-1', title: 'X' }] });
    const bundle = await riskIncidentAgent.retrieve(ctx, scope, {});
    const spec = riskIncidentAgent.buildPrompt(bundle, scope, {});
    expect(spec.prompt).toMatch(/never.*clos/i);
    expect(spec.prompt).toContain('this project');
    expect((spec.responseSchema as any).properties.suggestions).toBeTruthy();
  });
});

describe('incidentAdapter (never closes an incident)', () => {
  const suggestion = { id: 'sug-1', clientId: 'tenant1' } as AgentSuggestionDoc;

  it('vetoes an update that carries a status change', () => {
    const veto = incidentAdapter.prohibited({ incidentId: 'I-1', status: 'Closed' } as any, suggestion);
    expect(veto).toMatch(/status|close/i);
  });

  it('strips status and closedAt from the sanitized payload', () => {
    const clean = incidentAdapter.sanitize(
      { incidentId: 'I-1', rootCause: 'Sealant failure', status: 'Closed', closedAt: '2026-07-01' } as any,
      suggestion,
    );
    expect(clean).not.toHaveProperty('status');
    expect(clean).not.toHaveProperty('closedAt');
    expect(clean.rootCause).toBe('Sealant failure');
  });

  it('vetoes an update with no target incident', () => {
    expect(incidentAdapter.prohibited({ rootCause: 'x' } as any, suggestion)).toMatch(/target/i);
  });
});
