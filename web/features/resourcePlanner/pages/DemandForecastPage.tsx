import { useEffect, useMemo, useState } from "react";
import { Building2, FilterX } from "lucide-react";
import PageHeader from "../../../components/PageHeader";
import { useStore } from "../../../store/useStore";
import DemandGrid, { type GridRow } from "../components/DemandGrid";
import RpEmptyState from "../components/RpEmptyState";
import SchemeFilters, {
  applySchemeFilters,
  emptySchemeFilters,
  type SchemeFilterState,
} from "../components/SchemeFilters";
import { buildResourcePlan } from "../../../lib/resourcePlanner/compute";
import {
  COMPLEXITY_BANDS,
  ROLES,
  ROLE_LABELS,
} from "../../../lib/resourcePlanner/constants";

type View = "role" | "complexity" | "scheme";

const VIEWS: { key: View; label: string }[] = [
  { key: "role", label: "By role" },
  { key: "complexity", label: "By complexity" },
  { key: "scheme", label: "By scheme" },
];

export default function DemandForecastPage() {
  const resourceSchemes = useStore((s) => s.resourceSchemes);
  const resourceAssumptions = useStore((s) => s.resourceAssumptions);
  const loadResourcePlanner = useStore((s) => s.loadResourcePlanner);

  const [filters, setFilters] = useState<SchemeFilterState>(emptySchemeFilters);
  const [view, setView] = useState<View>("role");

  useEffect(() => {
    loadResourcePlanner();
  }, [loadResourcePlanner]);

  const filtered = useMemo(
    () => applySchemeFilters(resourceSchemes, filters),
    [resourceSchemes, filters],
  );

  const plan = useMemo(
    () => (resourceAssumptions ? buildResourcePlan(filtered, resourceAssumptions) : null),
    [filtered, resourceAssumptions],
  );

  const rows: GridRow[] = useMemo(() => {
    if (!plan) return [];
    if (view === "role") {
      const r: GridRow[] = ROLES.map((role) => ({
        key: role,
        label: ROLE_LABELS[role],
        values: plan.matrix.byRole[role],
      }));
      r.push({ key: "_total", label: "Total", values: plan.matrix.totalByQuarter, strong: true });
      return r;
    }
    if (view === "complexity") {
      const r: GridRow[] = COMPLEXITY_BANDS.map((b) => ({
        key: b,
        label: b,
        values: plan.matrix.byComplexity[b],
      }));
      r.push({ key: "_total", label: "Total", values: plan.matrix.totalByQuarter, strong: true });
      return r;
    }
    return plan.matrix.bySchemeRole.map((s) => ({
      key: `${s.schemeId}:${s.role}`,
      label: s.schemeName,
      sublabel: ROLE_LABELS[s.role],
      values: s.quarters,
    }));
  }, [plan, view]);

  return (
    <div className="space-y-6 sm:space-y-8">
      <PageHeader
        title="Demand Forecast"
        subtitle="FTE required per quarter (incl. overhead & leave uplift), by role and complexity."
        breadcrumbs={[{ label: "Resource Planner" }, { label: "Demand Forecast" }]}
      />

      {plan && (
        <div className="flex flex-wrap items-center gap-3 text-[13px]">
          <span className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-50 px-3 py-1.5 text-indigo-700">
            <span className="font-mono uppercase tracking-wide text-[11px]">Peak</span>
            <span className="font-mono tabular-nums font-semibold">
              {plan.peak.fte.toFixed(1)}
            </span>
            <span className="text-indigo-400">FTE · {plan.peak.label}</span>
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-3 py-1.5 text-slate-600">
            <span className="font-mono uppercase tracking-wide text-[11px]">Total</span>
            <span className="font-mono tabular-nums font-semibold">
              {plan.totalFte.toFixed(1)}
            </span>
            <span className="text-slate-400">FTE-quarters</span>
          </span>
          <span className="text-slate-400">
            {filtered.length} of {resourceSchemes.length} schemes
          </span>
        </div>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <SchemeFilters schemes={resourceSchemes} value={filters} onChange={setFilters} />
        <div className="inline-flex rounded-lg border border-slate-200 p-0.5">
          {VIEWS.map((v) => (
            <button
              key={v.key}
              onClick={() => setView(v.key)}
              className={`rounded-md px-3 py-1.5 text-[13px] font-medium ${
                view === v.key
                  ? "bg-indigo-600 text-white"
                  : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              {v.label}
            </button>
          ))}
        </div>
      </div>

      {!plan ? (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-sm text-slate-500">
          Loading forecast…
        </div>
      ) : rows.length === 0 ? (
        resourceSchemes.length === 0 ? (
          <RpEmptyState
            icon={Building2}
            title="No schemes yet"
            description="Add or import schemes to see the demand forecast."
            actionLabel="Go to Scheme Register"
            to="/resource-planner/schemes"
          />
        ) : (
          <RpEmptyState
            icon={FilterX}
            title="No demand to show"
            description="No schemes match the current filters, or they carry no FTE in this horizon."
            showAction={false}
          />
        )
      ) : (
        <DemandGrid axis={plan.axis} rows={rows} />
      )}
    </div>
  );
}
