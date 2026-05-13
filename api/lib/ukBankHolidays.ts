// UK England + Wales bank holiday calendar.
//
// Hardcoded list 2026-2030 (Q35 locked). Manual annual refresh.
// Source: https://www.gov.uk/bank-holidays — England + Wales schedule.
//
// Used by:
//   • api/routes/governanceMeetings.ts — bulk-create wizard auto-shifts
//     occurrences that land on a bank holiday to the next working day.
//
// To refresh annually: append the next year's dates from gov.uk +
// adjust the latest-year boundary in `nextWorkingDay`.

const BANK_HOLIDAYS_ISO: string[] = [
  // 2026
  '2026-01-01', // New Year's Day
  '2026-04-03', // Good Friday
  '2026-04-06', // Easter Monday
  '2026-05-04', // Early May bank holiday
  '2026-05-25', // Spring bank holiday
  '2026-08-31', // Summer bank holiday
  '2026-12-25', // Christmas Day
  '2026-12-28', // Boxing Day (substitute — 26th was Saturday)

  // 2027
  '2027-01-01',
  '2027-03-26', // Good Friday
  '2027-03-29', // Easter Monday
  '2027-05-03',
  '2027-05-31',
  '2027-08-30',
  '2027-12-27', // Christmas Day substitute (25th was Saturday)
  '2027-12-28', // Boxing Day substitute

  // 2028
  '2028-01-03', // New Year's Day substitute (1st was Saturday)
  '2028-04-14', // Good Friday
  '2028-04-17', // Easter Monday
  '2028-05-01',
  '2028-05-29',
  '2028-08-28',
  '2028-12-25',
  '2028-12-26',

  // 2029
  '2029-01-01',
  '2029-03-30', // Good Friday
  '2029-04-02', // Easter Monday
  '2029-05-07',
  '2029-05-28',
  '2029-08-27',
  '2029-12-25',
  '2029-12-26',

  // 2030
  '2030-01-01',
  '2030-04-19', // Good Friday
  '2030-04-22', // Easter Monday
  '2030-05-06',
  '2030-05-27',
  '2030-08-26',
  '2030-12-25',
  '2030-12-26',
];

const BANK_HOLIDAY_SET = new Set(BANK_HOLIDAYS_ISO);

/** Returns true if the given ISO date string is a bank holiday.*/
export function isBankHoliday(iso: string): boolean {
  return BANK_HOLIDAY_SET.has(iso.slice(0, 10));
}

/** Returns true if the given ISO date string is a Saturday or Sunday.*/
export function isWeekend(iso: string): boolean {
  const day = new Date(iso).getUTCDay();
  return day === 0 || day === 6;
}

/** Returns true if the given ISO date string is a working day in
 *  England + Wales (not weekend, not bank holiday).*/
export function isWorkingDay(iso: string): boolean {
  return !isWeekend(iso) && !isBankHoliday(iso);
}

/**
 * Returns the next working day (inclusive). If the input is already
 * a working day, returns it unchanged. Otherwise rolls forward 1 day
 * at a time. Caps at 365 days lookahead to avoid infinite loops on
 * unhandled cases.
 */
export function nextWorkingDay(iso: string): string {
  let cursor = iso.slice(0, 10);
  for (let i = 0; i < 365; i++) {
    if (isWorkingDay(cursor)) return cursor;
    const d = new Date(`${cursor}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + 1);
    cursor = d.toISOString().slice(0, 10);
  }
  return cursor;
}

/**
 * Used by the bulk-create wizard preview. Returns `{ shifted, original }`
 * where `shifted` is the next working day if `original` was non-working,
 * or `null` if no shift was needed.
 */
export function shiftIfNonWorking(
  iso: string,
): { original: string; shifted: string } | null {
  const orig = iso.slice(0, 10);
  if (isWorkingDay(orig)) return null;
  return { original: orig, shifted: nextWorkingDay(orig) };
}
