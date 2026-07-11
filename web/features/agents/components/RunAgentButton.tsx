import { useState } from "react";
import { createPortal } from "react-dom";
import { RefreshCw, Loader2, X } from "lucide-react";
import { useRunAgent } from "../useRunAgent";
import { AGENT_META } from "../agentMeta";
import type { AgentKey } from "../../../../shared/types/agents";

/**
 * Runs one agent from a module page. For the Technical Companion (needsQuestion) it opens
 * a small modal to collect the question first; every other agent runs on click. Rendered
 * null for users without run access, so it can be dropped into any PageHeader actions slot.
 */
export default function RunAgentButton({
  agentKey,
  label,
  needsQuestion = false,
}: {
  agentKey: AgentKey;
  label?: string;
  needsQuestion?: boolean;
}) {
  const { run, runningKey, canRun } = useRunAgent();
  const [asking, setAsking] = useState(false);
  const [question, setQuestion] = useState("");
  const busy = runningKey === agentKey;
  const meta = AGENT_META[agentKey];

  if (!canRun) return null;

  const trigger = async () => {
    if (needsQuestion) {
      setAsking(true);
      return;
    }
    await run(agentKey);
  };

  const submitQuestion = async () => {
    if (!question.trim()) return;
    const ok = await run(agentKey, { question: question.trim() });
    if (ok) {
      setAsking(false);
      setQuestion("");
    }
  };

  return (
    <>
      <button
        onClick={trigger}
        disabled={busy}
        title={meta?.blurb}
        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50 hover:text-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {busy ? (
          <Loader2 className="h-4 w-4 animate-spin text-indigo-600" />
        ) : (
          <RefreshCw className="h-4 w-4 text-indigo-600" />
        )}
        {label || `Run ${meta?.label ?? "agent"}`}
      </button>

      {asking &&
        createPortal(
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
            onClick={(e) => e.target === e.currentTarget && setAsking(false)}
          >
            <div className="w-full max-w-lg rounded-xl bg-white p-5 shadow-xl">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-semibold tracking-tight text-slate-800">
                  {meta?.label ?? "Ask the agent"}
                </h3>
                <button onClick={() => setAsking(false)} className="text-slate-400 hover:text-slate-600">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <p className="mt-1 text-[13px] text-slate-500">
                Ask a project-specific question. The agent researches and drafts a cited answer for
                you to review — it is never treated as verified until you approve it.
              </p>
              <textarea
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                rows={3}
                autoFocus
                placeholder="e.g. What are our fire-door inspection obligations for this scheme?"
                className="mt-3 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none"
              />
              <div className="mt-3 flex justify-end gap-2">
                <button
                  onClick={() => setAsking(false)}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  onClick={submitQuestion}
                  disabled={busy || !question.trim()}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                >
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                  Ask
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
