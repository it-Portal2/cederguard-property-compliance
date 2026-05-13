// Local-authority starter framework seed. Creates a default 4-tier
// structure on a clientId's first visit to /governance/framework. Edits
// and publishing are tracked per-version.

export type BodyTier = 'political' | 'corporate' | 'programme' | 'project';

export interface SeedBody {
  id: string;
  tier: BodyTier;
  name: string;
  cadence: string;
  chair: string;
  authority: string;
  acceptedReportTypes: string[];
  standingItems: string[];
  colorHex: string;
  cabinetMemberPortfolio?: string;
  stepSequence: Array<{
    key: string;
    label: string;
    offsetWorkingDays: number;
    responsibility?: string;
  }>;
}

export interface SeedThreshold {
  id: string;
  bandLabel: string;
  bandMin: number | null;
  bandMax: number | null;
  decisionRoute: string;
  reportTypes: string[];
  notes?: string;
}

// Tier palette aligned with the indigo / slate / emerald / amber / rose
// design system. Violet is intentionally excluded.
export const TIER_COLOURS: Record<BodyTier, string> = {
  political: '#f59e0b', // amber-500
  corporate: '#4f46e5', // indigo-600
  programme: '#10b981', // emerald-500
  project: '#64748b', // slate-500
};

export const TIER_LABEL: Record<BodyTier, string> = {
  political: 'Political',
  corporate: 'Corporate',
  programme: 'Programme',
  project: 'Project',
};

export const TIER_ORDER: BodyTier[] = ['political', 'corporate', 'programme', 'project'];

// Default 10-step per-board workflow offsets relative to the meeting date.
// Used as the seed sequence for Programme and Political tier bodies.
const DEFAULT_STEP_SEQUENCE: SeedBody['stepSequence'] = [
  { key: 'fpSubmission', label: 'Forward Plan Submission Date', offsetWorkingDays: -28, responsibility: 'Programme Manager' },
  { key: 'submissionToSL', label: 'Submission to Strategic Lead', offsetWorkingDays: -20, responsibility: 'Project Manager' },
  { key: 'concurrentComments', label: 'Concurrent Comments', offsetWorkingDays: -15, responsibility: 'S151 / MO' },
  { key: 'sdApproval', label: 'SD / ZD Approval', offsetWorkingDays: -10, responsibility: 'Strategic Director' },
  { key: 'paperSubmission', label: 'Submission of Papers', offsetWorkingDays: -5, responsibility: 'Programme Manager' },
  { key: 'cmtDeadline', label: 'CMT Paper Deadline', offsetWorkingDays: -3, responsibility: 'Corporate Support' },
  { key: 'cmtSignOff', label: 'CMT Sign Off', offsetWorkingDays: -2, responsibility: 'CMT' },
  { key: 'agendaPlanning', label: 'Agenda Planning', offsetWorkingDays: -1, responsibility: 'Democratic Services' },
  { key: 'meetingDate', label: 'Meeting Date', offsetWorkingDays: 0, responsibility: 'Chair' },
  { key: 'decisionOutput', label: 'Decision Output', offsetWorkingDays: 1, responsibility: 'Democratic Services' },
];

