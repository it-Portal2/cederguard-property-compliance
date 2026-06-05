import { useEffect, useRef, useState } from "react";
import { Loader2, AlertCircle, FileX2 } from "lucide-react";
import { clsx } from "clsx";
import type {
  DrawingAnnotation,
  DrawingAnnotationSeverity,
} from "../../../../shared/types/technicalAssurance";

// coordinate-accurate PDF overlay.
//
// Renders each PDF page as a <canvas> using pdfjs-dist (lazy-loaded so it
// doesn't bloat other routes), then layers an absolutely-positioned SVG
// overlay on top with a numbered marker per annotation at its xPct/yPct.
//
// Annotations missing coordinates fall back to the bottom-edge of the page
// in a single row so the user still sees them anchored to the right page.

const MARKER_BG: Record<DrawingAnnotationSeverity, string> = {
  info: "fill-indigo-600",
  warning: "fill-amber-500",
  critical: "fill-rose-600",
};

const MARKER_RING: Record<DrawingAnnotationSeverity, string> = {
  info: "stroke-indigo-200",
  warning: "stroke-amber-200",
  critical: "stroke-rose-200",
};

interface PdfPageOverlayViewerProps {
  pdfUrl: string;
  annotations: DrawingAnnotation[];
  activeAnnotationId?: string | null;
  onAnnotationClick?: (annotationId: string) => void;
  className?: string;
}

interface RenderedPage {
  pageNumber: number;
  /** CSS pixel width of the rendered canvas.*/
  width: number;
  /** CSS pixel height of the rendered canvas.*/
  height: number;
}

/** Picks a render scale that targets ~1400px wide on retina displays —
 *  legible text + reasonable bandwidth.*/
function pickScale(viewportWidth: number, displayWidth: number): number {
  if (!viewportWidth || !displayWidth) return 1.5;
  const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
  return Math.max(0.8, Math.min(2.5, (displayWidth / viewportWidth) * dpr));
}

