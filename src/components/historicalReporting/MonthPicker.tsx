// HRC primitive — month picker chip.
//
// Production-only surface. Always renders the chip; dropdown shows
// "Live data" + every month with a snapshot. When no snapshots exist
// yet (early in deployment, before the first month-end cron run), the
// dropdown only contains "Live data" — no admin shortcuts, no helper
// copy, no static labels.
//
// Snapshots are populated by the monthly cron (`hrcRunMonthlySnapshot`,
// scheduled in vercel.json at `5 0 1 * *`). Manual triggers exist for
// admin diagnostics but are not exposed in the user-facing UI.

import { CalendarClock, ChevronDown, Loader2 } from "lucide-react";
import { useMemo } from "react";
import type { YearMonth } from "../../types/historicalReporting";

interface MonthPickerProps {
  monthEnd: YearMonth | null;
  availableMonths: YearMonth[];
  onChange: (m: YearMonth | null) => void;
  loading?: boolean;
  /** Optional className applied to the wrapper. */
  className?: string;
}

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

function formatYearMonth(ym: YearMonth): string {
  const [yStr, mStr] = ym.split("-");
  const m = Number(mStr);
  if (!yStr || m < 1 || m > 12) return ym;
  return `${MONTH_LABELS[m - 1]} ${yStr}`;
}

export function MonthPicker({
  monthEnd,
  availableMonths,
  onChange,
  loading,
  className,
}: MonthPickerProps) {
  const sortedMonths = useMemo(
    () =>
      [...availableMonths].sort((a, b) => (a < b ? 1 : a > b ? -1 : 0)),
    [availableMonths],
  );
  const isHistorical = !!monthEnd;

  return (
    <div
      className={
        "relative inline-flex items-stretch overflow-hidden rounded-lg border shadow-sm transition-colors " +
        (isHistorical
          ? "border-amber-300 bg-amber-50"
          : "border-slate-200 bg-white") +
        " " +
        (className ?? "")
      }
    >
      <span
        className={
          "inline-flex items-center gap-1.5 border-r px-3 text-[11px] font-bold uppercase tracking-widest " +
          (isHistorical
            ? "border-amber-300 text-amber-700"
            : "border-slate-200 text-slate-500")
        }
      >
        <CalendarClock className="h-3.5 w-3.5" aria-hidden />
        Period
      </span>
      <div className="relative">
        <select
          aria-label="View historical month"
          value={monthEnd ?? ""}
          onChange={(e) => onChange(e.target.value || null)}
          disabled={loading}
          className={
            "appearance-none bg-transparent pl-3 pr-8 py-2 text-xs font-semibold transition-colors " +
            (isHistorical
              ? "text-amber-900 hover:bg-amber-100"
              : "text-slate-700 hover:bg-slate-50") +
            " disabled:cursor-not-allowed disabled:opacity-50"
          }
        >
          <option value="">Live data</option>
          {sortedMonths.map((ym) => (
            <option key={ym} value={ym}>
              {formatYearMonth(ym)}
            </option>
          ))}
        </select>
        <span
          className={
            "pointer-events-none absolute inset-y-0 right-2 flex items-center " +
            (isHistorical ? "text-amber-700" : "text-slate-400")
          }
        >
          {loading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5" />
          )}
        </span>
      </div>
    </div>
  );
}
