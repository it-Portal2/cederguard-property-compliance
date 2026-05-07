import { BookOpen, ListChecks, ArrowRight } from "lucide-react";
import { clsx } from "clsx";
import type {
  EnquiryDeliverable,
  SummaryTabContent,
} from "../../../types/technicalAssurance";
import { RankedOptionCard } from "../RankedOptionCard";
import { ComplianceSnapshot } from "../ComplianceSnapshot";
import type { TacWorkspaceTabId } from "./TabStrip";

// Phase 3 — Summary tab. Renders the AI-produced summary deliverable
// (`tabs/summary` doc) + an action bar that jumps the user into the deeper
// tabs (Drawing / RFI / Cost / Compliance) once those phases ship.
//
// Composition: lede card → ComplianceSnapshot grid → ranked options list
// (RankedOptionCard each) → cited regulations card → next-actions list →
// sticky action bar at the bottom.

interface SummaryTabProps {
  content: SummaryTabContent;
  deliverable: EnquiryDeliverable<SummaryTabContent>;
  onNavigateTab: (tab: TacWorkspaceTabId) => void;
}

interface TabAction {
  tab: TacWorkspaceTabId;
  label: string;
  hint: string;
}

const TAB_ACTIONS: TabAction[] = [
  {
    tab: "drawing",
    label: "View annotated drawing",
    hint: "Red-line overlay on your uploaded drawing.",
  },
  {
    tab: "rfi",
    label: "Open RFI draft",
    hint: "Auto-populated request for information ready to issue.",
  },
  {
    tab: "costProgramme",
    label: "Cost & programme impact",
    hint: "Line-item cost table + Gantt overlay.",
  },
  {
    tab: "compliance",
    label: "Compliance & citations",
    hint: "Full citation pack ready for the Golden Thread.",
  },
];

export function SummaryTab({
  content,
  deliverable,
  onNavigateTab,
}: SummaryTabProps) {
  const generatedAt = deliverable?.generatedAt
    ? new Date(deliverable.generatedAt).toLocaleString("en-GB")
    : "—";

  return (
    <div className="space-y-4">
      {/* Lede */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">
          Summary
        </p>
        <p className="mt-1 text-base font-semibold leading-relaxed text-slate-900">
          {content.lede}
        </p>
        <p className="mt-3 text-[11px] text-slate-400">
          Generated {generatedAt} · Augments professional judgement, does not
          replace it.
        </p>
      </div>

      {/* Compliance snapshot — visual tile grid */}
      <ComplianceSnapshot checks={content.complianceSnapshot} />

      {/* Ranked options */}
      {content.options.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">
              Ranked options
            </p>
            <p className="text-[11px] text-slate-400">
              {content.options.length} option
              {content.options.length === 1 ? "" : "s"}
            </p>
          </div>
          <ol className="mt-3 space-y-3">
            {content.options.map((opt, idx) => (
              <RankedOptionCard key={opt.id} option={opt} index={idx} />
            ))}
          </ol>
        </div>
      )}

      {/* Citations */}
      {content.citations.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-indigo-600" />
            <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">
              Cited regulations
            </p>
          </div>
          <ul className="mt-3 space-y-3">
            {content.citations.map((c, idx) => (
              <li
                key={`${c.regId}-${idx}`}
                className="rounded-lg border border-slate-200 bg-slate-50/60 p-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-[11px] font-bold text-indigo-700">
                    {c.regId}
                  </span>
                  <span className="text-[11px] text-slate-400">
                    Applied to: {c.appliedTo || "—"}
                  </span>
                </div>
                <p className="mt-1 text-[12px] italic leading-relaxed text-slate-600">
                  &ldquo;{c.quote}&rdquo;
                </p>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Next actions */}
      {content.nextActions.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <ListChecks className="h-4 w-4 text-indigo-600" />
            <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">
              Next actions
            </p>
          </div>
          <ul className="mt-2 space-y-1.5">
            {content.nextActions.map((a, idx) => (
              <li
                key={idx}
                className="flex items-start gap-2 text-sm text-slate-700"
              >
                <span className="mt-1.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-500" />
                <span>{a}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Action bar — jumps the user into the deliverable tabs that land in
          Phases 4-7. Buttons are always rendered so the workspace's
          information architecture is consistent; clicks switch tabs even if
          the destination is still placeholder. */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">
          Continue with
        </p>
        <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
          {TAB_ACTIONS.map((a) => (
            <button
              key={a.tab}
              type="button"
              onClick={() => onNavigateTab(a.tab)}
              className={clsx(
                "group flex items-start gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3 text-left transition-colors",
                "hover:border-indigo-300 hover:bg-indigo-50/40",
              )}
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-slate-900 group-hover:text-indigo-700">
                  {a.label}
                </p>
                <p className="mt-0.5 text-[11px] leading-snug text-slate-500">
                  {a.hint}
                </p>
              </div>
              <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-slate-400 transition-transform group-hover:translate-x-0.5 group-hover:text-indigo-600" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
