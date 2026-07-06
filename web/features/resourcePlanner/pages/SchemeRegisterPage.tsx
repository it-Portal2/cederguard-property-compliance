import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { Plus, Pencil, Trash2, ClipboardList, Upload } from "lucide-react";
import PageHeader from "../../../components/PageHeader";
import DynamicTable from "../../../components/table/DynamicTable";
import { useStore } from "../../../store/useStore";
import {
  ProjectScopeToggle,
  scopeByProject,
  type ProjectScope,
} from "../../../components/common/ProjectScope";
import SchemeModal from "../components/SchemeModal";
import ImportModal from "../components/ImportModal";
import type { ColumnDef, RowAction } from "../../../components/table/types";
import type { ResourceScheme } from "../../../lib/resourcePlanner/types";

const fmtDate = (v?: string | null) => (v ? String(v).slice(0, 10) : "—");

export default function SchemeRegisterPage() {
  const resourceSchemes = useStore((s) => s.resourceSchemes);
  const resourcePlannerLoading = useStore((s) => s.resourcePlannerLoading);
  const loadResourcePlanner = useStore((s) => s.loadResourcePlanner);
  const saveResourceScheme = useStore((s) => s.saveResourceScheme);
  const deleteResourceScheme = useStore((s) => s.deleteResourceScheme);
  const canManageResourcePlanner = useStore((s) => s.canManageResourcePlanner);
  const activeProjectId = useStore((s) => s.activeProjectId);

  // Q5.4 — schemes are project-scoped; unassigned = portfolio-only (includeUntagged:false).
  const [scope, setScope] = useState<ProjectScope>(
    activeProjectId ? "project" : "all",
  );
  useEffect(() => {
    setScope(activeProjectId ? "project" : "all");
  }, [activeProjectId]);
  const scopedSchemes = useMemo(
    () =>
      scopeByProject(resourceSchemes, scope, activeProjectId, {
        includeUntagged: false,
      }),
    [resourceSchemes, scope, activeProjectId],
  );
  const canManage = canManageResourcePlanner();

  const [editing, setEditing] = useState<ResourceScheme | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  useEffect(() => {
    loadResourcePlanner();
  }, [loadResourcePlanner]);

  const openNew = () => {
    setEditing(null);
    setModalOpen(true);
  };
  const openEdit = (s: ResourceScheme) => {
    setEditing(s);
    setModalOpen(true);
  };

  const handleSave = async (scheme: ResourceScheme) => {
    try {
      await saveResourceScheme(scheme);
      toast.success("Scheme saved");
    } catch (e: any) {
      toast.error(e?.message || "Could not save scheme");
      throw e;
    }
  };

  const handleDelete = async (s: ResourceScheme) => {
    try {
      await deleteResourceScheme(s.id);
      toast.success("Scheme deleted");
    } catch (e: any) {
      toast.error(e?.message || "Could not delete scheme");
    }
  };

  const columns: ColumnDef<ResourceScheme>[] = [
    { key: "name", label: "Scheme", sortable: true, truncate: true },
    { key: "status", label: "Status", sortable: true },
    { key: "programme", label: "Programme", sortable: true },
    {
      key: "complexity",
      label: "Complexity",
      sortable: true,
      render: (_v, r) =>
        r.complexity ? (
          <span className="font-mono uppercase tracking-wide text-[11px] font-medium text-slate-600">
            {r.complexity}
          </span>
        ) : (
          <span className="font-mono text-[11px] text-amber-600">
            {r.complexityRaw || "unmapped"}
          </span>
        ),
    },
    { key: "deliveryRoute", label: "Route", sortable: true },
    {
      key: "allHomes",
      label: "Homes",
      align: "right",
      sortable: true,
      render: (v) => (
        <span className="font-mono tabular-nums">{Number(v) || 0}</span>
      ),
    },
    { key: "sosDate", label: "SoS", sortable: true, render: (v) => fmtDate(v) },
    { key: "handoverDate", label: "Handover", sortable: true, render: (v) => fmtDate(v) },
    { key: "eodDate", label: "EOD", sortable: true, render: (v) => fmtDate(v) },
  ];

  const rowActions: RowAction<ResourceScheme>[] = canManage
    ? [
        {
          key: "edit",
          label: "Edit",
          icon: Pencil,
          onClick: openEdit,
        },
        {
          key: "delete",
          label: "Delete",
          icon: Trash2,
          isDanger: true,
          onClick: handleDelete,
          requireConfirm: {
            title: "Delete scheme",
            message: (r: ResourceScheme) =>
              `Permanently delete "${r.name}"? This cannot be undone.`,
            confirmLabel: "Delete",
            isDanger: true,
          },
        },
      ]
    : [];

  return (
    <div className="space-y-6 sm:space-y-8">
      <PageHeader
        title="Scheme Register"
        subtitle="The schemes that drive resource demand — dates, complexity and homes."
        breadcrumbs={[{ label: "Resource Planner" }, { label: "Scheme Register" }]}
        actions={
          activeProjectId ? (
            <ProjectScopeToggle scope={scope} onChange={setScope} />
          ) : undefined
        }
      />

      <DynamicTable<ResourceScheme>
        data={scopedSchemes}
        columns={columns}
        rowActions={rowActions}
        getRowId={(r) => r.id}
        loading={resourcePlannerLoading && resourceSchemes.length === 0}
        searchable
        searchPlaceholder="Search schemes…"
        searchFields={["name", "programme", "status", "projectCode"]}
        pagination={{ enabled: true, pageSize: 25, pageSizeOptions: [10, 25, 50] }}
        stickyHeader
        headerVariant="light"
        export={{ xlsx: true, csv: true, filename: "resource-schemes" }}
        emptyState={{
          title: "No schemes yet",
          description: canManage
            ? "Add a scheme or import them from a spreadsheet."
            : "No schemes have been added yet.",
          icon: ClipboardList,
        }}
        toolbarActions={
          canManage ? (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setImportOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
              >
                <Upload className="h-4 w-4" /> Import
              </button>
              <button
                onClick={openNew}
                className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700"
              >
                <Plus className="h-4 w-4" /> Add scheme
              </button>
            </div>
          ) : undefined
        }
      />

      {modalOpen && (
        <SchemeModal
          scheme={editing}
          onClose={() => setModalOpen(false)}
          onSave={handleSave}
        />
      )}
      {importOpen && (
        <ImportModal
          onClose={() => setImportOpen(false)}
          onImported={() => loadResourcePlanner(true)}
        />
      )}
    </div>
  );
}
