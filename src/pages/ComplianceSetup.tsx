import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useNavigate, useSearchParams, Link } from "react-router";
import { ClipboardList, ScanSearch, ShieldCheck, AlertCircle, AlertTriangle, Loader2, Check, ArrowRight, ArrowLeft, CheckCircle2, Info, Trash2, Lock, ChevronDown, ChevronUp, Layers, FolderKanban, Target } from 'lucide-react';
import { clsx } from "clsx";
import { useStore } from "../store/useStore";
import { analyzeCompliance } from "../services/aiService";
import { COMPLIANCE_ITEMS } from "../data/complianceData";
import {
  PROGRAMME_PHASES,
  PROJECT_PHASES,
} from "../data/complianceQuestions";
import {
  isAtLeastClientAdmin,
  UserRole,
  isSuperAdmin,
  isAtLeastPM,
} from "../lib/roles";
import { api, ApiError } from "../lib/api";
import toast from "react-hot-toast";
import { AIErrorAlert } from "../components/AIErrorAlert";
import { AIInquiryPopup } from "../components/AIInquiryPopup";

import { AnalysisSummary } from "../components/compliance/AnalysisSummary";
import { determineProjectCategory } from "../utils/complianceCategorization";
import { inputBase, textareaBase } from "../components/forms";

