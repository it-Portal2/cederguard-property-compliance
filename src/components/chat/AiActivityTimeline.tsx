// Animated, hierarchical "what the AI is doing" card.
// Replaces the old flat ToolIndicatorPill row.
//
// Behaviours:
//   - Auto-expanded while streaming; auto-collapses ~500 ms after the
//     final `done` event. Click header to expand/collapse manually;
//     clicking during streaming pins it open.
//   - One row per tool call (server-supplied callId). Same tool invoked
//     multiple times shows multiple rows, not one flickering one.
//   - Click a done row to reveal full args JSON + duration.
//   - Status icons swap with a springy scale+rotate via AnimatePresence.
//   - All motion variants gated by prefers-reduced-motion.

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  motion,
  AnimatePresence,
  LayoutGroup,
  type Variants,
  type Transition,
} from "motion/react";
import {
  Circle,
  CircleDotDashed,
  CircleAlert,
  CheckCircle2,
  ChevronDown,
} from "lucide-react";
import { clsx } from "clsx";
import type { AiActivityStep } from "../../hooks/useChatStream";

interface AiActivityTimelineProps {
  steps: AiActivityStep[];
  isStreaming: boolean;
  defaultExpanded?: boolean;
}

const APPLE_EASE = [0.2, 0.65, 0.3, 0.9] as const;
const COLLAPSE_DELAY_MS = 500;

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  });
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
    const handler = (e: MediaQueryListEvent) => setReduced(e.matches);
    mql.addEventListener?.("change", handler);
    return () => mql.removeEventListener?.("change", handler);
  }, []);
  return reduced;
}

function useElapsedSeconds(active: boolean, sinceMs: number): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const id = window.setInterval(() => setNow(Date.now()), 100);
    return () => window.clearInterval(id);
  }, [active]);
  return Math.max(0, Math.round((now - sinceMs) / 100) / 10);
}

function formatSeconds(s: number): string {
  if (s < 60) return `${s.toFixed(1)}s`;
  const m = Math.floor(s / 60);
  const r = Math.round(s - m * 60);
  return `${m}m ${r}s`;
}

// ── Status icon ────────────────────────────────────────────────────────────

interface StatusIconProps {
  status: AiActivityStep["status"];
  reduced: boolean;
  size?: "sm" | "md";
}

function StatusIcon({ status, reduced, size = "md" }: StatusIconProps) {
  const dim = size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4";
  const swapTransition: Transition = reduced
    ? { duration: 0.12, ease: "easeOut" }
    : { duration: 0.2, ease: APPLE_EASE };
  const initial = reduced
    ? { opacity: 0 }
    : { opacity: 0, scale: 0.8, rotate: -10 };
  const animate = reduced
    ? { opacity: 1 }
    : { opacity: 1, scale: 1, rotate: 0 };
  const exit = reduced
    ? { opacity: 0 }
    : { opacity: 0, scale: 0.8, rotate: 10 };

  return (
    <AnimatePresence mode="wait">
      <motion.span
        key={status}
        className="inline-flex flex-shrink-0"
        initial={initial}
        animate={animate}
        exit={exit}
        transition={swapTransition}
        aria-hidden
      >
        {status === "done" && (
          <CheckCircle2 className={clsx(dim, "text-emerald-500")} />
        )}
        {status === "failed" && (
          <CircleAlert className={clsx(dim, "text-rose-500")} />
        )}
        {status === "running" && (
          <CircleDotDashed
            className={clsx(
              dim,
              "text-indigo-500",
              reduced ? "" : "animate-spin",
            )}
          />
        )}
        {status === "pending" && (
          <Circle className={clsx(dim, "text-slate-400")} />
        )}
      </motion.span>
    </AnimatePresence>
  );
}

// ── Per-step row ───────────────────────────────────────────────────────────

interface StepRowProps {
  step: AiActivityStep;
  reduced: boolean;
  index: number;
}

