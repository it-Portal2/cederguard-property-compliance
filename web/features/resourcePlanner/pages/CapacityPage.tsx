import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { Building2, Save, Lock, AlertTriangle, CheckCircle2, Users } from "lucide-react";
import PageHeader from "../../../components/PageHeader";
import { StatsCard } from "../../../components/common/StatsCard";
import { useStore } from "../../../store/useStore";
import RpEmptyState from "../components/RpEmptyState";
import ResourcesInPostGrid from "../components/ResourcesInPostGrid";
import PeopleCapacityGrid from "../components/PeopleCapacityGrid";
import SchemeFilters, {
  applySchemeFilters,
  emptySchemeFilters,
  type SchemeFilterState,
} from "../components/SchemeFilters";
import { buildResourcePlan, computePeopleCapacity } from "../../../lib/resourcePlanner/compute";
import { ROLES, ROLE_LABELS } from "../../../lib/resourcePlanner/constants";
import {
  currentFyQuarterIndex,
  quarterCalendarLabel,
} from "../../../lib/resourcePlanner/quarters";
import type { Role } from "../../../lib/resourcePlanner/types";

type InPostMap = Partial<Record<Role, Record<number, number>>>;

const eyebrow = "font-mono uppercase tracking-wide text-[11px] font-medium text-slate-500";
const r1 = (n: number) => Math.round(n * 10) / 10;

