// Phase 12 — Chase engine (pure logic).
//
// Given the workspace's in-flight items + the current moment, return
// the list of `ChaseEvent` records that should be PERSISTED + DISPATCHED
// by the cron handler.  This file has no Firestore / FCM / SMTP side
// effects — it's a pure transform so the handler can unit-test the
// trigger rules in isolation.
//
// Locked decisions (PRD + Round 4 + Round 5):
//   • Q7 — Auto-chase + escalation (PRD rules §41 + §42)
//   • Q8 — Business hours queue; at-deadline + escalation are urgent
//   • Cadence: 72h before deadline → 24h before → at deadline → +24h escalation
//   • Idempotency: a chase event of the same kind on the same item is
//                  suppressed if one already fired in the last 12h
//                  (filter applied by the handler, not here).

import { isInsideBusinessHours, nextBusinessHour } from './businessHours.js';

export type ChaseKind =
  | 'report.deadline-72h'
  | 'report.deadline-24h'
  | 'report.deadline-now'
  | 'report.deadline-escalate'
  | 'fp.publication-window-missed'
  | 'meeting.agenda-missing-48h';

export const URGENT_KINDS: ChaseKind[] = [
  'report.deadline-now',
  'report.deadline-escalate',
  'fp.publication-window-missed',
];

export interface ChaseEvent {
  kind: ChaseKind;
  /** Stable item identifier — composite of kind + entityId (lesson #103). */
  dedupeKey: string;
  /** Recipient resolved by the handler (owner / PgM / both). */
  recipient: 'owner' | 'pgm' | 'owner+pgm';
  itemKind: 'report' | 'fpItem' | 'meeting';
  itemId: string;
  itemTitle: string;
  /** ISO timestamp when this chase becomes due (after queue). */
  scheduledFor: string;
  /** Display-ready chase copy (1 sentence). */
  message: string;
  /** Severity → maps to FCM priority + UI banner colour. */
  severity: 'info' | 'warning' | 'urgent';
}

interface ChaseInputs {
  now: Date;
  reports: Array<{
    id: string;
    title: string;
    status: string;
    ownerUid: string | null;
    targetBoardDate: string | null;
    softDeleted?: boolean;
  }>;
  fpItems: Array<{
    id: string;
    title: string;
    status: string;
    targetDecisionDate: string | null;
    isKeyDecision: boolean;
    softDeleted?: boolean;
  }>;
  meetings: Array<{
    id: string;
    title: string | null;
    status: string;
    date: string | null;
    timeStart: string | null;
    agenda: string[] | null;
    softDeleted?: boolean;
  }>;
}

const HOURS = (n: number) => n * 60 * 60 * 1000;

function diffHoursToDeadline(deadlineIso: string | null, now: Date): number | null {
  if (!deadlineIso) return null;
  // Treat the deadline as end-of-day local — a report due "today" isn't
  // overdue at 09:00.  Using 17:00 UK ≈ end-of-business-day.
  const t = new Date(`${deadlineIso}T17:00:00Z`).getTime();
  if (Number.isNaN(t)) return null;
  return (t - now.getTime()) / HOURS(1);
}

function scheduleFor(now: Date, severity: ChaseEvent['severity']): string {
  if (severity === 'urgent') return now.toISOString();
  if (isInsideBusinessHours(now)) return now.toISOString();
  return nextBusinessHour(now);
}

const REPORT_OPEN_STATUSES = new Set([
  'Draft',
  'PendingSeniorPmReview',
  'InReview',
  'AmendmentsRequested',
]);

const FP_OPEN_STATUSES = new Set(['Draft', 'Published', 'Proposed']);

