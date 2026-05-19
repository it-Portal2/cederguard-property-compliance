// Compliance & citations tab.
//
// Layout: two checklists (dimensional + system) rendered side-by-side on
// desktop, stacked on mobile. Each tile is a check + status pill +
// optional regId linkback + optional 1-line evidence snippet. Rose
// soft-flag banner appears above when any check is `warn` or `fail`.
// Below the checklists: citation cards grid (one per cited regulation).
// Footer: two action buttons — Download compliance pack PDF + Save to
// Golden Thread (HRB-only, server-guarded).

import { useMemo, useState } from "react";
import { motion } from "motion/react";
import {
  ShieldCheck,
  Ruler,
  Settings,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Download,
  Lock,
  Loader2,
  Info,
} from "lucide-react";
import { clsx } from "clsx";
import toast from "react-hot-toast";

import { api } from "../../../lib/api";
import { CitationCard } from "../CitationCard";
import type {
  ComplianceCheck,
  ComplianceCheckCategory,
  Enquiry,
  SummaryTabContent,
} from "../../../types/technicalAssurance";

interface ComplianceTabProps {
  enquiry: Enquiry;
  summary: SummaryTabContent;
  /** Whether the active project is HRB-flagged. Drives the Save-to-Golden-
   *  Thread button visibility (server still gates independently).*/
  isHRB?: boolean;
}

const STATUS_STYLE: Record<
  ComplianceCheck["status"],
  {
    pill: string;
    icon: typeof CheckCircle2;
    label: string;
    accent: string;
  }
> = {
  pass: {
    pill: "bg-emerald-50 text-emerald-700 border-emerald-200",
    icon: CheckCircle2,
    label: "Pass",
    accent: "text-emerald-600",
  },
  warn: {
    pill: "bg-amber-50 text-amber-800 border-amber-200",
    icon: AlertTriangle,
    label: "Warn",
    accent: "text-amber-600",
  },
  fail: {
    pill: "bg-rose-50 text-rose-700 border-rose-200",
    icon: XCircle,
    label: "Fail",
    accent: "text-rose-600",
  },
};

function categoriseCheck(c: ComplianceCheck): ComplianceCheckCategory {
  if (c.category === "dimensional" || c.category === "system") {
    return c.category;
  }
  // Heuristic fallback when the AI returns an uncategorised check —
  // dimension-y keywords route to "dimensional", everything else to system.
  const blob = `${c.check} ${c.evidence ?? ""}`.toLowerCase();
  if (
    /\b(mm|metre|m\b|m2|m\^2|width|height|tread|rise|clearance|span|fall|gradient|lux|db|kn|head\b)/.test(
      blob,
    )
  ) {
    return "dimensional";
  }
  return "system";
}

function CheckTile({ check }: { check: ComplianceCheck }) {
  const style = STATUS_STYLE[check.status];
  const Icon = style.icon;
  return (
    <motion.li
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.15 }}
      className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2 min-w-0">
          <Icon
            className={clsx("h-4 w-4 mt-0.5 shrink-0", style.accent)}
            aria-hidden
          />
          <div className="min-w-0">
            <div className="text-[13px] font-semibold text-slate-800">
              {check.check}
            </div>
            {check.evidence ? (
              <div className="mt-0.5 text-[11px] leading-5 text-slate-500">
                {check.evidence}
              </div>
            ) : null}
          </div>
        </div>
        <span
          className={clsx(
            "shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider",
            style.pill,
          )}
        >
          {style.label}
        </span>
      </div>
      {check.regId ? (
        <div className="mt-2 inline-flex items-center gap-1 rounded-md bg-indigo-50 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-indigo-700">
          {check.regId}
        </div>
      ) : null}
    </motion.li>
  );
}

