//  primitive — read-only banner shown above any page when the user
// has selected a past-month snapshot.
//
// Pages mount it conditionally:
//   {view.isHistorical && (
//     <HistoricalBanner
//       monthEnd={view.monthEnd!}
//       meta={view.meta}
//       onExit={ => view.setMonthEnd(null)}
//     />
//   )}
//
// Style: amber-tinted to differentiate from the rose "needs action"
// banners and the indigo "info" banners. Read-only is a neutral state
// that warrants its own colour.

import { useState } from "react";
import { ArrowLeft, Eye, ShieldCheck, History, Pencil } from "lucide-react";
import type { HrcCollection, YearMonth } from "../../types/historicalReporting";
import { useStore } from "../../store/useStore";
import { isSuperAdmin } from "../../lib/roles";
import { CorrectionModal } from "./CorrectionModal";
import { CorrectionHistory } from "./CorrectionHistory";
import { HistoricalEmptyState } from "./HistoricalEmptyState";

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

interface HistoricalBannerProps {
  monthEnd: YearMonth;
  meta?: {
    monthEndIso?: string;
    generatedAt?: string;
    anyCorrected?: boolean;
    isHrbWorkspace?: boolean;
    retentionUntil?: string;
  } | null;
  onExit: () => void;
  /** Pre-fill the collection in the correction modal when launched
   *  from a single-collection page.*/
  defaultCorrectionCollection?: HrcCollection;
  /** Bumped when the parent wants to refresh after a correction.*/
  onCorrected?: () => void;
  /** when set, renders the friendly empty-state panel below the
   *  banner. Pages pass `historicalView.emptyReason` directly.*/
  emptyReason?:
    | "BEFORE_ACTIVATION"
    | "SNAPSHOT_MISSING"
    | "EMPTY_DATA"
    | null;
  /** month at which started snapshotting this workspace.*/
  activatedYearMonth?: YearMonth | null;
  /** surface label used inside the empty-state copy
   *  ("risk register", "reports", etc.).*/
  surfaceLabel?: string;
}

export function HistoricalBanner({
  monthEnd,
  meta,
  onExit,
  defaultCorrectionCollection,
  onCorrected,
  emptyReason,
  activatedYearMonth,
  surfaceLabel,
}: HistoricalBannerProps) {
  const formatted = formatYearMonth(monthEnd);
  const user = useStore((s) => s.user);
  const callerIsSuperAdmin = isSuperAdmin(user?.email, user?.role);

  const [correctionOpen, setCorrectionOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  // Bumps after a correction lands so CorrectionHistory refetches and
  // the banner picks up the latest `anyCorrected` flag through onCorrected.
  const [refreshTick, setRefreshTick] = useState(0);
  const corrected = !!meta?.anyCorrected || refreshTick > 0;

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
        <div className="flex min-w-0 items-start gap-3">
          <Eye className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden />
          <div className="min-w-0">
            <p className="text-sm font-bold text-amber-900">
              Viewing: {formatted}
              <span className="ml-2 inline-block rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-800">
                Read-only
              </span>
              {corrected && (
                <button
                  type="button"
                  onClick={() => setHistoryOpen(true)}
                  className="ml-2 inline-flex items-center gap-1 rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-rose-800 transition-colors hover:bg-rose-200"
                  title="One or more snapshot rows have been corrected by an admin — click to see history"
                >
                  <ShieldCheck className="h-3 w-3" aria-hidden />
                  Corrected
                </button>
              )}
            </p>
            <p className="mt-0.5 text-[11px] text-amber-700">
              Frozen state of this surface as of month-end {formatted}. Edits and
              actions are disabled. To resume editing, exit historical view.
              {meta?.retentionUntil && (
                <span className="ml-1 text-amber-700/80">
                  · Retained until {meta.retentionUntil.slice(0, 10)}
                </span>
              )}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {callerIsSuperAdmin && (
            <>
              <button
                type="button"
                onClick={() => setHistoryOpen(true)}
                className="inline-flex h-8 items-center gap-1.5 rounded-md border border-rose-200 bg-white px-3 text-[11px] font-semibold text-rose-700 transition-colors hover:bg-rose-50"
                title="View every super_admin correction made to this snapshot"
              >
                <History className="h-3.5 w-3.5" aria-hidden />
                History
              </button>
              <button
                type="button"
                onClick={() => setCorrectionOpen(true)}
                className="inline-flex h-8 items-center gap-1.5 rounded-md bg-rose-600 px-3 text-[11px] font-semibold text-white transition-colors hover:bg-rose-700"
                title="Patch a row in this snapshot (super-admin only — every change is audited)"
              >
                <Pencil className="h-3.5 w-3.5" aria-hidden />
                Correct row
              </button>
            </>
          )}
          <button
            type="button"
            onClick={onExit}
            className="inline-flex h-8 items-center gap-1.5 rounded-md bg-white border border-amber-300 px-3 text-[11px] font-semibold text-amber-800 transition-colors hover:bg-amber-100"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
            Exit historical view
          </button>
        </div>
      </div>

      {/* friendly empty-state panel below the banner when the
 page has nothing to render. Renders only when the parent page
 opts in by passing `emptyReason`.*/}
      {emptyReason && (
        <HistoricalEmptyState
          reason={emptyReason}
          monthEnd={monthEnd}
          activatedYearMonth={activatedYearMonth ?? null}
          surfaceLabel={surfaceLabel}
        />
      )}

      {callerIsSuperAdmin && (
        <CorrectionModal
          open={correctionOpen}
          yearMonth={monthEnd}
          defaultCollection={defaultCorrectionCollection}
          onClose={() => setCorrectionOpen(false)}
          onCorrected={() => {
            setRefreshTick((n) => n + 1);
            onCorrected?.();
          }}
        />
      )}
      <CorrectionHistory
        open={historyOpen}
        yearMonth={monthEnd}
        onClose={() => setHistoryOpen(false)}
        refreshTick={refreshTick}
      />
    </>
  );
}
