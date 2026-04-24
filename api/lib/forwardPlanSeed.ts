// Forward Plan starter sample — small set covering the variety of states
// users will see in the UI (draft, published, key-decision, decided,
// soft-deleted). Per the user's principle: "seed data is for UI checking,
// production users build everything via CRUD". Kept intentionally small.

export type ForwardPlanStatus =
  | 'Draft'
  | 'Published'
  | 'Decided'
  | 'Deferred'
  | 'Archived';

export type EntryType = 'New' | 'Change' | 'Delete';
export type Classification = 'Open' | 'Closed' | 'Part 1 and 2';
export type RoutingMode = 'sequential' | 'parallel';
export type BoardGateStatus = 'scheduled' | 'held' | 'deferred' | 'na';

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
