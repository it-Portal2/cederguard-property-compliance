import { useMemo, useState } from "react";
import { motion } from "motion/react";
import {
  FileText,
  Image as ImageIcon,
  Mail,
  Download,
  AlertCircle,
  AlertTriangle,
  Info,
  FileStack,
} from "lucide-react";
import { clsx } from "clsx";

import { GovernancePDFViewer } from "../../governance/PDFViewer";
import { PdfPageOverlayViewer } from "../PdfPageOverlayViewer";
import { SendToArchitectModal } from "../SendToArchitectModal";
import type {
  Enquiry,
  DrawingTabContent,
  DrawingAnnotation,
  DrawingAnnotationSeverity,
} from "../../../types/technicalAssurance";

// Drawing tab. Side-by-side: source PDF on the left (EmbedPDF
// viewer reused from governance) + annotation list on the right. The user
// mentally maps numbered callouts to the PDF using the badges;
// will add an actual SVG overlay rendered server-side via pdf-lib.
//
// Locked decisions:
//   • — server-side overlay (deferred to 4b; viewer stays read-only)
//   • — send to architect via PDF + clipboard email (no SMTP)
//   • PRD US-3.2 — minimum 3 numbered callouts (validated server-side)

const SEVERITY_PILL: Record<DrawingAnnotationSeverity, string> = {
  info: "bg-slate-100 text-slate-700 border border-slate-200",
  warning: "bg-amber-50 text-amber-800 border border-amber-200",
  critical: "bg-rose-50 text-rose-700 border border-rose-200",
};

const SEVERITY_BADGE: Record<DrawingAnnotationSeverity, string> = {
  info: "bg-indigo-100 text-indigo-700",
  warning: "bg-amber-100 text-amber-800",
  critical: "bg-rose-100 text-rose-700",
};

const SEVERITY_ICON: Record<
  DrawingAnnotationSeverity,
  typeof Info
> = {
  info: Info,
  warning: AlertCircle,
  critical: AlertTriangle,
};

interface AnnotationCardProps {
  annotation: DrawingAnnotation;
  active: boolean;
  onActivate: () => void;
}

function AnnotationCard({
  annotation,
  active,
  onActivate,
}: AnnotationCardProps) {
  const Icon = SEVERITY_ICON[annotation.severity];
  return (
    <li>
      <button
        type="button"
        onClick={onActivate}
        className={clsx(
          "w-full rounded-lg border px-3 py-3 text-left transition-colors",
          active
            ? "border-indigo-300 bg-indigo-50/50"
            : "border-slate-200 bg-white hover:border-indigo-200 hover:bg-indigo-50/30",
        )}
      >
        <div className="flex items-start gap-3">
          <span
            className={clsx(
              "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[12px] font-bold",
              SEVERITY_BADGE[annotation.severity],
            )}
          >
            {annotation.number}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <p className="truncate text-sm font-semibold text-slate-900">
                {annotation.label}
              </p>
              <span
                className={clsx(
                  "inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize",
                  SEVERITY_PILL[annotation.severity],
                )}
              >
                <Icon className="h-3 w-3" />
                {annotation.severity}
              </span>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
              <span className="font-mono">Page {annotation.page}</span>
              {annotation.dimension && (
                <span className="font-mono text-indigo-700">
                  {annotation.dimension}
                </span>
              )}
              {annotation.regId && (
                <span className="font-mono">cite: {annotation.regId}</span>
              )}
            </div>
            {annotation.note && (
              <p className="mt-2 text-[12px] leading-relaxed text-slate-600">
                {annotation.note}
              </p>
            )}
          </div>
        </div>
      </button>
    </li>
  );
}

interface DrawingTabProps {
  enquiry: Enquiry;
  drawing: DrawingTabContent;
}

