import { useEffect, useMemo, useState } from "react";
import { Building2, FilterX } from "lucide-react";
import PageHeader from "../../../components/PageHeader";
import { useStore } from "../../../store/useStore";
import GanttTimeline from "../components/GanttTimeline";
import RpEmptyState from "../components/RpEmptyState";
import {
  ProjectScopeToggle,
  scopeByProject,
  type ProjectScope,
} from "../../../components/common/ProjectScope";
import SchemeFilters, {
  applySchemeFilters,
  emptySchemeFilters,
  type SchemeFilterState,
} from "../components/SchemeFilters";
import {
  buildQuarterAxis,
  horizonFromIndices,
} from "../../../lib/resourcePlanner/quarters";
import {
  normalizeScheme,
  schemeBoundaryIndices,
} from "../../../lib/resourcePlanner/compute";

export default function TimelinePage() {
  const resourceSchemes = useStore((s) => s.resourceSchemes);
  const resourceAssumptions = useStore((s) => s.resourceAssumptions);
  const resourcePlannerLoading = useStore((s) => s.resourcePlannerLoading);
  const loadResourcePlanner = useStore((s) => s.loadResourcePlanner);
  const activeProjectId = useStore((s) => s.activeProjectId);

  const [filters, setFilters] = useState<SchemeFilterState>(emptySchemeFilters);
  const [scope, setScope] = useState<ProjectScope>(
    activeProjectId ? "project" : "all",
  );

  useEffect(() => {
    loadResourcePlanner();
  }, [loadResourcePlanner]);
  useEffect(() => {
    setScope(activeProjectId ? "project" : "all");
  }, [activeProjectId]);

  const { axis, schemes } = useMemo(() => {
    if (!resourceAssumptions) return { axis: [], schemes: [] };
    const filtered = applySchemeFilters(
      scopeByProject(resourceSchemes, scope, activeProjectId, {
        includeUntagged: false,
      }),
      filters,
    ).map((s) =>
      normalizeScheme(s, resourceAssumptions.complexityMap),
    );
    const horizon =
      resourceAssumptions.horizon &&
      resourceAssumptions.horizon.endFy >= resourceAssumptions.horizon.startFy
        ? resourceAssumptions.horizon
        : horizonFromIndices(filtered.flatMap(schemeBoundaryIndices));
    // Sort by earliest stage boundary so the Gantt reads top-left → bottom-right.
    const sorted = [...filtered].sort((a, b) => {
      const ai = Math.min(...(schemeBoundaryIndices(a).length ? schemeBoundaryIndices(a) : [Infinity]));
      const bi = Math.min(...(schemeBoundaryIndices(b).length ? schemeBoundaryIndices(b) : [Infinity]));
      return ai - bi;
    });
    return {
      axis: buildQuarterAxis(horizon.startFy, horizon.endFy),
      schemes: sorted,
    };
  }, [resourceSchemes, resourceAssumptions, filters, scope, activeProjectId]);

  return (
    <div className="space-y-6 sm:space-y-8">
      <PageHeader
        title="Timeline"
        subtitle="Stage timeline per scheme — planning, design, construction and defects."
        breadcrumbs={[{ label: "Resource Planner" }, { label: "Timeline" }]}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {activeProjectId && (
              <ProjectScopeToggle scope={scope} onChange={setScope} />
            )}
            {resourceSchemes.length > 0 && (
              <SchemeFilters schemes={resourceSchemes} value={filters} onChange={setFilters} />
            )}
          </div>
        }
      />

      {resourcePlannerLoading && resourceSchemes.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-sm text-slate-500">
          Loading timeline…
        </div>
      ) : schemes.length === 0 ? (
        resourceSchemes.length === 0 ? (
          <RpEmptyState
            icon={Building2}
            title="No schemes yet"
            description="Add or import schemes to see the stage timeline."
            actionLabel="Go to Scheme Register"
            to="/resource-planner/schemes"
          />
        ) : (
          <RpEmptyState
            icon={FilterX}
            title="No schemes to show"
            description="No schemes match the current filters."
            showAction={false}
          />
        )
      ) : (
        <GanttTimeline axis={axis} schemes={schemes} />
      )}
    </div>
  );
}
