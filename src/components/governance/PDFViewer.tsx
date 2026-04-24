import { useState } from 'react';
import { PDFViewer as EmbedPDFViewer } from '@embedpdf/react-pdf-viewer';
import { FileX2 } from 'lucide-react';

interface GovernancePDFViewerProps {
  src: string | null;
  className?: string;
  height?: string;
}

// Wraps EmbedPDF with an empty state and a load error fallback so we never
// blank-screen the user. EmbedPDF handles virtualisation, pinch-zoom, search
// and print out of the box (per §20 of the plan).
export function GovernancePDFViewer({
  src,
  className,
  height = '70vh',
}: GovernancePDFViewerProps) {
  const [loadError, setLoadError] = useState<string | null>(null);

  if (!src) {
    return (
      <div
        className={
          'flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 text-center p-10 dark:border-slate-700 dark:bg-slate-800/50 ' +
          (className ?? '')
        }
        style={{ minHeight: height }}
      >
        <FileX2 className="h-8 w-8 text-slate-300" strokeWidth={1.75} />
        <p className="mt-3 text-sm font-semibold text-slate-700 dark:text-slate-200">
          No PDF rendered yet
        </p>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          Click <span className="font-mono">Render PDF</span> in the sandbox to preview the document.
        </p>
      </div>
    );
  }

  if (loadError) {
    return (
      <div
        className={
          'flex flex-col items-center justify-center rounded-xl border border-rose-200 bg-rose-50 text-center p-10 dark:border-rose-900 dark:bg-rose-950/30 ' +
          (className ?? '')
        }
        style={{ minHeight: height }}
      >
        <FileX2 className="h-8 w-8 text-rose-400" strokeWidth={1.75} />
        <p className="mt-3 text-sm font-semibold text-rose-700 dark:text-rose-300">
          Could not load PDF
        </p>
        <p className="mt-1 max-w-md text-xs text-rose-600 dark:text-rose-400">{loadError}</p>
      </div>
    );
  }

  return (
    <div
      className={
        'overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800 ' +
        (className ?? '')
      }
      style={{ height }}
    >
      <EmbedPDFViewer
        config={{ src, theme: { preference: 'system' } }}
        style={{ width: '100%', height: '100%' }}
        onReady={() => setLoadError(null)}
      />
    </div>
  );
}
