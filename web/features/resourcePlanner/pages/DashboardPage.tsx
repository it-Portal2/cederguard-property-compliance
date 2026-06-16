import { useEffect, useMemo, useState } from "react";
import {
  Building2,
  Home,
  TrendingUp,
  Sigma,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";
import RpEmptyState from "../components/RpEmptyState";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from "recharts";
import PageHeader from "../../../components/PageHeader";
import { StatsCard } from "../../../components/common/StatsCard";
import { useStore } from "../../../store/useStore";
import SchemeFilters, {
  applySchemeFilters,
  emptySchemeFilters,
  type SchemeFilterState,
} from "../components/SchemeFilters";
import {
  buildResourcePlan,
  complexityAtQuarter,
} from "../../../lib/resourcePlanner/compute";
import {
  COMPLEXITY_BANDS,
  ROLES,
  ROLE_LABELS,
} from "../../../lib/resourcePlanner/constants";
import type { Role } from "../../../lib/resourcePlanner/types";

const ROLE_COLORS: Record<Role, string> = {
  SPM: "#4f46e5",
  PM: "#0ea5e9",
  APM: "#10b981",
  StrategicLead: "#f59e0b",
  DefectsPM: "#8b5cf6",
};

const eyebrow = "font-mono uppercase tracking-wide text-[11px] font-medium text-slate-500";

/** Shimmer placeholder shown while the planner data loads (avoids a flash of zeros). */
function DashboardSkeleton() {
  return (
    <>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="flex min-h-[140px] flex-col justify-between rounded-lg border border-slate-200 bg-white p-5"
          >
            <div className="flex items-center justify-between">
              <div className="h-3 w-20 animate-pulse rounded bg-slate-100" />
              <div className="h-9 w-9 animate-pulse rounded-full bg-slate-100" />
            </div>
            <div className="h-8 w-16 animate-pulse rounded bg-slate-100" />
          </div>
        ))}
      </div>
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="mb-3 h-3 w-44 animate-pulse rounded bg-slate-100" />
        <div className="h-[280px] w-full animate-pulse rounded bg-slate-50" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="space-y-2 rounded-xl border border-slate-200 bg-white p-4">
            <div className="mb-3 h-3 w-32 animate-pulse rounded bg-slate-100" />
            {Array.from({ length: 5 }).map((_, j) => (
              <div key={j} className="h-5 w-full animate-pulse rounded bg-slate-50" />
            ))}
          </div>
        ))}
      </div>
    </>
  );
}

