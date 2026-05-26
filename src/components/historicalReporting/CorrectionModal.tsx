//  super_admin correction modal.
//
// Lets a platform super_admin patch a single field on a snapshot row.
// Generic by design: takes a target (collection + docId), shows the
// frozen JSON of the row, and exposes a single key/value editor for
// the field the admin wants to change. Required: ≥5-char reason for
// the audit trail.
//
// Workflow:
//   1. Admin picks collection from dropdown (HRC_ALL_COLLECTIONS).
//   2. Admin types the docId. (We don't list rows — for the
//      admin already knows the docId from the page they were viewing
//      or from the inspect endpoint.)
//   3. Frozen row content is fetched on-demand and displayed read-only.
//   4. Admin picks ONE field name + new value + reason → submits.
//   5. Server validates, writes patch + correctionHistory + audit
//      event, flips parent's `anyCorrected` flag.
//
// The modal is intentionally minimal — corrections should be rare and
// careful. A full row editor would invite mass overwrites that defeat
// the audit purpose.

import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ShieldCheck, X, Loader2, AlertTriangle } from "lucide-react";
import toast from "react-hot-toast";
import { api } from "../../lib/api";
import {
  HRC_ALL_COLLECTIONS,
  type HrcCollection,
  type YearMonth,
} from "../../types/historicalReporting";

interface CorrectionModalProps {
  open: boolean;
  yearMonth: YearMonth | null;
  /** Pre-fill the collection if opened from a specific page (e.g. risks).*/
  defaultCollection?: HrcCollection;
  onClose: () => void;
  /** Fired after a successful correction so the parent can refresh.*/
  onCorrected?: () => void;
}

const BLOCKED_FIELDS = new Set([
  "kind",
  "collection",
  "capturedAt",
  "docId",
  "projectId",
  "id",
]);

