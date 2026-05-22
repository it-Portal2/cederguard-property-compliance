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
  RefreshCw,
  FileText,
  Globe,
  PencilIcon,
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
  RiskBurnDown,
  RiskCallout,
  AIFollowUpPrompts,
  RibaTimeline,
} from "../components/dashboard";
import { AIInquiryPopup } from "../components/AIInquiryPopup";
import DynamicTable from "../components/table/DynamicTable";
import TableTooltip from "../components/table/TableTooltip";
import { canCreateProgramme as canCreateProgrammeFn } from "../lib/roles";
import { auth } from "../lib/firebase";
import { GetStartedModal } from "../components/onboarding/GetStartedModal";
import { getOnboardingSteps } from "../components/onboarding/onboardingSteps";

function getProjectCardModel(
  project: any,
  safeComplianceItems: any[],
  safeRisks: any[],
) {
  const projCompliance = safeComplianceItems.filter(
    (c) => c.projectId === project.id,
  );
  const projComplete = projCompliance.filter(
    (c) => c.stage === "Live" || c.stage === "Archived",
  ).length;
  const projTotal = projCompliance.length;
  const pct = projTotal > 0 ? Math.round((projComplete / projTotal) * 100) : 0;

  const projRisks = safeRisks.filter((r) => r.projectId === project.id);
  const openRisks = projRisks.filter((r) => r.status === "Open").length;
  const criticalCount = projRisks.filter(
    (r) => (r.grossRating || 0) >= 16,
  ).length;
  const exposure = projRisks.reduce(
    (sum, risk) => sum + Number(risk.residualALE || 0),
    0,
  );

  let isRed = false;
  let isAmber = false;
  if (criticalCount >= 3 || (projTotal > 0 && pct < 30)) {
    isRed = true;
  } else if (criticalCount >= 1 || (projTotal > 0 && pct < 70)) {
    isAmber = true;
  }

  const explicitRAG = (project.rag || "").toString().toLowerCase();
  if (explicitRAG.includes("red")) {
    isRed = true;
    isAmber = false;
  } else if (explicitRAG.includes("amber") || explicitRAG.includes("yellow")) {
    isRed = false;
    isAmber = true;
  }

  const ragBarClass = isRed
    ? "bg-rose-500"
    : isAmber
      ? "bg-amber-500"
      : "bg-emerald-500";

  const ribaRaw = (project.riba || "").toString();
  const ribaDigit = ribaRaw.match(/\d/);
  const ribaShort = ribaDigit ? `S${ribaDigit[0]}` : "—";

  return {
    pct,
    openRisks,
    exposure,
    ragBarClass,
    ribaShort,
  };
}

