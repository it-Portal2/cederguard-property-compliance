import { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import { useStore } from "../../../store/useStore";
import { AIWriter } from "../../../components/AIWriter";
import { generateId } from "../../../lib/utils";
import { DOMAINS } from "../../../data/complianceData";
import {
  INCIDENT_STATUSES,
  INCIDENT_SEVERITIES,
  INCIDENT_TYPES,
  type Incident,
  type IncidentSeverity,
  type IncidentStatus,
} from "../types";

interface Props {
  incident: Incident | null;
  canClose: boolean;
  onClose: () => void;
  onSave: (incident: Incident) => Promise<unknown>;
}

const labelCls = "block text-sm font-medium text-slate-700 mb-1";
const inputCls =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none disabled:bg-slate-50 disabled:text-slate-400";

export default function IncidentModal({
  incident,
  canClose,
  onClose,
  onSave,
}: Props) {
  const projects = useStore((s) => s.projects);
  const risks = useStore((s) => s.risks);
  const controls = useStore((s) => s.controls);
  const loadControls = useStore((s) => s.loadControls);

  useEffect(() => {
    loadControls();
  }, [loadControls]);

  const [form, setForm] = useState<Incident>(() =>
    incident
      ? { ...incident }
      : {
          id: generateId("inc"),
          title: "",
          type: "Other",
          occurredAt: null,
          location: "",
          projectId: null,
          programmeId: null,
          projectName: null,
          severity: "Low",
          immediateImpact: "",
          residentImpact: "",
          regulatoryRelevance: "",
          complianceGroup: "",
          owner: "",
          rootCause: "",
          linkedRiskIds: [],
          linkedControlIds: [],
          actionsTaken: "",
          escalationRoute: "",
          status: "Open",
          lessonsLearned: "",
          evidenceIds: [],
        },
  );
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isSaving) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isSaving, onClose]);

  const set = <K extends keyof Incident>(key: K, value: Incident[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const selectedRisks = form.linkedRiskIds ?? [];
  const selectedControls = form.linkedControlIds ?? [];

  const toggle = (key: "linkedRiskIds" | "linkedControlIds", id: string) =>
    setForm((f) => {
      const cur = new Set(f[key] ?? []);
      cur.has(id) ? cur.delete(id) : cur.add(id);
      return { ...f, [key]: Array.from(cur) };
    });

  const riskCandidates = useMemo(() => {
    const list = Array.isArray(risks) ? risks : [];
    if (form.projectId) return list.filter((r) => r.projectId === form.projectId);
    return list;
  }, [risks, form.projectId]);

  // 'Closed' is a PM+ action — hide it from non-PM users unless already closed.
  const statusOptions = INCIDENT_STATUSES.filter(
    (s) => s !== "Closed" || canClose || incident?.status === "Closed",
  );

  const handleProject = (projectId: string) => {
    if (!projectId) {
      set("projectId", null);
      set("projectName", null);
      return;
    }
    const p = projects.find((x) => x.id === projectId);
    setForm((f) => ({ ...f, projectId, projectName: p?.name || null }));
  };

  const handleSave = async () => {
    if (!form.title.trim()) {
      setError("An incident title is required.");
      return;
    }
    setError(null);
    setIsSaving(true);
    try {
      await onSave({ ...form, title: form.title.trim() });
      onClose();
    } catch (e: any) {
      setError(e?.message || "Could not save incident.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 z-50">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="inc-modal-title"
        className="bg-white rounded-lg shadow-xl w-full max-w-4xl h-full max-h-[calc(100dvh-1rem)] sm:max-h-[90vh] flex flex-col overflow-hidden"
      >
        <div className="flex items-start justify-between gap-3 p-4 sm:p-6 border-b border-slate-100 shrink-0">
          <div className="min-w-0">
            <h2
              id="inc-modal-title"
              className="text-base sm:text-xl font-semibold text-slate-900 tracking-tight"
            >
              {incident ? "Edit Incident" : "Log Incident"}
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              A formal, regulator-grade record. Use the Issues log for routine
              delivery problems.
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
          <div>
            <label className={labelCls} htmlFor="inc-title">
              Title <span className="text-red-500">*</span>
            </label>
            <input
              id="inc-title"
              required
              disabled={isSaving}
              className={inputCls}
              value={form.title}
              onChange={(e) => set("title", e.target.value)}
              placeholder="Short summary of what happened"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className={labelCls} htmlFor="inc-type">
                Type
              </label>
              <select
                id="inc-type"
                disabled={isSaving}
                className={inputCls}
                value={form.type}
                onChange={(e) => set("type", e.target.value)}
              >
                {INCIDENT_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls} htmlFor="inc-severity">
                Severity
              </label>
              <select
                id="inc-severity"
                disabled={isSaving}
                className={inputCls}
                value={form.severity}
                onChange={(e) =>
                  set("severity", e.target.value as IncidentSeverity)
                }
              >
                {INCIDENT_SEVERITIES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls} htmlFor="inc-occurred">
                Occurred at
              </label>
              <input
                id="inc-occurred"
                type="datetime-local"
                disabled={isSaving}
                className={inputCls}
                value={(form.occurredAt ?? "").slice(0, 16)}
                onChange={(e) => set("occurredAt", e.target.value || null)}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className={labelCls} htmlFor="inc-project">
                Project
              </label>
              <select
                id="inc-project"
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
              <label className={labelCls} htmlFor="inc-location">
                Location
              </label>
              <input
                id="inc-location"
                disabled={isSaving}
                className={inputCls}
                value={form.location ?? ""}
                onChange={(e) => set("location", e.target.value)}
                placeholder="Where it happened"
              />
            </div>
            <div>
              <label className={labelCls} htmlFor="inc-owner">
                Owner
              </label>
              <input
                id="inc-owner"
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
              <label className={labelCls} htmlFor="inc-group">
                Compliance group
              </label>
              <select
                id="inc-group"
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
              <label className={labelCls} htmlFor="inc-status">
                Status
              </label>
              <select
                id="inc-status"
                disabled={isSaving}
                className={inputCls}
                value={form.status}
                onChange={(e) => set("status", e.target.value as IncidentStatus)}
              >
                {statusOptions.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              {!canClose && (
                <p className="text-[11px] text-slate-400 mt-1">
                  Closing an incident requires a PM or above.
                </p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={labelCls} htmlFor="inc-immediate">
                Immediate impact
              </label>
              <textarea
                id="inc-immediate"
                disabled={isSaving}
                className={`${inputCls} min-h-20`}
                value={form.immediateImpact ?? ""}
                onChange={(e) => set("immediateImpact", e.target.value)}
              />
            </div>
            <div>
              <label className={labelCls} htmlFor="inc-resident">
                Resident / customer impact
              </label>
              <textarea
                id="inc-resident"
                disabled={isSaving}
                className={`${inputCls} min-h-20`}
                value={form.residentImpact ?? ""}
                onChange={(e) => set("residentImpact", e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className={labelCls} htmlFor="inc-reg">
              Regulatory relevance
            </label>
            <textarea
              id="inc-reg"
              disabled={isSaving}
              className={`${inputCls} min-h-16`}
              value={form.regulatoryRelevance ?? ""}
              onChange={(e) => set("regulatoryRelevance", e.target.value)}
              placeholder="Which framework / body this touches, and any reporting obligation"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <label className={labelCls} htmlFor="inc-rootcause">
                  Root cause
                </label>
                <AIWriter
                  context={`Write a concise, professional root-cause analysis for this incident. ONLY return the root-cause text, no preamble. Incident: "${form.title || "Untitled"}" (type: ${form.type}, severity: ${form.severity}). Immediate impact: ${form.immediateImpact || "not specified"}. Actions taken: ${form.actionsTaken || "not specified"}.`}
                  onSuggest={(val) => set("rootCause", val)}
                  placeholder="e.g. the underlying cause, not just the symptom"
                  className="scale-90"
                />
              </div>
              <textarea
                id="inc-rootcause"
                disabled={isSaving}
                className={`${inputCls} min-h-20`}
                value={form.rootCause ?? ""}
                onChange={(e) => set("rootCause", e.target.value)}
              />
            </div>
            <div>
              <label className={labelCls} htmlFor="inc-actions">
                Actions taken
              </label>
              <textarea
                id="inc-actions"
                disabled={isSaving}
                className={`${inputCls} min-h-20`}
                value={form.actionsTaken ?? ""}
                onChange={(e) => set("actionsTaken", e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={labelCls} htmlFor="inc-escalation">
                Escalation route
              </label>
              <input
                id="inc-escalation"
                disabled={isSaving}
                className={inputCls}
                value={form.escalationRoute ?? ""}
                onChange={(e) => set("escalationRoute", e.target.value)}
                placeholder="Who it was escalated to"
              />
            </div>
            <div>
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <label className={labelCls} htmlFor="inc-lessons">
                  Lessons learned
                </label>
                <AIWriter
                  context={`Write concise lessons learned from this incident to help prevent recurrence. ONLY return the lessons text, no preamble. Incident: "${form.title || "Untitled"}" (type: ${form.type}, severity: ${form.severity}). Root cause: ${form.rootCause || "not specified"}. Actions taken: ${form.actionsTaken || "not specified"}.`}
                  onSuggest={(val) => set("lessonsLearned", val)}
                  placeholder="e.g. what to change so this doesn't happen again"
                  className="scale-90"
                />
              </div>
              <textarea
                id="inc-lessons"
                disabled={isSaving}
                className={`${inputCls} min-h-16`}
                value={form.lessonsLearned ?? ""}
                onChange={(e) => set("lessonsLearned", e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <fieldset disabled={isSaving} className="disabled:opacity-60">
              <legend className={labelCls}>
                Linked risks{" "}
                {selectedRisks.length > 0 && (
                  <span className="text-slate-400">({selectedRisks.length})</span>
                )}
              </legend>
              <div className="max-h-40 overflow-y-auto rounded-lg border border-slate-200 divide-y divide-slate-100">
                {riskCandidates.length === 0 ? (
                  <p className="px-3 py-3 text-sm text-slate-400">
                    No risks available.
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

            <fieldset disabled={isSaving} className="disabled:opacity-60">
              <legend className={labelCls}>
                Linked controls{" "}
                {selectedControls.length > 0 && (
                  <span className="text-slate-400">
                    ({selectedControls.length})
                  </span>
                )}
              </legend>
              <div className="max-h-40 overflow-y-auto rounded-lg border border-slate-200 divide-y divide-slate-100">
                {controls.length === 0 ? (
                  <p className="px-3 py-3 text-sm text-slate-400">
                    No controls in the library yet.
                  </p>
                ) : (
                  controls.map((c) => (
                    <label
                      key={c.id}
                      className="flex items-start gap-2 px-3 py-2 text-sm hover:bg-slate-50 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        className="mt-0.5"
                        checked={selectedControls.includes(c.id)}
                        onChange={() => toggle("linkedControlIds", c.id)}
                      />
                      <span className="text-slate-700">{c.title}</span>
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
            {isSaving ? "Saving…" : "Save incident"}
          </button>
        </div>
      </div>
    </div>
  );
}
