// Phase 9 — Technical Assurance section for ProjectReport.
//
// Reads enquiries flagged `addedToProjectReport === true` for the given
// projectId via the dedicated server endpoint and renders a self-contained
// section. Mounts inside ProjectReport.tsx with a single import + line.
//
// When zero enquiries are added, the section returns null — no empty
// state, no UI noise on projects that don't use TAC.

import { useEffect, useState } from "react";
import { Link } from "react-router";
import {
  ShieldCheck,
  ExternalLink,
  PoundSterling,
  CalendarClock,
} from "lucide-react";
import { clsx } from "clsx";
import { motion } from "motion/react";
import { api } from "../../lib/api";

interface ReportEnquiry {
  id: string;
  title: string;
  ribaStage: string;
  status: string;
  addedToProjectReportAt: string | null;
  lede: string;
  recommendedOption: {
    label: string;
    summary: string;
    costDelta: number;
    programmeDelta: number;
  } | null;
  costProgramme: {
    totalDelta: number;
    floatRemaining: number;
    contingencyDrawPct: number | null;
    costLineCount: number;
  } | null;
}

interface ProjectReportTacSectionProps {
  projectId: string;
}

function formatGBP(n: number): string {
  if (!Number.isFinite(n)) return "£0";
  const abs = Math.abs(Math.round(n));
  const out = abs.toLocaleString("en-GB");
  return n < 0 ? `−£${out}` : `£${out}`;
}

export function ProjectReportTacSection({
  projectId,
}: ProjectReportTacSectionProps) {
  const [items, setItems] = useState<ReportEnquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!projectId) return;
    let cancelled = false;
    void (async () => {
      setLoading(true);
      try {
        const r = await api.tacListProjectReportEnquiries(projectId);
        if (cancelled) return;
        if (!r?.success) throw new Error(r?.error ?? "Failed to load");
        setItems(Array.isArray(r.items) ? (r.items as ReportEnquiry[]) : []);
        setError(null);
      } catch (e: any) {
        if (!cancelled) setError(e?.message ?? "Failed to load TAC section");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  // No enquiries flagged → render nothing (don't pollute the report with
  // an empty state on projects that don't use Technical Assurance).
  if (loading) return null;
  if (error) return null;
  if (items.length === 0) return null;

  const totalDelta = items.reduce(
    (sum, e) => sum + (e.costProgramme?.totalDelta ?? 0),
    0,
  );

  return (
    <motion.section
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      aria-labelledby="tac-section-title"
      className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
            <ShieldCheck className="h-4 w-4" />
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">
              Technical Assurance
            </p>
            <h2
              id="tac-section-title"
              className="text-base font-bold text-slate-900"
            >
              AI insights added to this report
            </h2>
            <p className="mt-0.5 text-[12px] text-slate-500">
              {items.length} insight{items.length === 1 ? "" : "s"} ·
              indicative cost impact{" "}
              <span
                className={clsx(
                  "font-mono",
                  totalDelta > 0
                    ? "text-amber-700"
                    : totalDelta < 0
                      ? "text-emerald-700"
                      : "text-slate-700",
                )}
              >
                {formatGBP(totalDelta)}
              </span>
            </p>
          </div>
        </div>
      </div>

      <ul className="mt-4 divide-y divide-slate-100">
        {items.map((e) => (
          <li key={e.id} className="py-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <Link
                  to={`/technical-assurance/enquiries/${e.id}`}
                  className="group inline-flex items-center gap-1 text-sm font-semibold text-slate-900 hover:text-indigo-700"
                >
                  {e.title || "Untitled enquiry"}
                  <ExternalLink className="h-3 w-3 text-slate-400 group-hover:text-indigo-600" />
                </Link>
                <div className="mt-0.5 flex items-center gap-2 text-[11px] text-slate-500">
                  <span className="font-mono">{e.ribaStage}</span>
                  <span aria-hidden>·</span>
                  <span>{e.status}</span>
                </div>
                {e.lede ? (
                  <p className="mt-1 text-[12px] text-slate-700">{e.lede}</p>
                ) : null}
                {e.recommendedOption ? (
                  <p className="mt-1 text-[12px] italic text-slate-500">
                    Recommended: {e.recommendedOption.label}
                    {e.recommendedOption.summary
                      ? ` — ${e.recommendedOption.summary}`
                      : ""}
                  </p>
                ) : null}
              </div>
              {e.costProgramme ? (
                <div className="shrink-0 text-right">
                  <div className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-600">
                    <PoundSterling className="h-3 w-3" />
                    <span className="font-mono text-slate-900">
                      {formatGBP(e.costProgramme.totalDelta)}
                    </span>
                  </div>
                  <div className="mt-0.5 inline-flex items-center gap-1 text-[10px] text-slate-500">
                    <CalendarClock className="h-3 w-3" />
                    <span>
                      {e.costProgramme.floatRemaining >= 0 ? "+" : ""}
                      {e.costProgramme.floatRemaining}d float
                    </span>
                  </div>
                </div>
              ) : null}
            </div>
          </li>
        ))}
      </ul>

      <p className="mt-3 text-[11px] italic text-slate-400">
        Insights are AI-generated. Augments professional judgement, does not
        replace it.
      </p>
    </motion.section>
  );
}
