// Phase 10 — Audit trail drawer.
// Right-side slide-in panel listing every audit event matching the
// selected archive item (report / meeting / project doc).  Read-only;
// audit events are immutable WORM records.

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Loader2, Activity, ShieldCheck } from 'lucide-react';
import { api } from '../../../lib/api';
import type { ArchiveAuditEvent, ArchiveItem } from './types';

interface AuditTrailDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  item: ArchiveItem | null;
}

function formatGbDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '—';
  }
}

export function AuditTrailDrawer({ isOpen, onClose, item }: AuditTrailDrawerProps) {
  const [events, setEvents] = useState<ArchiveAuditEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !item) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    api
      .governanceGetArchiveAuditTrail(item.id)
      .then((res) => {
        if (cancelled) return;
        if (res?.success) setEvents((res.events ?? []) as ArchiveAuditEvent[]);
        else setError(res?.error ?? 'Failed to load audit trail.');
      })
      .catch((e: any) => {
        if (cancelled) return;
        setError(e?.message ?? 'Failed to load audit trail.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen, item]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="backdrop"
          className="fixed inset-0 z-50 flex justify-end bg-slate-900/40"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={(e) => e.target === e.currentTarget && onClose()}
        >
          <motion.aside
            key="panel"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            className="flex h-full w-full max-w-md flex-col bg-white shadow-xl ring-1 ring-slate-200"
          >
            <header className="flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-indigo-100 text-indigo-700">
                  <Activity className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <h2 className="truncate text-base font-semibold text-slate-900">
                    Audit trail
                  </h2>
                  <p className="truncate text-xs text-slate-500">
                    {item?.title ?? '—'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </header>

            {item?.goldenThreadHash && (
              <div className="border-b border-emerald-200 bg-emerald-50 px-5 py-3 text-xs text-emerald-800">
                <div className="flex items-start gap-2">
                  <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
                  <div className="min-w-0">
                    <p className="font-semibold">Golden Thread record</p>
                    <p className="mt-0.5 truncate font-mono text-[11px]">
                      {item.goldenThreadHash}
                    </p>
                    <p className="mt-1 text-[11px] text-emerald-700">
                      Immutable WORM chain — required for HRB Building Safety Act compliance.
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="flex-1 overflow-y-auto px-5 py-4">
              {loading ? (
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading…
                </div>
              ) : error ? (
                <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">
                  {error}
                </div>
              ) : events.length === 0 ? (
                <p className="text-xs text-slate-500">
                  No recorded audit events for this item yet. Future state changes will appear here.
                </p>
              ) : (
                <ol className="space-y-3">
                  {events.map((ev) => (
                    <li
                      key={ev._id}
                      className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate font-mono text-[11px] font-semibold text-indigo-700">
                          {ev.action ?? 'event'}
                        </span>
                        <span className="shrink-0 text-[10px] text-slate-500">
                          {formatGbDateTime(ev.createdAt ?? ev.timestamp)}
                        </span>
                      </div>
                      <p className="mt-1 break-all text-[11px] text-slate-600">
                        Actor: {ev.actorUid ?? '—'}
                      </p>
                      {ev.meta && Object.keys(ev.meta).length > 0 && (
                        <pre className="mt-1.5 overflow-x-auto rounded bg-white px-2 py-1.5 text-[10px] text-slate-700 ring-1 ring-slate-200">
{JSON.stringify(ev.meta, null, 2)}
                        </pre>
                      )}
                    </li>
                  ))}
                </ol>
              )}
            </div>

            <footer className="border-t border-slate-200 bg-slate-50 px-5 py-3 text-[11px] text-slate-500">
              Audit events are immutable. Retention: 25 years for HRB / 7 years for non-HRB.
            </footer>
          </motion.aside>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
