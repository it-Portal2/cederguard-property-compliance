import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { motion } from 'motion/react';
import {
  ArrowLeft,
  CheckCircle2,
  Circle,
  AlertCircle,
  Loader2,
  ShieldAlert,
  AlertTriangle,
  Lightbulb,
  Lock,
  Send,
  Undo2,
  Check,
  XCircle,
  FileText,
  PenLine,
  Download,
} from 'lucide-react';
import { clsx } from 'clsx';
import toast from 'react-hot-toast';
import { api } from '../../lib/api';
import { useStore } from '../../store/useStore';
import { isAtLeastClientAdmin, isStrategicDirector, isSuperAdmin } from '../../lib/roles';
import { GovernanceEditor } from '../../components/governance/editor/GovernanceEditor';
import { useGovernanceAssets } from '../../components/governance/useGovernanceAssets';
import {
  type Amendment,
  type Report,
  type ReportSection,
  STATUS_STYLES,
} from '../../components/governance/reports/types';
import { ReasonDialog } from '../../components/governance/ReasonDialog';
import ConfirmDialog from '../../components/table/ConfirmDialog';
import { RequestAmendmentsModal } from '../../components/governance/reports/RequestAmendmentsModal';
import { ReportPdfPreviewModal } from '../../components/governance/reports/ReportPdfPreviewModal';

// Threshold for "section has meaningful content". A blank Tiptap doc has
// 1 paragraph node with no text — wordCount === 0. Once an author writes
// something, wordCount > 0 and we render a green check.
function sectionStatus(s: ReportSection): 'empty' | 'in-progress' | 'complete' {
  if ((s.wordCount ?? 0) === 0) return 'empty';
  // For 6b we treat any non-zero wordCount as in-progress; 6c will add a
  // 'mark complete' control that flips this to 'complete'.
  return 'in-progress';
}

