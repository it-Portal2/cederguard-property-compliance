import { useEffect, useMemo } from "react";
import { ListChecks } from "lucide-react";
import { clsx } from "clsx";
import PageHeader from "../../../components/PageHeader";
import DynamicTable from "../../../components/table/DynamicTable";
import type { ColumnDef, FilterDef } from "../../../components/table/types";
import { useStore } from "../../../store/useStore";
import type { AgentSuggestionDoc } from "../../../../shared/types/agents";
import { AGENT_META, OUTPUT_TYPE_LABELS, REVIEW_STATUS_STYLE } from "../agentMeta";
import SuggestionReviewPanel from "../components/SuggestionReviewPanel";

export default function AgentSuggestionsPage() {
  const suggestions = useStore((s) => s.agentSuggestions);
  const loading = useStore((s) => s.agentSuggestionsLoading);
  const loaded = useStore((s) => s.agentSuggestionsLoaded);
  const loadAgentSuggestions = useStore((s) => s.loadAgentSuggestions);

  useEffect(() => {
    loadAgentSuggestions();
  }, [loadAgentSuggestions]);

  // Superseded drafts are hidden by default — they are kept for audit, not review.
  const visible = useMemo(
    () => suggestions.filter((s) => s.reviewStatus !== "superseded"),
    [suggestions],
  );

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
          title: "No AI suggestions yet",
          description:
            "Run an agent from a module page — Risk, Compliance, Incidents, Technical Assurance and more — and its drafts land here for review.",
          icon: ListChecks,
        }}
      />
    </div>
  );
}
