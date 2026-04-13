import React, { useState, useEffect } from "react";
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
import { InfoTooltip } from "../components/InfoTooltip";
import { Link, useNavigate, useSearchParams } from "react-router";
import {
  Trash2,
  Edit2,
  ShieldOff,
  AlertCircle,
  ArrowUpRight,
  Upload,
  Download,
  ScanSearch,
  FileSpreadsheet,
  Plus,
  AlertTriangle,
  Flag,
  RotateCcw,
  ArrowLeft,
  ArrowRight,
  Loader2,
  X,
} from "lucide-react";
import { RiskModal } from "../components/RiskModal";

import { ServiceManagementBar } from "../components/ServiceManagementBar";
import * as XLSX from "xlsx";
import toast from "react-hot-toast";

const EmptyState = ({ title }: { title: string }) => (
  <div className="flex flex-col items-center justify-center py-20 bg-slate-50 border-t border-slate-100 italic">
    <ShieldOff className="w-10 h-10 text-slate-200 mb-3" />
    <p className="text-sm font-medium text-slate-400">{title}</p>
    <p className="text-[10px] text-slate-300 mt-1">
      Adjust your filters or add a new risk to populate this view.
    </p>
  </div>
);

function rsScore(score: number) {
  if (!score || score <= 6)
    return "bg-emerald-50 text-emerald-600 border-emerald-200 shadow-sm";
  if (score <= 14)
    return "bg-amber-50 text-amber-600 border-amber-200 shadow-sm";
  return "bg-rose-50 text-rose-600 border-rose-200 shadow-sm font-black animate-pulse";
}

function rLabel(s: number) {
  if (!s || s <= 6)
    return { l: "Low", c: "bg-emerald-50 text-emerald-600 border-emerald-200" };
  if (s <= 14)
    return { l: "Medium", c: "bg-amber-50 text-amber-600 border-amber-200" };
  return { l: "High", c: "bg-rose-50 text-rose-600 border-rose-200 font-bold" };
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

/** Convert stored probability to display percentage string.
 * Stored as 0-1 decimal (e.g. 0.40) → show "40%" */
function probDisplay(prob?: number): string {
  if (!prob && prob !== 0) return "—";
  if (prob === 0) return "—";
  // If stored > 1 it was stored as raw %, e.g. legacy "40"
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
    <span
      className={clsx("px-2 py-0.5 rounded text-[10px] font-bold border", cls)}
    >
      {status}
    </span>
  );
}

