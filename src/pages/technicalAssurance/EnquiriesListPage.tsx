import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router";
import {
  MessageSquare,
  Plus,
  Pencil,
  Trash2,
  RotateCcw,
  Eye,
  Paperclip,
  AlertCircle,
  FilePen,
  Activity,
  CheckCircle2,
  Inbox,
  Wand2,
} from "lucide-react";
import toast from "react-hot-toast";
import { motion } from "motion/react";

import DynamicTable from "../../components/table/DynamicTable";
import { StatsCard } from "../../components/common/StatsCard";
import { ReasonDialog } from "../../components/governance/ReasonDialog";
import { NewEnquiryModal } from "../../components/technicalAssurance/NewEnquiryModal";
import { api } from "../../lib/api";
import { useTechnicalAssuranceStore } from "../../store/technicalAssuranceStore";
import type { ColumnDef, FilterDef, RowAction } from "../../components/table/types";
import type {
  Enquiry,
  EnquiryStatus,
} from "../../types/technicalAssurance";
import { getRIBALabel } from "../../constants/ribaStages";
import { useStore } from "../../store/useStore";
import { isAtLeastClientAdmin, isSuperAdmin } from "../../lib/roles";

// Phase 1 — Enquiries list. Replaces the Phase 0 placeholder.
//
// Adds DynamicTable + 4 StatsCards + Status / soft-delete filters +
// "+ New enquiry" toolbar action. Open-editor row action navigates to the
// (still-placeholder) enquiry workspace at `/technical-assurance/enquiries/:id`.

const STATUS_PILL: Record<EnquiryStatus, string> = {
  Draft: "bg-slate-100 text-slate-700 border border-slate-200",
  Generating: "bg-amber-50 text-amber-800 border border-amber-200",
  Open: "bg-indigo-50 text-indigo-700 border border-indigo-200",
  AwaitingReview: "bg-violet-50 text-violet-700 border border-violet-200",
  Approved: "bg-emerald-50 text-emerald-700 border border-emerald-200",
  Closed: "bg-emerald-100 text-emerald-800 border border-emerald-300",
  Archived: "bg-slate-50 text-slate-500 border border-slate-200",
};

const STATUS_OPTIONS = [
  { value: "Draft", label: "Draft" },
  { value: "Generating", label: "Generating" },
  { value: "Open", label: "Open" },
  { value: "AwaitingReview", label: "Awaiting Review" },
  { value: "Approved", label: "Approved" },
  { value: "Closed", label: "Closed" },
  { value: "Archived", label: "Archived" },
];

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