// 17 bodies total — 2 political, 2 corporate, 10 programme, 3 project.
// Matches Round 5 Q3 scope (15 prototype + 2 portfolio-split LMBs).
export const SEED_BODIES: SeedBody[] = [
  // ── Political
  {
    id: 'cabinet',
    tier: 'political',
    name: 'Cabinet',
    cadence: 'Monthly',
    chair: 'Leader of the Council',
    authority: 'Executive decisions and key decisions over £500k.',
    acceptedReportTypes: ['Cabinet Report', 'Gateway 2', 'Gateway 3', 'Key Milestone 4'],
    standingItems: ['Minutes of previous Cabinet', 'Forward Plan Update'],
    colorHex: TIER_COLOURS.political,
    stepSequence: DEFAULT_STEP_SEQUENCE,
  },
  {
    id: 'council-assembly',
    tier: 'political',
    name: 'Council Assembly',
    cadence: 'Quarterly',
    chair: 'Speaker of the Council',
    authority: 'Budget sign-off, constitutional matters, full-council business.',
    acceptedReportTypes: ['Budget Report', 'Strategic Report'],
    standingItems: ['Minutes', 'Member questions', 'Petitions'],
    colorHex: TIER_COLOURS.political,
    stepSequence: DEFAULT_STEP_SEQUENCE,
  },

  // ── Corporate
  {
    id: 'cmt',
    tier: 'corporate',
    name: 'CMT · Corporate Management Team',
    cadence: 'Weekly',
    chair: 'Chief Executive',
    authority: 'Corporate programme oversight, pre-Cabinet scrutiny.',
    acceptedReportTypes: ['All gateway reports', 'Cabinet Report', 'Risk & Assurance'],
    standingItems: ['Programme status', 'Risk register', 'Forward Plan'],
    colorHex: TIER_COLOURS.corporate,
    stepSequence: DEFAULT_STEP_SEQUENCE,
  },
  {
    id: 'ccrb',
    tier: 'corporate',
    name: 'CCRB · Corporate Contracts Review Board',
    cadence: 'Monthly',
    chair: 'Director of Commercial',
    authority: 'Review of contracts above £500k before Cabinet approval.',
    acceptedReportTypes: ['Gateway 1', 'Gateway 2', 'Gateway 3'],
    standingItems: ['Contract pipeline', 'Procurement exceptions'],
    colorHex: TIER_COLOURS.corporate,
    stepSequence: DEFAULT_STEP_SEQUENCE,
  },

  // ── Programme
  {
    id: 'dpb',
    tier: 'programme',
    name: 'DPB · Departmental Programme Board',
    cadence: 'Weekly',
    chair: 'Strategic Director',
    authority: 'Departmental programme oversight; decisions up to £500k.',
    acceptedReportTypes: ['Gateway 1', 'Gateway 2', 'Key Milestone 1–6'],
    standingItems: ['Programme dashboard', 'Risk & issues', 'Budget tracker'],
    colorHex: TIER_COLOURS.programme,
    stepSequence: DEFAULT_STEP_SEQUENCE,
  },
  {
    id: 'dcrb',
    tier: 'programme',
    name: 'DCRB · Departmental Contracts Review Board',
    cadence: 'Monthly',
    chair: 'Head of Commercial',
    authority: 'Departmental contract review (£100k–£500k).',
    acceptedReportTypes: ['Gateway 1', 'Gateway 2'],
    standingItems: ['Contract pipeline', 'Award decisions'],
    colorHex: TIER_COLOURS.programme,
    stepSequence: DEFAULT_STEP_SEQUENCE,
  },
  {
    id: 'housing-smt',
    tier: 'programme',
    name: 'Housing SMT · Senior Management Team',
    cadence: 'Weekly',
    chair: 'Director of Housing',
    authority: 'Housing directorate programme review.',
    acceptedReportTypes: ['Key Milestone 1–6', 'HRB Gateway Reports'],
    standingItems: ['KPIs', 'Portfolio RAG', 'Residents engagement'],
    colorHex: TIER_COLOURS.programme,
    stepSequence: DEFAULT_STEP_SEQUENCE,
  },
  {
    id: 'hra-budget-board',
    tier: 'programme',
    name: 'HRA Budget Recovery Board',
    cadence: 'Quarterly',
    chair: 'Section 151 Officer',
    authority: 'Housing Revenue Account budget recovery oversight.',
    acceptedReportTypes: ['Finance Report', 'Gateway 2', 'Gateway 3'],
    standingItems: ['HRA forecast', 'Recovery milestones'],
    colorHex: TIER_COLOURS.programme,
    stepSequence: DEFAULT_STEP_SEQUENCE,
  },
  {
    id: 'bsb',
    tier: 'programme',
    name: 'BSB · Building Safety Board',
    cadence: 'Monthly',
    chair: 'Director of Building Safety',
    authority: 'Mandatory for all HRB-flagged works per BSA 2022.',
    acceptedReportTypes: ['Gateway 2', 'Gateway 3', 'Golden Thread Entry'],
    standingItems: ['HRB register', 'Golden Thread log', 'Resident safety case'],
    colorHex: TIER_COLOURS.programme,
    stepSequence: DEFAULT_STEP_SEQUENCE,
  },
  {
    id: 'lmb-homes-homelessness',
    tier: 'programme',
    name: 'LMB · Council Homes & Homelessness',
    cadence: 'Monthly',
    chair: 'Cllr Merrill',
    authority: 'Member-level brief on Council Homes + Homelessness portfolio.',
    acceptedReportTypes: ['Cabinet Member Decision', 'Key Milestone'],
    standingItems: ['Portfolio brief', 'Casework', 'Community feedback'],
    colorHex: TIER_COLOURS.programme,
    cabinetMemberPortfolio: 'Council Homes & Homelessness',
    stepSequence: DEFAULT_STEP_SEQUENCE,
  },
  {
    id: 'lmb-new-homes',
    tier: 'programme',
    name: 'LMB · New Homes & Sustainability',
    cadence: 'Monthly',
    chair: 'Cllr Dennis',
    authority: 'Member-level brief on New Homes + Sustainability portfolio.',
    acceptedReportTypes: ['Cabinet Member Decision', 'Gateway 2', 'Gateway 3'],
    standingItems: ['Portfolio brief', 'Delivery pipeline'],
    colorHex: TIER_COLOURS.programme,
    cabinetMemberPortfolio: 'New Homes & Sustainability',
    stepSequence: DEFAULT_STEP_SEQUENCE,
  },
  {
    id: 'idm',
    tier: 'programme',
    name: 'IDM · Individual Decision Maker',
    cadence: 'As needed',
    chair: 'Delegated Officer',
    authority: 'Officer decisions under delegated authority (≤£100k).',
    acceptedReportTypes: ['Officer Decision', 'Gateway 1'],
    standingItems: [],
    colorHex: TIER_COLOURS.programme,
    stepSequence: DEFAULT_STEP_SEQUENCE,
  },
  {
    id: 'cabinet-agenda-setting',
    tier: 'programme',
    name: 'Cabinet Agenda Setting',
    cadence: 'Weekly',
    chair: 'Chief Executive',
    authority: 'Finalise Cabinet agenda one week before meeting.',
    acceptedReportTypes: ['Cabinet Report'],
    standingItems: ['Agenda draft', 'Paper sign-off'],
    colorHex: TIER_COLOURS.programme,
    stepSequence: DEFAULT_STEP_SEQUENCE,
  },

  // ── Project
  {
    id: 'project-sponsor-board',
    tier: 'project',
    name: 'Project Sponsor Board',
    cadence: 'Monthly',
    chair: 'Senior Responsible Owner',
    authority: 'Project-level oversight; approvals within programme envelope.',
    acceptedReportTypes: ['Gateway 1', 'Key Milestone 1–6'],
    standingItems: ['Project RAG', 'Risk register', 'Action tracker'],
    colorHex: TIER_COLOURS.project,
    stepSequence: [],
  },
  {
    id: 'working-group',
    tier: 'project',
    name: 'Working Group',
    cadence: 'Ad-hoc',
    chair: 'Project Manager',
    authority: 'Task-and-finish working group for delivery workstreams.',
    acceptedReportTypes: ['Workstream Update', 'Technical Paper'],
    standingItems: [],
    colorHex: TIER_COLOURS.project,
    stepSequence: [],
  },
  {
    id: 'user-consultation',
    tier: 'project',
    name: 'User Consultation',
    cadence: 'Ad-hoc',
    chair: 'Communications Lead',
    authority: 'Resident / user-facing consultation and feedback capture.',
    acceptedReportTypes: ['Consultation Summary', 'ENIA'],
    standingItems: [],
    colorHex: TIER_COLOURS.project,
    stepSequence: [],
  },
];

