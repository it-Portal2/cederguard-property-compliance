import { useMemo, useState } from "react";
import toast from "react-hot-toast";
import {
  CheckCircle2,
  XCircle,
  Pencil,
  Send,
  Loader2,
  ShieldCheck,
  AlertTriangle,
  Info,
} from "lucide-react";
import { clsx } from "clsx";
import SourceList from "../../../components/validation/SourceList";
import type { ValidationCitation } from "../../../lib/validation";
import { useStore } from "../../../store/useStore";
import { isApprovable, type AgentSuggestionDoc } from "../../../../shared/types/agents";

const STATUS_STYLE: Record<string, string> = {
  draft: "text-slate-600 bg-slate-100 border-slate-200",
  accepted: "text-emerald-700 bg-emerald-50 border-emerald-200",
  edited: "text-indigo-700 bg-indigo-50 border-indigo-200",
  rejected: "text-red-700 bg-red-50 border-red-200",
  applied: "text-emerald-800 bg-emerald-100 border-emerald-300",
  superseded: "text-slate-400 bg-slate-50 border-slate-200",
};

/** Map a suggestion's stored citations onto the shared SourceList citation shape. */
function toCitations(s: AgentSuggestionDoc): ValidationCitation[] {
  const records: ValidationCitation[] = s.citations.records.map((r) => ({
    kind: "record",
    label: r.label,
    title: r.label,
  }));
  const web: ValidationCitation[] = s.citations.web.map((w) => ({
    kind: "web",
    label: w.title,
    title: w.title,
    url: w.url,
    snippet: w.snippet,
  }));
  return [...records, ...web];
}

