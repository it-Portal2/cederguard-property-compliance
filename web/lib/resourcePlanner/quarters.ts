/**
 * Resource Planner — fiscal-quarter maths (pure).
 *
 * Fiscal year starts in April (client answer 5-A). Quarter index 0 = FY2016-17 Q1,
 * matching the workbook axis. Q1 = Apr–Jun, Q2 = Jul–Sep, Q3 = Oct–Dec, Q4 = Jan–Mar.
 * Mirrors the sheet's EG/EJ quarter-index formulas.
 */

import { FY_BASE_YEAR, FY_START_MONTH } from "./constants";
import type { HorizonConfig, QuarterAxisEntry } from "./types";

/** "2026" → "2026-27". */
export function fyLabel(fy: number): string {
  return `${fy}-${String((fy + 1) % 100).padStart(2, "0")}`;
}

function fyParts(d: Date): { fyStart: number; quarterOfFy: 1 | 2 | 3 | 4 } {
  const month = d.getMonth() + 1; // 1..12
  const year = d.getFullYear();
  const fyStart = month >= FY_START_MONTH ? year : year - 1;
  const quarterOfFy = (
    month >= FY_START_MONTH ? Math.floor((month - FY_START_MONTH) / 3) + 1 : 4
  ) as 1 | 2 | 3 | 4;
  return { fyStart, quarterOfFy };
}

/**
 * Absolute quarter index from the FY base (index 0 = FY2016-17 Q1).
 * Returns null for missing/invalid dates (caller treats null ⇒ no boundary ⇒ 0 FTE).
 */
export function dateToFyQuarterIndex(
  date: string | Date | null | undefined,
): number | null {
  if (!date) return null;
  let d: Date;
  if (typeof date === "string") {
    // Parse date-only "YYYY-MM-DD" as LOCAL time (not UTC) so a date on the 1st
    // of a quarter month isn't shifted into the previous quarter in -UTC zones.
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date.trim());
    d = m
      ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
      : new Date(date);
  } else {
    d = date;
  }
  if (Number.isNaN(d.getTime())) return null;
  const { fyStart, quarterOfFy } = fyParts(d);
  return (fyStart - FY_BASE_YEAR) * 4 + (quarterOfFy - 1);
}

/**
 * Parse a "2026 Q3" style quarter string to an absolute index (import fallback
 * for legacy rows that carry a quarter label rather than a date).
 */
export function quarterStringToFyQuarterIndex(
  s: string | null | undefined,
): number | null {
  if (!s) return null;
  const m = /(\d{4})\s*Q\s*([1-4])/i.exec(s);
  if (!m) return null;
  const fy = parseInt(m[1], 10);
  const q = parseInt(m[2], 10);
  return (fy - FY_BASE_YEAR) * 4 + (q - 1);
}

/** Fiscal-year start year for an absolute quarter index. */
export function fyOfIndex(index: number): number {
  return FY_BASE_YEAR + Math.floor(index / 4);
}

/** Display label for an absolute quarter index, e.g. "2026-27 Q1". */
export function quarterIndexToLabel(index: number): string {
  const fy = fyOfIndex(index);
  const q = (((index % 4) + 4) % 4) + 1;
  return `${fyLabel(fy)} Q${q}`;
}

export const financialYearOf = fyOfIndex;

/** Month-range labels for the four fiscal quarters (FY starts April). */
const QUARTER_MONTHS: Record<1 | 2 | 3 | 4, string> = {
  1: "Apr–Jun",
  2: "Jul–Sep",
  3: "Oct–Dec",
  4: "Jan–Mar",
};

/**
 * Human calendar label for a fiscal quarter, e.g. `quarterCalendarLabel(2026, 1)`
 * → "Apr–Jun 2026". Q4 (Jan–Mar) falls in the NEXT calendar year, so it shows
 * `fy + 1` (e.g. `(2026, 4)` → "Jan–Mar 2027"). Used to make the terse "Q1–Q4"
 * column headers on the Timeline / Demand Forecast legible.
 */
export function quarterCalendarLabel(
  fy: number,
  quarterOfFy: 1 | 2 | 3 | 4,
): string {
  const calYear = quarterOfFy === 4 ? fy + 1 : fy;
  return `${QUARTER_MONTHS[quarterOfFy]} ${calYear}`;
}

/**
 * Absolute fiscal-quarter index for "now" (current date). Used to draw the
 * "today" marker on the Timeline / Demand Forecast. Pure apart from reading the
 * clock; callers pass an explicit `now` in tests for determinism.
 */
export function currentFyQuarterIndex(now: Date = new Date()): number {
  const { fyStart, quarterOfFy } = fyParts(now);
  return (fyStart - FY_BASE_YEAR) * 4 + (quarterOfFy - 1);
}

/** Inclusive FY range → ordered quarter axis. */
export function buildQuarterAxis(
  startFy: number,
  endFy: number,
): QuarterAxisEntry[] {
  const out: QuarterAxisEntry[] = [];
  for (let fy = startFy; fy <= endFy; fy++) {
    for (let q = 1; q <= 4; q++) {
      out.push({
        index: (fy - FY_BASE_YEAR) * 4 + (q - 1),
        label: `${fyLabel(fy)} Q${q}`,
        fy,
        fyLabel: fyLabel(fy),
        quarterOfFy: q as 1 | 2 | 3 | 4,
      });
    }
  }
  return out;
}

/**
 * Derive a sensible horizon (inclusive FY range) from a set of absolute quarter
 * indices — used to default the axis to data min-start → max-EOD (answer 9-C).
 * Falls back to a single FY around the base year when no valid indices exist.
 */
export function horizonFromIndices(
  indices: Array<number | null | undefined>,
): HorizonConfig {
  const valid = indices.filter(
    (i): i is number => typeof i === "number" && Number.isFinite(i),
  );
  if (!valid.length) return { startFy: FY_BASE_YEAR, endFy: FY_BASE_YEAR };
  const min = Math.min(...valid);
  const max = Math.max(...valid);
  return { startFy: fyOfIndex(min), endFy: fyOfIndex(max) };
}
