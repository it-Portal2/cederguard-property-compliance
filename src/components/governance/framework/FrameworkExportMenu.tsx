import { useEffect, useRef, useState } from 'react';
import { Download, ChevronDown, FileText, Network, Loader2, X } from 'lucide-react';
import { clsx } from 'clsx';
import toast from 'react-hot-toast';
import { api } from '../../../lib/api';
import { GovernancePDFViewer } from '../PDFViewer';

type ExportKind = 'diagram' | 'constitution';

interface ExportedPdf {
  kind: ExportKind;
  filename: string;
  dataUri: string;
  rawBase64: string;
}

export function FrameworkExportMenu() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [busy, setBusy] = useState<ExportKind | null>(null);
  const [preview, setPreview] = useState<ExportedPdf | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [menuOpen]);

  const runExport = async (kind: ExportKind) => {
    setMenuOpen(false);
    setBusy(kind);
    try {
      const fn =
        kind === 'diagram'
          ? api.governanceExportFrameworkDiagram
          : api.governanceExportFrameworkConstitution;
      const res = await fn();
      const dataUri = `data:application/pdf;base64,${res.pdfBase64}`;
      setPreview({
        kind,
        filename: res.filename ?? `framework-${kind}.pdf`,
        dataUri,
        rawBase64: res.pdfBase64,
      });
      toast.success(
        kind === 'diagram' ? 'Diagram ready' : 'Constitution ready',
      );
    } catch (e: any) {
      console.error('[FrameworkExportMenu] export failed', e);
      toast.error(e?.message ?? 'Export failed.');
    } finally {
      setBusy(null);
    }
  };

  const downloadPreview = () => {
    if (!preview) return;
    const link = document.createElement('a');
    link.href = preview.dataUri;
    link.download = preview.filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const options: Array<{ kind: ExportKind; icon: typeof FileText; label: string; hint: string }> = [
    {
      kind: 'diagram',
      icon: Network,
      label: 'Framework diagram',
      hint: '1-page tree view with tier legend.',
    },
    {
      kind: 'constitution',
      icon: FileText,
      label: 'Constitution document',
      hint: 'Multi-page formal PDF with ToRs and thresholds.',
    },
  ];

  return (
    <>
      <div className="relative" ref={menuRef}>
        <button
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          disabled={busy !== null}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busy ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Download className="h-3.5 w-3.5" />
          )}
          {busy === 'diagram'
            ? 'Rendering diagram…'
            : busy === 'constitution'
            ? 'Rendering constitution…'
            : 'Export'}
          <ChevronDown
            className={clsx(
              'h-3 w-3 transition-transform',
              menuOpen && 'rotate-180',
            )}
          />
        </button>
        {menuOpen && (
          <div className="absolute right-0 top-10 z-30 w-72 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
            <ul className="py-1">
              {options.map((opt) => (
                <li key={opt.kind}>
                  <button
                    type="button"
                    onClick={() => runExport(opt.kind)}
                    className="flex w-full items-start gap-3 px-3 py-2.5 text-left transition-colors hover:bg-slate-50"
                  >
                    <opt.icon className="mt-0.5 h-4 w-4 shrink-0 text-indigo-600" strokeWidth={2.25} />
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{opt.label}</p>
                      <p className="text-[11px] text-slate-500">{opt.hint}</p>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {preview && (
        <div
          className="fixed inset-0 z-90 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm"
          onClick={(e) => e.target === e.currentTarget && setPreview(null)}
        >
          <div className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl">
            <header className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-3">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                  {preview.kind === 'diagram' ? (
                    <Network className="h-4 w-4" strokeWidth={2.25} />
                  ) : (
                    <FileText className="h-4 w-4" strokeWidth={2.25} />
                  )}
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">
                    {preview.kind === 'diagram' ? 'Framework diagram' : 'Constitution document'}
                  </p>
                  <h2 className="text-sm font-bold tracking-tight text-slate-900">
                    {preview.filename}
                  </h2>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={downloadPreview}
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-indigo-600 px-3 text-xs font-semibold text-white hover:bg-indigo-700"
                >
                  <Download className="h-3.5 w-3.5" />
                  Download
                </button>
                <button
                  type="button"
                  onClick={() => setPreview(null)}
                  aria-label="Close"
                  className="rounded-md p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </header>
            <div className="flex-1 overflow-hidden p-4">
              <GovernancePDFViewer src={preview.dataUri} height="75vh" />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
