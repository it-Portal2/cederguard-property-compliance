import type { LucideIcon } from "lucide-react";
import { motion } from "motion/react";
import { ArrowUpRight } from "lucide-react";

// Technical Assurance Companion — shared placeholder primitive used by all
// Phase 0 routes. Mirrors the visual language of the governance Phase 0
// placeholder (indigo-50 icon tile, slate body, tracked eyebrow) so the new
// surface feels native immediately.

interface TacPlaceholderProps {
  icon: LucideIcon;
  eyebrow?: string;
  title: string;
  description: string;
  phaseLabel?: string;
}

export function TacPlaceholder({
  icon: Icon,
  eyebrow = "Technical Assurance Companion",
  title,
  description,
  phaseLabel,
}: TacPlaceholderProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className="mx-auto max-w-3xl"
    >
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm md:p-10 dark:border-slate-700 dark:bg-slate-800">
        <div className="flex flex-col items-start gap-5 md:flex-row md:items-center md:gap-6">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-300">
            <Icon className="h-6 w-6" strokeWidth={2.25} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500">
              {eyebrow}
            </p>
            <h1 className="mt-1 text-xl font-bold tracking-tight text-slate-900 md:text-2xl dark:text-slate-100">
              {title}
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-slate-500 dark:text-slate-400">
              {description}
            </p>
            {phaseLabel && (
              <div className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-indigo-50 px-3 py-1 text-[11px] font-semibold text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300">
                <ArrowUpRight className="h-3 w-3" />
                {phaseLabel}
              </div>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
