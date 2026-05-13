// Programme Gantt overlay for the Cost & programme tab.
//
// Hand-rolled SVG, zero new deps. Pattern adapted from
// `ForwardPlanTimelineView.tsx` (.2 governance). Read-only — the
// AI generates the bars; the user does not drag them.
//
// Layout: sticky-left label column + scrollable timeline. Today vertical
// indigo line + "Today" tag at the top. Per-bar emphasis colour follows
// the InsightProgrammeBar.emphasis severity (info / warning / critical).

import { useMemo, useRef } from "react";
import { clsx } from "clsx";
import TableTooltip from "../table/TableTooltip";
import type { ProgrammeBar } from "../../types/technicalAssurance";

interface ProgrammeGanttOverlayProps {
  bars: ProgrammeBar[];
}

const DAY_MS = 24 * 60 * 60 * 1000;
const ROW_HEIGHT = 36;
const TRACK_GAP = 6;
const PX_PER_DAY = 8; // narrow window — typical TAC programmes are weeks not months
const LABEL_WIDTH = 200;

const EMPHASIS_BAR: Record<NonNullable<ProgrammeBar["emphasis"]>, string> = {
  info: "fill-indigo-500",
  warning: "fill-amber-500",
  critical: "fill-rose-500",
};
const EMPHASIS_BAR_DEFAULT = "fill-indigo-400";