export default function ResourcePlannerDashboardPage() {
  const resourceSchemes = useStore((s) => s.resourceSchemes);
  const resourceAssumptions = useStore((s) => s.resourceAssumptions);
  const resourcePlannerLoading = useStore((s) => s.resourcePlannerLoading);
  const resourcePlannerLoaded = useStore((s) => s.resourcePlannerLoaded);
  const loadResourcePlanner = useStore((s) => s.loadResourcePlanner);

  const [filters, setFilters] = useState<SchemeFilterState>(emptySchemeFilters);

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

  const totalHomes = useMemo(
    () => filtered.reduce((sum, s) => sum + (Number(s.allHomes) || 0), 0),
    [filtered],
  );

  const fyChartData = useMemo(() => {
    if (!plan) return [];
    return plan.byFinancialYear
      .filter((fy) => fy.total > 0.001)
      .map((fy) => ({
        name: fy.fyLabel,
        ...ROLES.reduce(
          (acc, r) => ({ ...acc, [r]: Math.round(fy.byRole[r] * 100) / 100 }),
          {} as Record<Role, number>,
        ),
      }));
  }, [plan]);

  const complexityAtPeak = useMemo(
    () => (plan ? complexityAtQuarter(plan.matrix, plan.peak.axisPos) : null),
    [plan],
  );
  const maxComplexity = complexityAtPeak
    ? Math.max(0.0001, ...COMPLEXITY_BANDS.map((b) => complexityAtPeak[b]))
    : 1;

  const capacityRows = useMemo(() => {
    if (!plan) return [];
    return ROLES.map((role) => {
      const peakDemand = Math.max(0, ...plan.matrix.byRole[role]);
      const supply = Number(resourceAssumptions?.supplyByRole?.[role]) || 0;
      return { role, supply, peakDemand, balance: supply - peakDemand };
    });
  }, [plan, resourceAssumptions]);

  // Show a skeleton until the first load resolves (store resets on a hard
  // refresh), so the cards never flash zeros before the data arrives.
  const loading = !resourcePlannerLoaded || resourcePlannerLoading;
  const noSchemes = resourceSchemes.length === 0;

  return (
    <div className="space-y-6 sm:space-y-8">
      <PageHeader
        title="Resource Dashboard"
        subtitle="FTE demand and capacity across the development programme."
        breadcrumbs={[{ label: "Resource Planner" }, { label: "Dashboard" }]}
        actions={
          !loading && resourceSchemes.length > 0 ? (
            <SchemeFilters schemes={resourceSchemes} value={filters} onChange={setFilters} />
          ) : undefined
        }
      />

      {loading ? (
        <DashboardSkeleton />
      ) : noSchemes ? (
        <RpEmptyState
          icon={Building2}
          title="No schemes yet"
          description="Add or import schemes to see the resource forecast."
          actionLabel="Go to Scheme Register"
          to="/resource-planner/schemes"
        />
      ) : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatsCard
              title="Schemes"
              value={filtered.length}
              icon={Building2}
              iconBgClassName="bg-indigo-100"
              iconClassName="text-indigo-600"
            />
            <StatsCard
              title="Total homes"
              value={totalHomes}
              icon={Home}
              iconBgClassName="bg-sky-100"
              iconClassName="text-sky-600"
            />
            <StatsCard
              title="Peak quarter FTE"
              value={plan ? Math.round(plan.peak.fte * 10) / 10 : 0}
              description={plan?.peak.label}
              icon={TrendingUp}
              iconBgClassName="bg-amber-100"
              iconClassName="text-amber-600"
            />
            <StatsCard
              title="Total FTE-quarters"
              value={plan ? Math.round(plan.totalFte * 10) / 10 : 0}
              icon={Sigma}
              iconBgClassName="bg-emerald-100"
              iconClassName="text-emerald-600"
            />
          </div>

          {/* FTE by financial year */}
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <div className={eyebrow}>FTE required by financial year</div>
            <h2 className="text-sm font-semibold text-slate-900 mb-3">
              Demand by role (incl. overhead &amp; leave uplift)
            </h2>
            {fyChartData.length === 0 ? (
              <p className="py-8 text-center text-sm text-slate-400">
                No demand in the current horizon.
              </p>
            ) : (
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={fyChartData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 10, fill: "#64748b", fontFamily: "Geist Mono, monospace" }}
                    interval={0}
                    angle={-35}
                    textAnchor="end"
                    height={56}
                  />
                  <YAxis tick={{ fontSize: 10, fill: "#64748b", fontFamily: "Geist Mono, monospace" }} />
                  <Tooltip
                    contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e2e8f0" }}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  {ROLES.map((role) => (
                    <Bar
                      key={role}
                      dataKey={role}
                      stackId="fte"
                      name={ROLE_LABELS[role]}
                      fill={ROLE_COLORS[role]}
                    />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* FTE by complexity at peak */}
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <div className={eyebrow}>FTE by complexity</div>
              <h2 className="text-sm font-semibold text-slate-900 mb-3">
                At peak quarter{plan ? ` · ${plan.peak.label}` : ""}
              </h2>
              <div className="space-y-2">
                {complexityAtPeak &&
                  COMPLEXITY_BANDS.map((b) => (
                    <div key={b} className="flex items-center gap-2">
                      <span className="w-20 text-[13px] text-slate-600">{b}</span>
                      <div className="flex-1 h-3 rounded-full bg-slate-100 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-indigo-500"
                          style={{
                            width: `${Math.round((complexityAtPeak[b] / maxComplexity) * 100)}%`,
                          }}
                        />
                      </div>
                      <span className="w-12 text-right font-mono tabular-nums text-[13px] text-slate-700">
                        {Math.round(complexityAtPeak[b] * 100) / 100}
                      </span>
                    </div>
                  ))}
              </div>
            </div>

            {/* Capacity: supply vs peak demand */}
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <div className={eyebrow}>Capacity</div>
              <h2 className="text-sm font-semibold text-slate-900 mb-3">
                Supply vs peak demand by role
              </h2>
              <div className="space-y-1.5">
                {capacityRows.map((row) => {
                  const short = row.balance < 0;
                  return (
                    <div
                      key={row.role}
                      className="flex items-center justify-between rounded-lg px-3 py-2 bg-slate-50"
                    >
                      <span className="text-[13px] text-slate-700">{ROLE_LABELS[row.role]}</span>
                      <div className="flex items-center gap-3 font-mono tabular-nums text-[12px]">
                        <span className="text-slate-400">
                          {row.supply.toFixed(1)} sup / {row.peakDemand.toFixed(1)} dem
                        </span>
                        <span
                          className={`inline-flex items-center gap-1 ${
                            short ? "text-red-600" : "text-emerald-600"
                          }`}
                        >
                          {short ? (
                            <AlertTriangle className="h-3.5 w-3.5" />
                          ) : (
                            <CheckCircle2 className="h-3.5 w-3.5" />
                          )}
                          {row.balance >= 0 ? "+" : ""}
                          {row.balance.toFixed(1)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
              <p className="mt-2 text-[11px] text-slate-400">
                Set available supply per role in Assumptions.
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