export function ReportAuthoringPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const user = useStore((s) => s.user);

  const [report, setReport] = useState<Report | null>(null);
  const [sections, setSections] = useState<ReportSection[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [amendments, setAmendments] = useState<Amendment[]>([]);
  // transition state
  const [transitionBusy, setTransitionBusy] = useState<string | null>(null);
  const [requestAmendOpen, setRequestAmendOpen] = useState(false);
  const [abandonOpen, setAbandonOpen] = useState(false);
  const [confirmApprove, setConfirmApprove] = useState(false);
  const [confirmWithdraw, setConfirmWithdraw] = useState(false);
  const [pdfOpen, setPdfOpen] = useState(false);
  const [confirmSign, setConfirmSign] = useState(false);
  // Senior PM amendment modal + Unlock dialog
  const [spmAmendOpen, setSpmAmendOpen] = useState(false);
  const [confirmSpmApprove, setConfirmSpmApprove] = useState(false);
  const [unlockOpen, setUnlockOpen] = useState(false);

  const { assets } = useGovernanceAssets();

  const isAdmin =
    isAtLeastClientAdmin(user?.role) || isSuperAdmin(user?.email, user?.role);
  const isOwner = report?.ownerUid === user?.uid;
  const isSD = isStrategicDirector(user?.role);
  // Senior-PM eligibility: only one PM role in this codebase
  // (`project_manager`); seniority comes from `pmLevel === 'senior'`. See
  // src/lib/roleConstants.ts PM_LEVELS. Same gate as the server's
  // isSeniorPmRole helper in api/routes/governanceReports.ts.
  const isSeniorPm =
    user?.role === 'project_manager' && user?.pmLevel === 'senior';
  const status = report?.status ?? 'Draft';
  const canEdit = (isAdmin || isOwner) && status === 'Draft';
  // Sign Part A available to Strategic Director OR admin (admin override
  // covered server-side too) when the report is Approved.
  const canSignPartA = (isSD || isAdmin) && status === 'Approved';
  // Senior PM stage actions — reviewer cannot be the author.
  const canSeniorPmAct =
    (isSeniorPm || isAdmin) &&
    status === 'PendingSeniorPmReview' &&
    !isOwner;
  // Unlock-for-correction — PgM (admin) or super-admin only, Sealed only.
  const canUnlock = isAdmin && status === 'Sealed';

  // Withdraw window: 1h after submittedAt, AND the reviewer for the
  // current stage hasn't viewed yet. Mirror the server's gate so the
  // button disables before the user clicks. Withdraw applies to both
  // InReview AND PendingSeniorPmReview stages ( — same action
  // covers multiple states with stage-aware checks).
  const canWithdraw = useMemo(() => {
    if (status !== 'InReview' && status !== 'PendingSeniorPmReview') return false;
    if (!isOwner && !isAdmin) return false;
    if (isAdmin) return true; // admin override
    if (!report?.submittedAt) return false;
    const submittedMs = new Date(report.submittedAt).getTime();
    if (Date.now() - submittedMs > 60 * 60 * 1000) return false;
    if (status === 'InReview' && report.firstViewedByPgmAt) return false;
    if (status === 'PendingSeniorPmReview' && report.firstViewedBySpmAt) return false;
    return true;
  }, [status, report, isOwner, isAdmin]);

  const openAmendments = useMemo(
    () => amendments.filter((a) => a.status !== 'resolved'),
    [amendments],
  );
  const allAmendmentsResolved =
    amendments.length > 0 && openAmendments.length === 0;

  const refresh = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setErrorMessage(null);
    try {
      const [reportRes, sectionsRes, amendmentsRes] = await Promise.all([
        api.governanceGetReport(id),
        api.governanceListReportSections(id),
        api.governanceListAmendments(id),
      ]);
      if (!reportRes?.success) {
        throw new Error(reportRes?.error ?? 'Failed to load report.');
      }
      if (!sectionsRes?.success) {
        throw new Error(sectionsRes?.error ?? 'Failed to load sections.');
      }
      setReport(reportRes.item as Report);
      const ordered = ((sectionsRes.sections ?? []) as ReportSection[]).slice().sort(
        (a, b) => (a.order ?? 0) - (b.order ?? 0),
      );
      setSections(ordered);
      if (!activeId && ordered.length > 0) {
        setActiveId(ordered[0]._id);
      }
      // Amendments fetch is non-blocking — failure here doesn't break the
      // editor, just leaves the banner empty.
      if (amendmentsRes?.success) {
        setAmendments((amendmentsRes.amendments ?? []) as Amendment[]);
      }
    } catch (e: any) {
      console.error('[ReportAuthoringPage] load failed', e);
      setErrorMessage(e?.message ?? 'Failed to load report.');
    } finally {
      setLoading(false);
    }
  }, [id, activeId]);

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const activeSection = useMemo(
    () => sections.find((s) => s._id === activeId) ?? null,
    [sections, activeId],
  );

  // ── state-machine transitions ────────────────────────────────
  const runTransition = useCallback(
    async (
      key: string,
      action: () => Promise<{ success?: boolean; item?: Report; error?: string } | any>,
      successMessage: string,
    ) => {
      if (transitionBusy || !id) return;
      setTransitionBusy(key);
      try {
        const res = await action();
        if (!res?.success) throw new Error(res?.error ?? 'Action failed.');
        if (res.item) setReport(res.item as Report);
        toast.success(successMessage);
        // Refresh amendments + sections so any cascading state lines up.
        const aRes = await api.governanceListAmendments(id);
        if (aRes?.success) setAmendments((aRes.amendments ?? []) as Amendment[]);
      } catch (e: any) {
        console.error(`[ReportAuthoringPage] ${key} failed`, e);
        toast.error(e?.message ?? 'Action failed.');
      } finally {
        setTransitionBusy(null);
      }
    },
    [id, transitionBusy],
  );

  const handleSubmit = () =>
    id &&
    runTransition(
      'submit',
      () => api.governanceSubmitReport(id),
      status === 'AmendmentsRequested'
        ? 'Re-submitted to the reviewer.'
        : 'Submitted for review.',
    );

  const handleWithdraw = () =>
    id &&
    runTransition(
      'withdraw',
      () => api.governanceWithdrawReport(id),
      'Submission withdrawn — back to Draft.',
    );

  const handleApprove = () =>
    id &&
    runTransition(
      'approve',
      () => api.governanceApproveReport(id),
      'Report approved.',
    );

  const handleAbandon = (reason: string) => {
    if (!id) return Promise.resolve();
    return runTransition(
      'abandon',
      () => api.governanceAbandonReport(id, reason),
      'Report abandoned.',
    ).then(() => setAbandonOpen(false));
  };

  const handleSignPartA = () =>
    id &&
    runTransition(
      'sign',
      () => api.governanceSignPartA(id),
      'Part A signed — report sealed.',
    );

  const handleSpmApprove = () =>
    id &&
    runTransition(
      'spmApprove',
      () => api.governanceSeniorPmApprove(id),
      'Approved — passed to the Programme Manager for final review.',
    );

  const handleUnlock = (reason: string) => {
    if (!id) return Promise.resolve();
    return runTransition(
      'unlock',
      () => api.governanceUnlockReport(id, reason),
      'Report unlocked for correction. The author can now edit and re-submit.',
    ).then(() => setUnlockOpen(false));
  };

  const handleDownloadSealed = () => {
    // Sealed reports have a stable Storage URL — open in a new tab.
    if (report?.sealedPdfUrl) {
      window.open(report.sealedPdfUrl, '_blank', 'noopener,noreferrer');
    } else {
      // Fall back to a fresh render if the URL isn't on the doc for any reason.
      setPdfOpen(true);
    }
  };

  const handleResolveAmendment = async (amendmentId: string) => {
    try {
      const res = await api.governanceResolveAmendment(amendmentId);
      if (!res?.success) throw new Error(res?.error ?? 'Resolve failed.');
      setAmendments((prev) =>
        prev.map((a) =>
          a._id === amendmentId
            ? { ...a, status: 'resolved', resolvedAt: new Date().toISOString() }
            : a,
        ),
      );
    } catch (e: any) {
      console.error('[ReportAuthoringPage] resolve failed', e);
      toast.error(e?.message ?? 'Resolve failed.');
    }
  };

  // Auto-save callback wired from the editor — debounced 30s by GovernanceEditor.
  const handleAutoSave = useCallback(
    async (json: any, wordCount: number) => {
      if (!id || !activeSection) return;
      try {
        const res = await api.governanceSaveReportSection(id, activeSection._id, {
          content: json,
          wordCount,
        });
        if (!res?.success) throw new Error(res?.error ?? 'Save failed.');
        // Update local state with the fresh section so the TOC status dot
        // refreshes without a full refetch.
        setSections((prev) =>
          prev.map((s) =>
            s._id === activeSection._id
              ? ({ ...s, content: json, wordCount, lastEditedAt: new Date().toISOString() })
              : s,
          ),
        );
      } catch (e: any) {
        // Re-throw so GovernanceEditor's auto-save status reflects the failure.
        throw new Error(e?.message ?? 'Save failed.');
      }
    },
    [id, activeSection],
  );

  if (loading && !report) {
    return (
      <div className="flex h-full min-h-[60vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
      </div>
    );
  }

  if (errorMessage) {
    return (
      <div className="mx-auto max-w-2xl py-12">
        <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <div className="flex-1">
            <p className="font-semibold">Couldn't load this report</p>
            <p className="mt-0.5 text-xs">{errorMessage}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => navigate('/governance/reports-list')}
          className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-700 hover:text-indigo-900"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to reports
        </button>
      </div>
    );
  }

  if (!report) return null;
  const statusStyle = STATUS_STYLES[report.status];

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      className="mx-auto flex h-full max-w-7xl flex-col gap-4"
    >
      {/* Header */}
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <button
            type="button"
            onClick={() => navigate('/governance/reports-list')}
            className="mt-1 inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition-colors hover:bg-slate-50"
            aria-label="Back to reports"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">
              Programme Governance · Report
            </p>
            <h1 className="truncate text-lg font-bold tracking-tight text-slate-900 md:text-xl">
              {report.title}
            </h1>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <span
                className={clsx(
                  'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold',
                  statusStyle.cls,
                )}
              >
                <span className={clsx('h-1.5 w-1.5 rounded-full', statusStyle.dot)} />
                {statusStyle.label}
              </span>
              {report.templateLabel && (
                <span className="text-[11px] text-slate-500">
                  · {report.templateLabel}
                </span>
              )}
              {report.isHRB && (
                <span className="inline-flex items-center gap-0.5 rounded-full border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[9px] font-semibold text-amber-700">
                  <ShieldAlert className="h-2.5 w-2.5" />
                  HRB
                </span>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Read-only / state banner */}
      {!canEdit && status === 'Draft' && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            You can read this report but not edit it. Only the owner or a
            Client Admin can author.
          </span>
        </div>
      )}
      {/* Permanent unlock-from-sealed banner. Visible on every report that
          has been unlocked at least once so FOI / scrutiny readers are
          never misled about which sealed version they are looking at. */}
      {Array.isArray(report.unlockHistory) && report.unlockHistory.length > 0 && (
        <div className="rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-xs text-rose-900">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-rose-600" />
            <div className="flex-1">
              <p className="font-semibold">
                This report has been unlocked from a sealed state{' '}
                {report.unlockHistory.length === 1
                  ? 'once'
                  : `${report.unlockHistory.length} times`}
                .
              </p>
              <ul className="mt-1 space-y-0.5 text-[10px] leading-snug text-rose-800">
                {report.unlockHistory.map((u, i) => (
                  <li key={`${u.at}-${i}`}>
                    {new Date(u.at).toLocaleString('en-GB', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}{' '}
                    — <span className="italic">"{u.reason}"</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {status === 'PendingSeniorPmReview' && (
        <div className="flex items-start gap-2 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-800">
          <Send className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            Awaiting Senior Project Manager review
            {report.submittedAt && (
              <>
                {' '}since{' '}
                <span className="font-semibold">
                  {new Date(report.submittedAt).toLocaleString('en-GB', {
                    day: 'numeric',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </>
            )}
            . Once approved here it routes to the Programme Manager for final review.
            {report.firstViewedBySpmAt && (
              <>
                {' '}
                <span className="font-semibold">
                  Senior PM has opened it — withdraw locked.
                </span>
              </>
            )}
          </span>
        </div>
      )}

      {status === 'InReview' && (
        <div className="flex items-start gap-2 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs text-indigo-800">
          <Send className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            Submitted for review
            {report.submittedAt && (
              <>
                {' '}on{' '}
                <span className="font-semibold">
                  {new Date(report.submittedAt).toLocaleString('en-GB', {
                    day: 'numeric',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </>
            )}
            . The author can still withdraw within 1 hour, until the
            Programme Manager opens it.
            {report.firstViewedByPgmAt && (
              <>
                {' '}
                <span className="font-semibold">
                  Programme Manager has now opened it — withdraw locked.
                </span>
              </>
            )}
          </span>
        </div>
      )}
      {status === 'Approved' && (
        <div className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
          <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            Approved
            {report.approvedAt && (
              <>
                {' '}on{' '}
                <span className="font-semibold">
                  {new Date(report.approvedAt).toLocaleString('en-GB', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })}
                </span>
              </>
            )}
            . Editing is locked.{' '}
            {report.isHRB &&
              'HRB project — a Golden Thread record will be written when this report is sealed.'}
          </span>
        </div>
      )}
      {(status === 'Withdrawn' || status === 'Abandoned') && (
        <div className="flex items-start gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
          <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            {statusStyle.label}.{' '}
            {report.abandonmentReason && (
              <>
                Reason:{' '}
                <span className="italic">{report.abandonmentReason}</span>
              </>
            )}
          </span>
        </div>
      )}

      {/* Amendment checklist banner — only when status is AmendmentsRequested.
          Renders ABOVE the editor so the author sees the asks immediately. */}
      {status === 'AmendmentsRequested' && amendments.length > 0 && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4">
          <div className="mb-2 flex items-start justify-between gap-3">
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" />
              <div>
                <h3 className="text-sm font-semibold text-rose-900">
                  Amendments requested ({openAmendments.length}/{amendments.length}{' '}
                  outstanding)
                </h3>
                <p className="mt-0.5 text-[11px] text-rose-700">
                  Tick each one off as you address it. When all are resolved,
                  re-submit for review.
                </p>
              </div>
            </div>
          </div>
          <ul className="space-y-1.5">
            {amendments.map((a) => {
              const sec = sections.find((s) => s.sectionId === a.sectionId);
              const resolved = a.status === 'resolved';
              return (
                <li
                  key={a._id}
                  className={clsx(
                    'flex items-start gap-2 rounded-lg border bg-white px-3 py-2',
                    resolved
                      ? 'border-emerald-200 bg-emerald-50/50'
                      : 'border-rose-200',
                  )}
                >
                  <button
                    type="button"
                    onClick={() => !resolved && handleResolveAmendment(a._id)}
                    disabled={resolved || (!isOwner && !isAdmin)}
                    className={clsx(
                      'mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors',
                      resolved
                        ? 'border-emerald-400 bg-emerald-500 text-white'
                        : 'border-slate-300 bg-white hover:border-emerald-400 hover:bg-emerald-50',
                    )}
                    aria-label={resolved ? 'Resolved' : 'Mark as resolved'}
                  >
                    {resolved && <Check className="h-3 w-3" />}
                  </button>
                  <div className="min-w-0 flex-1">
                    <p
                      className={clsx(
                        'text-xs',
                        resolved
                          ? 'text-slate-400 line-through'
                          : 'text-slate-800',
                      )}
                    >
                      {a.text}
                    </p>
                    {sec && (
                      <button
                        type="button"
                        onClick={() => setActiveId(sec._id)}
                        className="mt-0.5 inline-flex items-center gap-1 text-[10px] font-semibold text-indigo-700 hover:text-indigo-900"
                      >
                        Jump to section: {sec.order}. {sec.name}
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* 3-pane authoring */}
      <div className="grid flex-1 gap-4 lg:grid-cols-[260px_1fr_280px]">
        {/* Left: TOC */}
        <aside className="rounded-xl border border-slate-200 bg-white p-2.5">
          <p className="mb-1.5 px-1.5 text-[10px] font-semibold uppercase tracking-widest text-slate-500">
            Sections ({sections.length})
          </p>
          {sections.length === 0 ? (
            <div className="space-y-2 px-1.5 py-3 text-[11px] text-slate-500">
              <p>No sections yet.</p>
              <p>
                {report?.templateId ? (
                  <>The linked template has no sections defined.</>
                ) : (
                  <>
                    This report isn't linked to a template. Open{' '}
                    <span className="font-semibold text-slate-700">
                      Edit details
                    </span>{' '}
                    on the reports list (pencil icon) and pick a template —
                    sections will populate the next time you open this editor.
                  </>
                )}
              </p>
              <button
                type="button"
                onClick={() => navigate('/governance/reports-list')}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[10px] font-semibold text-slate-700 transition-colors hover:bg-slate-50"
              >
                <ArrowLeft className="h-3 w-3" />
                Back to reports
              </button>
            </div>
          ) : (
            <ul className="space-y-0.5">
              {sections.map((s, idx) => {
                const status = sectionStatus(s);
                const isActive = s._id === activeId;
                return (
                  <li key={s._id}>
                    <button
                      type="button"
                      onClick={() => setActiveId(s._id)}
                      className={clsx(
                        'flex w-full items-start gap-2 rounded-lg px-2 py-1.5 text-left transition-colors',
                        isActive
                          ? 'bg-indigo-50 text-indigo-900'
                          : 'hover:bg-slate-50 text-slate-700',
                      )}
                    >
                      <span className="mt-0.5 flex h-3.5 w-3.5 shrink-0 items-center justify-center">
                        {status === 'empty' && (
                          <Circle className="h-3 w-3 text-slate-300" />
                        )}
                        {status === 'in-progress' && (
                          <Circle className="h-3 w-3 fill-amber-400 text-amber-400" />
                        )}
                        {status === 'complete' && (
                          <CheckCircle2 className="h-3 w-3 fill-emerald-100 text-emerald-600" />
                        )}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[11px] font-semibold">
                          {idx + 1}. {s.name}
                        </span>
                        <span className="mt-0.5 flex items-center gap-1 text-[9px] text-slate-500">
                          {s.mandatory && (
                            <span className="inline-flex items-center rounded border border-slate-200 bg-slate-50 px-1 font-semibold uppercase tracking-wider">
                              required
                            </span>
                          )}
                          {s.statutory && (
                            <span className="inline-flex items-center rounded border border-slate-200 bg-slate-50 px-1 font-semibold uppercase tracking-wider">
                              statutory
                            </span>
                          )}
                          {s.aiDraftAllowed && (
                            <Lightbulb className="h-2.5 w-2.5 text-indigo-500" />
                          )}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </aside>

        {/* Center: editor*/}
        <main className="rounded-xl border border-slate-200 bg-white p-4">
          {!activeSection ? (
            <div className="flex h-full min-h-[40vh] flex-col items-center justify-center gap-2 text-center text-xs text-slate-500">
              {sections.length === 0 ? (
                <>
                  <span className="font-semibold text-slate-700">
                    No sections to edit yet.
                  </span>
                  <span className="max-w-md">
                    {report?.templateId
                      ? 'The linked template has no sections defined.'
                      : 'Link this report to a template via Edit details (on the reports list) — sections from the template will appear here automatically.'}
                  </span>
                </>
              ) : (
                <span>Pick a section from the TOC to start editing.</span>
              )}
            </div>
          ) : (
            <>
              <header className="mb-3 border-b border-slate-100 pb-3">
                <h2 className="text-sm font-semibold text-slate-900">
                  {activeSection.name}
                </h2>
                {activeSection.guidance && (
                  <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
                    {activeSection.guidance}
                  </p>
                )}
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[10px] text-slate-500">
                  {activeSection.mandatory && (
                    <span className="inline-flex items-center rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 font-semibold uppercase tracking-wider">
                      required
                    </span>
                  )}
                  {activeSection.statutory && (
                    <span className="inline-flex items-center rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 font-semibold uppercase tracking-wider">
                      statutory
                    </span>
                  )}
                  {activeSection.aiDraftAllowed && (
                    <span className="inline-flex items-center gap-0.5 rounded border border-indigo-200 bg-indigo-50 px-1.5 py-0.5 font-semibold uppercase tracking-wider text-indigo-700">
                      <Lightbulb className="h-2.5 w-2.5" />
                      AI draft allowed
                    </span>
                  )}
                  <span className="ml-auto tabular-nums">
                    {activeSection.wordCount ?? 0} words
                  </span>
                </div>
              </header>
              <GovernanceEditor
                key={activeSection._id}
                initialContent={activeSection.content ?? { type: 'doc', content: [{ type: 'paragraph' }] }}
                editable={canEdit}
                onAutoSave={handleAutoSave}
                placeholder={
                  activeSection.guidance
                    ? `Start drafting — ${activeSection.guidance}`
                    : 'Start drafting…'
                }
                assets={assets}
                aiContext={[report?.title, activeSection?.name]
                  .filter(Boolean)
                  .join(' — ')}
              />
            </>
          )}
        </main>

        {/* Right: side panel (minimal in 6b — full review surface in 6c)*/}
        <aside className="hidden rounded-xl border border-slate-200 bg-white p-3 lg:block">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-slate-500">
            Side panel
          </p>
          <div className="space-y-3 text-[11px] text-slate-600">
            <div>
              <p className="font-semibold text-slate-700">Reviewer</p>
              <p className="mt-0.5 text-slate-500">
                {report.reviewerLabel || (
                  <span className="italic text-slate-400">unassigned</span>
                )}
              </p>
            </div>
            <div>
              <p className="font-semibold text-slate-700">Target board date</p>
              <p className="mt-0.5 text-slate-500">
                {report.targetBoardDate
                  ? new Date(report.targetBoardDate).toLocaleDateString('en-GB', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })
                  : (
                      <span className="italic text-slate-400">not set</span>
                    )}
              </p>
            </div>
            {/* state-aware actions*/}
            <div className="border-t border-slate-100 pt-3">
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-slate-500">
                Actions
              </p>
              <div className="space-y-1.5">
                {/* Preview PDF (always available)*/}
                <button
                  type="button"
                  onClick={() => setPdfOpen(true)}
                  className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50"
                >
                  <FileText className="h-3.5 w-3.5" />
                  Preview PDF
                </button>

                {/* Sign Part A (Strategic Director / admin, Approved only)*/}
                {canSignPartA && (
                  <button
                    type="button"
                    onClick={() => setConfirmSign(true)}
                    disabled={transitionBusy === 'sign'}
                    className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-emerald-700 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {transitionBusy === 'sign' ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <PenLine className="h-3.5 w-3.5" />
                    )}
                    Sign Part A &amp; seal
                  </button>
                )}

                {/* Download sealed PDF*/}
                {status === 'Sealed' && (
                  <button
                    type="button"
                    onClick={handleDownloadSealed}
                    className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800 transition-colors hover:bg-emerald-100"
                  >
                    <Download className="h-3.5 w-3.5" />
                    Download sealed PDF
                  </button>
                )}

                {/* Unlock for correction (PgM / super-admin on Sealed)*/}
                {canUnlock && (
                  <button
                    type="button"
                    onClick={() => setUnlockOpen(true)}
                    disabled={transitionBusy === 'unlock'}
                    className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-rose-300 bg-white px-3 py-2 text-xs font-semibold text-rose-700 transition-colors hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {transitionBusy === 'unlock' ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <AlertTriangle className="h-3.5 w-3.5" />
                    )}
                    Unlock for correction
                  </button>
                )}

                {/* Senior PM review actions*/}
                {canSeniorPmAct && (
                  <>
                    <button
                      type="button"
                      onClick={() => setConfirmSpmApprove(true)}
                      disabled={transitionBusy === 'spmApprove'}
                      className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-sky-600 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {transitionBusy === 'spmApprove' ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <CheckCircle2 className="h-3.5 w-3.5" />
                      )}
                      Approve &amp; pass to PgM
                    </button>
                    <button
                      type="button"
                      onClick={() => setSpmAmendOpen(true)}
                      className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-rose-300 bg-white px-3 py-2 text-xs font-semibold text-rose-700 transition-colors hover:bg-rose-50"
                    >
                      <AlertTriangle className="h-3.5 w-3.5" />
                      Request amendments (Senior PM)
                    </button>
                  </>
                )}

                {/* Draft → Submit (owner only)*/}
                {status === 'Draft' && (isOwner || isAdmin) && (
                  <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={transitionBusy === 'submit'}
                    className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {transitionBusy === 'submit' ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Send className="h-3.5 w-3.5" />
                    )}
                    Submit for review
                  </button>
                )}

                {/* AmendmentsRequested → Resubmit*/}
                {status === 'AmendmentsRequested' && (isOwner || isAdmin) && (
                  <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={
                      transitionBusy === 'submit' || !allAmendmentsResolved
                    }
                    title={
                      !allAmendmentsResolved
                        ? 'Resolve every amendment first.'
                        : ''
                    }
                    className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {transitionBusy === 'submit' ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Send className="h-3.5 w-3.5" />
                    )}
                    Re-submit for review
                  </button>
                )}

                {/* InReview → Withdraw (owner, within 1h, PgM not viewed)*/}
                {status === 'InReview' && (isOwner || isAdmin) && (
                  <button
                    type="button"
                    onClick={() => setConfirmWithdraw(true)}
                    disabled={transitionBusy === 'withdraw' || !canWithdraw}
                    title={
                      !canWithdraw
                        ? report.firstViewedByPgmAt
                          ? 'Withdraw locked — Programme Manager has opened this report.'
                          : 'Withdraw window expired (1 hour after submission).'
                        : ''
                    }
                    className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {transitionBusy === 'withdraw' ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Undo2 className="h-3.5 w-3.5" />
                    )}
                    Withdraw submission
                  </button>
                )}

                {/* InReview → Approve / Request amendments (PgM/admin)*/}
                {status === 'InReview' && isAdmin && (
                  <>
                    <button
                      type="button"
                      onClick={() => setConfirmApprove(true)}
                      disabled={transitionBusy === 'approve'}
                      className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {transitionBusy === 'approve' ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <CheckCircle2 className="h-3.5 w-3.5" />
                      )}
                      Approve
                    </button>
                    <button
                      type="button"
                      onClick={() => setRequestAmendOpen(true)}
                      className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-rose-300 bg-white px-3 py-2 text-xs font-semibold text-rose-700 transition-colors hover:bg-rose-50"
                    >
                      <AlertTriangle className="h-3.5 w-3.5" />
                      Request amendments
                    </button>
                  </>
                )}

                {/* Abandon — owner or admin, any non-final state*/}
                {(isOwner || isAdmin) &&
                  status !== 'Approved' &&
                  status !== 'Sealed' &&
                  status !== 'Abandoned' &&
                  status !== 'Withdrawn' && (
                    <button
                      type="button"
                      onClick={() => setAbandonOpen(true)}
                      disabled={transitionBusy === 'abandon'}
                      className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 transition-colors hover:bg-rose-50 hover:text-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <XCircle className="h-3.5 w-3.5" />
                      Abandon report
                    </button>
                  )}

                {/* Final-state notice — no actions*/}
                {(status === 'Approved' ||
                  status === 'Sealed' ||
                  status === 'Abandoned' ||
                  status === 'Withdrawn') && (
                  <p className="rounded-lg bg-slate-50 px-2 py-1.5 text-[10px] italic text-slate-500">
                    No further actions available in {statusStyle.label}.
                  </p>
                )}
              </div>
            </div>
          </div>
        </aside>
      </div>

      {/* Modals + dialogs*/}
      <RequestAmendmentsModal
        isOpen={requestAmendOpen}
        reportId={report.id}
        reportTitle={report.title}
        sections={sections}
        onClose={() => setRequestAmendOpen(false)}
        onCommitted={() => {
          setRequestAmendOpen(false);
          void refresh();
        }}
      />

      <ConfirmDialog
        open={confirmApprove}
        title={`Approve "${report.title}"?`}
        message={
          report.isHRB
            ? 'HRB project — a Golden Thread record will be written when this report is sealed.'
            : 'The author will be notified and the report locks for editing.'
        }
        confirmLabel="Approve"
        variant="success"
        loading={transitionBusy === 'approve'}
        onConfirm={() => {
          setConfirmApprove(false);
          void handleApprove();
        }}
        onCancel={() => setConfirmApprove(false)}
      />

      <ConfirmDialog
        open={confirmWithdraw}
        title="Withdraw submission?"
        message="The report goes back to Draft. You can edit again and re-submit when ready."
        confirmLabel="Withdraw"
        variant="warning"
        loading={transitionBusy === 'withdraw'}
        onConfirm={() => {
          setConfirmWithdraw(false);
          void handleWithdraw();
        }}
        onCancel={() => setConfirmWithdraw(false)}
      />

      <ReasonDialog
        open={abandonOpen}
        title={`Abandon "${report.title}"?`}
        message="The report stays in the audit log but is closed for further work. Provide a reason."
        reasonLabel="Reason for abandonment"
        reasonPlaceholder="e.g. Decision deferred indefinitely; superseded by a new paper."
        confirmLabel="Abandon report"
        variant="danger"
        loading={transitionBusy === 'abandon'}
        onConfirm={(reason) => void handleAbandon(reason)}
        onCancel={() => (transitionBusy ? null : setAbandonOpen(false))}
      />

      <ReportPdfPreviewModal
        isOpen={pdfOpen}
        reportId={report.id}
        reportTitle={report.title}
        title={status === 'Sealed' ? 'Sealed PDF' : 'Preview PDF'}
        onClose={() => setPdfOpen(false)}
      />

      <ConfirmDialog
        open={confirmSign}
        title="Sign Part A and seal this report?"
        message={
          report.isHRB
            ? 'Your signature will be inserted into Part A and the report will be sealed. A Golden Thread record will be written for this HRB project. This cannot be undone.'
            : 'Your signature will be inserted into Part A and the report will be sealed. This cannot be undone.'
        }
        confirmLabel="Sign and seal"
        variant="success"
        loading={transitionBusy === 'sign'}
        onConfirm={() => {
          setConfirmSign(false);
          void handleSignPartA();
        }}
        onCancel={() => setConfirmSign(false)}
      />

      {/* Senior PM amendment modal (reuses RequestAmendmentsModal
 with the seniorPm stage flag so the server tags the audit trail).*/}
      <RequestAmendmentsModal
        isOpen={spmAmendOpen}
        reportId={report.id}
        reportTitle={report.title}
        sections={sections}
        stage="seniorPm"
        onClose={() => setSpmAmendOpen(false)}
        onCommitted={() => {
          setSpmAmendOpen(false);
          void refresh();
        }}
      />

      <ConfirmDialog
        open={confirmSpmApprove}
        title="Approve and pass to Programme Manager?"
        message="Your Senior PM approval will be logged. The Programme Manager takes over the next review stage."
        confirmLabel="Approve"
        variant="success"
        loading={transitionBusy === 'spmApprove'}
        onConfirm={() => {
          setConfirmSpmApprove(false);
          void handleSpmApprove();
        }}
        onCancel={() => setConfirmSpmApprove(false)}
      />

      <ReasonDialog
        open={unlockOpen}
        title="Unlock this sealed report for correction?"
        message="The report goes back to Draft so the author can edit and re-submit through the full chain. This is logged as a high-priority audit event and a permanent banner stays on the report. Use only when there's a real reason — typo, wrong figure, FOI clarification, etc."
        reasonLabel="Reason for unlock (visible in audit + on the report banner)"
        reasonPlaceholder="e.g. Decision figure on para 14 was £2.4m, should be £2.04m. Author to correct + re-sign."
        confirmLabel="Unlock for correction"
        variant="danger"
        loading={transitionBusy === 'unlock'}
        onConfirm={(reason) => void handleUnlock(reason)}
        onCancel={() => (transitionBusy ? null : setUnlockOpen(false))}
      />
    </motion.div>
  );
}
