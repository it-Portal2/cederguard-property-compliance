import { useState, useEffect } from "react";
import { toast } from "react-hot-toast";
import { RiskItem, useStore } from "../store/useStore";
import {
  KRI_LIST,
  RISK_STATUSES,
  RISK_RESPONSES,
  APPETITES,
} from "../data/riskData";
import {
  STRATEGIC_CATEGORY_NAMES,
  OPERATIONAL_CATEGORY_NAMES,
  STRATEGIC_WORKSTREAMS,
  OPERATIONAL_WORKSTREAMS,
  getCategoryId,
  getWorkstreamId,
} from "../data/riskTaxonomy";
import {
  X,
  ShieldAlert,
  Target,
  AlertTriangle,
  ArrowRight,
} from "lucide-react";
import { clsx } from "clsx";
import { AIWriter } from "./AIWriter";
import { generateId } from "../lib/utils";
import {
  L_TO_PCT,
  clampRiskLevel,
  resolveImpactValue,
  deriveProjectSize,
  DEFAULT_PROJECT_SIZE,
  type ProjectSize,
  type RiskLevel,
} from "../data/riskBands";
import {
  Plus,
  CheckCircle2,
  Circle,
  Calendar,
  User,
  Trash2,
  Loader2,
} from "lucide-react";
import { format } from "date-fns";

interface RiskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (risk: Partial<RiskItem>) => void | Promise<void>;
  initialData?: RiskItem | null;
}

/** Convert stored probability (0-1 or 0-100) → display value (0-100) */
function toDisplayProb(stored?: number): number {
  if (!stored) return 0;
  return stored > 1 ? Math.round(stored) : Math.round(stored * 100);
}

const emptyForm = (): Partial<RiskItem> => ({
  project: "",
  projectId: "",
  programmeId: "",
  workstream: "",
  category: "",
  kri: "", // ← empty, not first item
  status: "Open",
  response: RISK_RESPONSES[0],
  appetite: "",
  escalated: false,
  grossL: 1,
  grossI: 1,
  residualL: 1,
  residualI: 1,
  // Store as display % (0-100) internally in the modal; divide by 100 on save
  grossProb: 20, // default L=1 → 20%
  residualProb: 20,
  grossImpact: 0,
  residualImpact: 0,
  isProgrammeLevel: false,
  title: "",
  desc: "",
  cause: "",
  controls: "",
  furtherAction: "",
  owner: "",
  dueDate: "",
});

