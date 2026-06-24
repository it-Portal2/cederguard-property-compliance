import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router";
import { motion } from "motion/react";
import {
  FileText,
  FolderGit2,
  AlertTriangle,
  CalendarClock,
  ArrowRight,
} from "lucide-react";
import { api } from "../../../lib/api";
import { useStore } from "../../../store/useStore";
import { isDemoActive } from "../../../lib/demoMode";
import { buildDemoGovernance } from "../../../lib/demoData";

/**
 * Governance status on the main Dashboard, scope-aware.
 *
 * Governance reports are WORKSPACE-wide (no programme/project link); Project
 * Governance Docs are project-scoped. So:
 *  - portfolio → workspace report-status summary (+ overdue + next board)
 *  - programme → workspace report summary (labelled council-wide) + a roll-up of
 *                the programme's child-project docs
 *  - project   → that project's governance docs
 *
 * Self-contained: fetches its own data (no store loaders touched), keyed on the
 * active scope, with a stale-guard. Mounted only for governance-enabled users.
 */

const eyebrow =
  "font-mono uppercase tracking-wide text-[11px] font-medium text-slate-500";

type AnyRow = Record<string, any>;
const live = (rows: AnyRow[] | undefined): AnyRow[] =>
  (rows || []).filter((r) => !r?.softDeleted);

interface ReportSummary {
  draft: number;
  inReview: number;
  amendments: number;
  approved: number;
  sealed: number;
  overdue: number;
  nextBoard: { date: string; label: string } | null;
}

interface DocSummary {
  draft: number;
  published: number;
  archived: number;
  latest: { title: string; updatedAt: string } | null;
}

const parseTime = (s: any): number => {
  if (!s || typeof s !== "string") return NaN;
  const t = new Date(s).getTime();
  return Number.isNaN(t) ? NaN : t;
};

/** Pure: bucket reports by status, count overdue, find the next board. */
export function summariseReports(
  reports: AnyRow[],
  meetings: AnyRow[],
  now: Date,
): ReportSummary {
  const r = live(reports);
  const m = live(meetings);
  const meetingDate = new Map<string, string>();
  for (const mt of m) if (mt.id || mt._id) meetingDate.set(mt.id ?? mt._id, mt.date);

  const s: ReportSummary = {
    draft: 0,
    inReview: 0,
    amendments: 0,
    approved: 0,
    sealed: 0,
    overdue: 0,
    nextBoard: null,
  };
  const nowT = now.getTime();
  const ACTIVE_OUT = new Set(["Sealed", "Approved", "Withdrawn", "Abandoned"]);

  for (const rep of r) {
    switch (rep.status) {
      case "Draft":
        s.draft += 1;
        break;
      case "PendingSeniorPmReview":
      case "InReview":
        s.inReview += 1;
        break;
      case "AmendmentsRequested":
        s.amendments += 1;
        break;
      case "Approved":
        s.approved += 1;
        break;
      case "Sealed":
        s.sealed += 1;
        break;
      default:
        break; // Withdrawn / Abandoned excluded
    }
    if (!ACTIVE_OUT.has(rep.status)) {
      const due =
        parseTime(rep.targetBoardDate) ||
        (rep.targetMeetingId ? parseTime(meetingDate.get(rep.targetMeetingId)) : NaN);
      if (!Number.isNaN(due) && due < nowT) s.overdue += 1;
    }
  }

  // Next board: soonest scheduled (not held/cancelled) meeting at/after now.
  let best: { date: string; label: string; t: number } | null = null;
  for (const mt of m) {
    if (mt.status === "Held" || mt.status === "Cancelled") continue;
    const t = parseTime(mt.date);
    if (Number.isNaN(t) || t < nowT) continue;
    if (!best || t < best.t)
      best = { date: mt.date, label: mt.governanceBodyLabel ?? "Board", t };
  }
  s.nextBoard = best ? { date: best.date, label: best.label } : null;
  return s;
}

/** Pure: count project docs by status + find the latest by updatedAt. */
export function summariseDocs(docs: AnyRow[]): DocSummary {
  const d = live(docs);
  const out: DocSummary = { draft: 0, published: 0, archived: 0, latest: null };
  let latestT = -Infinity;
  for (const doc of d) {
    if (doc.status === "Draft") out.draft += 1;
    else if (doc.status === "Published") out.published += 1;
    else if (doc.status === "Archived") out.archived += 1;
    const t = parseTime(doc.updatedAt);
    if (!Number.isNaN(t) && t > latestT) {
      latestT = t;
      out.latest = { title: doc.title ?? "Untitled", updatedAt: doc.updatedAt };
    }
  }
  return out;
}

const fmtDate = (s: string) => {
  const t = parseTime(s);
  return Number.isNaN(t)
    ? "—"
    : new Date(t).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
};

// ── Presentational primitives ───────────────────────────────────────────────

interface Segment {
  label: string;
  value: number;
  color: string;
}

