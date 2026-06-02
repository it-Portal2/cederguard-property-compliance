// FactCheckPanel — renders a ValidationRecord: claims + verdicts, the Q6
// rating-flag sanity-checks, a soft-flagged confidence score, the unified
// source list, attach link/upload-file controls, and Validate/Reject actions
// gated to PM+ (Q3=A). All mutations go through the useStore validation slice.

import { useState } from "react";
import { clsx } from "clsx";
import toast from "react-hot-toast";
import {
  CheckCircle2,
  XCircle,
  HelpCircle,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  Loader2,
  Paperclip,
  Link2,
  Upload,
  Trash2,
  X,
} from "lucide-react";
import { useStore } from "../../store/useStore";
import type { UserRole } from "../../lib/roles";
import {
  canValidate,
  isLowConfidence,
  statusLabel,
  type ValidationRecord,
} from "../../lib/validation";
import SourceList from "./SourceList";

const VERDICT_STYLE: Record<string, { icon: any; cls: string }> = {
  supported: { icon: CheckCircle2, cls: "text-emerald-700 bg-emerald-50 border-emerald-200" },
  unsupported: { icon: XCircle, cls: "text-red-700 bg-red-50 border-red-200" },
  uncertain: { icon: HelpCircle, cls: "text-amber-700 bg-amber-50 border-amber-200" },
};

const STATUS_STYLE: Record<string, string> = {
  validated: "text-emerald-700 bg-emerald-50 border-emerald-200",
  awaiting_validation: "text-amber-700 bg-amber-50 border-amber-200",
  rejected: "text-red-700 bg-red-50 border-red-200",
  unchecked: "text-slate-600 bg-slate-50 border-slate-200",
};

const MAX_FILE_BYTES = 3 * 1024 * 1024;

