// HRC client hook — page-level toggle between live data and a frozen
// month-end snapshot.
//
// Usage:
//   const view = useHistoricalView({ collection: 'risks' });
//   // view.isHistorical === false → render live data, edit allowed
//   // view.isHistorical === true  → render view.entries, banner + read-only
//   // view.setMonthEnd('2026-04') → switch to April snapshot
//   // view.setMonthEnd(null)      → back to live data
//
// The actual rendering page still owns its own data fetching for the
// LIVE state. This hook is layered on top: when monthEnd is set, the
// hook fetches the snapshot from the server and the page swaps its
// data source. That way every existing page keeps its current shape
// for the live path with zero added cost when the user never opens
// the picker.

import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";
import type {
  HrcCollection,
  YearMonth,
} from "../types/historicalReporting";

export interface UseHistoricalViewArgs {
  collection: HrcCollection;
  /**
   * Optional initial month (e.g. when the URL contains ?month=2026-04).
   * Defaults to null = live mode.
   */
  initialMonth?: YearMonth | null;
}

export interface UseHistoricalViewResult<TEntry = any> {
  /** Snapshot entries when historical, empty when live. */
  entries: TEntry[];
  /** True when monthEnd is set AND the snapshot fetch resolved. */
  isHistorical: boolean;
  /** Currently selected snapshot month, or null in live mode. */
  monthEnd: YearMonth | null;
  /** All months that have a snapshot for the current workspace. */
  availableMonths: YearMonth[];
  /** True while the snapshot is loading. */
  loading: boolean;
  /** Error message from the snapshot fetch, or null. */
  error: string | null;
  /** Snapshot meta (parent doc) when historical. */
  meta: any | null;
  /**
   * The first YearMonth ever snapshotted for this workspace, or null
   * before the cron has ever run. Drives the "feature launched in {N}"
   * empty-state message when the user picks a month before HRC was
   * activated. Q6=A locks "start fresh".
   */
  activatedYearMonth: YearMonth | null;
  /** Why the current snapshot read returned empty, when applicable. */
  emptyReason:
    | "BEFORE_ACTIVATION"
    | "SNAPSHOT_MISSING"
    | "EMPTY_DATA"
    | null;
  /** Toggle to a past month, or back to live (null). */
  setMonthEnd: (m: YearMonth | null) => void;
  /** Re-trigger fetch (e.g. after a super_admin correction). */
  refresh: () => void;
}

export function useHistoricalView<TEntry = any>(
  args: UseHistoricalViewArgs,
): UseHistoricalViewResult<TEntry> {
  const { collection, initialMonth = null } = args;
  const [monthEnd, setMonthEnd] = useState<YearMonth | null>(initialMonth);
  const [entries, setEntries] = useState<TEntry[]>([]);
  const [meta, setMeta] = useState<any | null>(null);
  const [availableMonths, setAvailableMonths] = useState<YearMonth[]>([]);
  const [activatedYearMonth, setActivatedYearMonth] =
    useState<YearMonth | null>(null);
  const [snapshotMissing, setSnapshotMissing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);

  // Load the available-months list once per mount (cheap; ~one query).
  // The endpoint also returns the deployment marker so the empty-state
  // can distinguish "before HRC launched" from "snapshot missing".
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res: any = await api.hrcListAvailableMonths();
        if (!cancelled && res?.success) {
          setAvailableMonths((res.months ?? []) as YearMonth[]);
          setActivatedYearMonth(
            (res.activatedYearMonth as YearMonth | null) ?? null,
          );
        }
      } catch (err) {
        // Non-fatal — picker just won't have a dropdown population.
        console.error("[useHistoricalView] listAvailableMonths failed", err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Fetch snapshot whenever monthEnd or collection changes.
  useEffect(() => {
    if (!monthEnd) {
      setEntries([]);
      setMeta(null);
      setError(null);
      setSnapshotMissing(false);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    setSnapshotMissing(false);
    (async () => {
      try {
        const res: any = await api.hrcReadSnapshot(monthEnd, collection);
        if (cancelled) return;
        if (!res?.success) {
          setError(res?.error ?? "Failed to load snapshot");
          setEntries([]);
          setMeta(null);
        } else {
          setEntries((res.entries ?? []) as TEntry[]);
          setMeta(res.meta ?? null);
          setSnapshotMissing(!!res.empty && res.reason === "NO_SNAPSHOT_FOR_MONTH");
        }
      } catch (err: any) {
        if (cancelled) return;
        setError(err?.message ?? "Failed to load snapshot");
        setEntries([]);
        setMeta(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [monthEnd, collection, refreshTick]);

  const refresh = useCallback(() => setRefreshTick((n) => n + 1), []);

  const isHistorical = useMemo(() => monthEnd !== null, [monthEnd]);

  // Empty-state classifier: drives the right user message in the UI.
  const emptyReason = useMemo<UseHistoricalViewResult["emptyReason"]>(() => {
    if (!isHistorical || loading) return null;
    if (
      monthEnd &&
      activatedYearMonth &&
      monthEnd < activatedYearMonth
    ) {
      return "BEFORE_ACTIVATION";
    }
    if (snapshotMissing) return "SNAPSHOT_MISSING";
    if (entries.length === 0) return "EMPTY_DATA";
    return null;
  }, [
    isHistorical,
    loading,
    monthEnd,
    activatedYearMonth,
    snapshotMissing,
    entries.length,
  ]);

  return {
    entries,
    isHistorical,
    monthEnd,
    availableMonths,
    loading,
    error,
    meta,
    activatedYearMonth,
    emptyReason,
    setMonthEnd,
    refresh,
  };
}