export function TacEnquiriesListPage() {
  const navigate = useNavigate();
  const user = useStore((s) => s.user);
  const projects = useStore((s) => s.projects);
  const setEnquiries = useTechnicalAssuranceStore((s) => s.setEnquiries);
  const enquiriesCache = useTechnicalAssuranceStore(
    (s) => s.enquiriesCache,
  );

  const [items, setItems] = useState<Enquiry[]>(enquiriesCache ?? []);
  const [loading, setLoading] = useState<boolean>(enquiriesCache === null);
  const [error, setError] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingEnquiry, setEditingEnquiry] = useState<Enquiry | null>(null);

  const [softDeleteRow, setSoftDeleteRow] = useState<Enquiry | null>(null);
  const [softDeleting, setSoftDeleting] = useState(false);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [generatingId, setGeneratingId] = useState<string | null>(null);

  const userRole = user?.role || user?.profile?.role;
  const isAdmin = isSuperAdmin(user?.email, userRole);
  const isClientAdmin = isAtLeastClientAdmin(userRole) || isAdmin;

  // Project name lookup for the table column.
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
      const res = await api.tacListEnquiries();
      const list = (res?.items ?? []) as Enquiry[];
      setItems(list);
      setEnquiries(list);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load enquiries.");
    } finally {
      setLoading(false);
    }
  }, [setEnquiries]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // --- StatsCards counts -------------------------------------------------
  const counts = useMemo(() => {
    let drafting = 0;
    let generating = 0;
    let open = 0;
    let closed = 0;
    for (const it of items) {
      if (it.softDeleted) continue;
      if (it.status === "Draft") drafting += 1;
      else if (it.status === "Generating") generating += 1;
      else if (
        it.status === "Open" ||
        it.status === "AwaitingReview" ||
        it.status === "Approved"
      )
        open += 1;
      else if (it.status === "Closed" || it.status === "Archived") closed += 1;
    }
    return { drafting, generating, open, closed };
  }, [items]);

  // --- Table config ------------------------------------------------------
  const columns: ColumnDef<Enquiry>[] = useMemo(
    () => [
      {
        key: "title",
        label: "Enquiry",
        sortable: true,
        render: (_v, row) => (
          <div className="min-w-0">
            <p
              className={
                row.softDeleted
                  ? "truncate text-sm font-semibold text-slate-400 line-through"
                  : "truncate text-sm font-semibold text-slate-900"
              }
            >
              {row.title}
            </p>
            {row.query && (
              <p className="mt-0.5 line-clamp-1 text-[12px] text-slate-500">
                {row.query.slice(0, 140)}
              </p>
            )}
          </div>
        ),
      },
      {
        key: "status",
        label: "Status",
        sortable: true,
        render: (v) => (
          <span
            className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${
              STATUS_PILL[(v as EnquiryStatus) ?? "Draft"] ?? STATUS_PILL.Draft
            }`}
          >
            {v}
          </span>
        ),
      },
      {
        key: "ribaStage",
        label: "RIBA",
        sortable: true,
        render: (v) =>
          v ? (
            <span
              className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700"
              title={getRIBALabel(String(v))}
            >
              {String(v)}
            </span>
          ) : (
            <span className="text-[12px] text-slate-400">—</span>
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
        key: "attachments",
        label: "Files",
        align: "right",
        render: (_v, row) => {
          const n = (row.attachments ?? []).length;
          return (
            <span className="inline-flex items-center gap-1 text-[12px] text-slate-600">
              <Paperclip className="h-3 w-3 text-slate-400" />
              {n}
            </span>
          );
        },
      },
      {
        key: "updatedAt",
        label: "Updated",
        sortable: true,
        render: (v) => (
          <span className="text-[12px] text-slate-500">
            {formatGbDate(String(v))}
          </span>
        ),
      },
    ],
    [projectNameById],
  );

  const filters: FilterDef<Enquiry>[] = useMemo(
    () => [
      {
        key: "status",
        label: "Status",
        type: "select",
        options: STATUS_OPTIONS,
      },
      {
        key: "softDeleted",
        label: "",
        type: "select",
        options: [
          { value: "false", label: "Active" },
          { value: "true", label: "Soft-deleted" },
        ],
        match: (rowValue, filterValue) => {
          const want = filterValue === "true";
          return Boolean(rowValue) === want;
        },
      },
    ],
    [],
  );

  // Default view hides soft-deleted (lesson #43 — let DynamicTable own
  // filtering; we just use a default state).
  // We surface the toggle via the filter chrome; user picks Soft-deleted.

  const canEditRow = useCallback(
    (row: Enquiry) => {
      if (!user) return false;
      if (isAdmin || isClientAdmin) return true;
      return row.ownerUid === user.uid;
    },
    [user, isAdmin, isClientAdmin],
  );

  const handleOpenWorkspace = useCallback(
    (row: Enquiry) => {
      // Client-side navigation — preserves Zustand store + skips a full
      // network reload. Was previously `window.location.href = ...` which
      // forced the browser to refetch the bundle (visible flicker).
      navigate(`/technical-assurance/enquiries/${encodeURIComponent(row.id)}`);
    },
    [navigate],
  );

  const handleEdit = useCallback(
    (row: Enquiry) => {
      if (!canEditRow(row)) return;
      setEditingEnquiry(row);
      setModalOpen(true);
    },
    [canEditRow],
  );

  const handleSoftDeleteConfirm = useCallback(
    async (reason: string) => {
      if (!softDeleteRow) return;
      try {
        setSoftDeleting(true);
        await api.tacSoftDeleteEnquiry(softDeleteRow.id, reason);
        toast.success("Enquiry moved to soft-deleted");
        setSoftDeleteRow(null);
        await refresh();
      } catch (e: any) {
        toast.error(e?.message ?? "Failed to soft-delete.");
      } finally {
        setSoftDeleting(false);
      }
    },
    [softDeleteRow, refresh],
  );

  const handleRestore = useCallback(
    async (row: Enquiry) => {
      if (restoringId) return;
      try {
        setRestoringId(row.id);
        await api.tacRestoreEnquiry(row.id);
        toast.success("Enquiry restored");
        await refresh();
      } catch (e: any) {
        toast.error(e?.message ?? "Failed to restore.");
      } finally {
        setRestoringId(null);
      }
    },
    [restoringId, refresh],
  );

  const handleGenerateInsight = useCallback(
    async (row: Enquiry) => {
      if (generatingId) return;
      const t = toast.loading(
        "Generating insight — this can take up to 25s…",
      );
      try {
        setGeneratingId(row.id);
        // Optimistic flip so the user sees the pulse pill immediately.
        setItems((prev) =>
          prev.map((p) =>
            p.id === row.id ? { ...p, status: "Generating" as const } : p,
          ),
        );
        await api.tacGenerateInsight(row.id);
        toast.success("Insight ready", { id: t });
        await refresh();
      } catch (e: any) {
        const msg = e?.message ?? "Failed to generate insight.";
        const code = e?.code;
        toast.error(
          code === "INSUFFICIENT_CITATIONS"
            ? "Insight generation blocked: at least one regulation citation is required."
            : code === "EMPTY_CORPUS"
              ? "Regulations corpus is empty. Ask a super-admin to seed it."
              : code === "INVALID_OPTIONS_COUNT"
                ? "AI returned an unexpected number of options. Try again."
                : msg,
          { id: t },
        );
        // Revert optimistic flip + refresh from the server (which already
        // rolled status back to Draft on failure).
        await refresh();
      } finally {
        setGeneratingId(null);
      }
    },
    [generatingId, refresh],
  );

  const rowActions: RowAction<Enquiry>[] = useMemo(
    () => [
      {
        key: "open",
        label: "Open workspace",
        icon: Eye,
        onClick: handleOpenWorkspace,
        isVisible: (row) => !row.softDeleted,
      },
      {
        key: "edit",
        label: (row) =>
          row.status === "Draft" ? "Edit details" : "View details",
        icon: Pencil,
        onClick: handleEdit,
        isVisible: (row) => !row.softDeleted && canEditRow(row),
      },
      {
        key: "generate",
        label: "Generate insight",
        icon: Wand2,
        onClick: handleGenerateInsight,
        isVisible: (row) =>
          !row.softDeleted &&
          row.status === "Draft" &&
          canEditRow(row),
        isLoading: (row) => generatingId === row.id,
        isDisabled: (row) =>
          generatingId !== null && generatingId !== row.id,
      },
      {
        key: "softDelete",
        label: "Soft-delete",
        icon: Trash2,
        isDanger: true,
        onClick: (row) => setSoftDeleteRow(row),
        isVisible: (row) => !row.softDeleted && canEditRow(row),
      },
      {
        key: "restore",
        label: "Restore",
        icon: RotateCcw,
        onClick: handleRestore,
        isVisible: (row) => Boolean(row.softDeleted) && canEditRow(row),
        isLoading: (row) => restoringId === row.id,
      },
    ],
    [
      canEditRow,
      handleEdit,
      handleOpenWorkspace,
      handleRestore,
      handleGenerateInsight,
      restoringId,
      generatingId,
    ],
  );

  const handleNewClicked = () => {
    setEditingEnquiry(null);
    setModalOpen(true);
  };

  const handleSaved = (saved: Enquiry) => {
    setItems((prev) => {
      const next = prev.find((p) => p.id === saved.id)
        ? prev.map((p) => (p.id === saved.id ? saved : p))
        : [saved, ...prev];
      setEnquiries(next);
      return next;
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="space-y-6"
    >
      {/* Header */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
            <MessageSquare className="h-5 w-5" strokeWidth={2.25} />
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">
              Technical Assurance
            </p>
            <h1 className="text-xl font-bold tracking-tight text-slate-900 md:text-2xl">
              Enquiries
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Capture technical queries with attachments and route them through
              regulation-cited insights.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={handleNewClicked}
          className="inline-flex items-center justify-center gap-2 self-start rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700"
        >
          <Plus className="h-4 w-4" />
          New enquiry
        </button>
      </div>

      {/* StatsCards */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatsCard
          title="Drafting"
          value={counts.drafting}
          icon={FilePen}
          iconBgClassName="bg-indigo-50 dark:bg-indigo-900/30"
          iconClassName="text-indigo-600 dark:text-indigo-400"
          valueClassName="text-indigo-600 dark:text-indigo-400"
        />
        <StatsCard
          title="Generating"
          value={counts.generating}
          icon={Activity}
          iconBgClassName="bg-amber-50 dark:bg-amber-900/30"
          iconClassName="text-amber-600 dark:text-amber-400"
          valueClassName="text-amber-600 dark:text-amber-400"
        />
        <StatsCard
          title="Open"
          value={counts.open}
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

      {/* Table */}
      <DynamicTable<Enquiry>
        data={items}
        columns={columns}
        filters={filters}
        rowActions={rowActions}
        loading={loading}
        searchable
        searchPlaceholder="Search title or query…"
        searchFields={["title", "query"]}
        emptyState={{
          title: "No enquiries yet",
          description:
            "Click 'New enquiry' to capture your first technical query.",
          icon: MessageSquare,
          action: (
            <button
              type="button"
              onClick={handleNewClicked}
              className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-indigo-700"
            >
              <Plus className="h-3.5 w-3.5" />
              New enquiry
            </button>
          ),
        }}
      />

      {/* Cross-link to RFI register for discoverability */}
      <p className="text-[11px] text-slate-400">
        Looking for issued RFIs?{" "}
        <Link
          to="/technical-assurance/rfis"
          className="font-semibold text-indigo-600 hover:underline"
        >
          Open the RFI register
        </Link>
        .
      </p>

      {/* Modal */}
      <NewEnquiryModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        enquiry={editingEnquiry}
        onSaved={handleSaved}
      />

      {/* Soft-delete reason dialog */}
      <ReasonDialog
        open={softDeleteRow !== null}
        onCancel={() => setSoftDeleteRow(null)}
        onConfirm={handleSoftDeleteConfirm}
        title="Soft-delete this enquiry?"
        message={`"${
          softDeleteRow?.title ?? ""
        }" will be hidden from the active list. You can restore it later from the Soft-deleted filter.`}
        reasonLabel="Reason for soft-deletion"
        reasonPlaceholder="e.g. Duplicate of TAC-1234. Closing in favour of that one."
        confirmLabel="Soft-delete"
        variant="danger"
        loading={softDeleting}
      />

    </motion.div>
  );
}
