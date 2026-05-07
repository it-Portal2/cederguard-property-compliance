import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router";
import { ClipboardList, AlertCircle, Mail, FileText } from "lucide-react";
import { motion } from "motion/react";

import DynamicTable from "../../components/table/DynamicTable";
import { StatsCard } from "../../components/common/StatsCard";
import { api } from "../../lib/api";
import { useStore } from "../../store/useStore";
import type {
  ColumnDef,
  FilterDef,
  RowAction,
} from "../../components/table/types";
import type {
  Rfi,
  RfiPriority,
  RfiStatus,
} from "../../types/technicalAssurance";
import { CheckCircle2, Inbox, Send } from "lucide-react";

// Phase 5 — RFI register. Workspace-scoped DynamicTable of issued RFIs.
// Reuses the same DynamicTable + StatsCard chrome as the Enquiries page.

const PRIORITY_PILL: Record<RfiPriority, string> = {
  high: "bg-rose-50 text-rose-700 border border-rose-200",
  medium: "bg-amber-50 text-amber-800 border border-amber-200",
  low: "bg-slate-100 text-slate-700 border border-slate-200",
};

const STATUS_PILL: Record<RfiStatus, string> = {
  Draft: "bg-slate-100 text-slate-700 border border-slate-200",
  Issued: "bg-indigo-50 text-indigo-700 border border-indigo-200",
  Responded: "bg-emerald-50 text-emerald-700 border border-emerald-200",
  Closed: "bg-emerald-100 text-emerald-800 border border-emerald-300",
};

function formatGbDate(iso?: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return "—";
  }
}

export function TacRfiRegisterPage() {
  const navigate = useNavigate();
  const projects = useStore((s) => s.projects);
  const [items, setItems] = useState<Rfi[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const projectNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of projects ?? []) {
      if (p?.id) map.set(p.id, p.name ?? p.id);
    }
    return map;
  }, [projects]);

  const refresh = useCallback(async () => {
    try {
      setError(null);
      const res = await api.tacListRfis();
      setItems((res?.items ?? []) as Rfi[]);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load RFI register.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const counts = useMemo(() => {
    let issued = 0;
    let responded = 0;
    let closed = 0;
    for (const r of items) {
      if (r.status === "Issued") issued += 1;
      else if (r.status === "Responded") responded += 1;
      else if (r.status === "Closed") closed += 1;
    }
    return { total: items.length, issued, responded, closed };
  }, [items]);

  const columns: ColumnDef<Rfi>[] = useMemo(
    () => [
      {
        key: "rfiNumber",
        label: "RFI",
        sortable: true,
        render: (_v, row) => (
          <span className="font-mono text-[12px] font-bold text-indigo-700">
            {row.rfiNumber}
          </span>
        ),
      },
      {
        key: "subject",
        label: "Subject",
        sortable: true,
        render: (_v, row) => (
          <p className="truncate text-sm font-semibold text-slate-900">
            {row.subject}
          </p>
        ),
      },
      {
        key: "projectId",
        label: "Project",
        render: (v) => (
          <span className="text-[12px] text-slate-700">
            {projectNameById.get(String(v)) ?? "—"}
          </span>
        ),
      },
      {
        key: "priority",
        label: "Priority",
        sortable: true,
        render: (v) => (
          <span
            className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold capitalize ${
              PRIORITY_PILL[(v as RfiPriority) ?? "medium"] ?? PRIORITY_PILL.medium
            }`}
          >
            {String(v ?? "medium")}
          </span>
        ),
      },
      {
        key: "status",
        label: "Status",
        sortable: true,
        render: (v) => (
          <span
            className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${
              STATUS_PILL[(v as RfiStatus) ?? "Issued"] ?? STATUS_PILL.Issued
            }`}
          >
            {String(v ?? "Issued")}
          </span>
        ),
      },
      {
        key: "issuedAt",
        label: "Issued",
        sortable: true,
        render: (v) => (
          <span className="text-[12px] text-slate-500">
            {formatGbDate(v ? String(v) : null)}
          </span>
        ),
      },
    ],
    [projectNameById],
  );

  const filters: FilterDef<Rfi>[] = useMemo(
    () => [
      {
        key: "priority",
        label: "Priority",
        type: "select",
        options: [
          { value: "high", label: "High" },
          { value: "medium", label: "Medium" },
          { value: "low", label: "Low" },
        ],
      },
      {
        key: "status",
        label: "Status",
        type: "select",
        options: [
          { value: "Issued", label: "Issued" },
          { value: "Responded", label: "Responded" },
          { value: "Closed", label: "Closed" },
        ],
      },
    ],
    [],
  );

  const rowActions: RowAction<Rfi>[] = useMemo(
    () => [
      {
        key: "open",
        label: "Open enquiry",
        icon: FileText,
        onClick: (row) => {
          if (row.enquiryId) {
            navigate(
              `/technical-assurance/enquiries/${encodeURIComponent(row.enquiryId)}`,
            );
          }
        },
        isVisible: (row) => Boolean(row.enquiryId),
      },
    ],
    [navigate],
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="space-y-6"
    >
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
            <ClipboardList className="h-5 w-5" strokeWidth={2.25} />
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">
              Technical Assurance
            </p>
            <h1 className="text-xl font-bold tracking-tight text-slate-900 md:text-2xl">
              RFI register
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Every Request for Information issued from a TAC enquiry,
              workspace-wide.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatsCard
          title="Total"
          value={counts.total}
          icon={ClipboardList}
          iconBgClassName="bg-indigo-50 dark:bg-indigo-900/30"
          iconClassName="text-indigo-600 dark:text-indigo-400"
          valueClassName="text-indigo-600 dark:text-indigo-400"
        />
        <StatsCard
          title="Issued"
          value={counts.issued}
          icon={Send}
          iconBgClassName="bg-amber-50 dark:bg-amber-900/30"
          iconClassName="text-amber-600 dark:text-amber-400"
          valueClassName="text-amber-600 dark:text-amber-400"
        />
        <StatsCard
          title="Responded"
          value={counts.responded}
          icon={Inbox}
          iconBgClassName="bg-emerald-50 dark:bg-emerald-900/30"
          iconClassName="text-emerald-600 dark:text-emerald-400"
          valueClassName="text-emerald-600 dark:text-emerald-400"
        />
        <StatsCard
          title="Closed"
          value={counts.closed}
          icon={CheckCircle2}
          iconBgClassName="bg-slate-100 dark:bg-slate-700"
          iconClassName="text-slate-700 dark:text-slate-300"
          valueClassName="text-slate-900 dark:text-slate-100"
        />
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <DynamicTable<Rfi>
        data={items}
        columns={columns}
        filters={filters}
        rowActions={rowActions}
        loading={loading}
        searchable
        searchPlaceholder="Search RFI number or subject…"
        searchFields={["rfiNumber", "subject"]}
        emptyState={{
          title: "No RFIs issued yet",
          description:
            "Issue an RFI from any enquiry's RFI tab to populate the register.",
          icon: Mail,
          action: (
            <Link
              to="/technical-assurance/enquiries"
              className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-indigo-700"
            >
              Open enquiries
            </Link>
          ),
        }}
      />
    </motion.div>
  );
}
