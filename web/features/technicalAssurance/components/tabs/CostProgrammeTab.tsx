// Cost & programme tab.
//
// Renders the AI-generated `costProgramme` block from `tabs/summary.content`.
// 4-tile StatsCard row + line-item DynamicTable (canonical list surface,
// ) + Programme Gantt overlay. CSV export rides DynamicTable's
// built-in export chrome — no separate server endpoint required for the
// happy path. The PM-report handoff is deferred to alongside the
// actual ProjectReport integration.

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  PoundSterling,
  CalendarClock,
  Activity,
  PieChart,
  Info,
  Download,
  ExternalLink,
  CheckCircle2,
  Loader2,
} from "lucide-react";
import { clsx } from "clsx";
import toast from "react-hot-toast";

import { api } from "../../../../lib/api";
import { StatsCard } from "../../../../components/common/StatsCard";
import { ProgrammeGanttOverlay } from "../ProgrammeGanttOverlay";
import DynamicTable from "../../../../components/table/DynamicTable";
import type { ColumnDef } from "../../../../components/table/types";
import type {
  CostLine,
  CostProgrammeTabContent,
  CostRate,
  Enquiry,
} from "../../../../../shared/types/technicalAssurance";

interface CostProgrammeTabProps {
  enquiry: Enquiry;
  costProgramme: CostProgrammeTabContent;
}

function formatGBP(n: number): string {
  if (!Number.isFinite(n)) return "£0";
  // Negative values render with a leading minus; large values get
  // standard en-GB grouping.
  const abs = Math.abs(Math.round(n));
  const out = abs.toLocaleString("en-GB");
  return n < 0 ? `−£${out}` : `£${out}`;
}

function formatDays(n: number): string {
  if (!Number.isFinite(n)) return "0 days";
  const rounded = Math.round(n);
  if (rounded === 1 || rounded === -1) return `${rounded} day`;
  return `${rounded} days`;
}

// Stable row id needed for DynamicTable's key strategy. We materialise an
// `_idx` field on the row so two lines that share a description / rateId
// don't collide on `getRowId`.
type CostLineRow = CostLine & { _rowId: string };