export default function CapacityPage() {
  const resourceSchemes = useStore((s) => s.resourceSchemes);
  const resourceAssumptions = useStore((s) => s.resourceAssumptions);
  const resourcePlannerLoaded = useStore((s) => s.resourcePlannerLoaded);
  const resourcePlannerLoading = useStore((s) => s.resourcePlannerLoading);
  const loadResourcePlanner = useStore((s) => s.loadResourcePlanner);
  const saveResourceAssumptions = useStore((s) => s.saveResourceAssumptions);
  const canManageResourcePlanner = useStore((s) => s.canManageResourcePlanner);
  const editable = canManageResourcePlanner();

  const [filters, setFilters] = useState<SchemeFilterState>(emptySchemeFilters);
  const [inPost, setInPost] = useState<InPostMap | null>(null);
  const [availability, setAvailability] = useState<Record<string, number> | null>(null);
  const [view, setView] = useState<"role" | "person">("role");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadResourcePlanner();
  }, [loadResourcePlanner]);

  // Seed the editable drafts from saved assumptions once they land.
  useEffect(() => {
    if (resourceAssumptions && inPost === null) {
      setInPost(
        JSON.parse(JSON.stringify(resourceAssumptions.inPostByRoleQuarter || {})),
      );
    }
    if (resourceAssumptions && availability === null) {
      setAvailability(
        JSON.parse(JSON.stringify(resourceAssumptions.personAvailability || {})),
      );
    }
  }, [resourceAssumptions, inPost, availability]);

  const filtered = useMemo(
    () => applySchemeFilters(resourceSchemes, filters),
    [resourceSchemes, filters],
  );

  // Plan computed against the live draft so edits reflect immediately.
  const plan = useMemo(() => {
    if (!resourceAssumptions) return null;
    return buildResourcePlan(filtered, {
      ...resourceAssumptions,
      inPostByRoleQuarter: inPost || resourceAssumptions.inPostByRoleQuarter || {},
    });
  }, [filtered, resourceAssumptions, inPost]);

  const todayIdx = currentFyQuarterIndex();

  // Index capacity by role → quarter index for the balance grid.
  const capByRoleQuarter = useMemo(() => {
    const m = new Map<string, { demand: number; supply: number; balance: number }>();
    plan?.capacity.byQuarter.forEach((c) =>
      m.set(`${c.role}:${c.quarter}`, { demand: c.demand, supply: c.supply, balance: c.balance }),
    );
    return m;
  }, [plan]);

  const summary = useMemo(() => {
    if (!plan) return { shortRoles: 0, worstRole: null as Role | null, worstBalance: 0 };
    let worstRole: Role | null = null;
    let worstBalance = Infinity;
    let shortRoles = 0;
    for (const role of ROLES) {
      const w = plan.capacity.worstByRole[role];
      if (w < 0) shortRoles += 1;
      if (w < worstBalance) {
        worstBalance = w;
        worstRole = role;
      }
    }
    return { shortRoles, worstRole, worstBalance: Number.isFinite(worstBalance) ? worstBalance : 0 };
  }, [plan]);

  const people = useMemo(
    () => (plan ? computePeopleCapacity(plan, filtered, availability || {}) : []),
    [plan, filtered, availability],
  );

  const peopleSummary = useMemo(() => {
    const withHeadroom = people.filter((p) => p.hasHeadroom).length;
    const overAllocated = [...people].sort((a, b) => a.minHeadroom - b.minHeadroom)[0];
    return {
      total: people.length,
      withHeadroom,
      tightest: overAllocated && overAllocated.minHeadroom < 0 ? overAllocated : null,
    };
  }, [people]);

  const setAvail = (key: string, v: number) =>
    setAvailability((prev) => ({ ...(prev || {}), [key]: v }));

  const setCell = (role: Role, q: number, v: number | undefined) =>
    setInPost((prev) => {
      const next: InPostMap = JSON.parse(JSON.stringify(prev || {}));
      if (!next[role]) next[role] = {};
      if (v == null) delete next[role]![q];
      else next[role]![q] = v;
      return next;
    });

  const save = async () => {
    if (!resourceAssumptions) return;
    setSaving(true);
    try {
      await saveResourceAssumptions({
        ...resourceAssumptions,
        inPostByRoleQuarter: inPost || {},
        personAvailability: availability || {},
      });
      toast.success("Capacity inputs saved");
    } catch (e: any) {
      toast.error(e?.message || "Could not save");
    } finally {
      setSaving(false);
    }
  };

  const loading = !resourcePlannerLoaded || resourcePlannerLoading;
  const noSchemes = resourceSchemes.length === 0;
  const axis = plan?.axis ?? [];

  return (
    <div className="space-y-6 sm:space-y-8">
      <PageHeader
        title="Capacity"
        subtitle="Resources in post vs required FTE, per role per quarter. Enter what you have to see shortfalls and surpluses."
        breadcrumbs={[{ label: "Resource Planner" }, { label: "Capacity" }]}
        actions={
          <div className="flex items-center gap-2">
            {!editable && (
              <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-mono uppercase tracking-wide text-slate-500">
                <Lock className="h-3 w-3" /> Read-only
              </span>
            )}
            {editable && (
              <button
                onClick={save}
                disabled={saving}
                className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                <Save className="h-4 w-4" /> {saving ? "Saving…" : "Save capacity inputs"}
              </button>
            )}
          </div>
        }
      />

      {loading ? (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-sm text-slate-500">
          Loading capacity…
        </div>
      ) : noSchemes ? (
        <RpEmptyState
          icon={Building2}
          title="No schemes yet"
          description="Add or import schemes to see capacity vs demand."
          actionLabel="Go to Scheme Register"
          to="/resource-planner/schemes"
        />
      ) : (
        <>
          {/* View toggle */}
          <div className="inline-flex rounded-lg border border-slate-200 p-0.5">
            {(["role", "person"] as const).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`rounded-md px-3 py-1.5 text-[13px] font-medium ${
                  view === v ? "bg-indigo-600 text-white" : "text-slate-600 hover:bg-slate-50"
                }`}
              >
                {v === "role" ? "By role" : "By person"}
              </button>
            ))}
          </div>

          {/* Summary */}
          {view === "role" ? (
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
              <StatsCard
                title="Roles in shortfall"
                value={summary.shortRoles}
                description="Roles short in ≥1 quarter"
                icon={AlertTriangle}
                iconBgClassName={summary.shortRoles ? "bg-red-100" : "bg-emerald-100"}
                iconClassName={summary.shortRoles ? "text-red-600" : "text-emerald-600"}
              />
              <StatsCard
                title="Tightest role"
                value={summary.worstRole ? ROLE_LABELS[summary.worstRole] : "—"}
                description={`Worst balance ${r1(summary.worstBalance)} FTE`}
                icon={Users}
                iconBgClassName="bg-amber-100"
                iconClassName="text-amber-600"
              />
              <StatsCard
                title="Peak demand"
                value={plan ? r1(plan.peak.fte) : 0}
                description={plan?.peak.label}
                icon={CheckCircle2}
                iconBgClassName="bg-indigo-100"
                iconClassName="text-indigo-600"
              />
            </div>
          ) : (
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
              <StatsCard
                title="People tracked"
                value={peopleSummary.total}
                description="From scheme assignments"
                icon={Users}
                iconBgClassName="bg-indigo-100"
                iconClassName="text-indigo-600"
              />
              <StatsCard
                title="People with headroom"
                value={peopleSummary.withHeadroom}
                description="Spare capacity in ≥1 quarter"
                icon={CheckCircle2}
                iconBgClassName="bg-emerald-100"
                iconClassName="text-emerald-600"
              />
              <StatsCard
                title="Most over-allocated"
                value={peopleSummary.tightest ? peopleSummary.tightest.name : "—"}
                description={
                  peopleSummary.tightest
                    ? `Worst headroom ${r1(peopleSummary.tightest.minHeadroom)} FTE`
                    : "Nobody over-allocated"
                }
                icon={AlertTriangle}
                iconBgClassName={peopleSummary.tightest ? "bg-red-100" : "bg-emerald-100"}
                iconClassName={peopleSummary.tightest ? "text-red-600" : "text-emerald-600"}
              />
            </div>
          )}

          <SchemeFilters schemes={resourceSchemes} value={filters} onChange={setFilters} />

          {view === "role" && (
          <>
          {/* Balance grid: supply − demand per role per quarter */}
          <div>
            <div className={eyebrow}>Capacity balance</div>
            <h2 className="text-sm font-semibold text-slate-900 mb-3">
              Resources in post − required FTE (red = shortfall, green = surplus)
            </h2>
            <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
              <table className="border-collapse text-[13px]">
                <thead>
                  <tr>
                    <th className="sticky left-0 z-10 bg-slate-50 px-4 py-2 text-left font-mono uppercase tracking-wide text-[11px] font-medium text-slate-500 border-b border-r border-slate-200 min-w-[160px]">
                      Role
                    </th>
                    {axis.map((q) => {
                      const isToday = q.index === todayIdx;
                      return (
                        <th
                          key={q.index}
                          title={`${quarterCalendarLabel(q.fy, q.quarterOfFy)} · ${q.label}`}
                          className={`px-2 py-1 text-center font-mono text-[10px] font-medium border-b min-w-[44px] ${
                            isToday
                              ? "bg-indigo-50 text-indigo-600 border-indigo-200"
                              : "bg-slate-50 text-slate-400 border-slate-100"
                          }`}
                        >
                          Q{q.quarterOfFy}
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {ROLES.map((role) => (
                    <tr key={role}>
                      <td className="sticky left-0 z-10 bg-white px-4 py-1.5 border-r border-slate-200 whitespace-nowrap text-slate-800">
                        {ROLE_LABELS[role]}
                      </td>
                      {axis.map((q) => {
                        const cell = capByRoleQuarter.get(`${role}:${q.index}`);
                        const bal = cell?.balance ?? 0;
                        const hasDemand = (cell?.demand ?? 0) > 0.001;
                        const hasSupply = (cell?.supply ?? 0) > 0.001;
                        const show = hasDemand || hasSupply;
                        const short = bal < -0.001;
                        return (
                          <td
                            key={q.index}
                            title={
                              show
                                ? `${ROLE_LABELS[role]} · ${quarterCalendarLabel(q.fy, q.quarterOfFy)} — in post ${r1(cell?.supply ?? 0)}, required ${r1(cell?.demand ?? 0)}`
                                : undefined
                            }
                            className="px-2 py-1.5 text-center font-mono tabular-nums border-l border-slate-50"
                            style={
                              show
                                ? {
                                    backgroundColor: short
                                      ? `rgba(220,38,38,${Math.min(0.22, Math.abs(bal) * 0.18)})`
                                      : `rgba(16,185,129,${Math.min(0.22, Math.abs(bal) * 0.18)})`,
                                    color: short ? "#b91c1c" : "#047857",
                                  }
                                : undefined
                            }
                          >
                            {show ? (bal > 0 ? "+" : "") + r1(bal) : ""}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Editable resources in post */}
          <div>
            <div className={eyebrow}>Resources in post</div>
            <h2 className="text-sm font-semibold text-slate-900 mb-3">
              How many of each role you have, per quarter (1 full-time post = 1.0 FTE)
            </h2>
            <ResourcesInPostGrid
              axis={axis}
              value={inPost || {}}
              editable={editable}
              onChange={setCell}
            />
            {editable && (
              <p className="mt-2 text-[11px] text-slate-400">
                These figures also appear as the Actual row under demand on the Demand Forecast. Remember to Save.
              </p>
            )}
          </div>
          </>
          )}

          {view === "person" && (
            <div>
              <div className={eyebrow}>Who can take on more</div>
              <h2 className="text-sm font-semibold text-slate-900 mb-3">
                Committed load vs availability per person (green = headroom, red = over-allocated)
              </h2>
              {people.length === 0 ? (
                <RpEmptyState
                  icon={Users}
                  title="No people to show"
                  description="Assign people to schemes (Strategic Lead / Senior PM / PM / Assistant PM / Defects PM) to see who has capacity. Adjust their availability inline."
                  showAction={false}
                />
              ) : (
                <>
                  <PeopleCapacityGrid
                    axis={axis}
                    people={people}
                    editable={editable}
                    onAvailabilityChange={setAvail}
                  />
                  <p className="mt-2 text-[11px] text-slate-400">
                    Committed = sum of the demand of the schemes each person is named on (incl. uplift).
                    Availability defaults to 1.0 FTE — lower it for part-time. Remember to Save.
                  </p>
                </>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
