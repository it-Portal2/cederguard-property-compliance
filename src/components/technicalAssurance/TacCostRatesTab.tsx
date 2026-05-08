// Phase 6b — TAC custom cost rates tab on WorkspaceSettings.
//
// ClientAdmin / SuperAdmin add custom rates that shadow the seed library.
// The merged list (shared seed + own custom) is rendered with a Source
// pill so the admin can see at a glance which rates are platform-wide vs
// council-specific. Custom rates can be edited / deleted; seed rates are
// read-only (admin overrides by adding a custom with the same rateId).
//
// Layout: 7-category section header + DynamicTable per merged list +
// CostRateEditor modal for create/edit. Uses existing ConfirmDialog for
// delete confirmations.

import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, Pencil, Trash2, AlertCircle, Loader2 } from "lucide-react";
import toast from "react-hot-toast";
import { motion } from "motion/react";

import DynamicTable from "../table/DynamicTable";
import ConfirmDialog from "../table/ConfirmDialog";
import { CostRateEditor } from "./CostRateEditor";
import { api } from "../../lib/api";
import type { ColumnDef, FilterDef, RowAction } from "../table/types";
import type { CostRate, CostRateCategory } from "../../types/technicalAssurance";

const CATEGORY_LABEL: Record<CostRateCategory, string> = {
  preliminaries: "Preliminaries",
  substructure: "Substructure",
  frame: "Frame",
  me: "Mechanical & Electrical",
  finishes: "Finishes",
  external: "External works",
  fees: "Fees & soft costs",
};

const CATEGORY_FILTER_OPTIONS = Object.entries(CATEGORY_LABEL).map(
  ([value, label]) => ({ value, label }),
);

const SHARED_CLIENT_ID = "__shared__";

