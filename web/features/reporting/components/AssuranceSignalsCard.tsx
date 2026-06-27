import { useEffect, useMemo } from "react";
import { Link } from "react-router";
import { ShieldAlert, AlertTriangle, ClipboardX, FileWarning } from "lucide-react";
import { useStore } from "../../../store/useStore";
import {
  detectRecurringIncidents,
  failedControls,
} from "../../../lib/learning/recurrence";

const Tile = ({
  label,
  value,
  tone,
  to,
}: {
  label: string;
  value: number;
  tone: "rose" | "amber" | "slate";
  to: string;
}) => {
  const toneCls =
    value === 0
      ? "text-slate-400"
      : tone === "rose"
        ? "text-rose-600"
        : tone === "amber"
          ? "text-amber-600"
          : "text-slate-700";
  return (
    <Link
      to={to}
      aria-label={`${label}: ${value}`}
      className="rounded-lg border border-slate-200 bg-white p-3 hover:border-slate-300 transition-colors"
    >
      <p className="font-mono uppercase tracking-wide text-[11px] font-medium text-slate-500">
        {label}
      </p>
      <p className={`mt-1 text-2xl font-medium tabular-nums ${toneCls}`}>{value}</p>
    </Link>
  );
};

export default function AssuranceSignalsCard() {
  const controls = useStore((s) => s.controls);
  const incidents = useStore((s) => s.incidents);
  const tasks = useStore((s) => s.tasks);
  const complianceItems = useStore((s) => s.complianceItems);
  const loadControls = useStore((s) => s.loadControls);
  const loadIncidents = useStore((s) => s.loadIncidents);
  const controlsLoaded = useStore((s) => s.controlsLoaded);
  const incidentsLoaded = useStore((s) => s.incidentsLoaded);
  const ready = controlsLoaded && incidentsLoaded;

  useEffect(() => {
    loadControls();
    loadIncidents();
  }, [loadControls, loadIncidents]);

  const signals = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const failed = failedControls(controls);
    const openIncidents = (incidents || []).filter((i) => i.status !== "Closed");
    const recurring = detectRecurringIncidents(incidents || []);
    const overdueCapa = (Array.isArray(tasks) ? tasks : []).filter(
      (t) =>
        t.capaType &&
        t.status !== "Completed" &&
        t.dueDate &&
        t.dueDate !== "No date set" &&
        new Date(t.dueDate) < today,
    );
    const missingEvidence = (Array.isArray(complianceItems) ? complianceItems : []).filter(
      (c) =>
        c.evidenceRequired &&
        !c.evidence &&
        c.stage !== "Live" &&
        c.stage !== "Archived",
    );
    return {
      failed: failed.length,
      openIncidents: openIncidents.length,
      overdueCapa: overdueCapa.length,
      missingEvidence: missingEvidence.length,
      recurring,
    };
  }, [controls, incidents, tasks, complianceItems]);

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5 sm:p-6 space-y-4">
      <div className="flex items-center gap-2">
        <ShieldAlert className="h-4 w-4 text-indigo-500" />
        <h3 className="text-sm font-semibold text-slate-800 tracking-tight">
          Assurance signals
        </h3>
        <span className="ml-auto font-mono text-[11px] text-slate-400">
          data-derived
        </span>
      </div>

      {!ready ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-lg border border-slate-200 bg-slate-50 p-3 animate-pulse">
              <div className="h-3 w-20 bg-slate-200 rounded" />
              <div className="mt-2 h-6 w-8 bg-slate-200 rounded" />
            </div>
          ))}
        </div>
      ) : (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Tile label="Failed controls" value={signals.failed} tone="rose" to="/controls/register" />
        <Tile label="Open incidents" value={signals.openIncidents} tone="amber" to="/incidents/register" />
        <Tile label="Overdue CAPA" value={signals.overdueCapa} tone="rose" to="/tasks" />
        <Tile label="Missing evidence" value={signals.missingEvidence} tone="amber" to="/compliance" />
      </div>
      )}

      {ready && signals.recurring.length > 0 && (
        <div className="rounded-lg bg-slate-50 p-3">
          <p className="flex items-center gap-1.5 font-mono uppercase tracking-wide text-[11px] font-medium text-slate-500">
            <AlertTriangle className="h-3 w-3 text-amber-500" /> Recurring incident types
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {signals.recurring.map((c) => (
              <span
                key={c.type}
                className="inline-flex items-center gap-1 rounded-full bg-white border border-slate-200 px-2 py-0.5 text-[11px] text-slate-600"
              >
                {c.type}
                <span className="font-mono tabular-nums text-rose-600">{c.count}×</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {ready &&
        signals.failed === 0 &&
        signals.openIncidents === 0 &&
        signals.overdueCapa === 0 &&
        signals.missingEvidence === 0 &&
        signals.recurring.length === 0 && (
          <p className="flex items-center gap-2 text-sm text-slate-400">
            <ClipboardX className="h-4 w-4" /> No outstanding assurance signals.
          </p>
        )}

      <Link
        to="/learning/improvement"
        className="inline-flex items-center gap-1.5 text-[12px] font-medium text-indigo-600 hover:underline"
      >
        <FileWarning className="h-3.5 w-3.5" /> Review in the learning engine
      </Link>
    </div>
  );
}
