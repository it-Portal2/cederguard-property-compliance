import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router";
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

function StatusChips({ s }: { s: ReportSummary }) {
  const chips: { label: string; value: number; tone: string }[] = [
    { label: "Draft", value: s.draft, tone: "bg-slate-100 text-slate-600" },
    { label: "In review", value: s.inReview, tone: "bg-sky-100 text-sky-700" },
    { label: "Amendments", value: s.amendments, tone: "bg-amber-100 text-amber-700" },
    { label: "Approved", value: s.approved, tone: "bg-indigo-100 text-indigo-700" },
    { label: "Sealed", value: s.sealed, tone: "bg-emerald-100 text-emerald-700" },
  ];
  return (
    <div className="flex flex-wrap gap-2">
      {chips.map((c) => (
        <span
          key={c.label}
          className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[12px] font-medium ${c.tone}`}
        >
          {c.label}
          <span className="font-mono tabular-nums font-semibold">{c.value}</span>
        </span>
      ))}
    </div>
  );
}

function ReportBlock({ s }: { s: ReportSummary }) {
  return (
    <div className="space-y-3">
      <StatusChips s={s} />
      <div className="flex flex-wrap items-center gap-4 text-[13px]">
        <span
          className={`inline-flex items-center gap-1.5 ${
            s.overdue > 0 ? "text-red-600" : "text-slate-400"
          }`}
        >
          <AlertTriangle className="h-3.5 w-3.5" />
          <span className="font-mono tabular-nums font-semibold">{s.overdue}</span>
          overdue
        </span>
        <span className="inline-flex items-center gap-1.5 text-slate-500">
          <CalendarClock className="h-3.5 w-3.5" />
          {s.nextBoard ? (
            <>
              Next board{" "}
              <span className="font-medium text-slate-700">{fmtDate(s.nextBoard.date)}</span>
              <span className="text-slate-400">· {s.nextBoard.label}</span>
            </>
          ) : (
            <span className="text-slate-400">No upcoming board</span>
          )}
        </span>
      </div>
    </div>
  );
}

function DocBlock({ d }: { d: DocSummary }) {
  const tiles: { label: string; value: number; tone: string }[] = [
    { label: "Draft", value: d.draft, tone: "text-slate-600" },
    { label: "Published", value: d.published, tone: "text-emerald-700" },
    { label: "Archived", value: d.archived, tone: "text-slate-400" },
  ];
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {tiles.map((t) => (
          <span
            key={t.label}
            className="inline-flex items-center gap-1.5 rounded-lg bg-slate-50 px-2.5 py-1 text-[12px] font-medium text-slate-600"
          >
            {t.label}
            <span className={`font-mono tabular-nums font-semibold ${t.tone}`}>
              {t.value}
            </span>
          </span>
        ))}
      </div>
      {d.latest ? (
        <p className="text-[12px] text-slate-400">
          Latest: <span className="text-slate-600">{d.latest.title}</span> ·{" "}
          {fmtDate(d.latest.updatedAt)}
        </p>
      ) : (
        <p className="text-[12px] text-slate-400">No documents yet.</p>
      )}
    </div>
  );
}

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
    scope === "project"
      ? "/governance/project-docs"
      : "/governance/reports-list";

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="inline-flex items-center gap-2">
          {scope === "project" ? (
            <FolderGit2 className="h-4 w-4 text-indigo-500" />
          ) : (
            <FileText className="h-4 w-4 text-indigo-500" />
          )}
          <div>
            <div className={eyebrow}>Governance status</div>
            <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
          </div>
        </div>
        <Link
          to={link}
          className="inline-flex items-center gap-1 text-[12px] font-medium text-indigo-600 hover:text-indigo-700"
        >
          View <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      {loading ? (
        <div className="space-y-3">
          <div className="h-6 w-3/4 animate-pulse rounded bg-slate-100" />
          <div className="h-4 w-1/2 animate-pulse rounded bg-slate-50" />
        </div>
      ) : scope === "project" ? (
        docSummary && <DocBlock d={docSummary} />
      ) : scope === "programme" ? (
        <div className="space-y-5">
          <div>
            <div className={`${eyebrow} mb-2`}>Council governance (reports)</div>
            {reportSummary && <ReportBlock s={reportSummary} />}
          </div>
          <div className="border-t border-slate-100 pt-4">
            <div className={`${eyebrow} mb-2`}>Project documents (this programme)</div>
            {childProjectIds.length === 0 ? (
              <p className="text-[12px] text-slate-400">
                No child projects in this programme.
              </p>
            ) : (
              docSummary && <DocBlock d={docSummary} />
            )}
          </div>
        </div>
      ) : (
        reportSummary && <ReportBlock s={reportSummary} />
      )}
    </div>
  );
}