// ─── Checkbox pill component
function CheckPill({
  val,
  label,
  checked,
  onChange,
}: {
  key?: string;
  val: string;
  label: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <label
      className={clsx(
        "flex items-start gap-3 px-3 py-2.5 rounded-md border cursor-pointer transition-colors select-none text-sm min-w-0",
        checked
          ? "bg-indigo-50 border-indigo-500"
          : "bg-white border-slate-300 hover:border-slate-400",
      )}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="sr-only"
      />
      <span
        className={clsx(
          "w-4 h-4 shrink-0 rounded-sm border flex items-center justify-center transition-colors mt-0.5",
          checked ? "bg-indigo-600 border-indigo-600" : "bg-white border-slate-300",
        )}
        aria-hidden="true"
      >
        {checked && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
      </span>
      <span className={clsx("leading-snug wrap-break-word min-w-0", checked ? "text-slate-900 font-medium" : "text-slate-700")}>{label}</span>
    </label>
  );
}

// ─── Phase header
function PhaseHeader({ num, title }: { num: number; title: string }) {
  return (
    <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-200">
      <span className="inline-flex h-7 items-center px-2.5 rounded-md bg-slate-900 text-white text-xs font-mono font-medium uppercase tracking-wide">
        Phase {num}
      </span>
      <h2 className="text-lg font-semibold text-slate-900">
        {title}
      </h2>
    </div>
  );
}

// ─── Form field wrappers
const inputCls = inputBase;
const labelCls = "block text-sm font-medium text-slate-700 mb-1.5";

function Field({
  label,
  required,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className={labelCls}>
        {label}
        {required && <span className="text-rose-500 ml-0.5" aria-label="required">*</span>}
      </label>
      {children}
      {hint && (
        <p className="mt-1.5 text-xs text-amber-600 flex items-start gap-1">
          <AlertCircle className="w-3 h-3 shrink-0 mt-0.5" />
          {hint}
        </p>
      )}
    </div>
  );
}

// ─── Main component
export function ComplianceSetup() {
  const {
    activeProjectId,
    activeProgrammeId,
    projects,
    programmes,
    setActiveProject,
    setActiveProgramme,
    setProjectInfo,
    projectInfo,
    setComplianceAnalysis,
    setComplianceItems,
    complianceItems,
    deleteComplianceItem,
    addConditionalItems,
    lastAnalysisResults,
    setLastAnalysisResults,
    loadProjectData,
    loadProgrammeData,
    updateProject,
    updateProgramme,
    isComplianceLocked,
    setComplianceLocked,
  } = useStore();

  const activeDetails =
    (activeProjectId
      ? (Array.isArray(projects) ? projects : []).find(
          (p) => p.id === activeProjectId,
        )
      : (Array.isArray(programmes) ? programmes : []).find(
          (p) => p.id === activeProgrammeId,
        )) || ({} as any);

  const dispName =
    projectInfo.name ||
    (activeDetails as any)?.name ||
    (activeDetails as any)?.reference ||
    "—";
  const dispType = projectInfo.type || activeDetails?.type || "—";
  const dispLoc =
    projectInfo.loc ||
    (activeDetails as any)?.location ||
    (activeDetails as any)?.geographicScope ||
    (activeDetails as any)?.loc ||
    "—";
  const dispScope =
    projectInfo.scope ||
    (activeDetails as any)?.description ||
    (activeDetails as any)?.strategicObjectives ||
    (activeDetails as any)?.scope ||
    "";

  const [phase, setPhase] = useState(1);
  const [subPhase, setSubPhase] = useState<"review" | "additions">("review");
  const [pathChoice, setPathChoice] = useState<"none" | "detailed" | "ai">(
    "none",
  );
  const [showAnalysisExists, setShowAnalysisExists] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isDataLoading, setIsDataLoading] = useState(false); // non-AI loading (select/restart)
  const [isRestarting, setIsRestarting] = useState(false); // restart-specific loader
  const [showRestartConfirm, setShowRestartConfirm] = useState(false);
  const [error, setError] = useState<string | ApiError | null>(null);
  const [searchParams] = useSearchParams();
  const fromInitiation = searchParams.get("from") === "initiation";
  const navigate = useNavigate();

  const [currentQuestionPhase, setCurrentQuestionPhase] = useState(0);
  const [isQuestionnaireActive, setIsQuestionnaireActive] = useState(false);
  const user = useStore((state) => state.user);
  const userRole = (user?.role || user?.profile?.role) as UserRole | undefined;
  const userIsSuperAdmin = isSuperAdmin(user?.email, userRole);
  const isAtLeastAdmin = isAtLeastClientAdmin(userRole) || userIsSuperAdmin;
  const isPM = isAtLeastPM(userRole) || userIsSuperAdmin;

  const [activeType, setActiveType] = useState<"project" | "programme">(() => {
    // Check URL first
    const urlType = searchParams.get("type");
    if (urlType === "project" || urlType === "programme") return urlType as any;

    // Force based on role: Client Admins handle Programmes, others handle Projects
    if (isAtLeastAdmin) return "programme";
    return "project";
  });
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const [expandedPhases, setExpandedPhases] = useState<string[]>([]);

  // Set initial expanded phase based on type
  useEffect(() => {
    if (expandedPhases.length === 0) {
      setExpandedPhases(
        activeType === "programme" ? ["prog_org"] : ["proj_scope"],
      );
    }
  }, [activeType]);

  const [activeQuestionId, setActiveQuestionId] = useState<string | null>(null);
  const [loadingStep, setLoadingStep] = useState<string | null>(null);
  const [lastAnalyzedAnswers, setLastAnalyzedAnswers] = useState<string | null>(
    null,
  );
  const [isResetting, setIsResetting] = useState(false);


  // Auto-select from URL
  useEffect(() => {
    const id = searchParams.get("id");
    const type = searchParams.get("type");
    const from = searchParams.get("from");

    if (id && type && from === "initiation") {
      if (type === "project") {
        handleProjectSelect(id);
        setActiveType("project");
      } else if (type === "programme") {
        handleProgrammeSelect(id);
        setActiveType("programme");
      }
      setPhase(1);
      // Stay on Metadata — project is pre-selected, user clicks "Conduct Detailed Assessment" to proceed
    }
  }, [searchParams]);

  // Set initial active question
  useEffect(() => {
    // When questionnaire starts, if no question is active, find the first available
    if (isQuestionnaireActive && !activeQuestionId) {
      const phases =
        activeType === "programme" ? PROGRAMME_PHASES : PROJECT_PHASES;
      for (const qPhase of phases) {
        for (const q of qPhase.questions) {
          const val = projectInfo[q.id];
          const isAnswered = Array.isArray(val)
            ? val.length > 0
            : val !== undefined && val !== null && val !== "";
          if (!isAnswered) {
            setActiveQuestionId(q.id);
            setExpandedPhases([qPhase.id]);
            return;
          }
        }
      }
    }
  }, [isQuestionnaireActive, activeType, projectInfo, activeQuestionId]);

  const scrollToId = (id: string, offset = 140) => {
    const main = document.querySelector("main");
    const el = document.getElementById(id);
    if (main && el) {
      const mainRect = main.getBoundingClientRect();
      const elRect = el.getBoundingClientRect();
      const relativeTop = elRect.top - mainRect.top + main.scrollTop;
      main.scrollTo({
        top: Math.max(0, relativeTop - offset),
        behavior: "smooth",
      });
    }
  };

  const [isAIInquiryOpen, setIsAIInquiryOpen] = useState(false);
  const userInitiatedOpen = useRef(false);
  const isMountedRef = useRef(true);
  const scrollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup on unmount — cancel pending timers, mark unmounted.
  // isMountedRef.current = true on every mount handles React Strict Mode's
  // double-invoke (mount → cleanup → remount) which would otherwise leave it false.
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (scrollTimerRef.current) clearTimeout(scrollTimerRef.current);
      if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
    };
  }, []);

  // Safeguard: prevent auto-opening - only allow if user explicitly clicked
  useEffect(() => {
    if (isAIInquiryOpen && !userInitiatedOpen.current) {
      // Modal opened without user initiation - close it
      setIsAIInquiryOpen(false);
    }
  }, [isAIInquiryOpen]);

  const scrollToPhase = (phaseId: string, qId?: string) => {
    // Increased delay (550ms) to ensure the 500ms CSS transition is fully complete
    if (scrollTimerRef.current) clearTimeout(scrollTimerRef.current);
    scrollTimerRef.current = setTimeout(() => {
      const main = document.querySelector("main");
      // Priority: 1. Specific question anchor, 2. Phase-first-q anchor, 3. Header, 4. Container
      const anchorId = qId ? `q-container-${qId}` : `phase-first-q-${phaseId}`;
      const headerId = `phase-header-${phaseId}`;
      const el =
        document.getElementById(anchorId) ||
        document.getElementById(headerId) ||
        document.getElementById(`phase-container-${phaseId}`);

      if (main && el) {
        const mainRect = main.getBoundingClientRect();
        const elRect = el.getBoundingClientRect();

        // Use standard 140px offset for questions, 100px for headers
        const offset = qId || el.id.includes("first-q") ? 140 : 100;
        const relativeTop = elRect.top - mainRect.top + main.scrollTop - offset;

        main.scrollTo({
          top: Math.max(0, relativeTop),
          behavior: "smooth",
        });
      } else if (main) {
        main.scrollTo({ top: 0, behavior: "smooth" });
      } else {
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    }, 550);
  };

  const togglePhase = (id: string) => {
    const isExpanding = !expandedPhases.includes(id);
    setExpandedPhases((prev) => {
      // Allow multiple if we want, but the request was "auto-close"
      // so we keep it to one for now, but make it more robust.
      if (prev.includes(id)) return [];
      return [id];
    });

    // Scroll to the start of the toggled phase
    if (isExpanding) {
      // Consolidated into scrollToPhase which now handles anchors correctly
      scrollToPhase(id);
    }
  };

  const toggleSelectAll = (items: any[]) => {
    if (!Array.isArray(items) || items.length === 0) return;
    if (selectedIds.length === items.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(items.map((i) => i.id));
    }
  };

  const toggleSelectOne = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const handleBulkDelete = () => {
    if (selectedIds.length === 0) return;
    if (
      window.confirm(
        `Are you sure you want to remove ${selectedIds.length} selected items?`,
      )
    ) {
      selectedIds.forEach((id) => deleteComplianceItem(id));
      setSelectedIds([]);
    }
  };

  useEffect(() => {
    // Ensure store context is consistent with forced activeType
    if (activeType === "programme" && activeProjectId) {
      setActiveProject(null);
    } else if (activeType === "project" && activeProgrammeId) {
      setActiveProgramme(null);
    }
  }, [activeType, activeProjectId, activeProgrammeId]);

  // If there are existing analysis results for the CURRENT entity, show choices
  useEffect(() => {
    const contextId = activeProjectId || activeProgrammeId;
    if (!contextId) {
      setShowAnalysisExists(false);
      return;
    }

    const currentEntity = (
      activeProjectId
        ? (Array.isArray(projects) ? projects : []).find(
            (p) => p.id === activeProjectId,
          )
        : (Array.isArray(programmes) ? programmes : []).find(
            (p) => p.id === activeProgrammeId,
          )
    ) as any;

    // "Already Complete" means the framework has been published (complianceSetupDone flag).
    // Having compliance items in the tracker does NOT mean published — it means mid-analysis.
    const isSetupDone = !!currentEntity?.complianceSetupDone;
    const hasComplianceItems = activeProjectId
      ? (Array.isArray(complianceItems) ? complianceItems : []).some(
          (item) => item.projectId === activeProjectId,
        )
      : (Array.isArray(complianceItems) ? complianceItems : []).some(
          (item) => item.programmeId === activeProgrammeId,
        );

    const restart = searchParams.get("restart") === "true";

    if (isResetting) {
      setShowAnalysisExists(false);
      return;
    }

    if (isSetupDone && !restart && phase === 1) {
      // Framework was published — show the "already complete" overlay
      setShowAnalysisExists(true);
    } else if (hasComplianceItems && !isSetupDone && lastAnalysisResults && phase === 1 && !restart) {
      // Mid-analysis resume after page refresh — skip the modal and go straight to review
      setShowAnalysisExists(false);
      setPhase(3);
      setSubPhase("review");
    } else {
      setShowAnalysisExists(false);
      // Clear stale results only when switching to a brand-new entity with no data at all
      if (!isSetupDone && !hasComplianceItems && lastAnalysisResults) {
        setLastAnalysisResults(null);
      }
    }
  }, [
    lastAnalysisResults,
    complianceItems,
    activeProjectId,
    activeProgrammeId,
    projects,
    programmes,
    searchParams,
    phase,
    isResetting,
  ]);

  const pi = projectInfo as any;

  const set = (key: string, value: any) => {
    // Always read the freshest projectInfo from the store, NOT the component closure
    const currentInfo = useStore.getState().projectInfo || {};
    const updatedInfo = { ...currentInfo, [key]: value };
    setProjectInfo(updatedInfo);

    // Q1 then Q2 logic: Find next question
    const phases =
      activeType === "programme" ? PROGRAMME_PHASES : PROJECT_PHASES;
    let nextQId: string | null = null;
    let foundCurrent = false;
    let nextPId: string | null = null;

    for (const p of phases) {
      for (const q of p.questions) {
        if (foundCurrent) {
          nextQId = q.id;
          nextPId = p.id;
          break;
        }
        if (q.id === key) foundCurrent = true;
      }
      if (nextQId) break;
    }


    if (nextQId) {
      setActiveQuestionId(nextQId);
      if (nextPId) {
        const isNewPhase = !expandedPhases.includes(nextPId);
        if (isNewPhase) {
          setExpandedPhases([nextPId]); // Ensure ONLY the active phase is expanded
          // Pass nextQId to focus on that specific question within the new phase
          scrollToPhase(nextPId, nextQId);
        } else if (nextQId !== key) {
          // If in same phase but moving to next question,
          // Adjust to new standard offset 140
          scrollToId(`q-container-${nextQId}`, 140);
        }
      }
    } else {
      // Last question of last phase?
      setActiveQuestionId(null);
    }

    // Auto-transition logic for phases (as backup/fallback for phase completion)
    // Find if the current expanded phase is fully answered
    const currentExpandedId = expandedPhases[0];
    if (currentExpandedId) {
      const currentPhaseIndex = phases.findIndex(
        (p) => p.id === currentExpandedId,
      );
      if (currentPhaseIndex !== -1) {
        const currentPhase = phases[currentPhaseIndex];
        const allAnswered = currentPhase.questions.every((q) => {
          const val = updatedInfo[q.id];
          if (Array.isArray(val)) return val.length > 0;
          return val !== undefined && val !== null && val !== "";
        });

        // If all answered in this phase, and we're not already moving to a next question in a different phase
        if (
          allAnswered &&
          (!nextPId || nextPId === currentExpandedId) &&
          currentPhaseIndex < phases.length - 1
        ) {
          const nextPhase = phases[currentPhaseIndex + 1];
          const nextPhaseId = nextPhase.id;
          const firstNextQId = nextPhase.questions[0]?.id;

          setExpandedPhases([nextPhaseId]);
          if (firstNextQId) {
            setActiveQuestionId(firstNextQId);
            scrollToPhase(nextPhaseId, firstNextQId);
          } else {
            scrollToPhase(nextPhaseId);
          }
        }
      }
    }
  };

  const toggleChar = (val: string) => {
    const chars = (pi.chars || []) as string[];
    set(
      "chars",
      chars.includes(val)
        ? chars.filter((c: string) => c !== val)
        : [...chars, val],
    );
  };

  const isChar = (val: string) => ((pi.chars || []) as string[]).includes(val);

  const handleBulkAdd = (addableItems: any[]) => {
    const selectedToAdd = (
      Array.isArray(addableItems) ? addableItems : []
    ).filter(
      (i) =>
        selectedIds.includes(i.id) &&
        !(Array.isArray(complianceItems) ? complianceItems : []).some(
          (ci: any) => ci.id === i.id,
        ),
    );
    if (selectedToAdd.length === 0) return;

    const itemsToPush = selectedToAdd
      .map(({ id, reason }) => {
        const item = COMPLIANCE_ITEMS.find((i) => i.id === id);
        if (!item) return null;
        const dispName =
          (activeProjectId
            ? (Array.isArray(projects) ? projects : []).find(
                (p) => p.id === activeProjectId,
              )?.name
            : (Array.isArray(programmes) ? programmes : []).find(
                (p) => p.id === activeProgrammeId,
              )?.name) || "Portfolio";
        return {
          ...item,
          projectId: activeProjectId || undefined,
          programmeId: activeProgrammeId || undefined,
          projectName: dispName,
          isProgrammeLevel: !!activeProgrammeId,
          stage: "Not Started",
          conditional: true,
          condReason: reason || "Manually added",
        };
      })
      .filter((i) => i !== null) as any[];

    if (itemsToPush.length > 0) {
      addConditionalItems(itemsToPush);
    }
    setSelectedIds([]);
  };

  const handleProgrammeSelect = async (progId: string) => {
    setLoading(true);
    setIsDataLoading(true);
    try {
      // Immediately zero out all compliance state for the previous context so no
      // stale data flashes while the new programme's data loads asynchronously.
      useStore.setState({
        lastAnalysisResults: null,
        complianceAnalysis: null,
        complianceItems: [],
        projectInfo: {},
        isComplianceLocked: true,
      });
      setPhase(1);
      setSubPhase("review");
      setPathChoice("none");
      setIsQuestionnaireActive(false);
      setLastAnalyzedAnswers(null);
      setActiveQuestionId(null);
      setExpandedPhases([]);
      setCurrentQuestionPhase(0);
      setError(null);

      await loadProgrammeData(progId);

      // After loadProgrammeData, check if Firestore returned saved projectInfo
      const loadedInfo = useStore.getState().projectInfo as any;
      const hasSavedInfo = loadedInfo && Object.keys(loadedInfo).length > 0 && loadedInfo.name;

      const storeProgrammes = useStore.getState().programmes;
      const prog = (Array.isArray(storeProgrammes) ? storeProgrammes : []).find(
        (p) => p.id === progId,
      );
      if (prog && !hasSavedInfo) {
          // Comprehensive mapping from Initiation to Compliance Questions
          const totalValue = Number(prog.totalValue) || 0;

          // Only pre-fill fields where source data is explicitly set.
          // Leave toggle questions blank so the user must answer them.
          const mappedInfo: Record<string, any> = {
            name: prog.name,
            type: prog.type || "",
            loc: prog.geographicScope || "",
            scope: prog.strategicObjectives || (prog as any).scope || "",
            value: prog.totalValue?.toString() || "",
            ap: prog.sponsor || "",
            notes: prog.notes || "",
            completion: prog.programmeEndDate
              ? prog.programmeEndDate.substring(0, 7)
              : (prog as any).endDate
                ? (prog as any).endDate.substring(0, 7)
                : "",
            hasHRB: prog.hrbScheme || "",
            hasLeasehold: prog.leaseholderStatus || "",
            funders: prog.funders || [],
            rshStandards: prog.rshStandards || [],
            regulatoryObligations: prog.regulatoryObligations || [],
            q2_tenures: (prog as any).tenureMix || [],
            q3_3: "Yes", // Programmes are primarily residential by default in Cedar
          };
          // Only pre-fill toggle questions when source value is explicitly positive
          if ((prog as any).type?.includes("Local Authority")) {
            mappedInfo.q1_1 = "Yes";
            mappedInfo.q10_1 = "Yes";
          }
          if ((prog as any).type?.includes("Registered Provider") || (prog as any).type?.includes("Housing Association")) mappedInfo.q1_2 = "Yes";
          if ((prog as any).regulatoryObligations?.includes("Regulator of Social Housing (RSH)") || (prog as any).regulatoryObligations?.includes("RSH")) mappedInfo.q1_3 = "Yes";
          if ((prog as any).type?.toLowerCase().includes("social") || (prog as any).type?.toLowerCase().includes("affordable")) mappedInfo.q1_4 = "Yes";
          if ((prog as any).regulatoryObligations?.length > 0) mappedInfo.q1_5 = "Yes";
          if (totalValue > 0 || prog.fundingSources) mappedInfo.q1_6 = "Yes";
          if ((prog as any).leaseholderStatus === "Yes") { mappedInfo.q2_3 = "Yes"; mappedInfo.q2_4 = "Yes"; }
          if ((prog as any).type?.toLowerCase().includes("supported") || (prog as any).type?.toLowerCase().includes("care")) mappedInfo.q2_5 = "Yes";
          if ((prog as any).hrbScheme === "Yes") { mappedInfo.q3_1 = "Yes"; mappedInfo.q3_2 = "Yes"; }
          setProjectInfo(mappedInfo as any);
      }
    } catch (err) {
      console.error("Failed to select programme:", err);
      setError("Failed to load programme data.");
    } finally {
      setLoading(false);
      setIsDataLoading(false);
    }
  };

  const handleProjectSelect = async (projId: string) => {
    setLoading(true);
    setIsDataLoading(true);
    try {
      // Immediately zero out all compliance state for the previous context so no
      // stale data flashes while the new project's data loads asynchronously.
      useStore.setState({
        lastAnalysisResults: null,
        complianceAnalysis: null,
        complianceItems: [],
        projectInfo: {},
        isComplianceLocked: true,
      });
      setPhase(1);
      setSubPhase("review");
      setPathChoice("none");
      setIsQuestionnaireActive(false);
      setLastAnalyzedAnswers(null);
      setActiveQuestionId(null);
      setExpandedPhases([]);
      setCurrentQuestionPhase(0);
      setError(null);

      await loadProjectData(projId);

      // After loadProjectData, check if Firestore returned saved projectInfo
      const loadedInfo = useStore.getState().projectInfo as any;
      const hasSavedInfo = loadedInfo && Object.keys(loadedInfo).length > 0 && loadedInfo.name;

      const storeProjects = useStore.getState().projects;
      const proj = (Array.isArray(storeProjects) ? storeProjects : []).find(
        (p) => p.id === projId,
      );
      if (proj && !hasSavedInfo) {
          // Map Units
          const units = Number(proj.numberOfUnits) || 0;
          let unitRange = "1–10 units";
          if (units > 500) unitRange = "500+ units";
          else if (units > 250) unitRange = "251–500 units";
          else if (units > 100) unitRange = "101–250 units";
          else if (units > 50) unitRange = "51–100 units";
          else if (units > 10) unitRange = "11–50 units";

          // Map Storeys
          const storeys = Number(proj.numberOfStoreys) || 0;
          let storeyRange = "1–2 storeys";
          if (storeys > 30) storeyRange = "30+ storeys";
          else if (storeys > 15) storeyRange = "16–30 storeys";
          else if (storeys >= 8) storeyRange = "8–15 storeys";
          else if (storeys === 7) storeyRange = "7 storeys";
          else if (storeys >= 3) storeyRange = "3–6 storeys";

          // Only pre-fill fields where source data is explicitly set.
          // Leave toggle questions blank so the user must answer them.
          const mappedInfo: Record<string, any> = {
            name: proj.name,
            type: proj.type || "",
            loc: proj.loc || "",
            p1_type: proj.type || "",
            p1_client: proj.client || "",
            p2_use: (proj as any).useClassification ? [(proj as any).useClassification] : [],
          };
          if (units > 0) mappedInfo.p1_units = unitRange;
          if (proj.contractValue) mappedInfo.p1_value = proj.contractValue;
          if ((proj as any).occupiedDuringWorks === "Yes") mappedInfo.p1_occupied = "Yes";
          if ((proj as any).height) mappedInfo.p2_height = (proj as any).height;
          if (storeys > 0) mappedInfo.p2_storeys = storeyRange;
          if (proj.isHRB) {
            mappedInfo.p2_hrb = "Yes";
            mappedInfo.p3_g2 = "Yes";
            mappedInfo.p3_g3 = "Yes";
            mappedInfo.p3_golden = "Yes";
          }
          setProjectInfo(mappedInfo as any);
      }
    } catch (err) {
      console.error("Failed to select project:", err);
      setError("Failed to load project data.");
    } finally {
      setLoading(false);
      setIsDataLoading(false);
    }
  };

  const loadDemo = () => {
    // Only populate demo questionnaire data — do NOT override the active context
    setProjectInfo({
      name: "UK Strategic Housing Programme 2025-2029",
      type: "Programme of New Builds & Retrofits",
      q1_1: "Housing Association / ALMO", // Sector
      q1_2: "Housing Association / RP", // Org Type
      q1_3: "Strategic Sites – Nationwide", // Geographic Scope
      q1_4: "Delivery of 1,500+ residential units over 4 years", // Primary Objective
      q1_5: "£250,000,000", // Portfolio Value
      q2_1: "Higher-Risk Buildings (HRB) Included", // Building Category
      q2_2: "Mixed Tenure (Social/Shared/Private)", // Tenure Mix
      q2_3: "Yes — full ISO 19650 Compliance", // Digital Strategy/BIM
      q2_4: "Yes — multi-tenure blocks", // Leasehold
      q2_5: "Mixed — general needs & supported", // Vulnerability
      q3_1: "Homes England Strategic Partnership", // Primary Funder
      q3_2: "Safety and Quality Standard", // RSH Standard
      q3_3: "BSA 2022 — HRB Gateway Regime", // Regulatory Obligation
      loc: "Strategic Sites – Nationwide",
      scope:
        "Delivery of 1,500+ residential units over 4 years. Scope covers multiple HRB towers, estate regeneration, and large-scale brownfield development. Strategy includes full digital golden thread (BIM) and compliance with the Building Safety Act 2022.",
      notes:
        "Strategic programme involving 5 key regional hubs. Priority on net-zero carbon delivery and BSA 2022 implementation.",
    } as any);
  };

  // Analysis variables consolidated at component top

  const runAnalysis = async () => {
    const finalName =
      projectInfo.name ||
      (activeDetails as any)?.name ||
      (activeDetails as any)?.reference ||
      "";
    const finalType = projectInfo.type || (activeDetails as any)?.type || "";
    const finalLoc =
      projectInfo.loc ||
      (activeDetails as any)?.location ||
      (activeDetails as any)?.geographicScope ||
      (activeDetails as any)?.loc ||
      "";
    const finalScope =
      projectInfo.scope ||
      (activeDetails as any)?.description ||
      (activeDetails as any)?.strategicObjectives ||
      (activeDetails as any)?.scope ||
      "";
    const contextId = activeProjectId || activeProgrammeId;

    if (!finalName || !finalType || !finalLoc || !finalScope || !contextId) {
      const missing = [];
      if (!contextId) missing.push("Project/Programme Selection");
      if (!finalName) missing.push("Name");
      if (!finalType) missing.push("Type");
      if (!finalLoc) missing.push("Location/Region");
      if (!finalScope) missing.push("Scope/Objectives");
      setError(
        `Validation failed: Please ensure the following information is available: ${missing.join(", ")}.`,
      );
      return;
    }

    if (
      activeDetails.complianceSetupDone &&
      lastAnalysisResults &&
      !showAnalysisExists
    ) {
      setShowAnalysisExists(true);
      return;
    }

    setError(null);
    const answersJson = JSON.stringify(projectInfo);
    if (answersJson === lastAnalyzedAnswers && phase === 3) {
      setPhase(3);
      setSubPhase("review");
      return;
    }

    setLoading(true);
    setLoadingStep("Validating Project Profile...");
    try {
      const masterIds = new Set(COMPLIANCE_ITEMS.map((i) => i.id));
      // Optimize: Use a Map for O(1) lookups instead of O(N^2)
      const currentItemsMap = new Map(
        (Array.isArray(complianceItems) ? complianceItems : []).map(
          (i: any) => [i.id, i],
        ),
      );

      const allLibraryItems = COMPLIANCE_ITEMS.map((masterItem) => {
        return currentItemsMap.get(masterItem.id) || masterItem;
      });

      // Add any custom items that are not in the master library
      (Array.isArray(complianceItems) ? complianceItems : []).forEach(
        (i: any) => {
          if (!masterIds.has(i.id)) {
            allLibraryItems.push(i);
          }
        },
      );

      const isHRB =
        projectInfo.q2_1?.toLowerCase().includes("hrb") ||
        projectInfo.q2_1?.toLowerCase().includes("higher-risk") ||
        projectInfo.p2_hrb === "Yes" ||
        projectInfo.p2_hrb === "true" ||
        String(projectInfo.storeys || "").includes("7") ||
        String(projectInfo.storeys || "").includes("8-15") ||
        String(projectInfo.storeys || "").includes("16-30") ||
        String(projectInfo.storeys || "").includes("30+") ||
        String(projectInfo.p2_storeys || "").includes("7") ||
        String(projectInfo.p2_storeys || "").includes("8-15") ||
        String(projectInfo.p2_storeys || "").includes("16-30") ||
        String(projectInfo.p2_storeys || "").includes("30+");
        
      const isSocialHousing =
        projectInfo.q2_2?.toLowerCase().includes("social") ||
        projectInfo.type?.toLowerCase().includes("social") ||
        projectInfo.scope?.toLowerCase().includes("social") ||
        projectInfo.p2_use?.some((u: string) => u.toLowerCase().includes("social") || u.toLowerCase().includes("affordable")) ||
        projectInfo.p1_client?.toLowerCase().includes("housing association") ||
        projectInfo.p1_client?.toLowerCase().includes("local authority");
        
      const isRetrofit =
        projectInfo.q2_6 === "Yes" ||
        projectInfo.scope?.toLowerCase().includes("retrofit") ||
        projectInfo.p1_type?.toLowerCase().includes("retrofit") ||
        projectInfo.p1_type?.toLowerCase().includes("refurb");

      const filteredLibrary = allLibraryItems.filter((item) => {
        const id = item.id.toLowerCase();
        // Only skip HRB-gateway-specific items (bs-1 to bs-5) if not an HRB.
        // Non-gateway BS items (bs-6 cladding, bs-7 remediation, etc.) may apply to any building.
        if (id.startsWith("bs-") && !isHRB) {
          const bsNum = parseInt(id.replace("bs-", ""), 10);
          if (!isNaN(bsNum) && bsNum <= 5) return false;
        }

        // We used to skip sh- and rf- items here, but we will now let the AI handle it
        // so that the AI can explain WHY they are excluded, providing better transparency.
        return true;
      });

      const fullInfo = {
        name: projectInfo.name || activeDetails?.name,
        type: projectInfo.type || activeDetails?.type,
        loc:
          projectInfo.loc ||
          (activeDetails as any)?.geographicScope ||
          (activeDetails as any)?.location ||
          (activeDetails as any)?.loc,
        scope:
          projectInfo.scope ||
          (activeDetails as any)?.strategicObjectives ||
          (activeDetails as any)?.description ||
          (activeDetails as any)?.scope ||
          "",
        ...projectInfo,
        hasHRB: isHRB ? "Yes" : "No",
        hasLeasehold:
          projectInfo.q2_4?.includes("Yes") || projectInfo.leasehold === "Yes"
            ? "Yes"
            : "No",
        hasDamp:
          projectInfo.q2_2?.toLowerCase().includes("damp") ||
          projectInfo.q5_4 === "Yes"
            ? "Yes"
            : "No",
        hasBIM:
          projectInfo.q2_3?.toLowerCase().includes("yes") ||
          projectInfo.q2_3?.toLowerCase().includes("bim")
            ? "Yes"
            : "No",
        hasRetrofit: isRetrofit ? "Yes" : "No",
      };

      if (
        !fullInfo.name ||
        !fullInfo.type ||
        !fullInfo.loc ||
        !fullInfo.scope
      ) {
        setError("Core details (Name, Type, Location, Scope) are missing.");
        setLoading(false);
        setLoadingStep(null);
        return;
      }

      setLoadingStep("Cross-referencing 160+ UK Regulations...");
      const analysis = await analyzeCompliance(fullInfo, filteredLibrary);
      if (!isMountedRef.current) return;
      setLoadingStep("Building Compliance Strategy...");
      setLastAnalyzedAnswers(answersJson);
      setProjectInfo(fullInfo);
      setComplianceAnalysis(analysis);

      const conditionalObjs: { id: string; reason: string }[] = (
        analysis.conditionalIds || []
      ).map((c: any) =>
        typeof c === "string"
          ? { id: c, reason: "Conditionally matched based on profile." }
          : { id: c.id, reason: c.reason || "Conditionally matched." },
      );
      const conditionalIdSet = new Set(conditionalObjs.map((c) => c.id));

      setLastAnalysisResults({
        summary: analysis.summary,
        applicableIds: analysis.applicableIds || [],
        excludedIds: analysis.excludedIds || [],
        conditionalIds: conditionalObjs,
        regulatoryAuthorities: analysis.regulatoryAuthorities || [],
        criticalActions: analysis.criticalActions || [],
        requiredApprovals: analysis.requiredApprovals || [],
        keyRisks: analysis.keyRisks || [],
        category: determineProjectCategory(fullInfo).category,
      });

      // Note: complianceSetupDone is now set in handleFinalise to ensure the sequence is correct

      // Pre-populate tracker with both AI-included (applicable) and conditional items
      const itemsToSet = [
        ...allLibraryItems
          .filter(
            (item) =>
              (analysis.applicableIds || []).includes(item.id) &&
              !conditionalIdSet.has(item.id),
          )
          .map((item) => ({
            ...item,
            projectId: activeProjectId || undefined,
            programmeId: activeProgrammeId || undefined,
            projectName: dispName,
            isProgrammeLevel: !!activeProgrammeId,
            stage: "Not Started",
            status: "applicable" as const,
          })),
        ...allLibraryItems
          .filter((item) => conditionalIdSet.has(item.id))
          .map((item) => {
            const cond = (analysis.conditionalIds || []).find(
              (c: any) => (typeof c === "string" ? c : c.id) === item.id,
            );
            return {
              ...item,
              projectId: activeProjectId || undefined,
              programmeId: activeProgrammeId || undefined,
              projectName: dispName,
              isProgrammeLevel: !!activeProgrammeId,
              stage: "Not Started",
              status: "pending" as const,
              condReason:
                typeof cond === "object"
                  ? cond.condition
                  : "Conditionally matched based on profile.",
            };
          }),
      ];

      setComplianceItems(itemsToSet);

      // Save analysis to DB so phase 3 restores correctly after a page refresh.
      // complianceItems are also auto-saved by the store setter, so both sides
      // of the resume state are persisted. Neither write sets complianceSetupDone —
      // that only happens on Publish, keeping the "already complete" modal silent.
      const analysisPayload = {
        summary: analysis.summary,
        applicableIds: analysis.applicableIds || [],
        excludedIds: analysis.excludedIds || [],
        conditionalIds: conditionalObjs,
        regulatoryAuthorities: analysis.regulatoryAuthorities || [],
        criticalActions: analysis.criticalActions || [],
        requiredApprovals: analysis.requiredApprovals || [],
        keyRisks: analysis.keyRisks || [],
        category: determineProjectCategory(fullInfo).category,
      };
      api.saveData("complianceAnalysis", analysisPayload, contextId).catch(console.error);

      // Unlock tracker so user can review
      setComplianceLocked(false);
      setShowAnalysisExists(false);

      // Scroll to top when showing results
      const main = document.querySelector("main");
      if (main) {
        main.scrollTo({ top: 0, behavior: "smooth" });
      }

      setPhase(3);
      setSubPhase("review");
      toast.success("Compliance profile generated successfully!");
    } catch (err: any) {
      // aiService.ts already called handleAIError which shows a toast.
      // Only set the inline error state here to avoid double-toasting.
      const friendlyMessage =
        err?.message?.includes("429") || err?.message?.includes("RESOURCE_EXHAUSTED")
          ? "AI capacity reached. Please wait a moment and try again."
          : err?.message || "Failed to generate AI insights. Please try again.";
      setError(friendlyMessage);
    } finally {
      setLoading(false);
      setLoadingStep(null);
    }
  };

  const handleRestart = () => {
    setShowRestartConfirm(true);
  };

  const handleRestartConfirmed = async () => {
    setShowRestartConfirm(false);
    const contextId = activeProjectId || activeProgrammeId;
    if (!contextId) return;

    setIsRestarting(true);
    setIsResetting(true);
    setShowAnalysisExists(false);
    try {
        // 1. Clear all compliance-related data from Firestore in parallel
        const clearOps: Promise<any>[] = [
          api.saveData("complianceItems", [], contextId),
          api.saveData("complianceAnalysis", null, contextId),
        ];

        // 2. Reset complianceSetupDone flag on the project/programme
        if (activeType === "project") {
          clearOps.push(updateProject(contextId, { complianceSetupDone: false }));
        } else {
          clearOps.push(updateProgramme(contextId, { complianceSetupDone: false }));
        }

        // 3. Clear questionnaire answers from projectInfo, keep core details
        const newInfo = { ...projectInfo };
        Object.keys(newInfo).forEach((key) => {
          if (
            key.startsWith("q") ||
            key.startsWith("pg_") ||
            key.startsWith("pj_") ||
            key.startsWith("p1_") ||
            key.startsWith("p2_") ||
            key.startsWith("p3_") ||
            key.startsWith("p4_") ||
            key.startsWith("p5_")
          ) {
            delete (newInfo as any)[key];
          }
        });
        if ((newInfo as any).chars) delete (newInfo as any).chars;
        clearOps.push(api.saveData("projectInfo", newInfo, contextId));

        await Promise.all(clearOps);

        // 4. Sync store state after successful backend clear
        if (activeType === "project") {
          setComplianceItems(
            (Array.isArray(complianceItems) ? complianceItems : []).filter(
              (c) => c.projectId !== contextId,
            ),
          );
        } else {
          setComplianceItems(
            (Array.isArray(complianceItems) ? complianceItems : []).filter(
              (c) => c.programmeId !== contextId,
            ),
          );
        }
        setLastAnalysisResults(null);
        setComplianceAnalysis(null);
        // Update projectInfo in store (also persists, but already saved above)
        useStore.setState({ projectInfo: newInfo });

        // 5. Navigate cleanly to step 1 of setup, stripping all stale params
        const preservedParams = new URLSearchParams();
        if (activeProjectId) preservedParams.set("projectId", activeProjectId);
        if (activeProgrammeId) preservedParams.set("programmeId", activeProgrammeId);
        if (activeType) preservedParams.set("type", activeType);
        preservedParams.set("restart", "true");
        navigate(`/compliance/setup?${preservedParams.toString()}`, { replace: true });
      } catch (err) {
        console.error("Failed to restart analysis:", err);
        setError("Failed to reset compliance data. Please try again.");
        setIsResetting(false);
      } finally {
        setIsRestarting(false);
        if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
        resetTimerRef.current = setTimeout(() => {
          if (isMountedRef.current) setIsResetting(false);
        }, 800);
      }
  };

  const handleFinalise = () => {
    // No backend writes here — all data is persisted only when the user publishes.
    // This just advances the UI to the summary/publish step.
    const categoryData = determineProjectCategory(projectInfo);
    if (lastAnalysisResults) {
      setComplianceAnalysis({
        ...lastAnalysisResults,
        category: categoryData.category,
      });
    }
    setPhase(4);
    const main = document.querySelector("main");
    if (main) {
      main.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const publishFramework = async () => {
    setLoading(true);
    try {
      const contextId = activeProjectId || activeProgrammeId;
      if (!contextId) throw new Error("No context ID");

      const categoryData = determineProjectCategory(projectInfo);
      const analysisPayload = lastAnalysisResults
        ? { ...lastAnalysisResults, category: categoryData.category }
        : null;

      // Persist everything to the database — this is the single write point
      const publishOps: Promise<any>[] = [
        api.saveData("complianceItems", complianceItems, contextId),
      ];
      if (analysisPayload) {
        publishOps.push(api.saveData("complianceAnalysis", analysisPayload, contextId));
      }
      if (activeType === "project") {
        publishOps.push(
          updateProject(contextId, {
            complianceSetupDone: true,
            category: categoryData.category,
          }),
        );
      } else {
        publishOps.push(
          updateProgramme(contextId, {
            complianceSetupDone: true,
            category: categoryData.category,
          }),
        );
      }
      await Promise.all(publishOps);

      // Keep complianceItems and complianceAnalysis in the store so the compliance
      // dashboard renders immediately without a blank flash.
      // Store cleanup (items, analysis, projectInfo answers) happens naturally when
      // the user later switches project/programme (handleProjectSelect/handleProgrammeSelect)
      // or clicks Restart Analysis. No eager wipe needed here.
      useStore.setState({ lastAnalysisResults: null });

      const target = fromInitiation
        ? "/compliance/dashboard?from=initiation"
        : "/compliance/dashboard";
      navigate(target);
    } catch (err) {
      console.error("Failed to publish:", err);
      setError(
        "Failed to complete publication. Your progress is saved locally, but may not have reached the server.",
      );
      const target = fromInitiation
        ? "/compliance/dashboard?from=initiation"
        : "/compliance/dashboard";
      navigate(target);
    } finally {
      setLoading(false);
      setLoadingStep(null);
    }
  };

  // ─── Build Stage 2 addable items ──────────────────────────────────────────
  const buildAddableItems = () => {
    if (!lastAnalysisResults) return [];
    const conditionalObjs: {
      id: string;
      reason: string;
      type: "conditional";
    }[] = Array.isArray(lastAnalysisResults.conditionalIds)
      ? lastAnalysisResults.conditionalIds.map((c: any) =>
          typeof c === "string"
            ? {
                id: c,
                reason: "Conditionally matched based on project profile.",
                type: "conditional" as const,
              }
            : {
                id: c.id,
                reason: c.condition || c.reason || "Conditionally matched.",
                type: "conditional" as const,
              },
        )
      : [];

    const aiApplicable = new Set(lastAnalysisResults.applicableIds || []);
    const alreadyInTracker = new Set(
      (Array.isArray(complianceItems) ? complianceItems : []).map(
        (i: any) => i.id,
      ),
    );
    const conditionalIdSet = new Set(conditionalObjs.map((c) => c.id));

    const excludedMap = new Map<string, string>();
    if (Array.isArray(lastAnalysisResults.excludedIds)) {
      lastAnalysisResults.excludedIds.forEach((item: any) => {
        if (typeof item === "string") {
          excludedMap.set(item, "Excluded by AI analysis.");
        } else if (item && item.id) {
          excludedMap.set(item.id, item.exclusionReason || item.reason || "Excluded by AI analysis.");
        }
      });
    }

    const excludedItems = COMPLIANCE_ITEMS.filter(
      (item) =>
        !aiApplicable.has(item.id) &&
        !conditionalIdSet.has(item.id) &&
        !alreadyInTracker.has(item.id),
    ).map((item) => ({
      id: item.id,
      reason: excludedMap.get(item.id) || "Excluded due to technical characteristics logic.",
      type: "excluded" as const,
    }));

    // Filter out conditional items already in the Framework Scope tab
    return [...conditionalObjs.filter(c => !alreadyInTracker.has(c.id)), ...excludedItems];
  };

  return (
    <>
      <div className="relative space-y-6 overflow-visible">
        {!!loadingStep && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60  animate-in fade-in duration-300">
            <div className="bg-white p-12 rounded-lg  border border-slate-100 flex flex-col items-center gap-8 max-w-sm w-full mx-4 text-center transform scale-100 animate-in zoom-in-95 duration-300">
              <div className="relative">
                <div className="w-24 h-24 border-4 border-indigo-100 rounded-full animate-spin border-t-indigo-600"></div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <ScanSearch className="w-8 h-8 text-indigo-600 animate-pulse" />
                </div>
              </div>
              <div>
                <h3 className="text-xl font-semibold text-slate-900 mb-2 ">
                  CedarGuard AI
                </h3>
                <p className="text-sm font-bold text-slate-500 leading-relaxed min-h-[40px]">
                  {loadingStep ||
                    "Analyzing your profile against 160+ regulatory requirements..."}
                </p>
              </div>
              <div className="flex gap-2">
                <div className="w-2 h-2 rounded-full bg-indigo-600 animate-bounce delay-0"></div>
                <div className="w-2 h-2 rounded-full bg-indigo-600 animate-bounce delay-150"></div>
                <div className="w-2 h-2 rounded-full bg-indigo-600 animate-bounce delay-300"></div>
              </div>
            </div>
          </div>
        )}
        {/* Restart Confirmation Dialog*/}
        {showRestartConfirm && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/60  animate-in fade-in duration-200">
            <div className="bg-white rounded-lg  border border-slate-100 max-w-md w-full overflow-hidden animate-in zoom-in duration-300">
              <div className="p-8 text-center">
                <div className="w-16 h-16 bg-red-50 rounded-lg flex items-center justify-center mx-auto mb-6 ring-4 ring-white ">
                  <AlertTriangle className="w-8 h-8 text-red-500" />
                </div>
                <h3 className="text-2xl font-semibold text-slate-900  mb-3">
                  Restart Analysis?
                </h3>
                <p className="text-slate-500 text-sm leading-relaxed font-medium mb-8">
                  This will permanently clear all compliance items, AI results and questionnaire answers for this {activeType}. This action cannot be undone.
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setShowRestartConfirm(false)}
                    className="w-full px-6 py-4 bg-slate-100 text-slate-700 rounded-lg font-medium text-sm hover:bg-slate-200 transition-all "
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleRestartConfirmed}
                    className="w-full px-6 py-4 bg-red-600 text-white rounded-lg font-medium text-sm hover:bg-red-700 transition-all hover: hover: "
                  >
                    Yes, Restart
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
        {isRestarting && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-900/60  animate-in fade-in duration-200">
            <div className="bg-white rounded-lg  p-8 flex flex-col items-center gap-4 max-w-xs w-full mx-4">
              <Loader2 className="w-10 h-10 text-indigo-600 animate-spin" />
              <div className="text-center">
                <p className="text-sm font-mono font-medium text-slate-800 uppercase tracking-wide">Clearing Analysis Data</p>
                <p className="text-xs text-slate-500 mt-1">Removing all previous compliance results...</p>
              </div>
            </div>
          </div>
        )}
        {isDataLoading && !loadingStep && !isRestarting && createPortal(
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50">
            <div className="bg-white rounded-lg shadow-xl p-6 flex flex-col items-center gap-3 max-w-xs w-full mx-4">
              <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
              <p className="text-sm font-medium text-slate-700">Loading…</p>
            </div>
          </div>,
          document.body,
        )}
        {/* Existing Analysis Overlay*/}
        {showAnalysisExists && createPortal(
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
              <div className="text-center">
                <span className="inline-flex w-12 h-12 items-center justify-center rounded-md bg-indigo-50 text-indigo-600 mx-auto mb-4">
                  <ShieldCheck className="w-6 h-6" />
                </span>
                <h3 className="text-xl font-semibold text-slate-900 mb-2">
                  Analysis already complete
                </h3>
                <p className="text-sm text-slate-600 leading-relaxed max-w-sm mx-auto mb-6">
                  A compliance analysis has already been performed for this {activeType}. Would you like to view the results or start fresh?
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <button
                    onClick={() =>
                      navigate(
                        activeType === "programme"
                          ? `/compliance/dashboard?type=programme${fromInitiation ? "&from=initiation" : ""}`
                          : `/compliance/dashboard?type=project${fromInitiation ? "&from=initiation" : ""}`,
                      )
                    }
                    className="inline-flex items-center justify-center gap-1.5 px-4 h-10 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-md transition-colors"
                  >
                    View dashboard <ArrowRight className="w-4 h-4" />
                  </button>
                  <button
                    onClick={handleRestart}
                    disabled={loading}
                    className="inline-flex items-center justify-center gap-1.5 px-4 h-10 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Restart analysis
                  </button>
                </div>

                {fromInitiation && (
                  <div className="mt-4">
                    <button
                      disabled={loading}
                      onClick={async () => {
                        const contextId = activeProjectId || activeProgrammeId;
                        if (contextId) {
                          if (activeType === "project")
                            await updateProject(contextId, {
                              complianceSetupDone: true,
                            });
                          else
                            await updateProgramme(contextId, {
                              complianceSetupDone: true,
                            });
                        }
                        navigate(
                          activeType === "programme"
                            ? "/programmes/new"
                            : "/initiate",
                        );
                      }}
                      className="inline-flex items-center gap-1.5 px-3 h-9 text-sm font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-md hover:bg-emerald-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      <CheckCircle2 className="w-4 h-4" /> Continue to initiation step 3
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>,
          document.body
        )}

        <div className="space-y-6 sm:space-y-8 overflow-visible">
          {fromInitiation && (
            <div className="flex justify-start mb-0 -mt-2">
              <Link
                to={activeProjectId ? "/initiate" : "/programmes/new"}
                className="flex items-center gap-2 px-5 py-3 bg-slate-900 text-white rounded-lg sm:rounded-lg font-medium text-sm  shadow-slate-200 hover:bg-indigo-600 transition-all  animate-in fade-in slide-in-from-right-4 duration-700"
              >
                <ArrowLeft className="w-4 h-4" />{" "}
                <span className="hidden sm:inline">
                  Back to Initiation Flow
                </span>
                <span className="sm:hidden">Back</span>
              </Link>
            </div>
          )}

          {/* ─── Premium Breadcrumb Nav ───*/}
          <div className="flex items-center justify-between bg-white  p-2 sm:p-3 rounded-lg sm:rounded-lg border border-slate-200/50 shadow-sm mb-4 overflow-x-auto scrollbar-hide">
            <div className="flex items-center gap-1 sm:gap-2 shrink-0 min-w-max px-1">
              {[
                { n: 1, label: "Metadata", p: 1 },
                { n: 2, label: "Identification", p: 2 },
                { n: 3, label: "Strategic Review", p: 3 },
                { n: 4, label: "Publication", p: 4 },
              ].map((s, i) => {
                const isActive = phase === s.p;
                const isPast = phase > s.p;
                const isLocked = s.p > 2 && pathChoice === "none";

                return (
                  <React.Fragment key={s.n}>
                    <button
                      disabled={isLocked && !isPast && !isActive}
                      onClick={() => {
                        // Prevent jumping to Strategic Review without AI results
                        if (s.p === 3 && !lastAnalysisResults) {
                          toast.error("Run AI Analysis first to access Strategic Review.");
                          return;
                        }
                        // Prevent jumping to Publication if not finalised
                        if (s.p === 4 && phase < 4 && !activeDetails?.complianceSetupDone) {
                          toast.error("Please click 'Finalise Analysis' to save your results before proceeding to publication.", {
                            icon: "🔒",
                            className: "font-mono font-medium text-xs uppercase tracking-wide"
                          });
                          return;
                        }

                        if (!isLocked || s.p <= phase) {
                          setPhase(s.p);
                          // Sync questionnaire state with phase for correct rendering
                          if (s.p === 1) {
                            setIsQuestionnaireActive(false);
                          } else if (s.p === 2) {
                            setIsQuestionnaireActive(true);
                            setPathChoice("detailed");
                          }
                        }
                      }}
                      className={clsx(
                        "flex items-center gap-2 px-4 py-2.5 rounded-lg transition-all duration-500 group/step",
                        isActive
                          ? "bg-slate-900 text-white  shadow-slate-200"
                          : isPast
                            ? "text-emerald-600 bg-emerald-50/50 hover:bg-emerald-100/50"
                            : isLocked
                              ? "text-slate-300 cursor-not-allowed"
                              : "text-slate-400 hover:bg-slate-100/50",
                      )}
                    >
                      <div
                        className={clsx(
                          "w-5 h-5 rounded-lg flex items-center justify-center text-xs font-semibold  transition-all duration-500",
                          isActive
                            ? "bg-white/20"
                            : isPast
                              ? "bg-emerald-100"
                              : isLocked
                                ? "bg-slate-50 opacity-50"
                                : "bg-slate-100 group-hover/step:-translate-y-px",
                        )}
                      >
                        {isPast ? (
                          <Check className="w-3 h-3" />
                        ) : isLocked ? (
                          <Lock className="w-2.5 h-2.5" />
                        ) : (
                          s.n
                        )}
                      </div>
                      <span className="text-xs font-mono font-medium uppercase tracking-wide hidden lg:inline">
                        {s.label}
                      </span>
                    </button>
                    {i < 3 && (
                      <div className="w-4 h-px bg-slate-200 hidden lg:block"></div>
                    )}
                  </React.Fragment>
                );
              })}
            </div>
            <div className="hidden md:flex items-center gap-3">
              <div className="text-right">
                <p className="text-xs font-mono font-medium text-slate-500 uppercase tracking-wide leading-none mb-1">
                  Status
                </p>
                <p className="text-sm font-semibold text-slate-900 leading-none">
                  {phase === 1
                    ? "Phase 1: Metadata"
                    : phase === 2
                      ? "Phase 2: Identification"
                      : phase === 3
                        ? "Phase 3: Review"
                        : "Phase 4: Done"}
                </p>
              </div>
              <div className="relative w-12 h-12 shrink-0">
                <svg className="w-12 h-12 -rotate-90" viewBox="0 0 48 48">
                  <circle
                    cx="24"
                    cy="24"
                    r="20"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                    className="text-slate-200"
                  />
                  <circle
                    cx="24"
                    cy="24"
                    r="20"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeLinecap="round"
                    className="text-indigo-600 transition-all duration-700"
                    strokeDasharray={2 * Math.PI * 20}
                    strokeDashoffset={2 * Math.PI * 20 * (1 - phase / 4)}
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center text-xs font-semibold text-indigo-600 tabular-nums">
                  {Math.round((phase / 4) * 100)}%
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pt-4 pb-2">
            <div className="flex items-center gap-5">
              <div className="w-16 h-16 bg-white rounded-lg  flex items-center justify-center border border-slate-100 animate-in zoom-in duration-700">
                <ClipboardList className="w-8 h-8 text-indigo-600" />
              </div>
              <div>
                <h1 className="text-2xl sm:text-4xl font-semibold text-slate-900  leading-none mb-1">
                  Compliance Setup
                </h1>
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
                  <p className="text-xs font-mono font-medium text-slate-400 uppercase tracking-wide">
                    {phase === 1
                      ? "Step 1: Define Metadata"
                      : phase === 2
                        ? "Step 2: Identify Regulations"
                        : "Step 3: Strategic Verification"}
                  </p>
                </div>
              </div>
            </div>

            <div className="hidden lg:block">
              <div className="bg-white/50  px-6 py-4 rounded-lg border border-slate-200/60 shadow-sm max-w-md">
                <p className="text-xs text-slate-500 font-medium leading-relaxed">
                  {phase === 1
                    ? "Define the scope and core metadata for your compliance assessment."
                    : phase === 2
                      ? "Select your identification method to determine applicable building regulations."
                      : "Review and verify the regulations identified for your project."}
                </p>
              </div>
            </div>
          </div>

          {error && (
            <div className="mb-8">
              <AIErrorAlert
                error={error}
                onRetry={runAnalysis}
              />
            </div>
          )}


          {/* ─── Analysis Results ───*/}
          {phase === 3 && lastAnalysisResults && (
            <AnalysisSummary
              projectInfo={projectInfo}
              lastAnalysisResults={lastAnalysisResults}
              complianceItems={complianceItems}
              subPhase={subPhase}
              setSubPhase={setSubPhase}
              selectedIds={selectedIds}
              setSelectedIds={setSelectedIds}
              toggleSelectAll={toggleSelectAll}
              toggleSelectOne={toggleSelectOne}
              handleBulkAdd={handleBulkAdd}
              deleteComplianceItem={deleteComplianceItem}
              addConditionalItems={addConditionalItems}
              buildAddableItems={buildAddableItems}
              activeProjectId={activeProjectId}
              activeProgrammeId={activeProgrammeId}
              dispName={dispName}
              handleFinalise={handleFinalise}
              loading={loading}
            />
          )}

          {/* ─── Publication & Completion ───*/}
          {phase === 4 && (
            <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in zoom-in duration-700 pb-20">
              <div className="bg-slate-900 rounded-lg p-12 text-white relative overflow-hidden ">
                <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-600/20 rounded-full blur-3xl -mr-32 -mt-32"></div>
                <div className="relative z-10 flex flex-col items-center text-center space-y-8">
                  <div className="w-24 h-24 bg-emerald-500 rounded-lg flex items-center justify-center  /20">
                    <ShieldCheck className="w-12 h-12 text-white" />
                  </div>
                  <div className="space-y-4">
                    <h2 className="text-2xl sm:text-4xl font-semibold tracking-tight ">
                      Framework Ready for Publication
                    </h2>
                    <p className="text-slate-400 font-medium max-w-xl mx-auto leading-relaxed text-sm sm:text-base">
                      Strategically verified compliance framework for{" "}
                      <strong>{dispName}</strong> is complete. Publishing will
                      activate live tracking and regulatory monitoring.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full pt-8">
                    <div className="bg-white/5 border border-white/10 rounded-lg p-6">
                      <p className="text-xs font-mono font-medium text-slate-500 uppercase tracking-wide mb-2">
                        Requirements
                      </p>
                      <p className="text-3xl font-semibold">
                        {complianceItems.length}
                      </p>
                    </div>
                    <div className="bg-white/5 border border-white/10 rounded-lg p-6">
                      <p className="text-xs font-mono font-medium text-slate-500 uppercase tracking-wide mb-2">
                        Authorities
                      </p>
                      <p className="text-3xl font-semibold">
                        {lastAnalysisResults?.regulatoryAuthorities?.length ||
                          0}
                      </p>
                    </div>
                    <div className="bg-white/5 border border-white/10 rounded-lg p-6">
                      <p className="text-xs font-mono font-medium text-slate-500 uppercase tracking-wide mb-2">
                        Confidence
                      </p>
                      <p className="text-3xl font-semibold text-emerald-400">
                        98%
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row items-center gap-4 pt-8">
                    <button
                      onClick={publishFramework}
                      disabled={loading}
                      className="flex items-center gap-3 px-10 py-5 bg-emerald-500 text-white rounded-lg font-medium text-sm hover:bg-emerald-600 transition-all   /20 disabled:opacity-50"
                    >
                      {loading && !loadingStep ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" /> Publishing...
                        </>
                      ) : (
                        <>
                          Publish Compliance Framework <ArrowRight className="w-4 h-4" />
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => setPhase(3)}
                      className="flex items-center gap-3 px-10 py-5 bg-white/10 text-white rounded-lg font-medium text-sm hover:bg-white/20 transition-all  border border-white/10"
                    >
                      <ArrowLeft className="w-4 h-4" /> Return to Review
                    </button>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-8">
                <div className="bg-white rounded-lg border border-slate-100 p-10 shadow-sm relative overflow-hidden group">
                  <h4 className="text-xs font-mono font-semibold text-slate-900 uppercase tracking-wide mb-6 flex items-center gap-2">
                    <Layers className="w-4 h-4 text-indigo-600" /> Key
                    Regulation Domains
                  </h4>
                  <div className="space-y-4">
                    {Array.from(
                      new Set(complianceItems.map((i: any) => i.domain)),
                    )
                      .slice(0, 5)
                      .map((domain: any) => (
                        <div
                          key={domain}
                          className="flex items-center justify-between p-4 bg-slate-50 rounded-lg border border-slate-100"
                        >
                          <span className="font-bold text-slate-700 text-sm">
                            {domain}
                          </span>
                          <span className="px-3 py-1 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-500">
                            {
                              complianceItems.filter(
                                (i: any) => i.domain === domain,
                              ).length
                            }{" "}
                            Items
                          </span>
                        </div>
                      ))}
                  </div>
                </div>
                <div className="bg-white rounded-lg border border-slate-100 p-10 shadow-sm">
                  <h4 className="text-xs font-mono font-semibold text-slate-900 uppercase tracking-wide mb-6 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-amber-500" /> Key
                    Actions & Milestones
                  </h4>
                  <div className="space-y-4">
                    {(lastAnalysisResults?.criticalActions || [])
                      .slice(0, 3)
                      .map((action: any, idx: number) => (
                        <div
                          key={idx}
                          className="p-4 bg-amber-50/50 rounded-lg border border-amber-100 flex items-start gap-4"
                        >
                          <div className="w-2 h-2 rounded-full bg-amber-500 mt-2"></div>
                          <div>
                            <p className="font-bold text-slate-900 text-sm">
                              {typeof action === "string"
                                ? action
                                : action.description}
                            </p>
                            <p className="text-xs text-amber-600 font-mono font-medium uppercase tracking-wide mt-1">
                              Priority: High
                            </p>
                          </div>
                        </div>
                      ))}
                    {(lastAnalysisResults?.criticalActions || []).length ===
                      0 && (
                      <>
                        <div className="p-4 bg-amber-50/50 rounded-lg border border-amber-100 flex items-start gap-4">
                          <div className="w-2 h-2 rounded-full bg-amber-500 mt-2"></div>
                          <div>
                            <p className="font-bold text-slate-900 text-sm">
                              Consumer Standards Return
                            </p>
                            <p className="text-xs text-amber-600 font-mono font-medium uppercase tracking-wide mt-1">
                              Due in 45 Days
                            </p>
                          </div>
                        </div>
                        <div className="bg-slate-50 rounded-lg border border-slate-100 p-6 flex items-center gap-4 group transition-all hover:bg-white hover:shadow-lg">
                          <div className="w-2 h-2 rounded-full bg-slate-300 mt-2"></div>
                          <div>
                            <p className="font-bold text-slate-900 text-sm">
                              Building Safety Case Update
                            </p>
                            <p className="text-xs text-slate-400 font-mono font-medium uppercase tracking-wide mt-1">
                              Pending Publication
                            </p>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ─── Questionnaire Flow (Path A) ───*/}
          {phase === 2 &&
            pathChoice === "detailed" &&
            isQuestionnaireActive && (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-8 duration-700 pb-20">
                {(activeType === "programme"
                  ? PROGRAMME_PHASES
                  : PROJECT_PHASES
                ).map((qPhase, idx) => {
                  const isExpanded = expandedPhases.includes(qPhase.id);
                  const contentId = `phase-content-${qPhase.id}`;
                  const headerId = `phase-header-${qPhase.id}`;

                  return (
                    <div
                      key={qPhase.id}
                      id={`phase-container-${qPhase.id}`}
                      className={clsx(
                        "bg-white rounded-lg border-2 transition-all duration-500 overflow-hidden scroll-mt-32",
                        isExpanded
                          ? "border-indigo-100 /50 mb-8"
                          : "border-slate-50 mb-4 hover:border-slate-200",
                      )}
                    >
                      {/* Phase Header*/}
                      <div
                        id={headerId}
                        className={clsx(
                          "p-4 sm:p-6 md:p-8 flex items-center justify-between cursor-pointer transition-colors scroll-mt-32",
                          isExpanded ? "bg-indigo-50/30" : "hover:bg-slate-50",
                        )}
                        onClick={() => togglePhase(qPhase.id)}
                      >
                        <div className="flex items-center gap-6">
                          <div
                            className={clsx(
                              "w-12 h-12 rounded-lg flex items-center justify-center transition-all duration-500 shadow-sm border",
                              isExpanded
                                ? "bg-indigo-600 border-indigo-500 text-white"
                                : "bg-white border-slate-100 text-slate-400",
                            )}
                          >
                            <span className="text-lg font-semibold">
                              {idx + 1}
                            </span>
                          </div>
                          <div className="text-left">
                            <h3 className="text-xl font-bold text-slate-900 ">
                              {qPhase.title}
                            </h3>
                            <p className="text-slate-400 text-xs font-mono font-medium uppercase tracking-wide mt-1">
                              Section {idx + 1} &bull; {qPhase.num}
                            </p>
                          </div>
                        </div>
                        <div
                          className={clsx(
                            "w-8 h-8 rounded-full flex items-center justify-center border transition-all duration-300",
                            isExpanded
                              ? "bg-indigo-50 border-indigo-200 text-indigo-600 rotate-180"
                              : "bg-slate-50 border-slate-200 text-slate-400 group-hover:bg-indigo-50 group-hover:border-indigo-100",
                          )}
                        >
                          <ChevronDown className="w-5 h-5" />
                        </div>
                      </div>

                      <div
                        id={contentId}
                        className={clsx(
                          "transition-all duration-500 ease-in-out",
                          isExpanded
                            ? "max-h-[5000px] opacity-100"
                            : "max-h-0 opacity-0 pointer-events-none",
                        )}
                      >
                        <div className="p-4 sm:p-6 pt-0 space-y-6">
                          <div className="border-t border-slate-100 mb-4"></div>
                          <p className="text-sm text-slate-600 leading-relaxed">
                            {qPhase.hint}
                          </p>

                          <div className="grid grid-cols-1 gap-6">
                            {qPhase.questions.map((q, qIndex) => {
                              const isActive = activeQuestionId === q.id;
                              const val = projectInfo[q.id];
                              const isAnswered = Array.isArray(val)
                                ? val.length > 0
                                : !!val;

                              return (
                                <div
                                  key={q.id}
                                  id={`q-container-${q.id}`}
                                  className={clsx(
                                    "group/q bg-slate-50/30 p-4 sm:p-8 rounded-lg sm:rounded-lg border transition-all duration-300",
                                    isActive
                                      ? "border-indigo-500 bg-indigo-50/50 shadow-lg scale-[1.01]"
                                      : "border-dashed border-slate-200",
                                    !isActive && !isAnswered
                                      ? "opacity-30 grayscale select-none pointer-events-none"
                                      : "opacity-100 grayscale-0",
                                  )}
                                >
                                  {/* Hidden anchor for phase-first logic*/}
                                  {qIndex === 0 && (
                                    <div
                                      id={`phase-first-q-${qPhase.id}`}
                                      className="absolute -top-32"
                                    />
                                  )}
                                  <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-8">
                                    <div className="max-w-2xl space-y-3">
                                      <div className="flex items-center gap-3">
                                        <div
                                          className={clsx(
                                            "w-8 h-8 rounded-lg shadow-sm flex items-center justify-center shrink-0 transition-colors",
                                            isAnswered
                                              ? "bg-emerald-500 text-white"
                                              : "bg-white text-indigo-600",
                                          )}
                                        >
                                          {isAnswered ? (
                                            <CheckCircle2 className="w-4 h-4" />
                                          ) : (
                                            <Info className="w-4 h-4" />
                                          )}
                                        </div>
                                        <h4 className="text-lg font-bold text-slate-900 leading-tight">
                                          {q.label}
                                        </h4>
                                      </div>
                                      {q.description && (
                                        <p className="text-slate-500 text-sm font-medium pl-11">
                                          {q.description}
                                        </p>
                                      )}
                                      {q.trigger &&
                                        (projectInfo[q.id] === "Yes" ||
                                          (Array.isArray(projectInfo[q.id]) &&
                                            projectInfo[q.id].length > 0)) && (
                                          <div className="mt-4 ml-11 p-4 bg-emerald-50 rounded-lg border border-emerald-100 flex items-start gap-3 animate-in fade-in slide-in-from-left-4">
                                            <ShieldCheck className="w-5 h-5 text-emerald-500 mt-0.5" />
                                            <p className="text-xs text-emerald-700 font-bold leading-relaxed">
                                              {q.trigger}
                                            </p>
                                          </div>
                                        )}
                                    </div>

                                    <div className="shrink-0 pt-2 pl-4 sm:pl-11 lg:pl-0">
                                      {q.type === "toggle" && (
                                        <div className="flex bg-white p-1.5 rounded-lg border border-slate-200 shadow-sm w-full sm:w-auto overflow-x-auto">
                                          {["Yes", "No"].map((opt) => (
                                            <button
                                              key={opt}
                                              onClick={() => set(q.id, opt)}
                                              className={clsx(
                                                "px-6 sm:px-8 py-2.5 sm:py-3 rounded-lg text-xs sm:text-xs font-medium transition-all duration-300 shrink-0",
                                                projectInfo[q.id] === opt
                                                  ? opt === "Yes"
                                                    ? "bg-slate-900 text-white shadow-lg shadow-slate-200"
                                                    : "bg-slate-400 text-white shadow-lg shadow-slate-200"
                                                  : "text-slate-400 hover:bg-slate-50",
                                              )}
                                            >
                                              {opt}
                                            </button>
                                          ))}
                                        </div>
                                      )}

                                      {q.type === "select" && (
                                        <div className="relative w-full lg:w-64">
                                          <select
                                            className="w-full h-14 px-6 bg-white border-2 border-slate-200 rounded-lg text-sm font-bold text-slate-800 focus:outline-none focus:ring-4 focus:ring-indigo-100 focus:border-indigo-600 transition-all appearance-none cursor-pointer shadow-sm"
                                            value={projectInfo[q.id] || ""}
                                            onChange={(e) =>
                                              set(q.id, e.target.value)
                                            }
                                          >
                                            <option value="">
                                              Select option...
                                            </option>
                                            {q.options?.map((opt) => (
                                              <option key={opt} value={opt}>
                                                {opt}
                                              </option>
                                            ))}
                                          </select>
                                          <div className="absolute top-1/2 right-4 -translate-y-1/2 pointer-events-none text-slate-400">
                                            <ChevronDown className="w-5 h-5" />
                                          </div>
                                        </div>
                                      )}

                                      {q.type === "multi" && (
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full lg:w-96">
                                          {q.options?.map((opt) => {
                                            const current = Array.isArray(
                                              projectInfo[q.id],
                                            )
                                              ? projectInfo[q.id]
                                              : [];
                                            const isSelected =
                                              current.includes(opt);
                                            return (
                                              <button
                                                key={opt}
                                                onClick={() => {
                                                  const next = isSelected
                                                    ? current.filter(
                                                        (i: string) =>
                                                          i !== opt,
                                                      )
                                                    : [...current, opt];
                                                  set(q.id, next);
                                                }}
                                                className={clsx(
                                                  "px-4 py-3 rounded-lg text-xs font-medium border transition-all text-left flex items-center gap-3",
                                                  isSelected
                                                    ? "bg-indigo-600 text-white border-indigo-600 "
                                                    : "bg-white text-slate-500 border-slate-200 hover:border-indigo-300",
                                                )}
                                              >
                                                <div
                                                  className={clsx(
                                                    "w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition-colors",
                                                    isSelected
                                                      ? "bg-white/20 border-white/40"
                                                      : "bg-slate-50 border-slate-200",
                                                  )}
                                                >
                                                  {isSelected && (
                                                    <Check className="w-3 h-3" />
                                                  )}
                                                </div>
                                                {opt}
                                              </button>
                                            );
                                          })}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

          {/* ─── Profile Selection ───*/}
          {phase === 1 && !isQuestionnaireActive && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 animate-in fade-in slide-in-from-bottom-8 duration-700">
              {/* Left Column: Context Selection*/}
              <div className="lg:col-span-4 space-y-6 sm:space-y-8">
                <div className="bg-white rounded-lg sm:rounded-lg border border-slate-100 p-6 sm:p-8 ">
                  <PhaseHeader num={1} title="Context Selection" />
                  <div className="space-y-6">
                    <div>
                      <label className={labelCls}>Assessment Target</label>
                      <div className="flex items-center gap-3 p-4 bg-indigo-50/50 rounded-lg border border-indigo-100/50">
                        <div className="w-10 h-10 bg-white rounded-lg shadow-sm flex items-center justify-center border border-indigo-100">
                          {activeType === "programme" ? (
                            <Layers className="w-5 h-5 text-indigo-600" />
                          ) : (
                            <FolderKanban className="w-5 h-5 text-indigo-600" />
                          )}
                        </div>
                        <div>
                          <p className="text-xs font-mono font-medium text-indigo-400 uppercase tracking-wide mb-0.5">
                            Context
                          </p>
                          <p className="text-sm font-bold text-indigo-900">
                            {activeType === "programme"
                              ? "Programme Compliance"
                              : "Project Compliance"}
                          </p>
                        </div>
                      </div>
                    </div>

                    {activeType === "programme" ? (
                      <Field label="Select Registered Programme">
                        <select
                          className={inputCls}
                          value={activeProgrammeId || ""}
                          onChange={(e) => {
                            const id = e.target.value;
                            setActiveProgramme(id);
                            if (id) handleProgrammeSelect(id);
                          }}
                        >
                          <option value="">Choose a programme...</option>
                          {programmes.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name}
                            </option>
                          ))}
                        </select>
                      </Field>
                    ) : (
                      <Field label="Select Registered Project">
                        <select
                          className={inputCls}
                          value={activeProjectId || ""}
                          onChange={(e) => {
                            const id = e.target.value;
                            setActiveProject(id);
                            if (id) handleProjectSelect(id);
                          }}
                        >
                          <option value="">Choose a project...</option>
                          {projects.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name}
                            </option>
                          ))}
                        </select>
                      </Field>
                    )}

                    <div className="pt-4 border-t border-slate-50">
                      <button
                        onClick={loadDemo}
                        className="w-full py-4 text-xs font-mono font-medium text-slate-400 hover:text-indigo-600 uppercase tracking-wide transition-colors flex items-center justify-center gap-2"
                      >
                        <ScanSearch className="w-4 h-4" /> Load Demo Strategy
                        Template
                      </button>
                    </div>
                  </div>
                </div>

                {/* Tips / Info Card*/}
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-5">
                  <h4 className="text-base font-semibold text-slate-900 mb-2">AI context hint</h4>
                  <p className="text-sm text-slate-600 leading-relaxed mb-3">
                    The more information you provide in Phase 2, the more accurate the AI determination of applicable building regulations will be.
                  </p>
                  <div className="flex items-center gap-2 text-xs font-medium text-emerald-700">
                    <CheckCircle2 className="w-4 h-4" /> Real-time compliance scoring
                  </div>
                </div>
              </div>

              {/* Right Column: Profile Details*/}
              <div className="lg:col-span-8">
                <div className="bg-white rounded-lg sm:rounded-lg border border-slate-100 p-6 md:p-12 ">
                  <PhaseHeader
                    num={2}
                    title={`${activeType.charAt(0).toUpperCase() + activeType.slice(1)} Delivery Profile`}
                  />

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
                    <Field label="Reference Name" required>
                      <input
                        className={inputCls}
                        value={projectInfo.name || ""}
                        onChange={(e) => set("name", e.target.value)}
                        placeholder="e.g. Northeast Regeneration Phase II"
                      />
                    </Field>
                    <Field label="Assessment Type" required>
                      <select
                        className={inputCls}
                        value={projectInfo.type || ""}
                        onChange={(e) => set("type", e.target.value)}
                      >
                        <option value="">Select type...</option>
                        <option value="New Build Development">
                          New Build Development
                        </option>
                        <option value="Retrofit & Decarbonisation">
                          Retrofit & Decarbonisation
                        </option>
                        <option value="Estate Regeneration">
                          Estate Regeneration
                        </option>
                        <option value="Asset Management & Compliance">
                          Asset Management & Compliance
                        </option>
                        <option value="Mixed Use Scheme">
                          Mixed Use Scheme
                        </option>
                      </select>
                    </Field>
                    <Field label="Location / Region" required>
                      <input
                        className={inputCls}
                        value={projectInfo.loc || ""}
                        onChange={(e) => set("loc", e.target.value)}
                        placeholder="e.g. Manchester, UK"
                      />
                    </Field>
                    <Field
                      label="Strategic Objectives / Scope"
                      required
                      hint="Briefly describe the scale, purpose, and key deliverables."
                    >
                      <textarea
                        className={clsx(textareaBase, "min-h-32")}
                        value={projectInfo.scope || ""}
                        onChange={(e) => set("scope", e.target.value)}
                        placeholder="e.g. Delivery of 250 zero-carbon homes, including 2 High Rise Buildings and extensive landscaping..."
                      />
                    </Field>
                  </div>

                  <div className="space-y-8">
                    <div>
                      <label className={labelCls}>
                        Technical Characteristics
                      </label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                        {[
                          { id: "hrb", label: "Higher-Risk (HRB)" },
                          { id: "brownfield", label: "Brownfield Site" },
                          { id: "s106", label: "S106 Obligations" },
                          { id: "demolition", label: "Major Demolition" },
                          { id: "bim", label: "BIM / Digital Thread" },
                          { id: "pcr", label: "PCR 2015 Procurement" },
                          { id: "shdf", label: "SHDF Funding" },
                          { id: "leasehold", label: "Leasehold Units" },
                        ].map((c) => (
                          <CheckPill
                            key={c.id}
                            val={c.id}
                            label={c.label}
                            checked={isChar(c.id)}
                            onChange={() => toggleChar(c.id)}
                          />
                        ))}
                      </div>
                    </div>

                    <div className="pt-10 flex flex-col md:flex-row items-center justify-between gap-6 border-t border-slate-100">
                      <div className="flex items-center gap-4 text-slate-400">
                        <Lock className="w-5 h-5" />
                        <p className="text-xs font-mono font-medium uppercase tracking-wide leading-relaxed max-w-xs">
                          Profile details are used to filter the regulatory
                          questionnaire.
                        </p>
                      </div>

                      <div className="flex flex-col items-end gap-2 w-full md:w-auto">
                        {(!projectInfo.name || !projectInfo.type || !projectInfo.loc || !projectInfo.scope) && (
                          <p className="text-xs text-amber-600 font-bold flex items-center gap-1.5">
                            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                            Required: {[!projectInfo.name && 'Name', !projectInfo.type && 'Type', !projectInfo.loc && 'Location', !projectInfo.scope && 'Scope'].filter(Boolean).join(', ')}
                          </p>
                        )}
                        <button
                          onClick={() => {
                            setPhase(2);
                            setPathChoice("detailed");
                            setIsQuestionnaireActive(true);
                          }}
                          className={clsx(
                            "w-full px-10 py-5 bg-indigo-600 text-white rounded-lg font-medium text-sm transition-all hover:bg-indigo-700  flex items-center justify-center gap-3",
                            (!projectInfo.name ||
                              !projectInfo.type ||
                              !projectInfo.loc ||
                              !projectInfo.scope) &&
                              "opacity-50 grayscale pointer-events-none",
                          )}
                        >
                          Conduct Detailed Assessment{" "}
                          <ArrowRight className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ─── AI Action Footer ───*/}
          {isQuestionnaireActive && phase !== 3 && (
            <div className="fixed bottom-12 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-12 duration-1000">
              <div className="bg-slate-900/90 text-white px-8 py-5 rounded-lg shadow-[0_20px_50px_rgba(0,0,0,0.3)] border border-white/10 flex items-center justify-between gap-8 ">
                <div className="hidden sm:flex items-center gap-4 border-r border-white/10 pr-8">
                  <div className="w-10 h-10 bg-indigo-500 rounded-lg flex items-center justify-center">
                    <ScanSearch className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className="text-xs font-mono font-medium text-white/50 uppercase tracking-wide">
                      Questionnaire Progress
                    </p>
                    <p className="text-sm font-bold">
                      Strategy Hydration Active
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <button
                    onClick={() => setIsQuestionnaireActive(false)}
                    className="px-6 py-3 bg-white/5 hover:bg-white/10 text-white/70 hover:text-white rounded-lg font-bold text-xs transition-all"
                  >
                    Edit Profile
                  </button>
                  <button
                    onClick={runAnalysis}
                    disabled={loading}
                    className="flex items-center gap-3 px-8 py-3.5 bg-indigo-500 text-white rounded-lg font-medium text-sm transition-all hover:bg-indigo-400 hover:shadow-[0_0_30px_rgba(99,102,241,0.4)]  disabled:opacity-50"
                  >
                    {!!loadingStep ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />{" "}
                        Analyzing...
                      </>
                    ) : (
                      <>
                        <ShieldCheck className="w-4 h-4" /> Run AI Assessment
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      {/* AI Inquiry Popup*/}
      <AIInquiryPopup
        isOpen={isAIInquiryOpen}
        onClose={() => {
          userInitiatedOpen.current = false;
          setIsAIInquiryOpen(false);
        }}
        context="Compliance Setup Questionnaire"
      />

      {/* Floating AI Trigger*/}
      <button
        onClick={() => {
          userInitiatedOpen.current = true;
          setIsAIInquiryOpen(true);
        }}
        className="fixed bottom-8 right-8 z-[150] bg-indigo-600 text-white p-3 rounded-full hover:bg-indigo-700 transition-colors shadow-lg"
        title="Consult CedarGuard AI"
      >
        <ScanSearch className="w-5 h-5" />
      </button>
    </>
  );
}
