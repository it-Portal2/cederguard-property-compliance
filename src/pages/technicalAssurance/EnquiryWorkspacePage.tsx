import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router";
import { motion } from "motion/react";
import {
  Layers,
  ArrowLeft,
  AlertCircle,
  Loader2,
  Compass,
  Check,
  CircleDot,
  Image as ImageIcon,
  ClipboardList,
  PoundSterling,
  ShieldCheck,
} from "lucide-react";
import toast from "react-hot-toast";
import { clsx } from "clsx";

import { api } from "../../lib/api";
import { generateTacInsight } from "../../services/aiService";
import { TacPlaceholder } from "../../components/technicalAssurance/TacPlaceholder";
import { getRIBALabel } from "../../constants/ribaStages";
import { SummaryTab } from "../../components/technicalAssurance/tabs/SummaryTab";
import { DrawingTab } from "../../components/technicalAssurance/tabs/DrawingTab";
import { RfiTab } from "../../components/technicalAssurance/tabs/RfiTab";
import { TabPlaceholder } from "../../components/technicalAssurance/tabs/TabPlaceholder";
import {
  TabStrip,
  type TacWorkspaceTabId,
} from "../../components/technicalAssurance/tabs/TabStrip";
import type {
  Enquiry,
  EnquiryDeliverable,
  EnquiryStatus,
  SummaryTabContent,
} from "../../types/technicalAssurance";

// Phase 3 — Enquiry workspace becomes the canonical 5-tab surface
// (Summary · Drawing · RFI · Cost & programme · Compliance). Summary is
// fully implemented; the other 4 tabs render TabPlaceholder until Phases
// 4-7 ship. Generation animation is the same stepped panel as Phase 2.

const STATUS_PILL: Record<EnquiryStatus, string> = {
  Draft: "bg-slate-100 text-slate-700 border border-slate-200",
  Generating: "bg-amber-50 text-amber-800 border border-amber-200",
  Open: "bg-indigo-50 text-indigo-700 border border-indigo-200",
  AwaitingReview: "bg-violet-50 text-violet-700 border border-violet-200",
  Approved: "bg-emerald-50 text-emerald-700 border border-emerald-200",
  Closed: "bg-emerald-100 text-emerald-800 border border-emerald-300",
  Archived: "bg-slate-50 text-slate-500 border border-slate-200",
};

// Stepped progress states for the in-flight generation panel. These are
// purely UX cosmetics — Gemini doesn't expose real progress callbacks, so we
// stage advancement on a timer that roughly tracks the actual pipeline order.
const GENERATION_STEPS = [
  { key: "context", label: "Loading enquiry context" },
  { key: "corpus", label: "Reading regulations corpus" },
  { key: "options", label: "Drafting ranked options" },
  { key: "citations", label: "Citing applicable clauses" },
] as const;

function InsightGeneratingPanel() {
  const [activeIdx, setActiveIdx] = useState(0);
  useEffect(() => {
    const t = setInterval(() => {
      setActiveIdx((i) => Math.min(i + 1, GENERATION_STEPS.length - 1));
    }, 4000);
    return () => clearInterval(t);
  }, []);
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="relative overflow-hidden rounded-xl border border-indigo-200 bg-white p-6 shadow-sm"
      role="status"
      aria-live="polite"
    >
      <motion.div
        className="absolute inset-x-0 top-0 h-1 bg-linear-to-r from-indigo-200 via-indigo-500 to-indigo-200"
        animate={{ x: ["-100%", "100%"] }}
        transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
      />
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
          <Loader2 className="h-5 w-5 animate-spin" strokeWidth={2.25} />
        </div>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">
            Insight in progress
          </p>
          <h2 className="text-base font-bold text-slate-900">
            Analysing your enquiry against the regulations corpus…
          </h2>
        </div>
      </div>

      <ul className="mt-5 space-y-3">
        {GENERATION_STEPS.map((step, idx) => {
          const isDone = idx < activeIdx;
          const isActive = idx === activeIdx;
          return (
            <li key={step.key} className="flex items-center gap-3 text-sm">
              <span
                className={clsx(
                  "flex h-5 w-5 items-center justify-center rounded-full",
                  isDone
                    ? "bg-emerald-100 text-emerald-700"
                    : isActive
                      ? "bg-indigo-100 text-indigo-700"
                      : "bg-slate-100 text-slate-400",
                )}
              >
                {isDone ? (
                  <Check className="h-3 w-3" />
                ) : isActive ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <CircleDot className="h-2 w-2" />
                )}
              </span>
              <span
                className={clsx(
                  isDone
                    ? "text-slate-500"
                    : isActive
                      ? "font-semibold text-slate-900"
                      : "text-slate-400",
                )}
              >
                {step.label}
              </span>
            </li>
          );
        })}
      </ul>

      <p className="mt-5 text-[11px] text-slate-400">
        This typically completes in under 20 seconds. Augments professional
        judgement — does not replace it.
      </p>
    </motion.div>
  );
}

