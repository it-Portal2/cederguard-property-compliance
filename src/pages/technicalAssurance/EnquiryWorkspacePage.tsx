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
  CheckCircle2,
  Lock,
  Unlock,
  History,
  Send,
  ThumbsUp,
  ThumbsDown,
  UserCheck,
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
import { CostProgrammeTab } from "../../components/technicalAssurance/tabs/CostProgrammeTab";
import { ComplianceTab } from "../../components/technicalAssurance/tabs/ComplianceTab";
import { TabPlaceholder } from "../../components/technicalAssurance/tabs/TabPlaceholder";
import ConfirmDialog from "../../components/table/ConfirmDialog";
import { ReasonDialog } from "../../components/governance/ReasonDialog";
import { ShareEnquiryModal } from "../../components/technicalAssurance/ShareEnquiryModal";
import { useStore } from "../../store/useStore";
import { isComplianceLead } from "../../lib/roles";
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

// Enquiry workspace becomes the canonical 5-tab surface
// (Summary · Drawing · RFI · Cost & programme · Compliance). Summary is
// fully implemented; the other 4 tabs render TabPlaceholder until Phases
// 4-7 ship. Generation animation is the same stepped panel as.

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
      className="relative overflow-hidden rounded-lg border border-indigo-200 bg-white p-6 shadow-sm"
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

  // HRB flag drives the Compliance tab's "Save to Golden Thread" button
  // (server still re-checks `Project.isHRB === true` independently). Reads
  // from the same Zustand store other governance / risk surfaces use.
  const projects = useStore((s) => s.projects);
  const user = useStore((s) => s.user);
  const projectIsHRB = useMemo(() => {
    if (!enquiry?.projectId) return false;
    const proj = projects.find((p: any) => p?.id === enquiry.projectId);
    return Boolean((proj as any)?.isHRB);
  }, [enquiry?.projectId, projects]);
  const isComplianceLeadUser = useMemo(
    () => isComplianceLead(user?.profile ?? user),
    [user],
  );

  // Close + Unlock state.
  const [closeOpen, setCloseOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const [unlockOpen, setUnlockOpen] = useState(false);
  const [unlocking, setUnlocking] = useState(false);

  // Share-for-review state.
  const [shareOpen, setShareOpen] = useState(false);
  const [decidingShareId, setDecidingShareId] = useState<string | null>(null);
  const [rejectShareId, setRejectShareId] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState(false);

  // Identify the current user's outstanding share on this enquiry, if any.
  const myUid = (user?.uid as string | undefined) ?? user?.profile?.uid;
  const myShare = useMemo(() => {
    const shares = enquiry?.shares ?? [];
    return shares.find((s) => s.sharedWith === myUid && !s.decision) ?? null;
  }, [enquiry?.shares, myUid]);
  // Owner-only outstanding-shares chip data.
  const outstandingShares = useMemo(() => {
    return (enquiry?.shares ?? []).filter((s) => !s.decision);
  }, [enquiry?.shares]);
  const alreadySharedUids = outstandingShares.map((s) => s.sharedWith);
  const isOwner = enquiry?.ownerUid === myUid;

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

  // Close enquiry. For HRB projects, server writes a Golden
  // Thread chain doc as part of the same transaction. Closure flips
  // status to Closed; the workspace renders read-only afterwards.
  const handleCloseConfirm = useCallback(async () => {
    if (!enquiry || closing) return;
    setClosing(true);
    try {
      const r = await api.tacCloseEnquiry(enquiry.id);
      if (!r?.success) throw new Error(r?.error ?? "Close failed");
      toast.success(
        r.isHRB
          ? `Enquiry closed · Golden Thread v${r.goldenThreadVersion}`
          : "Enquiry closed",
      );
      setClosing(false);
      setCloseOpen(false);
      await load();
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to close enquiry");
      setClosing(false);
    }
  }, [enquiry, closing, load]);

  // Share-for-review decisions.
  const handleApproveShare = useCallback(async () => {
    if (!enquiry || !myShare || decidingShareId) return;
    setDecidingShareId(myShare.shareId);
    try {
      const r = await api.tacDecideOnShare({
        enquiryId: enquiry.id,
        shareId: myShare.shareId,
        decision: "approved",
      });
      if (!r?.success) throw new Error(r?.error ?? "Approve failed");
      toast.success("Shared review approved");
      await load();
    } catch (e: any) {
      toast.error(e?.message ?? "Approve failed");
    } finally {
      setDecidingShareId(null);
    }
  }, [enquiry, myShare, decidingShareId, load]);

  const handleRejectShareConfirm = useCallback(
    async (note: string) => {
      if (!enquiry || rejecting || !rejectShareId) return;
      setRejecting(true);
      try {
        const r = await api.tacDecideOnShare({
          enquiryId: enquiry.id,
          shareId: rejectShareId,
          decision: "rejected",
          decisionNote: note,
        });
        if (!r?.success) throw new Error(r?.error ?? "Reject failed");
        toast.success("Shared review rejected");
        setRejectShareId(null);
        setRejecting(false);
        await load();
      } catch (e: any) {
        toast.error(e?.message ?? "Reject failed");
        setRejecting(false);
      }
    },
    [enquiry, rejectShareId, rejecting, load],
  );

  const handleUnlockConfirm = useCallback(
    async (reason: string) => {
      if (!enquiry || unlocking) return;
      setUnlocking(true);
      try {
        const r = await api.tacUnlockEnquiry(enquiry.id, reason);
        if (!r?.success) throw new Error(r?.error ?? "Unlock failed");
        toast.success("Enquiry unlocked — audit trail captured");
        setUnlocking(false);
        setUnlockOpen(false);
        await load();
      } catch (e: any) {
        toast.error(e?.message ?? "Failed to unlock enquiry");
        setUnlocking(false);
      }
    },
    [enquiry, unlocking, load],
  );

  // Render helpers ----------------------------------------------------

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
        <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50/60 px-6 py-10 text-center">
          <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
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
          enquiry={enquiry}
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
    if (isInFlight) {
      tabBody = <InsightGeneratingPanel />;
    } else if (summaryContent?.costProgramme) {
      tabBody = (
        <CostProgrammeTab
          enquiry={enquiry}
          costProgramme={summaryContent.costProgramme}
        />
      );
    } else if (enquiry.status === "Draft") {
      tabBody = (
        <TabPlaceholder
          icon={PoundSterling}
          title="Generate insight first"
          description="The Cost & programme tab is auto-populated by the same AI run that produces the Summary. Switch back to Summary and click Generate insight."
          phaseLabel="Cost & programme"
        />
      );
    } else {
      tabBody = (
        <TabPlaceholder
          icon={PoundSterling}
          title="No cost or programme impact"
          description="The AI did not flag a cost or programme implication for this enquiry. If you expected one, add more context to the query and re-generate."
          phaseLabel="Cost & programme"
        />
      );
    }
  } else if (activeTab === "compliance") {
    if (isInFlight) {
      tabBody = <InsightGeneratingPanel />;
    } else if (summaryContent) {
      tabBody = (
        <ComplianceTab
          enquiry={enquiry}
          summary={summaryContent}
          isHRB={projectIsHRB}
        />
      );
    } else if (enquiry.status === "Draft") {
      tabBody = (
        <TabPlaceholder
          icon={ShieldCheck}
          title="Generate insight first"
          description="The Compliance & citations tab is auto-populated by the same AI run that produces the Summary. Switch back to Summary and click Generate insight."
          phaseLabel="Compliance & citations"
        />
      );
    } else {
      tabBody = (
        <TabPlaceholder
          icon={ShieldCheck}
          title="No compliance data"
          description="The AI did not produce a compliance snapshot for this enquiry. Re-generate with more context."
          phaseLabel="Compliance & citations"
        />
      );
    }
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
          <div className="flex flex-wrap items-center gap-2 self-start">
            {enquiry.status === "Draft" && !isInFlight && (
              <button
                type="button"
                onClick={handleGenerate}
                disabled={generating}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:cursor-wait disabled:bg-slate-300"
              >
                <Compass className="h-4 w-4" />
                Generate insight
              </button>
            )}
            {/* Close enquiry — allowed from Open / AwaitingReview / Approved.
                For HRB projects the server writes a Golden Thread chain doc
                as part of closure. */}
            {(enquiry.status === "Open" ||
              enquiry.status === "AwaitingReview" ||
              enquiry.status === "Approved") && (
              <button
                type="button"
                onClick={() => setCloseOpen(true)}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700 shadow-sm hover:bg-emerald-100"
              >
                <CheckCircle2 className="h-4 w-4" />
                Close enquiry
              </button>
            )}
            {/* Unlock a closed enquiry — Compliance Lead / admin only.
                Required reason is logged into unlockHistory[]. */}
            {enquiry.status === "Closed" && isComplianceLeadUser && (
              <button
                type="button"
                onClick={() => setUnlockOpen(true)}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-rose-300 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700 shadow-sm hover:bg-rose-100"
              >
                <Unlock className="h-4 w-4" />
                Unlock for correction
              </button>
            )}
            {/* Share for review — owner / admin can share an Open,
                AwaitingReview, or Approved enquiry with a workspace member.
                Hidden when the enquiry is Draft (no insight yet) or Closed
                (already finalised). */}
            {isOwner &&
              (enquiry.status === "Open" ||
                enquiry.status === "AwaitingReview" ||
                enquiry.status === "Approved") && (
                <button
                  type="button"
                  onClick={() => setShareOpen(true)}
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:border-indigo-400 hover:text-indigo-700"
                >
                  <Send className="h-4 w-4" />
                  Share for review
                </button>
              )}
          </div>
        </div>
      </div>

      {/* Recipient banner — visible to the user the enquiry was shared with,
          while their decision is pending. The owner sees a different banner
          below for outstanding shares they sent. */}
      {myShare ? (
        <div className="rounded-lg border border-indigo-300 bg-indigo-50/60 p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div className="flex items-start gap-2">
              <UserCheck className="mt-0.5 h-4 w-4 shrink-0 text-indigo-600" />
              <div>
                <div className="text-sm font-semibold text-slate-900">
                  Shared with you for review
                </div>
                <p className="mt-0.5 text-[12px] text-slate-700">
                  Approve or reject after reviewing the deliverables. Your
                  decision is captured on the enquiry's audit trail.
                </p>
                {myShare.note ? (
                  <p className="mt-1 text-[12px] italic text-slate-600">
                    “{myShare.note}”
                  </p>
                ) : null}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setRejectShareId(myShare.shareId)}
                disabled={!!decidingShareId}
                className="inline-flex items-center gap-1.5 rounded-lg border border-rose-300 bg-white px-3 py-1.5 text-[12px] font-semibold text-rose-700 shadow-sm hover:bg-rose-50 disabled:opacity-60"
              >
                <ThumbsDown className="h-3.5 w-3.5" />
                Reject
              </button>
              <button
                type="button"
                onClick={handleApproveShare}
                disabled={!!decidingShareId}
                className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-[12px] font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-60"
              >
                {decidingShareId ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <ThumbsUp className="h-3.5 w-3.5" />
                )}
                Approve
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Owner-side outstanding-shares chip.*/}
      {isOwner && outstandingShares.length > 0 ? (
        <div className="flex items-start gap-2 rounded-lg border border-slate-200 bg-slate-50/60 p-3 text-[12px] leading-5 text-slate-700">
          <Send className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-500" />
          <div>
            <span className="font-semibold">
              {outstandingShares.length} pending review
              {outstandingShares.length === 1 ? "" : "s"}
            </span>{" "}
            — you'll see decisions here once reviewers respond.
          </div>
        </div>
      ) : null}

      {/* Closed-state read-only banner */}
      {enquiry.status === "Closed" && (
        <div className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50/60 p-3 text-[12px] leading-5 text-emerald-800">
          <Lock className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
          <div>
            <span className="font-semibold">Read-only — enquiry closed</span>
            {enquiry.closedAt
              ? ` on ${new Date(enquiry.closedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}`
              : ""}
            {enquiry.goldenThreadVersion
              ? ` · Golden Thread v${enquiry.goldenThreadVersion} captured`
              : ""}
            . Compliance Lead can unlock for correction with a logged reason.
          </div>
        </div>
      )}

      {/* Permanent unlock-history audit banner. Rose strip rendered on every
          enquiry that has been unlocked at least once, surfacing each unlock
          event with date, actor, and reason for FOI / scrutiny readers. */}
      {Array.isArray(enquiry.unlockHistory) && enquiry.unlockHistory.length > 0 && (
        <div className="rounded-lg border border-rose-200 bg-rose-50/40 p-3">
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-widest text-rose-700">
            <History className="h-3.5 w-3.5" />
            Unlock history · {enquiry.unlockHistory.length}
          </div>
          <ul className="mt-2 space-y-1 text-[12px] text-slate-700">
            {enquiry.unlockHistory.map((u, idx) => (
              <li key={idx} className="flex items-start gap-2">
                <span className="font-mono text-[10px] text-rose-600">
                  {new Date(u.at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "2-digit" })}
                </span>
                <span className="flex-1">{u.reason}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 5-tab strip*/}
      <TabStrip activeTab={activeTab} onChange={setActiveTab} />

      {/* Active tab body*/}
      {tabBody}

      {/* Close enquiry confirm dialog*/}
      <ConfirmDialog
        open={closeOpen}
        onCancel={() => setCloseOpen(false)}
        onConfirm={handleCloseConfirm}
        title={projectIsHRB ? "Close enquiry & seal Golden Thread" : "Close this enquiry?"}
        message={
          projectIsHRB
            ? "Closing this enquiry on an HRB project writes an immutable Golden Thread record alongside. The enquiry becomes read-only; only Compliance Lead can unlock it for correction (with a logged reason)."
            : "Closing the enquiry makes it read-only. Compliance Lead can unlock for correction with a logged reason."
        }
        confirmLabel={projectIsHRB ? "Close & seal" : "Close enquiry"}
        variant="success"
        loading={closing}
      />

      {/* Unlock for correction reason dialog*/}
      <ReasonDialog
        open={unlockOpen}
        title="Unlock closed enquiry"
        message="Unlocking returns the enquiry to Open state. The reason you provide here is permanently appended to the audit trail and visible to any FOI / Scrutiny reader of this enquiry."
        reasonLabel="Reason for unlocking (≥10 chars, required)"
        reasonPlaceholder="e.g. Cost figures need correction following revised QS estimate"
        confirmLabel="Unlock"
        variant="warning"
        loading={unlocking}
        onConfirm={handleUnlockConfirm}
        onCancel={() => setUnlockOpen(false)}
      />

      {/* Share-for-review modal*/}
      <ShareEnquiryModal
        open={shareOpen}
        enquiryId={enquiry.id}
        enquiryTitle={enquiry.title || "Untitled enquiry"}
        ownerUid={enquiry.ownerUid}
        alreadySharedUids={alreadySharedUids}
        onClose={() => setShareOpen(false)}
        onShared={() => {
          setShareOpen(false);
          void load();
        }}
      />

      {/* Reject share reason dialog*/}
      <ReasonDialog
        open={rejectShareId !== null}
        title="Reject this shared review"
        message="Your rejection note explains what needs work. The owner sees it on their enquiry — they can re-share once the issues are addressed."
        reasonLabel="Rejection note (≥5 chars, required)"
        reasonPlaceholder="e.g. Financial summary needs QS sign-off before this can proceed"
        confirmLabel="Reject"
        variant="danger"
        loading={rejecting}
        onConfirm={handleRejectShareConfirm}
        onCancel={() => setRejectShareId(null)}
      />
    </motion.div>
  );
}
