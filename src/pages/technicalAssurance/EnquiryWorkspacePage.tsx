import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router";
import { motion } from "motion/react";
import {
  Layers,
  ArrowLeft,
  AlertCircle,
  CheckCircle2,
  CircleAlert,
  XCircle,
  BookOpen,
  ListChecks,
  Wand2,
} from "lucide-react";
import toast from "react-hot-toast";
import { clsx } from "clsx";

import { api } from "../../lib/api";
import { TacPlaceholder } from "../../components/technicalAssurance/TacPlaceholder";
import { getRIBALabel } from "../../constants/ribaStages";
import type {
  Enquiry,
  EnquiryDeliverable,
  EnquiryStatus,
  SummaryTabContent,
} from "../../types/technicalAssurance";

// Phase 2 — Enquiry workspace renders the Summary deliverable produced by
// `tacGenerateInsight` so users can verify the AI output end-to-end. The
// proper 5-tab workspace (Drawing / RFI / Cost / Compliance) lands in
// Phases 3-7 — the panel below is replaced by a real tab strip then.
//
// Visual chrome stays intentionally simple: one centred card with the lede,
// ranked options with compliance pills, citations + next actions. No
// Sparkles / Brain / Rocket icons (locked rule).

const STATUS_PILL: Record<EnquiryStatus, string> = {
  Draft: "bg-slate-100 text-slate-700 border border-slate-200",
  Generating: "bg-amber-50 text-amber-800 border border-amber-200",
  Open: "bg-indigo-50 text-indigo-700 border border-indigo-200",
  AwaitingReview: "bg-violet-50 text-violet-700 border border-violet-200",
  Approved: "bg-emerald-50 text-emerald-700 border border-emerald-200",
  Closed: "bg-emerald-100 text-emerald-800 border border-emerald-300",
  Archived: "bg-slate-50 text-slate-500 border border-slate-200",
};

const COMPLIANCE_PILL: Record<
  "compliant" | "borderline" | "non-compliant",
  string
> = {
  compliant: "bg-emerald-50 text-emerald-700 border border-emerald-200",
  borderline: "bg-amber-50 text-amber-800 border border-amber-200",
  "non-compliant": "bg-rose-50 text-rose-700 border border-rose-200",
};

const SNAPSHOT_ICON: Record<"pass" | "warn" | "fail", any> = {
  pass: CheckCircle2,
  warn: CircleAlert,
  fail: XCircle,
};

const SNAPSHOT_COLOR: Record<"pass" | "warn" | "fail", string> = {
  pass: "text-emerald-600",
  warn: "text-amber-600",
  fail: "text-rose-600",
};

