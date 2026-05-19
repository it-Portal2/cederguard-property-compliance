import { useCallback, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  Download,
  Loader2,
  AlertCircle,
  FileText,
  Eye,
  EyeOff,
  Shield,
  ShieldOff,
} from 'lucide-react';
import { clsx } from 'clsx';
import toast from 'react-hot-toast';
import { api } from '../../../lib/api';
import { GovernancePDFViewer } from '../PDFViewer';

interface Props {
  isOpen: boolean;
  reportId: string;
  reportTitle: string;
  /** Pre-rendered base64 PDF if the caller already has one (e.g. sealed
   *  PDF download). When null/undefined the modal renders a fresh preview
   *  via governanceRenderReportPdf.*/
  pdfBase64?: string | null;
  /** Pre-set filename. Defaults to `<reportId>-<status>.pdf`.*/
  filename?: string;
  /** Heading shown above the viewer; defaults to "Preview PDF".*/
  title?: string;
  onClose: () => void;
}

export function ReportPdfPreviewModal({
  isOpen,
  reportId,
  reportTitle,
  pdfBase64,
  filename: filenameOverride,
  title = 'Preview PDF',
  onClose,
}: Props) {
  const [base64, setBase64] = useState<string | null>(null);
  const [filename, setFilename] = useState<string>('report.pdf');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // When true the preview re-renders without the status watermark — useful
  // for reading dense content. Disabled when the caller pre-supplied a PDF
  // (e.g. sealed download — already finalised).
  const [hideWatermark, setHideWatermark] = useState(false);
  // FOI / public-publication mode. When true, sections marked
  // Part 2 / Closed are replaced by a placeholder line in the rendered
  // PDF (the closed body is never written to the buffer). Defaults
  // false so internal previews show everything.
  const [redactPart2, setRedactPart2] = useState(false);

  // Reset toggles on open so each session starts with the audit-true
  // defaults (watermark visible, Part 2 NOT redacted).
  useEffect(() => {
    if (isOpen) {
      setHideWatermark(false);
      setRedactPart2(false);
    }
  }, [isOpen]);

  const renderPreview = useCallback(
    async (
      cancelledRef: { current: boolean },
      withoutWatermark: boolean,
      withRedaction: boolean,
    ) => {
      setLoading(true);
      setError(null);
      try {
        const res = await api.governanceRenderReportPdf(reportId, {
          noWatermark: withoutWatermark,
          redactPart2: withRedaction,
        });
        if (cancelledRef.current) return;
        if (!res?.success) throw new Error(res?.error ?? 'Render failed.');
        setBase64(res.pdfBase64 ?? null);
        setFilename(res.filename ?? filenameOverride ?? 'report.pdf');
      } catch (e: any) {
        if (cancelledRef.current) return;
        console.error('[ReportPdfPreview] render failed', e);
        setError(e?.message ?? 'Render failed.');
        toast.error(e?.message ?? 'Render failed.');
      } finally {
        if (!cancelledRef.current) setLoading(false);
      }
    },
    [reportId, filenameOverride],
  );

  useEffect(() => {
    if (!isOpen) {
      setBase64(null);
      setError(null);
      return;
    }
    // If caller pre-rendered (e.g. sealed PDF download), skip the fetch.
    if (pdfBase64) {
      setBase64(pdfBase64);
      setFilename(filenameOverride ?? 'report.pdf');
      return;
    }
    const cancelledRef = { current: false };
    void renderPreview(cancelledRef, hideWatermark, redactPart2);
    return () => {
      cancelledRef.current = true;
    };
  }, [
    isOpen,
    pdfBase64,
    filenameOverride,
    renderPreview,
    hideWatermark,
    redactPart2,
  ]);

  // Hide the toggle when the caller pre-rendered (sealed downloads etc.)
  // there's no server round-trip to flip the watermark on those.
  const canToggleWatermark = !pdfBase64;

  const dataUri = base64 ? `data:application/pdf;base64,${base64}` : null;

  const download = () => {
    if (!dataUri) return;
    const a = document.createElement('a');
    a.href = dataUri;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 p-4"
        onClick={(e) => e.target === e.currentTarget && onClose()}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.98, y: 8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.98, y: 8 }}
          transition={{ duration: 0.15 }}
          className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-lg bg-white shadow-2xl"
        >
          <header className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-3">
            <div className="flex items-start gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                <FileText className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
                <p className="mt-0.5 truncate text-[11px] text-slate-500">
                  {reportTitle}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              {canToggleWatermark && (
                <button
                  type="button"
                  onClick={() => setRedactPart2((v) => !v)}
                  disabled={loading}
                  className={clsx(
                    'inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-semibold transition-colors disabled:opacity-60',
                    redactPart2
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50',
                  )}
                  title={
                    redactPart2
                      ? 'Public / FOI mode — Part 2 sections replaced with placeholders'
                      : 'Redact Part 2 / Closed sections for FOI publication'
                  }
                >
                  {redactPart2 ? (
                    <Shield className="h-3.5 w-3.5" />
                  ) : (
                    <ShieldOff className="h-3.5 w-3.5" />
                  )}
                  {redactPart2 ? 'FOI mode (Part 2 redacted)' : 'FOI mode'}
                </button>
              )}
              {canToggleWatermark && (
                <button
                  type="button"
                  onClick={() => setHideWatermark((v) => !v)}
                  disabled={loading}
                  className={clsx(
                    'inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-semibold transition-colors disabled:opacity-60',
                    hideWatermark
                      ? 'border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100'
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50',
                  )}
                  title={
                    hideWatermark
                      ? 'Watermark hidden — re-render with watermark'
                      : 'Hide the status watermark to read content cleanly'
                  }
                >
                  {hideWatermark ? (
                    <EyeOff className="h-3.5 w-3.5" />
                  ) : (
                    <Eye className="h-3.5 w-3.5" />
                  )}
                  {hideWatermark ? 'Watermark hidden' : 'Hide watermark'}
                </button>
              )}
              <button
                type="button"
                onClick={download}
                disabled={!dataUri}
                className={clsx(
                  'inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50',
                  !dataUri && 'cursor-not-allowed opacity-60',
                )}
              >
                <Download className="h-3.5 w-3.5" />
                Download
              </button>
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </header>

          <div className="flex-1 overflow-hidden bg-slate-50 p-3">
            {loading ? (
              <div className="flex h-full min-h-[60vh] items-center justify-center gap-2 text-xs text-slate-500">
                <Loader2 className="h-4 w-4 animate-spin" />
                Rendering PDF…
              </div>
            ) : error ? (
              <div className="flex h-full min-h-[60vh] items-center justify-center">
                <div className="flex max-w-md items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">
                  <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <div>
                    <p className="font-semibold">Render failed</p>
                    <p className="mt-0.5">{error}</p>
                  </div>
                </div>
              </div>
            ) : (
              <GovernancePDFViewer src={dataUri} height="78vh" />
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