function StepRow({ step, reduced, index }: StepRowProps) {
  const duration =
    step.finishedAt != null
      ? `${((step.finishedAt - step.startedAt) / 1000).toFixed(1)}s`
      : null;

  const rowVariants: Variants = reduced
    ? {
        hidden: { opacity: 0 },
        visible: { opacity: 1, transition: { duration: 0.15 } },
      }
    : {
        hidden: { opacity: 0, x: -8 },
        visible: {
          opacity: 1,
          x: 0,
          transition: {
            type: "spring",
            stiffness: 500,
            damping: 30,
            delay: index * 0.04,
          },
        },
      };

  const statusText =
    step.status === "done"
      ? typeof step.resultCount === "number"
        ? `${step.resultCount} found`
        : "done"
      : step.status === "failed"
        ? "failed"
        : step.status === "running"
          ? "…"
          : "";

  return (
    <motion.li
      role="listitem"
      className="group"
      variants={rowVariants}
      initial="hidden"
      animate="visible"
      layout={!reduced}
    >
      <div className="flex items-center gap-2.5 py-1.5 min-h-8">
        <span className="shrink-0 inline-flex items-center justify-center w-4">
          <StatusIcon status={step.status} reduced={reduced} size="sm" />
        </span>
        <div className="flex-1 min-w-0">
          <div
            className={clsx(
              "text-[13px] font-medium truncate leading-tight",
              step.status === "failed"
                ? "text-rose-700 dark:text-rose-300"
                : "text-slate-700 dark:text-slate-200",
            )}
          >
            {step.displayLabel}
          </div>
          {step.error && (
            <div className="text-[11px] text-rose-600 dark:text-rose-400 mt-0.5 truncate">
              {step.error}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0 ml-2 text-[11px] tabular-nums leading-none">
          {statusText && (
            <span
              className={clsx(
                "font-medium",
                step.status === "done"
                  ? "text-emerald-600 dark:text-emerald-400"
                  : step.status === "failed"
                    ? "text-rose-600 dark:text-rose-400"
                    : "text-slate-400",
              )}
            >
              {statusText}
            </span>
          )}
          {duration && step.status === "done" && (
            <>
              <span className="text-slate-300 dark:text-slate-600" aria-hidden>·</span>
              <span className="text-slate-400 dark:text-slate-500">{duration}</span>
            </>
          )}
        </div>
      </div>
    </motion.li>
  );
}

// ── Header summary ─────────────────────────────────────────────────────────

interface TimelineSummary {
  total: number;
  doneCount: number;
  failedCount: number;
  runningCount: number;
  totalResults: number;
  earliestStart: number;
  latestFinish: number | null;
}

function buildSummary(steps: AiActivityStep[]): TimelineSummary {
  let doneCount = 0;
  let failedCount = 0;
  let runningCount = 0;
  let totalResults = 0;
  let earliestStart = Number.POSITIVE_INFINITY;
  let latestFinish: number | null = null;

  for (const s of steps) {
    if (s.status === "done") doneCount++;
    else if (s.status === "failed") failedCount++;
    else if (s.status === "running" || s.status === "pending") runningCount++;
    if (typeof s.resultCount === "number") totalResults += s.resultCount;
    if (s.startedAt < earliestStart) earliestStart = s.startedAt;
    if (s.finishedAt != null) {
      latestFinish = latestFinish == null ? s.finishedAt : Math.max(latestFinish, s.finishedAt);
    }
  }
  return {
    total: steps.length,
    doneCount,
    failedCount,
    runningCount,
    totalResults,
    earliestStart: earliestStart === Number.POSITIVE_INFINITY ? Date.now() : earliestStart,
    latestFinish,
  };
}

// ── Main component ─────────────────────────────────────────────────────────

export function AiActivityTimeline({
  steps,
  isStreaming,
  defaultExpanded,
}: AiActivityTimelineProps) {
  const reduced = usePrefersReducedMotion();
  const summary = useMemo(() => buildSummary(steps), [steps]);

  // Auto-collapse 500 ms after streaming ends, unless user pinned open.
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    if (defaultExpanded === true) return false;
    return !isStreaming;
  });
  const userPinnedRef = useRef(false);
  const prevStreamingRef = useRef(isStreaming);

  useEffect(() => {
    if (isStreaming && !userPinnedRef.current) {
      setCollapsed(false);
    }
    if (prevStreamingRef.current && !isStreaming && !userPinnedRef.current) {
      const t = window.setTimeout(() => setCollapsed(true), COLLAPSE_DELAY_MS);
      return () => window.clearTimeout(t);
    }
    prevStreamingRef.current = isStreaming;
  }, [isStreaming]);

  const handleToggle = () => {
    userPinnedRef.current = true;
    setCollapsed((v) => !v);
  };

  const elapsed = useElapsedSeconds(isStreaming, summary.earliestStart);
  const finalSeconds =
    summary.latestFinish != null
      ? (summary.latestFinish - summary.earliestStart) / 1000
      : elapsed;

  if (steps.length === 0) return null;

  const headerText = isStreaming
    ? `Activity · Step ${Math.max(1, summary.doneCount + summary.failedCount + 1)} of ${summary.total} · ${formatSeconds(elapsed)}`
    : summary.failedCount > 0
      ? `${summary.failedCount} step${summary.failedCount > 1 ? "s" : ""} failed · click to inspect`
      : `Looked up ${summary.total} ${summary.total === 1 ? "source" : "sources"} · ${summary.totalResults} record${summary.totalResults === 1 ? "" : "s"} · ${formatSeconds(finalSeconds)}`;

  const headerHasError = !isStreaming && summary.failedCount > 0;

  const cardVariants: Variants = reduced
    ? { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { duration: 0.18 } } }
    : {
        hidden: { opacity: 0, y: 6 },
        visible: {
          opacity: 1,
          y: 0,
          transition: { duration: 0.25, ease: APPLE_EASE },
        },
      };

  const listId = `ai-activity-${summary.earliestStart}`;

  return (
    <motion.section
      className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-sm overflow-hidden"
      variants={cardVariants}
      initial="hidden"
      animate="visible"
      aria-label="AI activity timeline"
    >
      <button
        type="button"
        onClick={handleToggle}
        aria-expanded={!collapsed}
        aria-controls={listId}
        className={clsx(
          "w-full flex items-center gap-2 px-3 py-2 text-left",
          "hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors min-h-[40px]",
        )}
      >
        <StatusIcon
          status={
            isStreaming
              ? "running"
              : summary.failedCount > 0
                ? "failed"
                : "done"
          }
          reduced={reduced}
        />
        <span
          className={clsx(
            "flex-1 text-[12px] font-medium truncate",
            headerHasError
              ? "text-rose-700 dark:text-rose-300"
              : "text-slate-700 dark:text-slate-200",
          )}
        >
          {headerText}
        </span>
        <ChevronDown
          className={clsx(
            "h-4 w-4 text-slate-400 transition-transform duration-200 flex-shrink-0",
            !collapsed && "rotate-180",
          )}
          aria-hidden
        />
      </button>

      <AnimatePresence initial={false}>
        {!collapsed && (
          <motion.div
            id={listId}
            className="overflow-hidden border-t border-slate-100 dark:border-slate-800"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: APPLE_EASE }}
          >
            <LayoutGroup>
              <ol
                role="list"
                className="space-y-0 py-1 px-3 divide-y divide-slate-100 dark:divide-slate-800"
              >
                {steps.map((step, idx) => (
                  <StepRow
                    key={step.id}
                    step={step}
                    reduced={reduced}
                    index={idx}
                  />
                ))}
              </ol>
            </LayoutGroup>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.section>
  );
}

export default AiActivityTimeline;
