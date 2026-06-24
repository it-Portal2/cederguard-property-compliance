import { useEffect, useMemo, useState } from "react";
import { Building2, FilterX } from "lucide-react";
import PageHeader from "../../../components/PageHeader";
import { useStore } from "../../../store/useStore";
import DemandGrid, { type GridRow, type GridUnit } from "../components/DemandGrid";
import FteExplainer from "../components/FteExplainer";
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
import type { Role } from "../../../lib/resourcePlanner/types";

type View = "role" | "complexity" | "scheme";

const VIEWS: { key: View; label: string }[] = [
  { key: "role", label: "By role" },
  { key: "complexity", label: "By complexity" },
  { key: "scheme", label: "By scheme" },
];

const UNITS: { key: GridUnit; label: string }[] = [
  { key: "fte", label: "FTE" },
  { key: "gbp", label: "£" },
  { key: "people", label: "People" },
];

export default function DemandForecastPage() {
  const resourceSchemes = useStore((s) => s.resourceSchemes);
  const resourceAssumptions = useStore((s) => s.resourceAssumptions);
  const loadResourcePlanner = useStore((s) => s.loadResourcePlanner);

  const [filters, setFilters] = useState<SchemeFilterState>(emptySchemeFilters);
  const [view, setView] = useState<View>("role");
  const [unit, setUnit] = useState<GridUnit>("fte");

  const wd = resourceAssumptions?.workingDaysPerQuarter ?? 65;
  const rateOf = (role: Role) =>
    resourceAssumptions?.dayRateByRole?.[role] ?? resourceAssumptions?.dayRate ?? 250;

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
      const inPost = resourceAssumptions?.inPostByRoleQuarter || {};
      const hasInPost = ROLES.some(
        (role) => inPost[role] && Object.values(inPost[role]!).some((v) => v),
      );
      const r: GridRow[] = [];
      const totalActual = plan.axis.map(() => 0);
      const totalActualCost = plan.axis.map(() => 0);
      ROLES.forEach((role) => {
        const demand = plan.matrix.byRole[role];
        const demandCost = plan.cost.byRole[role];
        r.push({
          key: role,
          label: ROLE_LABELS[role],
          sublabel: hasInPost ? "Demand" : undefined,
          values: demand,
          costValues: demandCost,
        });
        if (hasInPost) {
          const actual = plan.axis.map((q) => inPost[role]?.[q.index] ?? 0);
          const actualCost = actual.map((v) => v * wd * rateOf(role));
          actual.forEach((v, i) => (totalActual[i] += v));
          actualCost.forEach((v, i) => (totalActualCost[i] += v));
          r.push({
            key: `${role}_actual`,
            label: ROLE_LABELS[role],
            sublabel: "Actual",
            values: actual,
            costValues: actualCost,
          });
          r.push({
            key: `${role}_var`,
            label: ROLE_LABELS[role],
            sublabel: "Variance",
            values: actual.map((v, i) => v - demand[i]),
            costValues: actualCost.map((v, i) => v - demandCost[i]),
          });
        }
      });
      r.push({
        key: "_total",
        label: "Total",
        sublabel: hasInPost ? "Demand" : undefined,
        values: plan.matrix.totalByQuarter,
        costValues: plan.cost.totalByQuarter,
        strong: true,
      });
      if (hasInPost) {
        r.push({
          key: "_total_actual",
          label: "Total",
          sublabel: "Actual",
          values: totalActual,
          costValues: totalActualCost,
          strong: true,
        });
        r.push({
          key: "_total_var",
          label: "Total",
          sublabel: "Variance",
          values: totalActual.map((v, i) => v - plan.matrix.totalByQuarter[i]),
          costValues: totalActualCost.map((v, i) => v - plan.cost.totalByQuarter[i]),
          strong: true,
        });
      }
      return r;
    }
    if (view === "complexity") {
      const r: GridRow[] = COMPLEXITY_BANDS.map((b) => ({
        key: b,
        label: b,
        values: plan.matrix.byComplexity[b],
        costValues: plan.cost.byComplexity[b],
      }));
      r.push({
        key: "_total",
        label: "Total",
        values: plan.matrix.totalByQuarter,
        costValues: plan.cost.totalByQuarter,
        strong: true,
      });
      return r;
    }
    const costBySchemeRole = new Map(
      plan.cost.bySchemeRole.map((s) => [`${s.schemeId}:${s.role}`, s.quarters]),
    );
    return plan.matrix.bySchemeRole.map((s) => ({
      key: `${s.schemeId}:${s.role}`,
      label: s.schemeName,
      sublabel: ROLE_LABELS[s.role],
      values: s.quarters,
      costValues: costBySchemeRole.get(`${s.schemeId}:${s.role}`),
    }));
  }, [plan, view, resourceAssumptions, wd]);

  return (
    <div className="space-y-6 sm:space-y-8">
      <PageHeader
        title="Demand Forecast"
        subtitle="FTE required per quarter (incl. overhead & leave uplift), by role and complexity."
        breadcrumbs={[{ label: "Resource Planner" }, { label: "Demand Forecast" }]}
      />

      {resourceAssumptions && (
        <FteExplainer
          overheadPct={resourceAssumptions.overheadPct}
          leavePct={resourceAssumptions.leavePct}
        />
      )}

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
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-lg border border-slate-200 p-0.5">
            {UNITS.map((u) => (
              <button
                key={u.key}
                onClick={() => setUnit(u.key)}
                className={`rounded-md px-3 py-1.5 text-[13px] font-medium ${
                  unit === u.key
                    ? "bg-slate-800 text-white"
                    : "text-slate-600 hover:bg-slate-50"
                }`}
              >
                {u.label}
              </button>
            ))}
          </div>
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
        <DemandGrid axis={plan.axis} rows={rows} unit={unit} />
      )}
    </div>
  );
}
