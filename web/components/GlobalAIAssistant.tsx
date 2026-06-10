import { useState, useEffect, useMemo } from 'react';
import { useLocation, matchPath } from 'react-router';
import { ScanSearch } from 'lucide-react';
import { AIInquiryPopup } from './AIInquiryPopup';
import { api } from '../lib/api';

// Routes where a per-page AI button already exists OR where AI doesn't fit.
// Returning `null` here means the global button does NOT render — guarantees no
// double-mount on the 7 existing pages and respects locked skip decisions.
const SKIP_PATHS = new Set<string>([
  '/login',
  // Existing per-page AI button (don't double-mount)
  '/compliance/tracker',
  '/compliance/dashboard',
  '/compliance/setup',
  '/setup/project',
  '/regulations',
  '/risk/programme-register',
  '/risk/dashboard',
  // Locked skips
  '/governance/editor-sandbox',
  // Automated Intelligence pages — these surfaces are themselves AI-powered
  // workflows; a separate AI button would be redundant and confusing.
  '/risk/ai',
  '/ai/controls',
  '/ai/compliance',
  // Reporting export pages — static read-only / print-style dashboards;
  // not a query surface.
  '/reporting/executive',
  '/reporting/project',
  '/reporting/programme',
  '/reporting/programme-report',
  // Workspace management — admin settings, not a query surface.
  '/setup/workspace',
  // Full-page AI Chat — has its own chat surface; floating button would be redundant.
  '/chat',
]);

// Pattern-based skips (dynamic segments).
const SKIP_PATTERNS: string[] = [
  '/governance/reports-list/:id', // Report Authoring — keep editor focused
];

