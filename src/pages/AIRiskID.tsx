import { useState, useEffect } from "react";
import { useStore } from "../store/useStore";
import { analyzeRisks, analyzeStrategicRisks } from "../services/aiService";
import { Link, useSearchParams, useNavigate } from "react-router";
import {
  ScanSearch,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  ChevronDown,
  ChevronUp,
  ShieldAlert,
  Clock,
  Info,
  Eye,
  RefreshCw,
  ArrowLeft,
  Target,
  AlertCircle,
  Plus,
  Check,
  X,
  Edit3,
  Loader2,
} from "lucide-react";
import { clsx } from "clsx";
import { RiskModal } from "../components/RiskModal";
import { stripMarkdown } from "../lib/utils";
import { calculateMatrixScore } from "../data/riskScoringMatrix";
import { api, ApiError } from "../lib/api";
import { AIErrorAlert } from "../components/AIErrorAlert";

export function AIRiskID() {
  const {
    projectInfo = {},
    risks,
    addRisks,
    projects,
    programmes,
    activeProjectId,
    activeProgrammeId,
    setActiveProject,
    setActiveProgramme,
    setActiveProgrammeId,
    suggestedRisks,
    setSuggestedRisks,
    updateProject,
    updateProgramme,
    strategicRiskAnalysis,
    setStrategicRiskAnalysis,
  } = useStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | ApiError | null>(null);
  const [isAcceptingAll, setIsAcceptingAll] = useState(false);
  const [isFinalizing, setIsFinalizing] = useState(false);

  const [acceptedIds, setAcceptedIds] = useState<string[]>([]);
  const [rejectedIds, setRejectedIds] = useState<string[]>([]);
  const [expandedIds, setExpandedIds] = useState<string[]>([]);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const fromInitiation = searchParams.get("from") === "initiation";
  const activeDetails =
    (activeProjectId
      ? projects.find((p) => p.id === activeProjectId)
      : programmes.find((p) => p.id === activeProgrammeId)) || ({} as any);

  const [showAnalysisExists, setShowAnalysisExists] = useState(false);
  const [showRestartConfirm, setShowRestartConfirm] = useState(false);
  const [isRestarting, setIsRestarting] = useState(false);
  const [showEmptyConfirm, setShowEmptyConfirm] = useState(false);

  // Re-evaluate whenever the active project/programme changes
  useEffect(() => {
    const pId = searchParams.get("projectId");
    const prId = searchParams.get("programmeId");

    // Sync store if URL has parameters but store doesn't match
    if (pId && activeProjectId !== pId) {
      setActiveProject(pId);
    } else if (prId && activeProgrammeId !== prId) {
      setActiveProgrammeId(prId);
    }

    const contextId = activeProjectId || activeProgrammeId || pId || prId;
    const restart = searchParams.get("restart") === "true";

    if (!contextId) {
      setShowAnalysisExists(false);
      return;
    }
    const currentEntity = (
      activeProjectId || pId
        ? projects.find((p) => p.id === (activeProjectId || pId))
        : programmes.find((p) => p.id === (activeProgrammeId || prId))
    ) as any;

    // If restart is true, we bypass the "already exists" overlay
    if (restart) {
      setShowAnalysisExists(false);
    } else {
      setShowAnalysisExists(!!currentEntity?.aiRiskDiscoveryDone);
    }
  }, [activeProjectId, activeProgrammeId, projects, programmes, searchParams]);

  const runAnalysis = async () => {
    const activeDetails =
      (activeProjectId
        ? projects.find((p) => p.id === activeProjectId)
        : programmes.find((p) => p.id === activeProgrammeId)) || ({} as any);

    const pi = {
      ...projectInfo,
      name: projectInfo.name || activeDetails?.name,
      type: projectInfo.type || activeDetails?.type,
      loc:
        projectInfo.loc ||
        activeDetails?.location ||
        activeDetails?.geographicScope ||
        activeDetails?.loc,
      scope:
        projectInfo.scope ||
        activeDetails?.description ||
        activeDetails?.strategicObjectives ||
        activeDetails?.scope,
    };

    if (!pi.name || !pi.type || !pi.scope) {
      const missing = [];
      if (!pi.name) missing.push("Name");
      if (!pi.type) missing.push("Type");
      if (!pi.scope) missing.push("Scope / Objectives");
      setError(
        `Validation failed: Please complete the following Setup fields first: ${missing.join(", ")}.`,
      );
      return;
    }

    const restart = searchParams.get("restart") === "true";

    if (
      activeDetails.aiRiskDiscoveryDone &&
      !showAnalysisExists &&
      safeSuggestedRisks.length === 0 &&
      !restart
    ) {
      setShowAnalysisExists(true);
      return;
    }

    setError("");
    setLoading(true);
    setAcceptedIds([]);
    setRejectedIds([]);

    try {
      let suggestions;
      let strategicResult = null;

      if (!activeProjectId && activeProgrammeId) {
        // Strategic Programme Risk Discovery
        strategicResult = await analyzeStrategicRisks(pi);
        const strategicProfile = Array.isArray(strategicResult?.riskProfile)
          ? strategicResult.riskProfile
          : [];
        suggestions = strategicProfile.map((s: any) => ({
          title: s.title,
          desc: s.impact,
          cause: s.trigger,
          // NEW: Use ID-based fields from AI
          categoryId: s.categoryId,
          workstreamId: s.workstreamId || "ws-prog-strat",
          // Keep legacy fields for backward compatibility
          category: s.domain,
          workstream: "Programme Strategic",
          kri: s.kri,
          grossL: s.severity === "High" ? 4 : s.severity === "Medium" ? 3 : 2,
          grossI: s.severity === "High" ? 5 : s.severity === "Medium" ? 4 : 3,
          residualL:
            s.severity === "High" ? 3 : s.severity === "Medium" ? 2 : 1,
          residualI:
            s.severity === "High" ? 4 : s.severity === "Medium" ? 3 : 2,
          response: "Tolerate",
          owner: "Programme Board",
          controls: s.mitigation,
          furtherAction: "Review in Board Meetings",
          grossImpact:
            s.severity === "High"
              ? 500000
              : s.severity === "Medium"
                ? 250000
                : 100000,
          grossProb:
            s.severity === "High" ? 0.8 : s.severity === "Medium" ? 0.6 : 0.4,
          residualImpact:
            s.severity === "High"
              ? 250000
              : s.severity === "Medium"
                ? 100000
                : 50000,
          residualProb:
            s.severity === "High" ? 0.4 : s.severity === "Medium" ? 0.3 : 0.2,
          rationale: s.trigger,
        }));
        setStrategicRiskAnalysis(strategicResult);
      } else {
        suggestions = await analyzeRisks(pi, risks);
        setStrategicRiskAnalysis(null);
      }

      const suggestionsArray = Array.isArray(suggestions) ? suggestions : [];

      const currentProject = projects.find((p) => p.id === activeProjectId);
      const currentProgramme = programmes.find(
        (p) => p.id === activeProgrammeId,
      );

      setSuggestedRisks(
        suggestionsArray.map((s: any, i: number) => {
          const getNum = (v: any) => {
            if (typeof v === "number") return v;
            if (typeof v === "string")
              return parseFloat(v.replace(/[^0-9.]/g, "")) || 0;
            return 0;
          };

          const gL = getNum(s.grossL);
          const gI = getNum(s.grossI);
          const rL = getNum(s.residualL);
          const rI = getNum(s.residualI);
          const gImp = getNum(s.grossImpact);
          const gProb = getNum(s.grossProb);
          const rImp = getNum(s.residualImpact);
          const rProb = getNum(s.residualProb);

          const gProbVal = gProb > 1 ? gProb / 100 : gProb;
          const rProbVal = rProb > 1 ? rProb / 100 : rProb;

          const exists = risks.some(
            (r) =>
              r.title.toLowerCase() === s.title.toLowerCase() &&
              (activeProjectId
                ? r.projectId === activeProjectId
                : r.programmeId === activeProgrammeId),
          );

          return {
            ...s,
            id: `R-${Math.random().toString(36).substr(2, 9).toUpperCase()}`,
            title: stripMarkdown(s.title || ""),
            desc: stripMarkdown(s.desc || ""),
            category: stripMarkdown(s.category || "Risk"),
            workstream: stripMarkdown(s.workstream || "Contractor"),
            cause: stripMarkdown(s.cause || ""),
            controls: stripMarkdown(s.controls || ""),
            furtherAction: stripMarkdown(s.furtherAction || ""),
            rationale: stripMarkdown(s.rationale || ""),
            response: stripMarkdown(s.response || "Reduce"),
            owner: stripMarkdown(s.owner || "Project Manager"),
            grossL: gL,
            grossI: gI,
            residualL: rL,
            residualI: rI,
            // Calibrated 5×5 matrix.
            grossRating: calculateMatrixScore(gL, gI),
            residualRating: calculateMatrixScore(rL, rI),
            grossImpact: gImp,
            grossProb: gProb,
            residualImpact: rImp,
            residualProb: rProb,
            grossALE: gImp * gProbVal,
            residualALE: rImp * rProbVal,
            project:
              currentProject?.name ||
              projectInfo.name ||
              (activeProgrammeId ? "Shared Portfolio" : "Project Level"),
            projectId: activeProjectId || "",
            programme: currentProgramme?.name || "",
            programmeId: activeProgrammeId || currentProject?.programmeId || "",
            isProgrammeLevel: !activeProjectId && !!activeProgrammeId,
            dateAdded: new Date().toISOString().slice(0, 10),
            escalated: false,
            status: "Open",
            exists: exists,
          };
        }),
      );

      if (suggestionsArray.length === 0) {
        setError("AI did not identify any new risks at this time.");
      }
    } catch (err: any) {
      setError(
        err.message || "Failed to generate AI insights. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  const safeSuggestedRisks = Array.isArray(suggestedRisks)
    ? suggestedRisks
    : [];
  const pendingRisks = safeSuggestedRisks.filter(
    (r) => !acceptedIds.includes(r.id) && !rejectedIds.includes(r.id),
  );
  const acceptedRisks = safeSuggestedRisks.filter((r) =>
    acceptedIds.includes(r.id),
  );
  const activeName =
    (activeProjectId
      ? projects.find((p) => p.id === activeProjectId)?.name
      : programmes.find((p) => p.id === activeProgrammeId)?.name) ||
    "Portfolio";

  const finalize = async (skipEmptyCheck = false) => {
    try {
      setIsFinalizing(true);
      let finalAccepted = acceptedRisks;

      // Auto-accept all new risks if nothing was selected/rejected
      if (
        acceptedIds.length === 0 &&
        rejectedIds.length === 0 &&
        safeSuggestedRisks.length > 0
      ) {
        finalAccepted = safeSuggestedRisks.filter((r) => !r.exists);
      } else if (
        !skipEmptyCheck &&
        finalAccepted.length === 0 &&
        safeSuggestedRisks.filter((r) => !r.exists).length > 0
      ) {
        setIsFinalizing(false);
        setShowEmptyConfirm(true);
        return;
      }

      // Add risks to store and wait for persistence
      await addRisks(finalAccepted);

      // Get context IDs from store or URL for persistence
      const pId = activeProjectId || searchParams.get("projectId");
      const prId = activeProgrammeId || searchParams.get("programmeId");

      // Explicit backup save with context ID (in case store context was stale)
      const allCurrentRisks = useStore.getState().risks;
      await api.saveData("risks", allCurrentRisks, pId || prId);

      // Persist strategic analysis if available
      if (strategicRiskAnalysis) {
        await api.saveData(
          "strategicRiskAnalysis",
          strategicRiskAnalysis,
          pId || prId,
        );
      }

      // Update store with progress and wait for persistence
      if (pId) {
        await updateProject(pId, {
          riskSetupDone: true,
          aiRiskDiscoveryDone: true,
          setupProgress: 75,
        });
      } else if (prId) {
        await updateProgramme(prId, {
          riskSetupDone: true,
          aiRiskDiscoveryDone: true,
          setupProgress: 75,
        });
      }

      // Navigate first, then clear state (avoids "empty screen" flash if navigate is slow)
      const targetUrl = `/risk/dashboard?from=initiation${pId ? `&projectId=${pId}` : prId ? `&programmeId=${prId}` : ""}`;
      navigate(targetUrl);

      // Clear temporary suggested risks state
      setTimeout(() => {
        setSuggestedRisks([]);
        setAcceptedIds([]);
        setRejectedIds([]);
        setExpandedIds([]);
        setIsFinalizing(false);
      }, 500);
    } catch (err: any) {
      console.error("Finalize error:", err);
      setError(
        `An error occurred while saving: ${err.message || "Unknown error"}. Please try again.`,
      );
      setIsFinalizing(false);
    }
  };

  const handleRestartConfirmed = async () => {
    setShowRestartConfirm(false);
    const contextId = activeProjectId || activeProgrammeId;
    if (!contextId) return;
    setIsRestarting(true);
    setShowAnalysisExists(false);
    try {
      const clearOps: Promise<any>[] = [];

      // 1. Only reset the AI discovery flag — keep riskSetupDone (questionnaire answers stay)
      if (activeProjectId) {
        clearOps.push(updateProject(activeProjectId, { aiRiskDiscoveryDone: false }));
      } else if (activeProgrammeId) {
        clearOps.push(updateProgramme(activeProgrammeId, { aiRiskDiscoveryDone: false }));
      }

      // 2. Clear only the risk register entries for this context from DB
      clearOps.push(api.saveData('risks', [], contextId));

      await Promise.all(clearOps);

      // 3. Wipe risks for this context + all suggestion state from store
      const currentRisks = useStore.getState().risks;
      useStore.setState({
        suggestedRisks: [],
        risks: currentRisks.filter((r: any) =>
          activeProjectId
            ? r.projectId !== activeProjectId
            : r.programmeId !== activeProgrammeId
        ),
      });

      setAcceptedIds([]);
      setRejectedIds([]);
      setExpandedIds([]);
      setError(null);
    } catch (err: any) {
      setError(err.message || "Failed to reset risk analysis.");
    } finally {
      setIsRestarting(false);
      runAnalysis();
    }
  };

  const getRatingColor = (score: number) => {
    if (score >= 20) return "text-rose-600 bg-rose-50 border-rose-200";
    if (score >= 12) return "text-orange-600 bg-orange-50 border-orange-200";
    if (score >= 6) return "text-amber-600 bg-amber-50 border-amber-200";
    return "text-emerald-600 bg-emerald-50 border-emerald-200";
  };

  const getRatingLabel = (score: number) => {
    if (score >= 20) return "Severe";
    if (score >= 12) return "High";
    if (score >= 6) return "Medium";
    return "Low";
  };

  const getProbLabel = (l: number) => {
    if (l >= 5) return "Almost Certain";
    if (l >= 4) return "Likely";
    if (l >= 3) return "Possible";
    if (l >= 2) return "Unlikely";
    return "Rare";
  };

  const getImpactLabel = (i: number) => {
    if (i >= 5) return "Severe";
    if (i >= 4) return "Major";
    if (i >= 3) return "Moderate";
    if (i >= 2) return "Minor";
    return "Insignificant";
  };

  const [editingRisk, setEditingRisk] = useState<any | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <div className="max-w-[98%] lg:max-w-6xl mx-auto p-2 sm:p-4 lg:p-6 space-y-4 sm:space-y-6 pb-40">
      {/* Restart Confirmation Dialog*/}
      {showRestartConfirm && (
        <div className="fixed inset-0 z-120 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-8 border border-slate-100 animate-in zoom-in-95 duration-200">
            <div className="flex items-start gap-4 mb-6">
              <div className="w-12 h-12 bg-rose-100 rounded-2xl flex items-center justify-center shrink-0">
                <AlertTriangle className="w-6 h-6 text-rose-600" />
              </div>
              <div>
                <h3 className="text-lg font-black text-slate-900 mb-1">Restart Risk Analysis?</h3>
                <p className="text-sm text-slate-500 leading-relaxed">
                  This will clear the existing AI risk analysis results and re-run the discovery. Accepted risks already saved to your register will not be affected.
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowRestartConfirm(false)}
                className="flex-1 px-4 py-3 bg-slate-100 text-slate-700 rounded-xl font-bold text-sm hover:bg-slate-200 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleRestartConfirmed}
                className="flex-1 px-4 py-3 bg-rose-600 text-white rounded-xl font-bold text-sm hover:bg-rose-700 transition-all"
              >
                Yes, Restart
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Restarting Loading Overlay*/}
      {isRestarting && (
        <div className="fixed inset-0 z-110 flex flex-col items-center justify-center bg-white/90 backdrop-blur-sm">
          <Loader2 className="w-10 h-10 text-indigo-600 animate-spin mb-4" />
          <p className="text-slate-700 font-bold text-sm uppercase tracking-widest">Clearing Analysis Data...</p>
        </div>
      )}

      {/* Empty Accept Confirmation Dialog*/}
      {showEmptyConfirm && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-8 border border-slate-100 animate-in zoom-in-95 duration-200">
            <div className="flex items-start gap-4 mb-6">
              <div className="w-12 h-12 bg-amber-100 rounded-2xl flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-6 h-6 text-amber-600" />
              </div>
              <div>
                <h3 className="text-lg font-black text-slate-900 mb-1">No Risks Accepted</h3>
                <p className="text-sm text-slate-500 leading-relaxed">
                  You haven't accepted any risks. Proceed with an empty risk register?
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowEmptyConfirm(false)}
                className="flex-1 px-4 py-3 bg-slate-100 text-slate-700 rounded-xl font-bold text-sm hover:bg-slate-200 transition-all"
              >
                Go Back
              </button>
              <button
                onClick={() => {
                  setShowEmptyConfirm(false);
                  finalize(true);
                }}
                className="flex-1 px-4 py-3 bg-amber-600 text-white rounded-xl font-bold text-sm hover:bg-amber-700 transition-all"
              >
                Proceed Anyway
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Existing Analysis Overlay */}
      {showAnalysisExists && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-100 animate-in zoom-in-95 slide-in-from-bottom-8 duration-500">
            <div className="bg-slate-900 p-8 text-white relative">
              <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full -mr-16 -mt-16 blur-3xl" />
              <ShieldAlert className="w-12 h-12 text-emerald-400 mb-4" />
              <h3 className="text-xl font-black tracking-tight leading-tight mb-2">
                Risk Analysis Already Complete
              </h3>
              <p className="text-slate-400 text-sm leading-relaxed">
                A risk profile has already been established for this entity.
                Running a new analysis will identify potential threats based on
                current project data.
              </p>
            </div>
            <div className="p-8 space-y-4">
              <div className="flex flex-col gap-3">
                <button
                  onClick={() =>
                    navigate(
                      `/risk/dashboard?from=initiation&type=${activeProjectId ? "project" : "programme"}${activeProjectId ? `&projectId=${activeProjectId}` : `&programmeId=${activeProgrammeId}`}`,
                    )
                  }
                  className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-emerald-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-emerald-700 transition-all shadow-xl shadow-emerald-100 active:scale-[0.98]"
                >
                  <Eye className="w-4 h-4" /> View Risk Dashboard
                </button>
                <div className="flex items-center gap-3 py-2">
                  <div className="h-px bg-slate-100 flex-1" />
                  <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">
                    OR
                  </span>
                  <div className="h-px bg-slate-100 flex-1" />
                </div>
                <button
                  onClick={() => setShowRestartConfirm(true)}
                  className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-white text-rose-600 border-2 border-rose-50 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-rose-50 hover:border-rose-100 transition-all active:scale-[0.98]"
                >
                  <RefreshCw className="w-4 h-4" /> Restart Analysis
                </button>
              </div>

              {fromInitiation ? (
                <button
                  onClick={async () => {
                    const contextId = activeProjectId || activeProgrammeId;
                    if (contextId) {
                      if (activeProjectId)
                        await updateProject(contextId, {
                          riskSetupDone: true,
                          aiRiskDiscoveryDone: true,
                        });
                      else
                        await updateProgramme(contextId, {
                          riskSetupDone: true,
                          aiRiskDiscoveryDone: true,
                        });
                    }
                    navigate(activeProjectId ? "/initiate" : "/programmes/new");
                  }}
                  className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-emerald-50 text-emerald-700 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-emerald-100 transition-all border border-emerald-100 mt-4"
                >
                  <CheckCircle2 className="w-4 h-4" /> Continue to Initiation
                  Step 4
                </button>
              ) : (
                <button
                  onClick={() => setShowAnalysisExists(false)}
                  className="w-full text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] hover:text-slate-600 transition-colors mt-4"
                >
                  Cancel & Return
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {fromInitiation && (
        <div className="flex justify-start mb-6 -mt-2">
          <Link
            to={activeProjectId ? "/initiate" : "/programmes/new"}
            className="flex items-center gap-2 px-6 py-3 bg-slate-900 text-white rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] shadow-xl shadow-slate-200 hover:bg-emerald-600 transition-all active:scale-95 animate-in fade-in slide-in-from-right-4 duration-700"
          >
            <ArrowLeft className="w-4 h-4 mr-1" /> Back to Initiation Flow
          </Link>
        </div>
      )}

      {/* ─── NEW HIGH-FIDELITY HEADER (Match 11.png) ─── */}
      <div className="relative overflow-hidden bg-gradient-to-r from-emerald-900 to-emerald-800 rounded-2xl shadow-xl border border-emerald-700/50">
        <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 blur-[100px] pointer-events-none" />
        <div className="p-4 sm:px-8 sm:py-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
          <div className="flex items-start sm:items-center gap-4 sm:gap-5">
            <div className="w-10 h-10 sm:w-14 sm:h-14 shrink-0 bg-emerald-500/20 rounded-xl sm:rounded-2xl flex items-center justify-center border border-emerald-400/30 shadow-inner">
              <CheckCircle2 className="w-6 h-6 sm:w-8 sm:h-8 text-emerald-400" />
            </div>
            <div>
              <h1 className="text-lg sm:text-xl font-black text-white tracking-tight">
                {activeProjectId
                  ? "Project Risk Analysis complete"
                  : "AI analysis complete"}{" "}
                — {activeName}
              </h1>
              <div className="flex flex-wrap items-center gap-2 sm:gap-3 mt-1.5">
                <span className="text-[10px] sm:text-xs font-bold text-emerald-400 uppercase tracking-widest">
                  {safeSuggestedRisks.length} risks identified
                </span>
                <span className="hidden sm:block w-1 h-1 bg-emerald-700 rounded-full" />
                <div className="flex flex-wrap items-center gap-2 text-[10px] text-emerald-500/80 font-bold uppercase tracking-wider">
                  {projectInfo.type && <span>{projectInfo.type}</span>}
                  {projectInfo.riba && (
                    <span>• RIBA Stage {projectInfo.riba}</span>
                  )}
                  {projectInfo.value && <span>• {projectInfo.value}</span>}
                </div>
              </div>
            </div>
          </div>
          <button
            onClick={runAnalysis}
            className="w-full sm:w-auto justify-center px-4 sm:px-5 py-2.5 bg-white/5 hover:bg-white/10 text-white/70 hover:text-white text-xs font-bold rounded-xl border border-white/10 transition-all flex items-center gap-2"
          >
            <ScanSearch className="w-3.5 h-3.5" /> Run again
          </button>
        </div>
      </div>

      {/* ─── STATS & PRIMARY ACTIONS ─── */}
      {safeSuggestedRisks.length > 0 && (
        <div className="space-y-4">
          {/* Strategic Analysis Summary Cards */}
          {strategicRiskAnalysis && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in slide-in-from-top-4 duration-700">
              {/* Overall Summary Card */}
              <div className="bg-white rounded-[32px] border border-slate-200 p-8 shadow-xl shadow-slate-200/50 relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full -mr-16 -mt-16 blur-2xl group-hover:bg-indigo-500/10 transition-all" />
                <div className="flex items-start justify-between mb-6">
                  <div>
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
                      Strategic Summary
                    </h4>
                    <h3 className="text-xl font-black text-slate-900 tracking-tight">
                      Programme Risk Profile
                    </h3>
                  </div>
                  <div
                    className={clsx(
                      "px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border shadow-sm",
                      strategicRiskAnalysis?.summary?.overallRating
                        ?.toLowerCase()
                        .includes("high")
                        ? "bg-rose-50 text-rose-600 border-rose-100"
                        : strategicRiskAnalysis?.summary?.overallRating
                              ?.toLowerCase()
                              .includes("medium")
                          ? "bg-orange-50 text-orange-600 border-orange-100"
                          : "bg-emerald-50 text-emerald-600 border-emerald-100",
                    )}
                  >
                    Rating: {strategicRiskAnalysis?.summary?.overallRating}
                  </div>
                </div>
                <p className="text-sm text-slate-600 leading-relaxed mb-6 italic">
                  "{strategicRiskAnalysis?.summary?.executiveOverview}"
                </p>
                <div>
                  <h5 className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                    <Target className="w-3 h-3 text-indigo-500" /> Critical
                    Success Factors
                  </h5>
                  <p className="text-xs text-slate-500 font-medium leading-relaxed bg-slate-50 p-4 rounded-2xl border border-slate-100">
                    {strategicRiskAnalysis?.summary?.criticalSuccessFactors}
                  </p>
                </div>
              </div>

              {/* Heat Overview / Concentration Card */}
              <div className="bg-white rounded-[32px] border border-slate-200 p-8 shadow-xl shadow-slate-200/50 relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full -mr-16 -mt-16 blur-2xl group-hover:bg-emerald-500/10 transition-all" />
                <div className="flex items-start justify-between mb-6">
                  <div>
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
                      Heat Overview
                    </h4>
                    <h3 className="text-xl font-black text-slate-900 tracking-tight">
                      Risk Concentration
                    </h3>
                  </div>
                  <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center border border-emerald-100">
                    <AlertTriangle className="w-5 h-5 text-emerald-600" />
                  </div>
                </div>
                <p className="text-sm text-slate-600 leading-relaxed mb-6">
                  {strategicRiskAnalysis?.heatOverview?.riskConcentration}
                </p>

                <div className="space-y-3">
                  <h5 className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2 tracking-widest">
                    Domain Heat Exposure
                  </h5>
                  <div className="grid grid-cols-2 gap-2">
                    {Array.isArray(
                      strategicRiskAnalysis?.heatOverview?.domainHeatMap,
                    ) &&
                      strategicRiskAnalysis.heatOverview.domainHeatMap.map(
                        (item: any, i: number) => (
                          <div
                            key={i}
                            className="flex flex-col gap-1.5 p-3 bg-slate-50 rounded-xl border border-slate-100 hover:border-indigo-200 transition-all group/item"
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-bold text-slate-500 truncate">
                                {item.domain}
                              </span>
                              <span
                                className={clsx(
                                  "text-[10px] font-black",
                                  item.score >= 80
                                    ? "text-rose-600"
                                    : item.score >= 50
                                      ? "text-orange-600"
                                      : "text-emerald-600",
                                )}
                              >
                                {item.score}%
                              </span>
                            </div>
                            <div className="h-1.5 w-full bg-slate-200 rounded-full overflow-hidden shadow-inner">
                              <div
                                className={clsx(
                                  "h-full transition-all duration-1000",
                                  item.score >= 80
                                    ? "bg-rose-500"
                                    : item.score >= 50
                                      ? "bg-orange-500"
                                      : "bg-emerald-500",
                                )}
                                style={{ width: `${item.score}%` }}
                              />
                            </div>
                          </div>
                        ),
                      )}
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-6 shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-6 sm:gap-8 justify-center w-full sm:w-auto">
              <div className="flex flex-col items-center sm:items-start shrink-0">
                <span className="text-xl sm:text-2xl font-black text-slate-900">
                  {safeSuggestedRisks.length}
                </span>
                <span className="text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  suggested
                </span>
              </div>
              <div className="hidden sm:block w-px h-10 bg-slate-100" />
              <div className="flex flex-col items-center sm:items-start shrink-0 text-indigo-600">
                <span className="text-xl sm:text-2xl font-black">
                  {safeSuggestedRisks.filter((r) => !r.exists).length}
                </span>
                <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest">
                  New Identifications
                </span>
              </div>
              <div className="flex flex-col items-center sm:items-start shrink-0 text-slate-400">
                <span className="text-xl sm:text-2xl font-black">
                  {safeSuggestedRisks.filter((r) => r.exists).length}
                </span>
                <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest">
                  Already Registered
                </span>
              </div>
              <div className="hidden sm:block w-px h-10 bg-slate-100" />
              <div className="flex flex-col items-center sm:items-start shrink-0">
                <span className="text-xl sm:text-2xl font-black text-emerald-600">
                  {acceptedIds.length}
                </span>
                <span className="text-[9px] sm:text-[10px] font-black text-emerald-500 uppercase tracking-widest">
                  accepted
                </span>
              </div>
            </div>
          </div>

          {safeSuggestedRisks.some((r) => r.exists) && (
            <div className="flex items-center gap-2 px-4 py-2 bg-amber-50 border border-amber-100 rounded-xl text-amber-700 text-xs font-medium">
              <AlertTriangle className="w-4 h-4" />
              <span>
                Some suggested risks are already in your register for this{" "}
                {activeProjectId ? "project" : "programme"}. They are marked and
                filtered from "Accept All".
              </span>
            </div>
          )}
        </div>
      )}

      {error && (
        <AIErrorAlert error={error} onRetry={runAnalysis} className="mb-8" />
      )}

      {safeSuggestedRisks.length === 0 && !loading && (
        <div className="bg-white border border-slate-200 rounded-2xl p-16 text-center shadow-sm">
          <div className="w-20 h-20 bg-indigo-50 text-indigo-600 rounded-3xl flex items-center justify-center mx-auto mb-6 transform -rotate-6">
            <ScanSearch className="w-10 h-10" />
          </div>
          <h2 className="text-2xl font-black text-slate-900 mb-2">
            Initialise AI Risk Inquiry?
          </h2>
          <p className="text-slate-500 mb-8 max-w-md mx-auto text-sm leading-relaxed">
            Evaluation of project metadata against standard risk taxonomies to
            generate a contextual risk profile.
          </p>
          <button
            onClick={runAnalysis}
            className="px-8 py-4 bg-indigo-600 text-white font-bold rounded-xl shadow-xl hover:bg-indigo-700 transition-all transform hover:-translate-y-1 active:scale-95"
          >
            Run AI Risk Inquiry
          </button>
        </div>
      )}

      {loading && (
        <div className="bg-white border border-slate-200 rounded-2xl p-16 flex flex-col items-center justify-center shadow-sm">
          <div className="w-12 h-12 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin mb-6" />
          <h3 className="text-lg font-black text-slate-900">
            Identifying potential threats...
          </h3>
          <p className="text-sm text-slate-500 mt-1 animate-pulse">
            Running semantic analysis on project scope
          </p>
        </div>
      )}

      {safeSuggestedRisks.length > 0 && (
        <div className="space-y-4">
          {safeSuggestedRisks.map((r, idx) => {
            const isAccepted = acceptedIds.includes(r.id);
            const isRejected = rejectedIds.includes(r.id);
            const isExpanded = expandedIds.includes(r.id);
            const isPending = !isAccepted && !isRejected;

            const toggleExpanded = () => {
              if (isExpanded)
                setExpandedIds(expandedIds.filter((id) => id !== r.id));
              else setExpandedIds([...expandedIds, r.id]);
            };

            const ratingColor = getRatingColor(r.grossRating);
            const ratingLabel = getRatingLabel(r.grossRating);

            return (
              <div
                key={r.id}
                className={clsx(
                  "group relative bg-white border rounded-2xl transition-all duration-300",
                  isAccepted
                    ? "border-emerald-500 bg-emerald-50/20"
                    : isRejected
                      ? "border-rose-200 bg-rose-50/10 opacity-60 grayscale"
                      : "border-slate-200 hover:border-indigo-300 shadow-sm hover:shadow-lg",
                )}
              >
                {/* Status Indicator Bar */}
                {isAccepted && (
                  <div className="absolute top-0 bottom-0 left-0 w-1.5 bg-emerald-500 rounded-l-2xl" />
                )}
                {isRejected && (
                  <div className="absolute top-0 bottom-0 left-0 w-1.5 bg-rose-500 rounded-l-2xl" />
                )}
                {!isAccepted && !isRejected && (
                  <div
                    className={clsx(
                      "absolute top-0 bottom-0 left-0 w-1.5 rounded-l-2xl",
                      r.grossRating >= 16 ? "bg-rose-500" : "bg-orange-500",
                    )}
                  />
                )}

                <div className="p-4 sm:p-6">
                  {/* Top Bar: Title & Primary Status */}
                  <div className="flex flex-col sm:flex-row items-start justify-between gap-4 sm:gap-6">
                    <div className="flex items-start gap-3 sm:gap-4 flex-1 min-w-0 w-full">
                      <span className="text-sm font-black text-slate-300 mt-1">
                        {idx + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-2">
                          <h3
                            className={clsx(
                              "text-lg font-black tracking-tight truncate",
                              isRejected
                                ? "text-slate-400 line-through"
                                : "text-slate-900",
                            )}
                          >
                            {stripMarkdown(r.title)}
                          </h3>
                          {r.exists ? (
                            <span className="flex items-center gap-1.5 px-3 py-1 bg-amber-50 text-amber-600 text-[10px] font-black uppercase tracking-widest rounded-lg border border-amber-200/50">
                              <AlertCircle className="w-3 h-3" /> Already
                              Registered
                            </span>
                          ) : (
                            <span className="flex items-center gap-1.5 px-3 py-1 bg-indigo-50 text-indigo-600 text-[10px] font-black uppercase tracking-widest rounded-lg border border-indigo-200/50">
                              <Target className="w-3 h-3 text-indigo-500" /> New
                              Identification
                            </span>
                          )}
                          {isAccepted && (
                            <span className="flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-600 text-[10px] font-black uppercase tracking-widest rounded-lg border border-emerald-200/50">
                              <CheckCircle2 className="w-3 h-3" /> Accepted
                            </span>
                          )}
                          {isRejected && (
                            <span className="flex items-center gap-1.5 px-3 py-1 bg-rose-50 text-rose-600 text-[10px] font-black uppercase tracking-widest rounded-lg border border-rose-200/50">
                              <XCircle className="w-3 h-3" /> Rejected
                            </span>
                          )}
                        </div>

                        {/* Tags Bar */}
                        <div className="flex flex-wrap items-center gap-2 mb-3">
                          <span className="px-2 py-1 bg-indigo-50 text-indigo-700 text-[9px] font-bold uppercase tracking-wider rounded border border-indigo-100 shadow-sm">
                            {stripMarkdown(r.category || "Risk")}
                          </span>
                          <span
                            className={clsx(
                              "px-2 py-1 text-[9px] font-black uppercase tracking-widest rounded border shadow-sm",
                              ratingColor,
                            )}
                          >
                            Gross: {r.grossRating} ({ratingLabel})
                          </span>
                          <span className="px-2 py-1 bg-slate-100 text-slate-500 text-[9px] font-bold uppercase tracking-wider rounded border border-slate-200">
                            {activeProjectId ? activeProjectId : "Shared"} •{" "}
                            {stripMarkdown(r.workstream || "Contractor")}
                          </span>
                          {r.exists ? (
                            <span className="px-2 py-1 bg-amber-50 text-amber-700 text-[9px] font-black uppercase tracking-widest rounded border border-amber-200 flex items-center gap-1 shadow-sm ring-2 ring-amber-500/20">
                              <AlertTriangle className="w-2.5 h-2.5 text-amber-500" />{" "}
                              Already Registered
                            </span>
                          ) : (
                            <span className="px-2 py-1 bg-emerald-50 text-emerald-700 text-[9px] font-black uppercase tracking-widest rounded border border-emerald-200 flex items-center gap-1 shadow-sm ring-2 ring-emerald-500/20 animate-pulse">
                              <Plus className="w-2.5 h-2.5 text-emerald-500" />{" "}
                              New Identification
                            </span>
                          )}
                          {r.escalated && (
                            <span className="px-2 py-1 bg-orange-50 text-orange-600 text-[9px] font-black uppercase tracking-widest rounded border border-orange-200 shadow-sm">
                              Escalated
                            </span>
                          )}
                        </div>

                        <p
                          className={clsx(
                            "text-sm leading-relaxed max-w-4xl",
                            isRejected ? "text-slate-400" : "text-slate-600",
                          )}
                        >
                          {stripMarkdown(r.desc)}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto ml-7 sm:ml-0">
                      {!isAccepted && !isRejected && (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() =>
                              setAcceptedIds([...acceptedIds, r.id])
                            }
                            className="p-2.5 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 rounded-xl transition-all border border-emerald-200/50 shadow-sm flex items-center gap-2 group/btn"
                          >
                            <Check className="w-5 h-5" />
                          </button>
                          <button
                            onClick={() =>
                              setRejectedIds([...rejectedIds, r.id])
                            }
                            className="p-2.5 bg-rose-50 text-rose-600 hover:bg-rose-100 rounded-xl transition-all border border-rose-200/50 shadow-sm flex items-center gap-2 group/btn"
                          >
                            <X className="w-5 h-5" />
                          </button>
                        </div>
                      )}
                      {(isAccepted || isRejected) && (
                        <button
                          onClick={() => {
                            setAcceptedIds(
                              acceptedIds.filter((id) => id !== r.id),
                            );
                            setRejectedIds(
                              rejectedIds.filter((id) => id !== r.id),
                            );
                          }}
                          className="px-6 py-2.5 bg-white border border-slate-200 text-slate-600 text-sm font-black rounded-xl hover:bg-slate-50 transition-all flex items-center gap-2 shadow-sm"
                        >
                          <X className="w-4 h-4 text-slate-400" /> Reset
                          Selection
                        </button>
                      )}
                      <button
                        onClick={toggleExpanded}
                        className="p-2.5 hover:bg-slate-100 text-slate-400 hover:text-indigo-600 rounded-xl transition-all"
                      >
                        {isExpanded ? (
                          <ChevronUp className="w-5 h-5" />
                        ) : (
                          <ChevronDown className="w-5 h-5" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Expanded Detail Grid (Match 11.png) */}
                  {isExpanded && (
                    <div className="mt-4 sm:mt-6 pt-4 sm:pt-6 border-t border-slate-100 animate-in fade-in slide-in-from-top-2 duration-300">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
                        <div className="bg-slate-50 border border-slate-100 rounded-xl p-3">
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
                            Likelihood
                          </p>
                          <p className="text-sm font-bold text-slate-800">
                            {r.grossL} — {getProbLabel(r.grossL)}
                          </p>
                        </div>
                        <div className="bg-slate-50 border border-slate-100 rounded-xl p-3">
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
                            Impact
                          </p>
                          <p className="text-sm font-bold text-slate-800">
                            {r.grossI} — {getImpactLabel(r.grossI)}
                          </p>
                        </div>
                        <div className="bg-slate-50 border border-slate-100 rounded-xl p-3">
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
                            Gross Score
                          </p>
                          <p
                            className={clsx(
                              "text-sm font-black",
                              ratingColor.split(" ")[0],
                            )}
                          >
                            {r.grossRating} — {ratingLabel}
                          </p>
                        </div>
                        <div className="bg-slate-50 border border-slate-100 rounded-xl p-3">
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
                            Risk Response
                          </p>
                          <p className="text-sm font-bold text-slate-800">
                            {stripMarkdown(r.response || "Reduce")}
                          </p>
                        </div>
                        <div className="bg-slate-50 border border-slate-100 rounded-xl p-3">
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
                            Owner
                          </p>
                          <p className="text-sm font-bold text-slate-800">
                            {stripMarkdown(r.owner || "Project Manager")}
                          </p>
                        </div>
                        <div className="bg-slate-50 border border-slate-100 rounded-xl p-3">
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
                            Workstream
                          </p>
                          <p className="text-sm font-bold text-slate-800">
                            {stripMarkdown(r.workstream || "General Safety")}
                          </p>
                        </div>
                        <div className="bg-slate-50 border border-slate-100 rounded-xl p-3">
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
                            Net Score (Est.)
                          </p>
                          <p className="text-sm font-bold text-indigo-600">
                            {r.residualRating} —{" "}
                            {getRatingLabel(r.residualRating)}
                          </p>
                        </div>
                        <div className="bg-slate-50 border border-slate-100 rounded-xl p-3">
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
                            Review Freq.
                          </p>
                          <p className="text-sm font-bold text-slate-800">
                            Monthly
                          </p>
                        </div>
                      </div>

                      {isPending && (
                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 mt-6 sm:mt-8">
                          <button
                            onClick={() =>
                              setAcceptedIds([...acceptedIds, r.id])
                            }
                            className="w-full sm:w-auto justify-center px-4 sm:px-8 py-2.5 sm:py-3 bg-white border-2 border-slate-200 text-slate-900 text-sm font-black rounded-xl hover:bg-slate-50 transition-all flex items-center gap-2.5"
                          >
                            <Check className="w-5 h-5 text-emerald-500" />{" "}
                            Accept
                          </button>
                          <button
                            onClick={() =>
                              setRejectedIds([...rejectedIds, r.id])
                            }
                            className="w-full sm:w-auto justify-center px-4 sm:px-8 py-2.5 sm:py-3 bg-white border-2 border-slate-200 text-slate-900 text-sm font-black rounded-xl hover:bg-slate-50 transition-all flex items-center gap-2.5"
                          >
                            <X className="w-5 h-5 text-rose-500" /> Reject
                          </button>
                          <button
                            onClick={() => {
                              setEditingRisk(r);
                              setIsModalOpen(true);
                            }}
                            className="w-full sm:w-auto justify-center px-4 sm:px-8 py-2.5 sm:py-3 bg-white border-2 border-slate-200 text-slate-900 text-sm font-black rounded-xl hover:bg-slate-50 transition-all flex items-center gap-2.5"
                          >
                            <Edit3 className="w-5 h-5 text-indigo-500" /> Edit
                            before accepting
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ─── STICKY FOOTER (Match 11.png) ─── */}
      {safeSuggestedRisks.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-slate-200 p-3 sm:p-4 shadow-[0_-10px_40px_rgba(0,0,0,0.05)] z-40">
          <div className="max-w-[98%] lg:max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center justify-between w-full sm:w-auto gap-4 sm:gap-6">
              <button
                onClick={() =>
                  navigate(
                    "/risk/register" +
                      (fromInitiation ? "?from=initiation" : ""),
                  )
                }
                className="shrink-0 flex items-center gap-1 sm:gap-2 px-3 py-2 sm:px-4 hover:bg-slate-100 rounded-xl text-slate-600 text-[10px] sm:text-sm font-bold transition-all"
              >
                <ArrowLeft className="w-3 h-3 sm:w-4 sm:h-4" />{" "}
                <span className="hidden sm:inline">Back</span>
              </button>
              <div className="hidden sm:block w-px h-6 bg-slate-200" />
              <p className="text-xs sm:text-sm font-bold text-slate-700 flex-1 min-w-0">
                <span className="text-indigo-600 font-black">
                  {acceptedIds.length}
                </span>{" "}
                <span className="hidden sm:inline">
                  risks accepted and ready to add to the Register
                </span>
                <span className="sm:hidden">risks ready</span>
                <span className="text-[9px] sm:text-[10px] text-slate-400 font-medium block truncate">
                  They will be linked to {activeName}
                </span>
              </p>
            </div>

            <div className="flex items-center gap-2 sm:gap-4 w-full sm:w-auto">
              <button
                onClick={() => {
                  setIsAcceptingAll(true);
                  setTimeout(() => {
                    const pendingIds = safeSuggestedRisks
                      .filter(
                        (r) =>
                          !r.exists &&
                          !acceptedIds.includes(r.id) &&
                          !rejectedIds.includes(r.id),
                      )
                      .map((r) => r.id);
                    setAcceptedIds((prev) => [...prev, ...pendingIds]);
                    setIsAcceptingAll(false);
                  }, 150);
                }}
                disabled={
                  pendingRisks.filter((r) => !r.exists).length === 0 ||
                  isAcceptingAll ||
                  isFinalizing
                }
                className="flex-1 sm:flex-none justify-center px-2 sm:px-6 py-2.5 sm:py-3 bg-white border-2 border-slate-200 text-slate-900 text-[10px] sm:text-sm font-black rounded-xl hover:bg-slate-50 transition-all flex items-center gap-1 sm:gap-2 disabled:opacity-50 disabled:cursor-not-allowed break-words text-center"
              >
                {isAcceptingAll ? (
                  <Loader2 className="w-3 h-3 sm:w-4 sm:h-4 text-emerald-500 shrink-0 animate-spin" />
                ) : (
                  <Check className="w-3 h-3 sm:w-4 sm:h-4 text-emerald-500 shrink-0" />
                )}{" "}
                <span className="hidden sm:inline">
                  {isAcceptingAll ? "Accepting..." : "Accept all"}
                </span>{" "}
                remaining ({pendingRisks.filter((r) => !r.exists).length})
              </button>
              <button
                onClick={() => finalize()}
                disabled={isFinalizing || isAcceptingAll}
                className="flex-1 sm:flex-none justify-center px-2 sm:px-8 py-2.5 sm:py-3 bg-slate-900 text-white text-[10px] sm:text-sm font-black rounded-xl hover:bg-slate-800 transition-all shadow-xl shadow-slate-900/40 active:scale-95 flex items-center gap-1.5 sm:gap-2.5 disabled:opacity-50 disabled:cursor-not-allowed break-words text-center leading-tight"
              >
                {isFinalizing ? (
                  <Loader2 className="w-3 h-3 sm:w-4 sm:h-4 text-emerald-400 shrink-0 animate-spin" />
                ) : (
                  <Plus className="w-3 h-3 sm:w-4 sm:h-4 text-emerald-400 shrink-0" />
                )}{" "}
                {isFinalizing
                  ? "Saving..."
                  : acceptedIds.length > 0
                    ? `Add ${acceptedIds.length} risks`
                    : rejectedIds.length === 0 &&
                        safeSuggestedRisks.filter((r) => !r.exists).length > 0
                      ? `Finalise (${safeSuggestedRisks.filter((r) => !r.exists).length})`
                      : "Finalise"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── EDIT MODAL INTEGRATION ─── */}
      <RiskModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        initialData={editingRisk}
        onSave={(updated) => {
          setSuggestedRisks(
            safeSuggestedRisks.map((r) =>
              r.id === editingRisk.id ? { ...r, ...updated } : r,
            ),
          );
          if (!acceptedIds.includes(editingRisk.id)) {
            setAcceptedIds([...acceptedIds, editingRisk.id]);
          }
          setIsModalOpen(false);
          setEditingRisk(null);
        }}
      />
    </div>
  );
}