export function RiskModal({
  isOpen,
  onClose,
  onSave,
  initialData,
}: RiskModalProps) {
  const {
    projects,
    programmes,
    activeProjectId,
    activeProgrammeId,
    tasks,
    addTask,
    updateTask,
    deleteTask,
  } = useStore();
  const [formData, setFormData] = useState<Partial<RiskItem>>(emptyForm());
  const [isSaving, setIsSaving] = useState(false);
  const [newActionTitle, setNewActionTitle] = useState("");
  const [isAddingAction, setIsAddingAction] = useState(false);
  const [isAddingTask, setIsAddingTask] = useState(false);

  // Filter tasks for this risk
  const riskActions = tasks.filter((t) => t.riskId === initialData?.id);

  // ── Exposure-derivation context ─────────────────────────────────────────────
  // Always computed from the current formData + projects list. Used at every
  // ingress point (open, change, save) to guarantee Impact £ is derived.
  const safeProjectsList = Array.isArray(projects) ? projects : [];
  const activeFormProject = safeProjectsList.find(
    (p) => p.id === formData.projectId,
  );
  const derivedProjectSize: ProjectSize = deriveProjectSize(
    activeFormProject as any,
  );
  const ctx = {
    isProgrammeLevel: !!formData.isProgrammeLevel,
    projectSize: derivedProjectSize,
  };

  useEffect(() => {
    if (!isOpen) return;
    if (initialData) {
      // Convert stored probability back to display (0-100) for editing
      // Ensure ID fields are populated (for both ID-based and legacy risks)
      // Resolve programmeId from the linked project if not stored on the risk —
      // prevents "Cannot escalate" guard firing on risks that haven't been escalated yet.
      const safeProjects = Array.isArray(projects) ? projects : [];
      const resolvedProgrammeId =
        initialData.programmeId ||
        safeProjects.find((p) => p.id === initialData.projectId)?.programmeId ||
        activeProgrammeId ||
        '';
      const isProgrammeLevel =
        !!initialData.isProgrammeLevel || !initialData.projectId;
      const initProject = safeProjects.find(
        (p) => p.id === initialData.projectId,
      );
      const initCtx = {
        isProgrammeLevel,
        projectSize: deriveProjectSize(initProject as any),
      };
      const grossI = clampRiskLevel(initialData.grossI);
      const residualI = clampRiskLevel(initialData.residualI);
      setFormData({
        ...initialData,
        programmeId: resolvedProgrammeId,
        isProgrammeLevel,
        grossI,
        residualI,
        grossProb: toDisplayProb(initialData.grossProb),
        residualProb: toDisplayProb(initialData.residualProb),
        // Override any manually-typed legacy Exposure values with derived ones
        grossImpact: resolveImpactValue(grossI, initCtx),
        residualImpact: resolveImpactValue(residualI, initCtx),
        categoryId:
          initialData.categoryId || getCategoryId(initialData.category || ""),
        workstreamId:
          initialData.workstreamId ||
          getWorkstreamId(initialData.workstream || ""),
      });
    } else {
      const safeProjects = Array.isArray(projects) ? projects : [];
      const safeProgrammes = Array.isArray(programmes) ? programmes : [];
      const currentProject = safeProjects.find((p) => p.id === activeProjectId);
      const currentProgramme = safeProgrammes.find(
        (p) => p.id === activeProgrammeId,
      );
      const isProgrammeLevel = !activeProjectId && !!activeProgrammeId;
      const newCtx = {
        isProgrammeLevel,
        projectSize: deriveProjectSize(currentProject as any),
      };
      // Default L=1, I=1 → derive Impact £ from the lookup, not the empty-form 0.
      const defaultI: RiskLevel = 1;
      setFormData({
        ...emptyForm(),
        project: currentProject?.name || "",
        projectId: activeProjectId || "",
        programme: currentProgramme?.name || "",
        programmeId: activeProgrammeId || currentProject?.programmeId || "",
        isProgrammeLevel,
        grossImpact: resolveImpactValue(defaultI, newCtx),
        residualImpact: resolveImpactValue(defaultI, newCtx),
      });
    }
  }, [
    initialData,
    isOpen,
    activeProjectId,
    activeProgrammeId,
    projects,
    programmes,
  ]);

  if (!isOpen) return null;

  const handleChange = (field: keyof RiskItem, value: any) => {
    setFormData((prev) => {
      const next: Partial<RiskItem> = { ...prev, [field]: value };

      // Auto-map Likelihood (1-5) → Probability %
      if (field === "grossL") {
        next.grossProb = L_TO_PCT[clampRiskLevel(value)];
      }
      if (field === "residualL") {
        next.residualProb = L_TO_PCT[clampRiskLevel(value)];
      }

      // Re-derive Impact £ whenever the impact rating or derivation context
      // changes. ALE is then trustworthy because it's computed live downstream.
      const safeProjects = Array.isArray(projects) ? projects : [];
      let isProgrammeLevel = !!next.isProgrammeLevel;
      let activeProject = safeProjects.find((p) => p.id === next.projectId);

      if (field === "projectId") {
        const pid = value as string;
        activeProject = safeProjects.find((p) => p.id === pid);
        isProgrammeLevel = !pid;
        next.isProgrammeLevel = isProgrammeLevel;
        next.project = activeProject?.name || "";
        next.programmeId = activeProject?.programmeId || next.programmeId || "";
      }

      if (field === "isProgrammeLevel") {
        isProgrammeLevel = !!value;
      }

      const recomputeBoth =
        field === "projectId" || field === "isProgrammeLevel";
      const nextCtx = {
        isProgrammeLevel,
        projectSize: deriveProjectSize(activeProject as any),
      };

      if (field === "grossI" || recomputeBoth) {
        next.grossImpact = resolveImpactValue(
          clampRiskLevel(next.grossI ?? 1),
          nextCtx,
        );
      }
      if (field === "residualI" || recomputeBoth) {
        next.residualImpact = resolveImpactValue(
          clampRiskLevel(next.residualI ?? 1),
          nextCtx,
        );
      }

      return next;
    });
  };

  const handleSave = async () => {
    setIsSaving(true);
    const updated = { ...formData };

    // Orphan safety net — a risk without a project is programme-level.
    // Must run BEFORE the impact re-derive so ctx picks the correct bands.
    if (!updated.projectId) {
      updated.isProgrammeLevel = true;
    }

    // Final re-derive — guarantees the persisted record carries derived
    // Probability and Exposure £, regardless of how formData was populated
    // (AI injection, legacy paste, etc.).
    const safeProjects = Array.isArray(projects) ? projects : [];
    const saveProject = safeProjects.find((p) => p.id === updated.projectId);
    const saveCtx = {
      isProgrammeLevel: !!updated.isProgrammeLevel,
      projectSize: deriveProjectSize(saveProject as any),
    };
    const gI = clampRiskLevel(updated.grossI ?? 1);
    const rI = clampRiskLevel(updated.residualI ?? 1);
    const gL = clampRiskLevel(updated.grossL ?? 1);
    const rL = clampRiskLevel(updated.residualL ?? 1);
    updated.grossI = gI;
    updated.residualI = rI;
    updated.grossL = gL;
    updated.residualL = rL;
    updated.grossImpact = resolveImpactValue(gI, saveCtx);
    updated.residualImpact = resolveImpactValue(rI, saveCtx);

    // Store probability as 0-1 decimal (e.g. 40% → 0.40)
    const gProb = L_TO_PCT[gL] / 100;
    const rProb = L_TO_PCT[rL] / 100;
    updated.grossProb = gProb;
    updated.residualProb = rProb;

    updated.grossRating = gL * gI;
    updated.residualRating = rL * rI;
    updated.grossALE = updated.grossImpact * gProb;
    updated.residualALE = updated.residualImpact * rProb;
    updated.riskReduction =
      (updated.grossALE || 0) - (updated.residualALE || 0);
    updated.riskReductionPct =
      updated.grossRating && updated.grossRating > 0
        ? Math.round(
            (1 - (updated.residualRating || 0) / updated.grossRating) * 100,
          )
        : 0;

    try {
      await onSave(updated);
      onClose();
    } catch {
      // Stay open on failure — caller has already surfaced the error toast.
      // User can fix and retry without re-entering the whole form.
    } finally {
      setIsSaving(false);
    }
  };

  const scoreColor = (score: number) => {
    if (!score || score <= 6)
      return "bg-emerald-100 text-emerald-800 border-emerald-200";
    if (score <= 14) return "bg-amber-100 text-amber-800 border-amber-200";
    return "bg-rose-100 text-rose-800 border-rose-200 font-bold";
  };

  const currGross = (formData.grossL || 1) * (formData.grossI || 1);
  const currResidual = (formData.residualL || 1) * (formData.residualI || 1);
  const gALE = (formData.grossImpact || 0) * ((formData.grossProb || 0) / 100);
  const rALE =
    (formData.residualImpact || 0) * ((formData.residualProb || 0) / 100);

  // Projects scoped to the selected/active programme
  const safeProjects = Array.isArray(projects) ? projects : [];
  const scopedProjects = activeProgrammeId
    ? safeProjects.filter(
        (p) => p.programmeId === (formData.programmeId || activeProgrammeId),
      )
    : safeProjects;

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 z-50">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl max-h-[calc(100dvh-2rem)] md:max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-100 shrink-0">
          <div>
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-xl font-black text-slate-900 tracking-tight uppercase">
                {initialData ? "Refine Risk Intelligence" : "Register New Risk"}
              </h2>
              {formData.escalated && (
                <div className="flex items-center gap-2 px-3 py-1 bg-purple-600 text-white rounded-full animate-pulse shadow-lg shadow-purple-200">
                  <ShieldAlert className="w-3.5 h-3.5" />
                  <span className="text-[10px] font-black uppercase tracking-widest">
                    Escalated to Programme
                  </span>
                </div>
              )}
            </div>
            {initialData && (
              <p className="text-sm text-slate-500 mt-1">
                Ref: {initialData.id}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            disabled={isSaving}
            className="p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Warnings / Banners */}
        <div className="shrink-0 px-6 pt-2 space-y-2">
          {formData.escalated && (
            <div className="flex items-center gap-3 p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-800">
              <ShieldAlert className="w-5 h-5 shrink-0" />
              <div className="text-xs font-bold leading-tight">
                <span className="uppercase tracking-widest block mb-0.5">
                  Escalated to Programme
                </span>
                This risk is currently being managed at the programme level. Any
                changes here will be reflected in the Programme Risk Register.
              </div>
            </div>
          )}
          {formData.convertedToIssue && (
            <div className="flex items-center gap-3 p-3 bg-red-50 border border-red-200 rounded-xl text-red-800">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <div className="text-xs font-bold leading-tight">
                <span className="uppercase tracking-widest block mb-0.5">
                  Converted to Issue
                </span>
                This risk has been closed and converted to a live issue. Manage
                the resolution in the{" "}
                <span className="underline italic">Issue Registry</span>.
              </div>
            </div>
          )}
        </div>

        {/* Content */}
        <fieldset
          disabled={isSaving}
          className="p-6 overflow-y-auto flex-1 space-y-8 disabled:opacity-60 disabled:pointer-events-none border-0 m-0"
        >
          {/* Section 1: Core Details */}
          <div>
            <h3 className="text-sm font-semibold text-slate-800 uppercase tracking-wider mb-4 border-b border-slate-100 pb-2">
              Core Details
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Risk Title <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.title || ""}
                  onChange={(e) => handleChange("title", e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                  placeholder="e.g., Delay in planning approval"
                  required
                />
              </div>
              <div className="md:col-span-2">
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-sm font-medium text-slate-700">
                    Description
                  </label>
                  <AIWriter
                    context={
                      formData.desc?.trim()
                        ? `Enhance and professionalize this risk description by keeping ALL existing details and expanding with clearer language. DO NOT remove any facts, stakeholders, or locations mentioned. ONLY return the enhanced description, no explanations. Current: "${formData.desc}". Risk: ${formData.title}. Category: ${formData.category}.`
                        : `Write a professional risk description. ONLY return the description text, no explanations. Risk: ${formData.title}. Category: ${formData.category}. Context: ${formData.project || formData.programme || "Programme Level"}.`
                    }
                    onSuggest={(val) => handleChange("desc", val)}
                    placeholder="e.g. describe the risk scenario, trigger conditions, or affected activities"
                    className="scale-90"
                  />
                </div>
                <textarea
                  value={formData.desc || ""}
                  onChange={(e) => handleChange("desc", e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 min-h-[80px]"
                  placeholder="Detailed description of the risk event..."
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Causes & Effects
                </label>
                <textarea
                  value={formData.cause || ""}
                  onChange={(e) => handleChange("cause", e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 min-h-[80px]"
                  placeholder="Specific causes and effects..."
                />
              </div>

              {/* Project / Context — only show projects in scope */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Project (Optional)
                </label>
                <select
                  value={formData.projectId || ""}
                  onChange={(e) => handleChange("projectId", e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
                >
                  <option value="">Programme Level / No Project</option>
                  {scopedProjects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Workstream
                </label>
                <select
                  value={formData.workstream || ""}
                  onChange={(e) => handleChange("workstream", e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
                >
                  <option value="">— Select Workstream —</option>
                  {formData.isProgrammeLevel
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
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Category
                </label>
                <select
                  value={formData.category || ""}
                  onChange={(e) => handleChange("category", e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
                >
                  <option value="">— Select Category —</option>
                  {formData.isProgrammeLevel
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
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Linked KRI{" "}
                  <span className="text-slate-400 font-normal text-xs">
                    (Optional)
                  </span>
                </label>
                <select
                  value={formData.kri || ""}
                  onChange={(e) => handleChange("kri", e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
                >
                  <option value="">— None —</option>
                  {KRI_LIST.map((k) => (
                    <option key={k} value={k}>
                      {k}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Section 2: Assessment & Controls */}
          <div>
            <h3 className="text-sm font-semibold text-slate-800 uppercase tracking-wider mb-4 border-b border-slate-100 pb-2">
              Assessment & Controls
            </h3>

            {/* Probability legend */}
            <div className="mb-4 flex gap-2 flex-wrap">
              {Object.entries(L_TO_PCT).map(([l, pct]) => (
                <span
                  key={l}
                  className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-[10px] font-bold border border-slate-200"
                >
                  L{l} = {pct}%
                </span>
              ))}
              <span className="text-[10px] text-slate-400 self-center ml-1">
                — Likelihood to Probability mapping
              </span>
            </div>

            {/* Exposure derivation context — tells PMs WHY the £ values look the way they do */}
            <div className="mb-4">
              {ctx.isProgrammeLevel ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200 text-[10px] font-bold uppercase tracking-wider">
                  Context: Programme Bands
                </span>
              ) : activeFormProject ? (
                <span
                  className={clsx(
                    "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-[10px] font-bold uppercase tracking-wider",
                    (activeFormProject as any)?.numberOfUnits
                      ? "bg-slate-100 text-slate-700 border-slate-200"
                      : "bg-amber-50 text-amber-800 border-amber-200",
                  )}
                >
                  Context: Project Size — {ctx.projectSize}
                  {!(activeFormProject as any)?.numberOfUnits &&
                    " (default — set unit count in Project Initiation to refine)"}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-50 text-amber-800 border border-amber-200 text-[10px] font-bold uppercase tracking-wider">
                  Context: Project Size — {DEFAULT_PROJECT_SIZE} (default)
                </span>
              )}
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 mb-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Gross */}
                <div>
                  <h4 className="font-semibold text-slate-800 mb-3 flex items-center justify-between">
                    Gross Score (Inherent){" "}
                    <span
                      className={clsx(
                        "px-2 py-0.5 rounded text-xs border font-bold",
                        scoreColor(currGross),
                      )}
                    >
                      {currGross}
                    </span>
                  </h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">
                        Likelihood (1–5)
                      </label>
                      <select
                        value={formData.grossL ?? 1}
                        onChange={(e) =>
                          handleChange("grossL", parseInt(e.target.value))
                        }
                        className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
                      >
                        {[1, 2, 3, 4, 5].map((n) => (
                          <option key={n} value={n}>
                            {n} — {L_TO_PCT[n]}%
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">
                        Impact (1–5)
                      </label>
                      <select
                        value={formData.grossI ?? 1}
                        onChange={(e) =>
                          handleChange("grossI", parseInt(e.target.value))
                        }
                        className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
                      >
                        {[1, 2, 3, 4, 5].map((n) => (
                          <option key={n} value={n}>
                            {n}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4 mt-4">
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">
                        Probability %{" "}
                        <span className="text-indigo-500 font-bold">
                          ({formData.grossProb || 0}%)
                        </span>
                      </label>
                      <input
                        type="number"
                        value={formData.grossProb ?? 0}
                        disabled
                        className="w-full bg-slate-100/50 cursor-not-allowed text-slate-500 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none"
                      />
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        Strictly derived from Likelihood
                      </p>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">
                        Exposure / Impact (£)
                      </label>
                      <input
                        type="text"
                        value={`£${(formData.grossImpact || 0).toLocaleString(
                          "en-GB",
                          { maximumFractionDigits: 0 },
                        )}`}
                        readOnly
                        disabled
                        aria-readonly="true"
                        className="w-full bg-slate-100 text-slate-700 cursor-not-allowed border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none"
                      />
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        Auto-derived from Impact ×{" "}
                        {ctx.isProgrammeLevel
                          ? "Programme band"
                          : `Project size: ${ctx.projectSize}`}
                      </p>
                    </div>
                  </div>
                  <div className="mt-2 text-xs text-slate-600 font-semibold bg-blue-50 rounded-lg px-3 py-2 border border-blue-100">
                    Gross ALE = £{Math.round(gALE).toLocaleString()} &nbsp;(
                    {formData.grossProb || 0}% × £
                    {(formData.grossImpact || 0).toLocaleString()})
                  </div>
                </div>

                {/* Residual */}
                <div>
                  <h4 className="font-semibold text-slate-800 mb-3 flex items-center justify-between">
                    Residual Risk Score{" "}
                    <span
                      className={clsx(
                        "px-2 py-0.5 rounded text-xs border font-bold",
                        scoreColor(currResidual),
                      )}
                    >
                      {currResidual}
                    </span>
                  </h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">
                        Likelihood (1–5)
                      </label>
                      <select
                        value={formData.residualL ?? 1}
                        onChange={(e) =>
                          handleChange("residualL", parseInt(e.target.value))
                        }
                        className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
                      >
                        {[1, 2, 3, 4, 5].map((n) => (
                          <option key={n} value={n}>
                            {n} — {L_TO_PCT[n]}%
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">
                        Impact (1–5)
                      </label>
                      <select
                        value={formData.residualI ?? 1}
                        onChange={(e) =>
                          handleChange("residualI", parseInt(e.target.value))
                        }
                        className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
                      >
                        {[1, 2, 3, 4, 5].map((n) => (
                          <option key={n} value={n}>
                            {n}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4 mt-4">
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">
                        Probability %{" "}
                        <span className="text-indigo-500 font-bold">
                          ({formData.residualProb || 0}%)
                        </span>
                      </label>
                      <input
                        type="number"
                        value={formData.residualProb ?? 0}
                        disabled
                        className="w-full bg-slate-100/50 cursor-not-allowed text-slate-500 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none"
                      />
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        Strictly derived from Likelihood
                      </p>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">
                        Exposure / Impact (£)
                      </label>
                      <input
                        type="text"
                        value={`£${(formData.residualImpact || 0).toLocaleString(
                          "en-GB",
                          { maximumFractionDigits: 0 },
                        )}`}
                        readOnly
                        disabled
                        aria-readonly="true"
                        className="w-full bg-slate-100 text-slate-700 cursor-not-allowed border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none"
                      />
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        Auto-derived from Impact ×{" "}
                        {ctx.isProgrammeLevel
                          ? "Programme band"
                          : `Project size: ${ctx.projectSize}`}
                      </p>
                    </div>
                  </div>
                  <div className="mt-2 text-xs text-slate-600 font-semibold bg-indigo-50 rounded-lg px-3 py-2 border border-indigo-100">
                    Residual ALE = £{Math.round(rALE).toLocaleString()} &nbsp;(
                    {formData.residualProb || 0}% × £
                    {(formData.residualImpact || 0).toLocaleString()})
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-sm font-medium text-slate-700">
                    Current Controls
                  </label>
                  <AIWriter
                    context={
                      formData.controls?.trim()
                        ? `Enhance these risk controls by keeping ALL existing control measures and making them more specific and actionable. DO NOT remove any existing controls. ONLY return the enhanced controls, no explanations. Current: "${formData.controls}". Risk: ${formData.title}.`
                        : `Write specific, actionable risk controls. ONLY return the controls text, no explanations. Risk: ${formData.title}. Description: ${formData.desc || "Not provided"}. Context: ${formData.project || formData.programme || "Programme Level"}.`
                    }
                    onSuggest={(val) => handleChange("controls", val)}
                    placeholder="e.g. describe existing safeguards, who owns them, how effective they currently are"
                    className="scale-90"
                  />
                </div>
                <textarea
                  value={formData.controls || ""}
                  onChange={(e) => handleChange("controls", e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 min-h-[80px]"
                  placeholder="List of controls currently in place..."
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Response Strategy
                  </label>
                  <select
                    value={formData.response || ""}
                    onChange={(e) => handleChange("response", e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
                  >
                    <option value="">— Select Response —</option>
                    {RISK_RESPONSES.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Risk Appetite
                  </label>
                  <select
                    value={formData.appetite || ""}
                    onChange={(e) => handleChange("appetite", e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
                  >
                    <option value="">— Select Appetite —</option>
                    {APPETITES.map((a) => (
                      <option key={a} value={a}>
                        {a}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Section 3: Management */}
          <div>
            <h3 className="text-sm font-semibold text-slate-800 uppercase tracking-wider mb-4 border-b border-slate-100 pb-2">
              Management
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2 mt-4">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                    <Target className="w-4 h-4 text-amber-500" />
                    Mitigation Actions / Tasks
                  </h4>
                  <button
                    onClick={() => setIsAddingAction(true)}
                    className="flex items-center gap-1.5 text-xs font-medium text-indigo-600 hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100 px-2.5 py-1.5 rounded-lg transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add Action
                  </button>
                </div>

                <div className="space-y-2 mb-4">
                  {riskActions.length === 0 ? (
                    <div className="text-center py-6 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                      <p className="text-xs text-slate-400">
                        No actions defined for this risk yet.
                      </p>
                    </div>
                  ) : (
                    riskActions.map((action) => (
                      <div
                        key={action.id}
                        className="group flex items-center justify-between bg-white border border-slate-200 p-3 rounded-xl hover:border-indigo-200 transition-all shadow-sm"
                      >
                        <div className="flex items-start gap-3">
                          <button
                            onClick={() =>
                              updateTask(action.id, {
                                status:
                                  action.status === "Completed"
                                    ? "Pending"
                                    : "Completed",
                              })
                            }
                            className="mt-0.5"
                          >
                            {action.status === "Completed" ? (
                              <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                            ) : (
                              <Circle className="w-5 h-5 text-slate-300 group-hover:text-indigo-400" />
                            )}
                          </button>
                          <div>
                            <p
                              className={clsx(
                                "text-sm font-medium",
                                action.status === "Completed"
                                  ? "text-slate-400 line-through"
                                  : "text-slate-700",
                              )}
                            >
                              {action.title}
                            </p>
                            <div className="flex items-center gap-3 mt-1 text-[10px] text-slate-400">
                              <span className="flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                {action.dueDate
                                  ? format(
                                      new Date(action.dueDate),
                                      "dd MMM yyyy",
                                    )
                                  : "No date"}
                              </span>
                              <span className="flex items-center gap-1">
                                <User className="w-3 h-3" />
                                {action.owner || "Unassigned"}
                              </span>
                            </div>
                          </div>
                        </div>
                        <button
                          onClick={() => deleteTask(action.id)}
                          className="opacity-0 group-hover:opacity-100 p-1.5 text-slate-400 hover:text-rose-500 rounded-lg transition-all"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))
                  )}

                  {isAddingAction && (
                    <div className="bg-white border-2 border-indigo-100 p-4 rounded-xl shadow-md animate-in slide-in-from-top-2 duration-200">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-xs font-bold text-indigo-600 uppercase tracking-wider">
                          New Action
                        </span>
                        <AIWriter
                          context={
                            newActionTitle?.trim()
                              ? `Rewrite and improve this mitigation action title. ONLY return the improved action text, no explanations or commentary. Current: "${newActionTitle}". Risk: ${formData.title}.`
                              : `Write a specific, actionable mitigation task. ONLY return the task description, no explanations. Risk: ${formData.title}. Description: ${formData.desc || "Not provided"}. Context: ${formData.project || formData.programme || "Programme Level"}.`
                          }
                          onSuggest={(val) => setNewActionTitle(val)}
                          placeholder="e.g. a short action title to reduce or transfer this risk"
                          className="scale-90"
                        />
                      </div>
                      <input
                        autoFocus
                        type="text"
                        value={newActionTitle}
                        onChange={(e) => setNewActionTitle(e.target.value)}
                        placeholder="What needs to be done?"
                        disabled={isAddingTask}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 mb-3 disabled:opacity-50"
                        onKeyDown={async (e) => {
                          if (
                            e.key === "Enter" &&
                            newActionTitle &&
                            !isAddingTask
                          ) {
                            try {
                              setIsAddingTask(true);
                              await addTask({
                                id: generateId("TSK"),
                                title: newActionTitle,
                                status: "Pending",
                                priority: "Medium",
                                dueDate: new Date().toISOString().split("T")[0],
                                riskId: initialData?.id || "",
                                projectId: formData.projectId || "",
                                owner: formData.owner || "",
                              });
                              toast.success("Task added successfully");
                              setNewActionTitle("");
                              setIsAddingAction(false);
                            } catch (err: any) {
                              toast.error(err.message || "Failed to add task");
                            } finally {
                              setIsAddingTask(false);
                            }
                          }
                        }}
                      />
                      <div className="flex justify-end gap-2">
                        <button
                          disabled={isAddingTask}
                          onClick={() => setIsAddingAction(false)}
                          className="px-3 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-100 rounded-lg disabled:opacity-50"
                        >
                          Cancel
                        </button>
                        <button
                          disabled={!newActionTitle || isAddingTask}
                          onClick={async () => {
                            try {
                              setIsAddingTask(true);
                              await addTask({
                                id: generateId("TSK"),
                                title: newActionTitle,
                                status: "Pending",
                                priority: "Medium",
                                dueDate: new Date().toISOString().split("T")[0],
                                riskId: initialData?.id || "",
                                projectId: formData.projectId || "",
                                owner: formData.owner || "",
                              });
                              toast.success("Task added successfully");
                              setNewActionTitle("");
                              setIsAddingAction(false);
                            } catch (err: any) {
                              toast.error(err.message || "Failed to add task");
                            } finally {
                              setIsAddingTask(false);
                            }
                          }}
                          className="px-3 py-1.5 text-xs font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2"
                        >
                          {isAddingTask ? (
                            <>
                              <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                              Adding...
                            </>
                          ) : (
                            "Add Task"
                          )}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Risk Owner
                </label>
                <input
                  type="text"
                  value={formData.owner || ""}
                  onChange={(e) => handleChange("owner", e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
                  placeholder="E.g., Project Manager"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Due Date
                </label>
                <input
                  type="date"
                  value={formData.dueDate || ""}
                  onChange={(e) => handleChange("dueDate", e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Status
                </label>
                <select
                  value={formData.status || "Open"}
                  onChange={(e) => handleChange("status", e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
                >
                  {RISK_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col mt-2">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={!!formData.escalated}
                    onChange={(e) =>
                      handleChange("escalated", e.target.checked)
                    }
                    className="w-5 h-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="text-sm font-medium text-slate-700">
                    Escalate to Programme Level
                  </span>
                </label>
                {!!formData.escalated && !formData.programmeId && (
                  <p className="text-xs text-rose-600 mt-1.5 ml-8 flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    Cannot escalate — this project is not linked to a programme. Set the programme link in Project Initiation first.
                  </p>
                )}
              </div>
            </div>
          </div>
        </fieldset>

        {/* Footer */}
        <div className="p-6 border-t border-slate-100 bg-slate-50 rounded-b-2xl flex justify-end gap-3 shrink-0">
          <button
            onClick={onClose}
            disabled={isSaving}
            className="px-5 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-200 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!formData.title || isSaving || (!!formData.escalated && !formData.programmeId)}
            className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm flex items-center gap-2"
          >
            {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
            {isSaving ? "Saving..." : "Save Risk"}
          </button>
        </div>
      </div>
    </div>
  );
}
