import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import {
  Plus,
  Trash2,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Loader2,
  ShieldAlert,
  AlertTriangle,
  Check,
  Link2,
} from "lucide-react";
import PageHeader from "../../../components/PageHeader";
import DynamicTable from "../../../components/table/DynamicTable";
import { useStore } from "../../../store/useStore";
import { useEscalateToAssurance } from "../useEscalate";
import EscalateModal from "../components/EscalateModal";
import {
  ACTION_TYPE_STYLES,
  ASSURANCE_SOURCE_LABELS,
  ASSURANCE_STATUSES,
  ASSURANCE_FAILURE_LABELS,
  type AssuranceAlert,
  type AssuranceFailureReason,
  type AssuranceSeverity,
  type AssuranceStatus,
} from "../types";
import type {
  ColumnDef,
  RowAction,
  FilterDef,
} from "../../../components/table/types";

const SEVERITY_STYLES: Record<AssuranceSeverity, string> = {
  Low: "bg-slate-100 text-slate-600 ring-1 ring-slate-200",
  Medium: "bg-amber-50 text-amber-700 ring-1 ring-amber-200",
  High: "bg-orange-50 text-orange-700 ring-1 ring-orange-200",
  Critical: "bg-red-50 text-red-700 ring-1 ring-red-200",
};

const STATUS_STYLES: Record<AssuranceStatus, string> = {
  Open: "bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200",
  "In Review": "bg-blue-50 text-blue-700 ring-1 ring-blue-200",
  Resolved: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200",
  Dismissed: "bg-slate-50 text-slate-400 ring-1 ring-slate-200",
};

const pill =
  "inline-flex items-center rounded-full px-2 py-0.5 font-mono uppercase tracking-wide text-[10px] font-medium";

/** Defensive date formatter — createdAt may be a Firestore Timestamp object, ISO, or millis. */
const fmtWhen = (v: any): string => {
  if (!v) return "—";
  let ms: number | null = null;
  if (typeof v === "number") ms = v;
  else if (typeof v === "string") {
    const t = Date.parse(v);
    ms = isNaN(t) ? null : t;
  } else if (typeof v?._seconds === "number") ms = v._seconds * 1000;
  else if (typeof v?.seconds === "number") ms = v.seconds * 1000;
  if (ms == null) return "—";
  return new Date(ms).toISOString().slice(0, 10);
};

