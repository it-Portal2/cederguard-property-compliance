//  side panel listing every correction made against a
// snapshot month.
//
// Mounts as a slide-in drawer, fetched on open via
// `api.hrcListCorrections({ yearMonth })`. Read-only — corrections
// themselves are immutable (locks audit-trail integrity).
//
// FOI / Scrutiny readers get full visibility: who corrected what,
// when, why, with before/after snapshots inline.

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ShieldCheck, X, Loader2, History } from "lucide-react";
import toast from "react-hot-toast";
import { api } from "../../lib/api";
import type { CorrectionEvent, YearMonth } from "../../types/historicalReporting";

interface CorrectionHistoryProps {
  open: boolean;
  yearMonth: YearMonth | null;
  onClose: () => void;
  /** Optional row scope — if set, only corrections for this specific
   *  (collection, docId) are listed. Default: all corrections for the
   *  month.*/
  scope?: { collection?: string; docId?: string };
  /** Bumped to force a refetch (e.g. after a new correction lands).*/
  refreshTick?: number;
}

function formatTs(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export function CorrectionHistory({
  open,
  yearMonth,
  onClose,
  scope,
  refreshTick = 0,
}: CorrectionHistoryProps) {
  const [entries, setEntries] = useState<CorrectionEvent[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !yearMonth) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const res: any = await api.hrcListCorrections({
          yearMonth,
          collection: scope?.collection,
          docId: scope?.docId,
        });
        if (cancelled) return;
        if (!res?.success) {
          toast.error(res?.error ?? "Failed to load corrections.");
          setEntries([]);
        } else {
          setEntries((res.entries ?? []) as CorrectionEvent[]);
        }
      } catch (err: any) {
        if (cancelled) return;
        toast.error(err?.message ?? "Failed to load corrections.");
        setEntries([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, yearMonth, scope?.collection, scope?.docId, refreshTick]);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-40 bg-slate-900/40"
            onClick={onClose}
          />
          <motion.aside
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 320, damping: 32 }}
            className="fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col bg-white shadow-2xl"
          >
            <header className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
              <div>
                <p className="font-mono flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-rose-600">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Correction history
                </p>
                <h2 className="mt-0.5 text-base font-bold text-slate-900">
                  {yearMonth
                    ? `Snapshot ${yearMonth}`
                    : "No snapshot selected"}
                </h2>
                {scope?.collection && (
                  <p className="mt-0.5 text-[11px] text-slate-500">
                    Scoped to <span className="font-mono">{scope.collection}</span>
                    {scope.docId ? ` / ${scope.docId}` : ""}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={onClose}
                className="-mr-1 rounded-md p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </header>

            <div className="flex-1 overflow-y-auto px-5 py-4">
              {loading ? (
                <div className="flex items-center justify-center py-12 text-slate-400">
                  <Loader2 className="h-5 w-5 animate-spin" />
                </div>
              ) : entries.length === 0 ? (
                <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center">
                  <History className="mx-auto h-7 w-7 text-slate-300" />
                  <p className="mt-3 text-sm font-semibold text-slate-700">
                    No corrections yet
                  </p>
                  <p className="mt-1 text-[11px] text-slate-500">
                    Snapshot rows have not been edited by an admin.
                  </p>
                </div>
              ) : (
                <ul className="space-y-3">
                  {entries.map((c) => (
                    <li
                      key={c.id}
                      className="rounded-lg border border-rose-100 bg-rose-50/40 p-3"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-[11px] font-semibold text-rose-900">
                            <span className="font-mono">{(c as any).collection}</span>
                            {" / "}
                            <span className="font-mono">{(c as any).docId}</span>
                          </p>
                          <p className="mt-0.5 text-[10px] text-slate-500">
                            {formatTs(c.correctedAt)} · by{" "}
                            <span className="font-mono">
                              {String(c.correctedBy ?? "—").slice(0, 32)}
                            </span>
                          </p>
                        </div>
                      </div>
                      <p className="mt-2 rounded bg-white px-2 py-1.5 text-[11px] text-slate-700">
                        <span className="font-semibold text-rose-700">Reason:</span>{" "}
                        {c.reason}
                      </p>
                      <details className="mt-2 text-[11px]">
                        <summary className="cursor-pointer font-semibold text-slate-600 hover:text-slate-900">
                          Show before / after
                        </summary>
                        <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                          <div className="overflow-hidden rounded border border-slate-200 bg-white">
                            <p className="font-mono border-b border-slate-100 bg-slate-50 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                              Before
                            </p>
                            <pre className="max-h-48 overflow-auto px-2 py-1.5 text-[10px] text-slate-700">
                              {JSON.stringify(c.before ?? null, null, 2)}
                            </pre>
                          </div>
                          <div className="overflow-hidden rounded border border-emerald-200 bg-white">
                            <p className="font-mono border-b border-emerald-100 bg-emerald-50 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-emerald-700">
                              After
                            </p>
                            <pre className="max-h-48 overflow-auto px-2 py-1.5 text-[10px] text-slate-700">
                              {JSON.stringify(c.after ?? null, null, 2)}
                            </pre>
                          </div>
                        </div>
                      </details>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
