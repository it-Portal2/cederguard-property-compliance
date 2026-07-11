// Governance Dashboard.
//
// Single page, role-aware render — server returns PgM payload for
// Client Admin / Super Admin and PM payload for pure PMs. Briefing
// is data-driven for v1; swaps the body for
// Gemini without changing the UI.
//
// All metric tiles use the shared `StatsCard` (lesson §23 quality bar).

import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router';
import { motion } from 'motion/react';
import {
  Lightbulb,
  Inbox,
  CalendarDays,
  CheckCircle2,
  AlertTriangle,
  ClipboardList,
  FileText,
  RefreshCw,
  Loader2,
  ArrowRight,
  BellRing,
} from 'lucide-react';
import { clsx } from 'clsx';
import toast from 'react-hot-toast';
import { api } from '../../../lib/api';
import PageHeader from '../../../components/PageHeader';
import RunAgentButton from '../../agents/components/RunAgentButton';
import { StatsCard } from '../../../components/common/StatsCard';
import type {
  DashboardPayload,
  PgmDashboardPayload,
  PmDashboardPayload,
} from '../components/dashboard/types';
import { useHistoricalView } from '../../../hooks/useHistoricalView';
import { MonthPicker } from '../../../components/historicalReporting/MonthPicker';
import { HistoricalBanner } from '../../../components/historicalReporting/HistoricalBanner';

function formatGbDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return '—';
  }
}

const INBOX_KIND_META: Record<
  string,
  { label: string; pill: string; dot: string }
> = {
  'awaiting-review': {
    label: 'Awaiting PgM review',
    pill: 'bg-amber-100 text-amber-800 ring-1 ring-inset ring-amber-200',
    dot: 'bg-amber-500',
  },
  'awaiting-senior-pm': {
    label: 'Awaiting Senior PM',
    pill: 'bg-sky-100 text-sky-800 ring-1 ring-inset ring-sky-200',
    dot: 'bg-sky-500',
  },
  'amendments-resolved': {
    label: 'Amendments resolved',
    pill: 'bg-emerald-100 text-emerald-800 ring-1 ring-inset ring-emerald-200',
    dot: 'bg-emerald-500',
  },
  'fp-pending': {
    label: 'FP request',
    pill: 'bg-rose-100 text-rose-800 ring-1 ring-inset ring-rose-200',
    dot: 'bg-rose-500',
  },
};

export function GovernanceDashboardPage() {
  //  picker + asOfMonth wiring. The dashboard endpoint
  // accepts `asOfMonth`; we feed it from the picker. `reports` is the
  // source for available months.
  const historicalView = useHistoricalView<any>({ collection: 'reports' });
  const isHistorical = historicalView.isHistorical;
  const asOfMonth = historicalView.monthEnd;

  const [payload, setPayload] = useState<DashboardPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const refresh = useCallback(
    async (silent = false) => {
      if (silent) setRefreshing(true);
      else setLoading(true);
      try {
        const res = await api.governanceGetDashboard(
          asOfMonth ? { asOfMonth } : {},
        );
        if (!res?.success) throw new Error(res?.error ?? 'Failed to load dashboard.');
        setPayload(res as DashboardPayload);
      } catch (e: any) {
        toast.error(e?.message ?? 'Failed to load dashboard.');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [asOfMonth],
  );

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className="space-y-6"
    >
      <PageHeader
        title="Dashboard"
        subtitle={
          payload?.role === 'pm'
            ? 'Your reports, deadlines, and feedback from the Programme Manager.'
            : 'Your queue, the workspace pipeline, and what is on the next board.'
        }
        breadcrumbs={[{ label: 'Programme Governance' }, { label: 'Dashboard' }]}
        actions={
          <div className="inline-flex items-center gap-2">
            <RunAgentButton agentKey="governance" label="Run Governance agent" />
            {/* month picker drives `asOfMonth` on the dashboard aggregator.*/}
            <MonthPicker
              monthEnd={historicalView.monthEnd}
              availableMonths={historicalView.availableMonths}
              onChange={historicalView.setMonthEnd}
              loading={historicalView.loading}
            />
            <button
              type="button"
              onClick={() => refresh(true)}
              disabled={loading || refreshing}
              className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50 disabled:opacity-50"
            >
              {refreshing ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5" />
              )}
              Refresh
            </button>
          </div>
        }
      />

      {isHistorical && historicalView.monthEnd && (
        <HistoricalBanner
          monthEnd={historicalView.monthEnd}
          meta={historicalView.meta}
          onExit={() => historicalView.setMonthEnd(null)}
          activatedYearMonth={historicalView.activatedYearMonth}
          surfaceLabel="dashboard"
        />
      )}

      {(loading && !payload) || historicalView.loading ? (
        <DashboardSkeleton />
      ) : payload?.role === 'pm' ? (
        <PmDashboard payload={payload} />
      ) : payload?.role === 'pgm' ? (
        <PgmDashboard payload={payload} />
      ) : null}
    </motion.div>
  );
}

