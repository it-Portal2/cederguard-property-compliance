import { useState, useRef } from "react";
import { createPortal } from "react-dom";
import { Info } from "lucide-react";

/**
 * Hover tooltip for the Risk-to-Issue "Trending" badge inside the risk tables.
 *
 * Unlike the shared InfoTooltip, this renders its panel through a portal to
 * document.body so it escapes the DynamicTable's `overflow-x-auto` clipping
 * (an absolutely-positioned tooltip gets cut off by the scroll container).
 * z-40 keeps it ABOVE the table (max z-30) but BELOW modals / confirm dialogs /
 * dropdown overlays (z-50), so it never covers those.
 */
export function TrendingTooltip({ reasons }: { reasons: string[] }) {
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const ref = useRef<HTMLSpanElement>(null);

  const show = () => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setPos({ left: r.left + r.width / 2, top: r.top });
  };
  const hide = () => setPos(null);

  return (
    <span
      ref={ref}
      onMouseEnter={show}
      onMouseLeave={hide}
      className="inline-flex items-center justify-center ml-1 align-middle cursor-help"
    >
      <Info className="w-3.5 h-3.5 text-orange-600 hover:text-orange-800 transition-colors" />
      {pos &&
        createPortal(
          <div
            style={{
              position: "fixed",
              left: pos.left,
              top: pos.top - 8,
              transform: "translate(-50%, -100%)",
            }}
            className="z-40 w-64 p-2.5 bg-slate-800 text-white text-xs rounded-lg shadow-xl pointer-events-none font-normal normal-case tracking-normal leading-relaxed text-left"
          >
            <div className="font-semibold mb-1">
              Trending toward an issue — why:
            </div>
            <ul className="list-disc pl-4 space-y-0.5">
              {reasons.map((reason, i) => (
                <li key={i}>{reason}</li>
              ))}
            </ul>
            <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-800" />
          </div>,
          document.body,
        )}
    </span>
  );
}
