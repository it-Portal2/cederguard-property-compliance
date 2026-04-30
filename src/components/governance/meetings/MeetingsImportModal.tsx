// Phase 5.5a — Meetings Excel import modal (PgM-only).
//
// Mirrors the FP import flow (Phase 5c). Two-step: dry-run preview,
// then commit. Server re-parses on commit (lesson #55) — never trusts
// client-held parsed rows.

import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  UploadCloud,
  FileSpreadsheet,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Info,
} from 'lucide-react';
import { clsx } from 'clsx';
import toast from 'react-hot-toast';
import { api } from '../../../lib/api';

type Phase = 'idle' | 'parsing' | 'preview' | 'committing' | 'done';

interface Flag {
  severity: 'error' | 'warning';
  field: string;
  message: string;
}

interface ParsedMeeting {
  id: string;
  governanceBodyId: string | null;
  governanceBodyLabel: string;
  date: string;
  timeStart: string;
  timeEnd: string;
  location: string;
  chairLabel: string;
  attendees: Array<{ uid: null; label: string }>;
}

interface PreviewRow {
  sheetRow: number;
  meeting: ParsedMeeting;
  flags: Flag[];
}

interface Summary {
  totalRows: number;
  validRows: number;
  errorRows: number;
  warningRows: number;
  unknownBodies: string[];
  headerRowIndex: number;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onCommitted: () => void;
}

const MAX_MB = 5;
const PREVIEW_CAP = 200;

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== 'string') {
        reject(new Error('Unexpected file reader result.'));
        return;
      }
      resolve(result);
    };
    reader.onerror = () => reject(reader.error ?? new Error('File read failed.'));
    reader.readAsDataURL(file);
  });
}

function formatGbDate(iso: string): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return iso;
  }
}