// Pathname → human-readable context label fed into the AI prompt as
// "CURRENT PAGE/USER CONTEXT". Helps the model anchor answers to the page
// the user is actually looking at.
const CONTEXT_LABELS: Array<{ test: (p: string) => boolean; label: string }> = [
  { test: (p) => p === '/dashboard', label: 'Portfolio Dashboard' },
  { test: (p) => p === '/projects', label: 'Projects List' },
  { test: (p) => p === '/project/initiation' || /^\/projects\/edit\//.test(p), label: 'Project Setup' },
  { test: (p) => p === '/project/plan', label: 'Project Plan' },
  { test: (p) => p === '/programmes' || /^\/programmes\/(new|edit\/)/.test(p) || p === '/setup/programme', label: 'Programmes' },
  { test: (p) => p === '/setup/workspace', label: 'Workspace Settings' },
  { test: (p) => p === '/my-tasks', label: 'My Tasks' },
  { test: (p) => p === '/calendar', label: 'Calendar' },
  { test: (p) => p === '/team', label: 'Team Management' },
  { test: (p) => p === '/lessons-learned', label: 'Lessons Learned' },
  { test: (p) => p === '/compliance/evidence', label: 'Evidence Documents' },
  { test: (p) => p === '/compliance/linked-regs', label: 'Linked Regulations' },
  { test: (p) => p === '/compliance/alerts', label: 'Compliance Alerts' },
  { test: (p) => p === '/regulations/cpd' || p === '/training', label: 'CPD Training' },
  { test: (p) => p === '/risk/programme-context', label: 'Programme Risk Context' },
  { test: (p) => p === '/risk/setup', label: 'Risk Setup' },
  { test: (p) => p === '/risk/register', label: 'Project Risk Register' },
  { test: (p) => p === '/risk/programme-issues', label: 'Programme Issues' },
  { test: (p) => p === '/risk/issues', label: 'Project Issues' },
  { test: (p) => p === '/risk/alerts' || p === '/monitoring/alerts', label: 'Risk Alerts' },
  { test: (p) => p === '/monitoring/kri', label: 'KRI Tracker' },
  { test: (p) => p === '/monitoring/aggregation', label: 'Risk Aggregation' },
  { test: (p) => p === '/monitoring/heatmaps', label: 'Trends and Heatmaps' },
  { test: (p) => p === '/risk/ai', label: 'AI Risk Identifier' },
  { test: (p) => p === '/ai/controls', label: 'AI Control Suggestions' },
  { test: (p) => p === '/ai/compliance', label: 'AI Compliance Outlook' },
  { test: (p) => p === '/reporting/executive', label: 'Executive Report' },
  { test: (p) => p === '/reporting/project', label: 'Project Report' },
  { test: (p) => p === '/reporting/programme', label: 'Programme Report (Client)' },
  { test: (p) => p === '/reporting/programme-report', label: 'Programme Report' },
  { test: (p) => p.startsWith('/admin'), label: 'Admin Panel' },
  { test: (p) => p === '/developer/keys', label: 'Developer Settings' },
  // Programme Governance
  { test: (p) => p === '/governance/dashboard', label: 'Governance Dashboard' },
  { test: (p) => p === '/governance/forward-plan', label: 'Forward Plan' },
  { test: (p) => p === '/governance/my-reports', label: 'My Reports (PM)' },
  { test: (p) => p === '/governance/reports', label: 'Report Templates' },
  { test: (p) => p === '/governance/reports-list', label: 'Reports List' },
  { test: (p) => p === '/governance/meetings', label: 'Meetings' },
  { test: (p) => p === '/governance/framework', label: 'Governance Framework' },
  { test: (p) => p === '/governance/archive', label: 'Audit Archive' },
  { test: (p) => p === '/governance/board-calendar', label: 'Public Board Calendar' },
  { test: (p) => p === '/governance/project-docs', label: 'Project Governance Folder' },
  // Technical Assurance Companion (TAC)
  { test: (p) => p === '/technical-assurance/enquiries', label: 'Technical Enquiries' },
  { test: (p) => /^\/technical-assurance\/enquiries\//.test(p), label: 'Technical Enquiry Workspace' },
  { test: (p) => p === '/technical-assurance/rfis', label: 'RFI Register' },
  { test: (p) => p === '/technical-assurance/audit', label: 'Technical Assurance Audit' },
];

function deriveContextLabel(pathname: string): string {
  for (const entry of CONTEXT_LABELS) {
    if (entry.test(pathname)) return entry.label;
  }
  return 'CedarGuard';
}

// Lazy-fetch governance data scoped to the current route. Fires once per
// popup-open (cached in component state) so the AI prompt has live FP /
// meeting / report / framework / archive / project-doc data when the user
// asks a query on a /governance/* page.
async function buildGovernancePageContext(
  pathname: string,
): Promise<{ kind: string; payload: any } | null> {
  try {
    if (pathname === '/governance/forward-plan') {
      const res = await api.governanceListForwardPlanItems();
      const items = (res?.items ?? []) as any[];
      const live = items.filter((i) => !i.softDeleted);
      const counts = live.reduce(
        (acc: Record<string, number>, it) => {
          acc[it.status] = (acc[it.status] ?? 0) + 1;
          return acc;
        },
        {} as Record<string, number>,
      );
      return {
        kind: 'forward-plan',
        payload: {
          counts,
          needsRerouting: live.filter((i) => i.needsRerouting).length,
          proposed: live
            .filter((i) => i.status === 'Proposed')
            .slice(0, 10)
            .map((i) => ({ id: i.id, title: i.title, scheme: i.scheme, requestedBy: i.requestedBy })),
          top: live.slice(0, 15).map((i) => ({
            id: i.id,
            title: i.title,
            status: i.status,
            isKeyDecision: i.isKeyDecision,
            value: i.value,
            targetDecisionDate: i.targetDecisionDate,
            scheme: i.scheme,
          })),
        },
      };
    }

    if (pathname === '/governance/meetings' || pathname === '/governance/board-calendar') {
      const res = await api.governanceListMeetings();
      const items = (res?.items ?? []) as any[];
      const live = items.filter((m: any) => !m.softDeleted);
      const counts = live.reduce(
        (acc: Record<string, number>, m: any) => {
          acc[m.status] = (acc[m.status] ?? 0) + 1;
          return acc;
        },
        {} as Record<string, number>,
      );
      return {
        kind: 'meetings',
        payload: {
          counts,
          upcoming: live
            .filter((m: any) => m.status === 'Scheduled')
            .slice(0, 10)
            .map((m: any) => ({ id: m.id, title: m.title, date: m.date, governanceBodyId: m.governanceBodyId })),
          cancelled: live
            .filter((m: any) => m.status === 'Cancelled')
            .slice(0, 5)
            .map((m: any) => ({ id: m.id, title: m.title, cancellationReason: m.cancellationReason })),
        },
      };
    }

    if (pathname === '/governance/reports-list' || pathname === '/governance/my-reports') {
      const res = await api.governanceListReports();
      const items = (res?.items ?? []) as any[];
      const live = items.filter((r: any) => !r.softDeleted);
      const counts = live.reduce(
        (acc: Record<string, number>, r: any) => {
          acc[r.status] = (acc[r.status] ?? 0) + 1;
          return acc;
        },
        {} as Record<string, number>,
      );
      // For my-reports, also pull open amendments. Errors here are non-fatal.
      let myAmendments: any[] = [];
      if (pathname === '/governance/my-reports') {
        try {
          const amendRes = await api.governanceListMyOpenAmendments();
          myAmendments = (amendRes?.items ?? []).slice(0, 10).map((a: any) => ({
            id: a.id,
            reportTitle: a.reportTitle,
            text: a.text?.substring(0, 120),
            stage: a.stage,
          }));
        } catch {
          // ignore
        }
      }
      return {
        kind: pathname === '/governance/my-reports' ? 'my-reports' : 'reports',
        payload: {
          counts,
          inReview: live
            .filter((r: any) => r.status === 'InReview' || r.status === 'PendingSeniorPmReview')
            .slice(0, 10)
            .map((r: any) => ({ id: r.id, title: r.title, status: r.status })),
          amendmentsRequested: live
            .filter((r: any) => r.status === 'AmendmentsRequested')
            .slice(0, 10)
            .map((r: any) => ({ id: r.id, title: r.title })),
          myOpenAmendments: myAmendments,
        },
      };
    }

    if (pathname === '/governance/reports') {
      const res = await api.governanceListTemplates();
      const items = (res?.items ?? []) as any[];
      return {
        kind: 'templates',
        payload: {
          total: items.length,
          byCategory: items.reduce((acc: Record<string, number>, t: any) => {
            acc[t.category] = (acc[t.category] ?? 0) + 1;
            return acc;
          }, {}),
          list: items.slice(0, 20).map((t: any) => ({
            id: t.id,
            code: t.code,
            title: t.title,
            category: t.category,
            status: t.status,
            requireSeniorPmReview: t.requireSeniorPmReview,
          })),
        },
      };
    }

    if (pathname === '/governance/framework') {
      const res = await api.governanceGetFramework();
      return {
        kind: 'framework',
        payload: {
          version: res?.framework?.version,
          status: res?.framework?.status,
          bodies: (res?.bodies ?? []).map((b: any) => ({
            id: b.id,
            name: b.name,
            tier: b.tier,
            cadence: b.cadence,
            chair: b.chair,
            authority: b.authority,
            acceptedReportTypes: b.acceptedReportTypes,
          })),
          thresholds: (res?.thresholds ?? []).map((t: any) => ({
            id: t.id,
            label: t.label,
            bandMin: t.bandMin,
            bandMax: t.bandMax,
            decisionRoute: t.decisionRoute,
          })),
        },
      };
    }

    if (pathname === '/governance/archive') {
      const res = await api.governanceListArchive();
      const items = (res?.items ?? []) as any[];
      return {
        kind: 'archive',
        payload: {
          total: items.length,
          byKind: items.reduce((acc: Record<string, number>, e: any) => {
            acc[e.kind] = (acc[e.kind] ?? 0) + 1;
            return acc;
          }, {}),
          recent: items.slice(0, 15).map((e: any) => ({
            id: e.id,
            kind: e.kind,
            title: e.title,
            decidedAt: e.decidedAt,
            decisionMaker: e.decisionMaker,
          })),
        },
      };
    }

    if (pathname === '/governance/project-docs') {
      const res = await api.governanceListProjectDocs();
      const items = (res?.items ?? []) as any[];
      return {
        kind: 'project-docs',
        payload: {
          total: items.length,
          recent: items.slice(0, 10).map((d: any) => ({
            id: d.id,
            title: d.title,
            docType: d.docType,
            version: d.version,
            status: d.status,
          })),
        },
      };
    }

    if (pathname === '/governance/dashboard') {
      // Pull a roll-up: FP counts + meetings counts + reports counts.
      const [fpRes, mtgRes, rpRes] = await Promise.all([
        api.governanceListForwardPlanItems().catch(() => ({ items: [] })),
        api.governanceListMeetings().catch(() => ({ items: [] })),
        api.governanceListReports().catch(() => ({ items: [] })),
      ]);
      const fp = ((fpRes?.items ?? []) as any[]).filter((i) => !i.softDeleted);
      const mtg = ((mtgRes?.items ?? []) as any[]).filter((m) => !m.softDeleted);
      const rp = ((rpRes?.items ?? []) as any[]).filter((r) => !r.softDeleted);
      return {
        kind: 'governance-dashboard',
        payload: {
          forwardPlan: {
            total: fp.length,
            proposed: fp.filter((i) => i.status === 'Proposed').length,
            published: fp.filter((i) => i.status === 'Published').length,
            needsRerouting: fp.filter((i) => i.needsRerouting).length,
          },
          meetings: {
            total: mtg.length,
            scheduled: mtg.filter((m) => m.status === 'Scheduled').length,
            held: mtg.filter((m) => m.status === 'Held').length,
            cancelled: mtg.filter((m) => m.status === 'Cancelled').length,
          },
          reports: {
            total: rp.length,
            inReview: rp.filter((r) => r.status === 'InReview' || r.status === 'PendingSeniorPmReview').length,
            amendmentsRequested: rp.filter((r) => r.status === 'AmendmentsRequested').length,
            sealed: rp.filter((r) => r.status === 'Sealed').length,
          },
        },
      };
    }
  } catch (e) {
    console.error('[GlobalAIAssistant] governance fetch failed', e);
  }
  return null;
}

export function GlobalAIAssistant() {
  const location = useLocation();
  const pathname = location.pathname;

  const [isOpen, setIsOpen] = useState(false);
  const [pageContext, setPageContext] = useState<{ kind: string; payload: any } | null>(null);

  const isSkipped = useMemo(() => {
    if (SKIP_PATHS.has(pathname)) return true;
    return SKIP_PATTERNS.some((pat) => matchPath(pat, pathname));
  }, [pathname]);

  const contextLabel = useMemo(() => deriveContextLabel(pathname), [pathname]);

  // Lazy-fetch governance data when the popup opens on a governance route.
  // Cached in state for the open session; refetched on each fresh open so the
  // AI sees up-to-date state.
  useEffect(() => {
    if (!isOpen) {
      setPageContext(null);
      return;
    }
    if (!pathname.startsWith('/governance/')) {
      setPageContext(null);
      return;
    }
    let cancelled = false;
    (async () => {
      const ctx = await buildGovernancePageContext(pathname);
      if (!cancelled) setPageContext(ctx);
    })();
    return () => {
      cancelled = true;
    };
  }, [isOpen, pathname]);

  if (isSkipped) return null;

  return (
    <>
      <AIInquiryPopup
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        context={contextLabel}
        pageContext={pageContext}
      />
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="fixed bottom-[calc(env(safe-area-inset-bottom)+5.5rem)] right-5 lg:bottom-8 lg:right-8 z-[150] bg-indigo-600 text-white p-4 rounded-full shadow-2xl shadow-indigo-500/40 hover:bg-slate-900 transition-all hover:scale-110 active:scale-95 group"
        title="Consult CedarGuard AI"
        aria-label="Open CedarGuard AI Assistant"
      >
        <ScanSearch className="w-6 h-6 group-hover:rotate-12 transition-transform" />
      </button>
    </>
  );
}
