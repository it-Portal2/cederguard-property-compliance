import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router";
import {
  MessageSquare,
  Plus,
  Pencil,
  Trash2,
  Eye,
  Paperclip,
  AlertCircle,
  FilePen,
  Activity,
  CheckCircle2,
  Inbox,
  Archive,
  ArchiveRestore,
  Flag,
  Download,
  Loader2,
} from "lucide-react";
import toast from "react-hot-toast";
import { motion } from "motion/react";

import DynamicTable from "../../../components/table/DynamicTable";
import { StatsCard } from "../../../components/common/StatsCard";
import ConfirmDialog from "../../../components/table/ConfirmDialog";
import { ReasonDialog } from "../../../features/governance/components/ReasonDialog";
import { NewEnquiryModal } from "../components/NewEnquiryModal";
import { RecentEnquiriesPanel } from "../components/RecentEnquiriesPanel";
import { api } from "../../../lib/api";
import PageHeader from "../../../components/PageHeader";
import { useTechnicalAssuranceStore } from "../../../store/technicalAssuranceStore";
import type { ColumnDef, FilterDef, RowAction } from "../../../components/table/types";
import type {
  Enquiry,
  EnquiryStatus,
} from "../../../../shared/types/technicalAssurance";
import { getRIBALabel } from "../../../constants/ribaStages";
import { useStore } from "../../../store/useStore";
import {
  isAtLeastClientAdmin,
  isComplianceLead,
  isSuperAdmin,
} from "../../../lib/roles";

