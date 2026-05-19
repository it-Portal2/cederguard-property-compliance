import type { LucideIcon } from "lucide-react";
import { motion } from "motion/react";
import { ArrowUpRight } from "lucide-react";

// Placeholder rendered for the Drawing / RFI / Cost & Programme / Compliance
// tabs until Phases 4-7 land. Same visual language as TacPlaceholder but
// scoped to a single tab so the workspace shell + tab strip stay live.

interface TabPlaceholderProps {
  icon: LucideIcon;
  title: string;
  description: string;
  phaseLabel: string;
}

export function TabPlaceholder({
  icon: Icon,
  title,
  description,
  phaseLabel,
}: TabPlaceholderProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm md:p-10"
    >
      <div className="flex flex-col items-start gap-5 md:flex-row md:items-center md:gap-6">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
          <Icon className="h-6 w-6" strokeWidth={2.25} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">
            Technical Assurance · Coming in {phaseLabel}
          </p>
          <h2 className="mt-1 text-lg font-bold tracking-tight text-slate-900 md:text-xl">
            {title}
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-500">
            {description}
          </p>
          <div className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-indigo-50 px-3 py-1 text-[11px] font-semibold text-indigo-700">
            <ArrowUpRight className="h-3 w-3" />
            {phaseLabel}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