// ── Briefing card ──────────────────────────────────────────────────────

function BriefingCard({
  lines,
  source,
}: {
  lines: string[];
  source: string;
}) {
  return (
    <section className="rounded-lg border border-indigo-200 bg-linear-to-br from-indigo-50 via-white to-white p-5 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-600 text-white shadow-sm">
          <Lightbulb className="h-4.5 w-4.5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-mono text-[11px] font-semibold uppercase tracking-wide text-indigo-600">
            Morning briefing
          </p>
          <div className="mt-1 space-y-1 text-sm leading-relaxed text-slate-800">
            {lines.map((l, i) => (
              <p key={i}>{l}</p>
            ))}
          </div>
          {source === 'rule-based-stub' && (
            <p className="mt-2 text-[11px] text-slate-400">
              Counts only — AI-generated narrative lands with the chase engine.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

// ── PgM view ───────────────────────────────────────────────────────────

function PgmDashboard({ payload }: { payload: PgmDashboardPayload }) {
  const { metrics, inbox, upcomingBoards } = payload;
  const [nudgingId, setNudgingId] = useState<string | null>(null);
  const handleNudge = async (itemId: string) => {
    if (nudgingId) return;
    setNudgingId(itemId);
    try {
      const res = await api.governanceNudgeItem(itemId);
      if (!res?.success) throw new Error(res?.error ?? 'Nudge failed.');
      const emitted = res?.result?.emitted ?? 0;
      const delivered = res?.result?.delivered ?? 0;
      const suppressed = res?.result?.suppressedAsDuplicate ?? 0;
      if (emitted === 0) {
        toast(
          'No chase rule fires for this item right now. Check the deadline + status.',
          { icon: 'ℹ️' },
        );
      } else if (suppressed > 0 && delivered === 0) {
        toast.success('Already nudged in the last 12h — suppressed.');
      } else {
        toast.success(`Nudge sent (${delivered} delivered).`);
      }
    } catch (e: any) {
      toast.error(e?.message ?? 'Nudge failed.');
    } finally {
      setNudgingId(null);
    }
  };
  return (
    <div className="space-y-6">
      <BriefingCard lines={payload.briefing.lines} source={payload.briefing.source} />

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          title="Reports in review"
          value={metrics.reportsInReview}
          icon={ClipboardList}
          size="sm"
          iconBgClassName="bg-amber-100"
          iconClassName="text-amber-700"
        />
        <StatsCard
          title="FP requests"
          value={metrics.fpProposed}
          unit={`of ${metrics.fpProposed + metrics.fpDraft} active`}
          icon={Inbox}
          size="sm"
          iconBgClassName="bg-rose-100"
          iconClassName="text-rose-700"
        />
        <StatsCard
          title="Boards this fortnight"
          value={metrics.boardsThisFortnight}
          icon={CalendarDays}
          size="sm"
          iconBgClassName="bg-indigo-100"
          iconClassName="text-indigo-700"
        />
        <StatsCard
          title="Sealed this quarter"
          value={metrics.sealedThisQuarter}
          icon={CheckCircle2}
          size="sm"
          iconBgClassName="bg-emerald-100"
          iconClassName="text-emerald-700"
        />
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Inbox (2/3 width)*/}
        <section className="space-y-3 lg:col-span-2">
          <header className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900">Inbox</h2>
            <span className="text-[11px] text-slate-500">{inbox.length} item{inbox.length === 1 ? '' : 's'}</span>
          </header>
          {inbox.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-xs text-slate-500">
              Nothing to review. Your queue is clear.
            </div>
          ) : (
            <ul className="space-y-2">
              {inbox.map((it) => {
                const meta = INBOX_KIND_META[it.kind];
                return (
                  <li
                    key={`${it.kind}-${it.id}`}
                    className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm transition-shadow hover:shadow-md"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span
                            className={clsx(
                              'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold',
                              meta.pill,
                            )}
                          >
                            <span className={clsx('h-1.5 w-1.5 rounded-full', meta.dot)} />
                            {meta.label}
                          </span>
                          {typeof it.ageDays === 'number' && it.ageDays >= 0 && (
                            <span className="text-[10px] text-slate-500">
                              {it.ageDays === 0 ? 'today' : `${it.ageDays}d ago`}
                            </span>
                          )}
                        </div>
                        <p className="mt-1.5 truncate text-sm font-semibold text-slate-900">
                          {it.title}
                        </p>
                        {(it.subtitle || it.ownerLabel) && (
                          <p className="mt-0.5 truncate text-[11px] text-slate-500">
                            {[it.subtitle, it.ownerLabel].filter(Boolean).join(' · ')}
                          </p>
                        )}
                      </div>
                      <div className="flex shrink-0 items-center gap-1.5 self-center">
                        <button
                          type="button"
                          onClick={() => handleNudge(it.id)}
                          disabled={nudgingId === it.id}
                          title="Send a chase notification now (12h dedupe applies)"
                          className="inline-flex h-8 items-center gap-1 rounded-lg border border-amber-200 bg-amber-50 px-2.5 text-[11px] font-semibold text-amber-800 hover:bg-amber-100 disabled:opacity-50"
                        >
                          {nudgingId === it.id ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <BellRing className="h-3 w-3" />
                          )}
                          Nudge
                        </button>
                        {it.href && (
                          <Link
                            to={it.href}
                            className="inline-flex h-8 items-center gap-1 rounded-lg bg-indigo-600 px-2.5 text-[11px] font-semibold text-white hover:bg-indigo-700"
                          >
                            Open
                            <ArrowRight className="h-3 w-3" />
                          </Link>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* Upcoming boards (1/3 width)*/}
        <section className="space-y-3">
          <header className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900">Upcoming boards</h2>
            <Link
              to="/governance/board-calendar"
              className="text-[11px] font-medium text-indigo-600 hover:text-indigo-700"
            >
              See calendar
            </Link>
          </header>
          {upcomingBoards.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-xs text-slate-500">
              No boards scheduled in the next 14 days.
            </div>
          ) : (
            <ul className="space-y-2">
              {upcomingBoards.map((b) => (
                <li
                  key={b.id}
                  className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm"
                >
                  <p className="truncate text-sm font-semibold text-slate-900">
                    {b.title}
                  </p>
                  <p className="mt-0.5 text-[11px] text-slate-500">
                    {formatGbDate(b.date)} · in {b.daysAway} day{b.daysAway === 1 ? '' : 's'}
                  </p>
                  <p className="mt-1.5 inline-flex items-center gap-1 text-[10px] font-medium text-indigo-700">
                    <FileText className="h-3 w-3" />
                    {b.reportsLinked} report{b.reportsLinked === 1 ? '' : 's'} linked
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

// ── PM view ────────────────────────────────────────────────────────────

function PmDashboard({ payload }: { payload: PmDashboardPayload }) {
  const { metrics, upcomingDeadlines, myOpenAmendments } = payload;
  return (
    <div className="space-y-6">
      <BriefingCard lines={payload.briefing.lines} source={payload.briefing.source} />

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          title="Drafting"
          value={metrics.drafting}
          icon={ClipboardList}
          size="sm"
          iconBgClassName="bg-amber-100"
          iconClassName="text-amber-700"
        />
        <StatsCard
          title="With PgM"
          value={metrics.withPgM}
          icon={Inbox}
          size="sm"
          iconBgClassName="bg-indigo-100"
          iconClassName="text-indigo-700"
        />
        <StatsCard
          title="Amendments"
          value={metrics.amendments}
          icon={AlertTriangle}
          size="sm"
          iconBgClassName="bg-rose-100"
          iconClassName="text-rose-700"
        />
        <StatsCard
          title="Approved this quarter"
          value={metrics.approvedThisQuarter}
          icon={CheckCircle2}
          size="sm"
          iconBgClassName="bg-emerald-100"
          iconClassName="text-emerald-700"
        />
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Upcoming deadlines*/}
        <section className="space-y-3">
          <header className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900">Upcoming deadlines</h2>
            <Link
              to="/governance/my-reports"
              className="text-[11px] font-medium text-indigo-600 hover:text-indigo-700"
            >
              All reports
            </Link>
          </header>
          {upcomingDeadlines.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-xs text-slate-500">
              No deadlines in the next 30 days.
            </div>
          ) : (
            <ul className="space-y-2">
              {upcomingDeadlines.map((d) => (
                <li
                  key={d.reportId}
                  className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm transition-shadow hover:shadow-md"
                >
                  <Link
                    to={`/governance/reports-list/${d.reportId}`}
                    className="block min-w-0"
                  >
                    <p className="truncate text-sm font-semibold text-slate-900">
                      {d.title}
                    </p>
                    <p className="mt-0.5 text-[11px] text-slate-500">
                      {formatGbDate(d.targetDate)}
                    </p>
                    <p
                      className={clsx(
                        'mt-1.5 inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold',
                        d.overdue
                          ? 'bg-rose-100 text-rose-700'
                          : d.daysAway <= 7
                            ? 'bg-amber-100 text-amber-700'
                            : 'bg-slate-100 text-slate-700',
                      )}
                    >
                      {d.overdue
                        ? `Overdue by ${Math.abs(d.daysAway)}d`
                        : `${d.daysAway} day${d.daysAway === 1 ? '' : 's'} away`}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Feedback from PgM*/}
        <section className="space-y-3">
          <header className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900">Feedback from PgM</h2>
            <span className="text-[11px] text-slate-500">
              {myOpenAmendments.length} open
            </span>
          </header>
          {myOpenAmendments.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-xs text-slate-500">
              No outstanding feedback. Nice work.
            </div>
          ) : (
            <ul className="space-y-2">
              {myOpenAmendments.map((a) => (
                <li
                  key={a.amendmentId}
                  className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm transition-shadow hover:shadow-md"
                >
                  <Link to={`/governance/reports-list/${a.reportId}`} className="block">
                    <p className="text-[11px] font-semibold text-indigo-700">
                      {a.reportTitle}
                    </p>
                    <p className="mt-1 line-clamp-2 text-xs text-slate-700">
                      {a.text || '(No detail)'}
                    </p>
                    {a.raisedAt && (
                      <p className="mt-1 text-[10px] text-slate-500">
                        Raised {formatGbDate(a.raisedAt)}
                      </p>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

// ── Skeleton ───────────────────────────────────────────────────────────

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="h-24 animate-pulse rounded-lg bg-slate-100" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 animate-pulse rounded-lg bg-slate-100" />
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="h-64 animate-pulse rounded-lg bg-slate-100 lg:col-span-2" />
        <div className="h-64 animate-pulse rounded-lg bg-slate-100" />
      </div>
    </div>
  );
}