export function TacEnquiryWorkspacePage() {
  const { id: enquiryId } = useParams<{ id: string }>();

  const [enquiry, setEnquiry] = useState<Enquiry | null>(null);
  const [deliverable, setDeliverable] =
    useState<EnquiryDeliverable<SummaryTabContent> | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TacWorkspaceTabId>("summary");

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
    try {
      setGenerating(true);
      setEnquiry((prev) =>
        prev ? { ...prev, status: "Generating" as const } : prev,
      );
      await generateTacInsight(enquiry.id);
      await load();
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to generate insight.");
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
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 text-slate-500">
        <Loader2
          className="h-7 w-7 animate-spin text-indigo-500"
          strokeWidth={2.25}
        />
        <p className="text-sm font-semibold tracking-wide">Loading enquiry…</p>
      </div>
    );
  }

  if (isHistoricalStub) {
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
      <div className="space-y-3">
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

  const isInFlight = generating || enquiry.status === "Generating";

  // --- Per-tab body ------------------------------------------------------
  let tabBody: React.ReactNode = null;
  if (activeTab === "summary") {
    if (isInFlight) {
      tabBody = <InsightGeneratingPanel />;
    } else if (!summaryContent && enquiry.status === "Draft") {
      tabBody = (
        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/60 px-6 py-10 text-center">
          <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
            <Compass className="h-5 w-5" />
          </div>
          <h2 className="mt-3 text-sm font-semibold text-slate-900">
            No insight yet
          </h2>
          <p className="mt-1 text-[12px] text-slate-500">
            Click <span className="font-semibold">Generate insight</span> in
            the header to run the regulation-cited analysis. Insights with zero
            corpus-resolvable citations are blocked.
          </p>
        </div>
      );
    } else if (summaryContent) {
      tabBody = (
        <SummaryTab
          content={summaryContent}
          deliverable={deliverable!}
          onNavigateTab={setActiveTab}
        />
      );
    }
  } else if (activeTab === "drawing") {
    if (isInFlight) {
      tabBody = <InsightGeneratingPanel />;
    } else if (summaryContent?.drawing) {
      tabBody = (
        <DrawingTab enquiry={enquiry} drawing={summaryContent.drawing} />
      );
    } else if (enquiry.status === "Draft") {
      tabBody = (
        <TabPlaceholder
          icon={ImageIcon}
          title="Generate insight first"
          description="The Drawing tab is populated by the same AI run that produces the Summary. Switch back to Summary and click Generate insight."
          phaseLabel="Drawing markup"
        />
      );
    } else {
      tabBody = (
        <TabPlaceholder
          icon={ImageIcon}
          title="No drawing in scope"
          description="This enquiry has no PDF attachment, so no drawing markup was produced. Add a PDF and re-generate to populate this tab."
          phaseLabel="Drawing markup"
        />
      );
    }
  } else if (activeTab === "rfi") {
    if (isInFlight) {
      tabBody = <InsightGeneratingPanel />;
    } else if (summaryContent?.rfi) {
      tabBody = (
        <RfiTab
          enquiry={enquiry}
          rfi={summaryContent.rfi}
          onIssued={(updatedRfi) => {
            // Stamp the new RFI status onto the cached deliverable so the
            // tab UI flips to read-only without a full refetch. The next
            // load() call will pull the canonical doc.
            setDeliverable((prev) =>
              prev
                ? {
                    ...prev,
                    content: { ...prev.content, rfi: updatedRfi },
                  }
                : prev,
            );
          }}
        />
      );
    } else if (enquiry.status === "Draft") {
      tabBody = (
        <TabPlaceholder
          icon={ClipboardList}
          title="Generate insight first"
          description="The RFI tab is auto-populated by the same AI run that produces the Summary. Switch back to Summary and click Generate insight."
          phaseLabel="RFI draft"
        />
      );
    } else {
      tabBody = (
        <TabPlaceholder
          icon={ClipboardList}
          title="RFI draft unavailable"
          description="No RFI draft was produced for this enquiry. Add more context and re-generate."
          phaseLabel="RFI draft"
        />
      );
    }
  } else if (activeTab === "costProgramme") {
    tabBody = (
      <TabPlaceholder
        icon={PoundSterling}
        title="Cost & programme impact"
        description="4-tile metric row + line-item cost table benchmarked against the council's hand-seeded rates + Gantt overlay against the master schedule."
        phaseLabel="Phase 6"
      />
    );
  } else if (activeTab === "compliance") {
    tabBody = (
      <TabPlaceholder
        icon={ShieldCheck}
        title="Compliance & citations"
        description="Full compliance pack — dimensional + system checks, citation cards, soft-flag banner, downloadable PDF, and one-click Save to Golden Thread for HRB projects."
        phaseLabel="Phase 7"
      />
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="space-y-6"
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
          {enquiry.status === "Draft" && !isInFlight && (
            <button
              type="button"
              onClick={handleGenerate}
              disabled={generating}
              className="inline-flex items-center justify-center gap-2 self-start rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:cursor-wait disabled:bg-slate-300"
            >
              <Compass className="h-4 w-4" />
              Generate insight
            </button>
          )}
        </div>
      </div>

      {/* 5-tab strip */}
      <TabStrip activeTab={activeTab} onChange={setActiveTab} />

      {/* Active tab body */}
      {tabBody}
    </motion.div>
  );
}