/** Segmented stacked bar (proportional) + dot legend with counts. */
function PipelineBar({ segments }: { segments: Segment[] }) {
  const total = segments.reduce((a, s) => a + s.value, 0);
  return (
    <div className="space-y-2.5">
      <div className="flex h-2.5 w-full gap-px overflow-hidden rounded-full bg-slate-100">
        {total > 0 &&
          segments.map((s) =>
            s.value > 0 ? (
              <div
                key={s.label}
                title={`${s.label}: ${s.value}`}
                style={{ width: `${(s.value / total) * 100}%`, backgroundColor: s.color }}
                className="h-full first:rounded-l-full last:rounded-r-full"
              />
            ) : null,
          )}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1.5">
        {segments.map((s) => (
          <span
            key={s.label}
            className="inline-flex items-center gap-1.5 text-[12px] text-slate-600"
          >
            <span
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: s.color }}
            />
            {s.label}
            <span className="font-mono tabular-nums font-semibold text-slate-800">
              {s.value}
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}

function Hero({ value, label }: { value: number; label: string }) {
  return (
    <div className="min-w-0">
      <div className="text-[2rem] font-semibold leading-none tabular-nums text-slate-900">
        {value}
      </div>
      <div className="mt-1 text-[12px] text-slate-500">{label}</div>
    </div>
  );
}

function OverdueStat({ n }: { n: number }) {
  const bad = n > 0;
  return (
    <div className={`rounded-lg px-3 py-1.5 text-center ${bad ? "bg-red-50" : "bg-slate-50"}`}>
      <div
        className={`text-lg font-semibold leading-none tabular-nums ${
          bad ? "text-red-600" : "text-slate-400"
        }`}
      >
        {n}
      </div>
      <div
        className={`mt-1 inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-wide ${
          bad ? "text-red-500" : "text-slate-400"
        }`}
      >
        <AlertTriangle className="h-3 w-3" /> Overdue
      </div>
    </div>
  );
}

function NextBoardStat({ nb }: { nb: ReportSummary["nextBoard"] }) {
  return (
    <div className="rounded-lg bg-slate-50 px-3 py-1.5">
      <div className="text-[13px] font-semibold leading-none text-slate-700 tabular-nums">
        {nb ? fmtDate(nb.date) : "—"}
      </div>
      <div className="mt-1 inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-wide text-slate-400">
        <CalendarClock className="h-3 w-3" /> {nb ? nb.label : "No board"}
      </div>
    </div>
  );
}

const REPORT_COLORS = {
  draft: "#94a3b8", // slate-400
  inReview: "#0ea5e9", // sky-500
  amendments: "#f59e0b", // amber-500
  approved: "#6366f1", // indigo-500
  sealed: "#10b981", // emerald-500
};

function ReportBlock({ s }: { s: ReportSummary }) {
  const total = s.draft + s.inReview + s.amendments + s.approved + s.sealed;
  if (total === 0)
    return <p className="text-[13px] text-slate-400">No reports in the pipeline yet.</p>;
  const segments: Segment[] = [
    { label: "Draft", value: s.draft, color: REPORT_COLORS.draft },
    { label: "In review", value: s.inReview, color: REPORT_COLORS.inReview },
    { label: "Amendments", value: s.amendments, color: REPORT_COLORS.amendments },
    { label: "Approved", value: s.approved, color: REPORT_COLORS.approved },
    { label: "Sealed", value: s.sealed, color: REPORT_COLORS.sealed },
  ];
  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <Hero value={total} label={total === 1 ? "report" : "reports"} />
        <div className="flex items-stretch gap-2">
          <OverdueStat n={s.overdue} />
          <NextBoardStat nb={s.nextBoard} />
        </div>
      </div>
      <PipelineBar segments={segments} />
    </div>
  );
}

const DOC_COLORS = {
  draft: "#94a3b8", // slate-400
  published: "#10b981", // emerald-500
  archived: "#cbd5e1", // slate-300
};

function DocBlock({ d }: { d: DocSummary }) {
  const total = d.draft + d.published + d.archived;
  if (total === 0)
    return <p className="text-[13px] text-slate-400">No documents yet.</p>;
  const segments: Segment[] = [
    { label: "Draft", value: d.draft, color: DOC_COLORS.draft },
    { label: "Published", value: d.published, color: DOC_COLORS.published },
    { label: "Archived", value: d.archived, color: DOC_COLORS.archived },
  ];
  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <Hero value={total} label={total === 1 ? "document" : "documents"} />
        {d.latest && (
          <div className="max-w-[55%] text-right">
            <div className={eyebrow}>Latest</div>
            <div className="truncate text-[13px] text-slate-700">{d.latest.title}</div>
            <div className="text-[11px] tabular-nums text-slate-400">
              {fmtDate(d.latest.updatedAt)}
            </div>
          </div>
        )}
      </div>
      <PipelineBar segments={segments} />
    </div>
  );
}

function LoadingState() {
  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="h-9 w-16 animate-pulse rounded bg-slate-100" />
        <div className="h-9 w-40 animate-pulse rounded bg-slate-50" />
      </div>
      <div className="h-2.5 w-full animate-pulse rounded-full bg-slate-100" />
      <div className="h-3 w-2/3 animate-pulse rounded bg-slate-50" />
    </div>
  );
}

