import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { Save, RotateCcw, Trash2, Plus, Lock } from "lucide-react";
import PageHeader from "../../../components/PageHeader";
import { useStore } from "../../../store/useStore";
import RateCardEditor from "../components/RateCardEditor";
import {
  COMPLEXITY_BANDS,
  ROLES,
  ROLE_LABELS,
} from "../../../lib/resourcePlanner/constants";
import type {
  ComplexityBand,
  ResourceAssumptions,
  Role,
  Stage,
} from "../../../lib/resourcePlanner/types";

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));

const sectionTitle = (eyebrow: string, title: string, sub?: string) => (
  <div className="mb-3">
    <div className="font-mono uppercase tracking-wide text-[11px] font-medium text-slate-500">
      {eyebrow}
    </div>
    <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
    {sub && <p className="text-[13px] text-slate-500 mt-0.5">{sub}</p>}
  </div>
);

export default function AssumptionsPage() {
  const resourceAssumptions = useStore((s) => s.resourceAssumptions);
  const loadResourcePlanner = useStore((s) => s.loadResourcePlanner);
  const saveResourceAssumptions = useStore((s) => s.saveResourceAssumptions);
  const canManageResourcePlanner = useStore((s) => s.canManageResourcePlanner);
  const editable = canManageResourcePlanner();

  const [draft, setDraft] = useState<ResourceAssumptions | null>(null);
  const [saving, setSaving] = useState(false);
  const [newRaw, setNewRaw] = useState("");
  const [newBand, setNewBand] = useState<ComplexityBand>("Mid");

  useEffect(() => {
    loadResourcePlanner();
  }, [loadResourcePlanner]);
  useEffect(() => {
    if (resourceAssumptions && !draft) setDraft(clone(resourceAssumptions));
  }, [resourceAssumptions, draft]);

  if (!draft) {
    return (
      <div className="space-y-6 sm:space-y-8">
        <PageHeader
          title="Assumptions"
          breadcrumbs={[{ label: "Resource Planner" }, { label: "Assumptions" }]}
        />
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-sm text-slate-500">
          Loading assumptions…
        </div>
      </div>
    );
  }

  const setRate = (stage: Stage, role: Role, band: ComplexityBand, value: number) =>
    setDraft((d) => {
      if (!d) return d;
      const next = clone(d);
      next.rateCard[stage][role][band] = value;
      return next;
    });

  const setPct = (key: "overheadPct" | "leavePct", whole: number) =>
    setDraft((d) => (d ? { ...d, [key]: (whole || 0) / 100 } : d));

  const setSupply = (role: Role, v: number) =>
    setDraft((d) =>
      d ? { ...d, supplyByRole: { ...(d.supplyByRole || {}), [role]: v } } : d,
    );

  const setHorizon = (key: "startFy" | "endFy", v: number) =>
    setDraft((d) => (d ? { ...d, horizon: { ...d.horizon, [key]: v } } : d));

  const setMapBand = (mapKey: string, band: ComplexityBand) =>
    setDraft((d) => {
      if (!d) return d;
      const next = clone(d);
      next.complexityMap[mapKey] = band;
      return next;
    });
  const removeMap = (mapKey: string) =>
    setDraft((d) => {
      if (!d) return d;
      const next = clone(d);
      delete next.complexityMap[mapKey];
      return next;
    });
  const addMap = () => {
    const key = newRaw.toLowerCase().replace(/\s+/g, " ").trim();
    if (!key) return;
    setDraft((d) => {
      if (!d) return d;
      const next = clone(d);
      next.complexityMap[key] = newBand;
      return next;
    });
    setNewRaw("");
  };

  const reset = () => resourceAssumptions && setDraft(clone(resourceAssumptions));

  const save = async () => {
    if (!draft) return;
    setSaving(true);
    try {
      await saveResourceAssumptions(draft);
      toast.success("Assumptions saved");
    } catch (e: any) {
      toast.error(e?.message || "Could not save assumptions");
    } finally {
      setSaving(false);
    }
  };

  const numCls =
    "w-20 rounded-md border border-slate-200 px-2 py-1 text-center font-mono tabular-nums text-[13px] focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-200 disabled:bg-slate-50 disabled:text-slate-400";

  return (
    <div className="space-y-6 sm:space-y-8">
      <PageHeader
        title="Assumptions"
        subtitle="FTE rate card, complexity mapping, overhead/leave uplifts, capacity supply and the forecast horizon."
        breadcrumbs={[{ label: "Resource Planner" }, { label: "Assumptions" }]}
        actions={
          <div className="flex items-center gap-2">
            {!editable && (
              <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-mono uppercase tracking-wide text-slate-500">
                <Lock className="h-3 w-3" /> Read-only
              </span>
            )}
            <button
              onClick={reset}
              disabled={!editable || saving}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
            >
              <RotateCcw className="h-4 w-4" /> Reset
            </button>
            <button
              onClick={save}
              disabled={!editable || saving}
              className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              <Save className="h-4 w-4" /> {saving ? "Saving…" : "Save changes"}
            </button>
          </div>
        }
      />

      {/* Rate card */}
      <section>
        {sectionTitle(
          "Rate card",
          "FTE per stage × role × complexity",
          "Strategic Lead & Defects PM start at 0 — set their values to include them in demand.",
        )}
        <RateCardEditor rateCard={draft.rateCard} editable={editable} onChange={setRate} />
      </section>

      {/* Uplifts + horizon */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          {sectionTitle(
            "Uplifts",
            "Overhead & annual leave",
            "Applied as a flat % uplift on computed demand.",
          )}
          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-2 text-sm text-slate-700">
              Programme overhead
              <input
                type="number"
                min={0}
                step={1}
                value={Math.round(draft.overheadPct * 100)}
                disabled={!editable}
                onChange={(e) => setPct("overheadPct", parseFloat(e.target.value))}
                className={numCls}
              />
              %
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              Annual leave
              <input
                type="number"
                min={0}
                step={1}
                value={Math.round(draft.leavePct * 100)}
                disabled={!editable}
                onChange={(e) => setPct("leavePct", parseFloat(e.target.value))}
                className={numCls}
              />
              %
            </label>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4">
          {sectionTitle(
            "Horizon",
            "Forecast window (financial years)",
            "Fiscal year starts April. Leave wide to cover all scheme dates.",
          )}
          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-2 text-sm text-slate-700">
              Start FY
              <input
                type="number"
                step={1}
                value={draft.horizon.startFy}
                disabled={!editable}
                onChange={(e) => setHorizon("startFy", parseInt(e.target.value, 10) || 0)}
                className={numCls}
              />
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              End FY
              <input
                type="number"
                step={1}
                value={draft.horizon.endFy}
                disabled={!editable}
                onChange={(e) => setHorizon("endFy", parseInt(e.target.value, 10) || 0)}
                className={numCls}
              />
            </label>
          </div>
        </div>
      </section>

      {/* Capacity supply */}
      <section className="rounded-xl border border-slate-200 bg-white p-4">
        {sectionTitle(
          "Capacity",
          "Available supply per role (FTE)",
          "Compared against demand to flag shortfall/surplus per quarter.",
        )}
        <div className="flex flex-wrap gap-4">
          {ROLES.map((role) => (
            <label key={role} className="flex items-center gap-2 text-sm text-slate-700">
              {ROLE_LABELS[role]}
              <input
                type="number"
                min={0}
                step={0.5}
                value={draft.supplyByRole?.[role] ?? 0}
                disabled={!editable}
                onChange={(e) => setSupply(role, parseFloat(e.target.value) || 0)}
                className={numCls}
              />
            </label>
          ))}
        </div>
      </section>

      {/* Complexity mapping */}
      <section className="rounded-xl border border-slate-200 bg-white p-4">
        {sectionTitle(
          "Complexity mapping",
          "Raw labels → canonical bands",
          "Unmapped labels contribute 0 FTE.",
        )}
        <div className="space-y-2">
          {Object.entries(draft.complexityMap).map(([key, band]) => (
            <div key={key} className="flex items-center gap-2">
              <span className="flex-1 truncate rounded-md bg-slate-50 px-2.5 py-1.5 text-[13px] text-slate-700">
                {key}
              </span>
              <select
                value={band}
                disabled={!editable}
                onChange={(e) => setMapBand(key, e.target.value as ComplexityBand)}
                className="rounded-md border border-slate-200 px-2 py-1.5 text-[13px] disabled:bg-slate-50 disabled:text-slate-400"
              >
                {COMPLEXITY_BANDS.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
              {editable && (
                <button
                  onClick={() => removeMap(key)}
                  className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                  aria-label={`Remove ${key}`}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
          ))}
          {editable && (
            <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
              <input
                type="text"
                value={newRaw}
                placeholder="New raw label (e.g. infill)"
                onChange={(e) => setNewRaw(e.target.value)}
                className="flex-1 rounded-md border border-slate-200 px-2.5 py-1.5 text-[13px] focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-200"
              />
              <select
                value={newBand}
                onChange={(e) => setNewBand(e.target.value as ComplexityBand)}
                className="rounded-md border border-slate-200 px-2 py-1.5 text-[13px]"
              >
                {COMPLEXITY_BANDS.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
              <button
                onClick={addMap}
                className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2.5 py-1.5 text-[13px] font-medium text-slate-600 hover:bg-slate-50"
              >
                <Plus className="h-4 w-4" /> Add
              </button>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