function formatGBP(rate: number, unit: string): string {
  const num = Number(rate);
  if (!Number.isFinite(num)) return "—";
  const out = num.toLocaleString("en-GB", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
  return `£${out} / ${unit}`;
}

export function TacCostRatesTab() {
  const [rates, setRates] = useState<CostRate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<CostRate | null>(null);
  const [deleteRow, setDeleteRow] = useState<CostRate | null>(null);
  const [deleting, setDeleting] = useState(false);

  const refresh = useCallback(async () => {
    try {
      setError(null);
      const r = await api.tacListCostRates();
      if (!r?.success) throw new Error(r?.error ?? "Failed to load rates");
      setRates(Array.isArray(r.items) ? (r.items as CostRate[]) : []);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load rates");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Optimistic save — applies the server-returned row to local state
  // immediately so the table updates without waiting for the refresh
  // round-trip. Refresh runs fire-and-forget to reconcile any drift.
  const handleSave = useCallback(
    async (rate: {
      rateId: string;
      category: CostRateCategory;
      description: string;
      unit: CostRate["unit"];
      rate: number;
    }) => {
      try {
        const r = await api.tacUpsertCostRate(rate);
        if (!r?.success) throw new Error(r?.error ?? "Save failed");
        const saved = r.rate as CostRate;
        // Insert / update the row in local state. Custom rows shadow seeds
        // by rateId — match-by-rateId; if a seed row has that id, replace
        // it with the new custom row.
        setRates((prev) => {
          const idx = prev.findIndex((p) => p.rateId === saved.rateId);
          if (idx >= 0) return prev.map((p, i) => (i === idx ? saved : p));
          return [...prev, saved];
        });
        toast.success(editing ? "Custom rate updated" : "Custom rate added");
        setEditorOpen(false);
        setEditing(null);
        void refresh();
      } catch (e: any) {
        toast.error(e?.message ?? "Save failed");
      }
    },
    [editing, refresh],
  );

  // Optimistic delete — drops the row from local state instantly. Server
  // either hard-deletes a custom row OR writes a hidden marker for a
  // seed row; either way the merged-list outcome is "row gone for this
  // workspace".
  const handleDeleteConfirm = useCallback(async () => {
    if (!deleteRow || deleting) return;
    const target = deleteRow;
    setDeleting(true);
    try {
      const r = await api.tacDeleteCostRate(target.rateId);
      if (!r?.success) throw new Error(r?.error ?? "Delete failed");
      setRates((prev) => prev.filter((p) => p.rateId !== target.rateId));
      toast.success(
        r.mode === "hidden-seed"
          ? "Seed rate hidden from this workspace"
          : "Custom rate deleted",
      );
      setDeleting(false);
      setDeleteRow(null);
      void refresh();
    } catch (e: any) {
      toast.error(e?.message ?? "Delete failed");
      setDeleting(false);
    }
  }, [deleteRow, deleting, refresh]);

  const columns: ColumnDef<CostRate>[] = useMemo(
    () => [
      {
        key: "description",
        label: "Description",
        sortable: true,
        render: (_v, row) => (
          <div>
            <div className="font-medium text-slate-900">{row.description}</div>
            <div className="mt-0.5 font-mono text-[11px] text-slate-500">
              {row.rateId}
            </div>
          </div>
        ),
      },
      {
        key: "category",
        label: "Category",
        sortable: true,
        width: "200px",
        render: (v) => (
          <span className="text-[12px] text-slate-700">
            {CATEGORY_LABEL[v as CostRateCategory] ?? v}
          </span>
        ),
      },
      {
        key: "rate",
        label: "Rate",
        sortable: true,
        width: "160px",
        align: "right",
        render: (_v, row) => (
          <span className="font-mono text-[13px] text-slate-900">
            {formatGBP(row.rate, row.unit)}
          </span>
        ),
      },
      {
        key: "source",
        label: "Source",
        sortable: true,
        width: "120px",
        render: (_v, row) => {
          const isCustom = row.clientId !== SHARED_CLIENT_ID;
          return (
            <span
              className={
                isCustom
                  ? "inline-flex items-center rounded-md bg-indigo-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-indigo-700"
                  : "inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-600"
              }
            >
              {isCustom ? "Custom" : "Seed"}
            </span>
          );
        },
      },
    ],
    [],
  );

  const filters: FilterDef<CostRate>[] = useMemo(
    () => [
      {
        key: "category",
        label: "Category",
        type: "select",
        options: CATEGORY_FILTER_OPTIONS,
      },
      {
        key: "source",
        label: "Source",
        type: "select",
        options: [
          { value: "custom", label: "Custom only" },
          { value: "seed", label: "Seed only" },
        ],
        match: (row, value) => {
          if (!value) return true;
          const isCustom = row.clientId !== SHARED_CLIENT_ID;
          return value === "custom" ? isCustom : !isCustom;
        },
      },
    ],
    [],
  );

  const rowActions: RowAction<CostRate>[] = useMemo(
    () => [
      {
        key: "edit",
        label: (row) =>
          row.clientId === SHARED_CLIENT_ID
            ? "Override (creates custom)"
            : "Edit custom rate",
        icon: Pencil,
        onClick: (row) => {
          // Editing a seed clones it as a custom override (rateId stays
          // the same — the custom row shadows the seed via `loadCostRates`).
          setEditing(row);
          setEditorOpen(true);
        },
      },
      {
        key: "delete",
        // Custom rows hard-delete; seed rows write a per-tenant hidden
        // marker (server-side) so this workspace stops seeing them, but
        // other tenants still get the seed.
        label: (row) =>
          row.clientId === SHARED_CLIENT_ID
            ? "Hide seed from workspace"
            : "Delete custom rate",
        icon: Trash2,
        isDanger: true,
        onClick: (row) => setDeleteRow(row),
      },
    ],
    [],
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="space-y-5"
    >
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0 md:flex-1">
          <h2 className="text-lg font-bold tracking-tight text-slate-900">
            Cost rates library
          </h2>
          <p className="mt-1 text-[13px] text-slate-500">
            Council-specific rates that shadow the platform seed library by
            rateId. The Technical Assurance AI uses these when generating
            insight cost lines.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setEditing(null);
            setEditorOpen(true);
          }}
          className="inline-flex shrink-0 items-center justify-center gap-2 self-start whitespace-nowrap rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700"
        >
          <Plus className="h-4 w-4 shrink-0" />
          <span>New custom rate</span>
        </button>
      </div>

      {error ? (
        <div className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50/60 p-3 text-[13px] text-rose-700">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          {error}
        </div>
      ) : null}

      <DynamicTable<CostRate>
        data={rates}
        columns={columns}
        filters={filters}
        rowActions={rowActions}
        searchable
        searchPlaceholder="Search rate library"
        searchFields={["description", "rateId" as keyof CostRate]}
        loading={loading}
        getRowId={(row) =>
          `${row.clientId === SHARED_CLIENT_ID ? "seed" : "custom"}-${row.rateId}`
        }
        pagination={{
          enabled: true,
          pageSize: 20,
          pageSizeOptions: [10, 20, 50, 100],
        }}
        emptyState={{
          title: "No rates loaded yet",
          description: loading
            ? "Loading…"
            : "Click New custom rate to add one for this workspace.",
          icon: Loader2,
        }}
      />

      <p className="rounded-lg border border-slate-200 bg-slate-50/40 p-3 text-[11px] leading-5 text-slate-500">
        Rates are indicative and used by the AI as a benchmark when drafting
        cost+programme deliverables. Cross-check against your published
        rates schedule before issuing for tender. To override a seed rate,
        edit it from this list — that creates a custom shadow with the same
        rateId.
      </p>

      <CostRateEditor
        open={editorOpen}
        rate={editing}
        onSave={handleSave}
        onCancel={() => {
          setEditorOpen(false);
          setEditing(null);
        }}
      />

      <ConfirmDialog
        open={deleteRow !== null}
        onCancel={() => setDeleteRow(null)}
        onConfirm={handleDeleteConfirm}
        title={
          deleteRow?.clientId === SHARED_CLIENT_ID
            ? "Hide this seed rate from your workspace?"
            : "Delete custom cost rate?"
        }
        message={
          deleteRow?.clientId === SHARED_CLIENT_ID
            ? `"${deleteRow?.description ?? ""}" (${deleteRow?.rateId ?? ""}) is a platform-shared seed rate. It won't be deleted globally — instead it will be hidden from your workspace only. Other tenants still see it. You can restore it later by adding a custom rate with the same rateId.`
            : `"${deleteRow?.description ?? ""}" (${deleteRow?.rateId ?? ""}) will be removed from this workspace's custom library. The seed version (if one exists) will become active again.`
        }
        confirmLabel={
          deleteRow?.clientId === SHARED_CLIENT_ID
            ? "Hide from workspace"
            : "Delete custom rate"
        }
        variant="danger"
        loading={deleting}
      />
    </motion.div>
  );
}
