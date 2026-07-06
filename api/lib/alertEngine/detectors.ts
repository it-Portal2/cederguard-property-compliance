// Pure detection logic for the automatic alert engine.
//
// Given a workspace's records + the resolved thresholds + the current
// moment, return the DetectedAlert[] that should be persisted + dispatched
// by the cron handler. No Firestore / FCM side effects — a pure transform,
// unit-testable like `chaseEngine.ts`. Server-owned (no web imports) so the
// api→web boundary is respected; the recurrence rule is re-implemented here
// rather than importing web/lib/learning/recurrence.ts.
//
// Covers 6 state-based signals. The 7th (risk turns severe) is event-driven
// on risk save (api/lib/riskSevereEscalation.ts); "board/regulator reporting"
// is the existing governance chase engine.

import type { AlertThresholds } from '../alertConfig.js';

export type AlertSignalKind =
  | 'evidence-missing'
  | 'compliance-overdue'
  | 'capa-overdue'
  | 'incident-stale'
  | 'incident-recurring'
  | 'risk-overdue';

export type AlertSeverity = 'info' | 'warning' | 'urgent';

export interface DetectedAlert {
  signalKind: AlertSignalKind;
  /** Stable key `${signalKind}:${entityId}` — dedupe within the handler window. */
  dedupeKey: string;
  severity: AlertSeverity;
  entityKind: 'compliance' | 'task' | 'incident' | 'risk';
  entityId: string;
  entityTitle: string;
  projectId: string | null;
  message: string;
  /** Human note on which threshold fired (audit/telemetry). */
  thresholdUsed: string;
}

export interface DetectorInput {
  complianceItems: any[];
  tasks: any[];
  incidents: any[];
  risks: any[];
}

const DAY_MS = 24 * 60 * 60 * 1000;

const parseDate = (v: any): Date | null => {
  if (!v || typeof v !== 'string' || v === 'No date set') return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
};

const titleOf = (r: any, fallback: string): string =>
  String(r?.title || r?.name || fallback);

const isComplianceDone = (c: any): boolean =>
  c?.stage === 'Live' || c?.stage === 'Archived';

export function computeDetectedAlerts(
  input: DetectorInput,
  t: AlertThresholds,
  now: Date,
): DetectedAlert[] {
  const out: DetectedAlert[] = [];
  const nowMs = now.getTime();
  const push = (a: Omit<DetectedAlert, 'dedupeKey'>) =>
    out.push({ ...a, dedupeKey: `${a.signalKind}:${a.entityId}` });

  const compliance = Array.isArray(input.complianceItems) ? input.complianceItems : [];
  const tasks = Array.isArray(input.tasks) ? input.tasks : [];
  const incidents = Array.isArray(input.incidents) ? input.incidents : [];
  const risks = Array.isArray(input.risks) ? input.risks : [];

  // 1 — evidence missing (state-based, not date-based)
  for (const c of compliance) {
    if (c?.evidenceRequired && !c?.evidence && !isComplianceDone(c)) {
      const title = titleOf(c, 'Compliance item');
      push({
        signalKind: 'evidence-missing',
        severity: 'info',
        entityKind: 'compliance',
        entityId: String(c.id),
        entityTitle: title,
        projectId: c.projectId ?? null,
        message: `Evidence is missing for "${title}".`,
        thresholdUsed: 'evidence required, not yet live',
      });
    }
  }

  // 2 — compliance check overdue
  const compGrace = t.complianceOverdueGraceDays * DAY_MS;
  for (const c of compliance) {
    const due = parseDate(c?.dueDate);
    if (due && !isComplianceDone(c) && nowMs - due.getTime() > compGrace) {
      const title = titleOf(c, 'Compliance item');
      push({
        signalKind: 'compliance-overdue',
        severity: 'warning',
        entityKind: 'compliance',
        entityId: String(c.id),
        entityTitle: title,
        projectId: c.projectId ?? null,
        message: `Compliance check "${title}" is overdue.`,
        thresholdUsed: compGrace === 0 ? 'immediate' : `${t.complianceOverdueGraceDays}d grace`,
      });
    }
  }

  // 3 — CAPA / action overdue
  const capaGrace = t.capaOverdueGraceDays * DAY_MS;
  for (const task of tasks) {
    if (!task?.capaType || task?.status === 'Completed') continue;
    const due = parseDate(task?.dueDate);
    if (due && nowMs - due.getTime() > capaGrace) {
      const title = titleOf(task, 'Action');
      push({
        signalKind: 'capa-overdue',
        severity: 'warning',
        entityKind: 'task',
        entityId: String(task.id),
        entityTitle: title,
        projectId: task.projectId ?? null,
        message: `CAPA action "${title}" is overdue.`,
        thresholdUsed: capaGrace === 0 ? 'immediate' : `${t.capaOverdueGraceDays}d grace`,
      });
    }
  }

  // 4 — incident not closed (stale beyond N days)
  const staleMs = t.incidentStaleDays * DAY_MS;
  for (const i of incidents) {
    if (i?.status === 'Closed') continue;
    const ref = parseDate(i?.occurredAt) || parseDate(i?.updatedAt) || parseDate(i?.createdAt);
    if (ref && nowMs - ref.getTime() >= staleMs) {
      const title = titleOf(i, 'Incident');
      push({
        signalKind: 'incident-stale',
        severity: 'warning',
        entityKind: 'incident',
        entityId: String(i.id),
        entityTitle: title,
        projectId: i.projectId ?? null,
        message: `Incident "${title}" has been open for ${t.incidentStaleDays}+ days.`,
        thresholdUsed: `${t.incidentStaleDays}d stale`,
      });
    }
  }

  // 5 — repeated incidents (same type recurring within the window)
  const windowMs = t.recurrenceWindowDays * DAY_MS;
  const byType = new Map<string, number>();
  for (const i of incidents) {
    const occ = parseDate(i?.occurredAt) || parseDate(i?.createdAt);
    if (occ && nowMs - occ.getTime() <= windowMs) {
      const key = String(i?.type || 'Other');
      byType.set(key, (byType.get(key) ?? 0) + 1);
    }
  }
  for (const [type, count] of byType) {
    if (count >= t.recurrenceMinCount) {
      push({
        signalKind: 'incident-recurring',
        severity: 'warning',
        entityKind: 'incident',
        entityId: `type:${type}`,
        entityTitle: `${count}× ${type}`,
        projectId: null,
        message: `"${type}" incidents are recurring (${count} in ${t.recurrenceWindowDays} days).`,
        thresholdUsed: `${t.recurrenceMinCount}× / ${t.recurrenceWindowDays}d`,
      });
    }
  }

  // 6 — risk past its due date (still open)
  const riskGrace = t.riskOverdueGraceDays * DAY_MS;
  for (const r of risks) {
    const due = parseDate(r?.dueDate);
    if (due && r?.status !== 'Closed' && r?.status !== 'Mitigated' && nowMs - due.getTime() > riskGrace) {
      const title = titleOf(r, 'Risk');
      push({
        signalKind: 'risk-overdue',
        severity: 'warning',
        entityKind: 'risk',
        entityId: String(r.id),
        entityTitle: title,
        projectId: r.projectId ?? null,
        message: `Risk "${title}" is past its review/response date.`,
        thresholdUsed: riskGrace === 0 ? 'immediate' : `${t.riskOverdueGraceDays}d grace`,
      });
    }
  }

  return out;
}
