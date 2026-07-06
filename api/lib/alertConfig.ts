// Per-workspace thresholds for the automatic detection engine.
//
// Defaults encode the client-locked rules (Q2.4): overdue = immediate,
// stale incident = 7 days, recurrence = same type >= 2x within 90 days.
// A workspace may override any value via the `alertConfig/{clientId}` doc;
// an absent doc (or field) falls back to the default, so no config == the
// locked defaults. Pure defaults + a thin Firestore loader — no web imports.

import type { ApiContext } from './context.js';

export interface AlertThresholds {
  /** Days an incident may stay unclosed before it is flagged stale. */
  incidentStaleDays: number;
  /** Grace days after a compliance item's due date before it counts overdue. */
  complianceOverdueGraceDays: number;
  /** Grace days after a risk's due date before it counts overdue. */
  riskOverdueGraceDays: number;
  /** Grace days after a CAPA action's due date before it counts overdue. */
  capaOverdueGraceDays: number;
  /** Recurrence window (days) for "same incident type appears repeatedly". */
  recurrenceWindowDays: number;
  /** Minimum occurrences within the window to flag a recurring type. */
  recurrenceMinCount: number;
}

export const DEFAULT_ALERT_THRESHOLDS: AlertThresholds = {
  incidentStaleDays: 7,
  complianceOverdueGraceDays: 0,
  riskOverdueGraceDays: 0,
  capaOverdueGraceDays: 0,
  recurrenceWindowDays: 90,
  recurrenceMinCount: 2,
};

const numOr = (v: any, fallback: number): number =>
  typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : fallback;

/** Merge a raw config doc over the defaults (defensive against junk fields). */
export function resolveThresholds(raw: any): AlertThresholds {
  const d = DEFAULT_ALERT_THRESHOLDS;
  if (!raw || typeof raw !== 'object') return { ...d };
  return {
    incidentStaleDays: numOr(raw.incidentStaleDays, d.incidentStaleDays),
    complianceOverdueGraceDays: numOr(
      raw.complianceOverdueGraceDays,
      d.complianceOverdueGraceDays,
    ),
    riskOverdueGraceDays: numOr(raw.riskOverdueGraceDays, d.riskOverdueGraceDays),
    capaOverdueGraceDays: numOr(raw.capaOverdueGraceDays, d.capaOverdueGraceDays),
    recurrenceWindowDays: numOr(raw.recurrenceWindowDays, d.recurrenceWindowDays),
    recurrenceMinCount: Math.max(2, numOr(raw.recurrenceMinCount, d.recurrenceMinCount)),
  };
}

/** Load a workspace's thresholds; missing doc ⇒ defaults. */
export async function loadAlertThresholds(
  ctx: ApiContext,
  clientId: string,
): Promise<AlertThresholds> {
  try {
    const snap = await ctx.db.collection('alertConfig').doc(clientId).get();
    return resolveThresholds(snap.exists ? snap.data() : null);
  } catch {
    return { ...DEFAULT_ALERT_THRESHOLDS };
  }
}
