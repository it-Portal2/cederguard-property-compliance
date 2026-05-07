// Phase 8 — Recent enquiries panel. Mirrors the HTML prototype's "Recent
// prompts" surface. Renders the N most-recently-touched enquiries owned by
// the signed-in PM, with a click-through to open the workspace.
//
// Lives at the top of EnquiriesListPage above the StatsCards. Does not
// duplicate the DynamicTable below — purpose is fast re-entry to recent
// work, not a second table.

import { Link } from "react-router";
import { Clock, ChevronRight } from "lucide-react";
import { clsx } from "clsx";
import { motion } from "motion/react";
import type { Enquiry } from "../../types/technicalAssurance";

interface RecentEnquiriesPanelProps {
  enquiries: Enquiry[];
  /** Defaults to 6. */
  limit?: number;
}

const STATUS_PILL: Record<Enquiry["status"], string> = {
  Draft: "bg-slate-100 text-slate-700",
  Generating: "bg-amber-50 text-amber-800",
  Open: "bg-indigo-50 text-indigo-700",
  AwaitingReview: "bg-violet-50 text-violet-700",
  Approved: "bg-emerald-50 text-emerald-700",
  Closed: "bg-emerald-100 text-emerald-800",
  Archived: "bg-slate-50 text-slate-500",
};

export function RecentEnquiriesPanel({
  enquiries,
  limit = 6,
}: RecentEnquiriesPanelProps) {
  const recent = [...enquiries]
    .filter((e) => !e.softDeleted && e.status !== "Archived")
    .sort((a, b) => (b.updatedAt ?? "").localeCompare(a.updatedAt ?? ""))
    .slice(0, limit);

  if (recent.length === 0) return null;

  return (
    <section
      aria-labelledby="recent-enquiries-title"
      className="rounded-xl border border-slate-200 bg-white shadow-sm"
    >
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-indigo-600" />
          <h2
            id="recent-enquiries-title"
            className="text-sm font-bold text-slate-900"
          >
            Recent enquiries
          </h2>
        </div>
        <span className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">
          Last {recent.length}
        </span>
      </div>
      <ul className="divide-y divide-slate-100">
        {recent.map((e, idx) => (
          <motion.li
            key={e.id}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.12, delay: idx * 0.03 }}
          >
            <Link
              to={`/technical-assurance/enquiries/${e.id}`}
              className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-slate-50 focus-visible:outline-hidden focus-visible:bg-indigo-50/40"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="truncate text-[13px] font-semibold text-slate-900">
                    {e.title || "Untitled enquiry"}
                  </h3>
                  <span
                    className={clsx(
                      "shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider",
                      STATUS_PILL[e.status],
                    )}
                  >
                    {e.status}
                  </span>
                </div>
                <div className="mt-0.5 flex items-center gap-2 text-[11px] text-slate-500">
                  <span className="font-mono">{e.ribaStage}</span>
                  <span aria-hidden>·</span>
                  <span>
                    {e.updatedAt
                      ? new Date(e.updatedAt).toLocaleDateString("en-GB", {
                          day: "numeric",
                          month: "short",
                        })
                      : "—"}
                  </span>
                  {Array.isArray(e.attachments) && e.attachments.length > 0 ? (
                    <>
                      <span aria-hidden>·</span>
                      <span>
                        {e.attachments.length} file
                        {e.attachments.length === 1 ? "" : "s"}
                      </span>
                    </>
                  ) : null}
                </div>
              </div>
              <ChevronRight className="h-4 w-4 shrink-0 text-slate-300" />
            </Link>
          </motion.li>
        ))}
      </ul>
    </section>
  );
}
