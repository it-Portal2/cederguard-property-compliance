// Phase 12 — UK business-hours queue helper.
//
// Locked answer Q8 = c (Round 5):
//   • Non-urgent chases queue until next Mon–Fri 08:00–18:00 UK window.
//   • At-deadline + escalation chases bypass the queue (sent immediately).
//
// We deliberately avoid a timezone library — the requirement is "UK
// business hours" and the working calendar (`ukBankHolidays.ts`) is
// already England + Wales.  All math runs in `Europe/London` via the
// browser/Node Intl APIs.

import { isWorkingDay } from './ukBankHolidays.js';

export const UK_BUSINESS_OPEN_HOUR = 8; // 08:00 local
export const UK_BUSINESS_CLOSE_HOUR = 18; // 18:00 local

/**
 * Read the UK-local hour-of-day for a given moment.  Uses
 * `Intl.DateTimeFormat` so we respect BST automatically.
 */
function ukHour(now: Date): number {
  const fmt = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London',
    hour12: false,
    hour: '2-digit',
  });
  return parseInt(fmt.format(now), 10);
}

function ukDateString(now: Date): string {
  const fmt = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  // en-GB returns "DD/MM/YYYY" — flip to ISO yyyy-mm-dd.
  const [d, m, y] = fmt.format(now).split('/');
  return `${y}-${m}-${d}`;
}

/**
 * `now` is inside business hours when:
 *   - it's a UK working day (not weekend, not bank holiday)
 *   - hour ∈ [08, 18)
 */
export function isInsideBusinessHours(now: Date = new Date()): boolean {
  const dayIso = ukDateString(now);
  if (!isWorkingDay(dayIso)) return false;
  const h = ukHour(now);
  return h >= UK_BUSINESS_OPEN_HOUR && h < UK_BUSINESS_CLOSE_HOUR;
}

/**
 * Returns the next moment a non-urgent chase can fire.  If we're
 * already inside business hours, returns `now`.  Otherwise rolls
 * forward to the next working day @ 08:00 UK.
 *
 * NOTE: hour is computed in UTC for the returned ISO; precision to
 * the nearest hour is enough for chase queueing (lesson #74 — soft
 * rule, BST drift acceptable).
 */
export function nextBusinessHour(now: Date = new Date()): string {
  if (isInsideBusinessHours(now)) return now.toISOString();
  // Walk forward day-by-day until we find a working day; then set
  // 08:00 UTC (close-enough for the queue; BST drift acceptable).
  for (let i = 0; i < 10; i++) {
    const probe = new Date(now);
    probe.setUTCDate(probe.getUTCDate() + i);
    probe.setUTCHours(UK_BUSINESS_OPEN_HOUR, 0, 0, 0);
    const dayIso = ukDateString(probe);
    if (!isWorkingDay(dayIso)) continue;
    if (probe.getTime() < now.getTime()) continue;
    return probe.toISOString();
  }
  // Defensive fallback — return tomorrow 08:00 UTC.
  const fallback = new Date(now);
  fallback.setUTCDate(fallback.getUTCDate() + 1);
  fallback.setUTCHours(UK_BUSINESS_OPEN_HOUR, 0, 0, 0);
  return fallback.toISOString();
}