export function computeChaseEvents(input: ChaseInputs): ChaseEvent[] {
  const events: ChaseEvent[] = [];
  const { now } = input;

  // ── Reports — deadline cascade ─────────────────────────────────────
  for (const r of input.reports) {
    if (r.softDeleted) continue;
    if (!REPORT_OPEN_STATUSES.has(r.status)) continue;
    const hours = diffHoursToDeadline(r.targetBoardDate, now);
    if (hours === null) continue;

    if (hours <= -24) {
      // 24h+ past deadline → escalate to PgM.
      const severity: ChaseEvent['severity'] = 'urgent';
      events.push({
        kind: 'report.deadline-escalate',
        dedupeKey: `report.deadline-escalate:${r.id}`,
        recipient: 'pgm',
        itemKind: 'report',
        itemId: r.id,
        itemTitle: r.title,
        scheduledFor: scheduleFor(now, severity),
        message: `Escalation: PM has not submitted "${r.title}" — 24h+ past deadline.`,
        severity,
      });
    } else if (hours <= 0) {
      // Inside the deadline (at or past) → notify owner + cc PgM.
      const severity: ChaseEvent['severity'] = 'urgent';
      events.push({
        kind: 'report.deadline-now',
        dedupeKey: `report.deadline-now:${r.id}`,
        recipient: 'owner+pgm',
        itemKind: 'report',
        itemId: r.id,
        itemTitle: r.title,
        scheduledFor: scheduleFor(now, severity),
        message: `Deadline today: "${r.title}". Submit or request an extension.`,
        severity,
      });
    } else if (hours <= 24) {
      const severity: ChaseEvent['severity'] = 'warning';
      events.push({
        kind: 'report.deadline-24h',
        dedupeKey: `report.deadline-24h:${r.id}`,
        recipient: 'owner',
        itemKind: 'report',
        itemId: r.id,
        itemTitle: r.title,
        scheduledFor: scheduleFor(now, severity),
        message: `URGENT: 24 hours to deadline on "${r.title}".`,
        severity,
      });
    } else if (hours <= 72) {
      const severity: ChaseEvent['severity'] = 'info';
      events.push({
        kind: 'report.deadline-72h',
        dedupeKey: `report.deadline-72h:${r.id}`,
        recipient: 'owner',
        itemKind: 'report',
        itemId: r.id,
        itemTitle: r.title,
        scheduledFor: scheduleFor(now, severity),
        message: `"${r.title}" is due in ~72 hours. Aim to submit early.`,
        severity,
      });
    }
  }

  // ── Forward Plan — 28-day publication window for Key Decisions ─────
  // Statutory rule (Local Authorities (Executive Arrangements)
  // Regulations 2012): published ≥ 28 days before the decision date.
  for (const f of input.fpItems) {
    if (f.softDeleted) continue;
    if (!FP_OPEN_STATUSES.has(f.status)) continue;
    if (!f.isKeyDecision) continue;
    const hours = diffHoursToDeadline(f.targetDecisionDate, now);
    if (hours === null) continue;
    // Window check: if status is still 'Draft' or 'Proposed' AND
    // we're inside 28 days, the publication window is at risk.
    const daysLeft = hours / 24;
    if (daysLeft <= 28 && (f.status === 'Draft' || f.status === 'Proposed')) {
      const severity: ChaseEvent['severity'] = 'urgent';
      events.push({
        kind: 'fp.publication-window-missed',
        dedupeKey: `fp.publication-window-missed:${f.id}`,
        recipient: 'pgm',
        itemKind: 'fpItem',
        itemId: f.id,
        itemTitle: f.title,
        scheduledFor: scheduleFor(now, severity),
        message: `Statutory 28-day window at risk for key decision "${f.title}".`,
        severity,
      });
    }
  }

  // ── Meetings — agenda missing 48h before scheduled date ────────────
  for (const m of input.meetings) {
    if (m.softDeleted) continue;
    if (m.status !== 'Scheduled') continue;
    if (!m.date) continue;
    const hasAgenda = Array.isArray(m.agenda) && m.agenda.filter(Boolean).length > 0;
    if (hasAgenda) continue;
    const hours = diffHoursToDeadline(m.date, now);
    if (hours === null) continue;
    if (hours > 0 && hours <= 48) {
      const severity: ChaseEvent['severity'] = 'warning';
      events.push({
        kind: 'meeting.agenda-missing-48h',
        dedupeKey: `meeting.agenda-missing-48h:${m.id}`,
        recipient: 'owner',
        itemKind: 'meeting',
        itemId: m.id,
        itemTitle: m.title ?? 'Meeting',
        scheduledFor: scheduleFor(now, severity),
        message: `Agenda missing for "${m.title ?? 'meeting'}" in ~48h. Add the agenda before attendees prepare.`,
        severity,
      });
    }
  }

  return events;
}
