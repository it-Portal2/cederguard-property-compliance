import { useEffect, useMemo, useState } from "react";
import { ListChecks } from "lucide-react";
import { clsx } from "clsx";
import PageHeader from "../../../components/PageHeader";
import DynamicTable from "../../../components/table/DynamicTable";
import type { ColumnDef, FilterDef } from "../../../components/table/types";
import { ProjectScopeToggle, type ProjectScope } from "../../../components/common/ProjectScope";
import { useStore } from "../../../store/useStore";
import type { AgentSuggestionDoc } from "../../../../shared/types/agents";
import { AGENT_META, OUTPUT_TYPE_LABELS, REVIEW_STATUS_STYLE } from "../agentMeta";
import SuggestionReviewPanel from "../components/SuggestionReviewPanel";

export default function AgentSuggestionsPage() {
  const suggestions = useStore((s) => s.agentSuggestions);
  const loading = useStore((s) => s.agentSuggestionsLoading);
  const loaded = useStore((s) => s.agentSuggestionsLoaded);
  const loadAgentSuggestions = useStore((s) => s.loadAgentSuggestions);
  const activeProjectId = useStore((s) => s.activeProjectId);
  const activeProgrammeId = useStore((s) => s.activeProgrammeId);

  // The queue follows the active context (project or programme), matching the rest of the
  // app; "All" opens the full cross-context review inbox.
  const activeContextId = activeProjectId || activeProgrammeId;
  const [scope, setScope] = useState<ProjectScope>(activeContextId ? "project" : "all");

  useEffect(() => {
    loadAgentSuggestions();
  }, [loadAgentSuggestions]);

  // Re-sync the toggle when the active context changes, so switching project/programme
  // shows that context's suggestions rather than the previous one's.
  useEffect(() => {
    setScope(activeContextId ? "project" : "all");
  }, [activeContextId]);

  const visible = useMemo(() => {
    // Superseded drafts are hidden by default — they are kept for audit, not review.
    let list = suggestions.filter((s) => s.reviewStatus !== "superseded");
    if (scope === "project" && activeContextId) {
      // This context's suggestions, plus portfolio-wide ones (org-wide, apply everywhere).
      list = list.filter((s) => s.contextId === activeContextId || s.contextId === null);
    }
    return list;
  }, [suggestions, scope, activeContextId]);

  const columns: ColumnDef<AgentSuggestionDoc>[] = useMemo(
    () => [
      {
        key: "title",
        label: "Suggestion",
        sortable: true,
        render: (_v, s) => (
          <div className="min-w-0">
            <p className="truncate font-medium text-slate-800">{s.title}</p>
            <p className="truncate text-[12px] text-slate-500">{AGENT_META[s.agentKey]?.label ?? s.agentKey}</p>
          </div>
        ),
      },
      {
        key: "outputType",
        label: "Type",
        sortable: true,
        render: (_v, s) => (
          <span className="font-mono text-[11px] uppercase tracking-wide text-slate-500">
            {OUTPUT_TYPE_LABELS[s.outputType] ?? s.outputType}
          </span>
        ),
      },
      {
        key: "confidence",
        label: "Confidence",
        sortable: true,
        render: (_v, s) => (
          <span className="font-mono tabular-nums text-[12px] text-slate-600">
            {Math.round((s.confidence ?? 0) * 100)}%
          </span>
        ),
      },
      {
        key: "reviewStatus",
        label: "Status",
        sortable: true,
        render: (_v, s) => (
          <span
            className={clsx(
              "font-mono uppercase tracking-wide text-[11px] font-medium px-2 py-0.5 rounded-full border",
              REVIEW_STATUS_STYLE[s.reviewStatus] ?? REVIEW_STATUS_STYLE.draft,
            )}
          >
            {s.reviewStatus}
          </span>
        ),
      },
      {
        key: "createdAt",
        label: "Created",
        sortable: true,
        render: (_v, s) => (
          <span className="font-mono text-[11px] text-slate-500 tabular-nums">
            {String(s.createdAt).slice(0, 10)}
          </span>
        ),
      },
    ],
    [],
  );

  const filters: FilterDef<AgentSuggestionDoc>[] = useMemo(
    () => [
      {
        key: "reviewStatus",
        label: "Status",
        type: "select",
        options: ["draft", "accepted", "edited", "rejected", "applied"].map((v) => ({ label: v, value: v })),
      },
      {
        key: "agentKey",
        label: "Agent",
        type: "select",
        options: Object.values(AGENT_META).map((a) => ({ label: a.label, value: a.key })),
      },
    ],
    [],
  );

  return (
    <div className="space-y-6 sm:space-y-8">
      <PageHeader
        title="AI Suggestions"
        subtitle="Drafts produced by the AI agents. Review the sources, then accept, edit, reject or apply — nothing reaches a live record until you approve it."
        breadcrumbs={[{ label: "AI Agents" }, { label: "AI Suggestions" }]}
        actions={
          activeContextId ? (
            <ProjectScopeToggle scope={scope} onChange={setScope} />
          ) : undefined
        }
      />

      <DynamicTable<AgentSuggestionDoc>
        data={visible}
        columns={columns}
        filters={filters}
        getRowId={(r) => r.id}
        loading={loading && !loaded}
        searchable
        searchPlaceholder="Search suggestions…"
        searchFields={["title", "rationale"]}
        expandable
        renderExpanded={(s) => <SuggestionReviewPanel suggestion={s} />}
        pagination={{ enabled: true, pageSize: 25, pageSizeOptions: [10, 25, 50] }}
        stickyHeader
        headerVariant="light"
        emptyState={{
          title: "No AI suggestions here",
          description:
            scope === "project" && activeContextId
              ? "Nothing for the active context yet. Switch to “All” to see suggestions from other projects, or run an agent from a module page."
              : "Run an agent from a module page — Risk, Compliance, Incidents, Technical Assurance and more — and its drafts land here for review.",
          icon: ListChecks,
        }}
      />
    </div>
  );
}
