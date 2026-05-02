// Forward Plan starter sample — small set covering the variety of states
// users will see in the UI (draft, published, key-decision, decided,
// soft-deleted). Per the user's principle: "seed data is for UI checking,
// production users build everything via CRUD". Kept intentionally small.

export type ForwardPlanStatus =
  | 'Draft'
  | 'Proposed'   // Phase 5.5b — PM raised via report meeting picker, awaits PgM Confirm
  | 'Published'
  | 'Decided'
  | 'Deferred'
  | 'Archived';

export type EntryType = 'New' | 'Change' | 'Delete';
export type Classification = 'Open' | 'Closed' | 'Part 1 and 2';
export type RoutingMode = 'sequential' | 'parallel';
export type BoardGateStatus = 'scheduled' | 'held' | 'deferred' | 'na';
// Phase 5.5e — Column F on the real Southwark FP sheet. Distinct from
// `status` (Draft/Proposed/Published/Decided/...). Tracks whether the
// underlying report has been ratified at the decision point.
export type ApprovalStatus = 'Pending' | 'Approved';

export interface BoardGate {
  targetDate?: string;
  status: BoardGateStatus;
  outcome?: string;
}

export interface SeedForwardPlanItem {
  id: string;
  title: string;
  scheme: string;
  reportType: string;
  typeOfEntry: EntryType;
  classification: Classification;
  isHRB: boolean;
  wards: string[];
  value: number;
  targetDecisionDate: string;
  decisionRoute: string;
  routingMode: RoutingMode;
  boardGates: Record<string, BoardGate>;
  strategicLead: string;
  reportAuthor: string;
  representingOfficer?: string;
  decisionMaker?: string;
  status: ForwardPlanStatus;
  decidedAt?: string;
  decisionOutcome?: string;
  softDeleted: boolean;
  deletionReason?: string;
  otherMeetings?: string;
  comments?: string;
  fileLink?: string;
  decisionLink?: string;
  // Phase 5.5b — meeting reference (replaces per-body boardGates for new
  // items; legacy `boardGates` stays as read-only fallback per ADD-never-MODIFY).
  meetingId?: string | null;
  // Set when a PM raised the item via the Report meeting picker;
  // referenced by Confirm / Decline / Withdraw endpoints to verify
  // ownership.
  requestedBy?: string | null;
  requestedAt?: string | null;
  // PgM-set on Decline; surfaces as a hint to PM when item flips back
  // to Draft so they can pick a different meeting.
  lastDeclineReason?: string | null;
  lastDeclinedBy?: string | null;
  lastDeclinedAt?: string | null;
  // Phase 5.5c — flag set by server when the meeting this FP item
  // references gets cancelled. UI surfaces a re-routing pill.
  needsRerouting?: boolean;
  // Optional report linkage when the FP item was raised from a Report.
  reportId?: string | null;
  // Phase 5.5e — Approval Status (Excel Column F). Independent of `status`.
  approvalStatus?: ApprovalStatus | null;
}

