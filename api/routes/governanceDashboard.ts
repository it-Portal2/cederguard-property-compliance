// Governance Dashboard.
//
// One server endpoint, role-aware payload. Caller's role determines
// the shape returned:
//   • PgM (clientAdmin / superAdmin): workspace-wide pipeline view —
//     reports awaiting PgM action, FP backlog, upcoming boards,
//     SLA-breach watch.
//   • PM (project_manager only): personal workspace — drafting,
//     with-PgM, amendments, upcoming personal deadlines.
//
// Briefing copy is **assembled from real counts**. Phase
// 12 swaps the body for a Gemini call; the response shape stays
// identical so the UI doesn't need to change.

import type { ApiContext } from '../lib/context.js';
import type { ReportStatus } from '../lib/reportsSeed.js';
import { generateBriefing } from '../lib/geminiBriefing.js';

// Pure-PM detection — same as the sidebar role split.
function isPureProjectManager(ctx: ApiContext): boolean {
  if (ctx.isAdmin) return false;
  if (ctx.isClientAdmin) return false;
  const role = (ctx.userData?.role ?? '').toString().toLowerCase();
  return role === 'project_manager' || role === 'pm';
}

function nowIso() {
  return new Date().toISOString();
}

function todayMidnightIso(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

function daysFromNow(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(23, 59, 59, 999);
  return d.toISOString();
}

function quarterStartIso(): string {
  const d = new Date();
  const q = Math.floor(d.getMonth() / 3);
  const start = new Date(d.getFullYear(), q * 3, 1);
  return start.toISOString();
}

interface InboxItem {
  kind: 'awaiting-review' | 'awaiting-senior-pm' | 'amendments-resolved' | 'fp-pending';
  id: string;
  title: string;
  subtitle: string | null;
  ownerLabel: string | null;
  status: string;
  ageDays: number | null;
  href: string | null;
}

interface UpcomingBoard {
  id: string;
  title: string;
  bodyLabel: string | null;
  date: string;
  daysAway: number;
  reportsLinked: number;
}

interface PmDeadline {
  reportId: string;
  title: string;
  targetDate: string;
  daysAway: number;
  overdue: boolean;
  status: string;
}

interface PmAmendmentRow {
  amendmentId: string;
  reportId: string;
  reportTitle: string;
  text: string;
  raisedAt: string | null;
}

function diffDays(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return null;
  const now = Date.now();
  return Math.round((t - now) / (1000 * 60 * 60 * 24));
}

// ── Endpoint ───────────────────────────────────────────────────────────

async function governanceGetDashboard(req: any, res: any, ctx: ApiContext) {
  try {
    const isPm = isPureProjectManager(ctx);

    //  when `asOfMonth` (YYYY-MM) is passed, dashboard data
    // sources swap to the monthly snapshot. Inbox + workload counts
    // reflect "what was true at month-end" rather than now. The
    // dynamic comparators (today / horizon / quarterStart) still run
    // against current time — there's no point computing "boards in
    // the next 14 days" for a frozen month.
    const asOfMonth: string | null =
      typeof req?.body?.asOfMonth === 'string' &&
      req.body.asOfMonth.match(/^\d{4}-\d{2}$/)
        ? req.body.asOfMonth
        : null;

    let reports: any[] = [];
    let fpItems: any[] = [];
    let meetings: any[] = [];
    let amendments: any[] = [];
    let projectsSnap: any = { docs: [] };

    if (asOfMonth) {
      // Lazy-import to avoid pulling the helper into the live path's
      // hot module graph.
      const { readMonthlySnapshot } = await import(
        '../lib/historicalSnapshots.js'
      );
      const [r, fp, m, p] = await Promise.all([
        readMonthlySnapshot(ctx, ctx.primaryUid, asOfMonth, 'reports'),
        readMonthlySnapshot(ctx, ctx.primaryUid, asOfMonth, 'forwardPlanItems'),
        readMonthlySnapshot(ctx, ctx.primaryUid, asOfMonth, 'meetings'),
        ctx.db
          .collection('projects')
          .where('clientId', '==', ctx.primaryUid)
          .limit(50)
          .get(),
      ]);
      const fromEntries = (entries: any[]) =>
        entries
          .filter((e) => e?.kind === 'governanceDoc' && e.doc)
          .map((e) => ({ _docId: e.docId ?? e.doc.id ?? '', ...e.doc }));
      reports = fromEntries(r?.entries ?? []);
      fpItems = fromEntries(fp?.entries ?? []);
      meetings = fromEntries(m?.entries ?? []).filter(
        (mt: any) => mt.status === 'Scheduled' && !mt.softDeleted,
      );
      // Amendments aren't currently snapshotted — degrade gracefully
      // by returning an empty list rather than throwing.
      amendments = [];
      projectsSnap = p;
    } else {
      // Live path — original parallel fetch.
      const [
        reportsSnap,
        fpSnap,
        meetingsSnap,
        amendmentsSnap,
        liveProjectsSnap,
      ] = await Promise.all([
        ctx.db
          .collection('reports')
          .where('clientId', '==', ctx.primaryUid)
          .get(),
        ctx.db
          .collection('forwardPlanItems')
          .where('clientId', '==', ctx.primaryUid)
          .get(),
        ctx.db
          .collection('meetings')
          .where('clientId', '==', ctx.primaryUid)
          .where('status', '==', 'Scheduled')
          .get(),
        ctx.db
          .collection('amendments')
          .where('clientId', '==', ctx.primaryUid)
          .get(),
        // Used only by PM "team workload" widget on PgM view; cheap.
        ctx.db
          .collection('projects')
          .where('clientId', '==', ctx.primaryUid)
          .limit(50)
          .get(),
      ]);
      reports = reportsSnap.docs.map((d: any) => ({
        _docId: d.id,
        ...(d.data() as any),
      }));
      fpItems = fpSnap.docs.map((d: any) => ({
        _docId: d.id,
        ...(d.data() as any),
      }));
      meetings = meetingsSnap.docs
        .map((d: any) => ({ _docId: d.id, ...(d.data() as any) }))
        .filter((m: any) => !m.softDeleted);
      amendments = amendmentsSnap.docs.map((d: any) => ({
        _docId: d.id,
        ...(d.data() as any),
      }));
      projectsSnap = liveProjectsSnap;
    }

    const todayIso = todayMidnightIso();
    const horizonIso = daysFromNow(14);

    // ── PgM view ───────────────────────────────────────────────────────
    if (!isPm) {
      const reportsInReview = reports.filter(
        (r: any) => !r.softDeleted && (r.status === 'InReview' || r.status === 'PendingSeniorPmReview'),
      );
      const reportsAmendments = reports.filter(
        (r: any) => !r.softDeleted && r.status === 'AmendmentsRequested',
      );
      const fpProposed = fpItems.filter(
        (f: any) => !f.softDeleted && f.status === 'Proposed',
      );
      const fpDraft = fpItems.filter(
        (f: any) => !f.softDeleted && f.status === 'Draft',
      );
      const upcomingBoards: UpcomingBoard[] = meetings
        .filter((m: any) => m.date >= todayIso.slice(0, 10) && m.date <= horizonIso.slice(0, 10))
        .map((m: any) => ({
          id: m.id ?? m._docId,
          title: m.title ?? m.governanceBodyLabel ?? 'Meeting',
          bodyLabel: m.governanceBodyLabel ?? null,
          date: m.date,
          daysAway: diffDays(m.date) ?? 0,
          reportsLinked: Array.isArray(m.linkedReportIds) ? m.linkedReportIds.length : 0,
        }))
        .sort((a, b) => a.date.localeCompare(b.date))
        .slice(0, 5);

      const sealedThisQuarter = reports.filter(
        (r: any) =>
          !r.softDeleted &&
          r.status === 'Sealed' &&
          (r.sealedAt ?? r.approvedAt ?? r.updatedAt ?? '') >= quarterStartIso(),
      ).length;

      const inbox: InboxItem[] = [
        ...reportsInReview.map((r: any) => ({
          kind: r.status === 'PendingSeniorPmReview'
            ? ('awaiting-senior-pm' as const)
            : ('awaiting-review' as const),
          id: r.id ?? r._docId,
          title: r.title ?? 'Untitled report',
          subtitle: r.scheme ?? null,
          ownerLabel: r.ownerLabel ?? null,
          status: r.status,
          ageDays: diffDays(r.submittedAt) === null ? null : -1 * (diffDays(r.submittedAt) as number),
          href: `/governance/reports-list/${r.id ?? r._docId}`,
        })),
        ...fpProposed.map((f: any) => ({
          kind: 'fp-pending' as const,
          id: f.id ?? f._docId,
          title: f.title ?? 'Forward Plan request',
          subtitle: f.scheme ?? null,
          ownerLabel: f.requestedByLabel ?? null,
          status: f.status,
          ageDays: diffDays(f.requestedAt) === null ? null : -1 * (diffDays(f.requestedAt) as number),
          href: '/governance/forward-plan',
        })),
      ].slice(0, 8);

      // Briefing copy — assembled from counts. swaps for Gemini.
      const greetingName = (ctx.userData?.name ?? ctx.userData?.displayName ?? 'there').toString();
      const briefingLines: string[] = [`Good morning, ${greetingName.split(' ')[0]}.`];
      if (reportsInReview.length) {
        briefingLines.push(
          `${reportsInReview.length} report${reportsInReview.length === 1 ? '' : 's'} awaiting your review.`,
        );
      }
      if (fpProposed.length) {
        briefingLines.push(
          `${fpProposed.length} Forward Plan request${fpProposed.length === 1 ? '' : 's'} from PMs to triage.`,
        );
      }
      if (upcomingBoards.length) {
        const next = upcomingBoards[0];
        briefingLines.push(
          `Next board ${next.bodyLabel ?? next.title} in ${next.daysAway} day${next.daysAway === 1 ? '' : 's'}.`,
        );
      }
      if (briefingLines.length === 1) {
        briefingLines.push('No pending PgM actions — your queue is clear.');
      }

      const briefing = await generateBriefing({
        role: 'pgm',
        greetingName,
        stubLines: briefingLines,
        ctx,
      });
      return res.status(200).json({
        success: true,
        role: 'pgm' as const,
        generatedAt: nowIso(),
        briefing,
        metrics: {
          reportsInReview: reportsInReview.length,
          reportsAmendments: reportsAmendments.length,
          fpDraft: fpDraft.length,
          fpProposed: fpProposed.length,
          boardsThisFortnight: upcomingBoards.length,
          sealedThisQuarter,
          activeProjects: projectsSnap.size,
        },
        inbox,
        upcomingBoards,
      });
    }

    // ── PM view ────────────────────────────────────────────────────────
    const myReports = reports.filter(
      (r: any) => !r.softDeleted && r.ownerUid === ctx.uid,
    );
    const drafting = myReports.filter((r: any) => r.status === 'Draft').length;
    const withPgM = myReports.filter(
      (r: any) =>
        r.status === 'InReview' || r.status === 'PendingSeniorPmReview',
    ).length;
    const myAmendmentReports = myReports.filter(
      (r: any) => r.status === 'AmendmentsRequested',
    );
    const approvedThisQuarter = myReports.filter(
      (r: any) =>
        (r.status === 'Approved' || r.status === 'Sealed') &&
        ((r.approvedAt ?? r.sealedAt ?? r.updatedAt ?? '') >= quarterStartIso()),
    ).length;

    // Upcoming deadlines — own reports w/ targetBoardDate in next 30 days
    // (and not Sealed / Abandoned).
    const horizon30 = daysFromNow(30);
    const upcomingDeadlines: PmDeadline[] = myReports
      .filter((r: any) => {
        if (r.status === 'Sealed' || r.status === 'Abandoned') return false;
        const d = r.targetBoardDate;
        if (!d) return false;
        return d <= horizon30.slice(0, 10);
      })
      .map((r: any) => {
        const days = diffDays(r.targetBoardDate) ?? 0;
        return {
          reportId: r.id ?? r._docId,
          title: r.title ?? 'Untitled',
          targetDate: r.targetBoardDate,
          daysAway: days,
          overdue: days < 0,
          status: r.status as ReportStatus,
        };
      })
      .sort((a, b) => a.targetDate.localeCompare(b.targetDate))
      .slice(0, 6);

    // Open amendments on my reports.
    const myReportIds = new Set(myReports.map((r: any) => r.id ?? r._docId));
    const reportTitleById = new Map(
      myReports.map((r: any) => [r.id ?? r._docId, r.title ?? 'Untitled']),
    );
    const myOpenAmendments: PmAmendmentRow[] = amendments
      .filter(
        (a: any) =>
          (a.status === 'Open' || a.status === 'open') &&
          myReportIds.has(a.reportId),
      )
      .map((a: any) => ({
        amendmentId: a._docId,
        reportId: a.reportId,
        reportTitle: reportTitleById.get(a.reportId) ?? 'Report',
        text: a.text ?? '',
        raisedAt: a.createdAt ?? a.raisedAt ?? null,
      }))
      .sort((a, b) => (b.raisedAt ?? '').localeCompare(a.raisedAt ?? ''))
      .slice(0, 6);

    const greetingName = (ctx.userData?.name ?? ctx.userData?.displayName ?? 'there').toString();
    const briefingLines: string[] = [`Good morning, ${greetingName.split(' ')[0]}.`];
    if (myAmendmentReports.length) {
      briefingLines.push(
        `${myAmendmentReports.length} report${myAmendmentReports.length === 1 ? '' : 's'} with amendments to address.`,
      );
    }
    if (drafting) {
      briefingLines.push(`${drafting} draft${drafting === 1 ? '' : 's'} in progress.`);
    }
    if (withPgM) {
      briefingLines.push(`${withPgM} with the Programme Manager for review.`);
    }
    if (upcomingDeadlines.length) {
      const earliest = upcomingDeadlines[0];
      briefingLines.push(
        earliest.overdue
          ? `Earliest deadline overdue (${earliest.title}).`
          : `Earliest deadline in ${earliest.daysAway} day${earliest.daysAway === 1 ? '' : 's'}.`,
      );
    }
    if (briefingLines.length === 1) {
      briefingLines.push('No reports yet — head to My Reports to start drafting.');
    }

    const briefing = await generateBriefing({
      role: 'pm',
      greetingName,
      stubLines: briefingLines,
      ctx,
    });
    return res.status(200).json({
      success: true,
      role: 'pm' as const,
      generatedAt: nowIso(),
      briefing,
      metrics: {
        drafting,
        withPgM,
        amendments: myAmendmentReports.length,
        approvedThisQuarter,
      },
      upcomingDeadlines,
      myOpenAmendments,
    });
  } catch (e: any) {
    console.error('[governanceGetDashboard] failed:', e);
    return res.status(500).json({
      success: false,
      error: e?.message ?? 'Failed to load dashboard.',
      code: 'LOAD_FAILED',
    });
  }
}

// ── Standalone briefing rewrite endpoint ───────────────────────────────
//
// Lets pages that already have their own data (e.g. MyReports) hand
// pre-computed stub lines to the same `generateBriefing` helper so they
// inherit the canonical Gemini fallback chain. Inputs
// are caller-provided strings; we never persist them — the Gemini call
// just rewrites them.

async function governanceGenerateBriefing(
  req: any,
  res: any,
  ctx: ApiContext,
) {
  try {
    const { role, stubLines, greetingName } = req.body ?? {};
    if (role !== 'pgm' && role !== 'pm') {
      return res.status(400).json({
        success: false,
        error: 'role must be "pgm" or "pm".',
        code: 'INVALID_INPUT',
      });
    }
    if (!Array.isArray(stubLines) || stubLines.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'stubLines required (non-empty array of strings).',
        code: 'INVALID_INPUT',
      });
    }
    const cleanStubLines = stubLines
      .map((s: any) => (typeof s === 'string' ? s.trim() : ''))
      .filter(Boolean)
      .slice(0, 8);
    const safeGreeting =
      typeof greetingName === 'string' && greetingName.trim()
        ? greetingName.trim().slice(0, 60)
        : (ctx.userData?.name ?? ctx.userData?.displayName ?? 'there').toString();
    const briefing = await generateBriefing({
      role,
      greetingName: safeGreeting,
      stubLines: cleanStubLines,
      ctx,
    });
    return res.status(200).json({ success: true, briefing });
  } catch (e: any) {
    console.error('[governanceGenerateBriefing] failed:', e);
    return res.status(500).json({
      success: false,
      error: e?.message ?? 'Briefing failed.',
      code: 'BRIEFING_FAILED',
    });
  }
}

export const governanceDashboardRoutes: Record<string, any> = {
  governanceGetDashboard,
  governanceGenerateBriefing,
};
