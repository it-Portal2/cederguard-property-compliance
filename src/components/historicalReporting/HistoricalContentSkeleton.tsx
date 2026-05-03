// HRC HR-7 polish — generic page-body skeleton shown while a snapshot
// is loading. Used by chart / dashboard / canvas pages where there's
// no DynamicTable to take a `loading` prop directly.
//
// Three layout presets that approximate the most common HRC-wired
// page shapes:
//   • "stats-grid" — 4 stats tiles + table-ish stack (RiskDashboard,
//                    ArchivePage, KRITracker, DashboardPage)
//   • "table"      — toolbar stack + N rows (ComplianceTracker)
//   • "canvas"     — large blocks (FrameworkPage)
//
// All three use the same animate-pulse vocabulary as the existing
// table skeletons so the visual language stays consistent.

import { clsx } from "clsx";

interface HistoricalContentSkeletonProps {
  variant?: "stats-grid" | "table" | "canvas";
  className?: string;
}

export function HistoricalContentSkeleton({
  variant = "stats-grid",
  className,
}: HistoricalContentSkeletonProps) {
  if (variant === "table") {
    return (
      <div className={clsx("space-y-3", className)}>
        <div className="h-10 animate-pulse rounded-lg bg-slate-100" />
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className="h-12 animate-pulse rounded-lg bg-slate-100"
          />
        ))}
      </div>
    );
  }

  if (variant === "canvas") {
    return (
      <div className={clsx("space-y-4", className)}>
        <div className="h-32 animate-pulse rounded-xl bg-slate-100" />
        <div className="h-44 animate-pulse rounded-xl bg-slate-100" />
        <div className="h-32 animate-pulse rounded-xl bg-slate-100" />
      </div>
    );
  }

  // Default — stats-grid: 4 stats + content stack.
  return (
    <div className={clsx("space-y-4", className)}>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-24 animate-pulse rounded-xl bg-slate-100"
          />
        ))}
      </div>
      <div className="h-12 animate-pulse rounded-lg bg-slate-100" />
      <div className="h-12 animate-pulse rounded-lg bg-slate-100" />
      <div className="h-12 animate-pulse rounded-lg bg-slate-100" />
      <div className="h-12 animate-pulse rounded-lg bg-slate-100" />
    </div>
  );
}