export function DrawingTab({ enquiry, drawing }: DrawingTabProps) {
  const [activeId, setActiveId] = useState<string | null>(
    drawing.annotations[0]?.id ?? null,
  );
  const [sendOpen, setSendOpen] = useState(false);

  // multi-PDF picker. When the enquiry has multiple PDF
  // attachments, the PM can switch which one the viewer shows. The
  // AI-annotated PDF (the one with `drawing.basePdfPath`) keeps its
  // overlay markers; other PDFs render in the bare GovernancePDFViewer
  // with no annotations (AI annotates only the primary drawing per
  // PRD US-3.2 — multi-PDF AI annotation is a + track because it
  // doubles inline-data + token cost per Gemini call).
  const allPdfs = useMemo(() => {
    const atts = enquiry.attachments ?? [];
    return atts.filter(
      (a) =>
        a?.url &&
        (a.mimeType === "application/pdf" ||
          String(a.fileName ?? "").toLowerCase().endsWith(".pdf")),
    );
  }, [enquiry.attachments]);

  // Default to the AI-annotated PDF; fall back to the first PDF.
  const aiAnnotatedPath = drawing.basePdfPath;
  const [activePdfPath, setActivePdfPath] = useState<string | null>(
    aiAnnotatedPath ?? allPdfs[0]?.storagePath ?? null,
  );
  const activePdf = useMemo(
    () => allPdfs.find((p) => p.storagePath === activePdfPath) ?? allPdfs[0],
    [allPdfs, activePdfPath],
  );
  const isViewingAnnotatedPdf =
    !!aiAnnotatedPath && activePdf?.storagePath === aiAnnotatedPath;
  const showMultiPicker = allPdfs.length > 1;

  // when at least one annotation has an x/y coordinate, the
  // overlay viewer renders the markers ON the PDF. Otherwise we fall back
  // to the bare GovernancePDFViewer (no overlay) and let the side panel
  // carry the numbered list. The viewer itself handles per-annotation
  // partial coordinate gracefully.
  const hasAnyCoords = drawing.annotations.some(
    (a) => typeof a.xPct === "number" && typeof a.yPct === "number",
  );

  return (
    <div className="space-y-4">
      {/* Header strip*/}
      <div className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm md:flex-row md:items-center md:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
            <ImageIcon className="h-5 w-5" strokeWidth={2.25} />
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">
              Drawing markup
            </p>
            <h2 className="text-base font-bold tracking-tight text-slate-900">
              {drawing.basePdfFileName ?? "Drawing in scope"}
            </h2>
            {drawing.summaryNote && (
              <p className="mt-1 max-w-xl text-[12px] leading-snug text-slate-500">
                {drawing.summaryNote}
              </p>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 self-start">
          {drawing.basePdfUrl && (
            <a
              href={drawing.basePdfUrl}
              download={drawing.basePdfFileName ?? "drawing.pdf"}
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[12px] font-semibold text-slate-700 hover:bg-slate-50"
            >
              <Download className="h-3.5 w-3.5" />
              Source PDF
            </a>
          )}
          <button
            type="button"
            onClick={() => setSendOpen(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-3 py-1.5 text-[12px] font-semibold text-white shadow-sm hover:bg-indigo-700"
          >
            <Mail className="h-3.5 w-3.5" />
            Send to architect
          </button>
        </div>
      </div>

      {/* Multi-PDF picker. Visible when the enquiry has more
 than one PDF attached. Each chip shows the file name; the
 AI-annotated PDF gets an indigo "AI" pill. Switching to a
 non-annotated PDF renders it in the bare viewer (no overlay).*/}
      {showMultiPicker ? (
        <div
          className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm"
          aria-label="PDF attachment picker"
        >
          <div className="flex items-center gap-2">
            <FileStack className="h-3.5 w-3.5 text-slate-400" />
            <span className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">
              Attached PDFs · {allPdfs.length}
            </span>
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {allPdfs.map((p) => {
              const isActive = p.storagePath === activePdfPath;
              const isAnnotated = p.storagePath === aiAnnotatedPath;
              return (
                <button
                  key={p.storagePath}
                  type="button"
                  onClick={() => {
                    setActivePdfPath(p.storagePath);
                    setActiveId(drawing.annotations[0]?.id ?? null);
                  }}
                  aria-pressed={isActive}
                  className={clsx(
                    "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[12px] font-medium transition-colors",
                    isActive
                      ? "border-indigo-400 bg-indigo-50 text-indigo-700"
                      : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50",
                  )}
                  title={p.fileName}
                >
                  <FileText className="h-3.5 w-3.5 shrink-0" />
                  <span className="max-w-45 truncate">{p.fileName}</span>
                  {isAnnotated ? (
                    <span className="ml-0.5 rounded bg-indigo-600 px-1 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white">
                      AI
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
          {!isViewingAnnotatedPdf ? (
            <p className="mt-2 text-[11px] text-slate-500">
              Viewing a PDF the AI did not annotate. Switch to the
              <span className="mx-1 inline-flex items-center rounded bg-indigo-600 px-1 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white">
                AI
              </span>
              PDF to see the markup overlay.
            </p>
          ) : null}
        </div>
      ) : null}

      {/* Side-by-side: PDF + annotations*/}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <div className="lg:col-span-7">
          {activePdf?.url ? (
            <motion.div
              key={activePdf.storagePath}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm"
            >
              {hasAnyCoords && isViewingAnnotatedPdf ? (
                <PdfPageOverlayViewer
                  pdfUrl={activePdf.url}
                  annotations={drawing.annotations}
                  activeAnnotationId={activeId}
                  onAnnotationClick={setActiveId}
                />
              ) : (
                <GovernancePDFViewer src={activePdf.url} height="70vh" />
              )}
            </motion.div>
          ) : (
            <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-slate-200 bg-slate-50/60 p-10 text-center">
              <FileText className="h-8 w-8 text-slate-300" strokeWidth={1.75} />
              <p className="text-sm font-semibold text-slate-700">
                Drawing not attached
              </p>
              <p className="max-w-xs text-[12px] text-slate-500">
                Re-open the enquiry and upload a PDF to see it rendered here
                alongside the AI markup.
              </p>
            </div>
          )}
        </div>

        <div className="lg:col-span-5">
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">
                Numbered callouts
              </p>
              <p className="text-[11px] text-slate-400">
                {drawing.annotations.length} item
                {drawing.annotations.length === 1 ? "" : "s"}
              </p>
            </div>
            <ul className="mt-3 space-y-2">
              {drawing.annotations.map((a) => (
                <AnnotationCard
                  key={a.id}
                  annotation={a}
                  active={activeId === a.id}
                  onActivate={() => setActiveId(a.id)}
                />
              ))}
            </ul>
          </div>

          <p className="mt-3 text-[11px] text-slate-400">
            {hasAnyCoords
              ? "Click any callout to highlight its marker on the drawing. Coordinates are AI-generated — re-generate the insight to refine."
              : "The AI couldn't place markers precisely on this drawing — page references remain the canonical reference. Re-generate to retry."}
          </p>
        </div>
      </div>

      <SendToArchitectModal
        isOpen={sendOpen}
        enquiry={enquiry}
        drawing={drawing}
        onClose={() => setSendOpen(false)}
      />
    </div>
  );
}
