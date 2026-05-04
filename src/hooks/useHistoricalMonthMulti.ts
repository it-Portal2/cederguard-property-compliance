8// HRC HR-9 — multi-collection historical-view helper.
//
// Some pages display data from MORE THAN ONE snapshot collection
// (e.g. ProjectReport renders both `risks` and `complianceItems`).
// Without this hook each page would render two MonthPickers, one per
// `useHistoricalView` call — confusing UX.
//
// This helper composes existing `useHistoricalView` instances and
// presents:
//   • single shared monthEnd / setMonthEnd / availableMonths
//   • aggregated `loading` flag (true if ANY underlying fetch is loading)
//   • per-collection entries map keyed by collection name
//   • single `meta` from the first non-null underlying view (they all
//     refer to the same parent doc, so any one's meta is correct)
//
// The picker then shows once per page; switching months triggers fans
// out to N parallel snapshot reads via the underlying hooks.

import { useEffect, useMemo, useState } from "react";
import { useHistoricalView } from "./useHistoricalView";
import type {
  HrcCollection,
  YearMonth,
} from "../types/historicalReporting";

export interface UseHistoricalMonthMultiArgs {
  collections: HrcCollection[];
  initialMonth?: YearMonth | null;
}

export interface UseHistoricalMonthMultiResult {
  /** Shared month state across all collections. */
  monthEnd: YearMonth | null;
  setMonthEnd: (m: YearMonth | null) => void;
  /** Union of available months across all collections (in practice
   *  identical — same workspace, same parent docs). */
  availableMonths: YearMonth[];
  /** True when historical mode is engaged (monthEnd !== null). */
  isHistorical: boolean;
  /** True if ANY underlying snapshot fetch is in flight. Drives
   *  page-level skeleton swap. */
  loading: boolean;
  /** Per-collection entries map: { risks: [...], complianceItems: [...] } */
  entriesByCollection: Record<string, any[]>;
  /** Snapshot meta from the first underlying view (parent doc; same
   *  for every collection in the same month). */
  meta: any | null;
  /** Empty-reason from the first underlying view (BEFORE_ACTIVATION /
   *  SNAPSHOT_MISSING / EMPTY_DATA / null). They all share a parent
   *  doc, so the answer is the same. */
  emptyReason:
    | "BEFORE_ACTIVATION"
    | "SNAPSHOT_MISSING"
    | "EMPTY_DATA"
    | null;
  activatedYearMonth: YearMonth | null;
  /** Refresh all underlying views (e.g. after a super_admin correction). */
  refresh: () => void;
}

/**
 * Helper that turns N collections into ONE picker-state surface.
 * The hook owns the shared monthEnd; underlying useHistoricalView
 * instances are kept in sync through a useEffect that pushes the
 * shared month down to each one.
 *
 * Hooks rule of thumb: this hook calls useHistoricalView in a fixed
 * order based on the `collections` array — DO NOT pass a different
 * array between renders. Pass a stable reference (useMemo or const).
 */
export function useHistoricalMonthMulti(
  args: UseHistoricalMonthMultiArgs,
): UseHistoricalMonthMultiResult {
  const { collections, initialMonth = null } = args;
  const [sharedMonth, setSharedMonth] = useState<YearMonth | null>(initialMonth);

  // Call useHistoricalView once per collection. The number + order of
  // collections must stay stable across renders for the rules-of-hooks.
  // Page-level callers always know their collection list at compile time.
  const views = collections.map((collection) =>
    useHistoricalView<any>({ collection, initialMonth }),
  );

  // Push shared month down to each underlying view. Each view tracks its
  // own copy; we keep them all in lockstep.
  useEffect(() => {
    for (const v of views) {
      if (v.monthEnd !== sharedMonth) v.setMonthEnd(sharedMonth);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sharedMonth]);

  const entriesByCollection = useMemo(() => {
    const out: Record<string, any[]> = {};
    collections.forEach((c, i) => {
      out[c] = views[i]?.entries ?? [];
    });
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collections, ...views.map((v) => v.entries)]);

  const loading = views.some((v) => v.loading);
  const meta = views.find((v) => v.meta)?.meta ?? null;
  const availableMonths = views[0]?.availableMonths ?? [];
  const activatedYearMonth = views[0]?.activatedYearMonth ?? null;
  const emptyReason = views[0]?.emptyReason ?? null;

  return {
    monthEnd: sharedMonth,
    setMonthEnd: setSharedMonth,
    availableMonths,
    isHistorical: sharedMonth !== null,
    loading,
    entriesByCollection,
    meta,
    emptyReason,
    activatedYearMonth,
    refresh: () => views.forEach((v) => v.refresh()),
  };
}
