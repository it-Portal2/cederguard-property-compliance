import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { useFocusTrap } from "../../../hooks/useFocusTrap";
import {
  ASSURANCE_SEVERITIES,
  ASSURANCE_FAILURE_LABELS,
  type AssuranceSeverity,
  type AssuranceFailureReason,
  type AssuranceAlert,
} from "../types";

interface Props {
  onClose: () => void;
  onSubmit: (input: Partial<AssuranceAlert>) => Promise<unknown>;
}

const labelCls = "block text-sm font-medium text-slate-700 mb-1";
const inputCls =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none disabled:bg-slate-50 disabled:text-slate-400";

export default function EscalateModal({ onClose, onSubmit }: Props) {
  const trapRef = useFocusTrap<HTMLDivElement>(true);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [severity, setSeverity] = useState<AssuranceSeverity>("Medium");
  const [failureReason, setFailureReason] =
    useState<AssuranceFailureReason>("alert_not_acted");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isSaving) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isSaving, onClose]);

  const handleSubmit = async () => {
    if (!title.trim()) {
      setError("A short summary of the problem is required.");
      return;
    }
    setError(null);
    setIsSaving(true);
    try {
      await onSubmit({
        title: title.trim(),
        description: description.trim(),
        severity,
        failureReason,
        source: "direct",
      });
      onClose();
    } catch (e: any) {
      setError(e?.message || "Could not escalate to Assurance.");
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 z-50">
      <div
        ref={trapRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="esc-modal-title"
        className="bg-white rounded-lg shadow-xl w-full max-w-xl flex flex-col overflow-hidden"
      >
        <div className="flex items-start justify-between gap-3 p-4 sm:p-6 border-b border-slate-100">
          <div className="min-w-0">
            <h2
              id="esc-modal-title"
              className="text-base sm:text-xl font-semibold text-slate-900 tracking-tight"
            >
              Escalate to Assurance
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              Describe the problem an action has caused or surfaced. Assurance will generate
              detective, preventive, corrective and improvement actions.
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={isSaving}
            className="p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 disabled:opacity-50"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 sm:p-6 space-y-4">
          <div>
            <label className={labelCls} htmlFor="esc-title">
              Problem summary <span className="text-red-500">*</span>
            </label>
            <input
              id="esc-title"
              required
              disabled={isSaving}
              className={inputCls}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Remediation works overran and breached the damp deadline"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelCls} htmlFor="esc-severity">
                Severity
              </label>
              <select
                id="esc-severity"
                disabled={isSaving}
                className={inputCls}
                value={severity}
                onChange={(e) => setSeverity(e.target.value as AssuranceSeverity)}
              >
                {ASSURANCE_SEVERITIES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls} htmlFor="esc-reason">
                Why it reached Assurance
              </label>
              <select
                id="esc-reason"
                disabled={isSaving}
                className={inputCls}
                value={failureReason}
                onChange={(e) => setFailureReason(e.target.value as AssuranceFailureReason)}
              >
                {(Object.keys(ASSURANCE_FAILURE_LABELS) as AssuranceFailureReason[]).map((r) => (
                  <option key={r} value={r}>
                    {ASSURANCE_FAILURE_LABELS[r]}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className={labelCls} htmlFor="esc-desc">
              What happened
            </label>
            <textarea
              id="esc-desc"
              disabled={isSaving}
              className={`${inputCls} min-h-24`}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="The action taken, what it delayed or caused, and any control involved."
            />
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </p>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 p-4 sm:p-6 border-t border-slate-100">
          <button
            onClick={onClose}
            disabled={isSaving}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSaving}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {isSaving ? "Escalating…" : "Escalate & generate actions"}
          </button>
        </div>
      </div>
    </div>
  );
}
