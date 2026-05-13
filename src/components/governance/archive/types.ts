// Archive shared types + style maps.

export type ArchiveKind = 'report' | 'meeting' | 'projectDoc';

export interface ArchiveItem {
  kind: ArchiveKind;
  id: string;
  reference: string;
  title: string;
  subtitle: string | null;
  category: string | null;
  decisionDate: string | null;
  status: string;
  isHRB: boolean;
  partClassification: string | null;
  goldenThreadHash: string | null;
  ownerUid: string | null;
  projectId: string | null;
  lastActivityAt: string | null;
  artifactPath: string | null;
}

export interface ArchiveSummary {
  total: number;
  sealedReports: number;
  heldMeetings: number;
  publishedDocs: number;
  hrbCount: number;
}

export interface ArchiveAuditEvent {
  _id: string;
  action?: string;
  actorUid?: string;
  entityType?: string;
  entityId?: string;
  meta?: Record<string, any>;
  createdAt?: string;
  timestamp?: string;
}

export const KIND_STYLES: Record<
  ArchiveKind,
  { pill: string; dot: string; label: string }
> = {
  report: {
    pill: 'bg-indigo-100 text-indigo-800 ring-1 ring-inset ring-indigo-200',
    dot: 'bg-indigo-500',
    label: 'Sealed report',
  },
  meeting: {
    pill: 'bg-emerald-100 text-emerald-800 ring-1 ring-inset ring-emerald-200',
    dot: 'bg-emerald-500',
    label: 'Held meeting',
  },
  projectDoc: {
    pill: 'bg-amber-100 text-amber-800 ring-1 ring-inset ring-amber-200',
    dot: 'bg-amber-500',
    label: 'Published doc',
  },
};
