import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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

interface PreviewRow {
  sheetRow: number;
  flags: Flag[];
  preview: {
    id: string;
    title: string;
    scheme: string;
    reportType: string;
    value: number;
    targetDecisionDate: string;
    classification: string;
    isHRB: boolean;
    wardsCount: number;
    gatesCount: number;
  };
}

interface Summary {
  totalRows: number;
  validRows: number;
  errorRows: number;
  warningRows: number;
  unknownBodyColumns: string[];
  headerRowIndex: number;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onCommitted: () => void;
}

const MAX_MB = 5;

// File → base64 (data-uri prefix stripped by server). Uses FileReader.
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== 'string') {
        reject(new Error('Unexpected file reader result.'));
        return;
      }
      resolve(result); // includes "data:...;base64," prefix; server handles both
    };
    reader.onerror = () => reject(reader.error ?? new Error('File read failed.'));
    reader.readAsDataURL(file);
  });
}

function formatGBP(value: number): string {
  if (!value || Number.isNaN(value)) return '—';
  return `£${Math.round(value).toLocaleString()}`;
}

export function ForwardPlanImportModal({ isOpen, onClose, onCommitted }: Props) {
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

  // Reset on open/close so a second import isn't poisoned by the first.
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
      setErrorMessage(`File too large — max ${MAX_MB}MB.`);
      return;
    }
    try {
      setPhase('parsing');
      const b64 = await fileToBase64(file);
      setFileName(file.name);
      setFileBase64(b64);
      const res = await api.governanceImportForwardPlanDryRun(b64);
      if (!res?.success) {
        throw new Error(res?.error ?? 'Parse failed.');
      }
      setRows(res.rows ?? []);
      setSummary(res.summary ?? null);
      setPhase('preview');
    } catch (e: any) {
      console.error('[ImportModal] dry-run failed', e);
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
      const res = await api.governanceImportForwardPlanCommit(fileBase64);
      if (!res?.success) {
        throw new Error(res?.error ?? 'Commit failed.');
      }
      setCommitResult({
        written: res.written ?? 0,
        skipped: res.skipped ?? 0,
        totalRows: res.totalRows ?? 0,
      });
      setPhase('done');
      toast.success(`${res.written ?? 0} Forward Plan items imported.`);
      onCommitted();
    } catch (e: any) {
      console.error('[ImportModal] commit failed', e);
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

  const sortedRows = useMemo(() => {
    // Errors first, then warnings, then clean — so reviewers spot issues.
    return [...rows].sort((a, b) => {
      const sa = a.flags.some((f) => f.severity === 'error')
        ? 0
        : a.flags.some((f) => f.severity === 'warning')
          ? 1
          : 2;
      const sb = b.flags.some((f) => f.severity === 'error')
        ? 0
        : b.flags.some((f) => f.severity === 'warning')
          ? 1
          : 2;
      if (sa !== sb) return sa - sb;
      return a.sheetRow - b.sheetRow;
    });
  }, [rows]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4"
        onClick={(e) => e.target === e.currentTarget && onClose()}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.98, y: 8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.98, y: 8 }}
          transition={{ duration: 0.15 }}
          className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-lg bg-white shadow-2xl"
        >
          {/* Header */}
          <header className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                <FileSpreadsheet className="h-4 w-4" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-slate-900">
                  Import Forward Plan from Excel
                </h2>
                <p className="text-[11px] text-slate-500">
                  Upload a council-formatted .xlsx. Review the preview before committing.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </header>

          {/* Body */}
          <div className="flex-1 overflow-y-auto">
            {phase === 'idle' && (
              <div className="p-6">
                {errorMessage && (
                  <div className="mb-3 flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                    <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <span>{errorMessage}</span>
                  </div>
                )}
                <div
                  className={clsx(
                    'flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed px-8 py-12 text-center transition-colors',
                    isDragging
                      ? 'border-indigo-400 bg-indigo-50/50'
                      : 'border-slate-200 bg-slate-50',
                  )}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDragging(true);
                  }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={onDrop}
                >
                  <UploadCloud className="h-8 w-8 text-slate-400" />
                  <div>
                    <p className="text-sm font-semibold text-slate-800">
                      Drop your Forward Plan .xlsx here
                    </p>
                    <p className="mt-1 text-[11px] text-slate-500">
                      Max {MAX_MB}MB. Sheet should have the standard columns:
                      Scheme · Report Title · Report Type · board-date columns.
                    </p>
                  </div>
                  <input
                    ref={inputRef}
                    type="file"
                    accept=".xlsx,.xls"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) void handleFile(file);
                      // Reset so picking the same filename twice still triggers change.
                      e.target.value = '';
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => inputRef.current?.click()}
                    className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-indigo-700"
                  >
                    Choose file
                  </button>
                </div>
                <div className="mt-4 flex items-start gap-2 rounded-lg bg-slate-50 px-3 py-2 text-[11px] text-slate-600">
                  <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
                  <span>
                    Rows with errors are flagged but skipped on commit. Only valid
                    rows write to Firestore. You can fix the sheet and re-import.
                  </span>
                </div>
              </div>
            )}

            {phase === 'parsing' && (
              <div className="flex flex-col items-center justify-center gap-3 py-16">
                <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
                <p className="text-xs font-semibold text-slate-700">
                  Parsing {fileName || 'file'}…
                </p>
              </div>
            )}

            {phase === 'preview' && summary && (
              <div className="p-5">
                {/* Summary strip */}
                <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <SummaryCard label="Total rows" value={summary.totalRows} tone="slate" />
                  <SummaryCard label="Valid" value={summary.validRows} tone="emerald" />
                  <SummaryCard label="Errors" value={summary.errorRows} tone="rose" />
                  <SummaryCard label="Warnings" value={summary.warningRows} tone="amber" />
                </div>

                {errorMessage && (
                  <div className="mb-3 flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                    <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <span>{errorMessage}</span>
                  </div>
                )}

                {summary.unknownBodyColumns.length > 0 && (
                  <div className="mb-3 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <div className="flex-1">
                      <p className="font-semibold">
                        {summary.unknownBodyColumns.length} column
                        {summary.unknownBodyColumns.length === 1 ? '' : 's'} couldn't be
                        matched to a framework body:
                      </p>
                      <p className="mt-0.5 text-[11px]">
                        {summary.unknownBodyColumns.join(' · ')}
                      </p>
                      <p className="mt-1 text-[11px]">
                        Dates in these columns will be skipped. Add the missing bodies to
                        your Governance Framework first to capture them.
                      </p>
                    </div>
                  </div>
                )}

                {/* Preview table — first 200 rows to keep DOM light */}
                <div className="overflow-hidden rounded-lg border border-slate-200">
                  <table className="w-full text-left text-xs">
                    <thead className="font-mono bg-slate-50 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                      <tr>
                        <th className="px-3 py-2">Row</th>
                        <th className="px-3 py-2">Title</th>
                        <th className="px-3 py-2">Scheme</th>
                        <th className="px-3 py-2">Value</th>
                        <th className="px-3 py-2">Target date</th>
                        <th className="px-3 py-2">Gates</th>
                        <th className="px-3 py-2">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedRows.slice(0, 200).map((r) => {
                        const hasError = r.flags.some((f) => f.severity === 'error');
                        const hasWarn = r.flags.some((f) => f.severity === 'warning');
                        return (
                          <tr
                            key={`row-${r.sheetRow}`}
                            className={clsx(
                              'border-t border-slate-100',
                              hasError && 'bg-rose-50/40',
                              !hasError && hasWarn && 'bg-amber-50/40',
                            )}
                          >
                            <td className="px-3 py-2 align-top text-[10px] tabular-nums text-slate-500">
                              {r.sheetRow}
                            </td>
                            <td className="px-3 py-2 align-top font-semibold text-slate-900">
                              <div className="max-w-xs truncate" title={r.preview.title}>
                                {r.preview.title || <span className="text-slate-400">—</span>}
                              </div>
                              {r.flags.length > 0 && (
                                <ul className="mt-1 space-y-0.5">
                                  {r.flags.map((f, i) => (
                                    <li
                                      key={i}
                                      className={clsx(
                                        'flex items-start gap-1 text-[10px]',
                                        f.severity === 'error'
                                          ? 'text-rose-700'
                                          : 'text-amber-700',
                                      )}
                                    >
                                      {f.severity === 'error' ? (
                                        <AlertCircle className="mt-0.5 h-2.5 w-2.5 shrink-0" />
                                      ) : (
                                        <AlertTriangle className="mt-0.5 h-2.5 w-2.5 shrink-0" />
                                      )}
                                      <span>
                                        <span className="font-semibold">{f.field}:</span>{' '}
                                        {f.message}
                                      </span>
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </td>
                            <td className="px-3 py-2 align-top text-slate-700">
                              <div className="max-w-[10rem] truncate" title={r.preview.scheme}>
                                {r.preview.scheme || <span className="text-slate-400">—</span>}
                              </div>
                            </td>
                            <td className="px-3 py-2 align-top tabular-nums text-slate-700">
                              {formatGBP(r.preview.value)}
                            </td>
                            <td className="px-3 py-2 align-top text-slate-700">
                              {r.preview.targetDecisionDate || (
                                <span className="text-slate-400">—</span>
                              )}
                            </td>
                            <td className="px-3 py-2 align-top text-slate-700">
                              {r.preview.gatesCount}
                            </td>
                            <td className="px-3 py-2 align-top">
                              {hasError ? (
                                <span className="inline-flex items-center rounded-full border border-rose-200 bg-rose-50 px-1.5 py-0.5 text-[9px] font-semibold text-rose-700">
                                  Error
                                </span>
                              ) : hasWarn ? (
                                <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[9px] font-semibold text-amber-800">
                                  Warning
                                </span>
                              ) : (
                                <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-[9px] font-semibold text-emerald-700">
                                  OK
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                {sortedRows.length > 200 && (
                  <p className="mt-2 text-[11px] text-slate-500">
                    Showing first 200 of {sortedRows.length} rows. All will be
                    processed on commit.
                  </p>
                )}
              </div>
            )}

            {phase === 'committing' && (
              <div className="flex flex-col items-center justify-center gap-3 py-16">
                <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
                <p className="text-xs font-semibold text-slate-700">
                  Committing {summary?.validRows ?? 0} rows…
                </p>
              </div>
            )}

            {phase === 'done' && commitResult && (
              <div className="flex flex-col items-center justify-center gap-3 px-8 py-14 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                  <CheckCircle2 className="h-6 w-6" />
                </div>
                <h3 className="text-sm font-semibold text-slate-900">
                  Import complete
                </h3>
                <p className="text-xs text-slate-600">
                  <span className="font-semibold text-emerald-700">
                    {commitResult.written}
                  </span>{' '}
                  row{commitResult.written === 1 ? '' : 's'} imported
                  {commitResult.skipped > 0 && (
                    <>
                      {' · '}
                      <span className="text-rose-700">
                        {commitResult.skipped} skipped (errors)
                      </span>
                    </>
                  )}
                </p>
              </div>
            )}
          </div>

          {/* Footer */}
          <footer className="flex items-center justify-end gap-2 border-t border-slate-200 bg-slate-50 px-5 py-3">
            {phase === 'preview' && (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setPhase('idle');
                    setFileName('');
                    setFileBase64('');
                    setRows([]);
                    setSummary(null);
                  }}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50"
                >
                  Choose a different file
                </button>
                <button
                  type="button"
                  onClick={handleCommit}
                  disabled={(summary?.validRows ?? 0) === 0}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Import {summary?.validRows ?? 0} row
                  {summary?.validRows === 1 ? '' : 's'}
                </button>
              </>
            )}
            {(phase === 'idle' ||
              phase === 'parsing' ||
              phase === 'committing') && (
              <button
                type="button"
                onClick={onClose}
                disabled={phase === 'parsing' || phase === 'committing'}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Cancel
              </button>
            )}
            {phase === 'done' && (
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-indigo-700"
              >
                Done
              </button>
            )}
          </footer>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// ───── Summary card helper ──────────────────────────────────────────────

type Tone = 'slate' | 'emerald' | 'rose' | 'amber';
const TONE_CLS: Record<Tone, string> = {
  slate: 'border-slate-200 bg-slate-50 text-slate-900',
  emerald: 'border-emerald-200 bg-emerald-50 text-emerald-900',
  rose: 'border-rose-200 bg-rose-50 text-rose-900',
  amber: 'border-amber-200 bg-amber-50 text-amber-900',
};

function SummaryCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: Tone;
}) {
  return (
    <div className={clsx('rounded-lg border px-3 py-2', TONE_CLS[tone])}>
      <p className="font-mono text-[10px] font-semibold uppercase tracking-wider opacity-75">
        {label}
      </p>
      <p className="mt-0.5 text-lg font-bold tabular-nums">{value}</p>
    </div>
  );
}
