import React, { useState, useEffect, useMemo } from "react";
import { useStore, RiskItem } from "../store/useStore";
import {
  isAtLeastPM,
  isAtLeastClientAdmin,
  isSuperAdmin,
  UserRole,
} from "../lib/roles";
import { RISK_STATUSES } from "../data/riskData";
import {
  STRATEGIC_CATEGORY_NAMES,
  OPERATIONAL_CATEGORY_NAMES,
  STRATEGIC_WORKSTREAMS,
  OPERATIONAL_WORKSTREAMS,
} from "../data/riskTaxonomy";
import { clsx } from "clsx";
import { stripMarkdown, generateId } from "../lib/utils";
import { format, differenceInDays } from "date-fns";
import { Link, useNavigate, useSearchParams } from "react-router";
import {
  Trash2,
  Edit2,
  ShieldOff,
  AlertCircle,
  AlertTriangle,
  Flag,
  FlagOff,
  ArrowLeft,
  Plus,
  Shield,
  Flame,
  PoundSterling,
} from "lucide-react";
import { RiskModal } from "../components/RiskModal";
import { ServiceManagementBar } from "../components/ServiceManagementBar";
import { StatsCard } from "../components/common/StatsCard";

import toast from "react-hot-toast";
import DynamicTable from "../components/table/DynamicTable";
import type { ColumnDef, RowAction, BulkAction, FilterDef } from "../components/table/types";
import { useHistoricalView } from "../hooks/useHistoricalView";
import { MonthPicker } from "../components/historicalReporting/MonthPicker";
import { HistoricalBanner } from "../components/historicalReporting/HistoricalBanner";
import {
  BAND_STYLES,
  bandForScore,
  bandLabelForScore,
  formatRatingDisplay,
  SEVERE_SCORE_THRESHOLD,
} from "../data/riskScoringMatrix";

// Score-to-pill helpers using the 5-band scheme:
// Insignificant 1-3 · Minor 4-6 · Moderate 7-11 · Major 12-18 · Severe 19-25.

function rsScore(score: number) {
  const band = bandForScore(score);
  const base = BAND_STYLES[band].pill;
  // Severe band keeps the original page's "pulse" emphasis so the most
  // critical scores remain visually loud at a glance.
  return band === "severe" ? `${base} shadow-sm animate-pulse` : `${base} shadow-sm`;
}

function rLabel(s: number) {
  const band = bandForScore(s);
  return {
    l: BAND_STYLES[band].label,
    c: BAND_STYLES[band].pill,
  };
}

function fGBP(v?: number) {
  if (v === null || v === undefined || isNaN(v) || v === 0) return "—";
  return "£" + Number(v).toLocaleString("en-GB", { maximumFractionDigits: 0 });
}

function fDate(d?: string) {
  if (!d) return "—";
  try {
    return format(new Date(d), "dd MMM yy");
  } catch {
    return d;
  }
}

function ageCalc(dateAdded?: string, status?: string) {
  if (!dateAdded || status === "Closed") return "—";
  try {
    return differenceInDays(new Date(), new Date(dateAdded)) + "d";
  } catch {
    return "—";
  }
}

function probDisplay(prob?: number): string {
  if (!prob && prob !== 0) return "—";
  if (prob === 0) return "—";
  const pct = prob > 1 ? prob : prob * 100;
  return Math.round(pct) + "%";
}

function StatusBadge({ status }: { status: string }) {
  const cls =
    status === "Open"
      ? "bg-red-50 text-red-600 border-red-200"
      : status === "Closed"
        ? "bg-emerald-50 text-emerald-600 border-emerald-200"
        : status === "Mitigated"
          ? "bg-blue-50 text-blue-600 border-blue-200"
          : status === "Tolerated"
            ? "bg-amber-50 text-amber-600 border-amber-200"
            : "bg-slate-100 text-slate-600 border-slate-200";
  return (
    <span className={clsx("px-2 py-0.5 rounded text-[10px] font-bold border", cls)}>
      {status}
    </span>
  );
}

// ── Risk Register ─────────────────────────────────────────────────────────────