export function CostProgrammeTab({
  enquiry,
  costProgramme,
}: CostProgrammeTabProps) {
  const [rateLookup, setRateLookup] = useState<Record<string, CostRate>>({});
  // Track whether the rates fetch has completed; until then, the per-row
  // "Library rate not found" warning would briefly flash red on every row
  // because the lookup map is empty during the fetch. Holding the warning
  // off until ratesLoaded is true eliminates that flash.
  const [ratesLoaded, setRatesLoaded] = useState(false);

  // Add to PM report. Local mirror of the enquiry's flag so the
  // button flips to "Added" without a refetch. Initialised from the prop
  // so cached deliverables show the correct state on mount.
  const [addedToReport, setAddedToReport] = useState<boolean>(
    enquiry.addedToProjectReport === true,
  );
  const [togglingReport, setTogglingReport] = useState(false);

  const handleToggleProjectReport = useCallback(async () => {
    if (togglingReport) return;
    setTogglingReport(true);
    try {
      if (addedToReport) {
        const r = await api.tacRemoveFromProjectReport(enquiry.id);
        if (!r?.success) throw new Error(r?.error ?? "Remove failed");
        setAddedToReport(false);
        toast.success("Removed from project report");
      } else {
        const r = await api.tacAddToProjectReport(enquiry.id);
        if (!r?.success) throw new Error(r?.error ?? "Add failed");
        setAddedToReport(true);
        toast.success(
          "Added to project report — open Reporting → Project Report to see the Technical Assurance section",
        );
      }
    } catch (e: any) {
      toast.error(e?.message ?? "Action failed");
    } finally {
      setTogglingReport(false);
    }
  }, [addedToReport, enquiry.id, togglingReport]);

  // Pull the cost-rates library once on mount so each line-item row can
  // resolve its `rateId` to a human-readable description on hover. Fire and
  // forget — failures are non-fatal (table still renders without tooltips).
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const r = await api.tacListCostRates();
        if (cancelled) return;
        const items: CostRate[] = Array.isArray(r?.items) ? r.items : [];
        const map: Record<string, CostRate> = {};
        for (const it of items) {
          if (it?.rateId) map[it.rateId] = it;
        }
        setRateLookup(map);
      } catch {
        // ignore — rateId tooltips are nice-to-have, not blocking
      } finally {
        if (!cancelled) setRatesLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const totalDelta = costProgramme.totalDelta ?? 0;
  const programmeBars = costProgramme.programmeBars ?? [];
  const floatRemaining = costProgramme.floatRemaining ?? 0;
  const contingencyDrawPct = costProgramme.contingencyDrawPct;

  // Materialise the cost lines into rows DynamicTable can key on stably.
  const costRows: CostLineRow[] = (costProgramme.costLines ?? []).map(
    (line, idx) => ({ ...line, _rowId: `${line.rateId ?? "indicative"}-${idx}` }),
  );

  // Column definitions for DynamicTable. Description column carries the
  // sourcing sub-row via `render`; numeric columns are right-aligned and
  // mono-font; per-cell `exportValue` strips formatting so the built-in CSV
  // export contains plain numbers, not "£3,000".
  const costColumns: ColumnDef<CostLineRow>[] = [
    {
      key: "description",
      label: "Description",
      sortable: true,
      render: (_value, row) => {
        const matched = row.rateId ? rateLookup[row.rateId] : undefined;
        let sourcing: { tone: "slate" | "muted" | "warn"; text: string };
        if (matched) {
          sourcing = {
            tone: "slate",
            text: `From library · ${matched.rateId}`,
          };
        } else if (row.rateId) {
          sourcing = ratesLoaded
            ? {
                tone: "warn",
                text: `Library rate not found · ${row.rateId}`,
              }
            : { tone: "muted", text: "Resolving rate…" };
        } else {
          sourcing = {
            tone: "muted",
            text: "Indicative · no library reference",
          };
        }
        const sourcingClass =
          sourcing.tone === "warn"
            ? "text-amber-700"
            : sourcing.tone === "slate"
              ? "text-slate-500"
              : "text-slate-400";
        return (
          <div className="py-0.5">
            <div className="font-medium text-slate-800">{row.description}</div>
            <div
              className={clsx("mt-0.5 text-[11px]", sourcingClass)}
              title={
                matched
                  ? `Rate sourced from library: ${matched.description}`
                  : undefined
              }
            >
              {sourcing.text}
            </div>
          </div>
        );
      },
    },
    {
      key: "unit",
      label: "Unit",
      sortable: true,
      width: "80px",
      align: "left",
    },
    {
      key: "quantity",
      label: "Qty",
      sortable: true,
      width: "100px",
      align: "right",
      render: (v) => (
        <span className="font-mono text-slate-800">{Number(v ?? 0)}</span>
      ),
    },
    {
      key: "rate",
      label: "Rate (£)",
      sortable: true,
      width: "120px",
      align: "right",
      render: (v) => (
        <span className="font-mono text-slate-800">{formatGBP(Number(v ?? 0))}</span>
      ),
      exportValue: (v) => String(Number(v ?? 0)),
    },
    {
      key: "total",
      label: "Total (£)",
      sortable: true,
      width: "140px",
      align: "right",
      render: (v) => (
        <span
          className={clsx(
            "font-mono font-semibold",
            Number(v) < 0 ? "text-rose-700" : "text-slate-900",
          )}
        >
          {formatGBP(Number(v ?? 0))}
        </span>
      ),
      exportValue: (v) => String(Number(v ?? 0)),
    },
    {
      key: "rateId",
      label: "Rate ID",
      sortable: true,
      hidden: true,
      // Hidden in the table view (sourcing chip already surfaces this on the
      // description sub-row) but included in the CSV export so the council
      // can audit the calculation against their own rates schedule.
    },
  ];

  // CSV download handler — same column shape as DynamicTable's built-in
  // export, but rendered inline alongside the search box rather than on
  // the secondary toolbar row. Keeps the layout dense on desktop and
  // stacks naturally on mobile via flex-wrap on the toolbar.
  const handleDownloadCsv = useCallback(() => {
    if (costRows.length === 0) return;
    const csvField = (v: unknown): string => {
      if (v === null || v === undefined) return "";
      const s = String(v);
      if (s.includes(",") || s.includes("\"") || s.includes("\n")) {
        return `"${s.replace(/"/g, '""')}"`;
      }
      return s;
    };
    const header = ["Description", "Unit", "Quantity", "Rate", "Total", "Rate ID"];
    const rows = costRows.map((r) => [
      csvField(r.description),
      csvField(r.unit),
      csvField(r.quantity),
      csvField(r.rate),
      csvField(r.total),
      csvField(r.rateId ?? ""),
    ]);
    rows.push(["", "", "", "Total", csvField(totalDelta), ""]);
    const csv =
      [header, ...rows].map((r) => r.join(",")).join("\n") + "\n";
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `enquiry-${String(enquiry.id).slice(0, 24)}-cost.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [costRows, enquiry.id, totalDelta]);

  // Programme delta = max bar end − master end (track 0). If no track-0 bar,
  // best-effort fallback to 0.
  const programmeDeltaDays = useMemo(() => {
    const masterBars = programmeBars.filter((b) => (b.track ?? 0) === 0);
    const otherBars = programmeBars.filter((b) => (b.track ?? 0) !== 0);
    if (masterBars.length === 0 || otherBars.length === 0) return 0;
    const masterEnd = masterBars
      .map((b) => new Date(b.endDate).getTime())
      .reduce((a, b) => Math.max(a, b), 0);
    const optionEnd = otherBars
      .map((b) => new Date(b.endDate).getTime())
      .reduce((a, b) => Math.max(a, b), 0);
    return Math.round((optionEnd - masterEnd) / (24 * 60 * 60 * 1000));
  }, [programmeBars]);

  return (
    <div className="space-y-6">
      {/* 4-tile metrics row*/}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          title="Total cost"
          value={formatGBP(totalDelta)}
          description="Sum of indicative line items"
          icon={PoundSterling}
          rounded="lg"
          size="sm"
          iconBgClassName="bg-indigo-50"
          iconClassName="text-indigo-600"
          valueClassName="text-slate-900"
        />
        <StatsCard
          title="Programme delta"
          value={
            programmeDeltaDays > 0
              ? `+${programmeDeltaDays} days`
              : programmeDeltaDays < 0
                ? `${Math.abs(programmeDeltaDays)} days`
                : "On track"
          }
          description={
            programmeDeltaDays > 0
              ? "Slower than master schedule"
              : programmeDeltaDays < 0
                ? "Faster than master schedule"
                : "Aligned with master schedule"
          }
          icon={CalendarClock}
          rounded="lg"
          size="sm"
          iconBgClassName={
            programmeDeltaDays > 0 ? "bg-amber-50" : "bg-emerald-50"
          }
          iconClassName={
            programmeDeltaDays > 0 ? "text-amber-600" : "text-emerald-600"
          }
        />
        <StatsCard
          title="Float remaining"
          value={formatDays(floatRemaining)}
          description="Working days of slack on critical path"
          icon={Activity}
          rounded="lg"
          size="sm"
          iconBgClassName={
            floatRemaining < 0 ? "bg-rose-50" : "bg-slate-50"
          }
          iconClassName={
            floatRemaining < 0 ? "text-rose-600" : "text-slate-600"
          }
          valueClassName={
            floatRemaining < 0 ? "text-rose-700" : "text-slate-900"
          }
        />
        <StatsCard
          title="Contingency draw"
          value={
            typeof contingencyDrawPct === "number"
              ? `${contingencyDrawPct}%`
              : "—"
          }
          description="Estimated portion of project contingency"
          icon={PieChart}
          rounded="lg"
          size="sm"
          iconBgClassName={
            (contingencyDrawPct ?? 0) > 50 ? "bg-rose-50" : "bg-slate-50"
          }
          iconClassName={
            (contingencyDrawPct ?? 0) > 50 ? "text-rose-600" : "text-slate-600"
          }
        />
      </div>

      {costProgramme.summaryNote ? (
        <div className="flex items-start gap-2 rounded-lg border border-slate-200 bg-slate-50/40 p-3 text-[12px] leading-5 text-slate-600">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
          <p>{costProgramme.summaryNote}</p>
        </div>
      ) : null}

      {/* Cost lines table — DynamicTable canonical surface.*/}
      <div>
        <div className="mb-3 flex items-end justify-between gap-3">
          <div>
            <div className="font-mono text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              Cost breakdown
            </div>
            <div className="text-sm font-bold text-slate-900">
              Indicative line items · {costRows.length} rows
            </div>
          </div>
          <div className="text-[11px] text-slate-500">
            Total ·{" "}
            <span className="font-mono text-sm font-bold text-slate-900">
              {formatGBP(totalDelta)}
            </span>
          </div>
        </div>
        <DynamicTable<CostLineRow>
          data={costRows}
          columns={costColumns}
          searchable
          searchPlaceholder="Search line items"
          searchFields={["description", "rateId" as keyof CostLineRow]}
          getRowId={(row) => row._rowId}
          emptyState={{
            title: "No cost line items",
            description:
              "The AI did not produce indicative cost lines for this enquiry. Add more context to the query and re-generate.",
            icon: PoundSterling,
          }}
          toolbarActions={
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleDownloadCsv}
                disabled={costRows.length === 0}
                className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-[13px] font-medium text-slate-700 shadow-sm transition-colors hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
              >
                <Download className="h-3.5 w-3.5" />
                CSV
              </button>
              <button
                type="button"
                onClick={handleToggleProjectReport}
                disabled={togglingReport || costRows.length === 0}
                className={clsx(
                  "inline-flex h-10 items-center gap-1.5 rounded-lg border px-3 text-[13px] font-medium shadow-sm transition-colors disabled:cursor-not-allowed disabled:opacity-60",
                  addedToReport
                    ? "border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                    : "border-indigo-300 bg-indigo-50 text-indigo-700 hover:bg-indigo-100",
                )}
              >
                {togglingReport ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : addedToReport ? (
                  <CheckCircle2 className="h-3.5 w-3.5" />
                ) : (
                  <ExternalLink className="h-3.5 w-3.5" />
                )}
                {addedToReport ? "Added to PM report" : "Add to PM report"}
              </button>
            </div>
          }
        />
      </div>

      {/* Programme Gantt overlay*/}
      <ProgrammeGanttOverlay bars={programmeBars} />

      {/* Footer caveat — honest framing spec*/}
      <div className="rounded-lg border border-slate-200 bg-slate-50/40 p-3 text-[11px] leading-5 text-slate-500">
        Rates are indicative, hand-seeded against UK social-housing benchmarks
        and the council's own cost-rates library. Cross-check against your
        published rates schedule before issuing for tender or board approval.
        AI-generated quantities are a starting point, not a replacement for a
        Quantity Surveyor's measurement.
      </div>
    </div>
  );
}