export function ProgrammeGanttOverlay({ bars }: ProgrammeGanttOverlayProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const view = useMemo(() => {
    if (!bars || bars.length === 0) return null;
    const dates = bars.flatMap((b) => [b.startDate, b.endDate]).filter(Boolean);
    if (dates.length === 0) return null;
    const min = new Date(dates.reduce((a, b) => (a < b ? a : b)));
    const max = new Date(dates.reduce((a, b) => (a > b ? a : b)));
    // Pad each side by 5 days so bars don't touch the edge.
    const start = new Date(min.getTime() - 5 * DAY_MS);
    const end = new Date(max.getTime() + 5 * DAY_MS);
    const totalDays = Math.max(
      14,
      Math.ceil((end.getTime() - start.getTime()) / DAY_MS),
    );
    const widthPx = totalDays * PX_PER_DAY;
    return { start, end, totalDays, widthPx };
  }, [bars]);

  const tracks = useMemo(() => {
    if (!bars) return 0;
    return Math.max(0, ...bars.map((b) => b.track ?? 0)) + 1;
  }, [bars]);

  if (!view || bars.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50/60 p-6 text-center text-[12px] text-slate-500">
        No programme bars produced — the AI did not flag a schedule impact for
        this enquiry.
      </div>
    );
  }

  const { start, totalDays, widthPx } = view;

  const dayOffset = (d: string): number => {
    return Math.max(0, (new Date(d).getTime() - start.getTime()) / DAY_MS);
  };

  const today = new Date();
  const todayInRange =
    today.getTime() >= start.getTime() &&
    today.getTime() <= start.getTime() + totalDays * DAY_MS;
  const todayX = todayInRange ? dayOffset(today.toISOString().slice(0, 10)) * PX_PER_DAY : null;

  // Group bars by track so each renders on its own row.
  const rows: Array<{ track: number; bars: ProgrammeBar[] }> = [];
  for (let t = 0; t < tracks; t++) {
    const trackBars = bars.filter((b) => (b.track ?? 0) === t);
    if (trackBars.length === 0) continue;
    rows.push({ track: t, bars: trackBars });
  }
  const heightPx = rows.length * (ROW_HEIGHT + TRACK_GAP) + TRACK_GAP;

  // Month tick marks across the timeline header. Two real-world traps:
  //  • The 1st-of-month before the view start clamps to x=0 via dayOffset,
  //    so its label collides with the next month's label (the user reported
  //    "Jun 24" + "Jul 24" overlapping at the start). Skip ticks whose
  //    actual date is < view start.
  //  • Even valid ticks can land within ~36px of the previous one when the
  //    view spans a partial month at the start. Drop ticks too close to
  //    the previous label to keep the header readable.
  const MIN_LABEL_SPACING_PX = 44;
  const monthTicks: Array<{ x: number; label: string }> = [];
  const tickCursor = new Date(start.getFullYear(), start.getMonth(), 1);
  while (tickCursor.getTime() <= start.getTime() + totalDays * DAY_MS) {
    if (tickCursor.getTime() >= start.getTime()) {
      const x = dayOffset(tickCursor.toISOString().slice(0, 10)) * PX_PER_DAY;
      const prev = monthTicks[monthTicks.length - 1];
      if (!prev || x - prev.x >= MIN_LABEL_SPACING_PX) {
        monthTicks.push({
          x,
          label: tickCursor.toLocaleDateString("en-GB", {
            month: "short",
            year: "2-digit",
          }),
        });
      }
    }
    tickCursor.setMonth(tickCursor.getMonth() + 1);
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">
            Programme overlay
          </div>
          <div className="text-sm font-bold text-slate-900">
            Recommended option vs master schedule
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            if (todayX !== null && scrollRef.current) {
              scrollRef.current.scrollLeft = Math.max(0, todayX - 200);
            }
          }}
          disabled={todayX === null}
          className="rounded-md border border-slate-300 px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:border-indigo-400 hover:text-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Jump to today
        </button>
      </div>
      <div className="flex">
        {/* Sticky label column*/}
        <div
          className="shrink-0 border-r border-slate-200 bg-slate-50/40"
          style={{ width: LABEL_WIDTH }}
        >
          <div className="h-9 border-b border-slate-200" />
          {rows.map((r) => {
            const sample = r.bars[0];
            const fullLabel =
              r.track === 0 ? "Master schedule" : sample.label;
            return (
              <div
                key={r.track}
                className="flex items-center border-b border-slate-100 px-3 text-[12px]"
                style={{ height: ROW_HEIGHT + TRACK_GAP }}
              >
                <TableTooltip content={fullLabel}>
                  <span
                    tabIndex={0}
                    className="truncate font-semibold text-slate-700 outline-hidden focus-visible:ring-2 focus-visible:ring-indigo-500 rounded-sm"
                  >
                    {fullLabel}
                  </span>
                </TableTooltip>
              </div>
            );
          })}
        </div>
        {/* Scrollable timeline*/}
        <div ref={scrollRef} className="relative flex-1 overflow-x-auto">
          <svg
            width={widthPx}
            height={heightPx + 36}
            className="block"
            role="img"
            aria-label="Programme Gantt overlay"
          >
            {/* Month-tick header strip*/}
            <g>
              <rect x={0} y={0} width={widthPx} height={36} fill="#f8fafc" />
              {monthTicks.map((t, idx) => (
                <g key={idx}>
                  <line
                    x1={t.x}
                    y1={0}
                    x2={t.x}
                    y2={heightPx + 36}
                    stroke="#e2e8f0"
                    strokeWidth={1}
                  />
                  <text
                    x={t.x + 4}
                    y={22}
                    fontSize={10}
                    fontWeight={600}
                    fill="#475569"
                  >
                    {t.label}
                  </text>
                </g>
              ))}
            </g>

            {/* Bars*/}
            {rows.map((r, rowIdx) => {
              const yBase = 36 + rowIdx * (ROW_HEIGHT + TRACK_GAP) + TRACK_GAP / 2;
              return r.bars.map((b, barIdx) => {
                const x = dayOffset(b.startDate) * PX_PER_DAY;
                const x2 = dayOffset(b.endDate) * PX_PER_DAY;
                const w = Math.max(8, x2 - x);
                const fillCls = b.emphasis
                  ? EMPHASIS_BAR[b.emphasis]
                  : EMPHASIS_BAR_DEFAULT;
                // Approx character budget = bar width / ~6.5px per char.
                // Below this, we truncate with ellipsis. The native SVG
                // <title> on both rect AND text gives a hover tooltip that
                // surfaces the FULL label + date range regardless of width.
                const maxChars = Math.max(0, Math.floor((w - 12) / 6.5));
                const visibleLabel =
                  b.label.length > maxChars && maxChars > 4
                    ? `${b.label.slice(0, maxChars - 1)}…`
                    : maxChars <= 4
                      ? ""
                      : b.label;
                const tooltip = `${b.label} · ${b.startDate} → ${b.endDate}`;
                return (
                  <g key={`${r.track}-${barIdx}`}>
                    <rect
                      x={x}
                      y={yBase}
                      width={w}
                      height={ROW_HEIGHT}
                      rx={4}
                      ry={4}
                      className={clsx(fillCls, "opacity-90")}
                    >
                      <title>{tooltip}</title>
                    </rect>
                    {visibleLabel ? (
                      <text
                        x={x + 6}
                        y={yBase + ROW_HEIGHT / 2 + 4}
                        fontSize={11}
                        fontWeight={600}
                        fill="#ffffff"
                        style={{ pointerEvents: "none" }}
                      >
                        {visibleLabel}
                        <title>{tooltip}</title>
                      </text>
                    ) : null}
                  </g>
                );
              });
            })}

            {/* Today line*/}
            {todayX !== null && (
              <g>
                <line
                  x1={todayX}
                  y1={0}
                  x2={todayX}
                  y2={heightPx + 36}
                  stroke="#4f46e5"
                  strokeWidth={2}
                  strokeDasharray="4 3"
                />
                <rect
                  x={todayX - 22}
                  y={2}
                  width={44}
                  height={16}
                  rx={4}
                  fill="#4f46e5"
                />
                <text
                  x={todayX}
                  y={14}
                  fontSize={10}
                  fontWeight={700}
                  fill="#ffffff"
                  textAnchor="middle"
                >
                  Today
                </text>
              </g>
            )}
          </svg>
        </div>
      </div>
    </div>
  );
}