function ProjectSummaryCard({
  project,
  safeComplianceItems,
  safeRisks,
  formatGBP,
  setActiveProject,
}: {
  project: any;
  safeComplianceItems: any[];
  safeRisks: any[];
  formatGBP: (n: number) => string;
  setActiveProject: (project: any) => void;
}) {
  const { pct, openRisks, exposure, ragBarClass, ribaShort } =
    getProjectCardModel(project, safeComplianceItems, safeRisks);

  return (
    <Link
      to="/dashboard"
      onClick={() => setActiveProject(project.id)}
      className="bg-white p-3.5 rounded-md border border-slate-200 hover:border-slate-300 transition-colors flex flex-col gap-2.5"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <TableTooltip
            content={stripMarkdown(project.name)}
            variant="cell"
            align="start"
          >
            <div className="text-[13px] font-semibold text-slate-900 tracking-tight truncate">
              {stripMarkdown(project.name)}
            </div>
          </TableTooltip>
          <TableTooltip
            content={project.type || "Unspecified type"}
            variant="cell"
            align="start"
          >
            <div className="mt-1 font-mono uppercase tracking-wide text-[10.5px] text-slate-500 truncate">
              {project.type || "Unspecified type"}
            </div>
          </TableTooltip>
        </div>
        <span
          className={clsx(
            "shrink-0 inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-medium border",
            project.status === "Active"
              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
              : project.status === "Draft"
                ? "bg-amber-50 text-amber-700 border-amber-200"
                : "bg-slate-50 text-slate-700 border-slate-200",
          )}
        >
          {project.status || "Draft"}
        </span>
      </div>

      <div className="flex-1">
        <div className="flex items-center justify-between font-mono uppercase tracking-wide text-[10.5px] text-slate-500 mb-1">
          <span>{ribaShort} · Stage</span>
          <span className="tabular-nums">{pct}%</span>
        </div>
        <div className="h-1 rounded-full bg-slate-100 overflow-hidden">
          <div
            className={clsx("h-full rounded-full", ragBarClass)}
            style={{ width: `${Math.max(0, Math.min(100, pct))}%` }}
          />
        </div>
      </div>

      <div className="flex items-center justify-between text-[11px] text-slate-500">
        <span>
          <span className="font-mono tabular-nums text-slate-700">
            {openRisks}
          </span>{" "}
          open risk{openRisks === 1 ? "" : "s"}
        </span>
        <span className="font-mono tabular-nums text-slate-700">
          {formatGBP(exposure)}
        </span>
      </div>
    </Link>
  );
}

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
      const steps = getOnboardingSteps(
        userRole,
        canCreateProgrammeFn(userRole),
      );
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
  const [matrixView, setMatrixView] = useState<"gross" | "residual">("gross");
  const [showFullDetails, setShowFullDetails] = useState(false);

  // AI follow-up prompt → opens AIInquiryPopup pre-filled with the chip text.
  // Uses the existing controlled-popup API; no changes to AIInquiryPopup itself.
  const [aiInquiryOpen, setAiInquiryOpen] = useState(false);
  const [aiInquiryPrefill, setAiInquiryPrefill] = useState<string>("");
  const handleAskFollowUp = (prompt: string) => {
    setAiInquiryPrefill(prompt);
    setAiInquiryOpen(true);
  };

  // ── Hero header date filter — drives ComplianceVelocityChart's range and
  //    will be the canonical source for any future time-windowed widgets. ──
  const [dashboardRange, setDashboardRange] = useState<7 | 30 | 90>(30);

  // ── Hero refresh — re-runs the appropriate loader for the active context.
  //    Uses the same data-fetch paths the page already uses; no new endpoints. ──
  const [isRefreshing, setIsRefreshing] = useState(false);
  const handleRefresh = async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    try {
      if (activeProjectId) await loadProjectData(activeProjectId);
      else if (activeProgrammeId) await loadProgrammeData(activeProgrammeId);
      else await loadAggregateData();
    } finally {
      setIsRefreshing(false);
    }
  };

  // ── AI streaming text — body text of the AI outlook types out character-
  //    by-character on each context switch / new insight. prefers-reduced-motion
  //    jumps straight to the final string. ──
  const [streamedOutlook, setStreamedOutlook] = useState("");
  const [isStreamingOutlook, setIsStreamingOutlook] = useState(false);
  useEffect(() => {
    const full = strategicInsights?.outlook
      ? stripMarkdown(strategicInsights.outlook)
      : "";
    if (!full) {
      setStreamedOutlook("");
      setIsStreamingOutlook(false);
      return;
    }
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setStreamedOutlook(full);
      setIsStreamingOutlook(false);
      return;
    }
    setStreamedOutlook("");
    setIsStreamingOutlook(true);
    let i = 0;
    const step = Math.max(2, Math.floor(full.length / 90));
    const id = window.setInterval(() => {
      i += step;
      if (i >= full.length) {
        setStreamedOutlook(full);
        setIsStreamingOutlook(false);
        window.clearInterval(id);
      } else {
        setStreamedOutlook(full.slice(0, i));
      }
    }, 16);
    return () => window.clearInterval(id);
  }, [strategicInsights?.outlook, activeProjectId, activeProgrammeId]);

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
  const currentUserIds = [user?.uid, user?.id, user?.email].filter(Boolean);
  const myCreatedProjects = displayProjects.filter((project: any) => {
    const createdBy = project.createdBy?.toString();
    const userId = project.userId?.toString();
    return currentUserIds.some((id) => id === createdBy || id === userId);
  });
  const activeProgrammeProjects = activeProgrammeId
    ? displayProjects.filter((p) => p.programmeId === activeProgrammeId)
    : [];

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
  const isLoadingCompliance =
    (isLoadingContent || loadingOverview) && contextCompliance.length === 0;
  const isLoadingRisks =
    (isLoadingContent || loadingOverview) &&
    contextRisks.length === 0 &&
    contextIssues.length === 0;
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
  const criticalSpark = bucketLast7(
    contextRisks,
    (r) => (r.grossRating || 0) >= 16,
  );
  const issueSpark = bucketLast7(
    contextIssues,
    (i) => i.status !== "4. Resolved",
  );

  // Day labels for sparkline tooltips (last 7 days, ending today)
  const sparkLabels = (() => {
    const out: string[] = [];
    const today = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      out.push(
        d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" }),
      );
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

  // 5×5 risk matrix data: count risks per (likelihood, impact) cell for both
  // gross (pre-mitigation) and residual (post-mitigation) views.
  const buildMatrix = (
    lKey: "grossL" | "residualL",
    iKey: "grossI" | "residualI",
  ) => {
    const cells: Record<string, number> = {};
    contextRisks.forEach((r) => {
      const l = Number((r as any)[lKey] || 0);
      const i = Number((r as any)[iKey] || 0);
      if (l >= 1 && l <= 5 && i >= 1 && i <= 5) {
        const key = `${l}-${i}`;
        cells[key] = (cells[key] || 0) + 1;
      }
    });
    return cells;
  };
  const grossMatrixCells = buildMatrix("grossL", "grossI");
  const residualMatrixCells = buildMatrix("residualL", "residualI");

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

      {/* ─── HERO HEADER — breadcrumb + title + subtitle + date filter + refresh ─── */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          {/* Breadcrumb — context-aware crumb trail above the H1. */}
          <nav
            aria-label="Breadcrumb"
            className="flex items-center gap-1.5 text-xs text-slate-500 mb-1.5"
          >
            <span className="text-slate-500">Overview</span>
            <span className="text-slate-300">/</span>
            {activeProjectId ? (
              <>
                <span className="text-slate-500">Project</span>
                <span className="text-slate-300">/</span>
                <span className="text-slate-700 font-medium truncate max-w-[420px]">
                  {stripMarkdown(
                    activeProject?.name ||
                      safeProjects.find((p) => p.id === activeProjectId)
                        ?.name ||
                      "Active project",
                  )}
                </span>
              </>
            ) : activeProgrammeId ? (
              <>
                <span className="text-slate-500">Programme</span>
                <span className="text-slate-300">/</span>
                <span className="text-slate-700 font-medium truncate max-w-[420px]">
                  {stripMarkdown(
                    activeProgramme?.name ||
                      safeProgrammes.find((p) => p.id === activeProgrammeId)
                        ?.name ||
                      "Active programme",
                  )}
                </span>
              </>
            ) : (
              <span className="text-slate-700 font-medium">
                Portfolio dashboard
              </span>
            )}
          </nav>
          <h1 className="text-[22px] font-semibold tracking-tight text-slate-900">
            {activeProjectId
              ? "Project dashboard"
              : activeProgrammeId
                ? "Programme dashboard"
                : "Portfolio dashboard"}
          </h1>
          <p className="text-[13px] text-slate-500 mt-1 max-w-2xl">
            {activeProjectId
              ? "Compliance and risk overview for the active project."
              : activeProgrammeId && activeProgramme
                ? `Aggregated overview for all projects linked to: ${stripMarkdown(
                    activeProgramme.name,
                  )}.`
                : "Aggregated overview across all programmes and projects in your organisation."}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <div
            className="inline-flex items-center gap-0.5 rounded-md border border-slate-200 bg-slate-50 p-0.5"
            role="group"
            aria-label="Dashboard time range"
          >
            {([7, 30, 90] as const).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setDashboardRange(r)}
                className={clsx(
                  "px-2.5 h-7 text-xs font-medium rounded-md transition-colors font-mono tabular-nums",
                  dashboardRange === r
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-500 hover:text-slate-700",
                )}
                aria-pressed={dashboardRange === r}
              >
                {r}d
              </button>
            ))}
            <span
              className="px-2.5 h-7 inline-flex items-center text-xs font-medium font-mono text-slate-400 cursor-not-allowed"
              title="Custom range — coming soon"
            >
              Custom
            </span>
          </div>
          <button
            type="button"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md border border-slate-200 bg-white text-xs font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            aria-label="Refresh dashboard data"
          >
            <RefreshCw
              className={clsx(
                "w-3.5 h-3.5 text-slate-500",
                isRefreshing && "animate-spin",
              )}
            />
            Refresh
          </button>
          <Link
            to={
              activeProjectId
                ? "/reporting/project"
                : "/reporting/programme-report"
            }
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-indigo-600 hover:bg-indigo-500 text-xs font-medium text-white transition-colors shadow-sm"
          >
            <FileText className="w-3.5 h-3.5" />
            {activeProjectId ? "Project report" : "Programme report"}
          </Link>
        </div>
      </div>

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
                  <p className="font-mono uppercase tracking-wide text-[11px] font-medium text-amber-800">
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
                className="flex items-center gap-1.5 px-4 py-2 bg-amber-100 hover:bg-amber-200 text-amber-800 text-xs font-semibold rounded-lg transition-colors shrink-0 whitespace-nowrap"
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
                  {isClientAdmin
                    ? "Portfolio overview"
                    : "My project portfolio"}
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
                <SkeletonStatCards count={4} />
              </div>
            ) : null}
            <div
              className={clsx(
                "grid gap-3 mb-5",
                "grid-cols-2 lg:grid-cols-4",
                loadingOverview && "hidden",
              )}
            >
              <StatsCard
                title="Programmes"
                value={displayProgrammes.length}
                icon={Briefcase}
                size="sm"
                tileClassName="border border-slate-200 bg-indigo-50"
                iconBgClassName="bg-indigo-100"
                iconClassName="text-indigo-600"
                className="!shadow-none"
              />
              <StatsCard
                title="Projects"
                value={displayProjects.length}
                icon={FolderKanban}
                size="sm"
                tileClassName="border border-slate-200 bg-sky-50"
                iconBgClassName="bg-sky-100"
                iconClassName="text-sky-600"
                className="!shadow-none"
              />
              <StatsCard
                title="Published"
                value={displayProjects.filter((p: any) => p.isPublished).length}
                icon={Globe}
                size="sm"
                tileClassName="border border-slate-200 bg-emerald-50"
                iconBgClassName="bg-emerald-100"
                iconClassName="text-emerald-600"
                className="!shadow-none"
              />
              <StatsCard
                title="Draft"
                value={
                  displayProjects.filter((p: any) => !p.isPublished).length
                }
                icon={PencilIcon}
                size="sm"
                tileClassName="border border-slate-200 bg-amber-50"
                iconBgClassName="bg-amber-100"
                iconClassName="text-amber-600"
                className="!shadow-none"
              />
            </div>

            {/* ─── All Projects — same card treatment as My Projects ─── */}
            {displayProjects.length > 0 ? (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-base font-semibold text-slate-900">
                    All Projects
                  </h3>
                  <Link
                    to="/projects"
                    className="text-sm font-medium text-indigo-600 hover:text-indigo-700 inline-flex items-center gap-1"
                  >
                    View all <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                  {displayProjects.map((project: any) => (
                    <ProjectSummaryCard
                      key={project.id}
                      project={project}
                      safeComplianceItems={safeComplianceItems}
                      safeRisks={safeRisks}
                      formatGBP={formatGBP}
                      setActiveProject={(projectId) => {
                        setActiveProject(projectId);
                        setActiveProgramme(null);
                        document.querySelector("main")?.scrollTo(0, 0);
                        if (isClientAdmin && !isViewingAsPM) {
                          navigate("/dashboard?viewAs=pm");
                        }
                      }}
                    />
                  ))}
                </div>
              </div>
            ) : (
              <div className="bg-slate-50 rounded-lg p-8 text-center border border-dashed border-slate-200">
                <FolderKanban className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-sm text-slate-500">
                  No active projects yet.
                </p>
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
          <div className="bg-white rounded-lg border border-slate-200 px-6 py-16">
            <div className="flex flex-col items-center justify-center text-center max-w-md mx-auto">
              {/* Inline illustration: stacked translucent project tiles + plus token */}
              <div className="relative w-32 h-24 mb-6">
                <span className="absolute left-3 top-4 w-20 h-12 rounded-md bg-slate-100 border border-slate-200 -rotate-6" />
                <span className="absolute left-7 top-2 w-20 h-12 rounded-md bg-slate-50 border border-slate-200 rotate-3" />
                <span className="absolute left-11 top-0 w-20 h-12 rounded-md bg-white border border-slate-300 shadow-sm flex items-center justify-center">
                  <FolderKanban className="w-5 h-5 text-indigo-500" />
                </span>
                <span className="absolute -right-1 -top-1 w-7 h-7 rounded-full bg-indigo-600 text-white flex items-center justify-center shadow-sm ring-4 ring-white">
                  <Plus className="w-4 h-4" strokeWidth={3} />
                </span>
              </div>
              <h2 className="text-lg font-semibold text-slate-900">
                No projects yet
              </h2>
              <p className="mt-1.5 text-sm text-slate-500 max-w-sm">
                Use the Project Initiation wizard to set up your first project —
                onboarding takes about three minutes.
              </p>
              <button
                onClick={() => {
                  setActiveProject(null);
                  setActiveProgramme(null);
                  navigate("/initiate");
                }}
                className="mt-5 inline-flex items-center gap-1.5 px-4 h-10 bg-indigo-600 text-white text-sm font-semibold rounded-md hover:bg-indigo-700 transition-colors"
              >
                <Plus className="w-4 h-4" /> Start project initiation
              </button>
            </div>
          </div>
        )}

      {/* ─── DASHBOARD CONTENT (Aggregate or Specific) ─── */}
      {(activeProjectId ||
        activeProgrammeId ||
        (!isClientAdmin && safeProjects.length > 0) ||
        (isClientAdmin && !activeProjectId && !activeProgrammeId)) && (
        <div className="space-y-6">
          {/* ─── PENDING COMPLIANCE VERIFICATION ALERT ─── */}
          {pendingComplianceCount > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-md p-3.5 border border-amber-200/60"
              style={{
                background:
                  "linear-gradient(90deg, rgba(245,158,11,0.10), rgba(245,158,11,0.02))",
              }}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-start gap-3 min-w-0">
                  <ScanSearch className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900">
                      Compliance verification required
                    </p>
                    <p className="text-sm text-slate-600 mt-0.5">
                      {pendingComplianceCount} AI-generated requirement
                      {pendingComplianceCount === 1 ? " is" : "s are"} waiting
                      for your approval.
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

          {/* ─── KPI STRIP — 4 equal cards (v4 layout) ─── */}
          {(isComplianceSetup || isRiskSetup) && (
            <motion.div
              initial="hidden"
              animate="show"
              variants={{
                hidden: { opacity: 1 },
                show: { opacity: 1, transition: { staggerChildren: 0.05 } },
              }}
              className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4"
            >
              <KpiCard
                title="Compliance health"
                icon={<CheckCircle2 className="w-3.5 h-3.5" />}
                iconTone="indigo"
                value={compComplete}
                suffix={`/ ${compTotal}`}
                sub={
                  <>
                    <span className="font-semibold text-slate-700 tabular-nums">
                      {compHighRisk}
                    </span>{" "}
                    high-risk · {compNotStarted} pending
                  </>
                }
                delta={trendDelta(complianceSpark)}
                sparkData={complianceSpark}
                sparkColor="#10b981"
                sparkLabels={sparkLabels}
              />
              <KpiCard
                title="Open risks"
                icon={<AlertTriangle className="w-3.5 h-3.5" />}
                iconTone="rose"
                value={riskOpen}
                sub={`${riskTotal} total · ${riskEscalated} escalated`}
                delta={trendDelta(riskSpark)}
                deltaInvert
                sparkData={riskSpark}
                sparkColor="#f43f5e"
                sparkLabels={sparkLabels}
              />
              <KpiCard
                title="Critical"
                icon={<Flame className="w-3.5 h-3.5" />}
                iconTone="amber"
                value={riskHigh}
                sub="Gross score ≥ 16"
                delta={trendDelta(criticalSpark)}
                deltaInvert
                sparkData={criticalSpark}
                sparkColor="#f59e0b"
                sparkLabels={sparkLabels}
              />
              <KpiCard
                title="Financial exposure"
                icon={<PoundSterling className="w-3.5 h-3.5" />}
                iconTone="emerald"
                value={riskResidualALE}
                format={formatGBP}
                sub={`${issueOpen} open issue${issueOpen === 1 ? "" : "s"} · ${issueTotal} total`}
                delta={trendDelta(issueSpark)}
                deltaInvert
                sparkData={issueSpark}
                sparkColor="#6366f1"
                sparkLabels={sparkLabels}
              />
            </motion.div>
          )}

          {/* ─── RISK BURN-DOWN HERO (90-day projection) ─── */}
          {isRiskSetup && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: 0.4,
                ease: [0.2, 0.65, 0.3, 0.9],
                delay: 0.03,
              }}
            >
              <RiskBurnDown
                critical={riskHigh}
                open={riskOpen}
                onPlanSprint={() =>
                  handleAskFollowUp(
                    "Plan a 14-day verification sprint focused on the top critical risks.",
                  )
                }
              />
            </motion.div>
          )}

          {/* ─── COMPLIANCE VELOCITY CHART ─── */}
          {isComplianceSetup && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: 0.4,
                ease: [0.2, 0.65, 0.3, 0.9],
                delay: 0.05,
              }}
            >
              <ComplianceVelocityChart
                items={contextCompliance}
                range={dashboardRange}
                onRangeChange={setDashboardRange}
              />
            </motion.div>
          )}

          {/* ─── RISK MATRIX + CRITICAL RISKS TABLE (side-by-side at lg+) ─── */}
          {isRiskSetup && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: 0.4,
                ease: [0.2, 0.65, 0.3, 0.9],
                delay: 0.1,
              }}
              className="grid grid-cols-1 lg:grid-cols-12 gap-4"
            >
              <div className="lg:col-span-5 bg-white rounded-lg border border-slate-200 p-5 flex flex-col">
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div>
                    <h3 className="text-base font-semibold text-slate-900">
                      Risk matrix
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {matrixView === "gross" ? "Gross" : "Residual"} likelihood
                      × impact across {riskTotal} risk
                      {riskTotal === 1 ? "" : "s"}.
                    </p>
                  </div>
                  <div className="inline-flex items-center gap-0.5 rounded-md border border-slate-200 bg-slate-50 p-0.5 shrink-0">
                    {(["gross", "residual"] as const).map((v) => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => setMatrixView(v)}
                        className={clsx(
                          "px-2.5 h-7 text-xs font-medium rounded-md transition-colors capitalize",
                          matrixView === v
                            ? "bg-white text-slate-900 shadow-sm"
                            : "text-slate-500 hover:text-slate-700",
                        )}
                      >
                        {v}
                      </button>
                    ))}
                  </div>
                </div>
                {/* Inline 5×5 heatmap — counts per cell from gross or residual */}
                {(() => {
                  const rows = [5, 4, 3, 2, 1]; // impact rows top→bottom
                  const cols = [1, 2, 3, 4, 5]; // likelihood cols left→right
                  const cells =
                    matrixView === "gross"
                      ? grossMatrixCells
                      : residualMatrixCells;
                  const cellBand = (l: number, i: number) => {
                    const score = l * i;
                    if (score >= 16)
                      return "bg-rose-100 text-rose-900 border-rose-200";
                    if (score >= 9)
                      return "bg-amber-100 text-amber-900 border-amber-200";
                    if (score >= 4)
                      return "bg-emerald-50 text-emerald-900 border-emerald-200";
                    return "bg-slate-50 text-slate-700 border-slate-200";
                  };
                  return (
                    <div>
                      <div className="flex items-stretch gap-1.5">
                        {/* Y axis label */}
                        <div className="flex flex-col items-center justify-center pr-1">
                          <span className="font-mono uppercase tracking-wide text-[11px] font-medium text-slate-500 [writing-mode:vertical-rl] rotate-180">
                            Impact →
                          </span>
                        </div>
                        <div className="flex-1">
                          {rows.map((i) => (
                            <div
                              key={i}
                              className="flex items-center gap-1.5 mb-1.5 last:mb-0"
                            >
                              <span className="w-3 text-xs font-medium text-slate-500 text-right tabular-nums">
                                {i}
                              </span>
                              {cols.map((l) => {
                                const count = cells[`${l}-${i}`] || 0;
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
                              <span
                                key={l}
                                className="flex-1 text-center text-xs font-medium text-slate-500 tabular-nums"
                              >
                                {l}
                              </span>
                            ))}
                          </div>
                          <div className="text-center font-mono uppercase tracking-wide text-[11px] font-medium text-slate-500 mt-1">
                            Likelihood →
                          </div>
                        </div>
                      </div>
                      {/* Legend */}
                      <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1.5">
                        {[
                          { c: "bg-slate-100 border-slate-200", l: "Low" },
                          {
                            c: "bg-emerald-100 border-emerald-200",
                            l: "Moderate",
                          },
                          { c: "bg-amber-100 border-amber-200", l: "High" },
                          { c: "bg-rose-100 border-rose-200", l: "Critical" },
                        ].map((b) => (
                          <div
                            key={b.l}
                            className="inline-flex items-center gap-1.5"
                          >
                            <span
                              className={clsx("w-3 h-3 rounded-sm border", b.c)}
                            />
                            <span className="text-xs text-slate-600">
                              {b.l}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}
                {/* Narrative callout — critical-quadrant concentration + mitigation hint */}
                <RiskCallout
                  risks={contextRisks}
                  className="mt-4"
                  onGenerate={() =>
                    handleAskFollowUp(
                      "Generate a mitigation plan for the critical-quadrant risks.",
                    )
                  }
                />
              </div>
              <div className="lg:col-span-7 bg-white rounded-lg border border-slate-200 p-5 flex flex-col">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="text-base font-semibold text-slate-900">
                      Critical risks
                    </h3>
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
                    <p className="text-sm text-slate-500">
                      No critical risks identified.
                    </p>
                  </div>
                ) : (
                  <ul className="-mx-2">
                    {topRisks.slice(0, 6).map((r, idx) => {
                      const score = r.grossRating || 0;
                      const l = Number((r as any).grossL || 0);
                      const i = Number((r as any).grossI || 0);
                      const exposure = Number((r as any).residualALE || 0);
                      const cat =
                        (r as any).category || (r as any).domain || "Risk";
                      const maxScore = Math.max(
                        ...topRisks.map((x) => x.grossRating || 0),
                        16,
                      );
                      const barWidth = Math.round((score / maxScore) * 100);
                      const barColor =
                        score >= 22
                          ? "bg-rose-500"
                          : score >= 16
                            ? "bg-amber-500"
                            : "bg-sky-500";
                      return (
                        <li
                          key={r.id}
                          className="border-t border-slate-100 first:border-t-0"
                        >
                          <Link
                            to="/risk/register"
                            className="group grid grid-cols-[28px_1fr_80px_44px] items-center gap-3 px-3 py-2.5 rounded-md hover:bg-slate-50 transition-colors"
                          >
                            {/* Mono zero-padded index */}
                            <span className="font-mono tabular-nums text-[11px] text-slate-400 shrink-0">
                              {String(idx + 1).padStart(2, "0")}
                            </span>
                            {/* Title + metadata line */}
                            <div className="min-w-0">
                              <TableTooltip
                                content={stripMarkdown(
                                  r.title || "Untitled risk",
                                )}
                                variant="cell"
                                align="start"
                              >
                                <div className="space-y-1">
                                  <p className="text-sm font-medium text-slate-900 truncate group-hover:text-slate-900">
                                    {stripMarkdown(r.title || "Untitled risk")}
                                  </p>
                                  <div className="mt-1 flex items-center gap-1.5 font-mono uppercase tracking-wide text-[10.5px] text-slate-500">
                                    <span className="truncate">{cat}</span>
                                    {l > 0 && i > 0 && (
                                      <>
                                        <span className="text-slate-300">
                                          ·
                                        </span>
                                        <span className="tabular-nums shrink-0">
                                          L{l}·I{i}
                                        </span>
                                      </>
                                    )}
                                    {exposure > 0 && (
                                      <>
                                        <span className="text-slate-300">
                                          ·
                                        </span>
                                        <span className="tabular-nums shrink-0">
                                          {formatGBP(exposure)}
                                        </span>
                                      </>
                                    )}
                                  </div>
                                </div>
                              </TableTooltip>
                            </div>
                            {/* Score bar */}
                            <div className="h-1 rounded-full bg-slate-100 overflow-hidden">
                              <div
                                className={clsx(
                                  "h-full rounded-full transition-all duration-500",
                                  barColor,
                                )}
                                style={{ width: `${barWidth}%` }}
                              />
                            </div>
                            {/* Mono score */}
                            <span
                              className={clsx(
                                "font-mono tabular-nums text-sm font-semibold text-right",
                                score >= 22
                                  ? "text-rose-600"
                                  : "text-slate-900",
                              )}
                            >
                              {score}
                            </span>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </motion.div>
          )}

          {/* ─── ACTIVITY TIMELINE + RIBA PLAN OF WORK ──────────────────────
              Project view: side-by-side bento — Recent activity (7/12) +
              vertical RIBA Plan of Work (5/12) so the stage rail fits the
              activity card's height. Other views: activity full width. */}
          {(isComplianceSetup || isRiskSetup) && (
            <div
              className={clsx(
                "grid gap-4 items-stretch",
                activeProject || activeProgramme
                  ? "grid-cols-1 lg:grid-cols-12"
                  : "grid-cols-1",
              )}
            >
              <div
                className={clsx(
                  (activeProject || activeProgramme) &&
                    "lg:col-span-7 h-full min-h-0",
                )}
              >
                <ActivityTimeline
                  compliance={contextCompliance}
                  risks={contextRisks}
                  issues={contextIssues}
                  limit={8}
                />
              </div>
              {activeProject && (
                <div className="lg:col-span-5 h-full min-h-0">
                  <RibaTimeline
                    currentRiba={activeProject.riba}
                    milestones={activeProject.milestones || []}
                  />
                </div>
              )}
              {activeProgramme && !activeProject && (
                <div className="lg:col-span-5 h-full min-h-0">
                  <div className="bg-white rounded-lg border border-slate-200 p-5 h-full min-h-0 flex flex-col">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <h3 className="text-base font-semibold text-slate-900">
                          Programme projects
                        </h3>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Projects linked to this programme.
                        </p>
                      </div>
                      <span className="font-mono text-[11px] text-slate-500 tabular-nums">
                        {activeProgrammeProjects.length}
                      </span>
                    </div>

                    {activeProgrammeProjects.length > 0 ? (
                      <div className="min-h-0 flex-1 overflow-y-auto pr-1">
                        <div className="grid grid-cols-1 gap-3">
                          {activeProgrammeProjects.map((project: any) => (
                            <ProjectSummaryCard
                              key={project.id}
                              project={project}
                              safeComplianceItems={safeComplianceItems}
                              safeRisks={safeRisks}
                              formatGBP={formatGBP}
                              setActiveProject={setActiveProject}
                            />
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="min-h-[220px] flex-1 rounded-lg border border-dashed border-slate-200 bg-slate-50 flex items-center justify-center text-center px-6">
                        <div>
                          <FolderKanban className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                          <p className="text-sm text-slate-500">
                            No projects linked to this programme yet.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* AI Strategic Intelligence — Hidden if no stats available at all */}
          {(isComplianceSetup || isRiskSetup) && (
            <div
              className="bg-white rounded-lg border border-slate-200 overflow-hidden"
              style={{
                backgroundImage:
                  "linear-gradient(180deg, rgba(99,102,241,0.04), transparent 50%)",
              }}
            >
              <div className="border-b border-slate-200 px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  {/* AI Orb — radial-gradient indigo with inner highlight reflection */}
                  <span
                    className="relative inline-flex w-7 h-7 items-center justify-center rounded-md text-white shrink-0"
                    style={{
                      background:
                        "radial-gradient(120% 120% at 30% 30%, #818cf8, #4f46e5 60%, #4338ca)",
                      boxShadow:
                        "0 0 0 1px rgba(67,56,202,0.5), 0 8px 22px -8px rgba(99,102,241,0.35)",
                    }}
                  >
                    <ScanSearch className="w-3.5 h-3.5 relative z-10" />
                    <span
                      className="absolute inset-0.5 rounded-[5px] pointer-events-none"
                      style={{
                        background:
                          "radial-gradient(60% 60% at 30% 25%, rgba(255,255,255,0.5), transparent 60%)",
                      }}
                    />
                  </span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-sm font-semibold text-slate-900 tracking-tight">
                        Strategic intelligence
                      </h3>
                      <span className="inline-flex items-center gap-1.5 px-1.5 py-0.5 rounded text-[11px] font-medium border border-indigo-200 bg-indigo-50 text-indigo-700">
                        Live ·{" "}
                        {activeProject?.name ||
                          activeProgramme?.name ||
                          "Portfolio Aggregate"}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-2">
                      {/* Pulsing emerald dot */}
                      <span className="relative inline-flex w-1.5 h-1.5 shrink-0">
                        <span className="absolute inline-flex w-full h-full rounded-full bg-emerald-400 opacity-75 animate-ping" />
                        <span className="relative inline-flex w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      </span>
                      {strategicInsights ? (
                        <>
                          Re-analysed{" "}
                          {insightsTimestamp ? (
                            (() => {
                              const diffMs =
                                Date.now() - insightsTimestamp.getTime();
                              const m = Math.round(diffMs / 60000);
                              if (m < 1) return "just now";
                              if (m < 60) return `${m}m ago`;
                              const h = Math.round(m / 60);
                              if (h < 24) return `${h}h ago`;
                              return insightsTimestamp.toLocaleDateString(
                                "en-GB",
                                { day: "2-digit", month: "short" },
                              );
                            })()
                          ) : (
                            <>just now</>
                          )}
                          {typeof strategicInsights.healthScore ===
                            "number" && (
                            <>
                              {" "}
                              · synthesising{" "}
                              <span className="tabular-nums">
                                {strategicInsights.healthScore}%
                              </span>{" "}
                              confidence
                            </>
                          )}
                        </>
                      ) : (
                        <>AI executive portfolio analysis</>
                      )}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {!strategicInsights ? (
                    <button
                      onClick={handleGenerateInsights}
                      disabled={generatingInsights}
                      className="inline-flex items-center gap-1.5 px-3 h-8 bg-indigo-600 text-white text-xs font-medium rounded-md hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {generatingInsights ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <ScanSearch className="w-3.5 h-3.5" />
                      )}
                      {generatingInsights ? "Analysing…" : "Generate insight"}
                    </button>
                  ) : (
                    <>
                      <button
                        onClick={handleGenerateInsights}
                        disabled={generatingInsights}
                        className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md text-xs font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition-colors disabled:opacity-50"
                      >
                        {generatingInsights ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <ScanSearch className="w-3.5 h-3.5" />
                        )}
                        Refresh
                      </button>
                      <button
                        onClick={() => setStrategicInsights(null)}
                        className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md border border-slate-200 bg-white text-xs font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition-colors"
                        title="Clear insight"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Clear
                      </button>
                    </>
                  )}
                </div>
              </div>

              <div className="p-6">
                {aiError && (
                  <div className="mb-6">
                    <AIErrorAlert
                      error={aiError}
                      onRetry={handleGenerateInsights}
                    />
                  </div>
                )}

                {!strategicInsights && !aiError ? (
                  <div className="flex flex-col items-center justify-center py-14 text-center bg-slate-50/60 rounded-md border border-dashed border-slate-200">
                    {/* Small inline illustration — three concentric circles + scanner icon */}
                    <div className="relative w-16 h-16 mb-4">
                      <span className="absolute inset-0 rounded-full bg-indigo-100/60" />
                      <span className="absolute inset-2 rounded-full bg-indigo-50" />
                      <span className="absolute inset-0 flex items-center justify-center">
                        <ScanSearch className="w-7 h-7 text-indigo-600" />
                      </span>
                    </div>
                    <h4 className="text-sm font-semibold text-slate-900">
                      Generate executive insight
                    </h4>
                    <p className="mt-1 text-sm text-slate-600 max-w-sm leading-relaxed">
                      Analyse cross-functional compliance, risk, and issue data
                      to surface critical blindspots, strategic priorities, and
                      recommended actions.
                    </p>
                    <p className="mt-3 text-xs text-slate-400">
                      Use the{" "}
                      <span className="font-medium text-slate-500">
                        Generate AI insight
                      </span>{" "}
                      button above to start.
                    </p>
                  </div>
                ) : strategicInsights && !aiError ? (
                  <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                      <div className="md:col-span-3 space-y-6">
                        {/* Executive Read panel — eyebrow + headline + streamed body */}
                        {(() => {
                          const fullOutlook = stripMarkdown(
                            strategicInsights.outlook || "",
                          );
                          // Split into headline (first sentence) + body (rest).
                          const periodIdx = fullOutlook.indexOf(". ");
                          const headline =
                            periodIdx > 0 && periodIdx < 200
                              ? fullOutlook.slice(0, periodIdx + 1)
                              : fullOutlook.split("\n")[0] || fullOutlook;
                          const body =
                            periodIdx > 0 && periodIdx < 200
                              ? fullOutlook.slice(periodIdx + 2)
                              : "";
                          // Streamed body — slice the live streamedOutlook to
                          // only show what's beyond the headline.
                          const bodyStreamed = streamedOutlook.startsWith(
                            headline,
                          )
                            ? streamedOutlook.slice(headline.length).trimStart()
                            : streamedOutlook;
                          return (
                            <div className="rounded-md border border-indigo-200/60 bg-indigo-50/40 p-4">
                              <p className="text-sm font-semibold text-slate-900 leading-snug mb-2">
                                {headline}
                              </p>
                              {body && (
                                <p className="text-sm text-slate-700 leading-relaxed">
                                  {bodyStreamed}
                                  {isStreamingOutlook && (
                                    <span
                                      aria-hidden="true"
                                      className="inline-block w-[2px] h-3.5 bg-indigo-500 ml-0.5 align-middle animate-pulse"
                                    />
                                  )}
                                </p>
                              )}
                            </div>
                          );
                        })()}

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div className="space-y-3">
                            <h4 className="font-mono uppercase tracking-wide text-[11px] font-medium text-rose-600 flex items-center gap-1.5">
                              <ShieldAlert className="w-3.5 h-3.5 text-rose-500" />{" "}
                              Critical blindspots
                            </h4>
                            <ul className="space-y-2">
                              {strategicInsights.criticalBlindspots
                                ?.slice(0, 3)
                                .map((s: string, i: number) => (
                                  <li
                                    key={i}
                                    className="flex items-start gap-2.5 bg-rose-50 px-3 py-2.5 rounded-md border border-rose-100"
                                  >
                                    <ShieldAlert className="w-3.5 h-3.5 text-rose-500 shrink-0 mt-0.5" />
                                    <p className="text-sm text-slate-700 leading-snug">
                                      {stripMarkdown(s)}
                                    </p>
                                  </li>
                                ))}
                            </ul>
                          </div>
                          <div className="space-y-3">
                            <h4 className="font-mono uppercase tracking-wide text-[11px] font-medium text-indigo-600 flex items-center gap-1.5">
                              <Milestone className="w-3.5 h-3.5 text-indigo-600" />{" "}
                              Strategic priorities
                            </h4>
                            <ul className="space-y-2">
                              {strategicInsights.strategicPriorities
                                ?.slice(0, 3)
                                .map((s: string, i: number) => (
                                  <li
                                    key={i}
                                    className="flex items-start gap-2.5 bg-indigo-50 px-3 py-2.5 rounded-md border border-indigo-100"
                                  >
                                    <span className="shrink-0 w-5 h-5 rounded-full bg-indigo-600 text-white inline-flex items-center justify-center text-xs font-semibold">
                                      {i + 1}
                                    </span>
                                    <p className="text-sm text-slate-700 leading-snug mt-0.5">
                                      {stripMarkdown(s)}
                                    </p>
                                  </li>
                                ))}
                            </ul>
                          </div>
                        </div>

                        {/* Detailed Suggestions */}
                        {strategicInsights.detailedSuggestions &&
                          strategicInsights.detailedSuggestions.length > 0 && (
                            <div className="mt-6 pt-6 border-t border-slate-200">
                              <h4 className="font-mono uppercase tracking-wide text-[11px] font-medium text-emerald-600 flex items-center gap-1.5 mb-3">
                                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />{" "}
                                Executive recommendations
                              </h4>
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
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
                                          className="flex items-start gap-3 bg-slate-50 p-3 rounded-md border border-slate-200"
                                        >
                                          <span className="inline-flex w-8 h-8 items-center justify-center rounded-md bg-emerald-50 text-emerald-600 shrink-0">
                                            <ShieldCheck className="w-4 h-4" />
                                          </span>
                                          <p className="text-sm text-slate-700 leading-snug">
                                            {stripMarkdown(s)}
                                          </p>
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
                                263.8 -
                                (263.8 * (strategicInsights.healthScore || 0)) /
                                  100
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
                            <span className="font-mono uppercase tracking-wide text-[11px] font-medium text-slate-500 mt-0.5">
                              Health
                            </span>
                          </div>
                        </div>
                        <h4 className="font-mono uppercase tracking-wide text-[11px] font-medium text-slate-500 mb-1.5">
                          Portfolio health
                        </h4>
                        <p className="text-xs text-slate-600 leading-relaxed">
                          {stripMarkdown(strategicInsights.healthRationale)}
                        </p>
                      </div>
                    </div>
                    {/* Conversational follow-ups — chip row routes back into AI inquiry */}
                    <AIFollowUpPrompts onAsk={handleAskFollowUp} />
                  </div>
                ) : null}
              </div>
            </div>
          )}

          {/* Portfolio Overview Section for PMs */}
          {!activeProjectId && !activeProgrammeId && isProjectManager && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 inline-flex h-8 w-8 items-center justify-center rounded-md bg-indigo-50 text-indigo-600">
                    <FolderKanban className="w-4 h-4" />
                  </span>
                  <div>
                    <h2 className="text-base font-semibold text-slate-900 leading-5">
                      My Projects
                    </h2>
                    <p className="text-sm text-slate-500 mt-1 leading-5">
                      Projects created by you in this workspace.
                    </p>
                  </div>
                </div>
                {!isClientAdmin && (
                  <button
                    onClick={() => {
                      setActiveProject(null);
                      setActiveProgramme(null);
                      navigate("/initiate");
                    }}
                    className="flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-700 transition-colors bg-indigo-50 px-3 py-1.5 rounded-lg border border-indigo-100"
                  >
                    <Plus className="w-3.5 h-3.5" /> New Project
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {myCreatedProjects.length > 0 ? (
                  myCreatedProjects.slice(0, 8).map((project: any) => {
                    return (
                      <ProjectSummaryCard
                        key={project.id}
                        project={project}
                        safeComplianceItems={safeComplianceItems}
                        safeRisks={safeRisks}
                        formatGBP={formatGBP}
                        setActiveProject={setActiveProject}
                      />
                    );
                  })
                ) : (
                  <div className="col-span-full py-8 text-center bg-slate-50 rounded-lg border border-dashed border-slate-200">
                    <p className="text-sm text-slate-400 font-medium">
                      No projects created by you yet.
                    </p>
                  </div>
                )}
              </div>

              {myCreatedProjects.length > 8 && (
                <div className="flex justify-center mt-2">
                  <Link
                    to="/projects"
                    className="text-xs font-semibold text-slate-500 hover:text-indigo-600 transition-colors flex items-center gap-1.5 opacity-70"
                  >
                    View All Projects <ChevronRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              )}
            </div>
          )}

          {/* ─── Setup CTAs (only when compliance / risk not yet set up) ─── */}
          {(!isComplianceSetup || !isRiskSetup) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {!isComplianceSetup && (
                <Link
                  to={`/compliance/setup${activeProgrammeId ? "?type=programme" : ""}`}
                  className="group bg-white rounded-lg border border-slate-200 p-5 flex items-center gap-4 hover:border-slate-300 hover:bg-slate-50/40 transition-colors"
                >
                  <span className="inline-flex w-11 h-11 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 shrink-0">
                    <Shield className="w-5 h-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-slate-900">
                        Compliance setup pending
                      </p>
                      <span className="inline-flex items-center px-1.5 h-5 rounded-md text-xs font-medium bg-amber-50 text-amber-700 ring-1 ring-amber-100">
                        Action needed
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                      Run the AI requirement analysis to start tracking
                      compliance for this{" "}
                      {activeProgrammeId ? "programme" : "project"}.
                    </p>
                  </div>
                  <span className="inline-flex items-center gap-1.5 px-3 h-9 bg-indigo-600 text-white text-sm font-semibold rounded-md group-hover:bg-indigo-700 transition-colors shrink-0">
                    <ScanSearch className="w-4 h-4" /> Start
                  </span>
                </Link>
              )}
              {!isRiskSetup && (
                <Link
                  to={`/risk/ai${activeProgrammeId ? "?type=programme" : ""}`}
                  className="group bg-white rounded-lg border border-slate-200 p-5 flex items-center gap-4 hover:border-slate-300 hover:bg-slate-50/40 transition-colors"
                >
                  <span className="inline-flex w-11 h-11 items-center justify-center rounded-lg bg-rose-50 text-rose-600 shrink-0">
                    <ShieldAlert className="w-5 h-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-slate-900">
                        Risk identification pending
                      </p>
                      <span className="inline-flex items-center px-1.5 h-5 rounded-md text-xs font-medium bg-amber-50 text-amber-700 ring-1 ring-amber-100">
                        Action needed
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                      Launch AI risk discovery to populate the matrix and
                      critical risks list.
                    </p>
                  </div>
                  <span className="inline-flex items-center gap-1.5 px-3 h-9 bg-indigo-600 text-white text-sm font-semibold rounded-md group-hover:bg-indigo-700 transition-colors shrink-0">
                    <Briefcase className="w-4 h-4" /> Launch
                  </span>
                </Link>
              )}
            </div>
          )}
        </div>
      )}

      {/* ─── REGS BANNER (page footer) — v4 light indigo gradient ─── */}
      <div
        className="rounded-lg border border-indigo-200 grid grid-cols-[40px_1fr_auto] items-center gap-4 px-5 py-4"
        style={{
          background:
            "linear-gradient(90deg, rgba(99,102,241,0.18), rgba(99,102,241,0.08))",
        }}
      >
        <span className="inline-flex w-10 h-10 items-center justify-center rounded-md bg-indigo-100 text-indigo-600">
          <BookOpen className="w-5 h-5" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-900">
            Regulations active for the construction programme
          </p>
          <p className="text-xs text-slate-600 mt-1">
            Building Safety Act 2022 · SHDF Wave 2 · Asbestos (CAR 2024) · and
            more
          </p>
        </div>
        <Link
          to="/regulations"
          className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-indigo-600 hover:bg-indigo-500 text-xs font-medium text-white transition-colors shadow-sm shrink-0"
        >
          <BookOpen className="w-3.5 h-3.5" />
          Browse regulations
        </Link>
      </div>

      {/* AI inquiry popup — opened by follow-up prompt chips or the risk callout.
          Uses the existing controlled-popup API; `initialQuestion` pre-fills the
          input on each open via `key`-forced remount. */}
      <AIInquiryPopup
        key={aiInquiryPrefill}
        isOpen={aiInquiryOpen}
        onClose={() => setAiInquiryOpen(false)}
        initialQuestion={aiInquiryPrefill}
        context={
          activeProject?.name || activeProgramme?.name || "Portfolio Aggregate"
        }
      />
    </div>
  );
}

// ─── KPI card (v4 layout) — eyebrow + delta chip + bignum + sub + sparkline ───

type KpiTone = "indigo" | "rose" | "amber" | "emerald" | "sky";

const ICON_TONES: Record<KpiTone, string> = {
  indigo: "bg-indigo-50 text-indigo-600",
  rose: "bg-rose-50 text-rose-600",
  amber: "bg-amber-50 text-amber-600",
  emerald: "bg-emerald-50 text-emerald-600",
  sky: "bg-sky-50 text-sky-600",
};

function KpiCard({
  title,
  icon,
  iconTone = "indigo",
  value,
  suffix,
  sub,
  delta,
  deltaInvert,
  format,
  sparkData,
  sparkColor,
  sparkLabels,
}: {
  title: string;
  icon: React.ReactNode;
  iconTone?: KpiTone;
  value: number;
  suffix?: string;
  sub?: React.ReactNode;
  delta?: number;
  deltaInvert?: boolean;
  format?: (n: number) => string;
  sparkData: number[];
  sparkColor: string;
  sparkLabels?: string[];
}) {
  const hasDelta = typeof delta === "number" && Number.isFinite(delta);
  const up = (delta ?? 0) >= 0;
  const isBad = deltaInvert ? up : !up;
  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, y: 8 },
        show: {
          opacity: 1,
          y: 0,
          transition: { duration: 0.35, ease: [0.2, 0.65, 0.3, 0.9] },
        },
      }}
      className="bg-white rounded-lg border border-slate-200 p-4 flex flex-col gap-3 transition-colors hover:bg-slate-50/40"
    >
      {/* Eyebrow row — icon + mono title on left, delta chip on right */}
      <div className="flex items-start justify-between gap-2">
        <div className="inline-flex items-center gap-1.5 font-mono uppercase tracking-wide text-[11px] font-medium text-slate-500">
          <span
            className={clsx(
              "inline-flex w-5 h-5 items-center justify-center rounded",
              ICON_TONES[iconTone],
            )}
          >
            {icon}
          </span>
          <span className="truncate">{title}</span>
        </div>
        {hasDelta && delta !== 0 ? (
          <span
            className={clsx(
              "inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[11px] font-medium font-mono tabular-nums border",
              isBad
                ? "border-rose-200 bg-rose-50 text-rose-700"
                : "border-emerald-200 bg-emerald-50 text-emerald-700",
            )}
          >
            {up ? "↑" : "↓"} {Math.abs(delta!)}%
          </span>
        ) : hasDelta ? (
          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-medium border border-slate-200 bg-slate-50 text-slate-500">
            —
          </span>
        ) : null}
      </div>
      {/* Big number with optional suffix */}
      <div className="flex items-baseline gap-1">
        <AnimatedCounter
          value={value}
          format={format}
          className="text-3xl font-medium text-slate-900 leading-none tracking-tight tabular-nums"
        />
        {suffix && (
          <span className="text-sm font-medium text-slate-500 tabular-nums">
            {suffix}
          </span>
        )}
      </div>
      {/* Sub line */}
      {sub && <p className="text-xs text-slate-500">{sub}</p>}
      {/* Sparkline */}
      <div className="mt-auto">
        <MiniSparkline
          data={sparkData}
          color={sparkColor}
          labels={sparkLabels}
          height={38}
        />
      </div>
    </motion.div>
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
