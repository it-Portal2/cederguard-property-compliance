import React, { useState } from "react";
import { useStore } from "../store/useStore";
import { clsx } from "clsx";
import {
  Building2,
  Search,
  Plus,
  Trash2,
  Edit2,
  Download,
  Loader2,
  Filter,
  X,
  ChevronDown,
  ChevronRight,
  BookOpen,
  Layers,
  Archive,
  RefreshCw,
  AlertTriangle,
} from "lucide-react";
import { useNavigate } from "react-router";
import { motion, AnimatePresence } from "motion/react";
import {
  isAtLeastPM,
  isAtLeastClientAdmin,
  isSuperAdmin,
  UserRole,
} from "../lib/roles";
import toast from "react-hot-toast";

// ─── CSV Export Helper ───────────────────────────────────────────────────────

function exportProjectsCSV(projects: any[], programmes: any[]) {
  const headers = ['Name', 'Reference', 'RAG Status', 'Scheme Type', 'RIBA Stage', 'PM', 'Programme', 'Units', 'HRB', 'Start Date', 'End Date', 'Updated'];
  const rows = projects.map(p => {
    const prog = (Array.isArray(programmes) ? programmes : []).find((pr: any) => pr.id === p.programmeId);
    return [
      p.name || 'Untitled',
      p.reference || p.id || '',
      p.rag || 'Green',
      p.type || p.schemeType || '',
      p.riba || '',
      p.pmName || '',
      prog?.name || '',
      p.units || '',
      p.isHRB ? 'Yes' : 'No',
      p.startDate || '',
      p.endDate || '',
      p.updatedAt || '',
    ].map(v => `"${String(v).replace(/"/g, '""')}"`);
  });
  const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `cedarguard-projects-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(link.href);
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function timeAgo(dateStr: string | undefined): string {
  if (!dateStr) return "Never";
  const date = parseAnyDate(dateStr) ?? new Date(dateStr as string);
  if (isNaN(date.getTime())) return "Never";
  const diff = Date.now() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} day${days === 1 ? "" : "s"} ago`;
  const months = Math.floor(days / 30);
  return `${months} month${months === 1 ? "" : "s"} ago`;
}

function parseAnyDate(val: any): Date | null {
  if (!val) return null;
  // Firestore Timestamp: { seconds, nanoseconds } or { _seconds, _nanoseconds }
  const secs = val?.seconds ?? val?._seconds;
  if (typeof secs === "number" && secs > 0) return new Date(secs * 1000);
  // ISO string or any parseable string
  if (typeof val === "string" && val.trim()) {
    const d = new Date(val);
    if (!isNaN(d.getTime())) return d;
  }
  return null;
}

function formatCreatedDate(project: any): string | null {
  const date = parseAnyDate(project.createdAt) ?? parseAnyDate(project.updatedAt);
  if (!date) return null;
  return `Created on ${date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}`;
}

function ragColor(rag: string) {
  if (rag === "Red") return "bg-red-500";
  if (rag === "Amber") return "bg-amber-400";
  return "bg-emerald-500";
}

function ragTextColor(rag: string) {
  if (rag === "Red") return "text-red-600";
  if (rag === "Amber") return "text-amber-600";
  return "text-emerald-600";
}

// ─── Sidebar Filter Block ────────────────────────────────────────────────────

function FilterSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-6">
      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">
        {title}
      </p>
      {children}
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export function Projects() {
  const {
    projects,
    activeProjectId,
    programmes,
    activeProgrammeId,
    setActiveProject,
    setActiveProgramme,
    deleteProject,
    archiveProject,
    unarchiveProject,
    loadProjectData,
    user,
    addNotification,
  } = useStore();
  const navigate = useNavigate();

  const userRole = (user?.role || user?.profile?.role) as UserRole | undefined;
  const userIsSuperAdmin = isSuperAdmin(user?.email, userRole);
  const canCreate = isAtLeastPM(userRole) || userIsSuperAdmin;
  const canEdit = isAtLeastPM(userRole) || userIsSuperAdmin;
  const canDelete = isAtLeastPM(userRole) || userIsSuperAdmin;

  const [searchTerm, setSearchTerm] = useState("");
  const [programmeFilter, setProgrammeFilter] = useState("All");
  const [ragFilter, setRagFilter] = useState("All");
  const [ribaFilter, setRibaFilter] = useState("");
  const [schemeFilter, setSchemeFilter] = useState("All");
  const [flagFilter, setFlagFilter] = useState("");
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [showArchived, setShowArchived] = useState(false);

  // Confirmation modal states
  const [deleteModal, setDeleteModal] = useState<{
    open: boolean;
    id: string;
    name: string;
  } | null>(null);
  const [archiveModal, setArchiveModal] = useState<{
    open: boolean;
    id: string;
    name: string;
    isArchived: boolean;
  } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isArchiving, setIsArchiving] = useState(false);

  // Derived filter lists
  const schemeTypes = Array.from(
    new Set(
      (Array.isArray(projects) ? projects : [])
        .map((p) => p.type || p.schemeType)
        .filter((v): v is string => Boolean(v)),
    ),
  );
  const ribaStages = [
    "S0 - Strategic Definition",
    "S1 - Preparation & Briefing",
    "S2 - Concept Design",
    "S3 - Spatial Coordination",
    "S4 - Technical Design",
    "S5 - Manufacturing & Construction",
    "S6 - Handover",
    "S7 - Use",
  ];

  const filtered = (Array.isArray(projects) ? projects : []).filter((p) => {
    const name = p.name?.toLowerCase() || "";
    const ref = (p.reference || p.id || "").toLowerCase();
    const loc = p.loc?.toLowerCase() || "";
    const pm = (p.pmName || "").toLowerCase();
    const matchSearch =
      !searchTerm ||
      name.includes(searchTerm.toLowerCase()) ||
      ref.includes(searchTerm.toLowerCase()) ||
      loc.includes(searchTerm.toLowerCase()) ||
      pm.includes(searchTerm.toLowerCase());
    const matchProg =
      programmeFilter === "All" || p.programmeId === programmeFilter;
    const matchRag = ragFilter === "All" || (p.rag || "Green") === ragFilter;
    const ribaCode = ribaFilter ? ribaFilter.split("-")[0].trim() : "";
    const matchRiba =
      !ribaFilter ||
      (p.riba || "").includes(ribaCode) ||
      (p.milestones || []).some((m: any) => m.stage === ribaCode);
    const matchScheme =
      schemeFilter === "All" || (p.type || p.schemeType) === schemeFilter;
    const matchFlag =
      !flagFilter ||
      (flagFilter === "HRB" && p.isHRB) ||
      (flagFilter === "Overdue" && (p.overdueCount || 0) > 0) ||
      (flagFilter === "Leaseholders" && p.hasLeaseholders);

    const matchArchived = showArchived ? true : !p.isArchived;

    const isVisible =
      isSuperAdmin(user?.email, userRole) ||
      userRole === "client_admin" ||
      p.pmId === user?.uid ||
      p.projectManagerId === user?.uid ||
      p.createdBy === user?.uid ||
      p.createdBy === user?.email ||
      (user?.profile?.clientId && p.clientId === user.profile.clientId);

    return (
      matchSearch &&
      matchProg &&
      matchRag &&
      matchRiba &&
      matchScheme &&
      matchFlag &&
      matchArchived &&
      isVisible
    );
  }).sort((a, b) => {
    const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return dateB - dateA; // most recently created first
  });

  // Stats
  const total = filtered.length;
  const redCount = filtered.filter((p) => (p.rag || "Green") === "Red").length;
  const amberCount = filtered.filter(
    (p) => (p.rag || "Green") === "Amber",
  ).length;
  const greenCount = filtered.filter(
    (p) => (p.rag || "Green") === "Green",
  ).length;

  const isAdminView = isAtLeastClientAdmin(userRole);

  const handleOpen = async (
    id: string,
    route: string = "/dashboard?viewAs=pm",
  ) => {
    setOpeningId(id);
    try {
      await loadProjectData(id);
      navigate(route);
    } finally {
      setOpeningId(null);
    }
  };

  const visibleProjects = (Array.isArray(projects) ? projects : []).filter(
    (p) => {
      return (
        isSuperAdmin(user?.email, userRole) ||
        userRole === "client_admin" ||
        p.pmId === user?.uid ||
        p.projectManagerId === user?.uid ||
        p.createdBy === user?.uid ||
        p.createdBy === user?.email ||
        (user?.profile?.clientId && p.clientId === user.profile.clientId)
      );
    },
  );

  const ragCounts: Record<string, number> = {
    All: visibleProjects.length,
    Red: 0,
    Amber: 0,
    Green: 0,
  };
  visibleProjects.forEach((p) => {
    ragCounts[p.rag || "Green"] = (ragCounts[p.rag || "Green"] || 0) + 1;
  });

  const progCounts: Record<string, number> = { All: visibleProjects.length };
  visibleProjects.forEach((p) => {
    if (p.programmeId)
      progCounts[p.programmeId] = (progCounts[p.programmeId] || 0) + 1;
  });

  const handleDeleteProject = async (
    e: React.MouseEvent,
    id: string,
    name: string,
  ) => {
    e.stopPropagation();
    setDeleteModal({ open: true, id, name });
  };

  const confirmDeleteProject = async () => {
    if (!deleteModal) return;
    const { id, name } = deleteModal;
    const wasActive = activeProjectId === id;
    setIsDeleting(true);
    try {
      await deleteProject(id);
      toast.success(`Project "${name}" deleted successfully`);
      setDeleteModal(null);
      if (wasActive) {
        navigate("/dashboard");
      }
    } catch (err) {
      console.error("Failed to delete project:", err);
      toast.error("Failed to delete project. Please try again.");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleEditProject = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    navigate(`/projects/edit/${id}`);
  };

  const handleArchiveProject = async (
    e: React.MouseEvent,
    id: string,
    name: string,
    isArchived: boolean,
  ) => {
    e.stopPropagation();
    setArchiveModal({ open: true, id, name, isArchived });
  };

  const confirmArchiveProject = async () => {
    if (!archiveModal) return;
    const { id, name, isArchived } = archiveModal;
    setIsArchiving(true);
    try {
      if (isArchived) {
        await unarchiveProject(id);
        toast.success(`Project "${name}" restored from archive`);
      } else {
        await archiveProject(id);
        toast.success(`Project "${name}" archived successfully`);
      }
    } catch (err) {
      console.error(
        `Failed to ${isArchived ? "unarchive" : "archive"} project:`,
        err,
      );
      toast.error(`Failed to ${isArchived ? "restore" : "archive"} project.`);
    } finally {
      setIsArchiving(false);
      setArchiveModal(null);
    }
  };

  // Helper for programme selection
  const handleProgrammeSelect = (id: string) => {
    setProgrammeFilter(id);
  };

  return (
    <div>
      <div className="flex flex-col md:flex-row gap-8">
        {/* ── MOBILE FILTERS BUTTON ── */}
        {/* ── MOBILE STICKY HEADER ── */}
        <div className="md:hidden sticky top-14 z-30 bg-slate-50/80 backdrop-blur-md -mx-4 px-4 py-3 border-b border-slate-200 space-y-3 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-lg font-black text-slate-900 tracking-tight leading-none mb-1">
                My projects
              </h1>
              <div className="flex items-center gap-2">
                <div className="text-[9px] font-black text-indigo-600 uppercase tracking-widest bg-indigo-50 px-1.5 py-0.5 rounded">
                  {total} TOTAL
                </div>
                <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                  {isAdminView ? "Admin View" : "PM View"}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => { exportProjectsCSV(filtered, programmes); toast.success(`Exported ${filtered.length} projects to CSV`); }}
                className="p-2.5 bg-white border border-slate-200 rounded-lg text-slate-700 shadow-sm transition-transform active:scale-95"
                title="Export CSV"
              >
                <Download className="w-4 h-4 text-slate-400" />
              </button>
              <button
                onClick={() => setShowFilters(true)}
                className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 rounded-lg text-xs font-black text-slate-700 shadow-sm transition-transform active:scale-95"
              >
                <Filter className="w-3.5 h-3.5 text-indigo-500" />
                Filters
                {(programmeFilter !== "All" ||
                  ragFilter !== "All" ||
                  ribaFilter ||
                  schemeFilter !== "All" ||
                  flagFilter) && (
                  <span className="w-1.5 h-1.5 bg-indigo-600 rounded-full" />
                )}
              </button>
            </div>
          </div>
        </div>

        {/* ── MOBILE FILTERS DRAWER ── */}
        <AnimatePresence>
          {showFilters && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setShowFilters(false)}
                className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-60 md:hidden"
              />
              <motion.aside
                initial={{ x: "-100%" }}
                animate={{ x: 0 }}
                exit={{ x: "-100%" }}
                transition={{ type: "spring", damping: 25, stiffness: 200 }}
                className="fixed inset-y-0 left-0 w-70 bg-white z-70 md:hidden shadow-2xl flex flex-col"
              >
                <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                  <h3 className="font-black text-slate-900 uppercase tracking-tight text-sm">
                    Filters
                  </h3>
                  <button
                    onClick={() => setShowFilters(false)}
                    className="p-2 hover:bg-slate-50 rounded-lg transition-colors"
                  >
                    <X className="w-5 h-5 text-slate-400" />
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto p-4 custom-scrollbar pb-24">
                  {renderSidebarContent()}
                </div>
                <div className="p-4 border-t border-slate-100 bg-slate-50">
                  <button
                    onClick={() => setShowFilters(false)}
                    className="w-full py-3 bg-slate-900 text-white font-bold rounded-lg shadow-lg shadow-slate-200 text-sm active:scale-95 transition-transform"
                  >
                    Show {total} Projects
                  </button>
                </div>
              </motion.aside>
            </>
          )}
        </AnimatePresence>

        {/* ── DESKTOP SIDEBAR ── */}
        <aside className="hidden md:block w-60 shrink-0 space-y-2">
          {renderSidebarContent()}
        </aside>

        {/* ── MAIN CONTENT ── */}
        <div className="flex-1 min-w-0">
          {/* Header */}
          {/* Desktop Header - Hidden on Mobile since we have the sticky header */}
          <div className="hidden md:flex flex-row items-end justify-between gap-4 mb-8">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <h1 className="text-xl font-black text-slate-900 tracking-tight">
                  My projects
                </h1>
                <div className="px-3 py-1 bg-indigo-50 text-indigo-600 rounded-full text-xs font-black uppercase tracking-wider shadow-sm">
                  {total} TOTAL
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-sm text-slate-500 font-medium">
                <span className="text-indigo-600 font-bold">
                  {isAdminView
                    ? programmeFilter === "All"
                      ? "All Programmes"
                      : (Array.isArray(programmes) ? programmes : []).find(
                          (p) => p.id === programmeFilter,
                        )?.name
                    : "All Projects"}
                </span>
                <span>·</span>
                <span>
                  {isAdminView ? "Admin view" : "Project Manager view"}
                </span>
                {!isAdminView && (
                  <>
                    <span>·</span>
                    <span className="text-emerald-600 font-bold">
                      Created By You
                    </span>
                  </>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Select any project to view details
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => { exportProjectsCSV(filtered, programmes); toast.success(`Exported ${filtered.length} projects to CSV`); }}
                className="flex items-center justify-center gap-2 px-4 py-2.5 bg-white border border-slate-200 text-slate-700 text-xs font-bold rounded-lg hover:bg-slate-50 hover:border-slate-300 transition-all shadow-sm"
              >
                <Download className="w-4 h-4 text-slate-400" /> Export CSV
              </button>
              {canCreate && (
                <button
                  onClick={() => {
                    setActiveProject(null);
                    setActiveProgramme(null);
                    navigate("/projects/new");
                  }}
                  className="flex items-center gap-2 px-5 py-2.5 bg-slate-900 text-white text-xs font-bold rounded-lg hover:bg-slate-800 transition-all shadow-lg shadow-slate-200"
                >
                  <Plus className="w-4 h-4" /> Create Project
                </button>
              )}
            </div>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
            {[
              {
                label: "Total projects",
                value: total,
                color: "text-slate-800",
              },
              { label: "RAG red", value: redCount, color: "text-red-600" },
              {
                label: "RAG amber",
                value: amberCount,
                color: "text-amber-500",
              },
              {
                label: "RAG green",
                value: greenCount,
                color: "text-emerald-600",
              },
            ].map(({ label, value, color }) => (
              <div
                key={label}
                className="bg-white border border-slate-200 rounded-lg p-4 text-center md:text-left"
              >
                <p className={clsx("text-xl font-black truncate", color)}>
                  {value}
                </p>
                <p className="text-[10px] md:text-xs text-slate-500 mt-0.5 font-bold uppercase tracking-wider">
                  {label}
                </p>
              </div>
            ))}
          </div>

          {/* Project Cards */}
          <div className="space-y-3">
            {filtered.length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-lg p-16 flex flex-col items-center text-center">
                <div className="w-14 h-14 bg-slate-50 rounded-lg flex items-center justify-center mb-4">
                  <Building2 className="w-7 h-7 text-slate-300" />
                </div>
                <h3 className="text-base font-bold text-slate-800">
                  No projects found
                </h3>
                <p className="text-sm text-slate-400 mt-1 max-w-xs">
                  Adjust your filters or create a new project to get started.
                </p>
                <button
                  onClick={() => navigate("/projects/new")}
                  className="mt-5 flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors"
                >
                  <Plus className="w-4 h-4" /> New Project
                </button>
              </div>
            ) : (
              filtered.map((project) => {
                const isActive = activeProjectId === project.id;
                const rag = project.rag || "Green";
                const ref =
                  project.reference ||
                  "P" + (project.id || "").substring(0, 3).toUpperCase();

                return (
                  <div
                    key={project.id}
                    className={clsx(
                      "bg-white border rounded-lg shadow-sm transition-all duration-200 hover:shadow-md hover:border-indigo-200 overflow-hidden",
                      isActive
                        ? "border-indigo-300 ring-1 ring-indigo-200"
                        : "border-slate-200",
                    )}
                  >
                    <div className="relative">
                      {/* Mobile RAG bar indicator */}
                      <div
                        className={clsx(
                          "absolute left-0 top-0 bottom-0 w-1 md:hidden",
                          ragColor(rag),
                        )}
                      />

                      <div className="px-5 py-5 md:py-4 flex items-center gap-4">
                        {/* Ref badge */}
                        <span className="shrink-0 px-2.5 py-1 bg-slate-100 text-slate-600 rounded-lg text-[10px] md:text-[11px] font-black tracking-wide hidden sm:block">
                          {ref}
                        </span>

                        {/* Name & subtitle — clickable to open project dashboard */}
                        <button
                          onClick={() => handleOpen(project.id)}
                          disabled={openingId === project.id}
                          className="flex-1 min-w-0 text-left disabled:opacity-60"
                        >
                          <div className="flex items-center gap-2 min-w-0 mb-1">
                            <span
                              className="font-bold text-slate-900 text-base leading-tight truncate"
                              title={project.name || "Untitled Project"}
                            >
                              {project.name || "Untitled Project"}
                            </span>
                            {project.isHRB && (
                              <span className="px-1.5 py-0.5 bg-orange-100 text-orange-700 rounded text-[9px] font-black uppercase tracking-wider shrink-0">
                                HRB
                              </span>
                            )}
                            <div
                              className={clsx(
                                "w-2 h-2 rounded-full shrink-0 hidden md:block",
                                ragColor(rag),
                              )}
                            />
                            <span
                              className={clsx(
                                "text-xs font-bold shrink-0 hidden md:block",
                                ragTextColor(rag),
                              )}
                            >
                              {rag}
                            </span>
                            {project.isArchived && (
                              <span className="px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded text-[9px] font-black uppercase tracking-wider shrink-0 border border-slate-200">
                                Archived
                              </span>
                            )}
                            {openingId === project.id && (
                              <Loader2 className="w-3.5 h-3.5 text-indigo-400 animate-spin shrink-0" />
                            )}
                          </div>
                          <p
                            className="text-xs text-slate-500 truncate font-medium"
                            title={[
                              project.type || project.schemeType,
                              project.units ? `${project.units} units` : null,
                              project.riba
                                ? `Stage ${project.riba.split(" ")[0]}`
                                : null,
                              formatCreatedDate(project),
                            ]
                              .filter(Boolean)
                              .join(" · ")}
                          >
                            {[
                              project.type || project.schemeType,
                              project.units ? `${project.units} units` : null,
                              project.riba
                                ? `Stage ${project.riba.split(" ")[0]}`
                                : null,
                              formatCreatedDate(project),
                            ]
                              .filter(Boolean)
                              .join(" · ")}
                          </p>
                        </button>

                        {/* Action buttons */}
                        <div className="flex items-center gap-1 shrink-0">
                          {canEdit && (
                            <button
                              onClick={(e) => handleEditProject(e, project.id)}
                              className="p-2 md:p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                              title="Edit Project"
                            >
                              <Edit2 className="w-4 h-4 md:w-3.5 md:h-3.5" />
                            </button>
                          )}
                          {canDelete && (
                            <button
                              onClick={(e) =>
                                handleDeleteProject(e, project.id, project.name)
                              }
                              className="p-2 md:p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-all"
                              title="Delete Project"
                            >
                              <Trash2 className="w-4 h-4 md:w-3.5 md:h-3.5" />
                            </button>
                          )}
                          {canEdit && (
                            <button
                              onClick={(e) =>
                                handleArchiveProject(
                                  e,
                                  project.id,
                                  project.name || "Untitled",
                                  !!project.isArchived,
                                )
                              }
                              className={clsx(
                                "p-2 md:p-1.5 rounded-lg transition-all",
                                project.isArchived
                                  ? "text-emerald-500 hover:text-emerald-700 hover:bg-emerald-50"
                                  : "text-slate-400 hover:text-amber-600 hover:bg-amber-50",
                              )}
                              title={
                                project.isArchived
                                  ? "Unarchive Project"
                                  : "Archive Project"
                              }
                            >
                              {project.isArchived ? (
                                <RefreshCw className="w-4 h-4 md:w-3.5 md:h-3.5" />
                              ) : (
                                <Archive className="w-4 h-4 md:w-3.5 md:h-3.5" />
                              )}
                            </button>
                          )}
                          <ChevronRight className="w-5 h-5 text-slate-300 md:hidden ml-1" />
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* ── MOBILE FAB (Floating Action Button) ── */}
      {canCreate && (
        <button
          onClick={() => {
            setActiveProject(null);
            setActiveProgramme(null);
            navigate("/projects/new");
          }}
          className="md:hidden fixed bottom-28 right-6 w-14 h-14 bg-indigo-600 text-white rounded-full flex items-center justify-center shadow-xl shadow-indigo-300 z-40 active:scale-90 transition-transform hover:scale-105"
          aria-label="Create New Project"
        >
          <Plus className="w-7 h-7" />
        </button>
      )}

      {/* Delete Confirmation Modal */}
      {deleteModal?.open && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-2xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in duration-300">
            <div className="px-6 py-5 border-b border-slate-100 bg-rose-50/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center text-rose-600">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-slate-800 uppercase tracking-tighter text-lg">
                    Delete Project
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5 truncate max-w-50">
                    {deleteModal.name}
                  </p>
                </div>
              </div>
            </div>
            <div className="p-6">
              <p className="text-sm text-slate-600">
                Are you sure you want to permanently delete{" "}
                <span className="font-bold text-rose-600">
                  {deleteModal.name}
                </span>
                ? This will delete all associated data and cannot be undone.
              </p>
              <div className="pt-5 flex gap-3">
                <button
                  onClick={() => setDeleteModal(null)}
                  disabled={isDeleting}
                  className="flex-1 px-4 py-2.5 border border-slate-200 text-slate-600 rounded-lg text-xs font-black uppercase hover:bg-slate-50 transition-colors tracking-widest disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDeleteProject}
                  disabled={isDeleting}
                  className="flex-1 px-4 py-2.5 bg-rose-600 text-white rounded-lg text-xs font-black uppercase hover:bg-rose-700 transition-all shadow-lg shadow-rose-200 tracking-widest disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
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

      {/* Archive/Unarchive Confirmation Modal */}
      {archiveModal?.open && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-2xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in duration-300">
            <div
              className={clsx(
                "px-6 py-5 border-b border-slate-100",
                archiveModal.isArchived ? "bg-emerald-50/50" : "bg-amber-50/50",
              )}
            >
              <div className="flex items-center gap-3">
                <div
                  className={clsx(
                    "w-10 h-10 rounded-full flex items-center justify-center",
                    archiveModal.isArchived
                      ? "bg-emerald-100 text-emerald-600"
                      : "bg-amber-100 text-amber-600",
                  )}
                >
                  {archiveModal.isArchived ? (
                    <RefreshCw className="w-5 h-5" />
                  ) : (
                    <Archive className="w-5 h-5" />
                  )}
                </div>
                <div>
                  <h3 className="font-black text-slate-800 uppercase tracking-tighter text-lg">
                    {archiveModal.isArchived
                      ? "Restore Project"
                      : "Archive Project"}
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5 truncate max-w-50">
                    {archiveModal.name}
                  </p>
                </div>
              </div>
            </div>
            <div className="p-6">
              <p className="text-sm text-slate-600">
                Are you sure you want to{" "}
                {archiveModal.isArchived ? "restore" : "archive"}{" "}
                <span
                  className={clsx(
                    "font-bold",
                    archiveModal.isArchived
                      ? "text-emerald-600"
                      : "text-amber-600",
                  )}
                >
                  {archiveModal.name}
                </span>
                ?
                {archiveModal.isArchived
                  ? " This will restore the project to active status."
                  : " This will move the project to archives."}
              </p>
              <div className="pt-5 flex gap-3">
                <button
                  onClick={() => setArchiveModal(null)}
                  disabled={isArchiving}
                  className="flex-1 px-4 py-2.5 border border-slate-200 text-slate-600 rounded-lg text-xs font-black uppercase hover:bg-slate-50 transition-colors tracking-widest disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmArchiveProject}
                  disabled={isArchiving}
                  className={clsx(
                    "flex-1 px-4 py-2.5 text-white rounded-lg text-xs font-black uppercase transition-all shadow-lg tracking-widest disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2",
                    archiveModal.isArchived
                      ? "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-200"
                      : "bg-amber-600 hover:bg-amber-700 shadow-amber-200",
                  )}
                >
                  {isArchiving && (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  )}
                  {isArchiving
                    ? "Processing..."
                    : archiveModal.isArchived
                      ? "Restore"
                      : "Archive"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  function renderSidebarContent() {
    return (
      <div className="space-y-6">
        {/* Search */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search projects..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-8 pr-3 py-2.5 bg-white border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all shadow-sm"
          />
        </div>

        {/* All Programme - Only for admins */}
        {isAdminView && (
          <FilterSection title="Programme">
            <div className="space-y-1">
              <button
                onClick={() => handleProgrammeSelect("All")}
                className={clsx(
                  "w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold transition-all duration-300",
                  programmeFilter === "All"
                    ? "bg-white text-indigo-700 shadow-sm border-indigo-100 ring-1 ring-indigo-50 active:scale-[0.98]"
                    : "text-slate-500 hover:bg-indigo-50/50 hover:text-indigo-600 hover:shadow-sm active:scale-95",
                )}
              >
                <span>All Programmes</span>
                <span
                  className={clsx(
                    "text-[10px] px-2 py-0.5 rounded-full font-bold",
                    programmeFilter === "All"
                      ? "bg-indigo-600 text-white"
                      : "bg-slate-200 text-slate-600",
                  )}
                >
                  {(Array.isArray(programmes) ? programmes : []).length}
                </span>
              </button>
              {(Array.isArray(programmes) ? programmes : []).map((prog) => (
                <button
                  key={prog.id}
                  onClick={() => handleProgrammeSelect(prog.id)}
                  className={clsx(
                    "w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-all duration-300 ml-2 border-l-2",
                    programmeFilter === prog.id
                      ? "bg-white text-indigo-700 font-bold border-indigo-600 shadow-sm scale-[1.01]"
                      : "text-slate-500 hover:bg-indigo-50/30 hover:text-indigo-600 border-transparent hover:border-indigo-200 hover:shadow-sm active:scale-95",
                  )}
                >
                  <span className="truncate text-left" title={prog.name}>
                    {prog.name}
                  </span>
                  <span
                    className={clsx(
                      "text-[10px] px-1.5 py-0.5 rounded-full font-bold shrink-0 ml-1",
                      programmeFilter === prog.id
                        ? "bg-indigo-100 text-indigo-600"
                        : "bg-slate-100 text-slate-400",
                    )}
                  >
                    {progCounts[prog.id] || 0}
                  </span>
                </button>
              ))}
            </div>
          </FilterSection>
        )}

        {/* All Project (Contextual) */}
        <FilterSection title="Quick Access">
          <div className="space-y-1">
            <div className="mt-2 space-y-0.5 max-h-50 overflow-y-auto pr-1 custom-scrollbar">
              {filtered.slice(0, 10).map((p) => (
                <button
                  key={p.id}
                  onClick={() => handleOpen(p.id)}
                  className="w-full text-left px-3 py-1.5 text-[11px] text-slate-500 hover:text-indigo-600 hover:bg-indigo-50/50 rounded-md transition-all truncate"
                  title={p.name}
                >
                  {p.name}
                </button>
              ))}
              {filtered.length > 10 && (
                <p className="text-[10px] text-slate-400 px-3 py-1 italic">
                  +{filtered.length - 10} more...
                </p>
              )}
            </div>
          </div>
        </FilterSection>

        {/* Archiving Toggle */}
        <FilterSection title="View Options">
          <button
            onClick={() => setShowArchived(!showArchived)}
            className={clsx(
              "w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold transition-all duration-300",
              showArchived
                ? "bg-amber-50 text-amber-700 border border-amber-200 shadow-sm"
                : "text-slate-500 hover:bg-slate-50 border border-transparent hover:shadow-sm",
            )}
          >
            <div className="flex items-center gap-2">
              <Archive className="w-3.5 h-3.5" />
              <span>Show Archived</span>
            </div>
            <div
              className={clsx(
                "w-8 h-4 rounded-full relative transition-colors duration-200",
                showArchived ? "bg-amber-400" : "bg-slate-200",
              )}
            >
              <div
                className={clsx(
                  "absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all duration-200",
                  showArchived ? "left-4.5" : "left-0.5",
                )}
              />
            </div>
          </button>
        </FilterSection>

        {/* RAG Status */}
        <FilterSection title="RAG Status">
          <div className="grid grid-cols-2 gap-1.5">
            {(["All", "Red", "Amber", "Green"] as const).map((r) => (
              <button
                key={r}
                onClick={() => setRagFilter(r)}
                className={clsx(
                  "flex items-center gap-2 px-2.5 py-2 rounded-lg text-[11px] font-bold border transition-all duration-300",
                  ragFilter === r
                    ? "bg-white border-slate-900 text-slate-900 shadow-sm scale-[1.02]"
                    : "bg-slate-50/50 border-transparent text-slate-400 hover:bg-white hover:border-slate-200 hover:text-slate-600 hover:shadow-md hover:-translate-y-0.5 active:scale-95",
                )}
              >
                {r !== "All" && (
                  <div className={clsx("w-2 h-2 rounded-full", ragColor(r))} />
                )}
                <span>{r}</span>
              </button>
            ))}
          </div>
        </FilterSection>

        {/* RIBA Stages */}
        <FilterSection title="RIBA Stages">
          <div className="space-y-1">
            <div className="space-y-0.5">
              <button
                onClick={() => setRibaFilter("")}
                className={clsx(
                  "w-full text-left px-3 py-1.5 text-xs rounded-lg transition-all duration-300",
                  !ribaFilter
                    ? "bg-white text-indigo-700 font-bold shadow-sm border border-indigo-100"
                    : "text-slate-500 hover:bg-indigo-50/30 hover:text-indigo-600 hover:shadow-sm",
                )}
              >
                All Stages
              </button>
              {ribaStages.map((s) => {
                const stageCode = s.split(" ")[0];
                const count = visibleProjects.filter(
                  (p) =>
                    (p.riba || "").includes(stageCode) ||
                    (p.milestones || []).some(
                      (m: any) => m.stage === stageCode,
                    ),
                ).length;
                return (
                  <button
                    key={s}
                    onClick={() => setRibaFilter(s)}
                    className={clsx(
                      "w-full flex items-center justify-between px-3 py-1.5 text-[11px] rounded-lg transition-all duration-300",
                      ribaFilter === s
                        ? "bg-white text-indigo-700 font-bold shadow-sm border border-indigo-100"
                        : "text-slate-500 hover:bg-indigo-50/30 hover:text-indigo-600 hover:shadow-sm",
                    )}
                  >
                    <span className="truncate text-left" title={s}>
                      {s}
                    </span>
                    <span className="text-[9px] opacity-60 font-black ml-2">
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </FilterSection>

        {/* Scheme Types */}
        <FilterSection title="Scheme Types">
          <div className="space-y-1">
            <button
              onClick={() => setSchemeFilter("All")}
              className={clsx(
                "w-full text-left px-3 py-1.5 text-xs rounded-lg transition-all duration-300",
                schemeFilter === "All"
                  ? "bg-white text-indigo-700 font-bold shadow-sm border border-indigo-100"
                  : "text-slate-500 hover:bg-indigo-50/30 hover:text-indigo-600 hover:shadow-sm",
              )}
            >
              All Types
            </button>
            {schemeTypes.map((st) => {
              const c = (Array.isArray(projects) ? projects : []).filter(
                (p) => (p.type || (p as any).schemeType) === st,
              ).length;
              return (
                <button
                  key={st}
                  onClick={() => setSchemeFilter(st)}
                  className={clsx(
                    "w-full flex items-center justify-between px-3 py-1.5 text-[11px] rounded-lg transition-all duration-300 text-left",
                    schemeFilter === st
                      ? "bg-white text-indigo-700 font-bold shadow-sm border border-indigo-100"
                      : "text-slate-500 hover:bg-indigo-50/30 hover:text-indigo-600 hover:shadow-sm",
                  )}
                >
                  <span className="truncate" title={st}>
                    {st}
                  </span>
                  <span className="text-[9px] opacity-60 font-black">{c}</span>
                </button>
              );
            })}
          </div>
        </FilterSection>

        {/* Flags */}
        <FilterSection title="Flags">
          <div className="space-y-1">
            {[
              {
                key: "HRB",
                label: "HRB schemes",
                count: (Array.isArray(projects) ? projects : []).filter(
                  (p) => p.isHRB,
                ).length,
              },
              {
                key: "Overdue",
                label: "Overdue actions",
                count: (Array.isArray(projects) ? projects : []).filter(
                  (p) => (p.overdueCount || 0) > 0,
                ).length,
              },
              {
                key: "Leaseholders",
                label: "Leaseholders",
                count: (Array.isArray(projects) ? projects : []).filter(
                  (p) => p.hasLeaseholders,
                ).length,
              },
            ].map(({ key, label, count }) => (
              <button
                key={key}
                onClick={() => setFlagFilter(flagFilter === key ? "" : key)}
                className={clsx(
                  "w-full flex items-center justify-between px-3 py-1.5 text-[11px] rounded-lg transition-all font-medium",
                  flagFilter === key
                    ? "bg-amber-50 text-amber-700 border border-amber-200"
                    : "text-slate-500 hover:bg-slate-50 border border-transparent",
                )}
              >
                <span>{label}</span>
                <span
                  className={clsx(
                    "text-[9px] px-1.5 py-0.5 rounded-full font-black",
                    flagFilter === key
                      ? "bg-amber-200 text-amber-800"
                      : "bg-slate-100 text-slate-400",
                  )}
                >
                  {count}
                </span>
              </button>
            ))}
          </div>
        </FilterSection>
      </div>
    );
  }
}
