import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { useNavigate } from "react-router";
import {
  TrendingUp,
  RefreshCw,
  AlertTriangle,
  ShieldAlert,
  Check,
  X,
  Loader2,
  Lightbulb,
} from "lucide-react";
import PageHeader from "../../../components/PageHeader";
import { useStore } from "../../../store/useStore";
import { api } from "../../../lib/api";
import {
  detectRecurringIncidents,
  failedControls,
  RECURRENCE_WINDOW_DAYS,
} from "../../../lib/learning/recurrence";

interface Suggestion {
  title: string;
  rationale: string;
  capaType: "Corrective" | "Preventive" | "Improvement";
}

const capaBadge = (t: string) =>
  t === "Corrective"
    ? "bg-rose-50 text-rose-700 border-rose-200"
    : t === "Preventive"
      ? "bg-blue-50 text-blue-700 border-blue-200"
      : "bg-emerald-50 text-emerald-700 border-emerald-200";

export default function LearningEnginePage() {
  const navigate = useNavigate();
  const incidents = useStore((s) => s.incidents);
  const controls = useStore((s) => s.controls);
  const loadIncidents = useStore((s) => s.loadIncidents);
  const loadControls = useStore((s) => s.loadControls);
  const controlsLoaded = useStore((s) => s.controlsLoaded);
  const incidentsLoaded = useStore((s) => s.incidentsLoaded);
  const ready = controlsLoaded && incidentsLoaded;
  const addTask = useStore((s) => s.addTask);
  const canApprove = useStore((s) => s.canApproveCapa)();
  const user = useStore((s) => s.user);
  const activeProjectId = useStore((s) => s.activeProjectId);
  const activeProgrammeId = useStore((s) => s.activeProgrammeId);
  const projects = useStore((s) => s.projects);
  const programmes = useStore((s) => s.programmes);

  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestion[] | null>(null);

  useEffect(() => {
    loadIncidents();
    loadControls();
  }, [loadIncidents, loadControls]);

  const recurring = useMemo(
    () => detectRecurringIncidents(incidents),
    [incidents],
  );
  const failed = useMemo(() => failedControls(controls), [controls]);
  const hasSignals = recurring.length > 0 || failed.length > 0;

  const signalsSummary = useMemo(() => {
    const lines: string[] = [];
    if (recurring.length) {
      lines.push(`Recurring incident types (last ${RECURRENCE_WINDOW_DAYS} days):`);
      recurring.forEach((c) =>
        lines.push(`- ${c.type}: ${c.count} incidents (latest ${c.latest || "n/a"})`),
      );
    }
    if (failed.length) {
      lines.push("Controls not operating effectively:");
      failed.forEach((c) => lines.push(`- ${c.title} — ${c.status}`));
    }
    return lines.join("\n");
  }, [recurring, failed]);

  const generate = async () => {
    setLoading(true);
    try {
      const res = await api.learningSuggestImprovements(signalsSummary);
      setSuggestions(res.suggestions || []);
    } catch (e: any) {
      toast.error(e?.message || "Could not generate suggestions");
    } finally {
      setLoading(false);
    }
  };

  const approve = (s: Suggestion, idx: number) => {
    const contextProjectId = activeProjectId || undefined;
    const contextProgrammeId = !activeProjectId
      ? activeProgrammeId || undefined
      : undefined;
    const contextName =
      projects.find((p) => p.id === activeProjectId)?.name ??
      programmes.find((p) => p.id === activeProgrammeId)?.name ??
      "General";
    const due = new Date();
    due.setDate(due.getDate() + 14);
    addTask({
      id: `T-${Date.now()}-${idx}`,
      title: s.title,
      description: s.rationale,
      status: "Pending",
      priority: "High",
      dueDate: due.toISOString().split("T")[0],
      owner: user?.id || user?.uid || user?.email,
      projectId: contextProjectId,
      programmeId: contextProgrammeId,
      projectName: contextName,
      isProgrammeLevel: !!contextProgrammeId,
      capaType: s.capaType,
      capaStatus: "Pending",
    });
    setSuggestions((cur) => (cur ? cur.filter((_, i) => i !== idx) : cur));
    toast.success(`"${s.title}" added as a CAPA action`);
  };

  const dismiss = (idx: number) =>
    setSuggestions((cur) => (cur ? cur.filter((_, i) => i !== idx) : cur));

  return (
    <div className="space-y-6 sm:space-y-8">
      <PageHeader
        title="Continuous Improvement"
        subtitle="Recurring incidents and failed controls, with AI-suggested actions the officer approves."
        breadcrumbs={[{ label: "Assurance" }, { label: "Improvement" }]}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-lg border border-slate-200 bg-white p-5">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-800">
            <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" /> Recurring incidents
            <span className="ml-auto font-mono text-[11px] text-slate-400 shrink-0">
              same type · {RECURRENCE_WINDOW_DAYS}d window
            </span>
          </h3>
          <div className="mt-3 space-y-2 max-h-72 overflow-y-auto pr-1">
            {!ready ? (
              <p className="text-sm text-slate-400">Loading…</p>
            ) : recurring.length === 0 ? (
              <p className="text-sm text-slate-400">No recurring incident types.</p>
            ) : (
              recurring.map((c) => (
                <div
                  key={c.type}
                  className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2"
                >
                  <span className="text-sm text-slate-700 truncate min-w-0">{c.type}</span>
                  <span className="font-mono text-[11px] font-medium text-rose-600 tabular-nums shrink-0">
                    {c.count}× recurring
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-5">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-800">
            <ShieldAlert className="h-4 w-4 text-rose-500 shrink-0" /> Controls needing attention
            {ready && failed.length > 0 && (
              <span className="ml-auto font-mono text-[11px] text-slate-400 tabular-nums shrink-0">
                {failed.length}
              </span>
            )}
          </h3>
          <div className="mt-3 space-y-2 max-h-72 overflow-y-auto pr-1">
            {!ready ? (
              <p className="text-sm text-slate-400">Loading…</p>
            ) : failed.length === 0 ? (
              <p className="text-sm text-slate-400">
                No failed or partially-effective controls.
              </p>
            ) : (
              failed.map((c) => (
                <div
                  key={c.id}
                  className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2"
                >
                  <span className="text-sm text-slate-700 truncate min-w-0">{c.title}</span>
                  <span className="font-mono text-[11px] font-medium text-rose-600 shrink-0">
                    {c.status}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-5">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-800">
            <TrendingUp className="h-4 w-4 text-indigo-500" /> Improvement suggestions
          </h3>
          <button
            onClick={generate}
            disabled={loading || !ready || !hasSignals}
            className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            {loading ? "Generating…" : "Generate suggestions"}
          </button>
        </div>

        {!ready && (
          <p className="mt-3 text-sm text-slate-400">Loading assurance signals…</p>
        )}

        {ready && !hasSignals && (
          <p className="mt-3 text-sm text-slate-400">
            No assurance signals yet — log incidents and mark control effectiveness to
            generate suggestions.
          </p>
        )}

        {suggestions && suggestions.length === 0 && hasSignals && (
          <p className="mt-3 text-sm text-slate-400">
            No suggestions returned. Try again, or refine the signals.
          </p>
        )}

        <div className="mt-4 space-y-3">
          {suggestions?.map((s, idx) => (
            <div
              key={`${s.title}-${idx}`}
              className="rounded-lg border border-slate-200 p-4"
            >
              <div className="flex items-start gap-3">
                <Lightbulb className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold text-slate-800">{s.title}</p>
                    <span
                      className={`font-mono uppercase tracking-wide text-[10px] font-medium px-2 py-0.5 rounded-full border ${capaBadge(
                        s.capaType,
                      )}`}
                    >
                      {s.capaType}
                    </span>
                  </div>
                  <p className="text-sm text-slate-500 mt-1">{s.rationale}</p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {canApprove && (
                    <button
                      onClick={() => approve(s, idx)}
                      className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-emerald-700"
                      title="Approve — add as a CAPA action"
                    >
                      <Check className="h-3.5 w-3.5" /> Approve
                    </button>
                  )}
                  <button
                    onClick={() => dismiss(idx)}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-50"
                    title="Dismiss"
                  >
                    <X className="h-3.5 w-3.5" /> Dismiss
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {suggestions && suggestions.length > 0 && (
          <p className="mt-4 text-[11px] text-slate-400">
            Approved suggestions are added as Improvement/CAPA actions in{" "}
            <button
              onClick={() => navigate("/tasks")}
              className="text-indigo-600 hover:underline"
            >
              My Tasks
            </button>
            . The AI suggests; the officer decides.
          </p>
        )}
      </div>
    </div>
  );
}