export function TacEnquiryWorkspacePage() {
  const { id: enquiryId } = useParams<{ id: string }>();

  const [enquiry, setEnquiry] = useState<Enquiry | null>(null);
  const [deliverable, setDeliverable] =
    useState<EnquiryDeliverable<SummaryTabContent> | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!enquiryId) return;
    try {
      setError(null);
      const res = await api.tacGetEnquiryDeliverable(enquiryId, "summary");
      setEnquiry((res?.enquiry as Enquiry) ?? null);
      setDeliverable(
        (res?.deliverable as EnquiryDeliverable<SummaryTabContent> | null) ??
          null,
      );
    } catch (e: any) {
      setError(e?.message ?? "Failed to load enquiry.");
    } finally {
      setLoading(false);
    }
  }, [enquiryId]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleGenerate = useCallback(async () => {
    if (!enquiry) return;
    if (generating) return;
    if (enquiry.status !== "Draft") {
      toast.error("Insight generation is only available from Draft state.");
      return;
    }
    const t = toast.loading("Generating insight — this can take up to 25s…");
    try {
      setGenerating(true);
      await api.tacGenerateInsight(enquiry.id);
      toast.success("Insight ready", { id: t });
      await load();
    } catch (e: any) {
      const code = e?.code;
      const msg = e?.message ?? "Failed to generate insight.";
      toast.error(
        code === "INSUFFICIENT_CITATIONS"
          ? "Insight blocked: at least one regulation citation is required."
          : code === "EMPTY_CORPUS"
            ? "Regulations corpus is empty. Ask a super-admin to seed it."
            : msg,
        { id: t },
      );
      await load();
    } finally {
      setGenerating(false);
    }
  }, [enquiry, generating, load]);

  // --- Render helpers ----------------------------------------------------

  const isHistoricalStub = !enquiryId || enquiryId === "abc-123";

  const summaryContent = useMemo<SummaryTabContent | null>(() => {
    if (!deliverable) return null;
    return deliverable.content;
  }, [deliverable]);

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl">
        <div className="flex items-center justify-center py-20 text-slate-400">
          <span className="inline-flex h-2 w-2 animate-pulse rounded-full bg-indigo-400" />
          <span className="ml-3 text-sm">Loading enquiry…</span>
        </div>
      </div>
    );
  }

  if (isHistoricalStub) {
    // Direct visit to the example route — show the original placeholder so
    // we don't break the Phase 0 sidebar deep-link pattern.
    return (
      <TacPlaceholder
        icon={Layers}
        title="Enquiry workspace"
        description="Five deliverable tabs per enquiry — summary, annotated drawing, RFI draft, cost and programme impact, compliance citations. Surface lands in Phases 3 to 7."
        phaseLabel="Phases 3-7 — Deliverables"
      />
    );
  }

  if (error || !enquiry) {
    return (
      <div className="mx-auto max-w-3xl">
        <div className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-semibold">Couldn't load this enquiry.</p>
            <p className="mt-1">{error ?? "Not found."}</p>
            <Link
              to="/technical-assurance/enquiries"
              className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-rose-700 underline"
            >
              <ArrowLeft className="h-3 w-3" />
              Back to enquiries
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="mx-auto max-w-4xl space-y-6"
    >
      {/* Header */}
      <div>
        <Link
          to="/technical-assurance/enquiries"
          className="inline-flex items-center gap-1 text-[12px] font-semibold text-slate-500 hover:text-indigo-600"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to enquiries
        </Link>
        <div className="mt-2 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
              <Layers className="h-5 w-5" strokeWidth={2.25} />
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">
                Technical Assurance · Enquiry
              </p>
              <h1 className="text-xl font-bold tracking-tight text-slate-900 md:text-2xl">
                {enquiry.title}
              </h1>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span
                  className={clsx(
                    "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold",
                    STATUS_PILL[enquiry.status],
                  )}
                >
                  {enquiry.status}
                </span>
                <span
                  className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700"
                  title={getRIBALabel(enquiry.ribaStage)}
                >
                  {enquiry.ribaStage}
                </span>
                <span className="text-[11px] text-slate-400">
                  {enquiry.attachments?.length ?? 0} attachment
                  {(enquiry.attachments?.length ?? 0) === 1 ? "" : "s"}
                </span>
              </div>
            </div>
          </div>
          {enquiry.status === "Draft" && (
            <button
              type="button"
              onClick={handleGenerate}
              disabled={generating}
              className={clsx(
                "inline-flex items-center justify-center gap-2 self-start rounded-lg px-4 py-2 text-sm font-semibold shadow-sm",
                generating
                  ? "cursor-wait bg-slate-100 text-slate-400"
                  : "bg-indigo-600 text-white hover:bg-indigo-700",
              )}
            >
              <Wand2 className="h-4 w-4" />
              {generating ? "Generating…" : "Generate insight"}
            </button>
          )}
        </div>
      </div>

      {/* Pulse banner when Generating */}
      {enquiry.status === "Generating" && (
        <div className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <span className="relative inline-flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-amber-500" />
          </span>
          <p>
            Insight generation in flight — this typically completes in under
            20 seconds.
          </p>
        </div>
      )}

      {/* Empty state for Draft + no deliverable yet */}
      {enquiry.status === "Draft" && !summaryContent && (
        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/60 px-6 py-10 text-center">
          <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
            <Wand2 className="h-5 w-5" />
          </div>
          <h2 className="mt-3 text-sm font-semibold text-slate-900">
            No insight yet
          </h2>
          <p className="mt-1 text-[12px] text-slate-500">
            Click <span className="font-semibold">Generate insight</span> to
            run the regulation-cited AI analysis. Insights with zero
            corpus-resolvable citations are blocked.
          </p>
        </div>
      )}

      {/* Summary deliverable */}
      {summaryContent && (
        <div className="space-y-4">
          {/* Lede */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">
              Summary
            </p>
            <p className="mt-1 text-base font-semibold leading-relaxed text-slate-900">
              {summaryContent.lede}
            </p>
            <p className="mt-3 text-[11px] text-slate-400">
              Generated {deliverable?.generatedAt
                ? new Date(deliverable.generatedAt).toLocaleString("en-GB")
                : "—"}{" "}
              · Augments professional judgement, does not replace it.
            </p>
          </div>

          {/* Compliance snapshot */}
          {summaryContent.complianceSnapshot.length > 0 && (
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">
                Compliance snapshot
              </p>
              <ul className="mt-2 space-y-1.5">
                {summaryContent.complianceSnapshot.map((s, idx) => {
                  const Icon = SNAPSHOT_ICON[s.status];
                  return (
                    <li
                      key={idx}
                      className="flex items-start gap-2 text-sm text-slate-700"
                    >
                      <Icon
                        className={clsx(
                          "mt-0.5 h-4 w-4 shrink-0",
                          SNAPSHOT_COLOR[s.status],
                        )}
                      />
                      <span>{s.check}</span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {/* Ranked options */}
          {summaryContent.options.length > 0 && (
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">
                  Ranked options
                </p>
                <p className="text-[11px] text-slate-400">
                  {summaryContent.options.length} option
                  {summaryContent.options.length === 1 ? "" : "s"}
                </p>
              </div>
              <ol className="mt-3 space-y-3">
                {summaryContent.options.map((opt, idx) => (
                  <li
                    key={opt.id}
                    className={clsx(
                      "rounded-lg border p-4 transition-colors",
                      opt.recommended
                        ? "border-indigo-200 bg-indigo-50/40"
                        : "border-slate-200 bg-white",
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-semibold text-slate-400">
                            #{idx + 1}
                          </span>
                          <h3 className="text-sm font-semibold text-slate-900">
                            {opt.label}
                          </h3>
                          {opt.recommended && (
                            <span className="inline-flex items-center rounded-full bg-indigo-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
                              Recommended
                            </span>
                          )}
                        </div>
                        <p className="mt-1 text-sm text-slate-700">
                          {opt.summary}
                        </p>
                      </div>
                      <span
                        className={clsx(
                          "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold",
                          COMPLIANCE_PILL[opt.compliance],
                        )}
                      >
                        {opt.compliance.replace("-", " ")}
                      </span>
                    </div>
                    {opt.rationale && (
                      <p className="mt-2 text-[12px] leading-relaxed text-slate-500">
                        {opt.rationale}
                      </p>
                    )}
                    {(opt.costDelta !== 0 || opt.programmeDelta !== 0) && (
                      <div className="mt-2 flex items-center gap-3 text-[11px] text-slate-500">
                        <span>
                          Cost Δ: <strong className="text-slate-700">£{opt.costDelta.toLocaleString()}</strong>
                        </span>
                        <span>
                          Programme Δ:{" "}
                          <strong className="text-slate-700">
                            {opt.programmeDelta} day{opt.programmeDelta === 1 ? "" : "s"}
                          </strong>
                        </span>
                      </div>
                    )}
                  </li>
                ))}
              </ol>
            </div>
          )}

          {/* Citations */}
          {summaryContent.citations.length > 0 && (
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-indigo-600" />
                <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">
                  Cited regulations
                </p>
              </div>
              <ul className="mt-3 space-y-3">
                {summaryContent.citations.map((c, idx) => (
                  <li
                    key={`${c.regId}-${idx}`}
                    className="rounded-lg border border-slate-200 bg-slate-50/60 p-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-[11px] font-bold text-indigo-700">
                        {c.regId}
                      </span>
                      <span className="text-[11px] text-slate-400">
                        Applied to: {c.appliedTo || "—"}
                      </span>
                    </div>
                    <p className="mt-1 text-[12px] italic leading-relaxed text-slate-600">
                      "{c.quote}"
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Next actions */}
          {summaryContent.nextActions.length > 0 && (
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-2">
                <ListChecks className="h-4 w-4 text-indigo-600" />
                <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">
                  Next actions
                </p>
              </div>
              <ul className="mt-2 space-y-1.5">
                {summaryContent.nextActions.map((a, idx) => (
                  <li
                    key={idx}
                    className="flex items-start gap-2 text-sm text-slate-700"
                  >
                    <span className="mt-1.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-500" />
                    <span>{a}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Footnote about future tabs */}
      <p className="text-center text-[11px] text-slate-400">
        Drawing · RFI · Cost &amp; programme · Compliance tabs land in Phases 3 to 7.
      </p>
    </motion.div>
  );
}
