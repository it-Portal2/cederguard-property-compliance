import { getRIBALabel } from "../constants/ribaStages";
import { useState, useEffect, useRef } from "react";
import { useStore } from "../store/useStore";
import { Link, useNavigate, useSearchParams } from "react-router";
import { InfoTooltip } from "../components/InfoTooltip";
import { api, ApiError } from "../lib/api";
import { AIErrorAlert } from "../components/AIErrorAlert";
import {
  FolderKanban,
  Loader2,
  Plus,
  TrendingUp,
  Milestone,
  Shield,
  ShieldCheck,
  ScanSearch,
  Briefcase,
  AlertTriangle,
  CheckCircle,
  PoundSterling,
  BarChart,
  ListFilter,
  ShieldAlert,
  ArrowLeft,
  Eye,
  ChevronRight,
  Trash2,
  LayoutTemplate,
  FileBarChart,
  PieChart,
  Layers,
  BookOpen,
  AlertCircle,
  ArrowRight,
  Star,
  Calendar,
} from "lucide-react";
import {
  isSuperAdmin,
  isAtLeastClientAdmin,
  isAtLeastPM,
  isAtLeastProgrammeManager,
  UserRole,
} from "../lib/roles";
import { clsx } from "clsx";
import { analyzeStrategicInsights } from "../services/aiService";
import { stripMarkdown, parseAISuggestion } from "../lib/utils";
import { motion, AnimatePresence } from "motion/react";

