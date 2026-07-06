import { useState } from "react";
import { X } from "lucide-react";
import { useStore } from "../../../store/useStore";
import { generateId } from "../../../lib/utils";
import { COMPLEXITY_BANDS } from "../../../lib/resourcePlanner/constants";
import type { ComplexityBand, ResourceScheme } from "../../../lib/resourcePlanner/types";

interface Props {
  scheme: ResourceScheme | null; // null = create
  onClose: () => void;
  onSave: (scheme: ResourceScheme) => Promise<void>;
}

const d10 = (v?: string | null) => (v ? String(v).slice(0, 10) : "");
const numOrUndef = (v: string) => (v === "" ? undefined : Number(v));

const inputCls =
  "w-full rounded-md border border-slate-200 px-2.5 py-1.5 text-sm focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-200";
const labelCls = "block text-[13px] font-medium text-slate-600 mb-1";

// Module-scope so it isn't re-created on every render (which would remount the
// inputs and drop focus after each keystroke).
function Field({
  label,
  children,
  full,
}: {
  label: string;
  children: React.ReactNode;
  full?: boolean;
}) {
  return (
    <div className={full ? "md:col-span-2" : "col-span-1"}>
      <label className={labelCls}>{label}</label>
      {children}
    </div>
  );
}

export default function SchemeModal({ scheme, onClose, onSave }: Props) {
  const projects = useStore((s) => s.projects);
  const projectList = Array.isArray(projects) ? projects : [];
  const [form, setForm] = useState<ResourceScheme>(() => ({
    id: scheme?.id || generateId("rp"),
    name: scheme?.name || "",
    projectId: scheme?.projectId ?? null,
    status: scheme?.status || "",
    programme: scheme?.programme || "",
    batch: scheme?.batch || "",
    deliveryRoute: scheme?.deliveryRoute || "",
    complexity: scheme?.complexity,
    complexityRaw: scheme?.complexityRaw || "",
    councilHomes: scheme?.councilHomes,
    intermediateHomes: scheme?.intermediateHomes,
    privateHomes: scheme?.privateHomes,
    sosDate: d10(scheme?.sosDate),
    handoverDate: d10(scheme?.handoverDate),
    eodDate: d10(scheme?.eodDate),
    planningSubmitted: d10(scheme?.planningSubmitted),
    planningAchieved: d10(scheme?.planningAchieved),
    strategicLead: scheme?.strategicLead || "",
    seniorPM: scheme?.seniorPM || "",
    projectManager: scheme?.projectManager || "",
    assistantPM: scheme?.assistantPM || "",
    defectsPM: scheme?.defectsPM || "",
    projectCode: scheme?.projectCode || "",
    notes: scheme?.notes || "",
  }));
  const [saving, setSaving] = useState(false);

  const set = (k: keyof ResourceScheme, v: any) => setForm((f) => ({ ...f, [k]: v }));

  const homes =
    (Number(form.councilHomes) || 0) +
    (Number(form.intermediateHomes) || 0) +
    (Number(form.privateHomes) || 0);

  const submit = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      await onSave({
        ...form,
        name: form.name.trim(),
        complexity: form.complexity || undefined,
        allHomes: homes,
        // Empty date strings → null so the engine treats them as missing.
        sosDate: form.sosDate || null,
        handoverDate: form.handoverDate || null,
        eodDate: form.eodDate || null,
        planningSubmitted: form.planningSubmitted || null,
        planningAchieved: form.planningAchieved || null,
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/40 p-4 sm:p-8"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-2xl rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <h2 className="text-base font-semibold text-slate-900">
            {scheme ? "Edit scheme" : "New scheme"}
          </h2>
          <button
            onClick={onClose}
            className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="max-h-[70vh] overflow-y-auto px-5 py-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Field label="Scheme name *" full>
              <input
                className={inputCls}
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
                placeholder="e.g. Aylesbury Phase 2c"
              />
            </Field>

            <Field label="Complexity">
              <select
                className={inputCls}
                value={form.complexity || ""}
                onChange={(e) =>
                  set("complexity", (e.target.value || undefined) as ComplexityBand | undefined)
                }
              >
                <option value="">— (0 FTE until set)</option>
                {COMPLEXITY_BANDS.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Status / stage">
              <input
                className={inputCls}
                value={form.status}
                onChange={(e) => set("status", e.target.value)}
                placeholder="e.g. On site"
              />
            </Field>

            <Field label="Programme">
              <input
                className={inputCls}
                value={form.programme}
                onChange={(e) => set("programme", e.target.value)}
              />
            </Field>
            <Field label="Batch">
              <input
                className={inputCls}
                value={form.batch}
                onChange={(e) => set("batch", e.target.value)}
              />
            </Field>

            <Field label="Delivery route">
              <input
                className={inputCls}
                value={form.deliveryRoute}
                onChange={(e) => set("deliveryRoute", e.target.value)}
              />
            </Field>
            <Field label="SC project code">
              <input
                className={inputCls}
                value={form.projectCode}
                onChange={(e) => set("projectCode", e.target.value)}
              />
            </Field>
            <Field label="Project" full>
              <select
                className={inputCls}
                value={form.projectId || ""}
                onChange={(e) => set("projectId", e.target.value || null)}
              >
                <option value="">— Unassigned (portfolio only)</option>
                {projectList.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Council homes">
              <input
                type="number"
                min={0}
                className={inputCls}
                value={form.councilHomes ?? ""}
                onChange={(e) => set("councilHomes", numOrUndef(e.target.value))}
              />
            </Field>
            <Field label="Intermediate homes">
              <input
                type="number"
                min={0}
                className={inputCls}
                value={form.intermediateHomes ?? ""}
                onChange={(e) => set("intermediateHomes", numOrUndef(e.target.value))}
              />
            </Field>
            <Field label="Private homes">
              <input
                type="number"
                min={0}
                className={inputCls}
                value={form.privateHomes ?? ""}
                onChange={(e) => set("privateHomes", numOrUndef(e.target.value))}
              />
            </Field>
            <Field label="All homes (derived)">
              <input
                disabled
                className={`${inputCls} bg-slate-50 font-mono tabular-nums text-slate-500`}
                value={homes}
              />
            </Field>

            <div className="md:col-span-2 mt-1 mb-0.5 font-mono uppercase tracking-wide text-[11px] font-medium text-slate-500">
              Key dates
            </div>
            <Field label="Start on Site (SoS)">
              <input
                type="date"
                className={inputCls}
                value={form.sosDate || ""}
                onChange={(e) => set("sosDate", e.target.value)}
              />
            </Field>
            <Field label="Handover">
              <input
                type="date"
                className={inputCls}
                value={form.handoverDate || ""}
                onChange={(e) => set("handoverDate", e.target.value)}
              />
            </Field>
            <Field label="End of Defects (EOD)">
              <input
                type="date"
                className={inputCls}
                value={form.eodDate || ""}
                onChange={(e) => set("eodDate", e.target.value)}
              />
            </Field>
            <Field label="Planning submitted (optional)">
              <input
                type="date"
                className={inputCls}
                value={form.planningSubmitted || ""}
                onChange={(e) => set("planningSubmitted", e.target.value)}
              />
            </Field>
            <Field label="Planning achieved (optional)">
              <input
                type="date"
                className={inputCls}
                value={form.planningAchieved || ""}
                onChange={(e) => set("planningAchieved", e.target.value)}
              />
            </Field>

            <div className="md:col-span-2 mt-1 mb-0.5 font-mono uppercase tracking-wide text-[11px] font-medium text-slate-500">
              Assignments (informational)
            </div>
            <Field label="Strategic Lead">
              <input
                className={inputCls}
                value={form.strategicLead}
                onChange={(e) => set("strategicLead", e.target.value)}
              />
            </Field>
            <Field label="Senior PM">
              <input
                className={inputCls}
                value={form.seniorPM}
                onChange={(e) => set("seniorPM", e.target.value)}
              />
            </Field>
            <Field label="Project Manager">
              <input
                className={inputCls}
                value={form.projectManager}
                onChange={(e) => set("projectManager", e.target.value)}
              />
            </Field>
            <Field label="Assistant PM">
              <input
                className={inputCls}
                value={form.assistantPM}
                onChange={(e) => set("assistantPM", e.target.value)}
              />
            </Field>
            <Field label="Defects PM">
              <input
                className={inputCls}
                value={form.defectsPM}
                onChange={(e) => set("defectsPM", e.target.value)}
              />
            </Field>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-slate-100 px-5 py-4">
          <button
            onClick={onClose}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={!form.name.trim() || saving}
            className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {saving ? "Saving…" : scheme ? "Save changes" : "Create scheme"}
          </button>
        </div>
      </div>
    </div>
  );
}
