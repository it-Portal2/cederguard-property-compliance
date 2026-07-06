import { useEffect, useMemo } from "react";
import { ClipboardList, TrendingUp, PoundSterling } from "lucide-react";
import PageHeader from "../../../components/PageHeader";
import { StatsCard } from "../../../components/common/StatsCard";
import { ComplianceVelocityChart } from "../../../components/dashboard/ComplianceVelocityChart";
import AssuranceSignalsCard from "../components/AssuranceSignalsCard";
import DashboardGovernanceCard from "../components/DashboardGovernanceCard";
import { useStore } from "../../../store/useStore";
import { buildResourcePlan } from "../../../lib/resourcePlanner/compute";

const gbp = (n: number) => `£${Math.round(n).toLocaleString("en-GB")}`;

export default function MonitoringOverviewPage() {
  const complianceItems = useStore((s) => s.complianceItems);
  const resourceSchemes = useStore((s) => s.resourceSchemes);
  const resourceAssumptions = useStore((s) => s.resourceAssumptions);
  const loadResourcePlanner = useStore((s) => s.loadResourcePlanner);

  useEffect(() => {
    loadResourcePlanner();
  }, [loadResourcePlanner]);

  const plan = useMemo(
    () => (resourceAssumptions ? buildResourcePlan(resourceSchemes, resourceAssumptions) : null),
    [resourceSchemes, resourceAssumptions],
  );

  return (
    <div className="space-y-6 sm:space-y-8">
      <PageHeader
        title="Monitoring Overview"
        subtitle="Live status across compliance, governance, escalations & incidents and resources — in one place."
        breadcrumbs={[{ label: "Monitoring & Reporting" }, { label: "Overview" }]}
      />

      {/* Escalations & Incidents */}
      <AssuranceSignalsCard />

      {/* Governance */}
      <DashboardGovernanceCard />

      {/* Compliance */}
      <section className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5 dark:border-slate-700 dark:bg-slate-800">
        <h2 className="mb-3 text-sm font-semibold tracking-tight text-slate-800 dark:text-slate-100">
          Compliance
        </h2>
        <ComplianceVelocityChart items={complianceItems} />
      </section>

      {/* Resource Planner */}
      <section className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5 dark:border-slate-700 dark:bg-slate-800">
        <h2 className="mb-3 text-sm font-semibold tracking-tight text-slate-800 dark:text-slate-100">
          Resource
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <StatsCard
            title="Schemes"
            value={resourceSchemes.length}
            icon={ClipboardList}
            iconBgClassName="bg-indigo-50 dark:bg-indigo-900/30"
            iconClassName="text-indigo-600 dark:text-indigo-400"
          />
          <StatsCard
            title="Peak quarter FTE"
            value={plan ? Math.round(plan.peak.fte * 10) / 10 : 0}
            description={plan?.peak.label}
            icon={TrendingUp}
            iconBgClassName="bg-emerald-50 dark:bg-emerald-900/30"
            iconClassName="text-emerald-600 dark:text-emerald-400"
          />
          <StatsCard
            title="Total cost"
            value={plan ? gbp(plan.cost.total) : "£0"}
            icon={PoundSterling}
            iconBgClassName="bg-slate-100 dark:bg-slate-700"
            iconClassName="text-slate-700 dark:text-slate-300"
          />
        </div>
      </section>
    </div>
  );
}