export function ComplianceTab({
  enquiry,
  summary,
  isHRB,
}: ComplianceTabProps) {
  const [downloading, setDownloading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  const { dimensional, system, hasSoftFlag, failCount, warnCount } =
    useMemo(() => {
      const dim: ComplianceCheck[] = [];
      const sys: ComplianceCheck[] = [];
      let f = 0;
      let w = 0;
      for (const c of summary.complianceSnapshot ?? []) {
        if (categoriseCheck(c) === "dimensional") dim.push(c);
        else sys.push(c);
        if (c.status === "fail") f++;
        else if (c.status === "warn") w++;
      }
      return {
        dimensional: dim,
        system: sys,
        hasSoftFlag: f > 0 || w > 0,
        failCount: f,
        warnCount: w,
      };
    }, [summary.complianceSnapshot]);

  const citations = summary.citations ?? [];

  const handleDownload = async () => {
    if (downloading) return;
    setDownloading(true);
    try {
      const r = await api.tacDownloadCompliancePack(enquiry.id);
      if (!r?.pdfBase64 || !r?.filename) {
        throw new Error("Empty compliance pack response");
      }
      const byteChars = atob(r.pdfBase64);
      const byteNums = new Array(byteChars.length);
      for (let i = 0; i < byteChars.length; i++) {
        byteNums[i] = byteChars.charCodeAt(i);
      }
      const blob = new Blob([new Uint8Array(byteNums)], {
        type: "application/pdf",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = String(r.filename);
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success("Compliance pack downloaded");
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to download compliance pack");
    } finally {
      setDownloading(false);
    }
  };

  const handleSaveToGoldenThread = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const r = await api.tacSaveToGoldenThread(enquiry.id);
      if (!r?.success) {
        throw new Error(r?.error ?? "Save failed");
      }
      setSavedAt(new Date().toISOString());
      toast.success(
        `Saved to Golden Thread · v${r.version}${r.previousId ? " (chained)" : ""}`,
      );
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to save to Golden Thread");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Soft-flag banner*/}
      {hasSoftFlag ? (
        <div
          className={clsx(
            "rounded-lg border p-4",
            failCount > 0
              ? "border-rose-200 bg-rose-50/60"
              : "border-amber-200 bg-amber-50/60",
          )}
          role="status"
        >
          <div className="flex items-start gap-2">
            <AlertTriangle
              className={clsx(
                "mt-0.5 h-4 w-4 shrink-0",
                failCount > 0 ? "text-rose-600" : "text-amber-600",
              )}
            />
            <div className="text-[12px] leading-5 text-slate-700">
              <span className="font-semibold">
                {failCount > 0
                  ? `${failCount} check${failCount > 1 ? "s" : ""} failing`
                  : `${warnCount} check${warnCount > 1 ? "s" : ""} flagged for attention`}
                {warnCount > 0 && failCount > 0
                  ? ` · ${warnCount} warning${warnCount > 1 ? "s" : ""}`
                  : ""}
                .
              </span>{" "}
              Chartered review recommended before issuing for tender or board
              approval. Insights augment professional judgement; they do not
              replace it.
            </div>
          </div>
        </div>
      ) : null}

      {/* Two-column checklist (dimensional + system)*/}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <section
          aria-labelledby="dim-checks-title"
          className="rounded-lg border border-slate-200 bg-slate-50/40 p-4"
        >
          <header className="mb-3 flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
              <Ruler className="h-4 w-4" />
            </div>
            <div>
              <h2
                id="dim-checks-title"
                className="text-sm font-bold text-slate-900"
              >
                Dimensional checks
              </h2>
              <div className="text-[11px] text-slate-500">
                {dimensional.length} item{dimensional.length === 1 ? "" : "s"}
              </div>
            </div>
          </header>
          {dimensional.length === 0 ? (
            <p className="rounded-lg border border-dashed border-slate-300 bg-white p-3 text-[12px] text-slate-500">
              No dimensional checks were produced for this enquiry.
            </p>
          ) : (
            <ul className="space-y-2">
              {dimensional.map((c, i) => (
                <CheckTile key={`dim-${i}`} check={c} />
              ))}
            </ul>
          )}
        </section>

        <section
          aria-labelledby="sys-checks-title"
          className="rounded-lg border border-slate-200 bg-slate-50/40 p-4"
        >
          <header className="mb-3 flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
              <Settings className="h-4 w-4" />
            </div>
            <div>
              <h2
                id="sys-checks-title"
                className="text-sm font-bold text-slate-900"
              >
                System checks
              </h2>
              <div className="text-[11px] text-slate-500">
                {system.length} item{system.length === 1 ? "" : "s"}
              </div>
            </div>
          </header>
          {system.length === 0 ? (
            <p className="rounded-lg border border-dashed border-slate-300 bg-white p-3 text-[12px] text-slate-500">
              No system checks were produced for this enquiry.
            </p>
          ) : (
            <ul className="space-y-2">
              {system.map((c, i) => (
                <CheckTile key={`sys-${i}`} check={c} />
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* Citation cards*/}
      <section aria-labelledby="citations-title">
        <header className="mb-3 flex items-center justify-between">
          <div>
            <h2
              id="citations-title"
              className="text-sm font-bold text-slate-900"
            >
              Cited regulations
            </h2>
            <p className="text-[11px] text-slate-500">
              {citations.length} citation
              {citations.length === 1 ? "" : "s"} — every regId resolves in the
              corpus
            </p>
          </div>
        </header>
        {citations.length === 0 ? (
          <p className="rounded-lg border border-dashed border-slate-300 bg-white p-4 text-center text-[12px] text-slate-500">
            No citations on this insight. Re-generate with more context if you
            expected one.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
            {citations.map((c) => (
              <CitationCard key={c.regId} citation={c} />
            ))}
          </div>
        )}
      </section>

      {/* Action footer*/}
      <div className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-2">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-indigo-600" />
          <div className="text-[12px] leading-5 text-slate-600">
            <div className="font-semibold text-slate-800">
              Compliance pack
            </div>
            <p>
              Download a PDF combining citations, dimensional + system checks,
              and the recommended option summary. Suitable for board pack
              attachment.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleDownload}
            disabled={downloading}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-[12px] font-semibold text-slate-700 shadow-sm hover:border-indigo-400 hover:text-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {downloading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Download className="h-3.5 w-3.5" />
            )}
            Download PDF
          </button>
          {isHRB ? (
            <button
              type="button"
              onClick={handleSaveToGoldenThread}
              disabled={saving}
              className={clsx(
                "inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-[12px] font-semibold shadow-sm disabled:cursor-not-allowed disabled:opacity-60",
                savedAt
                  ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                  : "border-indigo-300 bg-indigo-50 text-indigo-700 hover:bg-indigo-100",
              )}
            >
              {saving ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Lock className="h-3.5 w-3.5" />
              )}
              {savedAt ? "Saved to Golden Thread" : "Save to Golden Thread"}
            </button>
          ) : null}
        </div>
      </div>

      {/* Honest framing footer*/}
      <div className="flex items-start gap-2 rounded-lg border border-slate-200 bg-slate-50/40 p-3 text-[11px] leading-5 text-slate-500">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
        <p>
          Compliance checks are AI-generated against the live regulations
          corpus. Augments professional judgement, does not replace it. For
          HRB projects, save to Golden Thread to capture this insight as part
          of the BSA Gateway 2 / 3 audit chain.
        </p>
      </div>
    </div>
  );
}
