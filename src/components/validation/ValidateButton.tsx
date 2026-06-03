// ValidateButton — the drop-in Fact-Check / Validate control for any AI surface.
// Shows the live validation status; clicking runs the fact-check (if not already
// run) and opens the FactCheckPanel in a modal. Surfaces use the companion
// `useValidationGate` hook to block their approve/submit action until validated.

import { useState } from "react";
import { createPortal } from "react-dom";
import { clsx } from "clsx";
import toast from "react-hot-toast";
import { ShieldCheck, ShieldAlert, SearchCheck, Loader2 } from "lucide-react";
import { useValidationGate } from "../../hooks/useValidationGate";
import FactCheckPanel from "./FactCheckPanel";

type ContentArg = string | (() => string);
const resolveArg = (v?: ContentArg) =>
  typeof v === "function" ? v() : v;

export default function ValidateButton({
  surface,
  targetId,
  contextId,
  label,
  content,
  ratingsContext,
  className,
  disabled,
}: {
  surface: string;
  targetId: string;
  contextId?: string | null;
  label?: string;
  /** The AI output to verify — string or lazy getter (evaluated on click). */
  content: ContentArg;
  /** Optional ratings/scores for the Q6 sanity-check — string or lazy getter. */
  ratingsContext?: ContentArg;
  className?: string;
  disabled?: boolean;
}) {
  const gate = useValidationGate(surface, targetId);
  const [open, setOpen] = useState(false);
  const [running, setRunning] = useState(false);

  const start = async () => {
    setOpen(true);
    if (!gate.record && !running) {
      setRunning(true);
      try {
        await gate.runFactCheck({
          content: String(resolveArg(content) || "").slice(0, 24000),
          contextId,
          label,
          ratingsContext: resolveArg(ratingsContext),
          targetType: surface,
        });
      } catch (e: any) {
        toast.error(e?.message || "Fact-check failed");
      } finally {
        setRunning(false);
      }
    }
  };

  // The "unchecked" state is the call-to-action that unblocks approval, so it
  // is deliberately the most eye-catching (gradient + glow + pulsing dot).
  const pill =
    gate.status === "validated"
      ? { Icon: ShieldCheck, cls: "text-emerald-700 bg-emerald-50 border-emerald-200", text: "Validated" }
      : gate.status === "awaiting_validation"
        ? { Icon: ShieldAlert, cls: "text-amber-800 bg-amber-100 border-amber-300", text: "Awaiting validation" }
        : gate.status === "rejected"
          ? { Icon: ShieldAlert, cls: "text-red-700 bg-red-50 border-red-200", text: "Rejected" }
          : {
              Icon: SearchCheck,
              cls: "text-white bg-gradient-to-r from-indigo-600 to-violet-600 border-transparent shadow-md shadow-indigo-500/30 hover:shadow-lg hover:shadow-indigo-500/40 hover:-translate-y-0.5",
              text: "Fact-check",
            };
  // While the persisted status is still loading on refresh, show a neutral
  // "Checking…" state instead of flashing the unchecked CTA (and block clicks so
  // we never start a duplicate fact-check before the existing one has loaded).
  const checking = gate.loading && !gate.record && !running;
  const displayPill = checking
    ? { Icon: Loader2, cls: "text-slate-500 bg-white border-slate-200", text: "Checking…" }
    : pill;
  const isCta = !checking && gate.status === "unchecked";
  const Icon = running || checking ? Loader2 : displayPill.Icon;

  return (
    <>
      <button
        type="button"
        onClick={start}
        disabled={disabled || checking}
        title="Fact-check & validate before approving"
        className={clsx(
          "relative inline-flex items-center gap-1.5 text-sm rounded-lg border transition-all duration-200 disabled:opacity-50",
          isCta ? "font-semibold px-3.5 py-2" : "font-medium px-3 py-1.5 hover:shadow-sm",
          displayPill.cls,
          className,
        )}
      >
        {/* Pulsing attention dot — only on the call-to-action state. */}
        {isCta && !running && (
          <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-violet-400 opacity-75" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-violet-300" />
          </span>
        )}
        <Icon className={clsx("w-4 h-4", (running || checking) && "animate-spin")} />
        {running || checking ? "Checking…" : displayPill.text}
      </button>
      {open &&
        createPortal(
          // Portalled to <body> so the overlay escapes any transformed/animated
          // ancestor (framer-motion sets `transform`, which would otherwise make
          // `position: fixed` anchor to that ancestor and drop the modal to the
          // bottom). Same rationale as TrendingTooltip.
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
            onClick={(e) => e.target === e.currentTarget && setOpen(false)}
          >
            <FactCheckPanel
              surface={surface}
              targetId={targetId}
              record={gate.record}
              running={running}
              onClose={() => setOpen(false)}
            />
          </div>,
          document.body,
        )}
    </>
  );
}