export function CorrectionModal({
  open,
  yearMonth,
  defaultCollection,
  onClose,
  onCorrected,
}: CorrectionModalProps) {
  const [collection, setCollection] = useState<HrcCollection>(
    defaultCollection ?? "risks",
  );
  const [docId, setDocId] = useState("");
  const [fieldKey, setFieldKey] = useState("");
  const [fieldValueRaw, setFieldValueRaw] = useState("");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Frozen row preview
  const [rowLoading, setRowLoading] = useState(false);
  const [rowData, setRowData] = useState<any | null>(null);
  const [rowError, setRowError] = useState<string | null>(null);

  // Reset when reopening or switching scope.
  useEffect(() => {
    if (open) {
      setCollection(defaultCollection ?? "risks");
      setDocId("");
      setFieldKey("");
      setFieldValueRaw("");
      setReason("");
      setRowData(null);
      setRowError(null);
    }
  }, [open, defaultCollection]);

  // Fetch the row's frozen data when the user has both collection + docId.
  // We pull the full snapshot and locate the row client-side rather than
  // adding a per-row read endpoint.
  useEffect(() => {
    if (!open || !yearMonth || !docId.trim()) {
      setRowData(null);
      setRowError(null);
      return;
    }
    let cancelled = false;
    setRowLoading(true);
    setRowError(null);
    (async () => {
      try {
        const res: any = await api.hrcReadSnapshot(yearMonth, collection);
        if (cancelled) return;
        if (!res?.success) {
          setRowError(res?.error ?? "Failed to load snapshot.");
          setRowData(null);
          return;
        }
        const entries: any[] = res.entries ?? [];
        // Match by either `docId` (governance) or sub-doc id; for legacy
        // arrays the docId is the projectId.
        const match = entries.find((e: any) => {
          if (e?.kind === "governanceDoc") return e.docId === docId.trim();
          if (e?.kind === "legacyArray") return e.projectId === docId.trim();
          return false;
        });
        setRowData(match ?? null);
        setRowError(match ? null : "No row matching this docId in the snapshot.");
      } catch (err: any) {
        if (cancelled) return;
        setRowError(err?.message ?? "Failed to load snapshot.");
        setRowData(null);
      } finally {
        if (!cancelled) setRowLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, yearMonth, collection, docId]);

  const fieldKeyValid = useMemo(
    () => fieldKey.trim() && !BLOCKED_FIELDS.has(fieldKey.trim()),
    [fieldKey],
  );
  const reasonValid = reason.trim().length >= 5;
  const canSubmit = !!yearMonth && !!docId.trim() && fieldKeyValid && reasonValid;

  const handleSubmit = async () => {
    if (!canSubmit || !yearMonth) return;
    setSubmitting(true);
    try {
      // Try parsing the value as JSON (so admins can pass numbers /
      // booleans / nested objects); fall back to plain string.
      let parsedValue: any = fieldValueRaw;
      const trimmed = fieldValueRaw.trim();
      if (trimmed === "") parsedValue = "";
      else {
        try {
          parsedValue = JSON.parse(trimmed);
        } catch {
          parsedValue = trimmed;
        }
      }
      const patch: Record<string, any> = { [fieldKey.trim()]: parsedValue };

      const res: any = await api.hrcCorrectSnapshotRow({
        yearMonth,
        collection,
        docId: docId.trim(),
        patch,
        reason: reason.trim(),
      });
      if (!res?.success) {
        throw new Error(res?.error ?? "Correction failed.");
      }
      toast.success("Correction applied.");
      onCorrected?.();
      onClose();
    } catch (err: any) {
      console.error("[CorrectionModal] submit failed", err);
      toast.error(err?.message ?? "Correction failed.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-sm"
            onClick={() => (submitting ? null : onClose())}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 sm:p-8"
          >
            <div
              className="w-full max-w-2xl rounded-lg border border-slate-200 bg-white shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <header className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-rose-50 text-rose-600">
                    <ShieldCheck className="h-4.5 w-4.5" />
                  </div>
                  <div>
                    <p className="font-mono text-[11px] font-semibold uppercase tracking-wide text-rose-600">
                      Super-admin correction
                    </p>
                    <h2 className="mt-0.5 text-base font-bold text-slate-900">
                      Patch snapshot row · {yearMonth ?? "—"}
                    </h2>
                    <p className="mt-0.5 text-[11px] text-slate-500">
                      Every correction is logged immutably and a "Corrected"
                      badge becomes permanent on this month.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => (submitting ? null : onClose())}
                  className="-mr-1 rounded-md p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                  aria-label="Close"
                  disabled={submitting}
                >
                  <X className="h-4 w-4" />
                </button>
              </header>

              <div className="space-y-4 px-5 py-5">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <label className="block">
                    <span className="font-mono text-[11px] font-semibold uppercase tracking-wider text-slate-600">
                      Collection
                    </span>
                    <select
                      value={collection}
                      onChange={(e) => setCollection(e.target.value as HrcCollection)}
                      className="mt-1 h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-xs text-slate-800 focus:border-rose-500 focus:outline-none focus:ring-2 focus:ring-rose-500/20"
                      disabled={submitting}
                    >
                      {HRC_ALL_COLLECTIONS.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block">
                    <span className="font-mono text-[11px] font-semibold uppercase tracking-wider text-slate-600">
                      Doc ID
                    </span>
                    <input
                      type="text"
                      value={docId}
                      onChange={(e) => setDocId(e.target.value)}
                      placeholder="e.g. P001 (legacy: projectId; governance: docId)"
                      className="mt-1 h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-xs text-slate-800 focus:border-rose-500 focus:outline-none focus:ring-2 focus:ring-rose-500/20"
                      disabled={submitting}
                    />
                  </label>
                </div>

                {/* Frozen row preview*/}
                <div className="overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
                  <p className="font-mono border-b border-slate-100 bg-white px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Frozen row preview
                  </p>
                  {rowLoading ? (
                    <div className="flex items-center gap-2 px-3 py-3 text-[11px] text-slate-500">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Loading row…
                    </div>
                  ) : rowError ? (
                    <p className="flex items-start gap-1.5 px-3 py-3 text-[11px] text-amber-700">
                      <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
                      {rowError}
                    </p>
                  ) : rowData ? (
                    <pre className="max-h-48 overflow-auto px-3 py-2 text-[10px] text-slate-700">
                      {JSON.stringify(rowData, null, 2)}
                    </pre>
                  ) : (
                    <p className="px-3 py-3 text-[11px] text-slate-400">
                      Pick a collection and enter a doc ID to preview the row.
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <label className="block">
                    <span className="font-mono text-[11px] font-semibold uppercase tracking-wider text-slate-600">
                      Field to patch
                    </span>
                    <input
                      type="text"
                      value={fieldKey}
                      onChange={(e) => setFieldKey(e.target.value)}
                      placeholder="e.g. status"
                      className="mt-1 h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-xs text-slate-800 focus:border-rose-500 focus:outline-none focus:ring-2 focus:ring-rose-500/20"
                      disabled={submitting}
                    />
                    {fieldKey.trim() && !fieldKeyValid && (
                      <p className="mt-1 text-[10px] text-rose-600">
                        Field is reserved (kind / collection / capturedAt / docId / projectId / id).
                      </p>
                    )}
                  </label>
                  <label className="block">
                    <span className="font-mono text-[11px] font-semibold uppercase tracking-wider text-slate-600">
                      New value
                    </span>
                    <input
                      type="text"
                      value={fieldValueRaw}
                      onChange={(e) => setFieldValueRaw(e.target.value)}
                      placeholder="String, number, true/false, or JSON"
                      className="mt-1 h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-xs font-mono text-slate-800 focus:border-rose-500 focus:outline-none focus:ring-2 focus:ring-rose-500/20"
                      disabled={submitting}
                    />
                    <p className="mt-1 text-[10px] text-slate-400">
                      Numbers / booleans / arrays / objects are parsed as JSON;
                      anything else is stored as a string.
                    </p>
                  </label>
                </div>

                <label className="block">
                  <span className="font-mono text-[11px] font-semibold uppercase tracking-wider text-slate-600">
                    Reason <span className="text-rose-600">*</span>
                  </span>
                  <textarea
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    rows={3}
                    placeholder="≥ 5 characters. This is captured immutably in the audit trail."
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-800 focus:border-rose-500 focus:outline-none focus:ring-2 focus:ring-rose-500/20"
                    disabled={submitting}
                  />
                  {reason.trim() && !reasonValid && (
                    <p className="mt-1 text-[10px] text-rose-600">
                      Reason must be at least 5 characters.
                    </p>
                  )}
                </label>
              </div>

              <footer className="flex items-center justify-between gap-3 border-t border-slate-100 px-5 py-3">
                <p className="text-[10px] text-slate-400">
                  Patches the named field only. Structural metadata (kind, capturedAt, etc.) is locked.
                </p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={onClose}
                    disabled={submitting}
                    className="inline-flex h-8 items-center rounded-md border border-slate-200 bg-white px-3 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={!canSubmit || submitting}
                    className="inline-flex h-8 items-center gap-1.5 rounded-md bg-rose-600 px-3 text-[11px] font-semibold text-white hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {submitting && <Loader2 className="h-3 w-3 animate-spin" />}
                    Apply correction
                  </button>
                </div>
              </footer>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
