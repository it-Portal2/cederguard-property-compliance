// Client-side Forward Plan types. Mirrors api/lib/forwardPlanSeed.ts.

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

export interface ForwardPlanItem {
  _id: string;
  id: string;
  clientId: string;

  title: string;
  scheme: string;
  reportType: string;
  typeOfEntry: EntryType;
  classification: Classification;
  isHRB: boolean;
  wards: string[];
  value: number;
  targetDecisionDate?: string;
  decisionRoute: string;
  routingMode: RoutingMode;
  boardGates: Record<string, BoardGate>;

  strategicLead: string;
  reportAuthor: string;
  representingOfficer?: string;
  decisionMaker?: string;

  status: ForwardPlanStatus;
  isKeyDecision: boolean;
  decidedAt?: string | null;
  decidedBy?: string | null;
  decisionOutcome?: string | null;

  softDeleted: boolean;
  deletionReason?: string | null;
  deletedAt?: string | null;
  deletedBy?: string | null;

  otherMeetings?: string;
  comments?: string;
  fileLink?: string;
  decisionLink?: string;

  createdAt?: string;
  createdBy?: string;
  updatedAt?: string;
  updatedBy?: string;
  seeded?: boolean;
}

// Status pill chrome — reuses the CedarGuard palette (no violet).
export const STATUS_STYLES: Record<
  ForwardPlanStatus,
  { label: string; cls: string; dot: string }
> = {
  Draft: {
    label: 'Draft',
    cls: 'bg-amber-50 text-amber-700 border-amber-200',
    dot: 'bg-amber-500',
  },
  Published: {
    label: 'Published',
    cls: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    dot: 'bg-indigo-500',
  },
  Decided: {
    label: 'Decided',
    cls: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    dot: 'bg-emerald-500',
  },
  Deferred: {
    label: 'Deferred',
    cls: 'bg-slate-100 text-slate-600 border-slate-200',
    dot: 'bg-slate-400',
  },
  Archived: {
    label: 'Archived',
    cls: 'bg-slate-100 text-slate-600 border-slate-200',
    dot: 'bg-slate-400',
  },
};

export const STATUS_FILTERS: Array<{
  key: 'all' | ForwardPlanStatus | 'softDeleted';
  label: string;
}> = [
  { key: 'all', label: 'All' },
  { key: 'Draft', label: 'Draft' },
  { key: 'Published', label: 'Published' },
  { key: 'Decided', label: 'Decided' },
  { key: 'softDeleted', label: 'Soft-deleted' },
];

export const ENTRY_TYPE_OPTIONS: EntryType[] = ['New', 'Change', 'Delete'];
export const CLASSIFICATION_OPTIONS: Classification[] = [
  'Open',
  'Closed',
  'Part 1 and 2',
];
export const ROUTING_MODE_OPTIONS: Array<{ value: RoutingMode; label: string }> = [
  { value: 'sequential', label: 'Sequential — one board at a time' },
  { value: 'parallel', label: 'Parallel — fan out to all boards' },
];
export const BOARD_GATE_STATUS_OPTIONS: Array<{
  value: BoardGateStatus;
  label: string;
}> = [
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'held', label: 'Held' },
  { value: 'deferred', label: 'Deferred' },
  { value: 'na', label: 'N/A' },
];
