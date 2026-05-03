// HRC HR-7 — friendly empty-state for historical reads.
//
// Three distinct "no data" states the user can hit when picking a
// past month, each with its own explanation so they don't think the
// app is broken:
//
//   1. BEFORE_ACTIVATION — picked month is earlier than the workspace's
//      first-ever snapshot. Q6=A locks "start fresh" — there is genuinely
//      no data to show. Tell the user when HRC started recording.
//   2. SNAPSHOT_MISSING  — month is on/after activation but the cron
//      didn't run for that month (rare; usually means manual rebuild
//      pending). Surface so super_admin can run `hrcRunMonthlySnapshot`.
//   3. EMPTY_DATA        — snapshot exists but the surface had zero
//      rows at month-end. Genuinely empty in real life.

import { CalendarOff, History, Inbox } from "lucide-react";
import type { YearMonth } from "../../types/historicalReporting";

const MONTH_LABELS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function formatYearMonth(ym: YearMonth | null | undefined): string {
  if (!ym) return "";
  const [yStr, mStr] = ym.split("-");
  const m = Number(mStr);
  if (!yStr || m < 1 || m > 12) return ym;
  return `${MONTH_LABELS[m - 1]} ${yStr}`;
}

interface HistoricalEmptyStateProps {
  reason: "BEFORE_ACTIVATION" | "SNAPSHOT_MISSING" | "EMPTY_DATA";
  monthEnd: YearMonth;
  activatedYearMonth?: YearMonth | null;
  /** Override the default surface label — e.g. "risk register" / "reports". */
  surfaceLabel?: string;
}

export function HistoricalEmptyState({
  reason,
  monthEnd,
  activatedYearMonth,
  surfaceLabel = "this surface",
}: HistoricalEmptyStateProps) {
  const formatted = formatYearMonth(monthEnd);
  const launched = formatYearMonth(activatedYearMonth);

  if (reason === "BEFORE_ACTIVATION") {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center">
        <CalendarOff className="mx-auto h-8 w-8 text-slate-400" />
        <p className="mt-3 text-sm font-bold text-slate-800">
          No snapshot for {formatted}
        </p>
        <p className="mx-auto mt-1.5 max-w-md text-xs text-slate-500">
          Historical reporting started{" "}
          {launched ? (
            <>
              in <span className="font-semibold text-slate-700">{launched}</span>
            </>
          ) : (
            "after this date"
          )}
          . Months before that have no frozen state to show — exit historical
          view to see live data.
        </p>
      </div>
    );
  }

  if (reason === "SNAPSHOT_MISSING") {
    return (
      <div className="rounded-xl border border-dashed border-amber-200 bg-amber-50/60 px-6 py-10 text-center">
        <History className="mx-auto h-8 w-8 text-amber-500" />
        <p className="mt-3 text-sm font-bold text-amber-900">
          No snapshot recorded for {formatted}
        </p>
        <p className="mx-auto mt-1.5 max-w-md text-xs text-amber-700">
          The monthly snapshot didn't run for this period. A super-admin can
          rebuild it manually — until then, this view stays empty.
        </p>
      </div>
    );
  }

  // EMPTY_DATA — snapshot exists, but {surface} had no data at month-end.
  return (
    <div className="rounded-xl border border-dashed border-slate-200 bg-white px-6 py-10 text-center">
      <Inbox className="mx-auto h-8 w-8 text-slate-300" />
      <p className="mt-3 text-sm font-bold text-slate-800">
        Empty at month-end
      </p>
      <p className="mx-auto mt-1.5 max-w-md text-xs text-slate-500">
        The {formatted} snapshot exists, but {surfaceLabel} had no rows at the
        time. This is a genuine zero — not a missing snapshot.
      </p>
    </div>
  );
}
