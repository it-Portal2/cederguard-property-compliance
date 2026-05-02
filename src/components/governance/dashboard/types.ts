// Phase 11 — Governance Dashboard shared types.

export type DashboardRole = 'pgm' | 'pm';

export interface DashboardBriefing {
  lines: string[];
  source: 'rule-based-stub' | 'gemini'; // Phase 12 wires gemini
}

export interface PgmInboxItem {
  kind: 'awaiting-review' | 'awaiting-senior-pm' | 'amendments-resolved' | 'fp-pending';
  id: string;
  title: string;
  subtitle: string | null;
  ownerLabel: string | null;
  status: string;
  ageDays: number | null;
  href: string | null;
}

export interface PgmUpcomingBoard {
  id: string;
  title: string;
  bodyLabel: string | null;
  date: string;
  daysAway: number;
  reportsLinked: number;
}

export interface PgmDashboardPayload {
  success: true;
  role: 'pgm';
  generatedAt: string;
  briefing: DashboardBriefing;
  metrics: {
    reportsInReview: number;
    reportsAmendments: number;
    fpDraft: number;
    fpProposed: number;
    boardsThisFortnight: number;
    sealedThisQuarter: number;
    activeProjects: number;
  };
  inbox: PgmInboxItem[];
  upcomingBoards: PgmUpcomingBoard[];
}

export interface PmDeadline {
  reportId: string;
  title: string;
  targetDate: string;
  daysAway: number;
  overdue: boolean;
  status: string;
}

export interface PmAmendmentRow {
  amendmentId: string;
  reportId: string;
  reportTitle: string;
  text: string;
  raisedAt: string | null;
}

export interface PmDashboardPayload {
  success: true;
  role: 'pm';
  generatedAt: string;
  briefing: DashboardBriefing;
  metrics: {
    drafting: number;
    withPgM: number;
    amendments: number;
    approvedThisQuarter: number;
  };
  upcomingDeadlines: PmDeadline[];
  myOpenAmendments: PmAmendmentRow[];
}

export type DashboardPayload = PgmDashboardPayload | PmDashboardPayload;
