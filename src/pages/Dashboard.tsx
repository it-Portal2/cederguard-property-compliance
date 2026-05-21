import { getRIBALabel } from "../constants/ribaStages";
import { useState, useEffect, useRef } from "react";
import { useStore } from "../store/useStore";
import { Link, useNavigate, useSearchParams } from "react-router";
import { InfoTooltip } from "../components/InfoTooltip";
import { StatsCard } from "../components/common/StatsCard";
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
  CheckCircle2,
  CircleDashed,
  Clock,
  Flame,
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
import {
  MiniSparkline,
  AnimatedCounter,
  ComplianceVelocityChart,
  ActivityTimeline,
} from "../components/dashboard";
import DynamicTable from "../components/table/DynamicTable";
import { canCreateProgramme as canCreateProgrammeFn } from "../lib/roles";
import { auth } from "../lib/firebase";
import { GetStartedModal } from "../components/onboarding/GetStartedModal";
import { getOnboardingSteps } from "../components/onboarding/onboardingSteps";

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

  // OB-1 — Get Started modal state. Fires only on first login: dual gate
  // is the auth user's `metadata.creationTime` (within 24h) AND the
  // server-side `hasSeenOnboardingModal` preference flag (not yet set).
  // After dismissal the flag persists, never shown again.
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const onboardingCheckedRef = useRef(false);

  const userRole = (user?.role || user?.profile?.role) as UserRole | undefined;
  const userIsSuperAdmin = isSuperAdmin(user?.email, userRole);
  const isClientAdmin =
    (isAtLeastClientAdmin(userRole) || userIsSuperAdmin) && !isViewingAsPM;
  const isProjectManager =
    isAtLeastPM(userRole) ||
    isAtLeastProgrammeManager(userRole) ||
    userIsSuperAdmin;

  // OB-1 — first-login detection effect.
  // Runs once when the store finishes hydrating + the user is signed in.
  // Dual gate: (a) auth user created within last 24h, (b) preference
  // flag absent or false. The 24h gate naturally protects existing
  // users who never saw onboarding from being suddenly modal'd.
  useEffect(() => {
    if (!isInitialized || !user?.uid || onboardingCheckedRef.current) return;
    onboardingCheckedRef.current = true;
    const creationTime = auth.currentUser?.metadata?.creationTime;
    if (!creationTime) return;
    const createdMs = new Date(creationTime).getTime();
    if (Number.isNaN(createdMs)) return;
    const ONE_DAY_MS = 24 * 60 * 60 * 1000;
    if (Date.now() - createdMs > ONE_DAY_MS) return;
    (async () => {
      try {
        const res = await api.getPreferences();
        const prefs = res?.preferences || res?.data || {};
        if (prefs.hasSeenOnboardingModal === true) return;
        setOnboardingOpen(true);
      } catch (err) {
        console.error("[Dashboard] onboarding preference check failed", err);
      }
    })();
  }, [isInitialized, user?.uid]);

  const handleOnboardingDismiss = (navigateToFirstStep: boolean) => {
    setOnboardingOpen(false);
    api.savePreference("hasSeenOnboardingModal", true).catch((err) => {
      console.error("[Dashboard] onboarding flag save failed", err);
    });
    if (navigateToFirstStep) {
      const steps = getOnboardingSteps(userRole, canCreateProgrammeFn(userRole));
      const first = steps[0];
      if (first?.href) navigate(first.href);
    }
  };

  const onboardingSteps = getOnboardingSteps(
    userRole,
    canCreateProgrammeFn(userRole),
  );

  const [loadingOverview, setLoadingOverview] = useState(false);
  const [isLoadingContent, setIsLoadingContent] = useState(false);
  const [strategicInsights, setStrategicInsights] = useState<any>(null);
  const [generatingInsights, setGeneratingInsights] = useState(false);
  const [aiError, setAiError] = useState<string | ApiError | null>(null);
  const [insightsTimestamp, setInsightsTimestamp] = useState<Date | null>(null);
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

  // ─── Premium dashboard computations (additive — no impact on existing logic) ───
  // 7-day sparklines: bucket counts per metric by `dateAdded`, ending today.
  const bucketLast7 = (items: any[], predicate?: (it: any) => boolean) => {
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    const start = new Date(today);
    start.setDate(today.getDate() - 6);
    start.setHours(0, 0, 0, 0);
    const out = Array.from({ length: 7 }, () => 0);
    items.forEach((it) => {
      if (predicate && !predicate(it)) return;
      const raw = it?.dateAdded;
      if (!raw) return;
      const d = new Date(raw);
      if (isNaN(d.getTime()) || d < start || d > today) return;
      const idx = Math.floor((d.getTime() - start.getTime()) / 86400000);
      if (idx >= 0 && idx < 7) out[idx] += 1;
    });
    return out;
  };

  const complianceSpark = bucketLast7(contextCompliance, (i) =>
    compIsComplete(i.stage),
  );
  const riskSpark = bucketLast7(contextRisks, (r) => r.status === "Open");
  const criticalSpark = bucketLast7(contextRisks, (r) => (r.grossRating || 0) >= 16);
  const issueSpark = bucketLast7(contextIssues, (i) => i.status !== "4. Resolved");

  // Day labels for sparkline tooltips (last 7 days, ending today)
  const sparkLabels = (() => {
    const out: string[] = [];
    const today = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      out.push(d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" }));
    }
    return out;
  })();

  // Trend delta vs the prior period (sum last 3 days vs preceding 4 days).
  const trendDelta = (spark: number[]) => {
    if (spark.length < 7) return 0;
    const recent = spark.slice(4).reduce((a, b) => a + b, 0);
    const prior = spark.slice(0, 4).reduce((a, b) => a + b, 0);
    if (prior === 0 && recent === 0) return 0;
    if (prior === 0) return 100;
    return Math.round(((recent - prior) / prior) * 100);
  };

  // 5×5 risk matrix data: count residual risks per (likelihood, impact) cell.
  const riskMatrixCells = (() => {
    const cells: Record<string, number> = {};
    contextRisks.forEach((r) => {
      const l = Number((r as any).residualL || (r as any).residualLikelihood || (r as any).likelihood || 0);
      const i = Number((r as any).residualI || (r as any).residualImpact || (r as any).impact || 0);
      if (l >= 1 && l <= 5 && i >= 1 && i <= 5) {
        const key = `${l}-${i}`;
        cells[key] = (cells[key] || 0) + 1;
      }
    });
    return cells;
  })();

  const formatGBP = (n: number) => {
    if (n >= 1_000_000) return `£${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `£${(n / 1_000).toFixed(0)}k`;
    return `£${Math.round(n)}`;
  };

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
      setInsightsTimestamp(new Date());
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
    <div className="space-y-6">
      {/* OB-1 — first-login Get Started modal. Mounts at the top of the
          tree but only renders when `onboardingOpen` is true. Dismissal
          flips the persistence flag — never shown again. */}
      <GetStartedModal
        open={onboardingOpen}
        steps={onboardingSteps}
        userName={user?.displayName ?? user?.name ?? null}
        onDismiss={handleOnboardingDismiss}
      />

      {/* ─── GLOBAL CONTEXT SELECTOR ─── */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-4 rounded-lg border border-slate-200 shadow-sm"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-50 rounded-lg flex items-center justify-center shrink-0 border border-indigo-100">
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
            <p className="text-xs text-slate-500 font-bold uppercase tracking-wide">
              {activeProject?.name ||
                activeProgramme?.name ||
                "All Authorized Projects"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 bg-slate-50 p-1.5 rounded-lg border border-slate-200/60 w-full md:w-auto">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200 rounded-lg shadow-sm w-full md:w-auto">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide shrink-0">
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
            <div className="flex items-center justify-between gap-4 bg-amber-50 border border-amber-200 rounded-lg px-5 py-3 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center shrink-0">
                  <Eye className="w-4 h-4 text-amber-600" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-amber-800 uppercase tracking-wide">
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
          className="relative bg-white rounded-lg border border-slate-200  overflow-hidden"
        >
          <div className="p-5 md:p-6">
            <div className="flex flex-col md:flex-row md:items-start justify-between gap-3 mb-5">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">
                  {isClientAdmin ? "Portfolio overview" : "My project portfolio"}
                </h2>
                <p className="text-sm text-slate-500 mt-0.5">
                  {isClientAdmin
                    ? "Global oversight across all managers and active projects."
                    : "Overview of your assigned projects and portfolio."}
                </p>
              </div>
              {loadingOverview && (
                <div className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Refreshing…
                </div>
              )}
            </div>

            {loadingOverview ? (
              <div className="mb-5">
                <SkeletonStatCards count={isClientAdmin ? 5 : 4} />
              </div>
            ) : null}
            <div
              className={clsx(
                "grid gap-3 mb-5",
                isClientAdmin
                  ? "grid-cols-2 lg:grid-cols-5"
                  : "grid-cols-2 lg:grid-cols-4",
                loadingOverview && "hidden",
              )}
            >
              <div className="bg-white rounded-lg p-4 border border-slate-200">
                <div className="text-xs font-medium text-slate-500 uppercase tracking-wide">Programmes</div>
                <div className="mt-1 text-2xl font-semibold text-slate-900 tabular-nums">
                  <AnimatedCounter value={displayProgrammes.length} />
                </div>
              </div>
              <div className="bg-white rounded-lg p-4 border border-slate-200">
                <div className="text-xs font-medium text-slate-500 uppercase tracking-wide">Projects</div>
                <div className="mt-1 text-2xl font-semibold text-slate-900 tabular-nums">
                  <AnimatedCounter value={displayProjects.length} />
                </div>
              </div>
              <div className="bg-white rounded-lg p-4 border border-slate-200">
                <div className="text-xs font-medium text-slate-500 uppercase tracking-wide">Published</div>
                <div className="mt-1 text-2xl font-semibold text-emerald-600 tabular-nums">
                  <AnimatedCounter value={displayProjects.filter((p: any) => p.isPublished).length} />
                </div>
              </div>
              <div className="bg-white rounded-lg p-4 border border-slate-200">
                <div className="text-xs font-medium text-slate-500 uppercase tracking-wide">Draft</div>
                <div className="mt-1 text-2xl font-semibold text-amber-600 tabular-nums">
                  <AnimatedCounter value={displayProjects.filter((p: any) => !p.isPublished).length} />
                </div>
              </div>
              {isClientAdmin && (
                <Link
                  to="/setup/workspace"
                  className="bg-white rounded-lg p-4 border border-slate-200 hover:bg-slate-50/40 transition-colors flex flex-col justify-between"
                >
                  <div className="text-xs font-medium text-slate-500 uppercase tracking-wide">Workspace</div>
                  <div className="mt-1 inline-flex items-center gap-1.5 text-sm font-semibold text-indigo-600">
                    <Plus className="w-4 h-4" /> Invite PM
                  </div>
                </Link>
              )}
            </div>

            {/* ─── Project portfolio bento — calm cards with progress rings ─── */}
            {displayProjects.length > 0 ? (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-base font-semibold text-slate-900">Projects</h3>
                  <Link
                    to="/projects"
                    className="text-sm font-medium text-indigo-600 hover:text-indigo-700 inline-flex items-center gap-1"
                  >
                    View all <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                  {displayProjects.slice(0, 8).map((p: any) => {
                    const pct = (() => {
                      const v = Number(p.setupProgress ?? p.progress ?? 0);
                      if (isFinite(v) && v >= 0 && v <= 100) return Math.round(v);
                      return 0;
                    })();
                    const rag = (p.overallRAG || p.rag || "Green").toString().toLowerCase();
                    const isRed = rag.includes("red");
                    const isAmber = rag.includes("amber") || rag.includes("yellow");
                    const ragRail = isRed ? "bg-rose-500" : isAmber ? "bg-amber-500" : "bg-emerald-500";
                    const ringColor = pct >= 70 ? "#10b981" : pct >= 40 ? "#f59e0b" : "#94a3b8";
                    const circumference = 2 * Math.PI * 18;
                    const offset = circumference - (circumference * pct) / 100;
                    return (
                      <button
                        key={p.id}
                        onClick={() => {
                          setActiveProject(p.id);
                          setActiveProgramme(null);
                          document.querySelector("main")?.scrollTo(0, 0);
                          if (isClientAdmin && !isViewingAsPM) {
                            navigate("/dashboard?viewAs=pm");
                          }
                        }}
                        className="group relative text-left bg-white border border-slate-200 rounded-lg p-4 pl-5 hover:bg-slate-50/40 hover:border-slate-300 transition-colors overflow-hidden"
                      >
                        {/* RAG side-rail */}
                        <span className={clsx("absolute left-0 top-0 bottom-0 w-1", ragRail)} />
                        <div className="flex items-start gap-3">
                          <div className="relative w-12 h-12 shrink-0">
                            <svg className="w-12 h-12 -rotate-90" viewBox="0 0 44 44">
                              <circle cx="22" cy="22" r="18" stroke="#e2e8f0" strokeWidth="3" fill="none" />
                              <circle
                                cx="22"
                                cy="22"
                                r="18"
                                stroke={ringColor}
                                strokeWidth="3"
                                strokeLinecap="round"
                                fill="none"
                                strokeDasharray={circumference}
                                strokeDashoffset={offset}
                                className="transition-all duration-700"
                              />
                            </svg>
                            <span className="absolute inset-0 flex items-center justify-center text-xs font-semibold text-slate-900 tabular-nums">
                              {pct}%
                            </span>
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold text-slate-900 truncate">
                              {stripMarkdown(p.name || "Untitled project")}
                            </p>
                            <p className="text-xs text-slate-500 truncate mt-0.5">{p.type || "—"}</p>
                          </div>
                          {/* Chevron reveal on hover */}
                          <ChevronRight className="w-4 h-4 text-slate-300 shrink-0 self-center opacity-0 group-hover:opacity-100 group-hover:text-slate-500 transition-opacity" />
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="bg-slate-50 rounded-lg p-8 text-center border border-dashed border-slate-200">
                <FolderKanban className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-sm text-slate-500">No active projects yet.</p>
              </div>
            )}
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
              className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 transition-colors shadow-md"
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
          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-semibold text-slate-900">
                  {activeProjectId
                    ? "Project dashboard"
                    : isProjectManager
                    ? "Portfolio dashboard"
                    : "Projects overview"}
                </h1>
                {!activeProjectId && (
                  <span className="inline-flex items-center px-2 h-6 bg-slate-100 text-slate-700 text-xs font-medium rounded-md">
                    {activeProgrammeId
                      ? "Programme view"
                      : isProjectManager
                      ? "Aggregate portfolio"
                      : "All projects"}
                  </span>
                )}
              </div>
              <p className="mt-1 text-sm text-slate-500 max-w-2xl">
                {activeProjectId
                  ? "Compliance and risk overview for the active project."
                  : activeProgrammeId
                  ? `Aggregated overview for all projects linked to: ${stripMarkdown(safeProgrammes.find((p) => p.id === activeProgrammeId)?.name ?? "this programme")}`
                  : isProjectManager
                  ? "Aggregated overview for all projects in your organisation."
                  : "Overview of all your active projects and their compliance status."}
              </p>
              {/* System status pill — only when everything's healthy */}
              {pendingComplianceCount === 0 && !aiError && (isComplianceSetup || isRiskSetup) && (
                <div className="mt-3 inline-flex items-center gap-2 px-2.5 h-7 rounded-md bg-emerald-50 border border-emerald-100">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 animate-ping" />
                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  </span>
                  <span className="text-xs font-medium text-emerald-700">All systems operational</span>
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={handleClearData}
                disabled={loadingClear || loadingDemo}
                className={clsx(
                  "inline-flex items-center px-3 h-9 text-sm font-medium rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap border",
                  confirmClear
                    ? "bg-rose-600 text-white border-rose-600 hover:bg-rose-700"
                    : "bg-white border-slate-300 text-slate-700 hover:bg-slate-50",
                )}
              >
                {loadingClear ? "Clearing…" : confirmClear ? "Confirm clear" : isClientAdmin ? "Clear data" : "Clear project"}
              </button>
              <button
                onClick={handleLoadDemo}
                disabled={loadingDemo || loadingClear}
                className="inline-flex items-center px-3 h-9 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
              >
                {loadingDemo ? "Loading…" : isClientAdmin ? "Load demo" : "Load project"}
              </button>
              {!isProjectManager || isClientAdmin ? (
                <Link
                  to="/monitoring/aggregation"
                  className="inline-flex items-center gap-1.5 px-3 h-9 bg-white border border-slate-300 text-slate-700 text-sm font-medium rounded-md hover:bg-slate-50 transition-colors whitespace-nowrap"
                >
                  <Layers className="w-4 h-4" />
                  Aggregation
                </Link>
              ) : (
                <Link
                  to="/setup/regulations"
                  className="inline-flex items-center gap-1.5 px-3 h-9 bg-white border border-slate-300 text-slate-700 text-sm font-medium rounded-md hover:bg-slate-50 transition-colors whitespace-nowrap"
                >
                  <BookOpen className="w-4 h-4" />
                  Regulations
                </Link>
              )}
              <Link
                to={isClientAdmin ? "/reporting/programme" : "/reporting/project"}
                className="inline-flex items-center gap-1.5 px-3 h-9 bg-indigo-600 text-white text-sm font-semibold rounded-md hover:bg-indigo-700 transition-colors whitespace-nowrap"
              >
                <FileBarChart className="w-4 h-4" />
                {isClientAdmin ? "Programme report" : "Project report"}
              </Link>
            </div>
          </div>

          {/* ─── PENDING COMPLIANCE VERIFICATION ALERT ─── */}
          {pendingComplianceCount > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-amber-50 rounded-md p-3.5 border border-amber-200"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-start gap-3 min-w-0">
                  <ScanSearch className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900">
                      Compliance verification required
                    </p>
                    <p className="text-sm text-slate-600 mt-0.5">
                      {pendingComplianceCount} AI-generated requirement{pendingComplianceCount === 1 ? " is" : "s are"} waiting for your approval.
                    </p>
                  </div>
                </div>
                <Link
                  to="/compliance/tracker"
                  className="inline-flex items-center gap-1.5 px-3 h-9 bg-white border border-slate-300 text-slate-700 text-sm font-medium rounded-md hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0"
                >
                  Verification queue
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </motion.div>
          )}

          {/* ─── HERO BENTO — featured Compliance + 3 stacked stat tiles ─── */}
          {(isComplianceSetup || isRiskSetup) && (
            <motion.div
              initial="hidden"
              animate="show"
              variants={{
                hidden: { opacity: 1 },
                show: { opacity: 1, transition: { staggerChildren: 0.06 } },
              }}
              className="grid grid-cols-12 gap-4"
            >
              {/* Featured Compliance card (big, left half on lg+) */}
              <motion.div
                variants={{
                  hidden: { opacity: 0, y: 8 },
                  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.2, 0.65, 0.3, 0.9] } },
                }}
                className="col-span-12 lg:col-span-6 bg-white rounded-lg border border-slate-200 p-6 transition-colors"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Compliance health</p>
                    <div className="mt-2 flex items-baseline gap-3">
                      <AnimatedCounter
                        value={compPct}
                        format={(n) => `${Math.round(n)}%`}
                        className="text-5xl font-semibold text-slate-900 leading-none"
                      />
                      {(() => {
                        const d = trendDelta(complianceSpark);
                        if (d === 0) return (
                          <span className="text-xs text-slate-400">No change vs prior 7d</span>
                        );
                        const up = d > 0;
                        return (
                          <span className={clsx(
                            "inline-flex items-center gap-1 px-2 h-6 rounded-md text-xs font-medium",
                            up ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700",
                          )}>
                            {up ? "↑" : "↓"} {Math.abs(d)}% <span className="text-slate-500 font-normal">7d</span>
                          </span>
                        );
                      })()}
                    </div>
                    <p className="mt-2 text-sm text-slate-600">
                      <span className="font-semibold text-slate-900 tabular-nums">{compComplete}</span> of <span className="tabular-nums">{compTotal}</span> items verified
                      {compHighRisk > 0 && (
                        <> · <span className="text-rose-700 font-medium">{compHighRisk} high risk</span></>
                      )}
                    </p>
                  </div>
                  <span className="inline-flex w-11 h-11 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 shrink-0">
                    <CheckCircle2 className="w-6 h-6" />
                  </span>
                </div>
                <div className="mt-5">
                  <MiniSparkline data={complianceSpark} color="#6366f1" labels={sparkLabels} height={56} />
                </div>
                <div className="mt-4 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-indigo-600 transition-all duration-700"
                    style={{ width: `${compPct}%` }}
                  />
                </div>
              </motion.div>

              {/* Right column: 3 small stat tiles stacked */}
              <div className="col-span-12 lg:col-span-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* Open risks */}
                <motion.div
                  variants={{
                    hidden: { opacity: 0, y: 8 },
                    show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.2, 0.65, 0.3, 0.9] } },
                  }}
                  className="bg-white rounded-lg border border-slate-200 p-5 transition-colors hover:bg-slate-50/40"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Open risks</p>
                    <span className="inline-flex w-8 h-8 items-center justify-center rounded-md bg-rose-50 text-rose-600 shrink-0">
                      <AlertTriangle className="w-4 h-4" />
                    </span>
                  </div>
                  <div className="mt-2 flex items-baseline gap-2">
                    <AnimatedCounter value={riskOpen} className="text-3xl font-semibold text-slate-900 leading-none" />
                    {(() => {
                      const d = trendDelta(riskSpark);
                      if (d === 0) return null;
                      const up = d > 0;
                      return (
                        <span className={clsx(
                          "text-xs font-medium",
                          up ? "text-rose-600" : "text-emerald-600",
                        )}>
                          {up ? "↑" : "↓"} {Math.abs(d)}%
                        </span>
                      );
                    })()}
                  </div>
                  <div className="mt-3">
                    <MiniSparkline data={riskSpark} color="#f43f5e" labels={sparkLabels} height={24} />
                  </div>
                  <p className="mt-2 text-xs text-slate-500">
                    {riskTotal} total · {riskEscalated} escalated
                  </p>
                </motion.div>

                {/* Critical risks */}
                <motion.div
                  variants={{
                    hidden: { opacity: 0, y: 8 },
                    show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.2, 0.65, 0.3, 0.9] } },
                  }}
                  className="bg-white rounded-lg border border-slate-200 p-5 transition-colors hover:bg-slate-50/40"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Critical</p>
                    <span className="inline-flex w-8 h-8 items-center justify-center rounded-md bg-amber-50 text-amber-600 shrink-0">
                      <Flame className="w-4 h-4" />
                    </span>
                  </div>
                  <div className="mt-2 flex items-baseline gap-2">
                    <AnimatedCounter value={riskHigh} className="text-3xl font-semibold text-slate-900 leading-none" />
                    {(() => {
                      const d = trendDelta(criticalSpark);
                      if (d === 0) return null;
                      const up = d > 0;
                      return (
                        <span className={clsx(
                          "text-xs font-medium",
                          up ? "text-rose-600" : "text-emerald-600",
                        )}>
                          {up ? "↑" : "↓"} {Math.abs(d)}%
                        </span>
                      );
                    })()}
                  </div>
                  <div className="mt-3">
                    <MiniSparkline data={criticalSpark} color="#f59e0b" labels={sparkLabels} height={24} />
                  </div>
                  <p className="mt-2 text-xs text-slate-500">
                    Score ≥16 gross
                  </p>
                </motion.div>

                {/* Residual exposure */}
                <motion.div
                  variants={{
                    hidden: { opacity: 0, y: 8 },
                    show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.2, 0.65, 0.3, 0.9] } },
                  }}
                  className="bg-white rounded-lg border border-slate-200 p-5 transition-colors hover:bg-slate-50/40"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Exposure</p>
                    <span className="inline-flex w-8 h-8 items-center justify-center rounded-md bg-emerald-50 text-emerald-600 shrink-0">
                      <PoundSterling className="w-4 h-4" />
                    </span>
                  </div>
                  <div className="mt-2">
                    <AnimatedCounter
                      value={riskResidualALE}
                      format={formatGBP}
                      className="text-3xl font-semibold text-slate-900 leading-none"
                    />
                  </div>
                  <div className="mt-3">
                    <MiniSparkline data={issueSpark} color="#10b981" labels={sparkLabels} height={24} />
                  </div>
                  <p className="mt-2 text-xs text-slate-500">
                    {issueOpen} open issue{issueOpen === 1 ? "" : "s"}
                  </p>
                </motion.div>
              </div>
            </motion.div>
          )}

          {/* ─── COMPLIANCE VELOCITY CHART ─── */}
          {isComplianceSetup && (
            <ComplianceVelocityChart items={contextCompliance} />
          )}

          {/* ─── RISK MATRIX + CRITICAL RISKS TABLE (side-by-side at lg+) ─── */}
          {isRiskSetup && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
              <div className="lg:col-span-5 bg-white rounded-lg border border-slate-200 p-5">
                <div className="mb-4">
                  <h3 className="text-base font-semibold text-slate-900">Risk matrix</h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Residual likelihood × impact across {riskTotal} risk{riskTotal === 1 ? "" : "s"}.
                  </p>
                </div>
                {/* Inline 5×5 heatmap — counts per cell from riskMatrixCells */}
                {(() => {
                  const rows = [5, 4, 3, 2, 1]; // impact rows top→bottom
                  const cols = [1, 2, 3, 4, 5]; // likelihood cols left→right
                  const cellBand = (l: number, i: number) => {
                    const score = l * i;
                    if (score >= 16) return "bg-rose-100 text-rose-900 border-rose-200";
                    if (score >= 9)  return "bg-amber-100 text-amber-900 border-amber-200";
                    if (score >= 4)  return "bg-emerald-50 text-emerald-900 border-emerald-200";
                    return "bg-slate-50 text-slate-700 border-slate-200";
                  };
                  return (
                    <div>
                      <div className="flex items-stretch gap-1.5">
                        {/* Y axis label */}
                        <div className="flex flex-col items-center justify-center pr-1">
                          <span className="text-xs font-medium text-slate-500 uppercase tracking-wide [writing-mode:vertical-rl] rotate-180">
                            Impact →
                          </span>
                        </div>
                        <div className="flex-1">
                          {rows.map((i) => (
                            <div key={i} className="flex items-center gap-1.5 mb-1.5 last:mb-0">
                              <span className="w-3 text-xs font-medium text-slate-500 text-right tabular-nums">{i}</span>
                              {cols.map((l) => {
                                const count = riskMatrixCells[`${l}-${i}`] || 0;
                                return (
                                  <div
                                    key={l}
                                    className={clsx(
                                      "flex-1 aspect-square rounded-md border flex items-center justify-center text-sm font-semibold transition-colors",
                                      cellBand(l, i),
                                      count === 0 && "opacity-60",
                                    )}
                                    title={`L=${l}, I=${i}: ${count} risk${count === 1 ? "" : "s"}`}
                                  >
                                    {count > 0 ? count : ""}
                                  </div>
                                );
                              })}
                            </div>
                          ))}
                          {/* X axis labels */}
                          <div className="flex items-center gap-1.5 mt-1">
                            <span className="w-3"></span>
                            {cols.map((l) => (
                              <span key={l} className="flex-1 text-center text-xs font-medium text-slate-500 tabular-nums">{l}</span>
                            ))}
                          </div>
                          <div className="text-center text-xs font-medium text-slate-500 uppercase tracking-wide mt-1">
                            Likelihood →
                          </div>
                        </div>
                      </div>
                      {/* Legend */}
                      <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1.5">
                        {[
                          { c: "bg-slate-100 border-slate-200", l: "Low" },
                          { c: "bg-emerald-100 border-emerald-200", l: "Moderate" },
                          { c: "bg-amber-100 border-amber-200", l: "High" },
                          { c: "bg-rose-100 border-rose-200", l: "Critical" },
                        ].map((b) => (
                          <div key={b.l} className="inline-flex items-center gap-1.5">
                            <span className={clsx("w-3 h-3 rounded-sm border", b.c)} />
                            <span className="text-xs text-slate-600">{b.l}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}
              </div>
              <div className="lg:col-span-7 bg-white rounded-lg border border-slate-200 p-5">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="text-base font-semibold text-slate-900">Critical risks</h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Top {topRisks.length} by gross rating.
                    </p>
                  </div>
                  <Link
                    to="/risk/register"
                    className="text-sm font-medium text-indigo-600 hover:text-indigo-700 transition-colors inline-flex items-center gap-1"
                  >
                    Open register <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
                {topRisks.length === 0 ? (
                  <div className="py-8 text-center">
                    <ShieldCheck className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <p className="text-sm text-slate-500">No critical risks identified.</p>
                  </div>
                ) : (
                  <ul className="divide-y divide-slate-100">
                    {topRisks.map((r) => {
                      const score = r.grossRating || 0;
                      const sev =
                        score >= 16
                          ? { label: "Critical", bg: "bg-rose-50", text: "text-rose-700" }
                          : score >= 9
                          ? { label: "High", bg: "bg-amber-50", text: "text-amber-700" }
                          : { label: "Moderate", bg: "bg-slate-100", text: "text-slate-700" };
                      return (
                        <li key={r.id} className="py-2.5 flex items-center gap-3">
                          <span className={clsx("inline-flex items-center px-2 h-6 rounded-md text-xs font-semibold shrink-0", sev.bg, sev.text)}>
                            {sev.label}
                          </span>
                          <p className="flex-1 min-w-0 text-sm text-slate-700 truncate">
                            {stripMarkdown(r.title || "Untitled risk")}
                          </p>
                          <span className="text-xs font-medium text-slate-500 tabular-nums shrink-0">
                            {score}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </div>
          )}

          {/* ─── ACTIVITY TIMELINE ─── */}
          {(isComplianceSetup || isRiskSetup) && (
            <ActivityTimeline
              compliance={contextCompliance}
              risks={contextRisks}
              issues={contextIssues}
              limit={8}
            />
          )}

          {/* AI Strategic Intelligence - Hidden if no stats available at all */}
          {(isComplianceSetup || isRiskSetup) && (
            <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
              <div className="border-b border-slate-200 px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="inline-flex w-9 h-9 items-center justify-center rounded-md bg-indigo-50 text-indigo-600">
                    <TrendingUp className="w-5 h-5" />
                  </span>
                  <div>
                    <h3 className="text-base font-semibold text-slate-900">
                      {isProjectManager && !activeProjectId ? "Portfolio" : "Project"} strategic intelligence
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {insightsTimestamp ? (
                        <>
                          Last analysed{" "}
                          {(() => {
                            const diffMs = Date.now() - insightsTimestamp.getTime();
                            const m = Math.round(diffMs / 60000);
                            if (m < 1) return "just now";
                            if (m < 60) return `${m}m ago`;
                            const h = Math.round(m / 60);
                            if (h < 24) return `${h}h ago`;
                            return insightsTimestamp.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
                          })()}
                        </>
                      ) : (
                        "AI executive portfolio analysis"
                      )}
                    </p>
                  </div>
                </div>
                {!strategicInsights ? (
                  <button
                    onClick={handleGenerateInsights}
                    disabled={generatingInsights}
                    className="inline-flex items-center gap-1.5 px-3 h-9 bg-indigo-600 text-white text-sm font-semibold rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {generatingInsights ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <ScanSearch className="w-4 h-4" />
                    )}
                    {generatingInsights ? "Analysing…" : "Generate AI insight"}
                  </button>
                ) : (
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setStrategicInsights(null)}
                      className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-700 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Undo
                    </button>
                    <button
                      onClick={handleGenerateInsights}
                      disabled={generatingInsights}
                      className="inline-flex items-center gap-1.5 text-sm font-medium text-indigo-600 hover:text-indigo-700 transition-colors"
                    >
                      <ScanSearch className="w-3.5 h-3.5" /> Refresh
                    </button>
                  </div>
                )}
              </div>

              <div className="p-6">
                {aiError && (
                  <div className="mb-6">
                    <AIErrorAlert error={aiError} onRetry={handleGenerateInsights} />
                  </div>
                )}

                {!strategicInsights && !aiError ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center bg-slate-50 rounded-md border border-dashed border-slate-200">
                    <Briefcase className="w-10 h-10 text-slate-300 mb-3" />
                    <p className="text-sm text-slate-600 max-w-xs leading-relaxed">
                      Analyse cross-functional compliance, risk, and issue data to generate senior-level strategic guidance.
                    </p>
                  </div>
                ) : strategicInsights && !aiError ? (
                  <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                      <div className="md:col-span-3 space-y-6">
                        <blockquote className="relative pl-4 border-l-2 border-indigo-600">
                          <p className="text-sm text-slate-700 leading-relaxed italic">
                            "{stripMarkdown(strategicInsights.outlook)}"
                          </p>
                        </blockquote>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div className="space-y-3">
                            <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide flex items-center gap-1.5">
                              <ShieldAlert className="w-3.5 h-3.5 text-rose-500" /> Critical blindspots
                            </h4>
                            <ul className="space-y-2">
                              {strategicInsights.criticalBlindspots?.slice(0, 3).map((s: string, i: number) => (
                                <li
                                  key={i}
                                  className="flex items-start gap-2.5 bg-rose-50 px-3 py-2.5 rounded-md border border-rose-100"
                                >
                                  <ShieldAlert className="w-3.5 h-3.5 text-rose-500 shrink-0 mt-0.5" />
                                  <p className="text-sm text-slate-700 leading-snug">{stripMarkdown(s)}</p>
                                </li>
                              ))}
                            </ul>
                          </div>
                          <div className="space-y-3">
                            <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide flex items-center gap-1.5">
                              <Milestone className="w-3.5 h-3.5 text-indigo-600" /> Strategic priorities
                            </h4>
                            <ul className="space-y-2">
                              {strategicInsights.strategicPriorities?.slice(0, 3).map((s: string, i: number) => (
                                <li
                                  key={i}
                                  className="flex items-start gap-2.5 bg-indigo-50 px-3 py-2.5 rounded-md border border-indigo-100"
                                >
                                  <span className="shrink-0 w-5 h-5 rounded-full bg-indigo-600 text-white inline-flex items-center justify-center text-xs font-semibold">
                                    {i + 1}
                                  </span>
                                  <p className="text-sm text-slate-700 leading-snug mt-0.5">{stripMarkdown(s)}</p>
                                </li>
                              ))}
                            </ul>
                          </div>
                        </div>

                        {/* Detailed Suggestions */}
                        {strategicInsights.detailedSuggestions && strategicInsights.detailedSuggestions.length > 0 && (
                          <div className="mt-6 pt-6 border-t border-slate-200">
                            <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide flex items-center gap-1.5 mb-3">
                              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" /> Executive recommendations
                            </h4>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                              {Array.isArray(strategicInsights.detailedSuggestions) &&
                                strategicInsights.detailedSuggestions.slice(0, 3).map((rawS: any, i: number) => {
                                  const s = typeof rawS === "string" ? rawS : rawS?.content || rawS?.text || JSON.stringify(rawS);
                                  return (
                                    <div
                                      key={i}
                                      className="flex items-start gap-3 bg-slate-50 p-3 rounded-md border border-slate-200"
                                    >
                                      <span className="inline-flex w-8 h-8 items-center justify-center rounded-md bg-emerald-50 text-emerald-600 shrink-0">
                                        <ShieldCheck className="w-4 h-4" />
                                      </span>
                                      <p className="text-sm text-slate-700 leading-snug">{stripMarkdown(s)}</p>
                                    </div>
                                  );
                                })}
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="bg-slate-50 rounded-md p-5 border border-slate-200 flex flex-col items-center justify-center text-center self-start w-full">
                        <div className="relative mb-4">
                          <svg className="w-24 h-24 -rotate-90">
                            <circle
                              cx="48"
                              cy="48"
                              r="42"
                              stroke="currentColor"
                              strokeWidth="6"
                              fill="transparent"
                              className="text-slate-200"
                            />
                            <circle
                              cx="48"
                              cy="48"
                              r="42"
                              stroke="currentColor"
                              strokeWidth="6"
                              strokeLinecap="round"
                              fill="transparent"
                              strokeDasharray={263.8}
                              strokeDashoffset={
                                263.8 - (263.8 * (strategicInsights.healthScore || 0)) / 100
                              }
                              className={clsx(
                                "transition-all duration-700 ease-out",
                                strategicInsights.healthScore > 70
                                  ? "text-emerald-500"
                                  : strategicInsights.healthScore > 40
                                  ? "text-amber-500"
                                  : "text-rose-500",
                              )}
                            />
                          </svg>
                          <div className="absolute inset-0 flex flex-col items-center justify-center">
                            <span className="text-2xl font-semibold text-slate-900 tabular-nums">
                              {strategicInsights.healthScore || 0}%
                            </span>
                            <span className="text-xs font-medium text-slate-500 uppercase tracking-wide mt-0.5">
                              Health
                            </span>
                          </div>
                        </div>
                        <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                          Portfolio health
                        </h4>
                        <p className="text-xs text-slate-600 leading-relaxed">
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
                      className="bg-white p-4 rounded-lg border border-slate-200 hover:border-indigo-300 hover:shadow-md transition-all group"
                    >
                      <div className="flex justify-between items-start mb-3">
                        <div className="bg-slate-50 p-2 rounded-lg group-hover:bg-indigo-50 transition-colors">
                          <FolderKanban className="w-4 h-4 text-slate-400 group-hover:text-indigo-500" />
                        </div>
                        <span
                          className={clsx(
                            "text-xs font-semibold px-2 py-0.5 rounded-full uppercase tracking-wide",
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
                      <div className="mt-3 flex items-center justify-between text-xs text-slate-500 font-bold uppercase tracking-wide">
                        <span>{project.type || "Unknown Type"}</span>
                        <div className="flex items-center gap-1">
                          <span
                            className={clsx(
                              "w-2 h-2 rounded-full",
                              project.rag === "Red"
                                ? "bg-red-500"
                                : project.rag === "Amber"
                                  ? "bg-amber-500"
                                  : "bg-emerald-500",
                            )}
                          />
                          {project.rag || "Green"}
                        </div>
                      </div>
                    </Link>
                  ))
                ) : (
                  <div className="col-span-full py-8 text-center bg-slate-50 rounded-lg border border-dashed border-slate-200">
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

              <div className="bg-indigo-900 rounded-lg p-4 border border-indigo-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 sm:gap-0 shadow-lg relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 blur-2xl pointer-events-none group- transition-transform duration-1000" />
                <div className="flex items-center gap-4 relative z-10">
                  <div className="bg-indigo-500/20 p-3 rounded-lg border border-indigo-500/20 group-hover:bg-indigo-500/30 transition-colors">
                    <BookOpen className="w-6 h-6 text-indigo-400" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">
                      Regulations active for construction programme
                    </h3>
                    <p className="text-xs text-indigo-300 font-medium leading-normal max-w-xs">
                      Access building safety and property compliance regulations
                      relevant to your active projects.
                    </p>
                  </div>
                </div>
                <Link
                  to="/setup/regulations"
                  className="relative z-10 w-full sm:w-auto text-center px-4 py-3 sm:py-2 bg-indigo-600 text-white text-xs font-bold rounded-lg hover:bg-indigo-500 transition-all border border-indigo-400/20  shadow-md"
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
                  <div className="flex items-center gap-4 text-xs font-semibold uppercase tracking-wide text-slate-400">
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

              <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <h3 className="text-xs font-semibold text-slate-900 uppercase tracking-wide">
                      Critical Path & RIBA Milestones
                    </h3>
                    <span className="px-1.5 py-0.5 bg-indigo-100 text-indigo-700 text-xs font-semibold rounded uppercase">
                      Next 6 Events
                    </span>
                  </div>
                  <Link
                    to={
                      activeProject ? "/project/plan" : "/projects/programme-setup"
                    }
                    className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 uppercase tracking-wide flex items-center gap-1.5"
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
                        <div className="col-span-2 p-12 text-center text-sm text-slate-500">
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
                              "w-10 h-10 rounded-lg flex flex-col items-center justify-center shrink-0 border shadow-sm transition-transform group-",
                              m.isKey
                                ? "bg-amber-50 border-amber-100 text-amber-700"
                                : "bg-indigo-50 border-indigo-100 text-indigo-700",
                              m.status === "Completed" &&
                                "bg-emerald-50 border-emerald-100 text-emerald-700",
                            )}
                          >
                            <span className="text-xs font-semibold uppercase leading-none">
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
                              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide whitespace-nowrap">
                                {getRIBALabel(m.stage || "S0")}
                              </span>
                              {m.description && (
                                <>
                                  <span className="w-1 h-1 rounded-full bg-slate-200 shrink-0" />
                                  <span className="text-xs text-slate-500 truncate">
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
                              "text-xs font-semibold tracking-tight",
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
                              "text-xs font-semibold uppercase tracking-wide mt-1 px-1.5 py-0.5 rounded inline-block",
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


          {/* ─── Setup CTAs (only when compliance / risk not yet set up) ─── */}
          {(!isComplianceSetup || !isRiskSetup) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {!isComplianceSetup && (
                <div className="bg-white rounded-lg border border-dashed border-slate-300 p-5 flex items-start gap-3">
                  <span className="inline-flex w-9 h-9 items-center justify-center rounded-md bg-indigo-50 text-indigo-600 shrink-0">
                    <Shield className="w-5 h-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-slate-900">Compliance setup pending</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Run the AI requirement analysis to start tracking compliance for this {activeProgrammeId ? "programme" : "project"}.
                    </p>
                    <Link
                      to={`/compliance/setup${activeProgrammeId ? "?type=programme" : ""}`}
                      className="mt-3 inline-flex items-center gap-1.5 px-3 h-9 bg-indigo-600 text-white text-sm font-semibold rounded-md hover:bg-indigo-700 transition-colors"
                    >
                      <ScanSearch className="w-4 h-4" /> Start AI setup
                    </Link>
                  </div>
                </div>
              )}
              {!isRiskSetup && (
                <div className="bg-white rounded-lg border border-dashed border-slate-300 p-5 flex items-start gap-3">
                  <span className="inline-flex w-9 h-9 items-center justify-center rounded-md bg-rose-50 text-rose-600 shrink-0">
                    <ShieldAlert className="w-5 h-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-slate-900">Risk identification pending</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Launch AI risk discovery to populate the matrix and critical risks list.
                    </p>
                    <Link
                      to={`/risk/ai${activeProgrammeId ? "?type=programme" : ""}`}
                      className="mt-3 inline-flex items-center gap-1.5 px-3 h-9 bg-indigo-600 text-white text-sm font-semibold rounded-md hover:bg-indigo-700 transition-colors"
                    >
                      <Briefcase className="w-4 h-4" /> Launch AI risk ID
                    </Link>
                  </div>
                </div>
              )}
            </div>
          )}

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
          className="bg-white rounded-lg border border-slate-200 border-l-4 border-l-slate-200 px-4 py-4 shadow-sm animate-pulse"
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
    <div className="bg-white rounded-lg border border-slate-200 p-4 md:p-5 flex flex-col md:flex-row md:items-center gap-4 md:gap-6 shadow-sm animate-pulse">
      <div className="h-3 bg-slate-200 rounded w-24 shrink-0" />
      <div className="flex-1 h-3 bg-slate-200 rounded-full" />
      <div className="h-5 bg-slate-200 rounded w-10 shrink-0" />
    </div>
  );
}

function SkeletonTable({ rows }: { rows: number }) {
  return (
    <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden animate-pulse">
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
            <div className="h-7 w-7 bg-slate-200 rounded-lg shrink-0" />
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
      <div className="bg-white rounded-lg p-5 border border-slate-200">
        <div className="h-3 bg-slate-200 rounded w-24 mb-4" />
        <div className="h-8 bg-slate-200 rounded w-16 mb-2" />
        <div className="h-3 bg-slate-200 rounded w-32" />
      </div>
      <div className="bg-white rounded-lg border border-slate-200 p-6 shadow-sm">
        <div className="h-3 bg-slate-200 rounded w-28 mb-4" />
        <div className="space-y-3">
          <div className="h-12 bg-slate-100 rounded-lg" />
          <div className="h-12 bg-slate-100 rounded-lg" />
          <div className="h-12 bg-slate-100 rounded-lg" />
        </div>
      </div>
    </div>
  );
}

function SkeletonIssueSummary() {
  return (
    <div className="bg-white rounded-lg border border-slate-200 p-6 shadow-sm animate-pulse">
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

// Local StatCard removed — replaced by the shared StatsCard component
// with light-tinted icon backgrounds.