// 5 items spanning the variety of states the list view filters expose.
export const SEED_FORWARD_PLAN_ITEMS: SeedForwardPlanItem[] = [
  {
    id: 'fp-draft-housing-fence',
    title: 'Estate fencing replacement programme',
    scheme: 'Walworth estate refresh',
    reportType: 'GW1',
    typeOfEntry: 'New',
    classification: 'Open',
    isHRB: false,
    wards: ['Walworth'],
    value: 280_000,
    targetDecisionDate: '2026-07-15',
    decisionRoute: 'DPB → DCRB',
    routingMode: 'sequential',
    boardGates: {},
    strategicLead: 'Director of Housing',
    reportAuthor: 'Sarah Knowles, Senior PM',
    status: 'Draft',
    softDeleted: false,
    comments: 'Site survey complete — drafting GW1.',
  },
  {
    id: 'fp-published-key-supplies',
    title: 'Building Materials Framework — call-off procurement',
    scheme: 'HRA capital programme 2026/27',
    reportType: 'GW2',
    typeOfEntry: 'New',
    classification: 'Part 1 and 2',
    isHRB: false,
    wards: ['Bermondsey', 'Camberwell', 'Walworth'],
    value: 4_200_000,
    targetDecisionDate: '2026-08-12',
    decisionRoute: 'DPB → DCRB → CCRB → Cabinet',
    routingMode: 'sequential',
    boardGates: {
      // Hard-keyed to seeded body IDs — see frameworkSeed.ts.
      // Server prefixes with `${clientId}_` for the actual lookup.
    },
    strategicLead: 'Strategic Director — Housing',
    reportAuthor: 'Programme Manager · Materials',
    representingOfficer: 'Head of Procurement',
    decisionMaker: 'Cabinet Member · Housing',
    status: 'Published',
    softDeleted: false,
    fileLink: 'https://example.gov.uk/forwardplan/materials-fp.pdf',
    comments: 'Pre-agreed framework; supplier shortlist already vetted.',
    // Phase 5.5b — confirmed slot at the seeded May DPB. The Confirm
    // path appends report.id to meeting.linkedReportIds[].
    meetingId: 'mtg-dpb-2026-05',
    reportId: 'rpt-inreview-materials-gw2',
    approvalStatus: 'Pending',
  },
  {
    id: 'fp-published-non-key-policy',
    title: 'Tenancy Strategy refresh — annual review',
    scheme: 'Strategic Housing Policy',
    reportType: 'CABREP',
    typeOfEntry: 'Change',
    classification: 'Open',
    isHRB: false,
    wards: ['All wards'],
    value: 0,
    targetDecisionDate: '2026-09-30',
    decisionRoute: 'DPB → Cabinet Agenda Setting → Cabinet',
    routingMode: 'sequential',
    boardGates: {},
    strategicLead: 'Director of Housing Strategy',
    reportAuthor: 'Strategy Officer',
    status: 'Published',
    softDeleted: false,
    comments: 'No new spend; policy refresh only.',
  },
  {
    id: 'fp-decided-aspen-court',
    title: 'Aspen Court refurbishment — contract award',
    scheme: 'Aspen Court · Phase 2',
    reportType: 'GW3',
    typeOfEntry: 'New',
    classification: 'Part 1 and 2',
    isHRB: true,
    wards: ['Bermondsey'],
    value: 12_400_000,
    targetDecisionDate: '2026-04-08',
    decisionRoute: 'DPB → DCRB → CCRB → Cabinet → BSB',
    routingMode: 'sequential',
    boardGates: {},
    strategicLead: 'Strategic Director — Housing',
    reportAuthor: 'Programme Manager · Aspen Court',
    representingOfficer: 'Head of Major Works',
    decisionMaker: 'Cabinet',
    status: 'Decided',
    decidedAt: '2026-04-08T14:30:00Z',
    decisionOutcome: 'Approved · award to Galliford Try',
    softDeleted: false,
    decisionLink: 'https://moderngov.example.gov.uk/aspen-court-decision',
    comments: 'HRB Gateway 2 sign-off concurrent with Cabinet approval.',
    approvalStatus: 'Approved',
  },
  {
    // Phase 5.5b/5.5c demo — PM raised this via the Report meeting
    // picker; awaiting PgM Confirm. Renders the rose "pending requests"
    // banner on the FP page so the new flow is visible from first load.
    id: 'fp-proposed-cladding-amendment',
    title: 'Brixton Hill cladding remediation — GW3 amendment',
    scheme: 'Brixton Hill cladding',
    reportType: 'GW3',
    typeOfEntry: 'Change',
    classification: 'Open',
    isHRB: true,
    wards: [],
    value: 0,
    targetDecisionDate: '2026-05-08',
    decisionRoute: '',
    routingMode: 'sequential',
    boardGates: {},
    strategicLead: '',
    reportAuthor: 'PM · Cladding',
    status: 'Proposed',
    softDeleted: false,
    meetingId: 'mtg-dpb-2026-05',
    reportId: 'rpt-amendments-cladding',
    requestedBy: '__seed__', // resolved to ctx.uid in seedToDoc
    comments: 'PM raised via report — awaiting PgM confirmation for May DPB slot.',
  },
  {
    id: 'fp-deleted-merged',
    title: 'Brixton Hill cladding remediation (combined into Phase 1)',
    scheme: 'Brixton Hill cladding',
    reportType: 'GW2',
    typeOfEntry: 'Delete',
    classification: 'Open',
    isHRB: true,
    wards: ['Brixton'],
    value: 1_800_000,
    targetDecisionDate: '2026-06-20',
    decisionRoute: 'DPB → DCRB → BSB → Cabinet',
    routingMode: 'sequential',
    boardGates: {},
    strategicLead: 'Director of Building Safety',
    reportAuthor: 'Programme Manager · Cladding',
    status: 'Draft',
    softDeleted: true,
    deletionReason: 'Combined with the Brixton Hill Phase 1 GW2 to avoid duplicate Cabinet routing.',
    comments: 'See merged item on the published list.',
  },
];

// Server-side helper: applies the council's `clientId` prefix to body IDs
// so seeded boardGates point at the same council's framework bodies.
export function withCouncilPrefixedBodyKeys(
  gates: Record<string, BoardGate>,
  primaryUid: string,
): Record<string, BoardGate> {
  const out: Record<string, BoardGate> = {};
  for (const [key, value] of Object.entries(gates)) {
    out[`${primaryUid}_${key}`] = value;
  }
  return out;
}
