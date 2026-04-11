import { useState, useEffect } from "react";
import { Link, useSearchParams } from "react-router";
import { useStore, IssueItem } from "../store/useStore";
import {
  isAtLeastPM,
  isAtLeastClientAdmin,
  isSuperAdmin,
  UserRole,
} from "../lib/roles";
import { ISSUE_STATUSES } from "../data/riskData";
import { clsx } from "clsx";
import { generateId } from "../lib/utils";
import { format, differenceInDays } from "date-fns";
import { InfoTooltip } from "../components/InfoTooltip";
import {
  Trash2,
  Edit2,
  Lightbulb,
  TrendingUp,
  AlertCircle,
  ShieldOff,
  CheckCircle2,
  ArrowLeft,
  Plus,
  Loader2,
} from "lucide-react";
import { IssueModal } from "../components/IssueModal";
import { ServiceManagementBar } from "../components/ServiceManagementBar";
import * as XLSX from "xlsx";
import toast from "react-hot-toast";

const EmptyState = ({ title }: { title: string }) => (
  <div className="flex flex-col items-center justify-center py-12 text-slate-400 space-y-2 opacity-60">
    <ShieldOff className="w-8 h-8" />
    <p className="text-xs font-medium">{title}</p>
  </div>
);

function iScore(p: number | string, s: number | string) {
  const map: Record<string, number> = {
    Low: 1,
    Medium: 3,
    High: 5,
    Critical: 10,
  };
  const pv = typeof p === "number" ? p : map[p] || 1;
  const sv = typeof s === "number" ? s : map[s] || 1;
  const v = pv * sv;
  if (v >= 20)
    return { l: "Critical", c: "bg-red-900 text-white border-red-900" };
  if (v >= 12)
    return { l: "High", c: "bg-red-100 text-red-800 border-red-200" };
  if (v >= 8)
    return { l: "Medium", c: "bg-amber-50 text-amber-700 border-amber-200" };
  return { l: "Low", c: "bg-emerald-50 text-emerald-700 border-emerald-200" };
}

function fDate(d?: string) {
  if (!d) return "—";
  try {
    return format(new Date(d), "dd MMM yy");
  } catch {
    return d;
  }
}

function ageCalc(d?: string, status?: string) {
  if (!d || status === "4. Resolved") return "—";
  try {
    return differenceInDays(new Date(), new Date(d)) + "d";
  } catch {
    return "—";
  }
}

function StatusBadge({ status }: { status: string }) {
  const cls =
    status === "4. Resolved"
      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
      : status === "2. Escalated"
        ? "bg-red-100 text-red-700 border-red-200"
        : status === "3. Implementing Fix"
          ? "bg-blue-50 text-blue-700 border-blue-200"
          : status === "1. Investigating"
            ? "bg-amber-50 text-amber-700 border-amber-200"
            : "bg-slate-100 text-slate-600 border-slate-200";
  return (
    <span
      className={clsx(
        "px-2 py-0.5 rounded text-[10px] font-bold border whitespace-nowrap",
        cls,
      )}
    >
      {status}
    </span>
  );
}