export default function FactCheckPanel({
  surface,
  targetId,
  record,
  running,
  onClose,
}: {
  surface: string;
  targetId: string;
  record: ValidationRecord | null;
  running?: boolean;
  onClose?: () => void;
}) {
  const user = useStore((s) => s.user);
  const setValidationStatus = useStore((s) => s.setValidationStatus);
  const attachValidationSource = useStore((s) => s.attachValidationSource);
  const removeValidationSource = useStore((s) => s.removeValidationSource);

  const role = (user?.role || user?.profile?.role) as UserRole | undefined;
  const mayValidate = canValidate(role);

  const [busy, setBusy] = useState<string | null>(null);
  const [linkUrl, setLinkUrl] = useState("");
  const [linkTitle, setLinkTitle] = useState("");

  const fc = record?.factCheck;
  const status = record?.status ?? "unchecked";
  const confidencePct =
    typeof fc?.overallConfidence === "number"
      ? Math.round(fc.overallConfidence * 100)
      : null;
  const lowConf = isLowConfidence(fc?.overallConfidence);

  const act = async (label: string, fn: () => Promise<any>) => {
    setBusy(label);
    try {
      await fn();
    } catch (e: any) {
      toast.error(e?.message || "Action failed");
    } finally {
      setBusy(null);
    }
  };

  const onValidate = () =>
    act("validate", async () => {
      await setValidationStatus(surface, targetId, "validated");
      toast.success("Validated");
    });
  const onReject = () =>
    act("reject", async () => {
      await setValidationStatus(surface, targetId, "rejected");
      toast("Marked as rejected");
    });
  const onAddLink = () =>
    act("link", async () => {
      if (!linkUrl.trim()) return;
      await attachValidationSource(surface, targetId, {
        kind: "link",
        url: linkUrl.trim(),
        title: linkTitle.trim() || linkUrl.trim(),
      });
      setLinkUrl("");
      setLinkTitle("");
      toast.success("Link attached");
    });
  const onUpload = (file: File) =>
    act("file", async () => {
      if (file.size > MAX_FILE_BYTES) {
        toast.error("File too large (max 3 MB).");
        return;
      }
      const base64 = await new Promise<string>((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(String(r.result));
        r.onerror = () => reject(new Error("Could not read file"));
        r.readAsDataURL(file);
      });
      await attachValidationSource(surface, targetId, {
        kind: "file",
        base64,
        mime: file.type || "application/octet-stream",
        title: file.name,
      });
      toast.success("File attached");
    });

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm w-full max-w-2xl max-h-[85vh] overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 sticky top-0 bg-white">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-indigo-600" />
          <h3 className="font-semibold tracking-tight text-slate-900">
            Fact-check &amp; validation
          </h3>
          <span
            className={clsx(
              "font-mono uppercase tracking-wide text-[10px] font-medium px-2 py-0.5 rounded-full border",
              STATUS_STYLE[status],
            )}
          >
            {statusLabel(status)}
          </span>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {running && !record && (
        <div className="px-5 py-10 flex flex-col items-center gap-3 text-slate-500">
          <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
          <p className="text-sm">Searching sources &amp; verifying claims…</p>
        </div>
      )}

      {record && (
        <div className="p-5 space-y-5">
          {/* Summary + confidence */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="font-mono uppercase tracking-wide text-[11px] font-medium text-slate-500">
                Summary
              </span>
              {confidencePct !== null && (
                <span
                  className={clsx(
                    "font-mono tabular-nums text-[11px] font-medium px-2 py-0.5 rounded-full border inline-flex items-center gap-1",
                    lowConf
                      ? "text-amber-700 bg-amber-50 border-amber-200"
                      : "text-emerald-700 bg-emerald-50 border-emerald-200",
                  )}
                  title={
                    lowConf
                      ? "Low confidence — needs attention"
                      : "Model-estimated confidence"
                  }
                >
                  {lowConf && <AlertTriangle className="w-3 h-3" />}
                  {confidencePct}% confidence
                </span>
              )}
            </div>
            <p className="text-sm text-slate-700 leading-relaxed">
              {fc?.summary || "No summary produced."}
            </p>
          </div>

          {/* Claims */}
          {fc?.claims && fc.claims.length > 0 && (
            <div>
              <span className="font-mono uppercase tracking-wide text-[11px] font-medium text-slate-500">
                Claims checked ({fc.claims.length})
              </span>
              <ul className="mt-2 space-y-2">
                {fc.claims.map((c, i) => {
                  const st = VERDICT_STYLE[c.verdict] ?? VERDICT_STYLE.uncertain;
                  const Icon = st.icon;
                  return (
                    <li
                      key={i}
                      className="flex items-start gap-2 text-sm text-slate-700"
                    >
                      <span
                        className={clsx(
                          "mt-0.5 inline-flex items-center gap-1 px-1.5 py-0.5 rounded border font-mono uppercase tracking-wide text-[10px] font-medium flex-shrink-0",
                          st.cls,
                        )}
                      >
                        <Icon className="w-3 h-3" />
                        {c.verdict}
                      </span>
                      <span>
                        <span className="font-medium">{c.claim}</span>
                        {c.note && (
                          <span className="text-slate-500"> — {c.note}</span>
                        )}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {/* Rating flags (Q6=B) */}
          {fc?.ratingFlags && fc.ratingFlags.length > 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
              <span className="flex items-center gap-1.5 font-mono uppercase tracking-wide text-[11px] font-medium text-amber-700">
                <ShieldAlert className="w-3.5 h-3.5" />
                Ratings to review ({fc.ratingFlags.length})
              </span>
              <ul className="mt-2 space-y-1 text-sm text-amber-900">
                {fc.ratingFlags.map((f, i) => (
                  <li key={i}>
                    <span className="font-medium">{f.field}</span>
                    {f.observed && (
                      <span className="font-mono tabular-nums"> ({f.observed})</span>
                    )}{" "}
                    — {f.note}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Sources */}
          {record.citations && record.citations.length > 0 && (
            <div>
              <span className="font-mono uppercase tracking-wide text-[11px] font-medium text-slate-500">
                Sources
              </span>
              <div className="mt-2">
                <SourceList citations={record.citations} />
              </div>
            </div>
          )}

          {/* Attachments */}
          <div>
            <span className="flex items-center gap-1.5 font-mono uppercase tracking-wide text-[11px] font-medium text-slate-500">
              <Paperclip className="w-3.5 h-3.5" />
              Attached evidence
            </span>
            {record.attachments && record.attachments.length > 0 && (
              <ul className="mt-2 space-y-1">
                {record.attachments.map((a, i) => (
                  <li
                    key={i}
                    className="flex items-center justify-between gap-2 text-sm"
                  >
                    <a
                      href={a.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-indigo-600 hover:underline truncate"
                    >
                      {a.title || a.url}
                    </a>
                    {mayValidate && (
                      <button
                        onClick={() =>
                          act("remove", () =>
                            removeValidationSource(surface, targetId, a.url),
                          )
                        }
                        className="p-1 rounded hover:bg-red-50 text-red-500 flex-shrink-0"
                        aria-label="Remove attachment"
                        disabled={busy === "remove"}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {/* Add link + upload */}
            <div className="mt-3 space-y-2">
              <div className="flex items-center gap-2">
                <Link2 className="w-4 h-4 text-slate-400 flex-shrink-0" />
                <input
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                  placeholder="Paste a source link…"
                  className="flex-1 text-sm px-2.5 py-1.5 rounded-lg border border-slate-200 focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 outline-none"
                />
                <button
                  onClick={onAddLink}
                  disabled={!linkUrl.trim() || busy === "link"}
                  className="text-sm font-medium px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 disabled:opacity-50"
                >
                  {busy === "link" ? "Adding…" : "Add"}
                </button>
              </div>
              <label className="inline-flex items-center gap-1.5 text-sm font-medium text-indigo-600 cursor-pointer hover:text-indigo-700">
                <Upload className="w-4 h-4" />
                {busy === "file" ? "Uploading…" : "Upload a document (max 3 MB)"}
                <input
                  type="file"
                  className="hidden"
                  disabled={busy === "file"}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) onUpload(f);
                    e.target.value = "";
                  }}
                />
              </label>
            </div>
          </div>

          {/* Validate / Reject */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
            {!mayValidate ? (
              <span className="text-[12px] text-slate-500">
                Only a Project Manager and above can validate.
              </span>
            ) : (
              <>
                <button
                  onClick={onReject}
                  disabled={!!busy}
                  className="text-sm font-medium px-3.5 py-2 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-50"
                >
                  {busy === "reject" ? "…" : "Reject"}
                </button>
                <button
                  onClick={onValidate}
                  disabled={!!busy}
                  className="text-sm font-medium px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white inline-flex items-center gap-1.5 disabled:opacity-50"
                >
                  {busy === "validate" ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <ShieldCheck className="w-4 h-4" />
                  )}
                  Validate
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