export function MeetingsImportModal({ isOpen, onClose, onCommitted }: Props) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [fileName, setFileName] = useState<string>('');
  const [fileBase64, setFileBase64] = useState<string>('');
  const [rows, setRows] = useState<PreviewRow[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [commitResult, setCommitResult] = useState<{
    written: number;
    skipped: number;
    totalRows: number;
  } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) {
      setPhase('idle');
      setFileName('');
      setFileBase64('');
      setRows([]);
      setSummary(null);
      setCommitResult(null);
      setErrorMessage('');
      setIsDragging(false);
    }
  }, [isOpen]);

  const handleFile = useCallback(async (file: File) => {
    setErrorMessage('');
    if (!/\.(xlsx|xls)$/i.test(file.name)) {
      setErrorMessage('Please upload a .xlsx file.');
      return;
    }
    if (file.size > MAX_MB * 1024 * 1024) {
      setErrorMessage(`File too large — max ${MAX_MB} MB.`);
      return;
    }
    try {
      setPhase('parsing');
      const b64 = await fileToBase64(file);
      setFileName(file.name);
      setFileBase64(b64);
      const res = await api.governanceImportMeetingsDryRun(b64);
      if (!res?.success) throw new Error(res?.error ?? 'Parse failed.');
      setRows(res.rows ?? []);
      setSummary(res.summary ?? null);
      setPhase('preview');
    } catch (e: any) {
      console.error('[MeetingsImportModal] dry-run failed', e);
      setErrorMessage(e?.message ?? 'Failed to parse the file.');
      setPhase('idle');
      setFileName('');
      setFileBase64('');
    }
  }, []);

  const handleCommit = useCallback(async () => {
    if (!fileBase64) return;
    setPhase('committing');
    setErrorMessage('');
    try {
      const res = await api.governanceImportMeetingsCommit(fileBase64);
      if (!res?.success) throw new Error(res?.error ?? 'Commit failed.');
      setCommitResult({
        written: res.written ?? 0,
        skipped: res.skipped ?? 0,
        totalRows: res.totalRows ?? 0,
      });
      setPhase('done');
      toast.success(`${res.written ?? 0} meetings imported.`);
      onCommitted();
    } catch (e: any) {
      console.error('[MeetingsImportModal] commit failed', e);
      setErrorMessage(e?.message ?? 'Commit failed.');
      setPhase('preview');
    }
  }, [fileBase64, onCommitted]);

  const onDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files?.[0];
      if (file) void handleFile(file);
    },
    [handleFile],
  );

  const sortedRows = [...rows].sort((a, b) => {
    const aErr = a.flags.some((f) => f.severity === 'error') ? 0 : 1;
    const bErr = b.flags.some((f) => f.severity === 'error') ? 0 : 1;
    if (aErr !== bErr) return aErr - bErr;
    const aWarn = a.flags.some((f) => f.severity === 'warning') ? 0 : 1;
    const bWarn = b.flags.some((f) => f.severity === 'warning') ? 0 : 1;
    if (aWarn !== bWarn) return aWarn - bWarn;
    return a.sheetRow - b.sheetRow;
  });
  const visibleRows = sortedRows.slice(0, PREVIEW_CAP);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm"
        onClick={(e) => {
          if (e.target === e.currentTarget && phase !== 'committing') onClose();
        }}
      >
        <motion.div
          initial={{ opacity: 0, y: 12, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 12, scale: 0.98 }}
          transition={{ duration: 0.18, ease: 'easeOut' }}
          className="relative flex max-h-[92vh] w-[min(960px,96vw)] flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl"
        >
          <header className="flex items-start gap-3 border-b border-slate-100 px-6 py-4">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-700">
              <FileSpreadsheet className="h-4 w-4" />
            </div>
            <div className="flex-1">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">
                Import schedule
              </p>
              <h2 className="text-base font-bold text-slate-900">
                Upload year-ahead meeting schedule
              </h2>
              <p className="mt-0.5 text-[11px] text-slate-500">
                Columns: Body · Date · Time Start · Time End · Location · Chair
                · (optional) Attendees
              </p>
            </div>
            <button
              type="button"
              onClick={() => phase !== 'committing' && onClose()}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </header>

          <div className="flex-1 overflow-y-auto px-6 py-5">
            {phase === 'idle' && (
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={onDrop}
                onClick={() => inputRef.current?.click()}
                className={clsx(
                  'flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-12 text-center transition-colors',
                  isDragging
                    ? 'border-indigo-400 bg-indigo-50'
                    : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50',
                )}
              >
                <UploadCloud className="h-10 w-10 text-slate-400" />
                <p className="mt-3 text-sm font-semibold text-slate-700">
                  Drag and drop a .xlsx file, or click to browse
                </p>
                <p className="mt-1 text-[11px] text-slate-500">
                  Max {MAX_MB} MB. Server re-parses on commit.
                </p>
                <input
                  ref={inputRef}
                  type="file"
                  accept=".xlsx,.xls"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void handleFile(f);
                    e.target.value = '';
                  }}
                />
                {errorMessage && (
                  <p className="mt-3 inline-flex items-center gap-1 rounded-md bg-rose-50 px-2 py-1 text-[11px] font-semibold text-rose-700">
                    <AlertCircle className="h-3 w-3" />
                    {errorMessage}
                  </p>
                )}
              </div>
            )}

            {phase === 'parsing' && (
              <div className="flex flex-col items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-indigo-500" />
                <p className="mt-2 text-xs text-slate-600">Parsing {fileName}…</p>
              </div>
            )}

            {(phase === 'preview' || phase === 'committing') && summary && (
              <>
                {/* Summary cards */}
                <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <SummaryCard label="Total" value={summary.totalRows} tone="slate" />
                  <SummaryCard label="Valid" value={summary.validRows} tone="emerald" />
                  <SummaryCard label="Errors" value={summary.errorRows} tone="rose" />
                  <SummaryCard label="Warnings" value={summary.warningRows} tone="amber" />
                </div>

                {summary.unknownBodies.length > 0 && (
                  <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
                    <p className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-800">
                      <AlertTriangle className="h-3 w-3" />
                      Unmatched bodies (will save without framework link):
                    </p>
                    <p className="mt-1 text-[11px] text-amber-700">
                      {summary.unknownBodies.join(' · ')}
                    </p>
                  </div>
                )}

                {/* Preview table */}
                <div className="overflow-hidden rounded-lg border border-slate-200">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-slate-100 bg-slate-50">
                      <tr>
                        <th className="px-3 py-2 font-semibold text-slate-600">Row</th>
                        <th className="px-3 py-2 font-semibold text-slate-600">Body</th>
                        <th className="px-3 py-2 font-semibold text-slate-600">Date</th>
                        <th className="px-3 py-2 font-semibold text-slate-600">Time</th>
                        <th className="px-3 py-2 font-semibold text-slate-600">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {visibleRows.map((row) => {
                        const hasError = row.flags.some((f) => f.severity === 'error');
                        const hasWarning = row.flags.some((f) => f.severity === 'warning');
                        return (
                          <tr
                            key={row.sheetRow}
                            className={clsx(
                              hasError ? 'bg-rose-50/50' : hasWarning ? 'bg-amber-50/40' : '',
                            )}
                          >
                            <td className="px-3 py-2 text-slate-500">{row.sheetRow}</td>
                            <td className="px-3 py-2">
                              <span className="font-semibold text-slate-900">
                                {row.meeting.governanceBodyLabel || '—'}
                              </span>
                              {!row.meeting.governanceBodyId && row.meeting.governanceBodyLabel && (
                                <span className="ml-1 inline-flex items-center gap-0.5 text-[10px] italic text-amber-700">
                                  <AlertTriangle className="h-2.5 w-2.5" />
                                  unmatched
                                </span>
                              )}
                            </td>
                            <td className="px-3 py-2 text-slate-700">
                              {formatGbDate(row.meeting.date)}
                            </td>
                            <td className="px-3 py-2 font-mono text-slate-700">
                              {row.meeting.timeStart}–{row.meeting.timeEnd}
                            </td>
                            <td className="px-3 py-2">
                              {hasError ? (
                                <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-semibold text-rose-700">
                                  <AlertCircle className="h-3 w-3" />
                                  Error
                                </span>
                              ) : hasWarning ? (
                                <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                                  <AlertTriangle className="h-3 w-3" />
                                  Warning
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                                  <CheckCircle2 className="h-3 w-3" />
                                  OK
                                </span>
                              )}
                              {row.flags.length > 0 && (
                                <span
                                  className="ml-1 cursor-help text-[10px] text-slate-500"
                                  title={row.flags.map((f) => f.message).join('\n')}
                                >
                                  ({row.flags.length})
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  {sortedRows.length > PREVIEW_CAP && (
                    <p className="border-t border-slate-100 bg-slate-50 px-3 py-2 text-[10px] italic text-slate-500">
                      Showing first {PREVIEW_CAP} rows. Server will commit all {sortedRows.length}.
                    </p>
                  )}
                </div>

                {errorMessage && (
                  <p className="mt-3 inline-flex items-center gap-1 rounded-md bg-rose-50 px-2 py-1 text-[11px] font-semibold text-rose-700">
                    <AlertCircle className="h-3 w-3" />
                    {errorMessage}
                  </p>
                )}
              </>
            )}

            {phase === 'done' && commitResult && (
              <div className="flex flex-col items-center justify-center py-10">
                <CheckCircle2 className="h-12 w-12 text-emerald-500" />
                <p className="mt-3 text-base font-bold text-slate-900">
                  {commitResult.written} meetings imported
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {commitResult.skipped > 0 && `${commitResult.skipped} skipped (errors). `}
                  Schedule view refreshed.
                </p>
              </div>
            )}
          </div>

          <footer className="flex items-center justify-between gap-2 border-t border-slate-100 px-6 py-3">
            <p className="inline-flex items-center gap-1 text-[10px] text-slate-400">
              <Info className="h-2.5 w-2.5" />
              Re-imports skip existing meetings (matched by body + date).
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => phase !== 'committing' && onClose()}
                disabled={phase === 'committing'}
                className="inline-flex h-9 items-center rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {phase === 'done' ? 'Close' : 'Cancel'}
              </button>
              {phase === 'preview' && summary && summary.validRows > 0 && (
                <button
                  type="button"
                  onClick={handleCommit}
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-indigo-600 px-3 text-xs font-semibold text-white transition-colors hover:bg-indigo-700"
                >
                  Commit {summary.validRows} meetings
                </button>
              )}
              {phase === 'committing' && (
                <button
                  type="button"
                  disabled
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-indigo-600 px-3 text-xs font-semibold text-white opacity-60"
                >
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Committing…
                </button>
              )}
            </div>
          </footer>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

function SummaryCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: 'slate' | 'emerald' | 'rose' | 'amber';
}) {
  const cls = {
    slate: 'bg-slate-50 text-slate-700 border-slate-200',
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    rose: 'bg-rose-50 text-rose-700 border-rose-200',
    amber: 'bg-amber-50 text-amber-700 border-amber-200',
  }[tone];
  return (
    <div className={clsx('rounded-lg border px-3 py-2', cls)}>
      <p className="text-[10px] font-semibold uppercase tracking-wider opacity-70">
        {label}
      </p>
      <p className="text-lg font-bold">{value}</p>
    </div>
  );
}