export function Dashboard() {
  const {
    complianceItems,
    complianceAnalysis,
    risks,
    issues,
    loadDemoData,
    clearData,
    user,
    activeProjectId,
    activeProgrammeId,
    programmes,
    projects,
    setActiveProject,
    setActiveProgramme,
    loadProjectData,
    loadProgrammeData,
    loadAggregateData,
    deleteProject,
    isInitialized,
    setContextSwitching,
  } = useStore();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isViewingAsPM = searchParams.get("viewAs") === "pm";
  const [loadingDemo, setLoadingDemo] = useState(false);
  const [loadingClear, setLoadingClear] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);

  const userRole = (user?.role || user?.profile?.role) as UserRole | undefined;
  const userIsSuperAdmin = isSuperAdmin(user?.email, userRole);
  const isClientAdmin =
    (isAtLeastClientAdmin(userRole) || userIsSuperAdmin) && !isViewingAsPM;
  const isProjectManager =
    isAtLeastPM(userRole) ||
    isAtLeastProgrammeManager(userRole) ||
    userIsSuperAdmin;

  const [loadingOverview, setLoadingOverview] = useState(false);
  const [isLoadingContent, setIsLoadingContent] = useState(false);
  const [strategicInsights, setStrategicInsights] = useState<any>(null);
  const [generatingInsights, setGeneratingInsights] = useState(false);
  const [aiError, setAiError] = useState<string | ApiError | null>(null);
  const [showFullDetails, setShowFullDetails] = useState(false);

  const safeProjects = Array.isArray(projects) ? projects : [];
  const safeProgrammes = Array.isArray(programmes) ? programmes : [];
  const safeRisks = Array.isArray(risks) ? risks : [];
  const safeIssues = Array.isArray(issues) ? issues : [];
  const safeComplianceItems = Array.isArray(complianceItems)
    ? complianceItems
    : [];

  const activeProject = safeProjects.find((p) => p.id === activeProjectId);
  const activeProgramme = safeProgrammes.find(
    (p) => p.id === activeProgrammeId,
  );

  // Refs for derived values that the effect _reads_ but should NOT be deps.
  // These are stable booleans; putting them in the dep array is misleading
  // and can mask bugs when other deps also change in the same tick.
  const isClientAdminRef = useRef(isClientAdmin);
  isClientAdminRef.current = isClientAdmin;
  const isProjectManagerRef = useRef(isProjectManager);
  isProjectManagerRef.current = isProjectManager;

  // Version counter: incremented every time the effect fires.
  // When a stale async load completes, it compares its captured version
  // against the current ref — if they differ, the load is stale and its
  // results are silently discarded, preventing the infinite flicker loop.
  const loadVersionRef = useRef(0);

  // Load data when active context changes
  useEffect(() => {
    if (!isInitialized) return;

    const version = ++loadVersionRef.current;
    const isStale = () => loadVersionRef.current !== version;

    if (activeProjectId) {
      setLoadingOverview(false);
      setIsLoadingContent(true);
      void loadProjectData(activeProjectId).finally(() => {
        if (!isStale()) {
          setIsLoadingContent(false);
          setContextSwitching(false);
        }
      });
    } else if (activeProgrammeId) {
      setLoadingOverview(false);
      setIsLoadingContent(true);
      void loadProgrammeData(activeProgrammeId).finally(() => {
        if (!isStale()) {
          setIsLoadingContent(false);
          setContextSwitching(false);
        }
      });
    } else if (isClientAdminRef.current || isProjectManagerRef.current) {
      setIsLoadingContent(false);
      setLoadingOverview(true);
      void loadAggregateData().finally(() => {
        if (!isStale()) {
          setLoadingOverview(false);
          setContextSwitching(false);
        }
      });
    } else {
      setIsLoadingContent(false);
      setLoadingOverview(false);
      setContextSwitching(false);
    }

    if (!isStale()) {
      setStrategicInsights(null);
      setAiError(null);
    }

    // Cleanup: mark this version as stale so any still-running async load
    // from this effect won't update state after we re-fire.
    return () => {
      loadVersionRef.current++;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isInitialized, activeProjectId, activeProgrammeId]);

  // Sync URL params to store context
  useEffect(() => {
    const pId = searchParams.get("projectId");
    const prId = searchParams.get("programmeId");
    if (pId && activeProjectId !== pId) {
      setActiveProject(pId);
    } else if (prId && activeProgrammeId !== prId) {
      setActiveProgramme(prId);
    }
  }, [
    searchParams,
    activeProjectId,
    activeProgrammeId,
    setActiveProject,
    setActiveProgramme,
  ]);

  const handleLoadDemo = async () => {
    setLoadingDemo(true);
    try {
      await loadDemoData();
    } catch (err) {
      console.error("Failed to load demo data:", err);
    } finally {
      setLoadingDemo(false);
    }
  };

  const handleClearData = async () => {
    if (!confirmClear) {
      setConfirmClear(true);
      setTimeout(() => setConfirmClear(false), 3000);
      return;
    }
    setLoadingClear(true);
    try {
      await clearData();
      setStrategicInsights(null);
      setAiError(null);
      setConfirmClear(false);
    } catch (err) {
      console.error("Failed to clear data:", err);
    } finally {
      setLoadingClear(false);
    }
  };


  // Filter projects for PM - show projects owned by the user or projects for their client if they have permissions
  const displayProjects = safeProjects.filter((p) => !p.isArchived);

  // Filter programmes for PMs based on their assignment
  const displayProgrammes = safeProgrammes.filter((p) => !p.isArchived);

  // Filter items based on active context for accurate stats
  const allContextCompliance = safeComplianceItems.filter((c) => {
    if (activeProjectId) return c.projectId === activeProjectId;
    if (activeProgrammeId) {
      const isProgLevel = c.programmeId === activeProgrammeId;
      const belongsToProgProject = safeProjects.some(
        (p) => p.id === c.projectId && p.programmeId === activeProgrammeId,
      );
      return isProgLevel || belongsToProgProject;
    }
    if (isClientAdmin) return true;
    return displayProjects.some((p) => p.id === c.projectId);
  });

  // Only count 'applicable' items for stats — same as ComplianceDashboard's getActiveItems()
  // Treat items without an explicit status (or unrecognised status) as 'applicable'
  const contextCompliance = allContextCompliance.filter(
    (i) => !i.status || i.status === "applicable",
  );
  const pendingComplianceCount = allContextCompliance.filter(
    (i) => i.status === "pending",
  ).length;

  const contextRisks = safeRisks.filter((r) => {
    if (activeProjectId) return r.projectId === activeProjectId;
    if (activeProgrammeId) {
      const isProgLevel =
        r.programmeId === activeProgrammeId || !!r.isProgrammeLevel;
      const belongsToProgProject = safeProjects.some(
        (p) => p.id === r.projectId && p.programmeId === activeProgrammeId,
      );
      return isProgLevel || belongsToProgProject;
    }
    if (isClientAdmin) return true;
    return displayProjects.some((p) => p.id === r.projectId);
  });

  const contextIssues = safeIssues.filter((i) => {
    if (activeProjectId) return i.projectId === activeProjectId;
    if (activeProgrammeId) {
      const isProgLevel =
        i.programmeId === activeProgrammeId || !!i.isProgrammeLevel;
      const belongsToProgProject = safeProjects.some(
        (p) => p.id === i.projectId && p.programmeId === activeProgrammeId,
      );
      return isProgLevel || belongsToProgProject;
    }
    if (isClientAdmin) return true;
    return displayProjects.some((p) => p.id === i.projectId);
  });

  // Progressive rendering: only show section skeletons when data for that section
  // hasn't arrived yet. This mirrors the pattern used by ComplianceDashboard and
  // RiskRegister which render instantly from store data.
  const isLoadingCompliance = (isLoadingContent || loadingOverview) && contextCompliance.length === 0;
  const isLoadingRisks = (isLoadingContent || loadingOverview) && contextRisks.length === 0 && contextIssues.length === 0;
  // Keep legacy isLoading only for the Portfolio Overview section (aggregate stats)
  const isLoading = loadingOverview;

  // Compliance Stats — stage values must match ComplianceDashboard exactly:
  //   Complete  → stage 'Live' or 'Archived'
  //   Open      → stage 'Information Gap' or 'Risk Identified'
  //   High risk → risk 'High' or 'Critical'
  const compIsComplete = (s?: string) => s === "Live" || s === "Archived";
  const compIsOpen = (s?: string) =>
    s === "Information Gap" || s === "Risk Identified";
  const compIsHighRisk = (r?: string) => r === "High" || r === "Critical";

  const compTotal = contextCompliance.length; // Active framework scope only, unverified pending items are excluded from total
  const compApplicable = contextCompliance.length;
  const compComplete = contextCompliance.filter((i) =>
    compIsComplete(i.stage),
  ).length;
  const compInProgress = contextCompliance.filter(
    (i) => i.stage === "In Progress",
  ).length;
  const compNotStarted = contextCompliance.filter((i) =>
    compIsOpen(i.stage),
  ).length;
  const compHighRisk = contextCompliance.filter(
    (i) => compIsHighRisk(i.risk) && !compIsComplete(i.stage),
  ).length;
  const compPct = compApplicable
    ? Math.round((compComplete / compApplicable) * 100)
    : 0;

  // Risk Stats
  const riskTotal = contextRisks.length;
  const riskOpen = contextRisks.filter((r) => r.status === "Open").length;
  const riskHigh = contextRisks.filter(
    (r) => (r.grossRating || 0) >= 16,
  ).length;
  const riskEscalated = contextRisks.filter((r) => r.escalated).length;
  const riskResidualALE = contextRisks.reduce(
    (s, r) => s + (r.residualALE || 0),
    0,
  );

  // Issues Stats
  const issueTotal = contextIssues.length;
  const issueOpen = contextIssues.filter(
    (i) => i.status !== "4. Resolved",
  ).length;
  const issueEscalated = contextIssues.filter(
    (i) => i.status === "2. Escalated",
  ).length;

  const topRisks = [...contextRisks]
    .sort((a, b) => (b.grossRating || 0) - (a.grossRating || 0))
    .slice(0, 5);

  const isComplianceSetup = contextCompliance.length > 0;
  const isRiskSetup = contextRisks.length > 0;

  const handleGenerateInsights = async () => {
    setGeneratingInsights(true);
    setAiError(null);
    try {
      const insights = await analyzeStrategicInsights({
        compliance: {
          total: compTotal,
          complete: compComplete,
          pct: compPct,
          highRisk: compHighRisk,
        },
        risks: {
          total: riskTotal,
          open: riskOpen,
          high: riskHigh,
          ale: riskResidualALE,
        },
        issues: {
          total: issueTotal,
          open: issueOpen,
          escalated: issueEscalated,
        },
        projects: isProjectManager ? safeProjects : undefined,
      });
      setStrategicInsights(insights);
    } catch (err: any) {
      console.error("Failed to generate strategic insights:", err);
      setAiError(
        err instanceof ApiError
          ? err
          : err.message || "Failed to generate AI insights. Please try again.",
      );
    } finally {
      setGeneratingInsights(false);
    }
  };

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8">
      {/* ─── GLOBAL CONTEXT SELECTOR ─── */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center shrink-0 border border-indigo-100">
            <LayoutTemplate className="w-5 h-5 text-indigo-600" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              {activeProjectId
                ? "Active Project"
                : activeProgrammeId
                  ? "Active Programme"
                  : "Portfolio Aggregate"}
            </h3>
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">
              {activeProject?.name ||
                activeProgramme?.name ||
                "All Authorized Projects"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 bg-slate-50 p-1.5 rounded-xl border border-slate-200/60 w-full md:w-auto">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200 rounded-lg shadow-sm w-full md:w-auto">
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider shrink-0">
              Context:
            </span>
            <select
              value={
                activeProjectId
                  ? `project:${activeProjectId}`
                  : activeProgrammeId
                    ? `programme:${activeProgrammeId}`
                    : "all"
              }
              onChange={(e) => {
                const [type, id] = e.target.value.split(":");
                setContextSwitching(true);
                
                // Set IDs and let the useEffect handle data loading.
                // setContextSwitching(false) is called in the useEffect's .finally() 
                // via the loading state flags — no hardcoded timers.
                if (type === "all") {
                  setActiveProject(null);
                  setActiveProgramme(null);
                  navigate("/dashboard");
                } else if (type === "programme") {
                  setActiveProject(null);
                  setActiveProgramme(id);
                  navigate(`/dashboard?programmeId=${id}`);
                } else if (type === "project") {
                  setActiveProgramme(null);
                  setActiveProject(id);
                  navigate(`/dashboard?projectId=${id}`);
                }
              }}
              className="bg-transparent border-none text-xs font-bold text-indigo-600 focus:ring-0 cursor-pointer w-full md:min-w-[240px]"
            >
              <option value="all">
                {isProjectManager
                  ? "Portfolio Aggregate (All)"
                  : "My Projects (Aggregate)"}
              </option>

              {isProjectManager && displayProgrammes.length > 0 && (
                <optgroup label="BY PROGRAMME">
                  {displayProgrammes.map((p) => (
                    <option
                      key={p.id}
                      value={`programme:${p.id}`}
                      title={stripMarkdown(p.name)}
                    >
                      {stripMarkdown(p.name)}
                    </option>
                  ))}
                </optgroup>
              )}

              {displayProjects.length > 0 && (
                <optgroup label="BY PROJECT">
                  {displayProjects.map((p) => (
                    <option
                      key={p.id}
                      value={`project:${p.id}`}
                      title={stripMarkdown(p.name)}
                    >
                      {stripMarkdown(p.name)}
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
          </div>
        </div>
      </motion.div>

      {/* ─── CLIENT ADMIN BACKDOOR BANNER ─── */}
      {isViewingAsPM &&
        isClientAdmin &&
        activeProjectId &&
        (() => {
          const proj = safeProjects.find((p) => p.id === activeProjectId);
          return (
            <div className="flex items-center justify-between gap-4 bg-amber-50 border border-amber-200 rounded-2xl px-5 py-3 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-amber-100 rounded-xl flex items-center justify-center shrink-0">
                  <Eye className="w-4 h-4 text-amber-600" />
                </div>
                <div>
                  <p className="text-xs font-black text-amber-800 uppercase tracking-widest">
                    Admin Backdoor — PM View
                  </p>
                  <p className="text-xs text-amber-700 font-medium mt-0.5">
                    You are viewing{" "}
                    <strong>{proj?.name || "this project"}</strong> as the
                    Project Manager. This is a read-only administrative
                    oversight view.
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setActiveProject(null);
                  navigate("/projects");
                }}
                className="flex items-center gap-1.5 px-4 py-2 bg-amber-100 hover:bg-amber-200 text-amber-800 text-xs font-bold rounded-lg transition-colors shrink-0 whitespace-nowrap"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> Back to Projects
              </button>
            </div>
          );
        })()}

      {/* ─── PORTFOLIO OVERVIEW — Visible to all PMs/Admins on Aggregate View ─── */}
      {isProjectManager && !activeProjectId && !activeProgrammeId && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative bg-white rounded-3xl border border-slate-200 shadow-xl shadow-slate-200/40 overflow-hidden"
        >
          <div className="absolute top-0 left-0 w-full h-1 bg-linear-to-r from-indigo-500 via-purple-500 to-indigo-600" />

          <div className="p-4 md:p-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 md:gap-0 mb-6 md:mb-8">
              <div>
                <h2 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight">
                  {isClientAdmin
                    ? "Portfolio Overview"
                    : "My Project Portfolio"}
                </h2>
                <p className="text-slate-500 text-xs md:text-sm font-medium mt-1">
                  {isClientAdmin
                    ? "Global oversight across all managers and active projects"
                    : "Overview of your assigned projects and portfolio."}
                </p>
              </div>
              <div className="flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-600 rounded-xl font-bold text-xs uppercase tracking-widest border border-indigo-100/50">
                {loadingOverview ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Layers className="w-3.5 h-3.5" />
                )}
                Live Status
              </div>
            </div>

            {loadingOverview ? (
              <div className="mb-8">
                <SkeletonStatCards count={isClientAdmin ? 5 : 4} />
              </div>
            ) : null}
            <div
              className={clsx(
                "grid gap-4 mb-8",
                isClientAdmin
                  ? "grid-cols-2 lg:grid-cols-5"
                  : "grid-cols-2 lg:grid-cols-4",
                loadingOverview && "hidden",
              )}
            >
              <div className="bg-slate-50 rounded-2xl p-5 border border-slate-100 transition-all hover:bg-white hover:shadow-lg hover:shadow-indigo-500/5 group">
                <div className="text-3xl font-black text-slate-900 group-hover:text-indigo-600 transition-colors">
                  {displayProgrammes.length}
                </div>
                <div className="text-[10px] text-slate-400 mt-1 font-black uppercase tracking-widest">
                  Total Programmes
                </div>
              </div>
              <div className="bg-slate-50 rounded-2xl p-5 border border-slate-100 transition-all hover:bg-white hover:shadow-lg hover:shadow-indigo-500/5 group">
                <div className="text-3xl font-black text-slate-900 group-hover:text-indigo-600 transition-colors">
                  {displayProjects.length}
                </div>
                <div className="text-[10px] text-slate-400 mt-1 font-black uppercase tracking-widest">
                  Total Projects
                </div>
              </div>
              <div className="bg-slate-50 rounded-2xl p-5 border border-slate-100 transition-all hover:bg-white hover:shadow-lg hover:shadow-emerald-500/5 group">
                <div className="text-3xl font-black text-emerald-600">
                  {displayProjects.filter((p: any) => p.isPublished).length}
                </div>
                <div className="text-[10px] text-slate-400 mt-1 font-black uppercase tracking-widest">
                  Published
                </div>
              </div>
              <div className="bg-slate-50 rounded-2xl p-5 border border-slate-100 transition-all hover:bg-white hover:shadow-lg hover:shadow-amber-500/5 group">
                <div className="text-3xl font-black text-amber-500">
                  {displayProjects.filter((p: any) => !p.isPublished).length}
                </div>
                <div className="text-[10px] text-slate-400 mt-1 font-black uppercase tracking-widest">
                  Draft / In Progress
                </div>
              </div>
              {isClientAdmin && (
                <div className="bg-slate-900 rounded-2xl p-5 shadow-lg shadow-slate-900/20 flex flex-col justify-between">
                  <Link to="/setup/workspace" className="block">
                    <div className="text-xl font-bold text-white flex items-center gap-2 mb-1">
                      <Plus className="w-5 h-5 text-indigo-400" /> Invite PM
                    </div>
                    <div className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">
                      Workspace Management
                    </div>
                  </Link>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Monitoring Tools */}
              <div className="lg:col-span-1 space-y-3">
                <p className="text-[11px] text-slate-400 font-black uppercase tracking-widest ml-1">
                  Strategic Monitoring
                </p>
                <div className="space-y-2">
                  <Link
                    to="/monitoring/kri"
                    className="flex items-center justify-between p-4 bg-white border border-slate-100 rounded-2xl hover:border-indigo-200 hover:shadow-md transition-all group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-indigo-50 rounded-lg group-hover:bg-indigo-100">
                        <TrendingUp className="w-4 h-4 text-indigo-600" />
                      </div>
                      <span className="text-sm font-bold text-slate-700">
                        KRI Tracker
                      </span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-indigo-400" />
                  </Link>
                  <Link
                    to="/monitoring/alerts"
                    className="flex items-center justify-between p-4 bg-white border border-slate-100 rounded-2xl hover:border-amber-200 hover:shadow-md transition-all group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-amber-50 rounded-lg group-hover:bg-amber-100">
                        <ShieldAlert className="w-4 h-4 text-amber-600" />
                      </div>
                      <span className="text-sm font-bold text-slate-700">
                        Alerts & Thresholds
                      </span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-amber-400" />
                  </Link>
                </div>
              </div>

              {/* Recent Active Projects */}
              <div className="lg:col-span-2 space-y-3">
                <div className="flex items-center justify-between ml-1">
                  <p className="text-[11px] text-slate-400 font-black uppercase tracking-widest">
                    Recent Activity
                  </p>
                  <Link
                    to="/projects"
                    className="text-[10px] font-black text-indigo-600 hover:text-indigo-700 uppercase tracking-widest"
                  >
                    View All
                  </Link>
                </div>
                {displayProjects.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {displayProjects.slice(0, 4).map((p: any) => (
                      <div
                        key={p.id}
                        onClick={() => {
                          setActiveProject(p.id);
                          setActiveProgramme(null);
                          document.querySelector("main")?.scrollTo(0, 0);
                          if (isClientAdmin && !isViewingAsPM) {
                            navigate("/dashboard?viewAs=pm");
                          }
                        }}
                        className="flex items-center gap-3 bg-slate-50/50 hover:bg-white border border-transparent hover:border-slate-100 hover:shadow-sm transition-all cursor-pointer rounded-2xl px-4 py-3 group"
                      >
                        <div className="w-8 h-8 bg-white rounded-xl shadow-sm flex items-center justify-center shrink-0 border border-slate-100 group-hover:scale-110 transition-transform">
                          <FolderKanban className="w-4 h-4 text-indigo-500" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div
                            className="text-sm font-bold text-slate-900 truncate"
                            title={stripMarkdown(p.name || "Untitled Project")}
                          >
                            {stripMarkdown(p.name || "Untitled Project")}
                          </div>
                          <div
                            className="text-[10px] text-slate-400 font-medium truncate"
                            title={p.type || "—"}
                          >
                            {p.type || "—"}
                          </div>
                        </div>
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]" />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="bg-slate-50 rounded-2xl p-8 text-center border border-dashed border-slate-200">
                    <p className="text-xs text-slate-400 font-medium">
                      No active project records found.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* ─── PM: NO PROJECTS AT ALL ─── */}
      {!activeProjectId &&
        !activeProgrammeId &&
        !isClientAdmin &&
        safeProjects.length === 0 && (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <FolderKanban className="w-16 h-16 text-indigo-200 mb-4" />
            <h2 className="text-xl font-bold text-slate-800 mb-2">
              No Projects Found
            </h2>
            <p className="text-sm text-slate-500 max-w-sm mb-6">
              You haven't created any projects yet. Use the Project Initiation
              wizard to set up your first project.
            </p>
            <button
              onClick={() => {
                setActiveProject(null);
                setActiveProgramme(null);
                navigate("/initiate");
              }}
              className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 transition-colors shadow-md"
            >
              <Plus className="w-5 h-5" /> Start Project Initiation
            </button>
          </div>
        )}

      {/* ─── DASHBOARD CONTENT (Aggregate or Specific) ─── */}
      {(activeProjectId ||
        activeProgrammeId ||
        (!isClientAdmin && safeProjects.length > 0) ||
        (isClientAdmin && !activeProjectId && !activeProgrammeId)) && (
        <div className="space-y-6">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 md:gap-6">
            <div className="flex-1 min-w-0">
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                <h2 className="text-xl font-bold text-slate-900 truncate">
                  {activeProjectId
                    ? "Project Dashboard"
                    : isProjectManager
                      ? "Portfolio Dashboard"
                      : "Projects Overview"}
                </h2>
                {!activeProjectId && (
                  <span className="shrink-0 w-max bg-indigo-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-widest shadow-sm">
                    {activeProgrammeId
                      ? "Programme View"
                      : isProjectManager
                        ? "Aggregate Portfolio"
                        : "All Projects"}
                  </span>
                )}
              </div>
              <p className="text-sm text-slate-500 mt-1 max-w-2xl">
                {activeProjectId
                  ? "Compliance and risk overview for the active project."
                  : activeProgrammeId
                    ? `Aggregated overview for all projects linked to: ${stripMarkdown(safeProgrammes.find((p) => p.id === activeProgrammeId)?.name ?? "this programme")}`
                    : isProjectManager
                      ? "Aggregated overview for all projects in your organisation."
                      : "Overview of all your active projects and their compliance status."}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              {!isProjectManager || isClientAdmin ? (
                <Link
                  to="/monitoring/aggregation"
                  className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 text-xs sm:text-sm font-bold rounded-xl hover:bg-slate-50 transition-all shadow-sm whitespace-nowrap"
                >
                  <Layers className="w-4 h-4 text-indigo-500" />
                  Aggregation
                </Link>
              ) : (
                <Link
                  to="/setup/regulations"
                  className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 text-xs sm:text-sm font-bold rounded-xl hover:bg-slate-50 transition-all shadow-sm whitespace-nowrap"
                >
                  <BookOpen className="w-4 h-4 text-indigo-500" />
                  Regulations
                </Link>
              )}
              <Link
                to={
                  isClientAdmin ? "/reporting/programme" : "/reporting/project"
                }
                className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 text-white text-xs sm:text-sm font-bold rounded-xl hover:bg-indigo-700 transition-all shadow-md shadow-indigo-600/20 whitespace-nowrap"
              >
                <FileBarChart className="w-4 h-4" />
                {isClientAdmin ? "Prog Report" : "Proj Report"}
              </Link>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={handleClearData}
                disabled={loadingClear || loadingDemo}
                className={`px-4 py-2 text-xs sm:text-sm font-medium rounded-xl transition-all disabled:opacity-50 whitespace-nowrap border ${
                  confirmClear
                    ? "bg-rose-600 text-white border-rose-600 shadow-lg shadow-rose-200"
                    : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300 shadow-sm"
                }`}
              >
                {loadingClear
                  ? "Clearing..."
                  : confirmClear
                    ? "Confirm Clear"
                    : isClientAdmin
                      ? "Clear Data"
                      : "Clear Project"}
              </button>
              <button
                onClick={handleLoadDemo}
                disabled={loadingDemo || loadingClear}
                className="px-4 py-2 bg-white border border-indigo-200 text-indigo-600 text-xs sm:text-sm font-bold rounded-xl hover:bg-indigo-50 transition-all shadow-sm disabled:opacity-50 whitespace-nowrap"
              >
                {loadingDemo
                  ? "Loading..."
                  : isClientAdmin
                    ? "Load Demo"
                    : "Load Project"}
              </button>
            </div>
          </div>

          {/* ─── PENDING COMPLIANCE VERIFICATION ALERT ─── */}
          {pendingComplianceCount > 0 && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-indigo-600 rounded-2xl p-4 shadow-lg shadow-indigo-200 border border-indigo-500 overflow-hidden relative"
            >
              <div className="absolute top-0 right-0 w-32 h-full bg-white/10 -skew-x-12 translate-x-16" />
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 relative z-10">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center shrink-0 border border-white/20">
                    <ScanSearch className="w-5 h-5 text-white animate-pulse" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white tracking-tight">
                      Compliance Verification Required
                    </h3>
                    <p className="text-[10px] text-indigo-100 font-bold uppercase tracking-widest">
                      {pendingComplianceCount} AI-generated requirements are
                      waiting for your approval.
                    </p>
                  </div>
                </div>
                <Link
                  to="/compliance/tracker"
                  className="w-full sm:w-auto px-4 py-2 bg-white text-indigo-600 text-xs font-black rounded-xl hover:bg-indigo-50 transition-all shadow-sm flex items-center justify-center gap-2 whitespace-nowrap"
                >
                  Go to Verification Queue{" "}
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </motion.div>
          )}

          {/* AI Strategic Intelligence - Hidden if no stats available at all */}
          {(isComplianceSetup || isRiskSetup) && (
            <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden shadow-xl relative">
              <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 blur-[100px] pointer-events-none" />
              <div className="bg-white/5 border-b border-white/10 px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
                <div className="flex items-center gap-3">
                  <div className="bg-indigo-500/20 p-2 rounded-xl border border-indigo-500/20">
                    <TrendingUp className="w-5 h-5 text-indigo-400" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">
                      {isProjectManager && !activeProjectId
                        ? "Portfolio"
                        : "Project"}{" "}
                      Strategic Intelligence
                    </h3>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                      AI executive portfolio analysis
                    </p>
                  </div>
                </div>
                {!strategicInsights ? (
                  <button
                    onClick={handleGenerateInsights}
                    disabled={generatingInsights}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-xs font-bold rounded-xl hover:bg-indigo-500 transition-all shadow-lg shadow-indigo-500/20 disabled:opacity-50 active:scale-95"
                  >
                    {generatingInsights ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <ScanSearch className="w-3 h-3 text-white/80" />
                    )}
                    {generatingInsights
                      ? "Analyzing..."
                      : "Generate AI Insight"}
                  </button>
                ) : (
                  <div className="flex items-center gap-4">
                    <button
                      onClick={() => setStrategicInsights(null)}
                      className="text-xs font-bold text-slate-400 hover:text-slate-300 transition-all flex items-center gap-1.5"
                    >
                      <Trash2 className="w-3 h-3" /> Undo
                    </button>
                    <button
                      onClick={handleGenerateInsights}
                      disabled={generatingInsights}
                      className="text-xs font-bold text-indigo-400 hover:text-indigo-300 transition-all flex items-center gap-1.5"
                    >
                      <ScanSearch className="w-3 h-3" /> Refresh Report
                    </button>
                  </div>
                )}
              </div>

              <div className="p-6 relative z-10">
                {aiError && (
                  <div className="mb-6">
                    <AIErrorAlert
                      error={aiError}
                      onRetry={handleGenerateInsights}
                    />
                  </div>
                )}

                {!strategicInsights && !aiError ? (
                  <div className="flex flex-col items-center justify-center py-10 text-center bg-white/5 rounded-xl border border-dashed border-white/10">
                    <Briefcase className="w-12 h-12 text-white/10 mb-4" />
                    <p className="text-sm text-slate-400 font-medium max-w-xs leading-relaxed">
                      Analyze cross-functional compliance, risk, and issue data
                      to generate senior-level strategic guidance.
                    </p>
                  </div>
                ) : strategicInsights && !aiError ? (
                  <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
                      <div className="md:col-span-3 space-y-6">
                        <div className="relative pl-6">
                          <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-indigo-500 to-indigo-600 rounded-full shadow-[0_0_15px_rgba(99,102,241,0.6)]" />
                          <p className="text-slate-200 leading-relaxed font-semibold italic text-base bg-white/5 p-4 rounded-xl border border-white/10 backdrop-blur-md">
                            "{stripMarkdown(strategicInsights.outlook)}"
                          </p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div className="space-y-3">
                            <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                              <ShieldAlert className="w-3 h-3 text-red-500" />{" "}
                              Critical Blindspots
                            </h4>
                            <div className="space-y-2">
                              {strategicInsights.criticalBlindspots
                                ?.slice(0, 3)
                                .map((s: string, i: number) => (
                                  <div
                                    key={i}
                                    className="flex items-start gap-3 bg-red-500/5 p-4 rounded-xl border border-red-500/10 transition-all hover:bg-red-500/10 hover:translate-x-1 duration-300"
                                  >
                                    <ShieldAlert className="w-3.5 h-3.5 text-red-500 shrink-0 mt-0.5" />
                                    <p className="text-xs text-slate-300 leading-normal font-medium">
                                      {stripMarkdown(s)}
                                    </p>
                                  </div>
                                ))}
                            </div>
                          </div>
                          <div className="space-y-3">
                            <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                              <Milestone className="w-3 h-3 text-indigo-400" />{" "}
                              Strategic Priorities
                            </h4>
                            <div className="space-y-2">
                              {strategicInsights.strategicPriorities
                                ?.slice(0, 3)
                                .map((s: string, i: number) => (
                                  <div
                                    key={i}
                                    className="flex items-start gap-3 bg-indigo-500/5 p-4 rounded-xl border border-indigo-500/10 transition-all hover:bg-indigo-500/10 hover:translate-x-1 duration-300"
                                  >
                                    <div className="shrink-0 w-6 h-6 rounded-lg bg-indigo-500/20 flex items-center justify-center border border-indigo-500/20 group-hover:scale-105 transition-transform">
                                      <span className="text-indigo-400 font-black text-[10px]">
                                        {i + 1}
                                      </span>
                                    </div>
                                    <p className="text-xs text-slate-200 font-semibold leading-normal mt-0.5">
                                      {stripMarkdown(s)}
                                    </p>
                                  </div>
                                ))}
                            </div>
                          </div>
                        </div>

                        {/* Detailed Suggestions */}
                        {strategicInsights.detailedSuggestions &&
                          strategicInsights.detailedSuggestions.length > 0 && (
                            <div className="mt-8 pt-8 border-t border-white/10">
                              <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2 mb-4">
                                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />{" "}
                                Executive Recommendations
                              </h4>
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                {Array.isArray(
                                  strategicInsights.detailedSuggestions,
                                ) &&
                                  strategicInsights.detailedSuggestions
                                    .slice(0, 3)
                                    .map((rawS: any, i: number) => {
                                      const s =
                                        typeof rawS === "string"
                                          ? rawS
                                          : rawS?.content ||
                                            rawS?.text ||
                                            JSON.stringify(rawS);
                                      return (
                                        <div
                                          key={i}
                                          className="flex flex-col gap-4 bg-emerald-500/5 p-5 rounded-2xl border border-emerald-500/10 transition-all hover:bg-emerald-500/10 hover:-translate-y-1 duration-300 shadow-sm hover:shadow-emerald-500/5 group"
                                        >
                                          <div className="flex items-start gap-4">
                                            <div className="shrink-0 w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20 group-hover:scale-110 group-hover:bg-emerald-500/20 transition-all duration-500">
                                              <ShieldCheck className="w-5 h-5 text-emerald-400" />
                                            </div>
                                            <p className="text-[11px] text-slate-300 font-bold leading-relaxed mt-1">
                                              {stripMarkdown(s)}
                                            </p>
                                          </div>
                                        </div>
                                      );
                                    })}
                              </div>
                            </div>
                          )}
                      </div>

                      <div className="bg-white/5 rounded-2xl p-6 border border-white/10 flex flex-col items-center justify-center text-center backdrop-blur-sm self-center md:self-start w-full md:w-auto">
                        <div className="relative mb-6">
                          <svg className="w-24 h-24 transform -rotate-90">
                            <circle
                              cx="48"
                              cy="48"
                              r="42"
                              stroke="currentColor"
                              strokeWidth="6"
                              fill="transparent"
                              className="text-white/5"
                            />
                            <circle
                              cx="48"
                              cy="48"
                              r="42"
                              stroke="currentColor"
                              strokeWidth="6"
                              fill="transparent"
                              strokeDasharray={263.8}
                              strokeDashoffset={
                                263.8 -
                                (263.8 * (strategicInsights.healthScore || 0)) /
                                  100
                              }
                              className={clsx(
                                "transition-all duration-1000 ease-out",
                                strategicInsights.healthScore > 70
                                  ? "text-emerald-400"
                                  : strategicInsights.healthScore > 40
                                    ? "text-amber-400"
                                    : "text-red-400",
                              )}
                            />
                          </svg>
                          <div className="absolute inset-0 flex flex-col items-center justify-center">
                            <span className="text-2xl font-black text-white">
                              {strategicInsights.healthScore || 0}%
                            </span>
                            <span className="text-[8px] font-bold text-slate-500 uppercase tracking-widest">
                              Health
                            </span>
                          </div>
                        </div>
                        <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">
                          Portfolio Health
                        </h4>
                        <p className="text-[10px] text-slate-400 leading-relaxed max-w-[120px]">
                          {stripMarkdown(strategicInsights.healthRationale)}
                        </p>
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          )}

          {/* Portfolio Overview Section for PMs */}
          {!activeProjectId && isProjectManager && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FolderKanban className="w-5 h-5 text-indigo-600" />
                  <h2 className="text-lg font-bold text-slate-800">
                    My Projects
                  </h2>
                </div>
                {!isClientAdmin && (
                  <button
                    onClick={() => {
                      setActiveProject(null);
                      setActiveProgramme(null);
                      navigate("/initiate");
                    }}
                    className="flex items-center gap-1.5 text-xs font-bold text-indigo-600 hover:text-indigo-700 transition-colors bg-indigo-50 px-3 py-1.5 rounded-lg border border-indigo-100"
                  >
                    <Plus className="w-3.5 h-3.5" /> New Project
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {displayProjects.length > 0 ? (
                  displayProjects.slice(0, 8).map((project) => (
                    <Link
                      key={project.id}
                      to="/dashboard"
                      onClick={() => setActiveProject(project.id)}
                      className="bg-white p-4 rounded-xl border border-slate-200 hover:border-indigo-300 hover:shadow-md transition-all group"
                    >
                      <div className="flex justify-between items-start mb-3">
                        <div className="bg-slate-50 p-2 rounded-lg group-hover:bg-indigo-50 transition-colors">
                          <FolderKanban className="w-4 h-4 text-slate-400 group-hover:text-indigo-500" />
                        </div>
                        <span
                          className={clsx(
                            "text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest",
                            project.status === "Active"
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-100"
                              : project.status === "Draft"
                                ? "bg-amber-50 text-amber-700 border border-amber-100"
                                : "bg-slate-50 text-slate-700 border border-slate-100",
                          )}
                        >
                          {project.status || "Draft"}
                        </span>
                      </div>
                      <h3
                        className="text-sm font-bold text-slate-800 leading-tight group-hover:text-indigo-600 transition-colors truncate"
                        title={stripMarkdown(project.name)}
                      >
                        {stripMarkdown(project.name)}
                      </h3>
                      <div className="mt-3 flex items-center justify-between text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                        <span>{project.type || "Unknown Type"}</span>
                        <div className="flex items-center gap-1">
                          <span
                            className={clsx(
                              "w-2 h-2 rounded-full",
                              project.rag === "Red"
                                ? "bg-red-500"
                                : project.rag === "Amber"
                                  ? "bg-amber-500"
                                  : "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]",
                            )}
                          />
                          {project.rag || "Green"}
                        </div>
                      </div>
                    </Link>
                  ))
                ) : (
                  <div className="col-span-full py-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                    <p className="text-sm text-slate-400 font-medium">
                      No projects found. Use Project Initiation to create one.
                    </p>
                  </div>
                )}
              </div>

              {displayProjects.length > 8 && (
                <div className="flex justify-center mt-2">
                  <Link
                    to="/projects"
                    className="text-xs font-bold text-slate-500 hover:text-indigo-600 transition-colors flex items-center gap-1.5 opacity-70"
                  >
                    View All Projects <ChevronRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              )}

              <div className="bg-indigo-900 rounded-2xl p-4 border border-indigo-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 sm:gap-0 shadow-lg relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 blur-2xl pointer-events-none group-hover:scale-150 transition-transform duration-1000" />
                <div className="flex items-center gap-4 relative z-10">
                  <div className="bg-indigo-500/20 p-3 rounded-xl border border-indigo-500/20 group-hover:bg-indigo-500/30 transition-colors">
                    <BookOpen className="w-6 h-6 text-indigo-400" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">
                      Regulations active for construction programme
                    </h3>
                    <p className="text-[10px] text-indigo-300 font-medium leading-normal max-w-xs">
                      Access building safety and property compliance regulations
                      relevant to your active projects.
                    </p>
                  </div>
                </div>
                <Link
                  to="/setup/regulations"
                  className="relative z-10 w-full sm:w-auto text-center px-4 py-3 sm:py-2 bg-indigo-600 text-white text-xs font-bold rounded-xl hover:bg-indigo-500 transition-all border border-indigo-400/20 group-hover:shadow-[0_0_15px_rgba(79,70,229,0.3)] shadow-md"
                >
                  Browse Regulations
                </Link>
              </div>
            </div>
          )}

          {/* ─── PROJECT / PROGRAMME PLAN MILESTONES ─── */}
          {activeProject?.milestones?.length ||
          activeProgramme?.milestones?.length ? (
            <div className="space-y-4 mt-6">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Milestone className="w-5 h-5 text-indigo-600" />
                  <h2 className="text-lg font-bold text-slate-800">
                    {activeProject ? "Project Timeline" : "Programme Timeline"}
                  </h2>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-4 text-[10px] font-black uppercase tracking-widest text-slate-400">
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full bg-amber-400" /> Key
                      Milestone
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full bg-indigo-400" />{" "}
                      Upcoming
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest">
                      Critical Path & RIBA Milestones
                    </h3>
                    <span className="px-1.5 py-0.5 bg-indigo-100 text-indigo-700 text-[9px] font-black rounded uppercase">
                      Next 6 Events
                    </span>
                  </div>
                  <Link
                    to={
                      activeProject ? "/initiate" : "/projects/programme-setup"
                    }
                    className="text-[10px] font-black text-indigo-600 hover:text-indigo-700 uppercase tracking-widest flex items-center gap-1.5"
                  >
                    View Full Schedule <ChevronRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-100">
                  {(() => {
                    const allMilestones =
                      activeProject?.milestones ||
                      activeProgramme?.milestones ||
                      [];
                    const keyMilestones = allMilestones
                      .filter((m) => m.isKey)
                      .sort(
                        (a, b) =>
                          new Date(a.date).getTime() -
                          new Date(b.date).getTime(),
                      );
                    const otherMilestones = allMilestones
                      .filter((m) => !m.isKey)
                      .sort(
                        (a, b) =>
                          new Date(a.date).getTime() -
                          new Date(b.date).getTime(),
                      );

                    // Show up to 6 total: Priority to Key, then others
                    const displayMilestones = [
                      ...keyMilestones,
                      ...otherMilestones,
                    ].slice(0, 6);

                    if (displayMilestones.length === 0)
                      return (
                        <div className="col-span-2 p-12 text-center text-slate-400 italic text-sm font-medium">
                          No upcoming milestones defined.
                        </div>
                      );

                    return displayMilestones.map((m) => (
                      <div
                        key={m.id}
                        className="p-5 flex items-center justify-between gap-4 hover:bg-slate-50/80 transition-all group relative"
                      >
                        {m.isKey && (
                          <div className="absolute top-0 left-0 w-1 h-full bg-amber-400" />
                        )}
                        <div className="flex items-center gap-4 min-w-0">
                          <div
                            className={clsx(
                              "w-10 h-10 rounded-xl flex flex-col items-center justify-center shrink-0 border shadow-sm transition-transform group-hover:scale-105",
                              m.isKey
                                ? "bg-amber-50 border-amber-100 text-amber-700"
                                : "bg-indigo-50 border-indigo-100 text-indigo-700",
                              m.status === "Completed" &&
                                "bg-emerald-50 border-emerald-100 text-emerald-700",
                            )}
                          >
                            <span className="text-[10px] font-black uppercase leading-none">
                              {m.stage || "S?"}
                            </span>
                            {m.isKey ? (
                              <Star className="w-2.5 h-2.5 mt-0.5 fill-amber-500 text-amber-500" />
                            ) : (
                              <Calendar className="w-2.5 h-2.5 mt-0.5" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <h4
                                className="text-sm font-bold text-slate-900 truncate pr-2"
                                title={stripMarkdown(m.name)}
                              >
                                {stripMarkdown(m.name)}
                              </h4>
                              {m.isKey && (
                                <Star className="w-3 h-3 text-amber-500 fill-amber-500 shrink-0" />
                              )}
                            </div>
                            <div className="flex items-center gap-2 mt-0.5 overflow-hidden">
                              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">
                                {getRIBALabel(m.stage || "S0")}
                              </span>
                              {m.description && (
                                <>
                                  <span className="w-1 h-1 rounded-full bg-slate-200 shrink-0" />
                                  <span className="text-[11px] text-slate-500 truncate">
                                    {stripMarkdown(m.description)}
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <div
                            className={clsx(
                              "text-xs font-black tracking-tight",
                              m.status === "Delayed"
                                ? "text-red-600"
                                : "text-slate-900",
                            )}
                          >
                            {new Date(m.date).toLocaleDateString("en-GB", {
                              day: "2-digit",
                              month: "short",
                              year: "numeric",
                            })}
                          </div>
                          <div
                            className={clsx(
                              "text-[9px] font-black uppercase tracking-widest mt-1 px-1.5 py-0.5 rounded inline-block",
                              m.status === "Completed"
                                ? "bg-emerald-100 text-emerald-700"
                                : m.status === "Delayed"
                                  ? "bg-red-100 text-red-700"
                                  : "bg-slate-100 text-slate-600",
                            )}
                          >
                            {m.status}
                          </div>
                        </div>
                      </div>
                    ));
                  })()}
                </div>
              </div>
            </div>
          ) : null}

          {/* Portfolio Risk Aggregation (NEW) */}
          {!activeProjectId && !activeProgrammeId && isProjectManager && (
            <div className="mt-8">
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp className="w-5 h-5 text-indigo-600" />
                <h2 className="text-lg font-bold text-slate-800">
                  Portfolio Risk Aggregation
                </h2>
              </div>
              {loadingOverview ? (
                <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
                  <div className="xl:col-span-3">
                    <SkeletonTable rows={5} />
                  </div>
                  <SkeletonRiskSummary />
                </div>
              ) : (
                <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
                  <div className="xl:col-span-3 bg-white rounded-3xl border border-indigo-100 shadow-sm overflow-hidden relative group">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 blur-3xl rounded-full -mr-32 -mt-32 pointer-events-none group-hover:bg-indigo-500/10 transition-colors duration-700" />
                    <div className="px-6 py-5 border-b border-slate-100 bg-slate-50/30 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-200">
                          <BarChart className="w-4 h-4 text-white" />
                        </div>
                        <div>
                          <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest">
                            Top 5 Portfolio-Wide Risks
                          </h3>
                          <p className="text-[10px] text-slate-500 font-bold">
                            Aggregated across all active projects and programmes
                          </p>
                        </div>
                      </div>
                      <div className="px-3 py-1 bg-indigo-50 border border-indigo-100 rounded-full text-[10px] font-black text-indigo-700 uppercase tracking-tighter">
                        Critical Impact Focus
                      </div>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead className="bg-slate-50/50 text-slate-400 text-[10px] font-black uppercase tracking-widest border-b border-slate-100">
                          <tr>
                            <th className="px-6 py-4">Risk Item</th>
                            <th className="px-6 py-4">Source / Context</th>
                            <th className="px-6 py-4 text-center">
                              Inherent Score
                            </th>
                            <th className="px-6 py-4 text-right">
                              ALE Exposure
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                          {topRisks.length > 0 ? (
                            topRisks.map((risk) => {
                              const score = risk.grossRating || 0;
                              const scoreColor =
                                score >= 16
                                  ? "text-red-600 bg-red-50 border-red-100"
                                  : score >= 12
                                    ? "text-amber-600 bg-amber-50 border-amber-100"
                                    : "text-emerald-600 bg-emerald-50 border-emerald-100";
                              const sourceProject = safeProjects.find(
                                (p) => p.id === risk.projectId,
                              );
                              const sourceProgramme = safeProgrammes.find(
                                (p) => p.id === risk.programmeId,
                              );

                              return (
                                <tr
                                  key={risk.id}
                                  className="hover:bg-slate-50/80 transition-all group"
                                >
                                  <td className="px-6 py-4">
                                    <div className="flex items-center gap-3">
                                      <AlertTriangle
                                        className={clsx(
                                          "w-4 h-4 shrink-0",
                                          score >= 16
                                            ? "text-red-500"
                                            : "text-amber-500",
                                        )}
                                      />
                                      <div className="min-w-0">
                                        <div
                                          className="font-bold text-slate-900 truncate max-w-[250px]"
                                          title={stripMarkdown(risk.title)}
                                        >
                                          {stripMarkdown(risk.title)}
                                        </div>
                                        <div className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">
                                          {risk.category}
                                        </div>
                                      </div>
                                    </div>
                                  </td>
                                  <td className="px-6 py-4">
                                    <div className="flex items-center gap-2">
                                      <div className="w-1.5 h-1.5 rounded-full bg-slate-300" />
                                      <span className="text-xs font-bold text-slate-600 truncate max-w-[150px]">
                                        {sourceProject?.name ||
                                          sourceProgramme?.name ||
                                          "Global Context"}
                                      </span>
                                    </div>
                                  </td>
                                  <td className="px-6 py-4 text-center">
                                    <span
                                      className={clsx(
                                        "inline-flex items-center justify-center w-8 h-8 rounded-xl font-black text-sm border shadow-sm",
                                        scoreColor,
                                      )}
                                    >
                                      {score}
                                    </span>
                                  </td>
                                  <td className="px-6 py-4 text-right">
                                    <div className="text-sm font-mono font-black text-slate-900">
                                      £
                                      {(risk.residualALE || 0).toLocaleString()}
                                    </div>
                                    <div className="text-[9px] text-slate-400 uppercase tracking-widest font-bold">
                                      Residual Liability
                                    </div>
                                  </td>
                                </tr>
                              );
                            })
                          ) : (
                            <tr>
                              <td
                                colSpan={4}
                                className="px-6 py-16 text-center"
                              >
                                <div className="flex flex-col items-center gap-2 opacity-40">
                                  <ShieldCheck className="w-8 h-8 text-slate-300" />
                                  <p className="text-sm font-medium text-slate-500 italic">
                                    No critical risks identified across
                                    portfolio.
                                  </p>
                                </div>
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                    <div className="px-6 py-4 bg-slate-50/30 border-t border-slate-100 text-center">
                      <Link
                        to={
                          activeProjectId
                            ? "/risk/register"
                            : activeProgrammeId
                              ? "/risk/programme-register"
                              : "/risk/register"
                        }
                        className="text-[10px] font-black text-indigo-600 hover:text-indigo-700 uppercase tracking-widest flex items-center justify-center gap-2"
                      >
                        Investigate Full Portfolio Risk Matrix{" "}
                        <ArrowRight className="w-3 h-3" />
                      </Link>
                    </div>
                  </div>

                  <div className="flex flex-col gap-4">
                    <div className="bg-linear-to-br from-indigo-900 to-slate-900 rounded-3xl p-6 border border-indigo-800 shadow-xl relative overflow-hidden group">
                      <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 blur-2xl group-hover:scale-150 transition-transform duration-1000" />
                      <div className="relative z-10">
                        <div className="flex items-center gap-3 mb-4">
                          <div className="p-2 bg-indigo-500/20 rounded-lg border border-indigo-500/20">
                            <Briefcase className="w-4 h-4 text-indigo-300" />
                          </div>
                          <h3 className="text-xs font-black text-white uppercase tracking-widest">
                            KRI Pulse
                          </h3>
                        </div>
                        <div className="space-y-4">
                          <div>
                            <div className="flex justify-between items-end mb-1">
                              <span className="text-[10px] font-bold text-indigo-300 uppercase">
                                Exposure Index
                              </span>
                              <span className="text-lg font-black text-white">
                                {riskTotal > 0
                                  ? Math.round((riskHigh / riskTotal) * 100)
                                  : 0}
                                %
                              </span>
                            </div>
                            <div className="h-1.5 bg-indigo-950 rounded-full overflow-hidden border border-indigo-800/50">
                              <div
                                className="h-full bg-linear-to-r from-red-500 to-indigo-400"
                                style={{
                                  width: `${riskTotal > 0 ? Math.round((riskHigh / riskTotal) * 100) : 0}%`,
                                }}
                              />
                            </div>
                          </div>
                          <div className="pt-2">
                            <h4 className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider mb-2">
                              Portfolio Sentiment
                            </h4>
                            <p className="text-xs text-indigo-100 leading-relaxed font-medium">
                              {riskHigh > 2
                                ? "Critical threshold exceeded in multiple nodes. Immediate review of high-impact ALE mitigations required."
                                : "Risk profile remains within managed parameters. Continue monitoring stage-gate compliance."}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm flex-1 flex flex-col justify-between">
                      <div>
                        <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">
                          Aggregation Logic
                        </h3>
                        <p className="text-[11px] text-slate-600 font-medium leading-relaxed">
                          Risks are normalized across project tiers using gross
                          rating and financial exposure. AI identifies
                          cross-programme dependencies that may compound
                          systemic liability.
                        </p>
                      </div>
                      <div className="mt-4 pt-4 border-t border-slate-50">
                        <div className="flex items-center justify-between text-[10px] font-bold text-slate-500 uppercase">
                          <span>Sync Status</span>
                          <span className="flex items-center gap-1 text-emerald-600">
                            <CheckCircle className="w-2.5 h-2.5" /> Real-time
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Compliance Section */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <Shield className="w-5 h-5 text-indigo-600" />
              <h2 className="text-lg font-bold text-slate-800">
                {activeProjectId
                  ? "Project Compliance"
                  : activeProgrammeId
                    ? "Programme Compliance"
                    : "Compliance Portfolio"}
              </h2>
            </div>

            {isLoadingCompliance ? (
              <>
                <SkeletonStatCards count={5} />
                <SkeletonBar />
              </>
            ) : isComplianceSetup ? (
              <>
                <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
                  <StatCard
                    label="Total Scope"
                    value={compTotal}
                    color="blue"
                    border="border-l-blue-500"
                    info={`Total framework scope (${compApplicable} applicable + ${pendingComplianceCount} pending) for this ${isProjectManager && !activeProjectId ? "portfolio" : "project"}.`}
                  />
                  <StatCard
                    label="Complete"
                    value={compComplete}
                    color="green"
                    border="border-l-emerald-500"
                    info={`Requirements fully satisfied for this ${isProjectManager && !activeProjectId ? "portfolio" : "project"}.`}
                  />
                  <StatCard
                    label="In Progress"
                    value={compInProgress}
                    color="amber"
                    border="border-l-amber-500"
                    info={`Requirements currently being addressed in this ${isProjectManager && !activeProjectId ? "portfolio" : "project"}.`}
                  />
                  <StatCard
                    label="Not Started"
                    value={compNotStarted}
                    color="slate"
                    border="border-l-slate-500"
                    info={`Requirements yet to be reviewed for this ${isProjectManager && !activeProjectId ? "portfolio" : "project"}.`}
                  />
                  <StatCard
                    label="Pending Review"
                    value={pendingComplianceCount}
                    color="indigo"
                    border="border-l-indigo-500"
                    info={`Conditional items awaiting verification for this ${isProjectManager && !activeProjectId ? "portfolio" : "project"}.`}
                  />
                  <StatCard
                    label="High Risk Open"
                    value={compHighRisk}
                    color="red"
                    border="border-l-red-500"
                    info={`Open compliance items that carry a high risk of regulatory breach or severe penalty for this ${isProjectManager && !activeProjectId ? "portfolio" : "project"}.`}
                  />
                </div>

                <div className="bg-white rounded-2xl border border-slate-200 p-4 md:p-5 flex flex-col md:flex-row md:items-center gap-4 md:gap-6 shadow-sm">
                  <div className="text-xs font-extrabold text-slate-500 uppercase tracking-widest whitespace-nowrap flex items-center gap-1.5">
                    Overall Health
                    <InfoTooltip content="Percentage of compliance requirements that have been marked as Complete." />
                  </div>
                  <div className="flex-1 h-3 bg-slate-100 rounded-full overflow-hidden shadow-inner">
                    <div
                      className="h-full bg-linear-to-r from-emerald-500 to-teal-400 transition-all duration-1000 ease-out"
                      style={{ width: `${compPct}%` }}
                    />
                  </div>
                  <div className="text-xl font-black text-emerald-600 truncate">
                    {compPct}%
                  </div>
                </div>
              </>
            ) : (
              <div className="bg-white rounded-2xl border-2 border-dashed border-slate-200 p-8 flex flex-col items-center justify-center text-center">
                <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                  <Shield className="w-6 h-6 text-slate-400" />
                </div>
                <h3 className="text-sm font-bold text-slate-800">
                  Compliance Setup Pending
                </h3>
                <p className="text-xs text-slate-500 mt-1 max-w-sm">
                  Requirement analysis has not been performed for this{" "}
                  {activeProjectId ? "project" : "programme"}.
                </p>
                <Link
                  to={`/compliance/setup${activeProgrammeId ? "?type=programme" : ""}`}
                  className="mt-4 flex items-center gap-2 px-5 py-2 bg-indigo-600 text-white text-xs font-bold rounded-xl hover:bg-indigo-700 transition-colors shadow-sm"
                >
                  <ScanSearch className="w-3.5 h-3.5" /> Start AI Setup
                </Link>
              </div>
            )}
          </div>

          {/* Risk Section */}
          <div className="space-y-4 mt-10">
            <div className="flex items-center gap-2 mb-2">
              <BarChart className="w-5 h-5 text-indigo-600" />
              <h2 className="text-lg font-bold text-slate-800">
                Risk & Issues Overview
              </h2>
            </div>

            {isLoadingRisks ? (
              <>
                <SkeletonStatCards count={5} />
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-4">
                  <div className="lg:col-span-2">
                    <SkeletonTable rows={5} />
                  </div>
                  <SkeletonIssueSummary />
                </div>
              </>
            ) : isRiskSetup ? (
              <>
                <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
                  <StatCard
                    label="Total Risks"
                    value={riskTotal}
                    color="blue"
                    border="border-l-blue-500"
                  />
                  <StatCard
                    label="Open Risks"
                    value={riskOpen}
                    color="red"
                    border="border-l-red-500"
                  />
                  <StatCard
                    label="High/Severe Risks"
                    value={riskHigh}
                    color="amber"
                    border="border-l-amber-500"
                    info="Risks with a gross rating of 16 or higher (Major or Severe)."
                  />
                  <StatCard
                    label="Escalated Risks"
                    value={riskEscalated}
                    color="purple"
                    border="border-l-purple-500"
                    info="Risks that have been escalated to the Programme Board for senior attention."
                  />
                  <StatCard
                    label="Residual ALE"
                    value={`£${Math.round(riskResidualALE / 1000)}k`}
                    color="green"
                    border="border-l-emerald-500"
                    info="Residual Annual Loss Expectancy: The estimated financial exposure after all controls are applied."
                  />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-4">
                  {/* Top 5 Risks Table — hidden in aggregate view (portfolio section above already shows it with source context) */}
                  {(activeProjectId || activeProgrammeId) && (
                    <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                      <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                        <div className="flex items-center gap-2">
                          <BarChart className="w-4 h-4 text-indigo-500" />
                          <h3 className="text-xs font-bold text-slate-600 uppercase tracking-widest">
                            Top 5 Critical Risks
                          </h3>
                        </div>
                        <Link
                          to={
                            activeProjectId
                              ? "/risk/register"
                              : activeProgrammeId
                                ? "/risk/programme-register"
                                : "/risk/register"
                          }
                          className="text-[10px] font-bold text-indigo-600 hover:text-indigo-700 uppercase tracking-wider"
                        >
                          View Full Register
                        </Link>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                          <thead className="bg-slate-50 text-slate-500 text-[11px] font-black uppercase tracking-widest border-b border-slate-100">
                            <tr>
                              <th className="px-6 py-4">Risk Title</th>
                              <th className="px-6 py-4 text-center">Owner</th>
                              <th className="px-6 py-4 text-center">
                                Gross Score
                              </th>
                              <th className="px-6 py-4 text-right">ALE</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {topRisks.length > 0 ? (
                              topRisks.map((risk) => {
                                const score = risk.grossRating || 0;
                                const scoreColor =
                                  score >= 16
                                    ? "text-red-600"
                                    : score >= 9
                                      ? "text-amber-600"
                                      : "text-emerald-600";
                                return (
                                  <tr
                                    key={risk.id}
                                    className="hover:bg-slate-50/50 transition-colors"
                                  >
                                    <td className="px-6 py-4">
                                      <div
                                        className="font-bold text-slate-900 truncate max-w-[200px]"
                                        title={stripMarkdown(risk.title)}
                                      >
                                        {stripMarkdown(risk.title)}
                                      </div>
                                      <div
                                        className="text-[10px] text-slate-500 truncate max-w-[200px]"
                                        title={stripMarkdown(risk.category)}
                                      >
                                        {stripMarkdown(risk.category)}
                                      </div>
                                    </td>
                                    <td className="px-6 py-4">
                                      <span
                                        className="text-xs font-medium text-slate-600 truncate block max-w-[120px]"
                                        title={stripMarkdown(
                                          risk.owner || "Unassigned",
                                        )}
                                      >
                                        {stripMarkdown(
                                          risk.owner || "Unassigned",
                                        )}
                                      </span>
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                      <span
                                        className={clsx(
                                          "font-black text-base px-2 py-1 rounded-lg",
                                          scoreColor,
                                        )}
                                      >
                                        {score}
                                      </span>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                      <span className="font-mono font-bold text-slate-700">
                                        £
                                        {(
                                          risk.residualALE || 0
                                        ).toLocaleString()}
                                      </span>
                                    </td>
                                  </tr>
                                );
                              })
                            ) : (
                              <tr>
                                <td
                                  colSpan={4}
                                  className="px-6 py-12 text-center text-slate-400 italic"
                                >
                                  No risks registered yet.
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  <div
                    className={clsx(
                      "bg-white rounded-2xl border border-slate-200 p-6 shadow-sm hover:shadow-md transition-shadow",
                      !activeProjectId && !activeProgrammeId && "lg:col-span-3",
                    )}
                  >
                    <div className="flex items-center gap-2 mb-4">
                      <AlertCircle className="w-4 h-4 text-indigo-500" />
                      <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest">
                        Issues Summary
                      </h3>
                    </div>
                    <div className="space-y-4">
                      <div className="flex justify-between items-center pb-2 border-b border-slate-50">
                        <span className="text-xs font-medium text-slate-500">
                          Total Registered
                        </span>
                        <span className="text-lg font-extrabold text-slate-900">
                          {issueTotal}
                        </span>
                      </div>
                      {activeProject?.riba && (
                        <div className="flex justify-between items-center pb-2 border-b border-slate-50">
                          <span className="text-xs font-medium text-slate-500">
                            RIBA Stage
                          </span>
                          <span className="text-sm font-bold text-slate-700">
                            {getRIBALabel(activeProject.riba)}
                          </span>
                        </div>
                      )}
                      <div className="flex justify-between items-center pb-2 border-b border-slate-50">
                        <span className="text-xs font-medium text-slate-500">
                          Live & Open
                        </span>
                        <span className="text-lg font-extrabold text-amber-600">
                          {issueOpen}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-medium text-slate-500">
                          Escalated
                        </span>
                        <span className="text-lg font-extrabold text-red-600">
                          {issueEscalated}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="bg-white rounded-2xl border-2 border-dashed border-slate-200 p-8 flex flex-col items-center justify-center text-center">
                <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                  <ShieldAlert className="w-6 h-6 text-slate-400" />
                </div>
                <h3 className="text-sm font-bold text-slate-800">
                  Risk Identification Pending
                </h3>
                <p className="text-xs text-slate-500 mt-1 max-w-sm">
                  No risks have been identified for this{" "}
                  {activeProjectId ? "project" : "programme"}.
                </p>
                <Link
                  to={`/risk/ai${activeProgrammeId ? "?type=programme" : ""}`}
                  className="mt-4 flex items-center gap-2 px-5 py-2 bg-indigo-600 text-white text-xs font-bold rounded-xl hover:bg-indigo-700 transition-colors shadow-sm"
                >
                  <Briefcase className="w-3.5 h-3.5" /> Launch AI Risk ID
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Skeleton helpers ────────────────────────────────────────────────────────

function SkeletonStatCards({ count }: { count: number }) {
  return (
    <div
      className={`grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-${count} gap-4`}
    >
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="bg-white rounded-xl border border-slate-200 border-l-4 border-l-slate-200 px-4 py-4 shadow-sm animate-pulse"
        >
          <div className="h-3 bg-slate-200 rounded w-3/4 mb-3" />
          <div className="h-7 bg-slate-200 rounded w-1/2" />
        </div>
      ))}
    </div>
  );
}

function SkeletonBar() {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-4 md:p-5 flex flex-col md:flex-row md:items-center gap-4 md:gap-6 shadow-sm animate-pulse">
      <div className="h-3 bg-slate-200 rounded w-24 shrink-0" />
      <div className="flex-1 h-3 bg-slate-200 rounded-full" />
      <div className="h-5 bg-slate-200 rounded w-10 shrink-0" />
    </div>
  );
}

function SkeletonTable({ rows }: { rows: number }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden animate-pulse">
      <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
        <div className="h-3 bg-slate-200 rounded w-36" />
        <div className="h-3 bg-slate-200 rounded w-24" />
      </div>
      <div className="divide-y divide-slate-100">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-6 py-4">
            <div className="flex-1 space-y-2">
              <div className="h-3 bg-slate-200 rounded w-3/4" />
              <div className="h-2.5 bg-slate-100 rounded w-1/2" />
            </div>
            <div className="h-3 bg-slate-200 rounded w-16 shrink-0" />
            <div className="h-7 w-7 bg-slate-200 rounded-xl shrink-0" />
            <div className="h-3 bg-slate-200 rounded w-14 shrink-0" />
          </div>
        ))}
      </div>
    </div>
  );
}

function SkeletonRiskSummary() {
  return (
    <div className="flex flex-col gap-4 animate-pulse">
      <div className="bg-linear-to-br from-indigo-900 to-slate-900 rounded-3xl p-6 border border-indigo-800 shadow-xl relative overflow-hidden">
        <div className="h-3 bg-indigo-700/50 rounded w-24 mb-4" />
        <div className="h-8 bg-indigo-700/30 rounded w-16 mb-2" />
        <div className="h-3 bg-indigo-700/50 rounded w-32" />
      </div>
      <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm">
        <div className="h-3 bg-slate-200 rounded w-28 mb-4" />
        <div className="space-y-3">
          <div className="h-12 bg-slate-100 rounded-xl" />
          <div className="h-12 bg-slate-100 rounded-xl" />
          <div className="h-12 bg-slate-100 rounded-xl" />
        </div>
      </div>
    </div>
  );
}

function SkeletonIssueSummary() {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm animate-pulse">
      <div className="h-3 bg-slate-200 rounded w-28 mb-5" />
      <div className="space-y-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="flex justify-between items-center pb-3 border-b border-slate-50"
          >
            <div className="h-3 bg-slate-200 rounded w-28" />
            <div className="h-6 bg-slate-200 rounded w-10" />
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  color,
  border,
  info,
}: {
  label: string;
  value: string | number;
  color: string;
  border: string;
  info?: string;
}) {
  const colors: Record<string, string> = {
    blue: "text-indigo-600",
    green: "text-emerald-600",
    amber: "text-amber-600",
    red: "text-red-600",
    slate: "text-slate-600",
    purple: "text-purple-600",
  };

  return (
    <div
      className={clsx(
        "bg-white rounded-xl border border-slate-200 border-l-4 px-4 py-4 shadow-sm hover:shadow-md transition-all",
        border,
      )}
    >
      <div className={clsx("text-xl font-black mb-1 truncate", colors[color])}>
        {value}
      </div>
      <div className="text-[11px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1.5 opacity-90">
        {label}
        {info && <InfoTooltip content={info} />}
      </div>
    </div>
  );
}
