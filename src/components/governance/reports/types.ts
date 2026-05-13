// Client-side Report types. Mirrors api/lib/reportsSeed.ts.

export type ReportStatus =
  | 'Draft'
  | 'PendingSeniorPmReview'
  | 'InReview'
  | 'AmendmentsRequested'
  | 'Approved'
  | 'Sealed'
  | 'Withdrawn'
  | 'Abandoned';

export type Classification = 'Open' | 'Closed' | 'Part 1 and 2';

export interface Report {
  _id: string;
  id: string;
  clientId: string;

  title: string;
  scheme: string;
  templateId: string | null;
  templateLabel: string;
  forwardPlanItemId: string | null;
  forwardPlanItemLabel: string;

  status: ReportStatus;
  ownerUid: string;
  ownerLabel: string;
  reviewerUid: string | null;
  reviewerLabel: string | null;

  partClassification: Classification;
  isHRB: boolean;
  targetBoardDate: string | null;
  // additive meeting reference. Replaces (functionally)
  // the legacy `targetBoardDate` string for new reports. Both kept
  // for back-compat (ADD-never-MODIFY).
  targetMeetingId?: string | null;

  softDeleted: boolean;
  deletionReason: string | null;
  deletedAt: string | null;
  deletedBy: string | null;

  submittedAt: string | null;
  submittedBy?: string | null;
  firstViewedByPgmAt?: string | null;
  firstViewedByPgmUid?: string | null;
  firstViewedBySpmAt?: string | null;
  firstViewedBySpmUid?: string | null;
  seniorPmApprovedAt?: string | null;
  seniorPmApprovedBy?: string | null;
  amendmentsRequestedAt?: string | null;
  amendmentsRequestedBy?: string | null;
  /** Append-only audit of every Sealed → Drafting unlock. Each entry has
   *  { at, by, reason, previousSealedAt?, previousSealedBy?, previousSealedPdfPath? }.*/
  unlockHistory?: Array<{
    at: string;
    by: string;
    reason: string;
    previousSealedAt?: string | null;
    previousSealedBy?: string | null;
    previousSealedPdfPath?: string | null;
  }>;
  approvedAt: string | null;
  approvedBy?: string | null;
  sealedAt: string | null;
  sealedBy?: string | null;
  sealedPdfPath?: string | null;
  sealedPdfUrl?: string | null;
  abandonedAt: string | null;
  abandonedBy?: string | null;
  abandonmentReason: string | null;

  createdAt?: string;
  createdBy?: string;
  updatedAt?: string;
  updatedBy?: string;
  seeded?: boolean;
}

// Status pill chrome — reuses the CedarGuard palette (no violet).
export const STATUS_STYLES: Record<
  ReportStatus,
  { label: string; cls: string; dot: string }
> = {
  Draft: {
    label: 'Draft',
    cls: 'bg-amber-50 text-amber-700 border-amber-200',
    dot: 'bg-amber-500',
  },
  PendingSeniorPmReview: {
    label: 'Senior PM review',
    cls: 'bg-sky-50 text-sky-700 border-sky-200',
    dot: 'bg-sky-500',
  },
  InReview: {
    label: 'In review',
    cls: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    dot: 'bg-indigo-500',
  },
  AmendmentsRequested: {
    label: 'Amendments',
    cls: 'bg-rose-50 text-rose-700 border-rose-200',
    dot: 'bg-rose-500',
  },
  Approved: {
    label: 'Approved',
    cls: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    dot: 'bg-emerald-500',
  },
  Sealed: {
    label: 'Sealed',
    cls: 'bg-emerald-100 text-emerald-800 border-emerald-300',
    dot: 'bg-emerald-700',
  },
  Withdrawn: {
    label: 'Withdrawn',
    cls: 'bg-slate-100 text-slate-600 border-slate-200',
    dot: 'bg-slate-400',
  },
  Abandoned: {
    label: 'Abandoned',
    cls: 'bg-slate-100 text-slate-600 border-slate-200',
    dot: 'bg-slate-400',
  },
};

export const CLASSIFICATION_OPTIONS: Classification[] = [
  'Open',
  'Closed',
  'Part 1 and 2',
];

// Amendment doc (top-level `amendments` collection).
export interface Amendment {
  _id: string;
  clientId: string;
  reportId: string;
  sectionId: string | null;
  text: string;
  status: 'open' | 'addressed' | 'resolved';
  authorUid: string;
  createdAt: string;
  resolvedAt: string | null;
  resolvedBy: string | null;
}

// Report section sub-doc.
export interface ReportSection {
  _id: string;
  sectionId: string;
  order: number;
  name: string;
  guidance: string;
  mandatory: boolean;
  statutory: boolean;
  aiDraftAllowed: boolean;
  complianceCheck: boolean;
  /** Tiptap JSON document.*/
  content: any;
  wordCount: number;
  lastEditedAt: string | null;
  lastEditedBy: string | null;
  createdAt?: string;
  createdBy?: string;
}
