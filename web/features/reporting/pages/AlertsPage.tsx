import { useEffect, useMemo } from "react";
import { Bell, CheckCircle2, AlertTriangle, Inbox } from "lucide-react";
import { clsx } from "clsx";
import PageHeader from "../../../components/PageHeader";
import DynamicTable from "../../../components/table/DynamicTable";
import { StatsCard } from "../../../components/common/StatsCard";
import { useStore, type DetectedAlertRow } from "../../../store/useStore";
import type { ColumnDef, FilterDef, RowAction } from "../../../components/table/types";

const SIGNAL_LABELS: Record<string, string> = {
  "evidence-missing": "Evidence missing",
  "compliance-overdue": "Compliance overdue",
  "capa-overdue": "Action overdue",
  "incident-stale": "Incident open",
  "incident-recurring": "Repeated incidents",
  "risk-overdue": "Risk overdue",
  "risk-severe": "Severe risk",
};

const SEVERITY_STYLES: Record<string, string> = {
  info: "bg-slate-100 text-slate-600 ring-1 ring-slate-200",
  warning: "bg-amber-50 text-amber-700 ring-1 ring-amber-200",
  urgent: "bg-red-50 text-red-700 ring-1 ring-red-200",
};

const fmt = (v?: string) => {
  if (!v) return "—";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString("en-GB");
};

export default function AlertsPage() {
  const detectedAlerts = useStore((s) => s.detectedAlerts);
  const detectedAlertsLoaded = useStore((s) => s.detectedAlertsLoaded);
  const loadDetectedAlerts = useStore((s) => s.loadDetectedAlerts);
  const markDetectedAlertRead = useStore((s) => s.markDetectedAlertRead);
  const user = useStore((s) => s.user);
  const uid = user?.uid;

  useEffect(() => {
    loadDetectedAlerts();
  }, [loadDetectedAlerts]);

  const isRead = (a: DetectedAlertRow) => !!uid && (a.readBy || []).includes(uid);

  const counts = useMemo(() => {
    let unread = 0;
    let urgent = 0;
    for (const a of detectedAlerts) {
      if (!isRead(a)) unread += 1;
      if (a.severity === "urgent") urgent += 1;
    }
    return { total: detectedAlerts.length, unread, urgent };
  }, [detectedAlerts, uid]);

  const columns: ColumnDef<DetectedAlertRow>[] = useMemo(
    () => [
      {
        key: "createdAt",
        label: "When",
        sortable: true,
        render: (v) => <span className="text-[12px] text-slate-500">{fmt(String(v))}</span>,
      },
      {
        key: "signalKind",
        label: "Signal",
        render: (v, row) => (
          <div className="flex items-center gap-2">
            <span
              className={clsx(
                "shrink-0 rounded px-1.5 py-0.5 text-[10px] font-mono uppercase tracking-wide",
                SEVERITY_STYLES[row.severity] ?? SEVERITY_STYLES.info,
              )}
            >
              {row.severity}
            </span>
            <span className="text-[13px] text-slate-800">
              {SIGNAL_LABELS[String(v)] ?? String(v)}
            </span>
          </div>
        ),
      },
      {
        key: "entityTitle",
        label: "Item",
        render: (v) => <span className="text-[13px] text-slate-700">{String(v)}</span>,
      },
      {
        key: "message",
        label: "Detail",
        render: (v) => <span className="text-[12px] text-slate-500">{String(v)}</span>,
      },
      {
        key: "_id",
        label: "Status",
        render: (_v, row) =>
          isRead(row) ? (
            <span className="inline-flex items-center gap-1 text-[11px] text-slate-400">
              <CheckCircle2 className="h-3 w-3" /> Read
            </span>
          ) : (
            <span className="text-[11px] font-mono uppercase tracking-wide text-indigo-600">Unread</span>
          ),
      },
    ],
    [uid],
  );

  const filters: FilterDef<DetectedAlertRow>[] = useMemo(
    () => [
      {
        key: "signalKind",
        label: "Signal",
        type: "select",
        options: Object.entries(SIGNAL_LABELS).map(([value, label]) => ({ value, label })),
      },
      {
        key: "severity",
        label: "Severity",
        type: "select",
        options: [
          { value: "urgent", label: "Urgent" },
          { value: "warning", label: "Warning" },
          { value: "info", label: "Info" },
        ],
      },
    ],
    [],
  );

  const rowActions: RowAction<DetectedAlertRow>[] = useMemo(
    () => [
      {
        key: "mark-read",
        label: "Mark read",
        onClick: (row) => markDetectedAlertRead(row._id),
        isVisible: (row) => !isRead(row),
      },
    ],
    [markDetectedAlertRead, uid],
  );

  return (
    <div className="space-y-6 sm:space-y-8">
      <PageHeader
        title="Detected Alerts"
        subtitle="Automatically detected signals across compliance, risk, incidents and actions — overdue, missing, stale and recurring."
        breadcrumbs={[{ label: "Monitoring & Reporting" }, { label: "Detected Alerts" }]}
      />

      <div className="grid grid-cols-3 gap-3">
        <StatsCard
          title="Unread"
          value={counts.unread}
          icon={Bell}
          iconBgClassName="bg-indigo-50 dark:bg-indigo-900/30"
          iconClassName="text-indigo-600 dark:text-indigo-400"
          valueClassName="text-indigo-600 dark:text-indigo-400"
        />
        <StatsCard
          title="Urgent"
          value={counts.urgent}
          icon={AlertTriangle}
          iconBgClassName="bg-red-50 dark:bg-red-900/30"
          iconClassName="text-red-600 dark:text-red-400"
          valueClassName="text-red-600 dark:text-red-400"
        />
        <StatsCard
          title="Total"
          value={counts.total}
          icon={Inbox}
          iconBgClassName="bg-slate-100 dark:bg-slate-700"
          iconClassName="text-slate-700 dark:text-slate-300"
          valueClassName="text-slate-900 dark:text-slate-100"
        />
      </div>

      <DynamicTable<DetectedAlertRow>
        data={detectedAlerts}
        columns={columns}
        filters={filters}
        rowActions={rowActions}
        getRowId={(r) => r._id}
        loading={!detectedAlertsLoaded}
        searchable
        searchPlaceholder="Search alerts…"
        searchFields={["entityTitle", "message"]}
        pagination={{ enabled: true, pageSize: 25, pageSizeOptions: [10, 25, 50] }}
        stickyHeader
        emptyState={{
          title: "No alerts",
          description: "The detection engine hasn't raised any alerts for this workspace.",
          icon: CheckCircle2,
        }}
      />
    </div>
  );
}
