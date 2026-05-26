//  small "Corrected" pill.
//
// Standalone re-usable component so future row-level surfaces ( or
// later) can flag individual snapshot rows that have been patched. The
// HistoricalBanner already renders its own corrected pill when
// `meta.anyCorrected === true`; this component is for narrower contexts
// (e.g. per-row indicators in tables).

import { ShieldCheck } from "lucide-react";
import { clsx } from "clsx";

interface CorrectionBadgeProps {
  className?: string;
  /** Title text shown on hover.*/
  title?: string;
  size?: "sm" | "md";
}

export function CorrectionBadge({
  className,
  title = "This row has been corrected by an admin after month-end snapshot.",
  size = "sm",
}: CorrectionBadgeProps) {
  const sizing =
    size === "md"
      ? "px-2 py-0.5 text-[11px]"
      : "px-1.5 py-0.5 text-[10px]";
  return (
    <span
      className={clsx(
        "font-mono inline-flex items-center gap-1 rounded-full bg-rose-100 font-bold uppercase tracking-wider text-rose-800",
        sizing,
        className,
      )}
      title={title}
    >
      <ShieldCheck className={size === "md" ? "h-3.5 w-3.5" : "h-3 w-3"} aria-hidden />
      Corrected
    </span>
  );
}