// Enquiries list. Replaces the placeholder.
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
  const activeProjectId = useStore((s) => s.activeProjectId);
  const [exportingDecisionLog, setExportingDecisionLog] = useState(false);
  const setEnquiries = useTechnicalAssuranceStore((s) => s.setEnquiries);
  const enquiriesCache = useTechnicalAssuranceStore(
    (s) => s.enquiriesCache,
  );

  const [items, setItems] = useState<Enquiry[]>(enquiriesCache ?? []);
  const [loading, setLoading] = useState<boolean>(enquiriesCache === null);
  const [error, setError] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingEnquiry, setEditingEnquiry] = useState<Enquiry | null>(null);

  const [deleteRow, setDeleteRow] = useState<Enquiry | null>(null);
  const [deleting, setDeleting] = useState(false);

  // archive + flag-for-audit row-action state.
  const [archivingId, setArchivingId] = useState<string | null>(null);
  const [flagRow, setFlagRow] = useState<Enquiry | null>(null);
  const [flagging, setFlagging] = useState(false);
  const [resolveRow, setResolveRow] = useState<Enquiry | null>(null);
  const [resolving, setResolving] = useState(false);

  const userRole = user?.role || user?.profile?.role;
  const isAdmin = isSuperAdmin(user?.email, userRole);
  const isClientAdmin = isAtLeastClientAdmin(userRole) || isAdmin;
  const isComplianceLeadUser =
    isComplianceLead(user?.profile ?? user) || isAdmin;

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

  // StatsCards counts -------------------------------------------------
  const counts = useMemo(() => {
    let drafting = 0;
    let generating = 0;
    let open = 0;
    let closed = 0;
    for (const it of items) {
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

  // Table config ------------------------------------------------------
  const columns: ColumnDef<Enquiry>[] = useMemo(
    () => [
      {
        key: "title",
        label: "Enquiry",
        sortable: true,
        render: (_v, row) => (
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-slate-900">
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

  const myUid = user?.uid;
  const filters: FilterDef<Enquiry>[] = useMemo(
    () => [
      {
        key: "status",
        label: "Status",
        type: "select",
        options: STATUS_OPTIONS,
      },
      // "Shared with me" filter. Hides everything except
      // enquiries where the current user has an outstanding share
      // (decision === undefined). Filtered client-side using the existing
      // `shares` field on each enquiry — no extra fetch.
      {
        key: "sharedWithMe",
        label: "Sharing",
        type: "select",
        options: [
          { value: "shared", label: "Shared with me" },
          { value: "iShared", label: "Shared by me · awaiting decision" },
        ],
        match: (row, value) => {
          if (!value || !myUid) return true;
          const shares = Array.isArray(row.shares) ? row.shares : [];
          if (value === "shared") {
            return shares.some(
              (s) => s.sharedWith === myUid && !s.decision,
            );
          }
          if (value === "iShared") {
            return (
              row.ownerUid === myUid &&
              shares.some((s) => !s.decision)
            );
          }
          return true;
        },
      },
    ],
    [myUid],
  );

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
      // network reload. Was previously `window.location.href = .` which
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

  const handleDeleteConfirm = useCallback(async () => {
    if (!deleteRow || deleting) return;
    const target = deleteRow;
    try {
      setDeleting(true);
      await api.tacDeleteEnquiry(target.id);
      toast.success("Enquiry deleted");
      // Clear loading + close the dialog the instant the API returns. Was
      // previously waiting on the background refresh to finish — that left
      // `deleting: true` leaking into a follow-up delete's dialog and the
      // button started in a stuck loading state for ~500ms.
      setDeleting(false);
      setDeleteRow(null);
      // Optimistic local removal so the UI snaps without waiting on the
      // refetch latency.
      setItems((prev) => {
        const next = prev.filter((p) => p.id !== target.id);
        setEnquiries(next);
        return next;
      });
      // Background reconcile against the server; failures are silent —
      // the optimistic remove already reflects the user's intent.
      void refresh();
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to delete.");
      setDeleting(false);
    }
  }, [deleteRow, deleting, refresh, setEnquiries]);

  // Archive / restore — owner or admin can flip status.
  const handleArchiveToggle = useCallback(
    async (row: Enquiry) => {
      if (archivingId) return;
      const isArchived = row.status === "Archived";
      setArchivingId(row.id);
      try {
        const r = await api.tacArchiveEnquiry(row.id, isArchived);
        if (!r?.success) throw new Error(r?.error ?? "Archive failed");
        const newStatus: EnquiryStatus = isArchived ? "Open" : "Archived";
        setItems((prev) => {
          const next = prev.map((p) =>
            p.id === row.id ? { ...p, status: newStatus } : p,
          );
          setEnquiries(next);
          return next;
        });
        toast.success(
          isArchived ? "Enquiry restored" : "Enquiry archived",
        );
      } catch (e: any) {
        toast.error(e?.message ?? "Action failed");
      } finally {
        setArchivingId(null);
      }
    },
    [archivingId, setEnquiries],
  );

  const handleFlagConfirm = useCallback(
    async (note: string) => {
      if (!flagRow || flagging) return;
      const target = flagRow;
      setFlagging(true);
      try {
        const r = await api.tacFlagForAudit(target.id, note);
        if (!r?.success) throw new Error(r?.error ?? "Flag failed");
        setItems((prev) => {
          const next = prev.map((p) =>
            p.id === target.id
              ? { ...p, flaggedForAudit: r.flaggedForAudit }
              : p,
          );
          setEnquiries(next);
          return next;
        });
        toast.success("Flagged for audit");
        setFlagging(false);
        setFlagRow(null);
      } catch (e: any) {
        toast.error(e?.message ?? "Flag failed");
        setFlagging(false);
      }
    },
    [flagRow, flagging, setEnquiries],
  );

  // Decision log PDF export. Uses the active project from the
  // store (so the button is project-scoped). When no project is active,
  // the button is disabled with a tooltip prompting the user to pick one.
  const handleExportDecisionLog = useCallback(async () => {
    const projectId = activeProjectId;
    if (!projectId) {
      toast.error(
        "Pick an active project from the top bar to export its decision log.",
      );
      return;
    }
    if (exportingDecisionLog) return;
    setExportingDecisionLog(true);
    try {
      const r = await api.tacExportDecisionLog(projectId);
      if (!r?.success || !r?.pdfBase64 || !r?.filename) {
        throw new Error(r?.error ?? "Export failed");
      }
      const byteChars = atob(r.pdfBase64);
      const arr = new Uint8Array(byteChars.length);
      for (let i = 0; i < byteChars.length; i++) arr[i] = byteChars.charCodeAt(i);
      const blob = new Blob([arr], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = String(r.filename);
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success(
        `Decision log downloaded · ${r.enquiryCount} closed enquiry${r.enquiryCount === 1 ? "" : " entries"}`,
      );
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to export decision log");
    } finally {
      setExportingDecisionLog(false);
    }
  }, [activeProjectId, exportingDecisionLog]);

  const handleResolveConfirm = useCallback(
    async (note: string) => {
      if (!resolveRow || resolving) return;
      const target = resolveRow;
      setResolving(true);
      try {
        const r = await api.tacResolveFlag(target.id, note);
        if (!r?.success) throw new Error(r?.error ?? "Resolve failed");
        setItems((prev) => {
          const next = prev.map((p) =>
            p.id === target.id
              ? { ...p, flaggedForAudit: r.flaggedForAudit }
              : p,
          );
          setEnquiries(next);
          return next;
        });
        toast.success("Flag resolved");
        setResolving(false);
        setResolveRow(null);
      } catch (e: any) {
        toast.error(e?.message ?? "Resolve failed");
        setResolving(false);
      }
    },
    [resolveRow, resolving, setEnquiries],
  );

  const rowActions: RowAction<Enquiry>[] = useMemo(
    () => [
      {
        key: "open",
        label: "Open workspace",
        icon: Eye,
        onClick: handleOpenWorkspace,
      },
      {
        key: "edit",
        label: (row) =>
          row.status === "Draft" ? "Edit details" : "View details",
        icon: Pencil,
        onClick: handleEdit,
        isVisible: (row) => canEditRow(row),
      },
      {
        key: "archive",
        label: (row) => (row.status === "Archived" ? "Restore" : "Archive"),
        icon: (row) => (row.status === "Archived" ? ArchiveRestore : Archive),
        onClick: (row) => handleArchiveToggle(row),
        isVisible: (row) =>
          canEditRow(row) && row.status !== "Generating",
        isLoading: (row) => archivingId === row.id,
      },
      {
        key: "flag-audit",
        label: (row) =>
          row.flaggedForAudit && !row.flaggedForAudit.resolvedAt
            ? "Resolve flag"
            : "Flag for audit",
        icon: Flag,
        onClick: (row) => {
          if (row.flaggedForAudit && !row.flaggedForAudit.resolvedAt) {
            setResolveRow(row);
          } else {
            setFlagRow(row);
          }
        },
        isVisible: () => isComplianceLeadUser,
      },
      {
        key: "delete",
        label: "Delete",
        icon: Trash2,
        isDanger: true,
        onClick: (row) => setDeleteRow(row),
        isVisible: (row) => canEditRow(row),
      },
    ],
    [
      canEditRow,
      handleEdit,
      handleOpenWorkspace,
      handleArchiveToggle,
      archivingId,
      isComplianceLeadUser,
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
      {/* Header*/}
      <PageHeader
        title="Enquiries"
        subtitle="Capture technical queries with attachments and route them through regulation-cited insights."
        breadcrumbs={[{ label: "Technical Assurance" }, { label: "Enquiries" }]}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {/* Decision log export. Project-scoped via active project.*/}
            <button
              type="button"
              onClick={handleExportDecisionLog}
              disabled={exportingDecisionLog || !activeProjectId}
              title={
                !activeProjectId
                  ? "Pick an active project from the top bar to enable export"
                  : "Export every closed enquiry on the active project as a single PDF"
              }
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:border-indigo-400 hover:text-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {exportingDecisionLog ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              Decision log
            </button>
            <button
              type="button"
              onClick={handleNewClicked}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700"
            >
              <Plus className="h-4 w-4" />
              New enquiry
            </button>
          </div>
        }
      />

      {/* Recent enquiries panel (HTML prototype "Recent prompts").*/}
      <RecentEnquiriesPanel enquiries={items} />

      {/* StatsCards*/}
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

      {/* DynamicTable owns the skeleton loading state — `loading={loading}`
 renders TableSkeleton in-place, matching every other governance /
 risk / compliance list. No separate wrapper spinner needed.*/}
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

      {/* Cross-link to RFI register for discoverability*/}
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

      {/* Modal*/}
      <NewEnquiryModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        enquiry={editingEnquiry}
        onSaved={handleSaved}
      />

      {/* Permanent-delete confirm dialog. Hard delete: enquiry doc +
 tabs/* deliverables + every Storage attachment is removed.*/}
      <ConfirmDialog
        open={deleteRow !== null}
        onCancel={() => setDeleteRow(null)}
        onConfirm={handleDeleteConfirm}
        title="Delete this enquiry permanently?"
        message={`"${
          deleteRow?.title ?? ""
        }" will be deleted. The enquiry doc, every AI deliverable (Summary / Drawing / RFI), and every uploaded attachment will be removed from storage. This cannot be undone.`}
        confirmLabel="Delete permanently"
        variant="danger"
        loading={deleting}
      />

      {/* Flag for audit (Compliance Lead)*/}
      <ReasonDialog
        open={flagRow !== null}
        title="Flag this enquiry for audit"
        message={`Flag "${
          flagRow?.title ?? ""
        }" for Compliance Lead review. The reviewer note explains why — it'll appear on the Audit Dashboard alongside any thumbs-down feedback.`}
        reasonLabel="Reviewer note"
        reasonPlaceholder="What aspect of this insight needs auditing?"
        confirmLabel="Flag for audit"
        variant="warning"
        reasonOptional
        loading={flagging}
        onConfirm={(note) => handleFlagConfirm(note)}
        onCancel={() => setFlagRow(null)}
      />

      {/* Resolve flag (Compliance Lead)*/}
      <ReasonDialog
        open={resolveRow !== null}
        title="Resolve audit flag"
        message={`Resolve the audit flag on "${
          resolveRow?.title ?? ""
        }". Resolution note is required and will be appended to the audit trail.`}
        reasonLabel="Resolution note"
        reasonPlaceholder="What was reviewed? What's the conclusion?"
        confirmLabel="Resolve flag"
        variant="success"
        loading={resolving}
        onConfirm={(note) => handleResolveConfirm(note)}
        onCancel={() => setResolveRow(null)}
      />

    </motion.div>
  );
}
