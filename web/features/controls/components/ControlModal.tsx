import { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import { useStore } from "../../../store/useStore";
import { AIWriter } from "../../../components/AIWriter";
import { generateId } from "../../../lib/utils";
import { DOMAINS } from "../../../data/complianceData";
import {
  CONTROL_STATUSES,
  type Control,
  type ControlStatus,
} from "../types";

interface Props {
  control: Control | null;
  onClose: () => void;
  onSave: (control: Control) => Promise<unknown>;
}

const labelCls = "block text-sm font-medium text-slate-700 mb-1";
const inputCls =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none disabled:bg-slate-50 disabled:text-slate-400";

export default function ControlModal({ control, onClose, onSave }: Props) {
  const projects = useStore((s) => s.projects);
  const customRegulations = useStore((s) => s.customRegulations);
  const risks = useStore((s) => s.risks);

  const [form, setForm] = useState<Control>(() =>
    control
      ? { ...control }
      : {
          id: generateId("ctrl"),
          title: "",
          reference: "",
          description: "",
          owner: "",
          status: "Not Tested",
          complianceGroup: "",
          projectId: null,
          programmeId: null,
          projectName: null,
          linkedRegulationIds: [],
          linkedRiskIds: [],
          evidenceIds: [],
          lastReviewDate: null,
        },
  );
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Escape closes the modal (unless a save is in flight).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isSaving) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isSaving, onClose]);

  const set = <K extends keyof Control>(key: K, value: Control[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const selectedRegs = form.linkedRegulationIds ?? [];
  const selectedRisks = form.linkedRiskIds ?? [];

  const toggle = (key: "linkedRegulationIds" | "linkedRiskIds", id: string) =>
    setForm((f) => {
      const cur = new Set(f[key] ?? []);
      cur.has(id) ? cur.delete(id) : cur.add(id);
      return { ...f, [key]: Array.from(cur) };
    });

  // Risks scoped to the tagged project (if any), else all — keeps the linker focused.
  const riskCandidates = useMemo(() => {
    const list = Array.isArray(risks) ? risks : [];
    if (form.projectId) return list.filter((r) => r.projectId === form.projectId);
    return list;
  }, [risks, form.projectId]);

  const handleProject = (projectId: string) => {
    if (!projectId) {
      set("projectId", null);
      set("projectName", null);
      return;
    }
    const p = projects.find((x) => x.id === projectId);
    setForm((f) => ({
      ...f,
      projectId,
      projectName: p?.name || null,
    }));
  };

  const handleSave = async () => {
    if (!form.title.trim()) {
      setError("A control title is required.");
      return;
    }
    setError(null);
    setIsSaving(true);
    try {
      await onSave({ ...form, title: form.title.trim() });
      onClose();
    } catch (e: any) {
      setError(e?.message || "Could not save control.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 z-50">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="ctrl-modal-title"
        className="bg-white rounded-lg shadow-xl w-full max-w-3xl h-full max-h-[calc(100dvh-1rem)] sm:max-h-[90vh] flex flex-col overflow-hidden"
      >
        <div className="flex items-start justify-between gap-3 p-4 sm:p-6 border-b border-slate-100 shrink-0">
          <div className="min-w-0">
            <h2
              id="ctrl-modal-title"
              className="text-base sm:text-xl font-semibold text-slate-900 tracking-tight"
            >
              {control ? "Edit Control" : "New Control"}
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              A control is a measure that mitigates risk and evidences compliance.
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={isSaving}
            className="p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 disabled:opacity-50"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 min-h-0">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              <label className={labelCls} htmlFor="ctrl-title">
                Title <span className="text-red-500">*</span>
              </label>
              <input
                id="ctrl-title"
                required
                disabled={isSaving}
                className={inputCls}
                value={form.title}
                onChange={(e) => set("title", e.target.value)}
                placeholder="e.g. Monthly fire-door inspection"
              />
            </div>
            <div>
              <label className={labelCls} htmlFor="ctrl-ref">
                Reference
              </label>
              <input
                id="ctrl-ref"
                disabled={isSaving}
                className={inputCls}
                value={form.reference ?? ""}
                onChange={(e) => set("reference", e.target.value)}
                placeholder="CTRL-001"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className={labelCls} htmlFor="ctrl-status">
                Status
              </label>
              <select
                id="ctrl-status"
                disabled={isSaving}
                className={inputCls}
                value={form.status}
                onChange={(e) => set("status", e.target.value as ControlStatus)}
              >
                {CONTROL_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls} htmlFor="ctrl-group">
                Compliance group
              </label>
              <select
                id="ctrl-group"
                disabled={isSaving}
                className={inputCls}
                value={form.complianceGroup ?? ""}
                onChange={(e) => set("complianceGroup", e.target.value)}
              >
                <option value="">— Unclassified —</option>
                {DOMAINS.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls} htmlFor="ctrl-owner">
                Owner
              </label>
              <input
                id="ctrl-owner"
                disabled={isSaving}
                className={inputCls}
                value={form.owner ?? ""}
                onChange={(e) => set("owner", e.target.value)}
                placeholder="Responsible person"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={labelCls} htmlFor="ctrl-project">
                Project scope
              </label>
              <select
                id="ctrl-project"
                disabled={isSaving}
                className={inputCls}
                value={form.projectId ?? ""}
                onChange={(e) => handleProject(e.target.value)}
              >
                <option value="">— Organisation-wide —</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name || p.id}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls} htmlFor="ctrl-review">
                Last reviewed
              </label>
              <input
                id="ctrl-review"
                type="date"
                disabled={isSaving}
                className={inputCls}
                value={(form.lastReviewDate ?? "").slice(0, 10)}
                onChange={(e) => set("lastReviewDate", e.target.value || null)}
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <label className={labelCls} htmlFor="ctrl-desc">
                Description
              </label>
              <AIWriter
                context={`Write a clear, professional description of a compliance/risk control. ONLY return the description text, no preamble. Control: "${form.title || "Untitled"}" (status: ${form.status}). Describe what the control does and how it is operated.`}
                onSuggest={(val) => set("description", val)}
                placeholder="e.g. what the control does and how it is operated"
                className="scale-90"
              />
            </div>
            <textarea
              id="ctrl-desc"
              disabled={isSaving}
              className={`${inputCls} min-h-22`}
              value={form.description ?? ""}
              onChange={(e) => set("description", e.target.value)}
              placeholder="What the control does and how it is operated."
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <fieldset disabled={isSaving} className="disabled:opacity-60">
              <legend className={labelCls}>
                Linked regulations{" "}
                {selectedRegs.length > 0 && (
                  <span className="text-slate-400">({selectedRegs.length})</span>
                )}
              </legend>
              <div className="max-h-44 overflow-y-auto rounded-lg border border-slate-200 divide-y divide-slate-100">
                {customRegulations.length === 0 ? (
                  <p className="px-3 py-3 text-sm text-slate-400">
                    No regulations in the library yet.
                  </p>
                ) : (
                  customRegulations.map((r) => (
                    <label
                      key={r.id}
                      className="flex items-start gap-2 px-3 py-2 text-sm hover:bg-slate-50 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        className="mt-0.5"
                        checked={selectedRegs.includes(r.id!)}
                        onChange={() => toggle("linkedRegulationIds", r.id!)}
                      />
                      <span className="text-slate-700">{r.name}</span>
                    </label>
                  ))
                )}
              </div>
            </fieldset>

            <fieldset disabled={isSaving} className="disabled:opacity-60">
              <legend className={labelCls}>
                Linked risks{" "}
                {selectedRisks.length > 0 && (
                  <span className="text-slate-400">({selectedRisks.length})</span>
                )}
              </legend>
              <div className="max-h-44 overflow-y-auto rounded-lg border border-slate-200 divide-y divide-slate-100">
                {riskCandidates.length === 0 ? (
                  <p className="px-3 py-3 text-sm text-slate-400">
                    {form.projectId
                      ? "No risks on the selected project."
                      : "No risks available."}
                  </p>
                ) : (
                  riskCandidates.map((r) => (
                    <label
                      key={r.id}
                      className="flex items-start gap-2 px-3 py-2 text-sm hover:bg-slate-50 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        className="mt-0.5"
                        checked={selectedRisks.includes(r.id)}
                        onChange={() => toggle("linkedRiskIds", r.id)}
                      />
                      <span className="text-slate-700">{r.title}</span>
                    </label>
                  ))
                )}
              </div>
            </fieldset>
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </p>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 p-4 sm:p-6 border-t border-slate-100 shrink-0">
          <button
            onClick={onClose}
            disabled={isSaving}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {isSaving ? "Saving…" : "Save control"}
          </button>
        </div>
      </div>
    </div>
  );
}
