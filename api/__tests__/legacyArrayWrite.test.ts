import { describe, it, expect, vi, beforeEach } from 'vitest';

const appendHistoryRow = vi.fn().mockResolvedValue(undefined);
const logArrayChanges = vi.fn().mockResolvedValue(undefined);
const logActivity = vi.fn().mockResolvedValue(undefined);
const writeSevereEscalations = vi.fn();

vi.mock('../lib/historyRows.js', () => ({ appendHistoryRow: (...a: any[]) => appendHistoryRow(...a) }));
vi.mock('../lib/activityLog.js', () => ({
  logArrayChanges: (...a: any[]) => logArrayChanges(...a),
  logActivity: (...a: any[]) => logActivity(...a),
}));
// detectSevereTransitions stays REAL — the escalation decision is part of what we're proving.
vi.mock('../lib/riskSevereEscalation.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/riskSevereEscalation.js')>();
  return { ...actual, writeSevereEscalations: (...a: any[]) => writeSevereEscalations(...a) };
});

const { writeLegacyArray } = await import('../lib/legacyArrayWrite.js');

function makeCtx(existingArray: unknown[] | null, opts: { programmeExists?: boolean } = {}) {
  const set = vi.fn().mockResolvedValue(undefined);
  const del = vi.fn().mockResolvedValue(undefined);
  const dataDocGet = vi.fn().mockResolvedValue({
    exists: existingArray !== null,
    data: () => ({ data: existingArray }),
  });

  const db = {
    collection: vi.fn((col: string) => ({
      doc: vi.fn(() => {
        if (col === 'programmes') {
          return { get: vi.fn().mockResolvedValue({ exists: !!opts.programmeExists }) };
        }
        // projects/{id}
        return {
          collection: vi.fn(() => ({
            doc: vi.fn(() => ({ get: dataDocGet, set, del, delete: del })),
          })),
        };
      }),
    })),
  };

  const ctx = { db, uid: 'u1', primaryUid: 'tenant1', email: 'pm@example.com', userData: { role: 'project_manager' } } as any;
  return { ctx, set, del, dataDocGet };
}

// Severe == Impact rating of 5 on gross OR residual (isSevereRisk in riskSevereEscalation.ts).
const severeRisk = (id: string) => ({ id, title: `Risk ${id}`, grossI: 5, residualI: 3 });
const mildRisk = (id: string) => ({ id, title: `Risk ${id}`, grossI: 2, residualI: 1 });

beforeEach(() => {
  vi.clearAllMocks();
  writeSevereEscalations.mockResolvedValue({ alertCount: 0, recipientCount: 0, riskIds: [] });
});

