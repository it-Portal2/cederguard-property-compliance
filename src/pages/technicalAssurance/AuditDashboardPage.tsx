// Compliance Lead audit dashboard.
//
// Surfaces every enquiry in the workspace that's either currently flagged
// for audit OR carries thumbs-down feedback. Powered by the
// `tacListAuditFlagged` server endpoint which gates on Compliance Lead /
// admin role independently of the route guard.
//
// Layout: header + 3 StatsCards (open flags / resolved flags / thumbs-down
// count) + DynamicTable of flagged rows with click-through to the workspace.

import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { motion } from "motion/react";
import {
  ShieldCheck,
  Eye,
  Flag,
  ThumbsDown,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import toast from "react-hot-toast";

import DynamicTable from "../../components/table/DynamicTable";
import { StatsCard } from "../../components/common/StatsCard";
import { ReasonDialog } from "../../components/governance/ReasonDialog";
import { api } from "../../lib/api";
import type {
  ColumnDef,
  FilterDef,
  RowAction,
} from "../../components/table/types";
import type {
  EnquiryFeedback,
  EnquiryAuditFlag,
} from "../../types/technicalAssurance";
import { getRIBALabel } from "../../constants/ribaStages";

interface FlaggedRow {
  id: string;
  title: string;
  ribaStage: string;
  status: string;
  ownerUid: string;
  createdAt: string;
  updatedAt: string;
  projectId: string | null;
  flaggedForAudit: EnquiryAuditFlag | null;
  feedback: EnquiryFeedback | null;
}

const FEEDBACK_REASON_LABEL: Record<
  NonNullable<EnquiryFeedback["reason"]>,
  string
> = {
  inaccurate: "Inaccurate / hallucinated",
  missed_regulation: "Missed regulation",
  wrong_stage: "Wrong RIBA stage",
  other: "Other",
};

export function TacAuditDashboardPage() {
  const navigate = useNavigate();
  const [items, setItems] = useState<FlaggedRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [resolveRow, setResolveRow] = useState<FlaggedRow | null>(null);
  const [resolving, setResolving] = useState(false);

  const refresh = useCallback(async () => {
    try {
      setError(null);
      const r = await api.tacListAuditFlagged();
      if (!r?.success) throw new Error(r?.error ?? "Failed to load");
      setItems(Array.isArray(r.items) ? (r.items as FlaggedRow[]) : []);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load audit dashboard.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const counts = useMemo(() => {
    let openFlags = 0;
    let resolvedFlags = 0;
    let thumbsDown = 0;
    for (const row of items) {
      if (row.flaggedForAudit) {
        if (row.flaggedForAudit.resolvedAt) resolvedFlags++;
        else openFlags++;
      }
      if (row.feedback?.thumbs === "down") thumbsDown++;
    }
    return { openFlags, resolvedFlags, thumbsDown };
  }, [items]);

  const handleOpen = useCallback(
    (row: FlaggedRow) => {
      navigate(`/technical-assurance/enquiries/${row.id}`);
    },
    [navigate],
  );

  const handleResolveConfirm = useCallback(
    async (note: string) => {
      if (!resolveRow || resolving) return;
      const target = resolveRow;
      setResolving(true);
      try {
        const r = await api.tacResolveFlag(target.id, note);
        if (!r?.success) throw new Error(r?.error ?? "Resolve failed");
        toast.success("Flag resolved");
        setResolving(false);
        setResolveRow(null);
        void refresh();
      } catch (e: any) {
        toast.error(e?.message ?? "Resolve failed");
        setResolving(false);
      }
    },
    [resolveRow, resolving, refresh],
  );

  const columns: ColumnDef<FlaggedRow>[] = useMemo(
    () => [
      {
        key: "title",
        label: "Enquiry",
        sortable: true,
        render: (_v, row) => (
          <div>
            <div className="font-semibold text-slate-900">
              {row.title || "Untitled enquiry"}
            </div>
            <div className="mt-0.5 flex items-center gap-2 text-[11px] text-slate-500">
              <span className="font-mono">{row.ribaStage}</span>
              <span aria-hidden>·</span>
              <span>{getRIBALabel(row.ribaStage as any)}</span>
            </div>
          </div>
        ),
      },
      {
        key: "flaggedForAudit",
        label: "Flag",
        width: "180px",
        render: (_v, row) => {
          if (!row.flaggedForAudit)
            return <span className="text-slate-300">—</span>;
          const f = row.flaggedForAudit;
          if (f.resolvedAt) {
            return (
              <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                <CheckCircle2 className="h-3 w-3" />
                Resolved
              </span>
            );
          }
          return (
            <span className="inline-flex items-center gap-1 rounded-md bg-rose-50 px-2 py-0.5 text-[11px] font-semibold text-rose-700">
              <Flag className="h-3 w-3" />
              Flagged
              <span className="ml-1 font-normal text-rose-600">
                {new Date(f.flaggedAt).toLocaleDateString("en-GB", {
                  day: "numeric",
                  month: "short",
                })}
              </span>
            </span>
          );
        },
      },
      {
        key: "feedback",
        label: "Feedback",
        width: "200px",
        render: (_v, row) => {
          if (!row.feedback) return <span className="text-slate-300">—</span>;
          const fb = row.feedback;
          if (fb.thumbs === "up") {
            return (
              <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                Thumbs up
              </span>
            );
          }
          return (
            <div>
              <span className="inline-flex items-center gap-1 rounded-md bg-rose-50 px-2 py-0.5 text-[11px] font-semibold text-rose-700">
                <ThumbsDown className="h-3 w-3" />
                {fb.reason
                  ? FEEDBACK_REASON_LABEL[fb.reason]
                  : "No reason given"}
              </span>
              {fb.note ? (
                <p className="mt-1 line-clamp-2 text-[11px] text-slate-500">
                  “{fb.note}”
                </p>
              ) : null}
            </div>
          );
        },
      },
      {
        key: "updatedAt",
        label: "Updated",
        sortable: true,
        width: "120px",
        render: (v) => (
          <span className="text-[12px] text-slate-600">
            {v
              ? new Date(String(v)).toLocaleDateString("en-GB", {
                  day: "numeric",
                  month: "short",
                  year: "2-digit",
                })
              : "—"}
          </span>
        ),
      },
    ],
    [],
  );

  const filters: FilterDef<FlaggedRow>[] = useMemo(
    () => [
      {
        key: "flagState",
        label: "Flag state",
        type: "select",
        options: [
          { value: "open", label: "Open flags" },
          { value: "resolved", label: "Resolved" },
        ],
        match: (row, value) => {
          if (!value) return true;
          if (!row.flaggedForAudit) return false;
          if (value === "open") return !row.flaggedForAudit.resolvedAt;
          if (value === "resolved") return !!row.flaggedForAudit.resolvedAt;
          return true;
        },
      },
      {
        key: "feedbackType",
        label: "Feedback",
        type: "select",
        options: [{ value: "down", label: "Thumbs down" }],
        match: (row, value) => {
          if (!value) return true;
          if (value === "down") return row.feedback?.thumbs === "down";
          return true;
        },
      },
    ],
    [],
  );

  const rowActions: RowAction<FlaggedRow>[] = useMemo(
    () => [
      {
        key: "open",
        label: "Open enquiry",
        icon: Eye,
        onClick: handleOpen,
      },
      {
        key: "resolve",
        label: "Resolve flag",
        icon: CheckCircle2,
        onClick: (row) => setResolveRow(row),
        isVisible: (row) =>
          !!row.flaggedForAudit && !row.flaggedForAudit.resolvedAt,
      },
    ],
    [handleOpen],
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="space-y-6"
    >
      {/* Header*/}
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
          <ShieldCheck className="h-5 w-5" strokeWidth={2.25} />
        </div>
        <div>
          <p className="font-mono text-[11px] font-medium uppercase tracking-wide text-slate-400">
            Technical Assurance
          </p>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 md:text-2xl">
            Audit dashboard
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Compliance Lead view of every enquiry flagged for audit or
            carrying thumbs-down feedback. First 50 responses per project
            should be reviewed here as part of the in-house chartered review.
          </p>
        </div>
      </div>

      {/* StatsCards*/}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatsCard
          title="Open flags"
          value={counts.openFlags}
          icon={Flag}
          rounded="lg"
          size="sm"
          iconBgClassName="bg-rose-50"
          iconClassName="text-rose-600"
          valueClassName={
            counts.openFlags > 0 ? "text-rose-700" : "text-slate-900"
          }
        />
        <StatsCard
          title="Resolved flags"
          value={counts.resolvedFlags}
          icon={CheckCircle2}
          rounded="lg"
          size="sm"
          iconBgClassName="bg-emerald-50"
          iconClassName="text-emerald-600"
        />
        <StatsCard
          title="Thumbs down"
          value={counts.thumbsDown}
          icon={ThumbsDown}
          rounded="lg"
          size="sm"
          iconBgClassName="bg-amber-50"
          iconClassName="text-amber-600"
        />
      </div>

      {error ? (
        <div className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50/60 p-3 text-[13px] text-rose-700">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          {error}
        </div>
      ) : null}

      <DynamicTable<FlaggedRow>
        data={items}
        columns={columns}
        filters={filters}
        rowActions={rowActions}
        searchable
        searchPlaceholder="Search flagged enquiries"
        searchFields={["title"]}
        loading={loading}
        getRowId={(row) => row.id}
        emptyState={{
          title: "No flagged enquiries",
          description:
            "Compliance Leads see enquiries flagged for audit or carrying thumbs-down feedback here. None right now — that's a good thing.",
          icon: ShieldCheck,
        }}
      />

      {/* Resolve flag dialog*/}
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
        onConfirm={handleResolveConfirm}
        onCancel={() => setResolveRow(null)}
      />
    </motion.div>
  );
}