export default function SuggestionReviewPanel({ suggestion }: { suggestion: AgentSuggestionDoc }) {
  const s = suggestion;
  const canReview = useStore((st) => st.canReviewAgentSuggestions());
  const reviewAgentSuggestion = useStore((st) => st.reviewAgentSuggestion);
  const applyAgentSuggestion = useStore((st) => st.applyAgentSuggestion);

  const [busy, setBusy] = useState<null | "accept" | "reject" | "apply" | "edit">(null);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [editing, setEditing] = useState(false);

  // Editable view of the payload. Only string fields are shown — the common case for a
  // reviewer tweak (title, description, owner). Booleans/numbers stay as the model set
  // them; a deeper edit belongs in the module's own modal (a later enhancement).
  const effective = (s.editedPayload && Object.keys(s.editedPayload).length ? s.editedPayload : s.payload) as Record<string, unknown>;
  const editableFields = useMemo(
    () => Object.entries(effective).filter(([, v]) => typeof v === "string"),
    [effective],
  );
  const [draft, setDraft] = useState<Record<string, string>>(() =>
    Object.fromEntries(editableFields.map(([k, v]) => [k, String(v)])),
  );

  const citations = useMemo(() => toCitations(s), [s]);
  const confidencePct = Math.round((s.confidence ?? 0) * 100);
  const lowConfidence = (s.confidence ?? 0) < 0.5 || s.missingEvidence.length > 0;
  const isTerminal = s.reviewStatus === "applied" || s.reviewStatus === "rejected" || s.reviewStatus === "superseded";
  const canApply = isApprovable(s.reviewStatus);

  const run = async (kind: "accept" | "reject" | "apply", fn: () => Promise<void>) => {
    setBusy(kind);
    try {
      await fn();
    } catch (e: any) {
      toast.error(e?.message || "Something went wrong.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-4 p-4 sm:p-6 bg-slate-50/40 rounded-lg">
      {/* Header: status + AI provenance */}
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={clsx(
            "font-mono uppercase tracking-wide text-[11px] font-medium px-2 py-0.5 rounded-full border",
            STATUS_STYLE[s.reviewStatus] ?? STATUS_STYLE.draft,
          )}
        >
          {s.reviewStatus}
        </span>
        {s.reviewStatus !== "applied" && (
          <span className="inline-flex items-center gap-1 font-mono uppercase tracking-wide text-[11px] font-medium px-2 py-0.5 rounded-full border border-amber-200 bg-amber-50 text-amber-700">
            <Info className="h-3 w-3" /> AI-generated · not yet approved
          </span>
        )}
        <span className="ml-auto font-mono text-[11px] text-slate-400 tabular-nums">
          {s.outputType}
        </span>
      </div>

      <p className="text-sm text-slate-700 whitespace-pre-wrap">{s.rationale}</p>

      {/* Long-form body for narrative / technical-answer suggestions. */}
      {typeof (effective.answer ?? effective.text) === "string" && (effective.answer ?? effective.text) ? (
        <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-3 text-sm text-slate-700 whitespace-pre-wrap">
          {String(effective.answer ?? effective.text)}
        </div>
      ) : null}

      {/* Confidence */}
      <div className="flex items-center gap-2">
        <span
          className={clsx(
            "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium border",
            lowConfidence
              ? "text-amber-700 bg-amber-50 border-amber-200"
              : "text-slate-600 bg-slate-50 border-slate-200",
          )}
          title="Model-reported — not a calibrated probability"
        >
          {lowConfidence ? <AlertTriangle className="h-3 w-3" /> : <ShieldCheck className="h-3 w-3" />}
          {confidencePct}% model-reported confidence
        </span>
      </div>

      {/* Sources */}
      {citations.length > 0 && (
        <div>
          <h4 className="font-mono uppercase tracking-wide text-[11px] font-medium text-slate-500 mb-1.5">
            Sources
          </h4>
          <SourceList citations={citations} />
        </div>
      )}

      {/* Assumptions */}
      {s.assumptions.length > 0 && (
        <div>
          <h4 className="font-mono uppercase tracking-wide text-[11px] font-medium text-slate-500 mb-1.5">
            Assumptions
          </h4>
          <ul className="list-disc pl-5 space-y-0.5 text-[13px] text-slate-600">
            {s.assumptions.map((a, i) => (
              <li key={i}>{a}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Missing evidence */}
      {s.missingEvidence.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-3">
          <h4 className="flex items-center gap-1.5 font-mono uppercase tracking-wide text-[11px] font-medium text-amber-700 mb-1.5">
            <AlertTriangle className="h-3.5 w-3.5" /> Missing evidence
          </h4>
          <ul className="list-disc pl-5 space-y-0.5 text-[13px] text-amber-800">
            {s.missingEvidence.map((m, i) => (
              <li key={i}>{m}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Reviewer trail */}
      {s.reviewer && (
        <p className="text-[12px] text-slate-500">
          {s.reviewStatus} by {s.reviewer.name}
          {s.reviewer.reason ? ` — “${s.reviewer.reason}”` : ""}
        </p>
      )}

      {/* Actions */}
      {!isTerminal && (
        <div className="pt-1">
          {!canReview ? (
            <p className="text-[12px] text-slate-500">
              Only a Project Manager or above can accept, edit or apply this suggestion.
            </p>
          ) : editing ? (
            <div className="space-y-2">
              {editableFields.map(([k]) => (
                <label key={k} className="block">
                  <span className="font-mono uppercase tracking-wide text-[10px] text-slate-500">{k}</span>
                  <textarea
                    value={draft[k] ?? ""}
                    onChange={(e) => setDraft((d) => ({ ...d, [k]: e.target.value }))}
                    rows={String(draft[k] ?? "").length > 80 ? 3 : 1}
                    className="mt-0.5 w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-indigo-400 focus:outline-none"
                  />
                </label>
              ))}
              <div className="flex gap-2">
                <button
                  disabled={busy !== null}
                  onClick={() =>
                    run("accept", async () => {
                      await reviewAgentSuggestion({
                        suggestionId: s.id,
                        decision: "edited",
                        editedPayload: { ...effective, ...draft },
                      });
                      toast.success("Saved your edits — ready to apply.");
                      setEditing(false);
                    })
                  }
                  className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                >
                  {busy === "accept" ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                  Save edits
                </button>
                <button
                  onClick={() => setEditing(false)}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : rejecting ? (
            <div className="space-y-2">
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Why are you rejecting this suggestion?"
                rows={2}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none"
              />
              <div className="flex gap-2">
                <button
                  disabled={busy !== null || !reason.trim()}
                  onClick={() =>
                    run("reject", async () => {
                      await reviewAgentSuggestion({ suggestionId: s.id, decision: "rejected", reason });
                      toast.success("Suggestion rejected.");
                      setRejecting(false);
                    })
                  }
                  className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
                >
                  {busy === "reject" ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
                  Confirm rejection
                </button>
                <button
                  onClick={() => { setRejecting(false); setReason(""); }}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {s.reviewStatus === "draft" && (
                <button
                  disabled={busy !== null}
                  onClick={() =>
                    run("accept", async () => {
                      await reviewAgentSuggestion({ suggestionId: s.id, decision: "accepted" });
                      toast.success("Accepted — ready to apply.");
                    })
                  }
                  className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                >
                  {busy === "accept" ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                  Accept
                </button>
              )}
              {canApply && (
                <button
                  disabled={busy !== null}
                  onClick={() =>
                    run("apply", async () => {
                      await applyAgentSuggestion(s.id);
                      toast.success("Applied to the register.");
                    })
                  }
                  className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                >
                  {busy === "apply" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  Apply to register
                </button>
              )}
              {editableFields.length > 0 && (
                <button
                  disabled={busy !== null}
                  onClick={() => setEditing(true)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                >
                  <Pencil className="h-4 w-4" /> Edit
                </button>
              )}
              <button
                disabled={busy !== null}
                onClick={() => setRejecting(true)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
              >
                <XCircle className="h-4 w-4" /> Reject
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