export function RiskIssues() {
  const {
    issues,
    deleteIssue,
    addIssue,
    updateIssue,
    activeProjectId,
    activeProgrammeId,
    programmes,
    projects,
    user,
    isInitialized,
  } = useStore();

  const [searchParams] = useSearchParams();
  const fromInitiation = searchParams.get("from") === "initiation";
  const userRole = (user?.role || user?.profile?.role) as UserRole | undefined;
  const userIsSuperAdmin = isSuperAdmin(user?.email, userRole);
  const isPM = !isAtLeastClientAdmin(userRole) && !userIsSuperAdmin;
  const canModify = isAtLeastPM(userRole) || userIsSuperAdmin;
  const canDelete = isAtLeastPM(userRole) || userIsSuperAdmin;
  const progLevelLabel = isPM ? "Shared Portfolio" : "Programme Level";

  const [filter, setFilter] = useState({
    status: "",
    priority: "",
    search: "",
  });
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingIssue, setEditingIssue] = useState<IssueItem | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Confirmation modal states
  const [deleteModal, setDeleteModal] = useState<{
    open: boolean;
    id: string;
    title: string;
  } | null>(null);
  const [bulkDeleteModal, setBulkDeleteModal] = useState<{
    open: boolean;
    count: number;
  } | null>(null);

  // Loading states
  const [isDeleting, setIsDeleting] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);

  const safeIssues = Array.isArray(issues) ? issues : [];
  const safeProjects = Array.isArray(projects) ? projects : [];
  const safeProgs = Array.isArray(programmes) ? programmes : [];

  const activeProjName = safeProjects.find(
    (p) => p.id === activeProjectId,
  )?.name;
  const activeProgName = safeProgs.find(
    (p) => p.id === activeProgrammeId,
  )?.name;
  const contextLabel = activeProjName || activeProgName || "All Issues";

  // Reset filter & selection when context switches
  useEffect(() => {
    setFilter((f) => ({ ...f, status: "", priority: "", search: "" }));
    setSelectedIds([]);
  }, [activeProjectId, activeProgrammeId]);

  // Handle URL-based actions from ServiceManagementBar
  useEffect(() => {
    const action = searchParams.get("action");
    const clearAction = () => {
      window.history.replaceState(
        {},
        "",
        `${window.location.pathname}${(() => {
          const p = new URLSearchParams(searchParams);
          p.delete("action");
          return p.toString() ? `?${p.toString()}` : "";
        })()}`,
      );
    };
    if (action === "add-issue") {
      setEditingIssue(null);
      setIsModalOpen(true);
      clearAction();
    } else if (action === "export-issues") {
      handleExport();
      clearAction();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const filtered = safeIssues
    .filter((i) => {
      // Context scope
      if (activeProjectId && i.projectId !== activeProjectId) return false;
      if (
        !activeProjectId &&
        activeProgrammeId &&
        i.programmeId !== activeProgrammeId
      ) {
        // Fallback: include if the issue's project belongs to this programme
        const issProject = safeProjects.find((p) => p.id === i.projectId);
        if (!issProject || issProject.programmeId !== activeProgrammeId)
          return false;
      }

      if (filter.status && i.status !== filter.status) return false;
      if (filter.priority && i.priority.toString() !== filter.priority)
        return false;
      if (filter.search) {
        const q = filter.search.toLowerCase();
        if (
          !i.desc?.toLowerCase().includes(q) &&
          !i.id?.toLowerCase().includes(q)
        )
          return false;
      }
      return true;
    })
    .sort((a, b) => {
      const dateA = new Date(a.dateAdded || 0).getTime();
      const dateB = new Date(b.dateAdded || 0).getTime();
      if (dateA !== dateB) return dateB - dateA;
      return b.id.localeCompare(a.id);
    });

  // Advisory panel — derived from filtered (context-scoped)
  const openIssues = filtered.filter((i) => i.status !== "4. Resolved");
  const escalatedIssues = filtered.filter((i) => i.status === "2. Escalated");
  const avgAge = openIssues.length
    ? Math.round(
        openIssues.reduce(
          (acc, i) => acc + differenceInDays(new Date(), new Date(i.dateAdded)),
          0,
        ) / openIssues.length,
      )
    : 0;

  // ─── CRUD Handlers ──────────────────────────────────────────────────────────

  // Modal-based delete handlers
  const handleDeleteClick = (iss: IssueItem) => {
    if (!canDelete) return;
    setDeleteModal({ open: true, id: iss.id, title: iss.desc || iss.id });
  };

  const confirmDelete = async () => {
    if (!deleteModal) return;
    const { id, title } = deleteModal;
    setIsDeleting(true);
    try {
      await deleteIssue(id);
      toast.success("Issue deleted.");
    } catch (err: any) {
      console.error("[RiskIssues] delete error", err);
      toast.error(err?.message || "Failed to delete issue.");
    } finally {
      setIsDeleting(false);
      setDeleteModal(null);
    }
  };

  const handleBulkDeleteClick = () => {
    if (!canDelete || selectedIds.length === 0) return;
    setBulkDeleteModal({ open: true, count: selectedIds.length });
  };

  const confirmBulkDelete = async () => {
    if (!bulkDeleteModal) return;
    const count = selectedIds.length;
    setIsBulkDeleting(true);
    try {
      await Promise.all(selectedIds.map((id) => deleteIssue(id)));
      toast.success(`Deleted ${count} issue${count > 1 ? "s" : ""}.`);
      setSelectedIds([]);
    } catch (err: any) {
      console.error("[RiskIssues] bulk delete error", err);
      toast.error(err?.message || "Failed to delete issues.");
    } finally {
      setIsBulkDeleting(false);
      setBulkDeleteModal(null);
    }
  };

  const handleExport = () => {
    if (filtered.length === 0) {
      toast.error("No issues to export.");
      return;
    }
    const rows = filtered.map((iss) => ({
      "Issue Ref": iss.id,
      "Risk Ref": iss.linkedRisk || "",
      "Date Added": iss.dateAdded || "",
      "Issue Description": iss.desc || "",
      Impact: iss.impact || "",
      "Issue Owner": iss.owner || "",
      Priority: iss.priority ?? "",
      Severity: iss.severity ?? "",
      Score: iScore(iss.priority, iss.severity).l,
      "Issue Response": iss.response || "",
      "Response Description": iss.responsDesc || "",
      "Control Owner": iss.controlOwner || "",
      "Progress Updates": iss.progress || "",
      "Date Updated": iss.dateUpdated || "",
      "Control Deadline": iss.deadline || "",
      Status: iss.status || "",
      Age: ageCalc(iss.dateAdded, iss.status),
      "Lessons Learnt": iss.lessonsLearnt || "",
      "Source Project":
        safeProjects.find((p) => p.id === iss.projectId)?.name ||
        (iss.isProgrammeLevel ? "Programme Level" : ""),
    }));
    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Issues Register");
    XLSX.writeFile(
      workbook,
      `issues_register_${new Date().toISOString().slice(0, 10)}.xlsx`,
    );
    toast.success(
      `Exported ${filtered.length} issue${filtered.length !== 1 ? "s" : ""}.`,
    );
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === filtered.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filtered.map((i) => i.id));
    }
  };

  const toggleSelectOne = (id: string) =>
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );

  return (
    <>
      <ServiceManagementBar />
      <div className="max-w-[98%] lg:max-w-7xl mx-auto p-2 sm:p-4 lg:p-6 space-y-5 sm:space-y-6">
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
              Issues Register
            </h1>
            <p className="text-sm text-slate-500 mt-0.5">{contextLabel}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {selectedIds.length > 0 && canDelete && (
              <button
                onClick={handleBulkDeleteClick}
                disabled={isBulkDeleting}
                className="flex items-center gap-1.5 px-3 py-2 bg-rose-50 text-rose-600 border border-rose-200 rounded-xl text-sm font-medium hover:bg-rose-100 transition-colors disabled:opacity-50"
              >
                {isBulkDeleting ? (
                  <div className="w-4 h-4 border-2 border-rose-400/30 border-t-rose-500 rounded-full animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4" />
                )}
                Delete ({selectedIds.length})
              </button>
            )}
            {canModify && (
              <button
                onClick={() => {
                  setEditingIssue(null);
                  setIsModalOpen(true);
                }}
                className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 transition-colors shadow-sm"
              >
                <Plus className="w-4 h-4" />
                Add Issue
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

        {/* Summary Tiles — derived from filtered (context-scoped) */}
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
              value: filtered.filter((i) => i.status !== "4. Resolved").length,
              color: "text-red-600",
              border: "border-l-red-500",
            },
            {
              label: "Escalated",
              value: filtered.filter((i) => i.status === "2. Escalated").length,
              color: "text-orange-600",
              border: "border-l-orange-500",
            },
            {
              label: "Implementing Fix",
              value: filtered.filter((i) => i.status === "3. Implementing Fix")
                .length,
              color: "text-blue-600",
              border: "border-l-blue-500",
            },
            {
              label: "Resolved",
              value: filtered.filter((i) => i.status === "4. Resolved").length,
              color: "text-emerald-600",
              border: "border-l-emerald-500",
            },
          ].map((s) => (
            <div
              key={s.label}
              className={clsx(
                "bg-white rounded-xl border border-slate-200 border-l-4 px-4 py-3 shadow-sm hover:shadow-md transition-shadow",
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

        {/* AI Advisory Panel — derived from filtered */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="md:col-span-2 bg-indigo-900 rounded-2xl p-5 text-white shadow-xl relative overflow-hidden">
            <div className="relative z-10">
              <div className="flex items-center gap-2 mb-3">
                <div className="p-1.5 bg-indigo-500/30 rounded-lg">
                  <Lightbulb className="w-5 h-5 text-indigo-200" />
                </div>
                <h2 className="text-sm font-bold uppercase tracking-widest text-indigo-200">
                  Issue Advisory
                </h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-xl font-bold">
                    {escalatedIssues.length > 0
                      ? `${escalatedIssues.length} Escalated Issues`
                      : "No Critical Escalations"}
                  </p>
                  <p className="text-xs text-indigo-200 leading-relaxed">
                    {escalatedIssues.length > 0
                      ? "Immediate management attention required for escalated items to prevent project delays."
                      : "Issue management is currently within normal operating parameters."}
                  </p>
                </div>
                <div className="space-y-1 sm:border-l sm:border-indigo-800 sm:pl-4">
                  <p className="text-xl font-bold">{avgAge}d Average Age</p>
                  <p className="text-xs text-indigo-200 leading-relaxed">
                    {avgAge > 14
                      ? "Resolution cycle time is exceeding 14 days. Review bottleneck in 'Implementing Fix' stage."
                      : "Resolution cycle is healthy. Continue proactive monitoring of investigations."}
                  </p>
                </div>
              </div>
            </div>
            <div className="absolute top-0 right-0 p-8 opacity-10">
              <TrendingUp className="w-32 h-32" />
            </div>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <AlertCircle className="w-4 h-4 text-amber-500" />
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Attention Required
              </h3>
            </div>
            <div className="space-y-3">
              {openIssues.slice(0, 2).map((iss) => (
                <div
                  key={iss.id}
                  className="border-l-2 border-amber-500 pl-3 py-1"
                >
                  <p
                    className="text-xs font-bold text-slate-800 truncate"
                    title={iss.id}
                  >
                    {iss.id}
                  </p>
                  <p
                    className="text-[10px] text-slate-500 line-clamp-1"
                    title={iss.desc}
                  >
                    {iss.desc}
                  </p>
                </div>
              ))}
              {openIssues.length === 0 && (
                <p className="text-xs text-slate-400 italic">
                  No open issues requiring immediate action.
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
          <select
            value={filter.status}
            onChange={(e) => setFilter({ ...filter, status: e.target.value })}
            className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 w-full sm:w-auto"
          >
            <option value="">All Status</option>
            {ISSUE_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <select
            value={filter.priority}
            onChange={(e) => setFilter({ ...filter, priority: e.target.value })}
            className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 w-full sm:w-auto"
          >
            <option value="">All Priority</option>
            {[1, 2, 3, 4, 5].map((p) => (
              <option key={p} value={p}>
                Priority {p}
              </option>
            ))}
          </select>
          <input
            type="search"
            placeholder="Search issues..."
            value={filter.search}
            onChange={(e) => setFilter({ ...filter, search: e.target.value })}
            className="w-full sm:flex-1 min-w-[200px] bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
          />
        </div>

        {/* Full Issues Log Table */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xl shadow-slate-200/50 overflow-x-auto scrollbar-thin scrollbar-thumb-slate-200">
          <table className="w-full text-left text-[11px] border-collapse min-w-[1500px]">
            <thead>
              <tr className="bg-[#111827] text-white uppercase tracking-[0.15em] border-b border-slate-200 text-[9px] font-black sticky top-0 z-20 backdrop-blur-md">
                <th className="p-4 w-8 text-center">
                  <input
                    type="checkbox"
                    className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    checked={
                      filtered.length > 0 &&
                      selectedIds.length === filtered.length
                    }
                    onChange={toggleSelectAll}
                  />
                </th>
                <th className="p-4 whitespace-nowrap">Issue Ref</th>
                <th className="p-4 whitespace-nowrap">Risk Ref</th>
                <th className="p-4">Date Added</th>
                <th className="p-4">Issue Description & Impact</th>
                <th className="p-4">Issue Owner</th>
                <th className="p-4 text-center">
                  P <InfoTooltip content="Priority (1-5)" />
                </th>
                <th className="p-4 text-center">
                  S <InfoTooltip content="Severity (1-5)" />
                </th>
                <th className="p-4">Score</th>
                <th className="p-4">Issue Response</th>
                <th className="p-4">Response Description</th>
                <th className="p-4">Control Owner</th>
                <th className="p-4">Progress Updates</th>
                <th className="p-4">Date Updated</th>
                <th className="p-4">Control Deadline</th>
                <th className="p-4">Status</th>
                <th className="p-4 text-center">Age</th>
                <th className="p-4 text-center">Lessons Learnt</th>
                <th className="p-4 text-right sticky right-0 bg-[#111827] z-20 shadow-[-4px_0_10px_-3px_rgba(0,0,0,0.5)]">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((iss) => {
                const sc = iScore(iss.priority, iss.severity);
                const isRowDeleting = deleteModal?.id === iss.id && isDeleting;
                return (
                  <tr
                    key={iss.id}
                    className={clsx(
                      "hover:bg-slate-50/80 transition-all group border-b border-slate-100",
                      selectedIds.includes(iss.id) && "bg-indigo-50/40",
                      isDeleting && "opacity-60 pointer-events-none",
                    )}
                  >
                    <td className="p-2 text-center">
                      <input
                        type="checkbox"
                        className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                        checked={selectedIds.includes(iss.id)}
                        onChange={() => toggleSelectOne(iss.id)}
                      />
                    </td>
                    <td
                      className="p-2 whitespace-nowrap cursor-pointer"
                      onClick={() => {
                        if (canModify) {
                          setEditingIssue(iss);
                          setIsModalOpen(true);
                        }
                      }}
                    >
                      <div className="font-bold text-indigo-600 hover:underline">
                        {iss.id}
                      </div>
                      <div className="text-[9px] text-slate-400 mt-0.5 whitespace-nowrap">
                        {!iss.projectId
                          ? progLevelLabel
                          : safeProjects.find((p) => p.id === iss.projectId)
                              ?.name || "Project Issue"}
                      </div>
                    </td>
                    <td className="p-2 text-indigo-400 font-medium">
                      {iss.linkedRisk || "—"}
                    </td>
                    <td className="p-2 text-slate-400">
                      {fDate(iss.dateAdded)}
                    </td>
                    <td
                      className="p-2 font-medium text-slate-800 max-w-[200px] truncate"
                      title={iss.desc}
                    >
                      {iss.desc}
                    </td>
                    <td className="p-2 text-slate-600">{iss.owner || "—"}</td>
                    <td className="p-2 text-center font-bold text-slate-700">
                      {iss.priority}
                    </td>
                    <td className="p-2 text-center font-bold text-slate-700">
                      {iss.severity}
                    </td>
                    <td className="p-2">
                      <span
                        className={clsx(
                          "px-2 py-0.5 rounded text-[10px] font-bold border",
                          sc.c,
                        )}
                      >
                        {sc.l}
                      </span>
                    </td>
                    <td className="p-2 text-slate-500">
                      {iss.response || "—"}
                    </td>
                    <td
                      className="p-2 text-slate-500 max-w-[130px] truncate"
                      title={iss.responsDesc}
                    >
                      {iss.responsDesc?.split("\n")[0] || "—"}
                    </td>
                    <td className="p-2 text-slate-500">
                      {iss.controlOwner || "—"}
                    </td>
                    <td
                      className="p-2 text-slate-500 max-w-[140px] truncate"
                      title={iss.progress}
                    >
                      {iss.progress?.split("\n")[0] || "—"}
                    </td>
                    <td className="p-2 text-slate-400">
                      {fDate(iss.dateUpdated)}
                    </td>
                    <td className="p-2 text-slate-500">
                      {fDate(iss.deadline)}
                    </td>
                    <td className="p-2">
                      <StatusBadge status={iss.status} />
                    </td>
                    <td className="p-2 text-center text-slate-400">
                      {ageCalc(iss.dateAdded, iss.status)}
                    </td>
                    <td className="p-2 text-center">
                      {iss.lessonsLearnt ? (
                        <span
                          className="flex items-center justify-center text-emerald-600"
                          title="Lessons Learnt Captured"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                        </span>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                    <td className="p-2 text-right sticky right-0 bg-white z-10 border-l border-slate-100 group-hover:bg-slate-50/80 backdrop-blur-sm shadow-[-4px_0_10px_-3px_rgba(0,0,0,0.1)]">
                      <div className="flex items-center justify-end gap-1.5">
                        {canModify && (
                          <button
                            onClick={() => {
                              setEditingIssue(iss);
                              setIsModalOpen(true);
                            }}
                            className="w-6 h-6 flex items-center justify-center bg-white text-slate-400 border border-slate-200 rounded-lg hover:text-indigo-600 hover:bg-indigo-50 transition-all shadow-sm"
                            title="Edit Issue"
                          >
                            <Edit2 className="w-3 h-3" />
                          </button>
                        )}

                        {canDelete && (
                          <button
                            onClick={() => handleDeleteClick(iss)}
                            disabled={isDeleting}
                            className="w-6 h-6 flex items-center justify-center bg-rose-50 text-rose-400 hover:text-rose-600 hover:bg-rose-100 rounded-lg transition-colors shadow-sm disabled:opacity-50"
                            title="Delete Issue"
                          >
                            {isDeleting ? (
                              <div className="w-3 h-3 border-2 border-rose-300/40 border-t-rose-500 rounded-full animate-spin" />
                            ) : (
                              <Trash2 className="w-3 h-3" />
                            )}
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
            <EmptyState title="No issues found matching your filters." />
          )}
        </div>

        <IssueModal
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false);
            setEditingIssue(null);
          }}
          onSave={async (issueData) => {
            const today = new Date().toISOString().split("T")[0];
            if (editingIssue) {
              await updateIssue(editingIssue.id, {
                ...issueData,
                dateUpdated: today,
              });
              toast.success("Issue updated.");
            } else {
              const newIssue: IssueItem = {
                ...issueData,
                id: generateId("ISS"),
                dateAdded: today,
                projectId: issueData.projectId || activeProjectId || "",
                programmeId: issueData.programmeId || activeProgrammeId || "",
              } as IssueItem;
              await addIssue(newIssue);
              toast.success("Issue added to register.");
            }
          }}
          initialData={editingIssue}
        />

        {/* Delete Confirmation Modal */}
        {deleteModal?.open && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in duration-300">
              <div className="px-6 py-5 border-b border-slate-100 bg-rose-50/50">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-rose-100 rounded-xl">
                    <Trash2 className="w-5 h-5 text-rose-600" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider">
                      Delete Issue
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5 truncate max-w-[200px]">
                      {deleteModal.title}
                    </p>
                  </div>
                </div>
              </div>
              <div className="px-6 py-5">
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
                    {isDeleting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Deleting...
                      </>
                    ) : (
                      "Delete"
                    )}
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
                  <div className="p-2 bg-rose-100 rounded-xl">
                    <Trash2 className="w-5 h-5 text-rose-600" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider">
                      Bulk Delete Issues
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {bulkDeleteModal.count} selected issues
                    </p>
                  </div>
                </div>
              </div>
              <div className="px-6 py-5">
                <p className="text-sm text-slate-600">
                  Are you sure you want to permanently delete{" "}
                  <span className="font-bold text-rose-600">
                    {bulkDeleteModal.count}
                  </span>{" "}
                  selected issues? This action cannot be undone.
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
                    {isBulkDeleting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Deleting...
                      </>
                    ) : (
                      "Delete All"
                    )}
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
