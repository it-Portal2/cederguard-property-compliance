import type { Incident } from "../../features/incidents/types";
import type { Control } from "../../features/controls/types";

export const RECURRENCE_WINDOW_DAYS = 90;
export const RECURRENCE_MIN_COUNT = 2;

export interface RecurringIncidentCluster {
  type: string;
  count: number;
  latest: string | null;
  items: Incident[];
}

/**
 * Repeat-incident detection: the SAME incident type occurring at least
 * `minCount` times within the trailing `windowDays`. Pure + deterministic
 * (pass `now` for tests). Mirrors the locked decision "same type AND within
 * a configurable time window".
 */
export function detectRecurringIncidents(
  incidents: Incident[],
  windowDays: number = RECURRENCE_WINDOW_DAYS,
  minCount: number = RECURRENCE_MIN_COUNT,
  now: Date = new Date(),
): RecurringIncidentCluster[] {
  const cutoff = now.getTime() - windowDays * 24 * 60 * 60 * 1000;
  const byType = new Map<string, Incident[]>();
  for (const inc of incidents) {
    const t = inc.occurredAt ? new Date(inc.occurredAt).getTime() : NaN;
    // Undated incidents still count toward recurrence (can't prove they're old).
    if (!Number.isNaN(t) && t < cutoff) continue;
    const key = inc.type || "Other";
    (byType.get(key) ?? byType.set(key, []).get(key)!).push(inc);
  }
  const clusters: RecurringIncidentCluster[] = [];
  for (const [type, items] of byType) {
    if (items.length < minCount) continue;
    const latest = items
      .map((i) => i.occurredAt || "")
      .filter(Boolean)
      .sort()
      .pop() || null;
    clusters.push({ type, count: items.length, latest, items });
  }
  return clusters.sort((a, b) => b.count - a.count);
}

/** Controls that are not operating effectively — a learning signal. */
export function failedControls(controls: Control[]): Control[] {
  return controls.filter(
    (c) => c.status === "Failed" || c.status === "Partially Effective",
  );
}