export const SEED_THRESHOLDS: SeedThreshold[] = [
  {
    id: 'band-1',
    bandLabel: 'Up to £100,000',
    bandMin: 0,
    bandMax: 100_000,
    decisionRoute: 'IDM · Officer delegated',
    reportTypes: ['Officer Decision'],
    notes: 'Delegated to named officers per scheme of delegation.',
  },
  {
    id: 'band-2',
    bandLabel: '£100,001 – £500,000',
    bandMin: 100_001,
    bandMax: 500_000,
    decisionRoute: 'DPB → DCRB',
    reportTypes: ['Gateway 1', 'Gateway 2'],
    notes: 'Departmental route; no Cabinet required unless key-decision triggered.',
  },
  {
    id: 'band-3',
    bandLabel: '£500,001 – £5,000,000',
    bandMin: 500_001,
    bandMax: 5_000_000,
    decisionRoute: 'DPB → DCRB → CCRB → Cabinet',
    reportTypes: ['Gateway 2', 'Gateway 3', 'Cabinet Report'],
    notes: 'Automatic key decision; published 28 days before Cabinet.',
  },
  {
    id: 'band-4',
    bandLabel: 'Over £5,000,000',
    bandMin: 5_000_001,
    bandMax: null,
    decisionRoute: 'DPB → DCRB → CCRB → Cabinet → Council Assembly',
    reportTypes: ['Gateway 2', 'Gateway 3', 'Cabinet Report', 'Budget Report'],
    notes: 'Major scheme; full assembly approval required.',
  },
  {
    id: 'band-hrb',
    bandLabel: 'HRB-flagged (any value)',
    bandMin: null,
    bandMax: null,
    decisionRoute: 'Standard route + Building Safety Board',
    reportTypes: ['Gateway 2', 'Gateway 3', 'Golden Thread Entry'],
    notes: 'High-Risk Building per BSA 2022. Always routes through BSB in addition to the value-banded route.',
  },
];

export const SEED_TIERS: Array<{ key: BodyTier; label: string }> = TIER_ORDER.map((t) => ({
  key: t,
  label: TIER_LABEL[t],
}));
