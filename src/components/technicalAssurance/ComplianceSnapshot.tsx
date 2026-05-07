import { CheckCircle2, CircleAlert, XCircle } from "lucide-react";
import { clsx } from "clsx";
import type { SummaryTabContent } from "../../types/technicalAssurance";

// Compliance snapshot — visual grid of pass / warn / fail tiles. PRD US-3.1
// requires the snapshot to surface 5-8 quick checks at the top of the
// Summary tab. Tiles use the same emerald / amber / rose palette as the
// rest of the platform.

const STATUS_ICON: Record<"pass" | "warn" | "fail", typeof CheckCircle2> = {
  pass: CheckCircle2,
  warn: CircleAlert,
  fail: XCircle,
};

const TILE_STYLES: Record<"pass" | "warn" | "fail", string> = {
  pass: "border-emerald-200 bg-emerald-50/60 text-emerald-800",
  warn: "border-amber-200 bg-amber-50/60 text-amber-800",
  fail: "border-rose-200 bg-rose-50/60 text-rose-800",
};

const ICON_COLOR: Record<"pass" | "warn" | "fail", string> = {
  pass: "text-emerald-600",
  warn: "text-amber-600",
  fail: "text-rose-600",
};

interface ComplianceSnapshotProps {
  checks: SummaryTabContent["complianceSnapshot"];
}

export function ComplianceSnapshot({ checks }: ComplianceSnapshotProps) {
  if (!checks?.length) return null;
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">
          Compliance snapshot
        </p>
        <p className="text-[11px] text-slate-400">
          {checks.length} check{checks.length === 1 ? "" : "s"}
        </p>
      </div>
      <ul className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {checks.map((c, idx) => {
          const Icon = STATUS_ICON[c.status];
          return (
            <li
              key={idx}
              className={clsx(
                "flex items-start gap-2 rounded-lg border px-3 py-2 text-[12px] font-medium",
                TILE_STYLES[c.status],
              )}
            >
              <Icon
                className={clsx("mt-0.5 h-4 w-4 shrink-0", ICON_COLOR[c.status])}
                strokeWidth={2.25}
              />
              <span className="leading-snug">{c.check}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
