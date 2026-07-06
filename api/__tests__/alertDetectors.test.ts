import { describe, it, expect } from 'vitest';
import { computeDetectedAlerts } from '../lib/alertEngine/detectors.js';
import { DEFAULT_ALERT_THRESHOLDS, resolveThresholds } from '../lib/alertConfig.js';

const NOW = new Date('2026-07-06T12:00:00.000Z');
const daysAgo = (n: number) =>
  new Date(NOW.getTime() - n * 24 * 60 * 60 * 1000).toISOString();

const empty = { complianceItems: [], tasks: [], incidents: [], risks: [] };

describe('computeDetectedAlerts', () => {
  it('flags missing evidence only when required, absent, and not live', () => {
    const out = computeDetectedAlerts(
      {
        ...empty,
        complianceItems: [
          { id: 'c1', title: 'Fire doors', evidenceRequired: true, evidence: '', stage: 'In Progress' },
          { id: 'c2', title: 'Done', evidenceRequired: true, evidence: '', stage: 'Live' }, // not flagged (live)
          { id: 'c3', title: 'Has evidence', evidenceRequired: true, evidence: 'url', stage: 'In Progress' }, // not flagged
          { id: 'c4', title: 'Not required', evidenceRequired: false, evidence: '', stage: 'In Progress' }, // not flagged
        ],
      },
      DEFAULT_ALERT_THRESHOLDS,
      NOW,
    );
    const evidence = out.filter((a) => a.signalKind === 'evidence-missing');
    expect(evidence).toHaveLength(1);
    expect(evidence[0].entityId).toBe('c1');
    expect(evidence[0].dedupeKey).toBe('evidence-missing:c1');
  });

  it('flags overdue compliance immediately (0 grace) but not done items', () => {
    const out = computeDetectedAlerts(
      {
        ...empty,
        complianceItems: [
          { id: 'c1', title: 'Overdue', dueDate: daysAgo(1), stage: 'In Progress' },
          { id: 'c2', title: 'Archived overdue', dueDate: daysAgo(30), stage: 'Archived' }, // done → skip
          { id: 'c3', title: 'Future', dueDate: '2027-01-01', stage: 'In Progress' }, // not overdue
        ],
      },
      DEFAULT_ALERT_THRESHOLDS,
      NOW,
    );
    const overdue = out.filter((a) => a.signalKind === 'compliance-overdue');
    expect(overdue.map((a) => a.entityId)).toEqual(['c1']);
  });

  it('flags stale incidents at/after the threshold and CAPA overdue', () => {
    const out = computeDetectedAlerts(
      {
        ...empty,
        incidents: [
          { id: 'i1', title: 'Old open', type: 'Damp', status: 'Open', occurredAt: daysAgo(10) },
          { id: 'i2', title: 'Recent open', type: 'Fire', status: 'Open', occurredAt: daysAgo(2) },
          { id: 'i3', title: 'Closed old', type: 'Gas', status: 'Closed', occurredAt: daysAgo(50) },
        ],
        tasks: [
          { id: 't1', title: 'CAPA late', capaType: 'Corrective', status: 'Open', dueDate: daysAgo(3) },
          { id: 't2', title: 'Non-CAPA late', status: 'Open', dueDate: daysAgo(3) }, // no capaType → skip
        ],
      },
      DEFAULT_ALERT_THRESHOLDS,
      NOW,
    );
    expect(out.filter((a) => a.signalKind === 'incident-stale').map((a) => a.entityId)).toEqual(['i1']);
    expect(out.filter((a) => a.signalKind === 'capa-overdue').map((a) => a.entityId)).toEqual(['t1']);
  });

  it('flags a recurring incident type (>=2 in 90d) once per type', () => {
    const out = computeDetectedAlerts(
      {
        ...empty,
        incidents: [
          { id: 'i1', type: 'Damp', status: 'Open', occurredAt: daysAgo(5) },
          { id: 'i2', type: 'Damp', status: 'Closed', occurredAt: daysAgo(20) },
          { id: 'i3', type: 'Fire', status: 'Open', occurredAt: daysAgo(5) }, // single → not recurring
          { id: 'i4', type: 'Damp', status: 'Open', occurredAt: daysAgo(200) }, // outside window
        ],
      },
      DEFAULT_ALERT_THRESHOLDS,
      NOW,
    );
    const rec = out.filter((a) => a.signalKind === 'incident-recurring');
    expect(rec).toHaveLength(1);
    expect(rec[0].entityId).toBe('type:Damp');
    expect(rec[0].entityTitle).toBe('2× Damp');
  });

  it('respects overridden thresholds (stale window)', () => {
    const thresholds = resolveThresholds({ incidentStaleDays: 30 });
    const out = computeDetectedAlerts(
      { ...empty, incidents: [{ id: 'i1', type: 'X', status: 'Open', occurredAt: daysAgo(10) }] },
      thresholds,
      NOW,
    );
    expect(out.filter((a) => a.signalKind === 'incident-stale')).toHaveLength(0);
  });
});