// ── Component ────────────────────────────────────────────────────────────────

export default function DashboardGovernanceCard() {
  const activeProjectId = useStore((s) => s.activeProjectId);
  const activeProgrammeId = useStore((s) => s.activeProgrammeId);
  const projects = useStore((s) => s.projects);

  const scope: "project" | "programme" | "portfolio" = activeProjectId
    ? "project"
    : activeProgrammeId
      ? "programme"
      : "portfolio";

  const childProjectIds = useMemo(
    () =>
      scope === "programme"
        ? projects.filter((p) => p.programmeId === activeProgrammeId).map((p) => p.id)
        : [],
    [scope, projects, activeProgrammeId],
  );
  const childKey = childProjectIds.join(",");

  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [reportSummary, setReportSummary] = useState<ReportSummary | null>(null);
  const [docSummary, setDocSummary] = useState<DocSummary | null>(null);

  const versionRef = useRef(0);

  useEffect(() => {
    const v = ++versionRef.current;
    const stale = () => v !== versionRef.current;
    setLoading(true);
    setFailed(false);

    (async () => {
      try {
        const now = new Date();

        // Demo mode is client-only (no DB): the card fetches its own data, so
        // it can't read the store bundle — use the governance demo fixtures.
        if (isDemoActive()) {
          const g = buildDemoGovernance();
          if (scope === "project") {
            setReportSummary(null);
            setDocSummary(
              summariseDocs(g.projectDocs.filter((d) => d.projectId === activeProjectId)),
            );
          } else if (scope === "programme") {
            setReportSummary(summariseReports(g.reports, g.meetings, now));
            setDocSummary(
              summariseDocs(g.projectDocs.filter((d) => childProjectIds.includes(d.projectId))),
            );
          } else {
            setReportSummary(summariseReports(g.reports, g.meetings, now));
            setDocSummary(null);
          }
          setLoading(false);
          return;
        }

        if (scope === "project") {
          const res = await api.governanceListProjectDocs(activeProjectId!);
          if (stale()) return;
          setReportSummary(null);
          setDocSummary(summariseDocs(res?.success ? res.items : []));
        } else if (scope === "programme") {
          const [reportsRes, meetingsRes, ...docResults] = await Promise.all([
            api.governanceListReports(),
            api.governanceListMeetings(),
            ...childProjectIds.map((id) => api.governanceListProjectDocs(id)),
          ]);
          if (stale()) return;
          setReportSummary(
            summariseReports(
              reportsRes?.success ? reportsRes.items : [],
              meetingsRes?.success ? meetingsRes.items : [],
              now,
            ),
          );
          const allDocs = docResults.flatMap((r: any) => (r?.success ? r.items : []));
          setDocSummary(summariseDocs(allDocs));
        } else {
          const [reportsRes, meetingsRes] = await Promise.all([
            api.governanceListReports(),
            api.governanceListMeetings(),
          ]);
          if (stale()) return;
          setReportSummary(
            summariseReports(
              reportsRes?.success ? reportsRes.items : [],
              meetingsRes?.success ? meetingsRes.items : [],
              now,
            ),
          );
          setDocSummary(null);
        }
        if (!stale()) setLoading(false);
      } catch {
        if (!stale()) {
          setFailed(true);
          setLoading(false);
        }
      }
    })();
  }, [scope, activeProjectId, activeProgrammeId, childKey]);

  // Hide entirely on failure (e.g. tenant without governance access).
  if (failed) return null;

  const title =
    scope === "project"
      ? "Governance · project documents"
      : scope === "programme"
        ? "Governance"
        : "Governance · reports";

  const link =
    scope === "project" ? "/governance/project-docs" : "/governance/reports-list";

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.2, 0.65, 0.3, 0.9] }}
      className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5"
    >
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="inline-flex items-center gap-2.5">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
            {scope === "project" ? (
              <FolderGit2 className="h-4 w-4" />
            ) : (
              <FileText className="h-4 w-4" />
            )}
          </span>
          <div>
            <div className={eyebrow}>Governance status</div>
            <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
          </div>
        </div>
        <Link
          to={link}
          className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[12px] font-medium text-indigo-600 hover:bg-indigo-50"
        >
          View <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      {loading ? (
        <LoadingState />
      ) : scope === "programme" ? (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <div>
            <div className={`${eyebrow} mb-3`}>Council governance · reports</div>
            {reportSummary && <ReportBlock s={reportSummary} />}
          </div>
          <div className="border-t border-slate-100 pt-5 lg:border-l lg:border-t-0 lg:pl-5 lg:pt-0">
            <div className={`${eyebrow} mb-3`}>Project documents · this programme</div>
            {childProjectIds.length === 0 ? (
              <p className="text-[13px] text-slate-400">
                No child projects in this programme.
              </p>
            ) : (
              docSummary && <DocBlock d={docSummary} />
            )}
          </div>
        </div>
      ) : scope === "project" ? (
        docSummary && <DocBlock d={docSummary} />
      ) : (
        reportSummary && <ReportBlock s={reportSummary} />
      )}
    </motion.div>
  );
}
