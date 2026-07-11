import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { Plus, Pencil, Trash2, AlertOctagon, ShieldAlert } from "lucide-react";
import PageHeader from "../../../components/PageHeader";
import RunAgentButton from "../../agents/components/RunAgentButton";
import DynamicTable from "../../../components/table/DynamicTable";
import { useStore } from "../../../store/useStore";
import {
  ProjectScopeToggle,
  scopeByProject,
  type ProjectScope,
} from "../../../components/common/ProjectScope";
import { useEscalateToAssurance } from "../../assurance/useEscalate";
import IncidentModal from "../components/IncidentModal";
import {
  INCIDENT_STATUSES,
  INCIDENT_SEVERITIES,
  INCIDENT_TYPES,
  INCIDENT_STATUS_STYLES,
  INCIDENT_SEVERITY_STYLES,
  type Incident,
  type IncidentSeverity,
  type IncidentStatus,
} from "../types";
import type { ColumnDef, RowAction, FilterDef } from "../../../components/table/types";

const fmtDateTime = (v?: string | null) =>
  v ? String(v).replace("T", " ").slice(0, 16) : "—";

export default function IncidentsRegisterPage() {
  const incidents = useStore((s) => s.incidents);
  const incidentsLoading = useStore((s) => s.incidentsLoading);
  const loadIncidents = useStore((s) => s.loadIncidents);
  const saveIncident = useStore((s) => s.saveIncident);
  const deleteIncident = useStore((s) => s.deleteIncident);
  const canLog = useStore((s) => s.canLogIncidents)();
  const canClose = useStore((s) => s.canCloseIncidents)();
  const { canEscalate, escalate, isEscalated, escalatingId } = useEscalateToAssurance();
  const activeProjectId = useStore((s) => s.activeProjectId);

  const [editing, setEditing] = useState<Incident | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  // Q5.1 — shared register + project scope that follows the active project.
  const [scope, setScope] = useState<ProjectScope>(
    activeProjectId ? "project" : "all",
  );
  useEffect(() => {
    setScope(activeProjectId ? "project" : "all");
  }, [activeProjectId]);
  const scopedIncidents = useMemo(
    () => scopeByProject(incidents, scope, activeProjectId),
    [incidents, scope, activeProjectId],
  );

  useEffect(() => {
    loadIncidents();
  }, [loadIncidents]);

  const openNew = () => {
    setEditing(null);
    setModalOpen(true);
  };
  const openEdit = (i: Incident) => {
    setEditing(i);
    setModalOpen(true);
  };

  const handleSave = async (incident: Incident) => {
    try {
      await saveIncident(incident);
      toast.success("Incident saved");
    } catch (e: any) {
      toast.error(e?.message || "Could not save incident");
      throw e;
    }
  };

  const handleDelete = async (i: Incident) => {
    try {
      await deleteIncident(i.id);
      toast.success("Incident deleted");
    } catch (e: any) {
      toast.error(e?.message || "Could not delete incident");
    }
  };

  const columns: ColumnDef<Incident>[] = [
    { key: "title", label: "Incident", sortable: true, truncate: true },
    { key: "type", label: "Type", sortable: true },
    {
      key: "severity",
      label: "Severity",
      sortable: true,
      render: (v) => {
        const sev = (v as IncidentSeverity) || "Low";
        return (
          <span
            className={`inline-flex items-center rounded-full px-2 py-0.5 font-mono uppercase tracking-wide text-[10px] font-medium ${
              INCIDENT_SEVERITY_STYLES[sev] ??
              "bg-slate-100 text-slate-600 ring-1 ring-slate-200"
            }`}
          >
            {sev}
          </span>
        );
      },
    },
    {
      key: "status",
      label: "Status",
      sortable: true,
      render: (v) => {
        const st = (v as IncidentStatus) || "Open";
        return (
          <span
            className={`inline-flex items-center rounded-full px-2 py-0.5 font-mono uppercase tracking-wide text-[10px] font-medium ${
              INCIDENT_STATUS_STYLES[st] ??
              "bg-slate-100 text-slate-600 ring-1 ring-slate-200"
            }`}
          >
            {st}
          </span>
        );
      },
    },
    {
      key: "occurredAt",
      label: "Occurred",
      sortable: true,
      render: (v) => (
        <span className="font-mono tabular-nums text-[11px] text-slate-500">
          {fmtDateTime(v as string | null)}
        </span>
      ),
    },
    {
      key: "projectName",
      label: "Project",
      sortable: true,
      render: (v) =>
        v ? String(v) : <span className="text-slate-400">Org-wide</span>,
    },
    {
      key: "owner",
      label: "Owner",
      sortable: true,
      render: (v) => (v ? String(v) : "—"),
    },
  ];

  const filterDefs: FilterDef<Incident>[] = [
    {
      key: "status",
      label: "Status",
      type: "select",
      options: INCIDENT_STATUSES.map((s) => ({ value: s, label: s })),
    },
    {
      key: "severity",
      label: "Severity",
      type: "select",
      options: INCIDENT_SEVERITIES.map((s) => ({ value: s, label: s })),
    },
    {
      key: "type",
      label: "Type",
      type: "select",
      options: INCIDENT_TYPES.map((t) => ({ value: t, label: t })),
    },
  ];

  const rowActions: RowAction<Incident>[] = [];
  if (canLog) {
    rowActions.push({ key: "edit", label: "Edit", icon: Pencil, onClick: openEdit });
  }
  if (canEscalate) {
    rowActions.push({
      key: "escalate",
      label: (r) =>
        isEscalated(`incident:${r.id}`) ? "Escalated to Assurance" : "Escalate to Assurance",
      icon: ShieldAlert,
      isDisabled: (r) =>
        isEscalated(`incident:${r.id}`) || escalatingId === `incident:${r.id}`,
      onClick: (r) =>
        escalate(`incident:${r.id}`, {
          title: r.title,
          description: `Incident: ${r.type} (${r.severity}). ${r.immediateImpact || ""}${r.rootCause ? ` Root cause: ${r.rootCause}` : ""}`.trim(),
          severity: r.severity,
          source: "incident",
          failureReason: "incident_occurred",
          sourceRef: { kind: "incident", id: `incident:${r.id}`, label: r.type },
          projectId: r.projectId || undefined,
          programmeId: r.programmeId || undefined,
        }),
    });
  }
  if (canClose) {
    rowActions.push({
      key: "delete",
      label: "Delete",
      icon: Trash2,
      isDanger: true,
      onClick: handleDelete,
      requireConfirm: {
        title: "Delete incident",
        message: (r: Incident) =>
          `Permanently delete "${r.title}"? This cannot be undone.`,
        confirmLabel: "Delete",
        isDanger: true,
      },
    });
  }

  return (
    <div className="space-y-6 sm:space-y-8">
      <PageHeader
        title="Incidents"
        subtitle="The formal, regulator-grade incident register — distinct from the routine Issues log."
        breadcrumbs={[{ label: "Escalations & Incidents" }, { label: "Incidents" }]}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <RunAgentButton agentKey="riskIncident" label="Run Incident agent" />
            {activeProjectId ? <ProjectScopeToggle scope={scope} onChange={setScope} /> : null}
          </div>
        }
      />

      <DynamicTable<Incident>
        data={scopedIncidents}
        columns={columns}
        rowActions={rowActions}
        filters={filterDefs}
        getRowId={(r) => r.id}
        loading={incidentsLoading && incidents.length === 0}
        searchable
        searchPlaceholder="Search incidents…"
        searchFields={["title", "type", "location", "owner", "rootCause"]}
        pagination={{ enabled: true, pageSize: 25, pageSizeOptions: [10, 25, 50] }}
        stickyHeader
        headerVariant="light"
        export={{ xlsx: true, csv: true, filename: "incidents" }}
        emptyState={{
          title: "No incidents logged",
          description: canLog
            ? "Log an incident to start the formal record."
            : "No incidents have been logged yet.",
          icon: AlertOctagon,
        }}
        toolbarActions={
          canLog ? (
            <button
              onClick={openNew}
              className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700"
            >
              <Plus className="h-4 w-4" /> Log incident
            </button>
          ) : undefined
        }
      />

      {modalOpen && (
        <IncidentModal
          incident={editing}
          canClose={canClose}
          onClose={() => setModalOpen(false)}
          onSave={handleSave}
        />
      )}
    </div>
  );
}
