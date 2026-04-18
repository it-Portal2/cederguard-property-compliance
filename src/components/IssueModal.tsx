import { useState, useEffect } from "react";
import { IssueItem, TaskItem, useStore } from "../store/useStore";
import { ISSUE_STATUSES, ISSUE_RESPONSES } from "../data/riskData";
import { generateId } from "../lib/utils";
import {
  X,
  CheckCircle2,
  Circle,
  AlertCircle,
  Plus,
  Trash2,
  Calendar,
  User,
  Edit2,
} from "lucide-react";
import { clsx } from "clsx";
import { AIWriter } from "./AIWriter";
import { format } from "date-fns";
import toast from "react-hot-toast";

interface IssueModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (issue: Partial<IssueItem>) => Promise<void>;
  initialData?: IssueItem | null;
}

export function IssueModal({
  isOpen,
  onClose,
  onSave,
  initialData,
}: IssueModalProps) {
  const {
    risks,
    tasks,
    addTask,
    updateTask,
    deleteTask,
    projects,
    activeProjectId,
    activeProgrammeId,
  } = useStore();

  const safeProjects = Array.isArray(projects) ? projects : [];
  const scopedProjects = activeProgrammeId
    ? safeProjects.filter((p) => p.programmeId === activeProgrammeId)
    : safeProjects;

  const [formData, setFormData] = useState<Partial<IssueItem>>({
    status: "1. Investigating",
    priority: 3,
    severity: 3,
    response: ISSUE_RESPONSES[0],
    projectId: activeProjectId || "",
    programmeId: activeProgrammeId || "",
  });

  // Save button loading state
  const [isSaving, setIsSaving] = useState(false);

  // Action management state
  const [newActionTitle, setNewActionTitle] = useState("");
  const [newActionOwner, setNewActionOwner] = useState("");
  const [newActionDeadline, setNewActionDeadline] = useState("");
  const [newActionPriority, setNewActionPriority] = useState<
    "Low" | "Medium" | "High" | "Critical"
  >("Medium");
  const [showAddAction, setShowAddAction] = useState(false);
  const [editingActionId, setEditingActionId] = useState<string | null>(null);
  const [localActions, setLocalActions] = useState<Partial<TaskItem>[]>([]);
  const [isSavingAction, setIsSavingAction] = useState(false);

  const issueActions = initialData?.id
    ? tasks.filter((t) => t.issueId === initialData.id)
    : localActions;

  useEffect(() => {
    if (initialData) {
      setFormData(initialData);
      setLocalActions([]);
    } else {
      setFormData({
        status: "1. Investigating",
        priority: 3,
        severity: 3,
        response: ISSUE_RESPONSES[0],
        desc: "",
        impact: "",
        owner: "",
        linkedRisk: "",
        responsDesc: "",
        controlOwner: "",
        progress: "",
        deadline: "",
        lessonsLearnt: "",
        projectId: activeProjectId || "",
        programmeId: activeProgrammeId || "",
      });
      setLocalActions([]);
    }
    setEditingActionId(null);
    setShowAddAction(false);
    setIsSaving(false);
    setIsSavingAction(false);
  }, [initialData, isOpen, activeProjectId, activeProgrammeId]);

  if (!isOpen) return null;

  const handleChange = (field: keyof IssueItem, value: any) => {
    if (field === "linkedRisk" && value) {
      const selectedRisk = (risks || []).find((r) => r.id === value);
      if (selectedRisk) {
        setFormData((prev) => ({
          ...prev,
          linkedRisk: value,
          desc: prev.desc || selectedRisk.title,
          impact: prev.impact || selectedRisk.mitigation,
          owner: prev.owner || selectedRisk.owner,
          category: prev.category || selectedRisk.category,
        }));
        return;
      }
    }
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleProjectChange = (projectId: string) => {
    const proj = safeProjects.find((p) => p.id === projectId);
    setFormData((prev) => ({
      ...prev,
      projectId,
      project: proj?.name || "",
      programmeId: proj?.programmeId || activeProgrammeId || "",
    }));
  };

  const handleSave = async () => {
    if (!formData.desc?.trim()) return;
    setIsSaving(true);
    try {
      const issueId = initialData?.id || generateId("ISS");
      const finalData: Partial<IssueItem> = {
        ...formData,
        desc: formData.desc?.trim(),
        owner: formData.owner?.trim() || "",
        id: issueId,
        dateUpdated: new Date().toISOString().split("T")[0],
      };

      // Persist local actions (new issue flow)
      if (!initialData && localActions.length > 0) {
        for (const action of localActions) {
          addTask({
            ...action,
            id: action.id || generateId("TSK"),
            issueId,
            projectName: formData.project || "",
          } as TaskItem);
        }
      }

      await onSave(finalData);
      onClose();
    } catch (err: any) {
      // onSave caller (RiskIssues) handles the toast — don't double-toast
      console.error("[IssueModal] save error", err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveAction = async () => {
    if (!newActionTitle.trim()) return;
    setIsSavingAction(true);
    try {
      const actionData: Partial<TaskItem> = {
        title: newActionTitle.trim(),
        owner: newActionOwner.trim() || "Unassigned",
        dueDate: newActionDeadline || format(new Date(), "yyyy-MM-dd"),
        priority: newActionPriority,
        status: "Pending",
        projectName: formData.project || "",
      };

      if (initialData?.id) {
        if (editingActionId) {
          updateTask(editingActionId, actionData);
          toast.success("Action updated.");
        } else {
          addTask({
            ...actionData,
            id: generateId("TSK"),
            issueId: initialData.id,
          } as TaskItem);
          toast.success("Action added.");
        }
      } else {
        if (editingActionId) {
          setLocalActions((prev) =>
            prev.map((a) =>
              a.id === editingActionId ? { ...a, ...actionData } : a,
            ),
          );
        } else {
          setLocalActions((prev) => [
            ...prev,
            { ...actionData, id: `LOCAL-${generateId("ACT")}` },
          ]);
        }
      }

      setNewActionTitle("");
      setNewActionOwner("");
      setNewActionDeadline("");
      setShowAddAction(false);
      setEditingActionId(null);
    } catch (err: any) {
      console.error("[IssueModal] save action error", err);
      toast.error(err?.message || "Failed to save action.");
    } finally {
      setIsSavingAction(false);
    }
  };

  const handleToggleActionComplete = async (action: Partial<TaskItem>) => {
    if (!action.id) return;
    try {
      updateTask(action.id, {
        status: action.status === "Completed" ? "Pending" : "Completed",
        completedAt:
          action.status === "Completed" ? undefined : new Date().toISOString(),
      });
    } catch (err: any) {
      console.error("[IssueModal] toggle action error", err);
      toast.error(err?.message || "Failed to update action.");
    }
  };

  const handleDeleteAction = async (actionId: string) => {
    if (initialData?.id) {
      try {
        deleteTask(actionId);
      } catch (err: any) {
        console.error("[IssueModal] delete action error", err);
        toast.error(err?.message || "Failed to delete action.");
      }
    } else {
      setLocalActions((prev) => prev.filter((a) => a.id !== actionId));
    }
  };

  const scoreLabel = (p: number, s: number) => {
    const v = (p || 1) * (s || 1);
    if (v >= 12)
      return { l: "Critical", c: "bg-red-100 text-red-800 border-red-200" };
    if (v >= 8)
      return { l: "High", c: "bg-red-50 text-red-700 border-red-100" };
    if (v >= 4)
      return { l: "Medium", c: "bg-amber-50 text-amber-700 border-amber-200" };
    return { l: "Low", c: "bg-emerald-50 text-emerald-700 border-emerald-200" };
  };

  const currP = (formData.priority as number) || 1;
  const currS = (formData.severity as number) || 1;
  const sc = scoreLabel(currP, currS);

  // Linked risk options scoped to selected project
  const linkedRiskOptions = (Array.isArray(risks) ? risks : []).filter((r) =>
    formData.projectId ? r.projectId === formData.projectId : true,
  );

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 z-50">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl max-h-[calc(100dvh-2rem)] md:max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-100 shrink-0">
          <div>
            <h2 className="text-xl font-bold text-slate-900">
              {initialData ? "Edit Issue" : "Add New Issue"}
            </h2>
            {initialData && (
              <p className="text-sm text-slate-500 mt-1">
                Ref: {initialData.id}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1 space-y-8">
          {/* Section 1: Core Details */}
          <div>
            <h3 className="text-sm font-semibold text-slate-800 uppercase tracking-wider mb-4 border-b border-slate-100 pb-2">
              Core Details
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="col-span-2">
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-sm font-medium text-slate-700">
                    Issue Description <span className="text-red-500">*</span>
                  </label>
                  <AIWriter
                    context={(() => {
                      const linkedRisk = risks?.find(
                        (r) => r.id === formData.linkedRisk,
                      );
                      if (linkedRisk) {
                        return `Describe an issue that has ACTUALLY OCCURRED as a result of this risk:\n\nRisk ID: ${linkedRisk.id}\nRisk Title: ${linkedRisk.title}\nRisk Description: ${linkedRisk.desc}\nRisk Category: ${linkedRisk.category}\nRisk Severity: ${linkedRisk.grossL * linkedRisk.grossI}\n\nFocus on: What specific problem has materialized? What went wrong? Be concrete and specific to this risk context.`;
                      }
                      return `Describe a property compliance, safety, or delivery issue that has ACTUALLY OCCURRED (not a potential risk).\n\nConsider: What specific problem materialized? Who/what was affected? When did it happen? Be factual and specific.`;
                    })()}
                    onSuggest={(val: string) => handleChange("desc", val)}
                    placeholder="e.g. what triggered this issue, who is affected, which regulation applies"
                    className="scale-90"
                  />
                </div>
                <textarea
                  value={formData.desc || ""}
                  onChange={(e) => handleChange("desc", e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 min-h-[80px]"
                  placeholder="Detailed description of the issue..."
                  required
                />
              </div>
              <div className="col-span-2">
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-sm font-medium text-slate-700">
                    Impact and Consequences
                  </label>
                  <AIWriter
                    context={(() => {
                      const linkedRisk = risks?.find(
                        (r) => r.id === formData.linkedRisk,
                      );
                      const baseContext = formData.desc
                        ? `Determine the organizational, safety, financial, and operational impacts for this issue:\n\nIssue: ${formData.desc}\n\n`
                        : `Determine the likely impacts if this issue escalates or remains unresolved.\n\n`;
                      if (linkedRisk) {
                        return `${baseContext}Original Risk Context:\nRisk: ${linkedRisk.title}\nRisk Impact: ${linkedRisk.desc}\n\nConsider: How does this realized issue affect people, budget, timeline, compliance, and reputation?`;
                      }
                      return `${baseContext}Consider: How does this issue affect people, budget, timeline, compliance, and reputation if it escalates?`;
                    })()}
                    onSuggest={(val: string) => handleChange("impact", val)}
                    placeholder="e.g. operational delays, cost overrun, reputational risk to client"
                    className="scale-90"
                  />
                </div>
                <textarea
                  value={formData.impact || ""}
                  onChange={(e) => handleChange("impact", e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 min-h-[80px]"
                  placeholder="Current impacts..."
                />
              </div>

              {/* Project — live from store, scoped to active programme */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Project
                </label>
                <select
                  value={formData.projectId || ""}
                  onChange={(e) => handleProjectChange(e.target.value)}
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
                  Linked Risk
                </label>
                <select
                  value={formData.linkedRisk || ""}
                  onChange={(e) => handleChange("linkedRisk", e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
                >
                  <option value="">None</option>
                  {linkedRiskOptions.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.id} — {r.title}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Section 2: Assessment */}
          <div>
            <h3 className="text-sm font-semibold text-slate-800 uppercase tracking-wider mb-4 border-b border-slate-100 pb-2">
              Assessment
            </h3>
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 mb-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Priority (1–5)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="5"
                    value={(formData.priority as number) || 1}
                    onChange={(e) =>
                      handleChange("priority", parseInt(e.target.value) || 1)
                    }
                    className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Severity (1–5)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="5"
                    value={(formData.severity as number) || 1}
                    onChange={(e) =>
                      handleChange("severity", parseInt(e.target.value) || 1)
                    }
                    className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div className="flex flex-col items-center justify-center pt-5">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                    Overall Score
                  </span>
                  <span
                    className={clsx(
                      "px-3 py-1 rounded text-sm font-bold border",
                      sc.c,
                    )}
                  >
                    {currP * currS} — {sc.l}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Section 3: Response & Progress */}
          <div>
            <h3 className="text-sm font-semibold text-slate-800 uppercase tracking-wider mb-4 border-b border-slate-100 pb-2">
              Response & Progress
            </h3>
            <div className="grid grid-cols-1 gap-4">
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
                    {ISSUE_RESPONSES.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Response Owner
                  </label>
                  <input
                    type="text"
                    value={formData.owner || ""}
                    onChange={(e) => handleChange("owner", e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
                    placeholder="E.g., Project Manager"
                  />
                </div>
              </div>

              {/* Resolution Actions */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h4 className="text-sm font-bold text-slate-800">
                      Resolution Actions
                    </h4>
                    <p className="text-xs text-slate-500">
                      Track specific tasks to resolve this issue
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setEditingActionId(null);
                      setNewActionTitle("");
                      setNewActionOwner("");
                      setNewActionDeadline("");
                      setNewActionPriority("Medium");
                      setShowAddAction(!showAddAction);
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded-lg text-xs font-bold transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    {showAddAction ? "Close Panel" : "Add Action"}
                  </button>
                </div>

                {showAddAction && (
                  <div className="mb-6 p-4 bg-white border border-indigo-100 rounded-xl shadow-sm space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-indigo-600 uppercase tracking-wider">
                        {editingActionId
                          ? "Edit Action"
                          : "New Resolution Action"}
                      </span>
                      <AIWriter
                        context={`Suggest a resolution action for the issue: ${formData.desc}. Current response strategy: ${formData.response}.`}
                        onSuggest={(val: string) => setNewActionTitle(val)}
                        placeholder="e.g. a short action title to resolve this issue"
                        className="scale-75"
                      />
                    </div>

                    <input
                      type="text"
                      value={newActionTitle}
                      onChange={(e) => setNewActionTitle(e.target.value)}
                      placeholder="What needs to be done?"
                      disabled={isSavingAction}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 disabled:opacity-50"
                    />

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                          Owner
                        </label>
                        <div className="relative">
                          <User className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-slate-400" />
                          <input
                            type="text"
                            value={newActionOwner}
                            onChange={(e) => setNewActionOwner(e.target.value)}
                            placeholder="Name"
                            disabled={isSavingAction}
                            className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-8 pr-3 py-1.5 text-xs focus:outline-none focus:border-indigo-500 disabled:opacity-50"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                          Deadline
                        </label>
                        <div className="relative">
                          <Calendar className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-slate-400" />
                          <input
                            type="date"
                            value={newActionDeadline}
                            onChange={(e) =>
                              setNewActionDeadline(e.target.value)
                            }
                            disabled={isSavingAction}
                            className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-8 pr-3 py-1.5 text-xs focus:outline-none focus:border-indigo-500 disabled:opacity-50"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-2">
                      <div className="flex gap-2">
                        {(["Low", "Medium", "High", "Critical"] as const).map(
                          (p) => (
                            <button
                              key={p}
                              type="button"
                              onClick={() => setNewActionPriority(p)}
                              className={clsx(
                                "px-2 py-1 rounded text-[10px] font-bold transition-all",
                                newActionPriority === p
                                  ? p === "Critical"
                                    ? "bg-red-600 text-white shadow-sm"
                                    : p === "High"
                                      ? "bg-orange-500 text-white shadow-sm"
                                      : p === "Medium"
                                        ? "bg-blue-500 text-white shadow-sm"
                                        : "bg-slate-500 text-white shadow-sm"
                                  : "bg-slate-100 text-slate-500 hover:bg-slate-200",
                              )}
                            >
                              {p}
                            </button>
                          ),
                        )}
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setShowAddAction(false);
                            setEditingActionId(null);
                          }}
                          className="px-3 py-1.5 text-xs font-bold text-slate-500 hover:bg-slate-100 rounded-lg transition-colors"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={handleSaveAction}
                          disabled={!newActionTitle.trim() || isSavingAction}
                          className="px-3 py-1.5 bg-indigo-600 text-white text-xs font-bold rounded-lg hover:bg-indigo-700 transition-colors shadow-sm disabled:opacity-50 flex items-center gap-1.5"
                        >
                          {isSavingAction ? (
                            <>
                              <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                              Saving…
                            </>
                          ) : editingActionId ? (
                            "Update Action"
                          ) : (
                            "Save Action"
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  {issueActions.length === 0 ? (
                    <div className="text-center py-8 bg-white/50 border border-dashed border-slate-200 rounded-xl">
                      <AlertCircle className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                      <p className="text-sm text-slate-400">
                        No resolution actions defined yet
                      </p>
                    </div>
                  ) : (
                    issueActions.map((action) => (
                      <div
                        key={action.id}
                        className={clsx(
                          "group flex items-center justify-between p-3 rounded-xl border transition-all",
                          action.status === "Completed"
                            ? "bg-slate-50/50 border-slate-100 opacity-75"
                            : "bg-white border-slate-200 hover:border-indigo-200 hover:shadow-sm",
                        )}
                      >
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <button
                            type="button"
                            onClick={() => handleToggleActionComplete(action)}
                            className={clsx(
                              "shrink-0 transition-colors",
                              action.status === "Completed"
                                ? "text-emerald-500"
                                : "text-slate-300 hover:text-indigo-500",
                            )}
                          >
                            {action.status === "Completed" ? (
                              <CheckCircle2 className="w-5 h-5" />
                            ) : (
                              <Circle className="w-5 h-5" />
                            )}
                          </button>
                          <div className="min-w-0">
                            <p
                              className={clsx(
                                "text-sm font-medium truncate",
                                action.status === "Completed"
                                  ? "text-slate-400 line-through"
                                  : "text-slate-700",
                              )}
                            >
                              {action.title}
                            </p>
                            <div className="flex items-center gap-3 mt-0.5">
                              <span className="text-[10px] font-bold text-slate-400 flex items-center gap-1">
                                <User className="w-2.5 h-2.5" />
                                {action.owner}
                              </span>
                              <span
                                className={clsx(
                                  "text-[10px] font-bold flex items-center gap-1",
                                  action.status === "Completed"
                                    ? "text-slate-300"
                                    : "text-slate-400",
                                )}
                              >
                                <Calendar className="w-2.5 h-2.5" />
                                {action.dueDate}
                              </span>
                              <span
                                className={clsx(
                                  "px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider",
                                  action.priority === "Critical"
                                    ? "bg-red-100 text-red-700"
                                    : action.priority === "High"
                                      ? "bg-orange-100 text-orange-700"
                                      : action.priority === "Medium"
                                        ? "bg-blue-100 text-blue-700"
                                        : "bg-slate-100 text-slate-700",
                                )}
                              >
                                {action.priority}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          {!initialData?.id && (
                            <span className="text-[8px] font-bold bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full mr-2 uppercase tracking-tighter">
                              Draft
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={() => {
                              setEditingActionId(action.id!);
                              setNewActionTitle(action.title || "");
                              setNewActionOwner(action.owner || "");
                              setNewActionDeadline(action.dueDate || "");
                              setNewActionPriority(
                                (action.priority as any) || "Medium",
                              );
                              setShowAddAction(true);
                            }}
                            className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                            title="Edit Action"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteAction(action.id!)}
                            className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                            title="Delete Action"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Response Description
                  </label>
                  <textarea
                    value={formData.responsDesc || ""}
                    onChange={(e) =>
                      handleChange("responsDesc", e.target.value)
                    }
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 min-h-[60px]"
                    placeholder="Details of the response plan..."
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Progress Update
                  </label>
                  <textarea
                    value={formData.progress || ""}
                    onChange={(e) => handleChange("progress", e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 min-h-[60px]"
                    placeholder="Current progress..."
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Control Owner
                  </label>
                  <input
                    type="text"
                    value={formData.controlOwner || ""}
                    onChange={(e) =>
                      handleChange("controlOwner", e.target.value)
                    }
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
                    placeholder=""
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Section 4: Tracking */}
          <div>
            <h3 className="text-sm font-semibold text-slate-800 uppercase tracking-wider mb-4 border-b border-slate-100 pb-2">
              Tracking
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Target Resolution Date
                </label>
                <input
                  type="date"
                  value={formData.deadline || ""}
                  onChange={(e) => handleChange("deadline", e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Status
                </label>
                <select
                  value={formData.status || "1. Investigating"}
                  onChange={(e) => handleChange("status", e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
                >
                  {ISSUE_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-span-2 mt-2">
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-sm font-medium text-slate-700">
                    Lessons Learnt (Resolution)
                  </label>
                  <AIWriter
                    context={`Summarize key lessons learned from resolving this issue: ${formData.desc}. Resolution plan was: ${formData.responsDesc}.`}
                    onSuggest={(val: string) =>
                      handleChange("lessonsLearnt", val)
                    }
                    placeholder="e.g. what process or check should have caught this earlier"
                    className="scale-90"
                  />
                </div>
                <textarea
                  value={formData.lessonsLearnt || ""}
                  onChange={(e) =>
                    handleChange("lessonsLearnt", e.target.value)
                  }
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 min-h-[60px]"
                  placeholder="What worked, what failed..."
                />
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-slate-100 bg-slate-50 rounded-b-2xl flex justify-end gap-3 shrink-0">
          <button
            onClick={onClose}
            disabled={isSaving}
            className="px-5 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-200 rounded-xl transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!formData.desc?.trim() || isSaving}
            className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm flex items-center gap-2"
          >
            {isSaving ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Saving…
              </>
            ) : (
              "Save Issue"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