export function RiskRegister() {
  const {
    risks,
    updateRisk,
    deleteRisk,
    addRisk,
    addIssue,
    projects,
    programmes,
    activeProjectId,
    setActiveProject,
    activeProgrammeId,
    user,
    addNotification,
    updateProject,
    updateProgramme,
    isInitialized,
    pendingMutations,
    loadProjectData,
    loadProgrammeData,
  } = useStore();

  // Row is "busy" when any mutation targeting this risk id is in flight.
  // Action buttons disable and the row dims while true.
  const isRowPending = (id: string) => pendingMutations.has(`risk:${id}`);
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const urlProjectId = searchParams.get("projectId");

  // Sync URL param to store — unchanged
  useEffect(() => {
    if (urlProjectId && urlProjectId !== activeProjectId) {
      setActiveProject(urlProjectId);
    }
  }, [urlProjectId, activeProjectId, setActiveProject]);

  const fromInitiation = searchParams.get("from") === "initiation";
  const userRole = (user?.role || user?.profile?.role) as UserRole | undefined;
  const userIsSuperAdmin = isSuperAdmin(user?.email, userRole);
  const isPM = !isAtLeastClientAdmin(userRole) && !userIsSuperAdmin;

  //  historical view hook. When the user picks a past month
  // via the MonthPicker, the page swaps live `risks` for the snapshot
  // (LegacyArraySnapshot — one entry per project containing a frozen
  // risk array) and disables every edit affordance.
  const historicalView = useHistoricalView<{
    kind: "legacyArray";
    projectId: string;
    array: RiskItem[];
  }>({ collection: "risks" });
  const isHistorical = historicalView.isHistorical;

  const userCanModify = isAtLeastPM(userRole) || userIsSuperAdmin;
  const userCanDelete = isAtLeastPM(userRole) || userIsSuperAdmin;
  const canModify = userCanModify && !isHistorical;
  const canDelete = userCanDelete && !isHistorical;
  const progLevelLabel = isPM ? "Shared Portfolio" : "Programme Level";

  const scopedProjects = activeProgrammeId
    ? (Array.isArray(projects) ? projects : []).filter(
        (p) => p.programmeId === activeProgrammeId,
      )
    : Array.isArray(projects)
      ? projects
      : [];

  // Source-project dropdown filter (programme-level only) — unchanged logic
  const [projectFilter, setProjectFilter] = useState("");

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRisk, setEditingRisk] = useState<RiskItem | null>(null);

  // Reset project filter when context changes — same as original selectedIds reset
  useEffect(() => {
    setProjectFilter("");
  }, [activeProjectId, activeProgrammeId]);

  // Handle URL-based actions — unchanged
  useEffect(() => {
    let changed = false;
    const newParams = new URLSearchParams(searchParams);
    const action = searchParams.get("action");
    if (action === "add-risk") {
      setEditingRisk(null);
      setIsModalOpen(true);
      newParams.delete("action");
      changed = true;
    }
    const filterKri = searchParams.get("kri");
    if (filterKri) {
      newParams.delete("kri");
      changed = true;
    }
    if (changed) {
      setSearchParams(newParams, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  //  effective risks source. Historical mode flattens the
  // snapshot's per-project arrays into one big risk list so the existing
  // context-scoping + filter + sort logic below runs unchanged.
  const historicalRisks = useMemo<RiskItem[]>(() => {
    if (!isHistorical) return [];
    const out: RiskItem[] = [];
    for (const entry of historicalView.entries) {
      const arr = (entry?.array ?? []) as RiskItem[];
      for (const r of arr) {
        // Snapshot may not carry projectId on the row itself for legacy
        // shapes; preserve from the entry as a safety net.
        out.push({ ...r, projectId: r.projectId ?? entry?.projectId } as RiskItem);
      }
    }
    return out;
  }, [isHistorical, historicalView.entries]);
  const effectiveRisks = isHistorical
    ? historicalRisks
    : Array.isArray(risks)
      ? risks
      : [];

  // Context-scoped data: project/programme scoping + projectFilter + sort — unchanged logic
  const contextScoped = useMemo(() => {
    return effectiveRisks
      .filter((r) => {
        if (activeProjectId) {
          if (r.projectId !== activeProjectId) return false;
        } else if (activeProgrammeId) {
          if (r.programmeId !== activeProgrammeId) {
            const rProject = (Array.isArray(projects) ? projects : []).find(
              (p) => p.id === r.projectId,
            );
            if (!rProject || rProject.programmeId !== activeProgrammeId)
              return false;
          }
        }
        if (!activeProjectId && projectFilter) {
          if (projectFilter === progLevelLabel) {
            if (r.projectId) return false;
          } else {
            if (r.projectId !== projectFilter) return false;
          }
        }
        return true;
      })
      .sort((a, b) => {
        const dateA = a.dateAdded ? new Date(a.dateAdded).getTime() : 0;
        const dateB = b.dateAdded ? new Date(b.dateAdded).getTime() : 0;
        if (dateB !== dateA) return dateB - dateA;
        return (b.id || "").localeCompare(a.id || "");
      });
  }, [effectiveRisks, activeProjectId, activeProgrammeId, projects, projectFilter, progLevelLabel]);

  // Action handlers — pessimistic: await the store call, return the promise so
  // ConfirmDialog (inside DynamicTable) can hold open with a spinner until the
  // server ACKs. Toast fires on success; error bubbles so DynamicTable also
  // catches and shows.
  const doEscalate = async (r: RiskItem) => {
    if (!canModify) return;
    const escalating = !r.escalated;
    try {
      await updateRisk(r.id, { escalated: escalating, isNew: false });
      toast.success(
        escalating
          ? `Risk "${r.title}" escalated to programme`
          : `Risk "${r.title}" de-escalated`,
      );
      if (escalating) {
        const proj = projects.find((p) => p.id === r.projectId);
        const prog = programmes.find(
          (p) => p.id === (r.programmeId || proj?.programmeId),
        );
        addNotification({
          title: "Risk Escalated to Programme",
          body: `Risk ${r.id} ("${r.title}") has been escalated from project "${proj?.name || "Unknown"}" to programme "${prog?.name || "General"}".`,
          type: "risk",
          projectId: proj?.id,
          programmeId: prog?.id,
        });
      }
    } catch (err: any) {
      toast.error(err?.message || "Failed to update escalation status.");
      throw err;
    }
  };

  const doConvertToIssue = async (r: RiskItem) => {
    if (!canModify) return;
    try {
      await useStore.getState().convertToIssue(r.id);
      toast.success(`Risk "${r.title}" converted to issue successfully`);
      addNotification({
        title: "Issue Created",
        body: `Issue generated successfully from risk "${r.title}".`,
        type: "issue",
      });
    } catch (err: any) {
      toast.error(err?.message || "Failed to convert risk to issue.");
      throw err;
    }
  };

  const doDelete = async (r: RiskItem) => {
    if (!canDelete) return;
    try {
      await deleteRisk(r.id);
      toast.success(`Risk "${r.title}" deleted`);
    } catch (err: any) {
      toast.error(err?.message || "Failed to delete risk.");
      throw err;
    }
  };

  const doBulkDelete = async (rows: RiskItem[]) => {
    const count = rows.length;
    let succeeded = 0;
    const failures: string[] = [];
    for (const r of rows) {
      try {
        await deleteRisk(r.id);
        succeeded += 1;
      } catch (err: any) {
        failures.push(err?.message || "Unknown error");
      }
    }
    const failed = count - succeeded;
    if (failed === 0) {
      toast.success(`${count} risks deleted successfully`);
      addNotification({
        title: "Risks Deleted",
        body: `Successfully deleted ${count} risks.`,
        type: "risk",
      });
    } else if (succeeded === 0) {
      toast.error(failures[0] || "Failed to delete risks. Please try again.");
    } else {
      toast.error(
        `Deleted ${succeeded} of ${count} risks — ${failed} failed.`,
      );
      addNotification({
        title: "Risks Deleted (partial)",
        body: `Deleted ${succeeded} of ${count} risks — ${failed} failed.`,
        type: "risk",
      });
    }
  };



  // ── Context labels — unchanged ────────────────────────────────────────────────
  const activeProgName = (Array.isArray(programmes) ? programmes : []).find(
    (p) => p.id === activeProgrammeId,
  )?.name;
  const activeProjName = (Array.isArray(projects) ? projects : []).find(
    (p) => p.id === activeProjectId,
  )?.name;
  const contextLabel = activeProjName || activeProgName || "All Risks";

  // ── Column definitions ───────────────────────────────────────────────────────

  const columns: ColumnDef<RiskItem>[] = [
    {
      key: "id",
      label: "Ref",
      sortable: true,
      render: (v, r) => (
        <span
          className="font-bold text-indigo-600 cursor-pointer hover:underline whitespace-nowrap"
          onClick={() => {
            if (canModify) {
              setEditingRisk(r);
              setIsModalOpen(true);
            }
          }}
        >
          {v}
        </span>
      ),
    },
    {
      key: "workstream",
      label: "Workstream",
      width: "110px",
      align: "left",
      truncate: true,
      tooltip: true,
      render: (v) => (
        <span className="text-slate-600 text-[10px] font-semibold">
          {stripMarkdown(v || "—")}
        </span>
      ),
    },
    {
      key: "kri",
      label: "Linked KRI",
      render: (v) => (
        <span className="text-slate-500 text-[10px]">{v || "—"}</span>
      ),
    },
    {
      key: "dateAdded",
      label: "Date Added",
      sortable: true,
      render: (v) => (
        <span className="text-slate-400 whitespace-nowrap text-[10px]">
          {fDate(v)}
        </span>
      ),
    },
    ...(!activeProjectId
      ? [
          {
            key: "projectId" as keyof RiskItem,
            label: "Source Project",
            render: (_v: any, r: RiskItem) => (
              <span className="font-bold text-[9px] text-slate-500 uppercase tracking-wider whitespace-nowrap">
                {(Array.isArray(projects) ? projects : []).find(
                  (p) => p.id === r.projectId,
                )?.name || "Programme-Level"}
              </span>
            ),
          } as ColumnDef<RiskItem>,
        ]
      : []),
    {
      key: "title",
      label: "Risk Title & Desc",
      width: "260px",
      truncate: true,
      tooltip: (_v: any, r: RiskItem) =>
        `${stripMarkdown(r.title)}\n\n${stripMarkdown(r.desc) || "No description provided."}`,
      render: (_v, r) => {
        // Severe trigger: rose ESCALATE pill when EITHER gross OR
        // residual Impact = 5.: "Escalate
        // Band 5 risks to senior management immediately".
        const isSevere =
          (Number(r.grossI) || 0) >= 5 || (Number(r.residualI) || 0) >= 5;
        return (
          <div className="min-w-0">
            <div className="flex items-center flex-wrap gap-2">
              <span className="font-bold text-slate-900 leading-tight text-[11px] line-clamp-1">
                {stripMarkdown(r.title)}
              </span>
              {isSevere && (
                <span
                  title="Severe Impact (Band 5) — escalate to senior management immediately"
                  className="px-1.5 py-0.5 bg-rose-100 text-rose-700 text-[8px] font-black uppercase tracking-wider rounded border border-rose-200"
                >
                  Escalate
                </span>
              )}
              {r.isNew !== false &&
                differenceInDays(new Date(), new Date(r.dateAdded || "")) < 1 && (
                  <span className="px-1.5 py-0.5 bg-indigo-600 text-white text-[7px] font-black uppercase rounded shadow-sm">
                    New
                  </span>
                )}
              {!r.owner && (
                <span title="Missing Owner">
                  <AlertCircle className="w-3 h-3 text-rose-500" />
                </span>
              )}
            </div>
            <span className="text-[10px] text-slate-400 font-normal leading-relaxed line-clamp-2">
              {stripMarkdown(r.desc)}
            </span>
          </div>
        );
      },
    },
    // Gross Risk Rating group
    {
      key: "grossL",
      label: "L",
      groupHeader: "Gross Risk Rating",
      groupHeaderClassName: "bg-rose-50 text-rose-700 border-rose-200",
      align: "center",
      width: "36px",
      render: (v, r) => (
        <div
          className={clsx(
            "inline-flex items-center justify-center w-5 h-5 rounded text-[9px] font-black border",
            rsScore(r.grossRating || 0),
          )}
        >
          {v}
        </div>
      ),
    },
    {
      key: "grossI",
      label: "I",
      groupHeader: "Gross Risk Rating",
      groupHeaderClassName: "bg-rose-50 text-rose-700 border-rose-200",
      align: "center",
      width: "36px",
      render: (v, r) => (
        <div
          className={clsx(
            "inline-flex items-center justify-center w-5 h-5 rounded text-[9px] font-black border",
            rsScore(r.grossRating || 0),
          )}
        >
          {v}
        </div>
      ),
    },
    {
      key: "grossRating",
      label: "Rating",
      groupHeader: "Gross Risk Rating",
      groupHeaderClassName: "bg-rose-50 text-rose-700 border-rose-200",
      align: "center",
      sortable: true,
      width: "50px",
      render: (v) => (
        <div
          className={clsx(
            "inline-flex items-center justify-center w-6 h-6 rounded text-[11px] font-black border shadow-sm",
            rsScore(v || 0),
          )}
        >
          {v}
        </div>
      ),
    },
    {
      key: "response",
      label: "Response",
      width: "110px",
      truncate: true,
      tooltip: true,
      render: (v) => (
        <span className="text-slate-600 italic text-[10px]">
          {stripMarkdown(v || "—")}
        </span>
      ),
    },
    {
      key: "controls",
      label: "Controls",
      width: "160px",
      truncate: true,
      tooltip: (v, r) => stripMarkdown(r.controls || ""),
      render: (v, r) => (
        <div className="flex items-center gap-2">
          {!r.controls && (
            <AlertCircle className="w-3 h-3 text-rose-500 shrink-0" />
          )}
          <span className="truncate text-[10px] text-slate-600">
            {stripMarkdown(r.controls || "")?.split("\n")[0] || "—"}
          </span>
        </div>
      ),
    },
    // Residual Risk Rating group
    {
      key: "residualL",
      label: "L",
      groupHeader: "Residual Risk Rating",
      groupHeaderClassName: "bg-emerald-50 text-emerald-700 border-emerald-200",
      align: "center",
      width: "36px",
      render: (v, r) => (
        <div
          className={clsx(
            "inline-flex items-center justify-center w-5 h-5 rounded text-[9px] font-black border",
            rsScore(r.residualRating || 0),
          )}
        >
          {v}
        </div>
      ),
    },
    {
      key: "residualI",
      label: "I",
      groupHeader: "Residual Risk Rating",
      groupHeaderClassName: "bg-emerald-50 text-emerald-700 border-emerald-200",
      align: "center",
      width: "36px",
      render: (v, r) => (
        <div
          className={clsx(
            "inline-flex items-center justify-center w-5 h-5 rounded text-[9px] font-black border",
            rsScore(r.residualRating || 0),
          )}
        >
          {v}
        </div>
      ),
    },
    {
      key: "residualRating",
      label: "Rating",
      groupHeader: "Residual Risk Rating",
      groupHeaderClassName: "bg-emerald-50 text-emerald-700 border-emerald-200",
      align: "center",
      sortable: true,
      width: "50px",
      render: (v) => (
        <div
          className={clsx(
            "inline-flex items-center justify-center w-6 h-6 rounded text-[11px] font-black border shadow-sm",
            rsScore(v || 0),
          )}
        >
          {v}
        </div>
      ),
    },
    {
      key: "_label" as any,
      label: "Rating Label",
      // show "Severe · 24" format (text label + numeric score)
      render: (_v, r) => {
        const { c: pillClass } = rLabel(r.residualRating || 0);
        return (
          <span
            className={clsx(
              "px-1.5 py-0.5 rounded text-[10px] font-bold border whitespace-nowrap",
              pillClass,
            )}
          >
            {formatRatingDisplay(r.residualRating || 0)}
          </span>
        );
      },
    },
    {
      key: "appetite",
      label: "Appetite",
      render: (v) => (
        <span className="text-slate-600 whitespace-nowrap font-medium text-[10px] uppercase tracking-tighter">
          {stripMarkdown(v || "—")}
        </span>
      ),
    },
    {
      key: "furtherAction",
      label: "Further Action",
      width: "160px",
      truncate: true,
      tooltip: (v, r) => {
        const action = stripMarkdown(r.furtherAction || "");
        if (action) return action;
        if (r.workstream?.includes("Financial")) return "Review financial controls & overspend measures";
        if (r.workstream?.includes("Compliance")) return "Audit regulatory adherence protocol";
        if (r.workstream?.includes("Operational")) return "Update operational risk mitigation plan";
        return "Define immediate mitigation steps";
      },
      render: (_v, r) => {
        const action = stripMarkdown(r.furtherAction || "");
        const display = action ||
          (r.workstream?.includes("Financial") ? "Review financial controls & overspend measures" :
           r.workstream?.includes("Compliance") ? "Audit regulatory adherence protocol" :
           r.workstream?.includes("Operational") ? "Update operational risk mitigation plan" :
           "Define immediate mitigation steps");
        return (
          <span className="text-slate-500 text-[10px] leading-relaxed">
            {display}
          </span>
        );
      },
    },
    {
      key: "status",
      label: "Status",
      render: (v) => <StatusBadge status={v} />,
    },
    // Gross ALE group
    {
      key: "grossImpact",
      label: "Impact",
      groupHeader: "Gross ALE",
      groupHeaderClassName: "bg-violet-50 text-violet-700 border-violet-200",
      align: "right",
      render: (v) => (
        <span className="text-slate-600 whitespace-nowrap font-medium text-[10px]">
          {fGBP(v)}
        </span>
      ),
    },
    {
      key: "grossProb",
      label: "Prob%",
      groupHeader: "Gross ALE",
      groupHeaderClassName: "bg-violet-50 text-violet-700 border-violet-200",
      align: "center",
      render: (v) => (
        <span className="text-slate-600 whitespace-nowrap font-medium text-[10px]">
          {probDisplay(v)}
        </span>
      ),
    },
    {
      key: "grossALE",
      label: "ALE",
      groupHeader: "Gross ALE",
      groupHeaderClassName: "bg-violet-50 text-violet-700 border-violet-200",
      align: "right",
      sortable: true,
      render: (v) => (
        <span className="font-bold text-slate-900 whitespace-nowrap text-[11px]">
          {fGBP(Math.round(v || 0))}
        </span>
      ),
    },
    // Residual ALE group
    {
      key: "residualImpact",
      label: "Impact",
      groupHeader: "Residual ALE",
      groupHeaderClassName: "bg-violet-50 text-violet-700 border-violet-200",
      align: "right",
      render: (v) => (
        <span className="text-slate-600 whitespace-nowrap font-medium text-[10px]">
          {fGBP(v)}
        </span>
      ),
    },
    {
      key: "residualProb",
      label: "Prob%",
      groupHeader: "Residual ALE",
      groupHeaderClassName: "bg-violet-50 text-violet-700 border-violet-200",
      align: "center",
      render: (v) => (
        <span className="text-slate-600 whitespace-nowrap font-medium text-[10px]">
          {probDisplay(v)}
        </span>
      ),
    },
    {
      key: "residualALE",
      label: "ALE",
      groupHeader: "Residual ALE",
      groupHeaderClassName: "bg-violet-50 text-violet-700 border-violet-200",
      align: "right",
      sortable: true,
      render: (v) => (
        <span className="font-bold text-indigo-600 whitespace-nowrap text-[11px]">
          {fGBP(Math.round(v || 0))}
        </span>
      ),
    },
    {
      key: "_reduction" as any,
      label: "Reduction",
      align: "right",
      render: (_v, r) => {
        const reduction = (r.grossALE || 0) - (r.residualALE || 0);
        return (
          <span className="font-bold text-emerald-600 whitespace-nowrap text-[11px]">
            {reduction > 0 ? fGBP(Math.round(reduction)) : "—"}
          </span>
        );
      },
    },
    {
      key: "_indicators" as any,
      label: "Ind",
      align: "center",
      render: (_v, r) => (
        <div className="flex flex-col gap-1.5 items-center">
          {r.escalated && (
            <span className="px-2 py-0.5 bg-rose-100 text-rose-700 border border-rose-200 rounded text-[9px] font-bold flex items-center gap-1 shadow-sm shadow-rose-200/50 uppercase tracking-wider">
              <Flag className="w-2.5 h-2.5 fill-current" /> ESC
            </span>
          )}
          {r.convertedToIssue && (
            <span className="px-2 py-0.5 bg-amber-100 text-amber-700 border border-amber-200 rounded text-[9px] font-bold flex items-center gap-1 shadow-sm shadow-amber-200/50 uppercase tracking-wider">
              <AlertTriangle className="w-2.5 h-2.5 fill-current" /> ISSUE
            </span>
          )}
          {!r.escalated && !r.convertedToIssue && (
            <span className="text-slate-300">—</span>
          )}
        </div>
      ),
    },
    {
      key: "_age" as any,
      label: "Age",
      render: (_v, r) => (
        <span className="text-slate-400 whitespace-nowrap font-medium">
          {ageCalc(r.dateAdded, r.status)}
        </span>
      ),
    },
  ];

  // ── Filter definitions ────────────────────────────────────────────────────────

  const filterDefs: FilterDef<RiskItem>[] = [
    {
      key: "status",
      label: "Status",
      type: "select",
      options: RISK_STATUSES.map((s) => ({ value: s, label: s })),
    },
    {
      key: "category",
      label: "Category",
      type: "select",
      options: (activeProgrammeId
        ? STRATEGIC_CATEGORY_NAMES
        : OPERATIONAL_CATEGORY_NAMES
      ).map((c) => ({ value: c, label: c })),
    },
    {
      key: "workstream",
      label: "Workstream",
      type: "select",
      options: (activeProgrammeId
        ? STRATEGIC_WORKSTREAMS
        : OPERATIONAL_WORKSTREAMS
      ).map((w) => ({ value: w, label: w })),
    },
  ];

  // ── Row actions ───────────────────────────────────────────────────────────────

  const rowActions: RowAction<RiskItem>[] = [
    ...(canModify
      ? [
          {
            key: "edit",
            label: "Edit",
            icon: Edit2,
            isDisabled: (r: RiskItem) => isRowPending(r.id),
            onClick: (r: RiskItem) => {
              setEditingRisk(r);
              setIsModalOpen(true);
            },
          },
          {
            key: "escalate",
            label: (r: RiskItem) =>
              r.escalated ? "De-escalate" : "Escalate to Programme",
            icon: (r: RiskItem) => (r.escalated ? FlagOff : Flag),
            isActive: (r: RiskItem) => r.escalated,
            isDisabled: (r: RiskItem) => isRowPending(r.id),
            requireConfirm: {
              icon: (r: RiskItem) => (r.escalated ? FlagOff : Flag),
              variant: (r: RiskItem) => (r.escalated ? "default" : "warning"),
              title: (r: RiskItem) =>
                r.escalated ? "De-escalate risk" : "Escalate risk to programme",
              message: (r: RiskItem) =>
                r.escalated
                  ? `Return "${r.title}" to project level? Its status will be reset to Open and programme stakeholders will no longer be notified.`
                  : `Raise "${r.title}" to programme level? Programme stakeholders will be notified.`,
              confirmLabel: (r: RiskItem) =>
                r.escalated ? "De-escalate" : "Escalate",
            },
            onClick: (r: RiskItem) => doEscalate(r),
          },
          {
            key: "convert",
            label: "Move to Issue",
            icon: AlertTriangle,
            isVisible: (r: RiskItem) =>
              !r.convertedToIssue && r.status !== "Closed",
            isDisabled: (r: RiskItem) => isRowPending(r.id),
            requireConfirm: {
              icon: AlertTriangle,
              variant: "warning" as const,
              title: "Convert risk to issue",
              message: (r: RiskItem) =>
                `Move "${r.title}" from the risk register to the issues register? This action cannot be undone — the risk record will be marked as converted and a new issue will be created.`,
              confirmLabel: "Convert",
            },
            onClick: (r: RiskItem) => doConvertToIssue(r),
          },
        ]
      : []),
    ...(canDelete
      ? [
          {
            key: "delete",
            label: "Delete",
            icon: Trash2,
            isDanger: true,
            isDisabled: (r: RiskItem) => isRowPending(r.id),
            requireConfirm: {
              icon: Trash2,
              variant: "danger" as const,
              title: "Delete risk",
              message: (r: RiskItem) =>
                `Permanently delete "${r.title}"? This cannot be undone.`,
              confirmLabel: "Delete",
              isDanger: true,
            },
            onClick: (r: RiskItem) => doDelete(r),
          },
        ]
      : []),
  ];

  // ── Bulk actions ──────────────────────────────────────────────────────────────

  const bulkActions: BulkAction<RiskItem>[] = canDelete
    ? [
        {
          key: "bulk-delete",
          label: "Delete",
          icon: Trash2,
          isDanger: true,
          style: "inline",
          requireConfirm: {
            icon: Trash2,
            variant: "danger" as const,
            title: (rows: RiskItem[]) => `Delete ${rows.length} risks`,
            message: (rows: RiskItem[]) =>
              `Permanently delete ${rows.length} selected risks? This cannot be undone.`,
            confirmLabel: "Delete all",
            isDanger: true,
          },
          onClick: (rows: RiskItem[]) => doBulkDelete(rows),
        },
      ]
    : [];

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <>
      <ServiceManagementBar />
      <div className="max-w-[98%] mx-auto space-y-6 sm:space-y-8 p-2 sm:p-4 lg:p-6">

        {/* Page Header*/}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            {fromInitiation && (
              <Link
                to={`/project/initiation${activeProjectId ? `?projectId=${activeProjectId}` : ""}`}
                className="flex items-center gap-1 text-xs text-indigo-600 font-medium mb-2 hover:underline"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> Back to Project Initiation
              </Link>
            )}
            <h1 className="text-2xl font-black text-slate-900 uppercase tracking-tight">
              Risk Register
            </h1>
            <p className="text-sm text-slate-500 mt-0.5">{contextLabel}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {/* month picker for historical view.*/}
            <MonthPicker
              monthEnd={historicalView.monthEnd}
              availableMonths={historicalView.availableMonths}
              onChange={historicalView.setMonthEnd}
              loading={historicalView.loading}
            />
            {canModify && (
              <button
                onClick={() => {
                  setEditingRisk(null);
                  setIsModalOpen(true);
                }}
                className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 transition-colors shadow-sm"
              >
                <Plus className="w-4 h-4" />
                Add Risk
              </button>
            )}
          </div>
        </div>

        {/* read-only banner appears when MonthPicker is set
 to a past month. banner also renders the friendly
 empty-state panel when there's nothing to show for that month.*/}
        {isHistorical && historicalView.monthEnd && (
          <HistoricalBanner
            monthEnd={historicalView.monthEnd}
            meta={historicalView.meta}
            onExit={() => historicalView.setMonthEnd(null)}
            defaultCorrectionCollection="risks"
            emptyReason={historicalView.emptyReason}
            activatedYearMonth={historicalView.activatedYearMonth}
            surfaceLabel="risk register"
          />
        )}

        {/* Summary Tiles*/}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
          <StatsCard
            title="Total Risks"
            value={contextScoped.length}
            unit="risks"
            icon={Shield}
            iconBgClassName="bg-indigo-50 dark:bg-indigo-900/30"
            iconClassName="text-indigo-600 dark:text-indigo-400"
            valueClassName="text-indigo-600 dark:text-indigo-400"
          />
          <StatsCard
            title="Open"
            value={contextScoped.filter((r) => r.status === "Open").length}
            unit="open"
            icon={AlertCircle}
            iconBgClassName="bg-orange-50 dark:bg-orange-900/30"
            iconClassName="text-orange-600 dark:text-orange-400"
            valueClassName="text-orange-600 dark:text-orange-400"
          />
          <StatsCard
            title="Severe"
            value={contextScoped.filter((r) => (r.residualRating || 0) >= SEVERE_SCORE_THRESHOLD).length}
            unit="risks"
            icon={Flame}
            iconBgClassName="bg-rose-50 dark:bg-rose-900/30"
            iconClassName="text-rose-600 dark:text-rose-400"
            valueClassName="text-rose-600 dark:text-rose-400"
          />
          <StatsCard
            title="Escalated"
            value={contextScoped.filter((r) => r.escalated).length}
            unit="escalated"
            icon={Flag}
            iconBgClassName="bg-amber-50 dark:bg-amber-900/30"
            iconClassName="text-amber-600 dark:text-amber-400"
            valueClassName="text-amber-600 dark:text-amber-400"
          />
          <StatsCard
            title="Financial Exposure"
            value={(() => {
              const total = contextScoped.reduce(
                (s, r) => s + (r.residualALE || 0),
                0,
              );
              return total >= 1000000
                ? `£${(total / 1000000).toFixed(1)}m`
                : total >= 1000
                  ? `£${Math.round(total / 1000)}k`
                  : fGBP(Math.round(total));
            })()}
            unit="ALE"
            icon={PoundSterling}
            iconBgClassName="bg-slate-100 dark:bg-slate-700"
            iconClassName="text-slate-900 dark:text-slate-200"
            valueClassName="text-[26px] sm:text-[28px] text-slate-900 dark:text-slate-100"
          />
        </div>

        {/* Source Project filter — programme level only, unchanged logic*/}
        {!activeProjectId && scopedProjects.length > 0 && (
          <div className="flex items-center gap-3 bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
              Source
            </span>
            <select
              value={projectFilter}
              onChange={(e) => setProjectFilter(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
            >
              <option value="">All Projects</option>
              <option value={progLevelLabel}>{progLevelLabel}</option>
              {scopedProjects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* DynamicTable*/}
        <DynamicTable<RiskItem>
          data={contextScoped}
          columns={columns}
          rowActions={rowActions}
          bulkActions={bulkActions}
          filters={filterDefs}
          searchable
          searchPlaceholder="Search risks..."
          searchFields={["title", "id", "workstream", "desc"]}
          selectable
          getRowId={(r) => r.id}
          rowClassName={(r) => {
            const base = r.escalated
              ? "bg-indigo-50/30 hover:bg-indigo-50/50"
              : "";
            const pending = isRowPending(r.id)
              ? " opacity-60 pointer-events-none"
              : "";
            return base + pending;
          }}
          emptyState={{
            title: "No risks found matching your filters.",
            icon: ShieldOff,
          }}
          loading={!isInitialized || historicalView.loading}
          headerVariant="light"
          stickyHeader
        />

        {/* RiskModal — unchanged*/}
        <RiskModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onSave={async (d) => {
            try {
              if (editingRisk) {
                await updateRisk(editingRisk.id, { ...d, isNew: false });
                toast.success("Risk updated.");
              } else {
                const newRisk: RiskItem = {
                  ...d,
                  id: generateId("R"),
                  dateAdded: new Date().toISOString().split("T")[0],
                  isNew: true,
                  projectId: d.projectId || activeProjectId || "",
                  programmeId: d.programmeId || activeProgrammeId || "",
                } as RiskItem;
                await addRisk(newRisk);
                toast.success("Risk added to register.");
              }
            } catch (err: any) {
              toast.error(err?.message || "Failed to save risk.");
              throw err;
            }
          }}
          initialData={editingRisk}
        />


      </div>
    </>
  );
}