describe('writeLegacyArray', () => {
  it('writes the whole array to projects/{contextId}/data/{collection}', async () => {
    const { ctx, set } = makeCtx(null);
    const rows = [{ id: 'T1', title: 'Task' }];

    await writeLegacyArray(ctx, { collection: 'tasks', data: rows, projectId: 'proj1' });

    expect(set).toHaveBeenCalledTimes(1);
    expect(set.mock.calls[0][0]).toMatchObject({ data: rows });
    expect(set.mock.calls[0][0].updatedAt).toBeDefined();
  });

  it('deletes the doc when data is null', async () => {
    const { ctx, set, del } = makeCtx([{ id: 'R1' }]);

    await writeLegacyArray(ctx, { collection: 'risks', data: null, projectId: 'proj1' });

    expect(del).toHaveBeenCalledTimes(1);
    expect(set).not.toHaveBeenCalled();
  });

  it('reads prev state BEFORE writing and appends a history row for tracked collections', async () => {
    const prev = [mildRisk('R1')];
    const next = [mildRisk('R1'), mildRisk('R2')];
    const { ctx, dataDocGet, set } = makeCtx(prev);

    await writeLegacyArray(ctx, { collection: 'risks', data: next, projectId: 'proj1' });

    // The pre-mutation read must happen before the write, else history captures the new state.
    expect(dataDocGet.mock.invocationCallOrder[0]).toBeLessThan(set.mock.invocationCallOrder[0]);
    expect(appendHistoryRow).toHaveBeenCalledTimes(1);
    expect(appendHistoryRow.mock.calls[0][1]).toMatchObject({
      kind: 'legacyArray',
      collection: 'risks',
      ownerScope: 'proj1',
      prevState: prev,
      newState: next,
      changeKind: 'update',
    });
  });

  it('marks changeKind create when there was no prior doc, softDelete when data is null', async () => {
    const fresh = makeCtx(null);
    await writeLegacyArray(fresh.ctx, { collection: 'kris', data: [{ id: 'K1' }], projectId: 'p1' });
    expect(appendHistoryRow.mock.calls[0][1]).toMatchObject({ changeKind: 'create' });

    vi.clearAllMocks();
    const existing = makeCtx([{ id: 'K1' }]);
    await writeLegacyArray(existing.ctx, { collection: 'kris', data: null, projectId: 'p1' });
    expect(appendHistoryRow.mock.calls[0][1]).toMatchObject({ changeKind: 'softDelete', newState: null });
  });

  it('does not append history rows for untracked collections', async () => {
    const { ctx } = makeCtx(null);
    await writeLegacyArray(ctx, { collection: 'tasks', data: [{ id: 'T1' }], projectId: 'p1' });
    expect(appendHistoryRow).not.toHaveBeenCalled();
  });

  it('diffs item arrays into the activity log (awaited, so the write survives serverless teardown)', async () => {
    const prev = [mildRisk('R1')];
    const next = [mildRisk('R1'), mildRisk('R2')];
    const { ctx } = makeCtx(prev);

    await writeLegacyArray(ctx, { collection: 'risks', data: next, projectId: 'proj1' });

    expect(logArrayChanges).toHaveBeenCalledWith(ctx, 'risks', 'proj1', prev, next);
  });

  it('logs complianceAnalysis as a single update event, not an array diff', async () => {
    const { ctx } = makeCtx(null);

    await writeLegacyArray(ctx, { collection: 'complianceAnalysis', data: { score: 4 }, projectId: 'p1' });

    expect(logArrayChanges).not.toHaveBeenCalled();
    expect(logActivity).toHaveBeenCalledWith(ctx, 'compliance_analysis_saved', expect.objectContaining({
      category: 'update',
      entityType: 'compliance',
      entityId: 'p1',
    }));
  });

  it('escalates a risk that transitions INTO severe and reports it back to the caller', async () => {
    writeSevereEscalations.mockResolvedValue({ alertCount: 1, recipientCount: 2, riskIds: ['R1'] });
    const { ctx } = makeCtx([mildRisk('R1')]);

    const result = await writeLegacyArray(ctx, {
      collection: 'risks',
      data: [severeRisk('R1')],
      projectId: 'proj1',
    });

    expect(writeSevereEscalations).toHaveBeenCalledTimes(1);
    expect(writeSevereEscalations.mock.calls[0][1]).toMatchObject({
      contextId: 'proj1',
      contextKind: 'project',
    });
    expect(result.severeNotified).toEqual({ count: 1, recipientCount: 2 });
  });

  it('detects programme context for the escalation route', async () => {
    writeSevereEscalations.mockResolvedValue({ alertCount: 1, recipientCount: 1, riskIds: ['R1'] });
    const { ctx } = makeCtx([mildRisk('R1')], { programmeExists: true });

    await writeLegacyArray(ctx, { collection: 'risks', data: [severeRisk('R1')], projectId: 'prog1' });

    expect(writeSevereEscalations.mock.calls[0][1]).toMatchObject({ contextKind: 'programme' });
  });

  it('does not escalate when no risk transitions into severe', async () => {
    const { ctx } = makeCtx([severeRisk('R1')]);

    // R1 was ALREADY severe — a re-save must not re-trigger.
    const result = await writeLegacyArray(ctx, {
      collection: 'risks',
      data: [severeRisk('R1')],
      projectId: 'proj1',
    });

    expect(writeSevereEscalations).not.toHaveBeenCalled();
    expect(result.severeNotified).toBeUndefined();
  });

  it('never blocks the save when severe-escalation throws', async () => {
    writeSevereEscalations.mockRejectedValue(new Error('recipient lookup failed'));
    const { ctx, set } = makeCtx([mildRisk('R1')]);

    const result = await writeLegacyArray(ctx, {
      collection: 'risks',
      data: [severeRisk('R1')],
      projectId: 'proj1',
    });

    expect(set).toHaveBeenCalledTimes(1);
    expect(result.severeNotified).toBeUndefined();
  });
});