export function PdfPageOverlayViewer({
  pdfUrl,
  annotations,
  activeAnnotationId,
  onAnnotationClick,
  className,
}: PdfPageOverlayViewerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  // `numPages` is set immediately once pdfjs reports it — we then render
  // exactly that many fixed page wrappers so subsequent setState calls (one
  // per page rendered) never unmount the wrappers the renderer is targeting.
  // This was the previous bug: an early-return that hid not-yet-rendered
  // wrappers caused page-2+'s `querySelector` to return null + the canvas
  // never reached the DOM.
  const [numPages, setNumPages] = useState<number | null>(null);
  const [pages, setPages] = useState<RenderedPage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Render the PDF whenever the URL changes.
  useEffect(() => {
    let cancelled = false;
    if (!pdfUrl) return;
    setLoading(true);
    setError(null);
    setPages([]);
    setNumPages(null);

    (async () => {
      try {
        // Lazy-load pdfjs-dist so Vite ships it as a separate chunk (only
        // pulled in when the Drawing tab opens with a PDF + coordinates).
        // Worker URL points at the bundled .mjs worker.
        const pdfjs = await import("pdfjs-dist");
        // Vite-friendly worker setup — `import.meta.url` resolves to a URL
        // bundled by Vite.
        try {
          const workerUrl = (
            await import("pdfjs-dist/build/pdf.worker.mjs?url")
          ).default;
          (pdfjs as any).GlobalWorkerOptions.workerSrc = workerUrl;
        } catch {
          // Fallback: use the unpkg-style CDN if the bundler can't resolve
          // the worker URL. Both paths produce the same effect.
          (pdfjs as any).GlobalWorkerOptions.workerSrc =
            `https://unpkg.com/pdfjs-dist@${(pdfjs as any).version}/build/pdf.worker.min.mjs`;
        }

        const loadingTask = (pdfjs as any).getDocument({ url: pdfUrl });
        const pdf = await loadingTask.promise;
        if (cancelled) return;

        // Snap the wrapper count to the real page count BEFORE the render
        // loop runs, so every page's `[data-pdf-page=N]` div is in the DOM.
        const totalPages = Math.min(50, Math.max(1, Number(pdf.numPages) || 1));
        setNumPages(totalPages);
        // Wait one tick so the wrapper divs are mounted before querySelector
        // looks for them.
        await new Promise<void>((resolve) =>
          requestAnimationFrame(() => resolve()),
        );
        if (cancelled) return;

        const container = containerRef.current;
        const containerWidth = container ? container.clientWidth : 800;

        const rendered: RenderedPage[] = [];
        // Render each page sequentially so the layout grows incrementally
        // and the user sees pages appear as they're ready.
        for (let pageNumber = 1; pageNumber <= totalPages; pageNumber++) {
          if (cancelled) return;
          const page = await pdf.getPage(pageNumber);
          // Default viewport (scale 1) gives the PDF's native size in pt.
          const baseViewport = page.getViewport({ scale: 1 });
          const scale = pickScale(baseViewport.width, containerWidth);
          const viewport = page.getViewport({ scale });

          const canvas = document.createElement("canvas");
          canvas.width = Math.floor(viewport.width);
          canvas.height = Math.floor(viewport.height);
          // Display size — cap to container width so the canvas scales down
          // visually if pdfjs rendered it wider than the available space.
          const displayWidth = Math.min(
            containerWidth,
            baseViewport.width * 1.5,
          );
          const displayHeight = (displayWidth / viewport.width) * viewport.height;
          canvas.style.width = `${displayWidth}px`;
          canvas.style.height = `${displayHeight}px`;
          canvas.className = "block";

          const ctx = canvas.getContext("2d");
          if (!ctx) continue;
          await page.render({ canvasContext: ctx, viewport, canvas }).promise;

          // Stamp the canvas into our wrapper div for this page. The wrapper
          // is guaranteed to exist because `numPages` was set above.
          const pageWrap = container?.querySelector<HTMLDivElement>(
            `[data-pdf-page="${pageNumber}"]`,
          );
          if (pageWrap) {
            pageWrap.innerHTML = "";
            pageWrap.appendChild(canvas);
          } else {
            console.warn(
              `[PdfPageOverlayViewer] page ${pageNumber} wrapper missing — DOM out of sync`,
            );
          }

          rendered.push({
            pageNumber,
            width: displayWidth,
            height: displayHeight,
          });
          if (!cancelled) setPages([...rendered]);
        }
        if (!cancelled) setLoading(false);
      } catch (e: any) {
        console.error("[PdfPageOverlayViewer] failed to render PDF:", e);
        if (!cancelled) {
          setError(e?.message ?? "Failed to render the PDF.");
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [pdfUrl]);

  // Group annotations by page for fast lookup.
  const annotationsByPage = new Map<number, DrawingAnnotation[]>();
  for (const a of annotations) {
    const arr = annotationsByPage.get(a.page) ?? [];
    arr.push(a);
    annotationsByPage.set(a.page, arr);
  }

  return (
    <div
      ref={containerRef}
      className={clsx(
        "relative space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-3",
        className,
      )}
    >
      {loading && pages.length === 0 && (
        <div className="flex flex-col items-center justify-center gap-2 py-16 text-slate-500">
          <Loader2 className="h-6 w-6 animate-spin text-indigo-500" />
          <p className="text-sm font-semibold">Rendering PDF…</p>
        </div>
      )}
      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {!loading && !error && pages.length === 0 && (
        <div className="flex flex-col items-center justify-center gap-2 py-12 text-slate-500">
          <FileX2 className="h-8 w-8 text-slate-300" />
          <p className="text-sm">No PDF data available.</p>
        </div>
      )}

      {/* Page slots — pre-create exactly `numPages` wrappers so the
 renderer can stamp canvases into them as they arrive. Wrappers
 stay mounted across re-renders so React's reconciler doesn't blow
 away DOM children we appended imperatively.*/}
      {Array.from({ length: numPages ?? 0 }).map((_, idx) => {
        const pageNumber = idx + 1;
        const rendered = pages.find((p) => p.pageNumber === pageNumber);
        const pageAnns = annotationsByPage.get(pageNumber) ?? [];
        const annsWithCoords = pageAnns.filter(
          (a) => typeof a.xPct === "number" && typeof a.yPct === "number",
        );
        const annsWithoutCoords = pageAnns.filter(
          (a) => typeof a.xPct !== "number" || typeof a.yPct !== "number",
        );
        return (
          <div
            key={pageNumber}
            className="relative mx-auto w-fit overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm"
          >
            <div
              data-pdf-page={pageNumber}
              className="block"
              style={
                rendered
                  ? { width: rendered.width, height: rendered.height }
                  : undefined
              }
            />
            {rendered && (
              <>
                {/* Page number badge — bottom-left*/}
                <span className="pointer-events-none absolute bottom-1.5 left-1.5 rounded bg-slate-900/70 px-1.5 py-0.5 font-mono text-[10px] font-bold text-white">
                  Page {pageNumber}
                </span>

                {/* Coordinate-accurate markers — SVG overlay sized to the
 canvas, with circles + numeric labels.*/}
                {annsWithCoords.length > 0 && (
                  <svg
                    className="pointer-events-none absolute inset-0"
                    viewBox={`0 0 100 ${(rendered.height / rendered.width) * 100}`}
                    preserveAspectRatio="none"
                  >
                    {annsWithCoords.map((a) => {
                      const x = a.xPct as number;
                      const y =
                        ((a.yPct as number) * rendered.height) /
                        rendered.width;
                      const isActive = a.id === activeAnnotationId;
                      return (
                        <g
                          key={a.id}
                          onClick={() => onAnnotationClick?.(a.id)}
                          className="pointer-events-auto cursor-pointer"
                        >
                          {/* Outer ring — pulses on active*/}
                          <circle
                            cx={x}
                            cy={y}
                            r={isActive ? 3 : 2.4}
                            className={clsx(
                              MARKER_RING[a.severity],
                              "fill-white",
                            )}
                            strokeWidth={isActive ? 0.6 : 0.4}
                          />
                          {/* Inner badge*/}
                          <circle
                            cx={x}
                            cy={y}
                            r={1.7}
                            className={MARKER_BG[a.severity]}
                          />
                          <text
                            x={x}
                            y={y + 0.55}
                            textAnchor="middle"
                            className="pointer-events-none select-none fill-white font-bold"
                            style={{ fontSize: "1.6px" }}
                          >
                            {a.number}
                          </text>
                        </g>
                      );
                    })}
                  </svg>
                )}

                {/* Annotations the AI couldn't place precisely — render as
 a strip along the bottom of the page so they don't
 disappear.*/}
                {annsWithoutCoords.length > 0 && (
                  <div className="absolute inset-x-0 bottom-0 flex flex-wrap gap-1 bg-slate-900/60 p-1.5">
                    {annsWithoutCoords.map((a) => (
                      <button
                        key={a.id}
                        type="button"
                        onClick={() => onAnnotationClick?.(a.id)}
                        className={clsx(
                          "inline-flex items-center gap-1 rounded-full bg-white px-2 py-0.5 text-[10px] font-bold text-slate-700",
                          activeAnnotationId === a.id &&
                            "ring-2 ring-indigo-500",
                        )}
                        title={a.label}
                      >
                        <span
                          className={clsx(
                            "inline-block h-1.5 w-1.5 rounded-full",
                            a.severity === "critical"
                              ? "bg-rose-500"
                              : a.severity === "warning"
                                ? "bg-amber-500"
                                : "bg-indigo-500",
                          )}
                        />
                        {a.number}
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}
