import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { Plus, Pencil, Trash2, ShieldCheck, ShieldAlert } from "lucide-react";
import PageHeader from "../../../components/PageHeader";
import DynamicTable from "../../../components/table/DynamicTable";
import { useStore } from "../../../store/useStore";
import { DOMAINS } from "../../../data/complianceData";
import {
  ProjectScopeToggle,
  scopeByProject,
  type ProjectScope,
} from "../../../components/common/ProjectScope";
import { useEscalateToAssurance } from "../../assurance/useEscalate";
import ControlModal from "../components/ControlModal";
import {
  CONTROL_STATUSES,
  CONTROL_STATUS_STYLES,
  type Control,
} from "../types";
import type {
  ColumnDef,
  RowAction,
  FilterDef,
} from "../../../components/table/types";

const DOMAIN_LABELS: Record<string, string> = Object.fromEntries(
  DOMAINS.map((d) => [d.id, d.label]),
);

const fmtDate = (v?: string | null) => (v ? String(v).slice(0, 10) : "—");

export default function ControlsRegisterPage() {
  const controls = useStore((s) => s.controls);
  const controlsLoading = useStore((s) => s.controlsLoading);
  const loadControls = useStore((s) => s.loadControls);
  const saveControl = useStore((s) => s.saveControl);
  const deleteControl = useStore((s) => s.deleteControl);
  const canManageControls = useStore((s) => s.canManageControls);
  const canManage = canManageControls();
  const activeProjectId = useStore((s) => s.activeProjectId);
  const { escalate, isEscalated, escalatingId } = useEscalateToAssurance();

  const [editing, setEditing] = useState<Control | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  // Q5.1 — shared register + project scope that follows the active project.
  const [scope, setScope] = useState<ProjectScope>(
    activeProjectId ? "project" : "all",
  );
  useEffect(() => {
    setScope(activeProjectId ? "project" : "all");
  }, [activeProjectId]);
  const scopedControls = useMemo(
    () => scopeByProject(controls, scope, activeProjectId),
    [controls, scope, activeProjectId],
  );

  useEffect(() => {
    loadControls();
  }, [loadControls]);

  const openNew = () => {
    setEditing(null);
    setModalOpen(true);
  };
  const openEdit = (c: Control) => {
    setEditing(c);
    setModalOpen(true);
  };

  const handleSave = async (control: Control) => {
    try {
      await saveControl(control);
      toast.success("Control saved");
    } catch (e: any) {
      toast.error(e?.message || "Could not save control");
      throw e;
    }
  };

  const handleDelete = async (c: Control) => {
    try {
      await deleteControl(c.id);
      toast.success("Control deleted");
    } catch (e: any) {
      toast.error(e?.message || "Could not delete control");
    }
  };

  const columns: ColumnDef<Control>[] = useMemo(
    () => [
      { key: "title", label: "Control", sortable: true, truncate: true },
      {
        key: "reference",
        label: "Ref",
        sortable: true,
        render: (v) =>
          v ? (
            <span className="font-mono tabular-nums text-[11px] text-slate-500">
              {String(v)}
            </span>
          ) : (
            "—"
          ),
      },
      {
        key: "status",
        label: "Status",
        sortable: true,
        render: (v) => {
          const status = (v as Control["status"]) || "Not Tested";
          return (
            <span
              className={`inline-flex items-center rounded-full px-2 py-0.5 font-mono uppercase tracking-wide text-[10px] font-medium ${
                CONTROL_STATUS_STYLES[status] ??
                "bg-slate-100 text-slate-600 ring-1 ring-slate-200"
              }`}
            >
              {status}
            </span>
          );
        },
      },
      {
        key: "complianceGroup",
        label: "Compliance group",
        sortable: true,
        render: (v) =>
          v ? (
            DOMAIN_LABELS[String(v)] || String(v)
          ) : (
            <span className="text-slate-400">Unclassified</span>
          ),
      },
      {
        key: "owner",
        label: "Owner",
        sortable: true,
        render: (v) => (v ? String(v) : "—"),
      },
      {
        key: "projectName",
        label: "Scope",
        sortable: true,
        render: (v) =>
          v ? String(v) : <span className="text-slate-400">Org-wide</span>,
      },
      {
        key: "_links",
        label: "Linked",
        align: "right",
        render: (_v, r) => {
          const n =
            (r.linkedRegulationIds?.length || 0) +
            (r.linkedRiskIds?.length || 0);
          return <span className="font-mono tabular-nums">{n}</span>;
        },
        exportValue: (_v, r) =>
          String(
            (r.linkedRegulationIds?.length || 0) +
              (r.linkedRiskIds?.length || 0),
          ),
      },
      {
        key: "lastReviewDate",
        label: "Reviewed",
        sortable: true,
        render: (v) => fmtDate(v as string | null),
      },
    ],
    [],
  );

  const filterDefs: FilterDef<Control>[] = [
    {
      key: "status",
      label: "Status",
      type: "select",
      options: CONTROL_STATUSES.map((s) => ({ value: s, label: s })),
    },
    {
      key: "complianceGroup",
      label: "Compliance group",
      type: "select",
      options: [
        { value: "__none__", label: "Unclassified" },
        ...DOMAINS.map((d) => ({ value: d.id, label: d.label })),
      ],
      match: (rowVal, val) =>
        val === "__none__" ? !rowVal : String(rowVal) === String(val),
    },
  ];

  const rowActions: RowAction<Control>[] = canManage
    ? [
        { key: "edit", label: "Edit", icon: Pencil, onClick: openEdit },
        {
          key: "escalate",
          label: (r) =>
            isEscalated(`control:${r.id}`) ? "Escalated to Assurance" : "Escalate to Assurance",
          icon: ShieldAlert,
          // Only a control that isn't holding belongs in the assurance layer.
          isVisible: (r) => r.status === "Failed" || r.status === "Partially Effective",
          isDisabled: (r) =>
            isEscalated(`control:${r.id}`) || escalatingId === `control:${r.id}`,
          onClick: (r) =>
            escalate(`control:${r.id}`, {
              title: r.title,
              description: `Control "${r.title}" status: ${r.status}.${r.description ? ` ${r.description}` : ""}`,
              severity: "High",
              source: "control",
              failureReason: "control_failed",
              sourceRef: { kind: "control", id: `control:${r.id}`, label: r.title },
              projectId: r.projectId || undefined,
              programmeId: r.programmeId || undefined,
            }),
        },
        {
          key: "delete",
          label: "Delete",
          icon: Trash2,
          isDanger: true,
          onClick: handleDelete,
          requireConfirm: {
            title: "Delete control",
            message: (r: Control) =>
              `Permanently delete "${r.title}"? This cannot be undone.`,
            confirmLabel: "Delete",
            isDanger: true,
          },
        },
      ]
    : [];

  return (
    <div className="space-y-6 sm:space-y-8">
      <PageHeader
        title="Controls"
        subtitle="The measures that mitigate risk and evidence compliance — owned, classified and reviewed."
        breadcrumbs={[{ label: "Escalations & Incidents" }, { label: "Controls" }]}
        actions={
          activeProjectId ? (
            <ProjectScopeToggle scope={scope} onChange={setScope} />
          ) : undefined
        }
      />

      <DynamicTable<Control>
        data={scopedControls}
        columns={columns}
        rowActions={rowActions}
        filters={filterDefs}
        getRowId={(r) => r.id}
        loading={controlsLoading && controls.length === 0}
        searchable
        searchPlaceholder="Search controls…"
        searchFields={["title", "reference", "owner", "description"]}
        pagination={{ enabled: true, pageSize: 25, pageSizeOptions: [10, 25, 50] }}
        stickyHeader
        headerVariant="light"
        export={{ xlsx: true, csv: true, filename: "controls" }}
        emptyState={{
          title: "No controls yet",
          description: canManage
            ? "Add a control to start building the assurance library."
            : "No controls have been added yet.",
          icon: ShieldCheck,
        }}
        toolbarActions={
          canManage ? (
            <button
              onClick={openNew}
              className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700"
            >
              <Plus className="h-4 w-4" /> Add control
            </button>
          ) : undefined
        }
      />

      {modalOpen && (
        <ControlModal
          control={editing}
          onClose={() => setModalOpen(false)}
          onSave={handleSave}
        />
      )}
    </div>
  );
}