// Risk Register Component
export function RiskRegister() {
  const {
    risks,
    updateRisk,
    deleteRisk,
    addRisk,
    addRisks,
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
  } = useStore();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const urlProjectId = searchParams.get('projectId');

  // Sync URL param to store
  useEffect(() => {
      if (urlProjectId && urlProjectId !== activeProjectId) {
          setActiveProject(urlProjectId);
      }
  }, [urlProjectId, activeProjectId, setActiveProject]);
  const fromInitiation = searchParams.get("from") === "initiation";
  const userRole = (user?.role || user?.profile?.role) as UserRole | undefined;
  const userIsSuperAdmin = isSuperAdmin(user?.email, userRole);
  const isPM = !isAtLeastClientAdmin(userRole) && !userIsSuperAdmin;
  const canModify = isAtLeastPM(userRole) || userIsSuperAdmin;
  const canDelete = isAtLeastPM(userRole) || userIsSuperAdmin;
  const progLevelLabel = isPM ? "Shared Portfolio" : "Programme Level";
  const scopedProjects = activeProgrammeId
    ? (Array.isArray(projects) ? projects : []).filter(
        (p) => p.programmeId === activeProgrammeId,
      )
    : Array.isArray(projects)
      ? projects
      : [];

  const [filter, setFilter] = useState({
    project: "", // '' = All (within current context)
    status: "",
    category: "",
    workstream: "",
    search: "",
  });

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRisk, setEditingRisk] = useState<RiskItem | null>(null);

  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Confirmation modal states with loading
  const [escalateModal, setEscalateModal] = useState<{
    open: boolean;
    id: string;
    title: string;
    current: boolean;
  } | null>(null);
  const [deleteModal, setDeleteModal] = useState<{
    open: boolean;
    id: string;
    title: string;
  } | null>(null);
  const [convertModal, setConvertModal] = useState<{
    open: boolean;
    id: string;
    title: string;
  } | null>(null);
  const [bulkDeleteModal, setBulkDeleteModal] = useState<{
    open: boolean;
    count: number;
  } | null>(null);
  const [isEscalating, setIsEscalating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isConverting, setIsConverting] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);

  // When context or filter changes, reset selection
  useEffect(() => {
    setFilter((f) => ({ ...f, project: "" }));
    setSelectedIds([]);
  }, [activeProjectId, activeProgrammeId]);

  // Handle URL-based actions
  useEffect(() => {
    const action = searchParams.get("action");
    if (action === "add-risk") {
      setEditingRisk(null);
      setIsModalOpen(true);
      // Clean up param
      const newParams = new URLSearchParams(searchParams);
      newParams.delete("action");
      setSearchParams(newParams, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const filtered = (Array.isArray(risks) ? risks : [])
    .filter((r) => {
      // --- Context scope ---
      if (activeProjectId) {
        // Viewing a specific project — only show its risks
        if (r.projectId !== activeProjectId) return false;
      } else if (activeProgrammeId) {
        // Viewing a programme — show risks in this programme
        if (r.programmeId !== activeProgrammeId) {
          // Fallback: include risks whose project belongs to this programme
          const rProject = (Array.isArray(projects) ? projects : []).find(
            (p) => p.id === r.projectId,
          );
          if (!rProject || rProject.programmeId !== activeProgrammeId)
            return false;
        }
      }

      // --- Local filter bar (only relevant when at programme level, not project level) ---
      if (!activeProjectId && filter.project) {
        if (filter.project === progLevelLabel) {
          // Only show risks not assigned to any project (programme-level risks)
          if (r.projectId) return false;
        } else {
          // Filter to a specific project
          if (r.projectId !== filter.project) return false;
        }
      }

      if (filter.status && r.status !== filter.status) return false;
      if (filter.category && r.category !== filter.category) return false;
      if (filter.workstream && r.workstream !== filter.workstream) return false;
      if (filter.search) {
        const q = filter.search.toLowerCase();
        if (
          !r.title?.toLowerCase().includes(q) &&
          !r.id?.toLowerCase().includes(q) &&
          !r.workstream?.toLowerCase().includes(q) &&
          !r.desc?.toLowerCase().includes(q)
        )
          return false;
      }
      return true;
    })
    .sort((a, b) => {
      const dateA = a.dateAdded ? new Date(a.dateAdded).getTime() : 0;
      const dateB = b.dateAdded ? new Date(b.dateAdded).getTime() : 0;
      if (dateB !== dateA) return dateB - dateA;
      return (b.id || "").localeCompare(a.id || "");
    });

  const handleEscalateClick = (id: string, current: boolean) => {
    if (!canModify) return;
    const risk = risks.find((r) => r.id === id);
    setEscalateModal({ open: true, id, title: risk?.title || id, current });
  };

  const confirmEscalate = async () => {
    if (!escalateModal) return;
    const { id, current, title } = escalateModal;
    const isEscalating = !current;
    setIsEscalating(true);
    try {
      await updateRisk(id, { escalated: isEscalating, isNew: false });
      toast.success(
        isEscalating
          ? `Risk "${title}" escalated to programme`
          : `Risk "${title}" de-escalated`,
      );

      if (isEscalating) {
        const risk = risks.find((r) => r.id === id);
        const proj = projects.find((p) => p.id === risk?.projectId);
        const prog = programmes.find(
          (p) => p.id === (risk?.programmeId || proj?.programmeId),
        );

        addNotification({
          title: "Risk Escalated to Programme",
          body: `Risk ${id} ("${risk?.title}") has been escalated from project "${proj?.name || "Unknown"}" to programme "${prog?.name || "General"}".`,
          type: "risk",
          projectId: proj?.id,
          programmeId: prog?.id,
        });
      }
    } catch (err: any) {
      toast.error(err?.message || "Failed to update escalation status.");
    } finally {
      setIsEscalating(false);
      setEscalateModal(null);
    }
  };

  const handleConvertToIssueClick = (id: string) => {
    if (!canModify) return;
    const risk = risks.find((r) => r.id === id);
    setConvertModal({ open: true, id, title: risk?.title || id });
  };

  const confirmConvertToIssue = async () => {
    if (!convertModal) return;
    const { id, title } = convertModal;
    setIsConverting(true);
    try {
      await useStore.getState().convertToIssue(id);
      toast.success(`Risk "${title}" converted to issue successfully`);
      addNotification({
        title: "Issue Created",
        body: `Issue generated successfully from risk "${title}".`,
        type: "issue",
      });
    } catch (err: any) {
      toast.error(err?.message || "Failed to convert risk to issue.");
    } finally {
      setIsConverting(false);
      setConvertModal(null);
    }
  };

  const activeProgName = (Array.isArray(programmes) ? programmes : []).find(
    (p) => p.id === activeProgrammeId,
  )?.name;
  const activeProjName = (Array.isArray(projects) ? projects : []).find(
    (p) => p.id === activeProjectId,
  )?.name;
  const contextLabel = activeProjName || activeProgName || "All Risks";

  const handleBulkDeleteClick = () => {
    if (!canDelete || selectedIds.length === 0) return;
    setBulkDeleteModal({ open: true, count: selectedIds.length });
  };

  const confirmBulkDelete = async () => {
    if (!bulkDeleteModal) return;
    const count = selectedIds.length;
    setIsBulkDeleting(true);
    try {
      await Promise.all(selectedIds.map((id) => deleteRisk(id)));
      toast.success(`${count} risks deleted successfully`);
      setSelectedIds([]);
      addNotification({
        title: "Risks Deleted",
        body: `Successfully deleted ${count} risks.`,
        type: "risk",
      });
    } catch (err: any) {
      toast.error(err?.message || "Failed to delete risks.");
    } finally {
      setIsBulkDeleting(false);
      setBulkDeleteModal(null);
    }
  };

  const handleExport = () => {
    if (filtered.length === 0) {
      toast.error("No risks to export.");
      return;
    }
    const rows = filtered.map((r) => {
      const gALE = r.grossALE || 0;
      const rALE = r.residualALE || 0;
      const reduction = gALE - rALE;
      return {
        Ref: r.id,
        Workstream: stripMarkdown(r.workstream || "—"),
        "Linked KRI": r.kri || "—",
        "Date Added": r.dateAdded
          ? new Date(r.dateAdded).toLocaleDateString()
          : "—",
        "Source Project":
          (Array.isArray(projects) ? projects : []).find(
            (p) => p.id === r.projectId,
          )?.name || "Programme-Level",
        "Risk Title": stripMarkdown(r.title || ""),
        "Risk Desc": stripMarkdown(r.desc || ""),
        "Gross L": r.grossL ?? "",
        "Gross I": r.grossI ?? "",
        "Gross Rating": r.grossRating ?? "",
        Response: stripMarkdown(r.response || "—"),
        Controls: stripMarkdown(r.controls || "—"),
        "Residual L": r.residualL ?? "",
        "Residual I": r.residualI ?? "",
        "Residual Rating": r.residualRating ?? "",
        Label: rLabel(r.residualRating || 0).l,
        Appetite: stripMarkdown(r.appetite || "—"),
        "Further Action": stripMarkdown(r.furtherAction || "—"),
        Status: r.status || "",
        "Gross Impact (£)": r.grossImpact || 0,
        "Gross Prob%": probDisplay(r.grossProb),
        "Gross ALE (£)": Math.round(gALE),
        "Residual Impact (£)": r.residualImpact || 0,
        "Residual Prob%": probDisplay(r.residualProb),
        "Residual ALE (£)": Math.round(rALE),
        "Reduction (£)": Math.round(reduction),
        Indicator: r.escalated ? "ESC" : r.convertedToIssue ? "ISSUE" : "—",
        "Age (Days)": differenceInDays(new Date(), new Date(r.dateAdded || "")),
      };
    });
    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Risk Register");
    XLSX.writeFile(
      workbook,
      `risk_register_${new Date().toISOString().slice(0, 10)}.xlsx`,
    );
    toast.success(`Exported ${filtered.length} risks.`);
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === filtered.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filtered.map((r) => r.id));
    }
  };

  const toggleSelectOne = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const handleDeleteClick = (id: string) => {
    if (!canDelete) return;
    const risk = risks.find((r) => r.id === id);
    setDeleteModal({ open: true, id, title: risk?.title || id });
  };

  const confirmDelete = async () => {
    if (!deleteModal) return;
    const { id, title } = deleteModal;
    setIsDeleting(true);
    try {
      await deleteRisk(id);
      toast.success(`Risk "${title}" deleted`);
    } catch (err: any) {
      toast.error(err?.message || "Failed to delete risk.");
    } finally {
      setIsDeleting(false);
      setDeleteModal(null);
    }
  };

  return (
    <>
      <ServiceManagementBar />
      <div className="max-w-[98%] mx-auto space-y-6 sm:space-y-8 p-2 sm:p-4 lg:p-6">
        {/* Page Header */}
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
            <h1 className="text-2xl font-black text-slate-900 uppercase italic tracking-tight">
              Risk Register
            </h1>
            <p className="text-sm text-slate-500 mt-0.5">{contextLabel}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {selectedIds.length > 0 && canDelete && (
              <button
                onClick={handleBulkDeleteClick}
                className="flex items-center gap-1.5 px-3 py-2 bg-rose-50 text-rose-600 border border-rose-200 rounded-xl text-sm font-medium hover:bg-rose-100 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                Delete ({selectedIds.length})
              </button>
            )}
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

        {/* Skeleton loader while store initialises */}
        {!isInitialized && (
          <div className="space-y-3 animate-pulse">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-12 bg-slate-100 rounded-xl" />
            ))}
          </div>
        )}

        {/* Summary Tiles */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {[
            {
              label: "Total",
              value: filtered.length,
              color: "text-indigo-600",
              border: "border-l-indigo-500",
            },
            {
              label: "Open",
              value: filtered.filter((r) => r.status === "Open").length,
              color: "text-red-600",
              border: "border-l-red-500",
            },
            {
              label: "High/Severe",
              value: filtered.filter((r) => (r.residualRating || 0) >= 16)
                .length,
              color: "text-red-700",
              border: "border-l-red-700",
            },
            {
              label: "Escalated",
              value: filtered.filter((r) => r.escalated).length,
              color: "text-amber-600",
              border: "border-l-amber-500",
            },
            {
              label: "Financial Exposure (ALE)",
              value: (() => {
                const total = filtered.reduce(
                  (s, r) => s + (r.residualALE || 0),
                  0,
                );
                return total >= 1000000
                  ? `£${(total / 1000000).toFixed(1)}m`
                  : total >= 1000
                    ? `£${Math.round(total / 1000)}k`
                    : fGBP(Math.round(total));
              })(),
              color: "text-slate-900",
              border: "border-l-slate-900",
            },
          ].map((s) => (
            <div
              key={s.label}
              className={clsx(
                "bg-white rounded-xl border border-slate-200 border-l-4 px-4 py-3 shadow-sm",
                s.border,
              )}
            >
              <div className={clsx("text-xl font-extrabold", s.color)}>
                {s.value}
              </div>
              <div className="text-xs text-slate-400 font-semibold uppercase tracking-wider mt-0.5">
                {s.label}
              </div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
          <select
            value={filter.status}
            onChange={(e) => setFilter({ ...filter, status: e.target.value })}
            className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 w-full sm:w-auto"
          >
            <option value="">All Status</option>
            {RISK_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <select
            value={filter.category}
            onChange={(e) => setFilter({ ...filter, category: e.target.value })}
            className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 w-full sm:w-auto"
          >
            <option value="">All Categories</option>
            {activeProgrammeId
              ? STRATEGIC_CATEGORY_NAMES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))
              : OPERATIONAL_CATEGORY_NAMES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
          </select>
          <select
            value={filter.workstream}
            onChange={(e) =>
              setFilter({ ...filter, workstream: e.target.value })
            }
            className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 w-full sm:w-auto"
          >
            <option value="">All Workstreams</option>
            {activeProgrammeId
              ? STRATEGIC_WORKSTREAMS.map((w) => (
                  <option key={w} value={w}>
                    {w}
                  </option>
                ))
              : OPERATIONAL_WORKSTREAMS.map((w) => (
                  <option key={w} value={w}>
                    {w}
                  </option>
                ))}
          </select>
          <input
            type="search"
            placeholder="Search risks..."
            value={filter.search}
            onChange={(e) => setFilter({ ...filter, search: e.target.value })}
            className="w-full sm:flex-1 min-w-[200px] bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
          />
        </div>

        {/* Full Register Table */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-x-auto scrollbar-thin scrollbar-thumb-slate-200">
          <table className="w-full text-left text-[11px] border-collapse min-w-[1700px]">
            <thead>
              {/* Group row */}
              <tr className="bg-slate-100/50 border-b border-slate-200 text-slate-500 uppercase tracking-[0.15em] text-[10px] font-black">
                <th
                  className="px-3 py-2"
                  colSpan={activeProjectId ? 6 : 7}
                ></th>
                <th
                  className="px-3 py-2 text-center border-x border-slate-200 bg-rose-50/50 text-rose-700"
                  colSpan={3}
                >
                  Gross Risk Rating
                </th>
                <th className="px-3 py-2" colSpan={2}></th>
                <th
                  className="px-3 py-2 text-center border-x border-slate-200 bg-emerald-50/50 text-emerald-700"
                  colSpan={3}
                >
                  Residual Risk Rating
                </th>
                <th className="px-3 py-2" colSpan={4}></th>
                <th
                  className="px-3 py-2 text-center border-x border-slate-200 bg-blue-50/50 text-blue-700"
                  colSpan={3}
                >
                  Gross ALE
                </th>
                <th
                  className="px-3 py-2 text-center border-x border-slate-200 bg-indigo-50/50 text-indigo-700"
                  colSpan={3}
                >
                  Residual ALE
                </th>
                <th className="px-3 py-2" colSpan={4}></th>
              </tr>
              {/* Column headers */}
              <tr className="bg-slate-50/80 text-slate-500 uppercase tracking-wider border-b border-slate-200 text-[9px] font-bold sticky top-0 z-10 backdrop-blur-sm">
                <th className="px-3 py-3 w-10 text-center sticky left-0 bg-slate-50 border-r border-slate-100 z-20">
                  <input
                    type="checkbox"
                    className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5"
                    checked={
                      filtered.length > 0 &&
                      selectedIds.length === filtered.length
                    }
                    onChange={toggleSelectAll}
                  />
                </th>
                <th className="px-3 py-3 whitespace-nowrap">Ref</th>
                <th className="px-3 py-3 whitespace-nowrap text-center">
                  Workstream
                </th>
                <th className="px-3 py-3 whitespace-nowrap">Linked KRI</th>
                <th className="px-3 py-3 whitespace-nowrap">Date Added</th>
                {!activeProjectId && (
                  <th className="px-3 py-3 whitespace-nowrap">
                    Source Project
                  </th>
                )}
                <th className="px-3 py-3 min-w-[350px]">
                  Risk Title & Desc{" "}
                  <InfoTooltip content="Click ID to open full risk details" />
                </th>
                {/* Gross */}
                <th className="px-2 py-3 text-center border-l border-slate-200 bg-rose-50/20">
                  L
                </th>
                <th className="px-2 py-3 text-center bg-rose-50/20">I</th>
                <th className="px-2 py-3 text-center border-r border-slate-200 bg-rose-50/20">
                  Rating
                </th>
                {/* After Gross */}
                <th className="px-3 py-3 whitespace-nowrap">Response</th>
                <th className="px-3 py-3 whitespace-nowrap">Controls</th>
                {/* Residual */}
                <th className="px-2 py-3 text-center border-l border-slate-200 bg-emerald-50/20">
                  L
                </th>
                <th className="px-2 py-3 text-center bg-emerald-50/20">I</th>
                <th className="px-2 py-3 text-center border-r border-slate-200 bg-emerald-50/20">
                  Rating
                </th>
                {/* Post Rating */}
                <th className="px-3 py-3 whitespace-nowrap">Label</th>
                <th className="px-3 py-3 whitespace-nowrap">Appetite</th>
                <th className="px-3 py-3 whitespace-nowrap min-w-[150px]">
                  Further Action
                </th>
                <th className="px-3 py-3 whitespace-nowrap">Status</th>
                {/* ALE columns */}
                <th className="px-3 py-3 text-right border-l border-slate-200 bg-blue-50/20 whitespace-nowrap">
                  Impact
                </th>
                <th className="px-3 py-3 text-center bg-blue-50/20 whitespace-nowrap">
                  Prob%
                </th>
                <th className="px-3 py-3 text-right border-r border-slate-200 bg-blue-50/20 whitespace-nowrap">
                  ALE
                </th>
                <th className="px-3 py-3 text-right border-l border-slate-200 bg-indigo-50/20 whitespace-nowrap">
                  Impact
                </th>
                <th className="px-3 py-3 text-center bg-indigo-50/20 whitespace-nowrap">
                  Prob%
                </th>
                <th className="px-3 py-3 text-right border-r border-slate-200 bg-indigo-50/20 whitespace-nowrap">
                  ALE <InfoTooltip content="ALE = Financial Impact × Probability%" />
                </th>
                {/* Tail */}
                <th className="px-3 py-3 text-right whitespace-nowrap">
                  Reduction
                </th>
                <th className="px-3 py-3 text-center text-slate-500 uppercase tracking-tighter text-[9px]">
                  Ind
                </th>
                <th className="px-3 py-3 whitespace-nowrap">Age</th>
                <th className="px-3 py-3 text-center whitespace-nowrap sticky right-0 bg-slate-50 border-l border-slate-200 z-30 shadow-[-4px_0_10px_-3px_rgba(0,0,0,0.1)] min-w-[130px]">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((r) => {
                const c = rLabel(r.residualRating || 0);
                const gALE = r.grossALE || 0;
                const rALE = r.residualALE || 0;
                const reduction = (r.grossALE || 0) - (r.residualALE || 0);
                return (
                  <tr
                    key={r.id}
                    className={clsx(
                      "border-b border-slate-100 transition-colors group relative",
                      r.escalated
                        ? "bg-indigo-50/30 hover:bg-indigo-50/50"
                        : "hover:bg-slate-50/80",
                      selectedIds.includes(r.id) && "bg-indigo-50/40",
                    )}
                  >
                    {r.escalated && (
                      <div className="absolute left-0 top-0 bottom-0 w-1 bg-indigo-600 z-30" />
                    )}
                    <td className="px-3 py-2 text-center sticky left-0 bg-white z-20 border-r border-slate-100 group-hover:bg-slate-50">
                      <input
                        type="checkbox"
                        className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5"
                        checked={selectedIds.includes(r.id)}
                        onChange={() => toggleSelectOne(r.id)}
                      />
                    </td>
                    <td
                      className="px-3 py-2 font-bold text-indigo-600 cursor-pointer hover:underline text-[11px] whitespace-nowrap"
                      onClick={() => {
                        if (canModify) {
                          setEditingRisk(r);
                          setIsModalOpen(true);
                        }
                      }}
                    >
                      {r.id}
                    </td>
                    <td
                      className="px-3 py-2 text-slate-600 max-w-[100px] truncate whitespace-nowrap text-center text-[10px] font-semibold"
                      title={r.workstream}
                    >
                      {stripMarkdown(r.workstream || "—")}
                    </td>
                    <td className="px-3 py-2 text-slate-500 max-w-[150px] break-words text-[10px]">
                      {r.kri || "—"}
                    </td>
                    <td className="px-3 py-2 text-slate-400 whitespace-nowrap text-[10px]">
                      {fDate(r.dateAdded)}
                    </td>
                    {!activeProjectId && (
                      <td className="px-3 py-2 font-bold text-[9px] text-slate-500 uppercase tracking-wider whitespace-nowrap">
                        {(Array.isArray(projects) ? projects : []).find(
                          (p) => p.id === r.projectId,
                        )?.name || "Programme-Level"}
                      </td>
                    )}
                    <td className="px-3 py-2 font-medium text-slate-800 min-w-[300px] whitespace-normal">
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center flex-wrap gap-2">
                          <span
                            className="font-bold text-slate-900 leading-tight text-[11px] line-clamp-1 hover:line-clamp-none transition-all cursor-help"
                            title={stripMarkdown(r.title)}
                          >
                            {stripMarkdown(r.title)}
                          </span>
                          {r.isNew !== false &&
                            differenceInDays(
                              new Date(),
                              new Date(r.dateAdded || ""),
                            ) < 1 && (
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
                        <span
                          className="text-[10px] text-slate-400 font-normal leading-relaxed line-clamp-2 hover:line-clamp-none transition-all"
                          title={stripMarkdown(r.desc)}
                        >
                          {stripMarkdown(r.desc)}
                        </span>
                      </div>
                    </td>

                    {/* Gross */}
                    <td className="px-2 py-2 text-center border-l border-slate-100 bg-rose-50/5">
                      <div
                        className={clsx(
                          "inline-flex items-center justify-center w-5 h-5 rounded text-[9px] font-black border",
                          rsScore(r.grossRating || 0),
                        )}
                      >
                        {r.grossL}
                      </div>
                    </td>
                    <td className="px-2 py-2 text-center bg-rose-50/5">
                      <div
                        className={clsx(
                          "inline-flex items-center justify-center w-5 h-5 rounded text-[9px] font-black border",
                          rsScore(r.grossRating || 0),
                        )}
                      >
                        {r.grossI}
                      </div>
                    </td>
                    <td className="px-2 py-2 text-center border-r border-slate-100 bg-rose-50/5">
                      <div
                        className={clsx(
                          "inline-flex items-center justify-center w-6 h-6 rounded text-[11px] font-black border flex-col leading-none shadow-sm",
                          rsScore(r.grossRating || 0),
                        )}
                      >
                        <span>{r.grossRating}</span>
                      </div>
                    </td>

                    <td
                      className="px-3 py-2 text-slate-600 max-w-[100px] truncate italic whitespace-nowrap text-[10px]"
                      title={r.response || ""}
                    >
                      {stripMarkdown(r.response || "—")}
                    </td>
                    <td
                      className="px-3 py-2 text-slate-600 max-w-[150px] truncate whitespace-nowrap text-[10px]"
                      title={r.controls || ""}
                    >
                      <div className="flex items-center gap-2">
                        {!r.controls && (
                          <AlertCircle className="w-3 h-3 text-rose-500 shrink-0" />
                        )}
                        <span className="truncate">
                          {stripMarkdown(r.controls || "")?.split("\n")[0] ||
                            "—"}
                        </span>
                      </div>
                    </td>

                    {/* Residual */}
                    <td className="px-2 py-2 text-center border-l border-slate-100 bg-emerald-50/5">
                      <div
                        className={clsx(
                          "inline-flex items-center justify-center w-5 h-5 rounded text-[9px] font-black border",
                          rsScore(r.residualRating || 0),
                        )}
                      >
                        {r.residualL}
                      </div>
                    </td>
                    <td className="px-2 py-2 text-center bg-emerald-50/5">
                      <div
                        className={clsx(
                          "inline-flex items-center justify-center w-5 h-5 rounded text-[9px] font-black border",
                          rsScore(r.residualRating || 0),
                        )}
                      >
                        {r.residualI}
                      </div>
                    </td>
                    <td className="px-2 py-2 text-center border-r border-slate-100 bg-emerald-50/5">
                      <div
                        className={clsx(
                          "inline-flex items-center justify-center w-6 h-6 rounded text-[11px] font-black border flex-col leading-none shadow-sm",
                          rsScore(r.residualRating || 0),
                        )}
                      >
                        <span>{r.residualRating}</span>
                      </div>
                    </td>

                    <td className="px-3 py-2 whitespace-nowrap">
                      <span
                        className={clsx(
                          "px-1.5 py-0.5 rounded text-[10px] font-bold border",
                          c.c,
                        )}
                      >
                        {c.l}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-slate-600 whitespace-nowrap font-medium text-[10px] uppercase tracking-tighter">
                      {stripMarkdown(r.appetite || "—")}
                    </td>
                    <td className="px-3 py-2 text-slate-500 min-w-[150px] whitespace-normal leading-relaxed text-[10px]">
                      {(() => {
                        const action = stripMarkdown(r.furtherAction || "");
                        if (action) return action;
                        // Workstream-specific placeholders
                        if (r.workstream?.includes("Financial")) return "Review financial controls & overspend measures";
                        if (r.workstream?.includes("Compliance")) return "Audit regulatory adherence protocol";
                        if (r.workstream?.includes("Operational")) return "Update operational risk mitigation plan";
                        return "Define immediate mitigation steps";
                      })()}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <StatusBadge status={r.status} />
                    </td>

                    {/* Gross ALE */}
                    <td className="px-3 py-2 text-right border-l border-slate-100 text-slate-600 whitespace-nowrap font-medium text-[10px]">
                      {fGBP(r.grossImpact)}
                    </td>
                    <td className="px-3 py-2 text-center text-slate-600 whitespace-nowrap font-medium text-[10px]">
                      {probDisplay(r.grossProb)}
                    </td>
                    <td className="px-3 py-2 text-right border-r border-slate-100 font-bold text-slate-900 whitespace-nowrap text-[11px]">
                      {fGBP(Math.round(gALE))}
                    </td>

                    {/* Residual ALE */}
                    <td className="px-3 py-2 text-right border-l border-slate-100 text-slate-600 whitespace-nowrap font-medium text-[10px]">
                      {fGBP(r.residualImpact)}
                    </td>
                    <td className="px-3 py-2 text-center text-slate-600 whitespace-nowrap font-medium text-[10px]">
                      {probDisplay(r.residualProb)}
                    </td>
                    <td className="px-3 py-2 text-right border-r border-slate-100 font-bold text-indigo-600 whitespace-nowrap text-[11px]">
                      {fGBP(Math.round(rALE))}
                    </td>

                    <td className="px-3 py-2 text-right font-bold text-emerald-600 whitespace-nowrap text-[11px]">
                      {reduction > 0 ? fGBP(Math.round(reduction)) : "—"}
                    </td>
                    <td className="px-3 py-3 text-center whitespace-nowrap">
                      <div className="flex flex-col gap-1.5 items-center">
                        {r.escalated && (
                          <span className="px-2 py-0.5 bg-rose-100 text-rose-700 border border-rose-200 rounded text-[9px] font-bold flex items-center gap-1 shadow-sm shadow-rose-200/50 uppercase tracking-wider">
                            <Flag className="w-2.5 h-2.5 fill-current" /> ESC
                          </span>
                        )}
                        {r.convertedToIssue && (
                          <span className="px-2 py-0.5 bg-amber-100 text-amber-700 border border-amber-200 rounded text-[9px] font-bold flex items-center gap-1 shadow-sm shadow-amber-200/50 uppercase tracking-wider">
                            <AlertTriangle className="w-2.5 h-2.5 fill-current" />{" "}
                            ISSUE
                          </span>
                        )}
                        {!r.escalated && !r.convertedToIssue && (
                          <span className="text-slate-300">—</span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-3 text-slate-400 whitespace-nowrap font-medium">
                      {ageCalc(r.dateAdded, r.status)}
                    </td>
                    <td className="px-3 py-3 sticky right-0 bg-white z-10 border-l border-slate-200 group-hover:bg-slate-50/80 backdrop-blur-sm shadow-[-4px_0_10px_-3px_rgba(0,0,0,0.1)] min-w-[130px]">
                      <div className="flex items-center gap-1 justify-center">
                        {canModify && (
                          <>
                            <button
                              onClick={() => {
                                setEditingRisk(r);
                                setIsModalOpen(true);
                              }}
                              className="w-6 h-6 flex items-center justify-center bg-white text-slate-400 border border-slate-200 rounded-lg hover:text-indigo-600 hover:bg-indigo-50 transition-all shadow-sm"
                              title="Edit"
                            >
                              <Edit2 className="w-3 h-3" />
                            </button>
                            <button
                              onClick={() =>
                                handleEscalateClick(r.id, r.escalated)
                              }
                              className={clsx(
                                "w-6 h-6 flex items-center justify-center rounded-lg border transition-all shadow-sm",
                                r.escalated
                                  ? "bg-slate-900 text-white border-slate-900"
                                  : "bg-white text-orange-600 border-orange-100 hover:bg-orange-50",
                              )}
                              title={
                                r.escalated
                                  ? "De-escalate"
                                  : "Escalate to Programme"
                              }
                            >
                              <Flag
                                className={clsx(
                                  "w-3 h-3",
                                  r.escalated ? "fill-current" : "",
                                )}
                              />
                            </button>
                            {!r.convertedToIssue && r.status !== "Closed" && (
                              <button
                                onClick={() => handleConvertToIssueClick(r.id)}
                                className="w-6 h-6 flex items-center justify-center bg-white text-amber-500 border border-amber-100 rounded-lg hover:bg-amber-50 transition-all shadow-sm"
                                title="Move to Issue"
                              >
                                <AlertTriangle className="w-3 h-3" />
                              </button>
                            )}
                          </>
                        )}
                        {canDelete && (
                          <button
                            onClick={() => handleDeleteClick(r.id)}
                            className="w-6 h-6 flex items-center justify-center bg-rose-50 text-rose-400 hover:text-rose-600 hover:bg-rose-100 rounded-lg transition-colors shadow-sm"
                            title="Delete"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <EmptyState title="No risks found matching your filters." />
          )}
        </div>

        <RiskModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onSave={async (d) => {
            try {
              if (editingRisk) {
                await updateRisk(editingRisk.id, { ...d, isNew: false });
                toast.success("Risk updated.");
              } else {
                const newId = generateId("R");
                const newRisk: RiskItem = {
                  ...d,
                  id: newId,
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
            }
          }}
          initialData={editingRisk}
        />

        {/* Escalate/De-escalate Confirmation Modal */}
        {escalateModal?.open && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in duration-300">
              <div
                className={clsx(
                  "px-6 py-5 border-b border-slate-100",
                  escalateModal.current ? "bg-slate-50/50" : "bg-orange-50/50",
                )}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={clsx(
                      "w-10 h-10 rounded-full flex items-center justify-center",
                      escalateModal.current
                        ? "bg-slate-200 text-slate-600"
                        : "bg-orange-100 text-orange-600",
                    )}
                  >
                    <Flag
                      className={clsx(
                        "w-5 h-5",
                        !escalateModal.current && "fill-current",
                      )}
                    />
                  </div>
                  <div>
                    <h3 className="font-black text-slate-800 uppercase tracking-tighter text-lg">
                      {escalateModal.current
                        ? "De-escalate Risk"
                        : "Escalate Risk"}
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5 truncate max-w-[200px]">
                      {escalateModal.title}
                    </p>
                  </div>
                </div>
              </div>
              <div className="p-6">
                <p className="text-sm text-slate-600">
                  Are you sure you want to{" "}
                  {escalateModal.current ? "de-escalate" : "escalate"}{" "}
                  <span
                    className={clsx(
                      "font-bold",
                      escalateModal.current
                        ? "text-slate-700"
                        : "text-orange-600",
                    )}
                  >
                    {escalateModal.title}
                  </span>
                  ?
                  {escalateModal.current
                    ? " This will remove the escalation flag from the risk."
                    : " This will escalate the risk to programme level."}
                </p>
                <div className="pt-5 flex gap-3">
                  <button
                    onClick={() => setEscalateModal(null)}
                    disabled={isEscalating}
                    className="flex-1 px-4 py-2.5 border border-slate-200 text-slate-600 rounded-xl text-xs font-black uppercase hover:bg-slate-50 transition-colors tracking-widest disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={confirmEscalate}
                    disabled={isEscalating}
                    className={clsx(
                      "flex-1 px-4 py-2.5 text-white rounded-xl text-xs font-black uppercase transition-all shadow-lg tracking-widest disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2",
                      escalateModal.current
                        ? "bg-slate-700 hover:bg-slate-800 shadow-slate-200"
                        : "bg-orange-600 hover:bg-orange-700 shadow-orange-200",
                    )}
                  >
                    {isEscalating && (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    )}
                    {isEscalating
                      ? "Processing..."
                      : escalateModal.current
                        ? "De-escalate"
                        : "Escalate"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {deleteModal?.open && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in duration-300">
              <div className="px-6 py-5 border-b border-slate-100 bg-rose-50/50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center text-rose-600">
                    <AlertTriangle className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-black text-slate-800 uppercase tracking-tighter text-lg">
                      Delete Risk
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5 truncate max-w-[200px]">
                      {deleteModal.title}
                    </p>
                  </div>
                </div>
              </div>
              <div className="p-6">
                <p className="text-sm text-slate-600">
                  Are you sure you want to permanently delete{" "}
                  <span className="font-bold text-rose-600">
                    {deleteModal.title}
                  </span>
                  ? This action cannot be undone.
                </p>
                <div className="pt-5 flex gap-3">
                  <button
                    onClick={() => setDeleteModal(null)}
                    disabled={isDeleting}
                    className="flex-1 px-4 py-2.5 border border-slate-200 text-slate-600 rounded-xl text-xs font-black uppercase hover:bg-slate-50 transition-colors tracking-widest disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={confirmDelete}
                    disabled={isDeleting}
                    className="flex-1 px-4 py-2.5 bg-rose-600 text-white rounded-xl text-xs font-black uppercase hover:bg-rose-700 transition-all shadow-lg shadow-rose-200 tracking-widest disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {isDeleting && (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    )}
                    {isDeleting ? "Deleting..." : "Delete"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Convert to Issue Confirmation Modal */}
        {convertModal?.open && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in duration-300">
              <div className="px-6 py-5 border-b border-slate-100 bg-amber-50/50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center text-amber-600">
                    <AlertTriangle className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-black text-slate-800 uppercase tracking-tighter text-lg">
                      Convert to Issue
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5 truncate max-w-[200px]">
                      {convertModal.title}
                    </p>
                  </div>
                </div>
              </div>
              <div className="p-6">
                <p className="text-sm text-slate-600">
                  Are you sure you want to convert{" "}
                  <span className="font-bold text-amber-600">
                    {convertModal.title}
                  </span>{" "}
                  to an issue? This will close the risk and generate a
                  standardized Issue ID.
                </p>
                <div className="pt-5 flex gap-3">
                  <button
                    onClick={() => setConvertModal(null)}
                    disabled={isConverting}
                    className="flex-1 px-4 py-2.5 border border-slate-200 text-slate-600 rounded-xl text-xs font-black uppercase hover:bg-slate-50 transition-colors tracking-widest disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={confirmConvertToIssue}
                    disabled={isConverting}
                    className="flex-1 px-4 py-2.5 bg-amber-600 text-white rounded-xl text-xs font-black uppercase hover:bg-amber-700 transition-all shadow-lg shadow-amber-200 tracking-widest disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {isConverting && (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    )}
                    {isConverting ? "Converting..." : "Convert"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Bulk Delete Confirmation Modal */}
        {bulkDeleteModal?.open && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in duration-300">
              <div className="px-6 py-5 border-b border-slate-100 bg-rose-50/50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center text-rose-600">
                    <Trash2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-black text-slate-800 uppercase tracking-tighter text-lg">
                      Bulk Delete Risks
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {bulkDeleteModal.count} selected risks
                    </p>
                  </div>
                </div>
              </div>
              <div className="p-6">
                <p className="text-sm text-slate-600">
                  Are you sure you want to permanently delete{" "}
                  <span className="font-bold text-rose-600">
                    {bulkDeleteModal.count}
                  </span>{" "}
                  selected risks? This action cannot be undone.
                </p>
                <div className="pt-5 flex gap-3">
                  <button
                    onClick={() => setBulkDeleteModal(null)}
                    disabled={isBulkDeleting}
                    className="flex-1 px-4 py-2.5 border border-slate-200 text-slate-600 rounded-xl text-xs font-black uppercase hover:bg-slate-50 transition-colors tracking-widest disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={confirmBulkDelete}
                    disabled={isBulkDeleting}
                    className="flex-1 px-4 py-2.5 bg-rose-600 text-white rounded-xl text-xs font-black uppercase hover:bg-rose-700 transition-all shadow-lg shadow-rose-200 tracking-widest disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {isBulkDeleting && (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    )}
                    {isBulkDeleting ? "Deleting..." : "Delete All"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