export default function AssuranceHubPage() {
  const alerts = useStore((s) => s.assuranceAlerts);
  const loading = useStore((s) => s.assuranceLoading);
  const load = useStore((s) => s.loadAssuranceAlerts);
  const saveAlert = useStore((s) => s.saveAssuranceAlert);
  const deleteAlert = useStore((s) => s.deleteAssuranceAlert);
  const directEscalate = useStore((s) => s.escalateToAssurance);
  const regenerate = useStore((s) => s.generateAssuranceActions);
  const adopt = useStore((s) => s.adoptAssuranceAction);
  const controls = useStore((s) => s.controls);
  const incidents = useStore((s) => s.incidents);
  const complianceItems = useStore((s) => s.complianceItems);
  const loadControls = useStore((s) => s.loadControls);
  const loadIncidents = useStore((s) => s.loadIncidents);
  const canManage = useStore((s) => s.canManageAssurance)();
  const { escalate: escalateCandidate, escalatingId } = useEscalateToAssurance();

  const [modalOpen, setModalOpen] = useState(false);
  const [adoptingIds, setAdoptingIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    load();
    loadControls();
    loadIncidents();
  }, [load, loadControls, loadIncidents]);

  // Ref ids of currently-open escalations — to hide candidates already in the hub.
  const openRefIds = useMemo(
    () =>
      new Set(
        alerts
          .filter((a) => a.status !== "Resolved" && a.status !== "Dismissed")
          .map((a) => a.sourceRef?.id)
          .filter(Boolean),
      ),
    [alerts],
  );

  // Q4/Q5: the system surfaces FAILURES that haven't been escalated yet — failed
  // controls, open incidents, and overdue-not-acted-on compliance items — so the
  // PM can confirm each into the hub instead of it falling through the cracks.
  const candidates = useMemo(() => {
    if (!canManage) return [];
    const now = Date.now();
    const out: Array<{
      refId: string;
      label: string;
      reason: string;
      input: Partial<AssuranceAlert>;
    }> = [];

    for (const c of controls) {
      if (c.status === "Failed" || c.status === "Partially Effective") {
        const refId = `control:${c.id}`;
        out.push({
          refId,
          label: c.title,
          reason: "Control failed",
          input: {
            title: c.title,
            description: `Control "${c.title}" status: ${c.status}.`,
            severity: "High",
            source: "control",
            failureReason: "control_failed",
            sourceRef: { kind: "control", id: refId, label: c.title },
            projectId: c.projectId || undefined,
            programmeId: c.programmeId || undefined,
          },
        });
      }
    }
    for (const i of incidents) {
      if (i.status !== "Closed") {
        const refId = `incident:${i.id}`;
        out.push({
          refId,
          label: i.title,
          reason: "Incident occurred",
          input: {
            title: i.title,
            description: `Incident: ${i.type} (${i.severity}).`,
            severity: i.severity,
            source: "incident",
            failureReason: "incident_occurred",
            sourceRef: { kind: "incident", id: refId, label: i.type },
            projectId: i.projectId || undefined,
            programmeId: i.programmeId || undefined,
          },
        });
      }
    }
    for (const ci of complianceItems as any[]) {
      if (!ci?.id) continue; // no stable id → can't dedupe/key it safely
      const done = ci.stage === "Live" || ci.stage === "Archived";
      const due = ci.dueDate ? Date.parse(ci.dueDate) : NaN;
      if (!done && !Number.isNaN(due) && due < now) {
        const refId = `compliance:${ci.id}`;
        const name = String(ci.name || ci.req || "Compliance item");
        out.push({
          refId,
          label: name.slice(0, 120),
          reason: "Overdue — not acted on",
          input: {
            title: name.slice(0, 200),
            description: `Compliance item overdue (due ${String(ci.dueDate).slice(0, 10)}), stage ${ci.stage}.`,
            severity: "High",
            source: "compliance",
            failureReason: "alert_not_acted",
            sourceRef: { kind: "complianceOverdue", id: refId, label: "Overdue compliance" },
            projectId: ci.projectId || undefined,
            programmeId: ci.programmeId || undefined,
          },
        });
      }
    }
    // Only failures not already in the hub (open).
    return out.filter((x) => !openRefIds.has(x.refId));
  }, [canManage, controls, incidents, complianceItems, openRefIds]);

  const controlTitle = useMemo(() => {
    const map = new Map(controls.map((c) => [c.id, c.title]));
    return (id?: string | null) => (id ? map.get(id) || "a linked control" : "");
  }, [controls]);

  const setStatus = async (a: AssuranceAlert, status: AssuranceStatus) => {
    try {
      await saveAlert({ ...a, status });
      toast.success(`Marked ${status.toLowerCase()}`);
    } catch (e: any) {
      toast.error(e?.message || "Could not update the alert");
    }
  };

  const handleDelete = async (a: AssuranceAlert) => {
    try {
      await deleteAlert(a.id);
      toast.success("Escalation deleted");
    } catch (e: any) {
      toast.error(e?.message || "Could not delete the escalation");
    }
  };

  const handleAdopt = async (alertId: string, actionId: string) => {
    setAdoptingIds((s) => new Set(s).add(actionId));
    try {
      await adopt(alertId, actionId);
      toast.success("Action adopted — added as a Pending CAPA task");
    } catch (e: any) {
      toast.error(e?.message || "Could not adopt the action");
    } finally {
      setAdoptingIds((s) => {
        const next = new Set(s);
        next.delete(actionId);
        return next;
      });
    }
  };

  const columns: ColumnDef<AssuranceAlert>[] = useMemo(
    () => [
      { key: "title", label: "Escalated alert", sortable: true, truncate: true },
      {
        key: "source",
        label: "Source",
        sortable: true,
        render: (v) => ASSURANCE_SOURCE_LABELS[v as keyof typeof ASSURANCE_SOURCE_LABELS] || String(v),
      },
      {
        key: "failureReason",
        label: "Reason",
        sortable: true,
        render: (v) => (
          <span className="text-[12px] text-slate-600">
            {ASSURANCE_FAILURE_LABELS[(v as AssuranceFailureReason) ?? "other"] || "—"}
          </span>
        ),
      },
      {
        key: "severity",
        label: "Severity",
        sortable: true,
        render: (v) => (
          <span className={`${pill} ${SEVERITY_STYLES[v as AssuranceSeverity] ?? ""}`}>
            {String(v)}
          </span>
        ),
      },
      {
        key: "status",
        label: "Status",
        sortable: true,
        render: (v) => (
          <span className={`${pill} ${STATUS_STYLES[v as AssuranceStatus] ?? ""}`}>
            {String(v)}
          </span>
        ),
      },
      {
        key: "_actions",
        label: "Actions",
        align: "right",
        render: (_v, r) => {
          if (r.generationStatus === "generating")
            return <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-400 inline" />;
          if (r.generationStatus === "failed")
            return <span className="font-mono text-[11px] text-red-500">failed</span>;
          const n = r.generatedActions?.length || 0;
          const adopted = r.generatedActions?.filter((a) => a.adopted).length || 0;
          return (
            <span className="font-mono tabular-nums text-[11px] text-slate-500">
              {adopted}/{n}
            </span>
          );
        },
        exportValue: (_v, r) => String(r.generatedActions?.length || 0),
      },
      {
        key: "projectName",
        label: "Scope",
        sortable: true,
        render: (v) => (v ? String(v) : <span className="text-slate-400">Org-wide</span>),
      },
      {
        key: "createdAt",
        label: "Raised",
        sortable: true,
        render: (v) => (
          <span className="font-mono text-[11px] text-slate-500 tabular-nums">{fmtWhen(v)}</span>
        ),
      },
    ],
    [],
  );

  const filterDefs: FilterDef<AssuranceAlert>[] = [
    {
      key: "status",
      label: "Status",
      type: "select",
      options: ASSURANCE_STATUSES.map((s) => ({ value: s, label: s })),
    },
    {
      key: "source",
      label: "Source",
      type: "select",
      options: Object.entries(ASSURANCE_SOURCE_LABELS).map(([value, label]) => ({
        value,
        label,
      })),
    },
  ];

  const rowActions: RowAction<AssuranceAlert>[] = canManage
    ? [
        {
          key: "resolve",
          label: "Mark resolved",
          icon: CheckCircle2,
          isVisible: (r) => r.status !== "Resolved",
          onClick: (r) => setStatus(r, "Resolved"),
        },
        {
          key: "review",
          label: "Mark in review",
          icon: ShieldAlert,
          isVisible: (r) => r.status === "Open",
          onClick: (r) => setStatus(r, "In Review"),
        },
        {
          key: "dismiss",
          label: "Dismiss",
          icon: XCircle,
          isVisible: (r) => r.status !== "Dismissed",
          onClick: (r) => setStatus(r, "Dismissed"),
        },
        {
          key: "regenerate",
          label: "Regenerate actions",
          icon: RefreshCw,
          isVisible: (r) => r.generationStatus !== "generating",
          onClick: (r) => regenerate(r.id),
        },
        {
          key: "delete",
          label: "Delete",
          icon: Trash2,
          isDanger: true,
          onClick: handleDelete,
          requireConfirm: {
            title: "Delete escalation",
            message: (r: AssuranceAlert) =>
              `Permanently delete "${r.title}" and its generated actions? This cannot be undone.`,
            confirmLabel: "Delete",
            isDanger: true,
          },
        },
      ]
    : [];

  const renderExpanded = (a: AssuranceAlert) => {
    if (a.generationStatus === "generating") {
      return (
        <div className="flex items-center gap-2 px-2 py-3 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" /> Generating response actions…
        </div>
      );
    }
    const actions = a.generatedActions || [];
    if (actions.length === 0) {
      return (
        <div className="flex items-center justify-between gap-3 px-2 py-3 text-sm text-slate-500">
          <span>
            {a.generationStatus === "failed"
              ? "Action generation failed."
              : "No actions were generated."}
          </span>
          {canManage && (
            <button
              onClick={() => regenerate(a.id)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
            >
              <RefreshCw className="h-3.5 w-3.5" /> Regenerate
            </button>
          )}
        </div>
      );
    }
    return (
      <div className="space-y-2 px-2 py-2">
        {a.description && (
          <p className="text-sm text-slate-500 mb-2">{a.description}</p>
        )}
        {actions.map((act) => (
          <div
            key={act.id}
            className="rounded-lg border border-slate-200 bg-white p-3 flex items-start gap-3"
          >
            <span className={`${pill} ${ACTION_TYPE_STYLES[act.type] ?? ""} shrink-0`}>
              {act.type}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-slate-800">{act.title}</p>
              <p className="text-sm text-slate-500 mt-0.5">{act.rationale}</p>
              {act.linkedControlId && (
                <p className="mt-1 inline-flex items-center gap-1 font-mono text-[11px] text-slate-400">
                  <Link2 className="h-3 w-3" /> Strengthens: {controlTitle(act.linkedControlId)}
                </p>
              )}
            </div>
            <div className="shrink-0">
              {act.adopted ? (
                <span className="inline-flex items-center gap-1 font-mono text-[11px] uppercase tracking-wide text-emerald-600">
                  <Check className="h-3.5 w-3.5" /> Adopted
                </span>
              ) : (
                canManage && (
                  <button
                    onClick={() => handleAdopt(a.id, act.id)}
                    disabled={adoptingIds.has(act.id)}
                    className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                    title="Adopt — create a Pending CAPA task"
                  >
                    {adoptingIds.has(act.id) ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Plus className="h-3.5 w-3.5" />
                    )}
                    Adopt
                  </button>
                )
              )}
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-6 sm:space-y-8">
      <PageHeader
        title="Escalations & Incidents"
        subtitle="Alerts escalated from compliance, risk and governance — with the detective, preventive, corrective and improvement actions to take."
        breadcrumbs={[{ label: "Escalations & Incidents" }, { label: "Escalations" }]}
      />

      {canManage && candidates.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-4 sm:p-5">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-800">
            <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" /> Needs escalation
            <span className="ml-auto font-mono text-[11px] text-slate-400 tabular-nums shrink-0">
              {candidates.length}
            </span>
          </h3>
          <p className="mt-1 text-[12px] text-slate-500">
            Failures the system detected that aren’t in the hub yet — a failed control, an open
            incident, or an overdue item that wasn’t acted on. Confirm to enforce a response.
          </p>
          <div className="mt-3 space-y-2 max-h-72 overflow-y-auto pr-1">
            {candidates.map((c) => (
              <div
                key={c.refId}
                className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm text-slate-700">{c.label}</p>
                  <p className="font-mono text-[10px] uppercase tracking-wide text-amber-600">
                    {c.reason}
                  </p>
                </div>
                <button
                  onClick={() => escalateCandidate(c.refId, c.input, { navigate: false })}
                  disabled={escalatingId === c.refId}
                  className="shrink-0 inline-flex items-center gap-1 rounded-lg bg-indigo-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                >
                  <ShieldAlert className="h-3.5 w-3.5" /> Escalate
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <DynamicTable<AssuranceAlert>
        data={alerts}
        columns={columns}
        rowActions={rowActions}
        filters={filterDefs}
        getRowId={(r) => r.id}
        loading={loading && alerts.length === 0}
        searchable
        searchPlaceholder="Search escalations…"
        searchFields={["title", "description"]}
        expandable
        renderExpanded={renderExpanded}
        pagination={{ enabled: true, pageSize: 25, pageSizeOptions: [10, 25, 50] }}
        stickyHeader
        headerVariant="light"
        export={{ xlsx: true, csv: true, filename: "assurance-escalations" }}
        emptyState={{
          title: "No escalations yet",
          description: canManage
            ? "Escalate an alert from Risk, Compliance or Governance — or log one directly — and the response actions are generated automatically."
            : "Nothing has been escalated to Assurance yet.",
          icon: ShieldAlert,
        }}
        toolbarActions={
          canManage ? (
            <button
              onClick={() => setModalOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700"
            >
              <Plus className="h-4 w-4" /> Log alert
            </button>
          ) : undefined
        }
      />

      {modalOpen && (
        <EscalateModal onClose={() => setModalOpen(false)} onSubmit={directEscalate} />
      )}
    </div>
  );
}
