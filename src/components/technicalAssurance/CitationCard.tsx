// Citation card. Click expands inline to show the full verbatim
// quote + a real "Open source" external link to the gov.uk / HSE source
// (server-enriched from the regulations corpus at insight-generation time
// so the AI never supplies it).
//
// No more navigation to /regulations — that page didn't honour the deep-
// link, leaving the user stranded on a generic index. Inline expand keeps
// the user in the Compliance tab; external link goes straight to the
// authoritative source when they want primary evidence.

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ChevronDown, ExternalLink } from "lucide-react";
import { clsx } from "clsx";
import type { SummaryInsightCitation } from "../../types/technicalAssurance";

interface CitationCardProps {
  citation: SummaryInsightCitation;
}

function inferDocumentLabel(regId: string): string {
  const parts = regId.split("-");
  const head = parts[0]?.toUpperCase() ?? "REG";
  if (head.startsWith("ADB")) return "Approved Document B";
  if (head.startsWith("ADK")) return "Approved Document K";
  if (head === "BSA") return "Building Safety Act 2022";
  if (head === "PAS") return "PAS 2035:2023";
  if (head === "RSH") return "RSH Consumer Standards";
  if (head === "CDM") return "CDM 2015";
  return head;
}

export function CitationCard({ citation }: CitationCardProps) {
  const [open, setOpen] = useState(false);
  const documentLabel =
    citation.documentLabel ?? inferDocumentLabel(citation.regId);
  const clauseLabel = citation.clause ? `Clause ${citation.clause}` : null;

  return (
    <div
      className={clsx(
        "rounded-lg border bg-white shadow-sm transition-colors duration-150",
        open
          ? "border-indigo-300 shadow-md"
          : "border-slate-200 hover:border-indigo-300",
      )}
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="block w-full p-4 text-left focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-indigo-500 rounded-lg"
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">
              {documentLabel}
            </div>
            <div className="mt-0.5 flex items-center gap-2">
              <span className="font-mono text-[13px] font-bold text-indigo-700">
                {citation.regId}
              </span>
              {clauseLabel ? (
                <span className="rounded-md bg-indigo-50 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-700">
                  {clauseLabel}
                </span>
              ) : null}
            </div>
          </div>
          <ChevronDown
            className={clsx(
              "h-4 w-4 shrink-0 text-slate-400 transition-transform duration-200",
              open && "rotate-180 text-indigo-600",
            )}
          />
        </div>
        <div className="mt-2 text-[12px] font-medium text-slate-800">
          {citation.appliedTo}
        </div>
        {!open && citation.quote ? (
          <p className="mt-2 line-clamp-2 text-[12px] italic leading-5 text-slate-500">
            “{citation.quote}”
          </p>
        ) : null}
      </button>

      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            key="body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="overflow-hidden border-t border-indigo-100"
          >
            <div className="space-y-3 px-4 py-3">
              {citation.quote ? (
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">
                    Verbatim excerpt
                  </div>
                  <p className="mt-1 text-[12px] italic leading-5 text-slate-700">
                    “{citation.quote}”
                  </p>
                </div>
              ) : null}
              {citation.sourceUrl ? (
                <a
                  href={citation.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-300 bg-indigo-50 px-3 py-1.5 text-[12px] font-semibold text-indigo-700 transition-colors hover:bg-indigo-100"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  Open source
                </a>
              ) : (
                <p className="text-[11px] italic text-slate-400">
                  No external source URL on record for this corpus entry.
                </p>
              )}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
