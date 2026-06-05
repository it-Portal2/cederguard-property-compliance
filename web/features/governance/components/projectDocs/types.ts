// Project Governance Folder shared types + style maps.

export type ProjectDocStatus = 'Draft' | 'Published' | 'Archived';

export type ProjectDocCategory =
  | 'DecisionLog'
  | 'ToRAcknowledgement'
  | 'MeetingNote'
  | 'ChangeRecord'
  | 'Other';

export interface ProjectDocVersion {
  _id?: string;
  version: number;
  title: string;
  category: ProjectDocCategory;
  summary: string;
  content: any | null;
  linkedReportId?: string | null;
  linkedMeetingId?: string | null;
  publishedAt: string;
  publishedBy: string;
}

export interface ProjectDoc {
  _id?: string;
  id: string;
  clientId: string;
  projectId: string;
  title: string;
  category: ProjectDocCategory;
  summary: string;
  content: any | null;
  status: ProjectDocStatus;
  version: number;
  linkedReportId?: string | null;
  linkedMeetingId?: string | null;
  ownerUid: string;
  softDeleted: boolean;
  deletionReason?: string | null;
  deletedAt?: string | null;
  deletedBy?: string | null;
  publishedAt?: string | null;
  publishedBy?: string | null;
  createdAt: string;
  createdBy: string;
  updatedAt: string;
  updatedBy: string;
  seeded?: boolean;
}

export const STATUS_STYLES: Record<
  ProjectDocStatus,
  { pill: string; dot: string; label: string }
> = {
  Draft: {
    pill: 'bg-amber-100 text-amber-800 ring-1 ring-inset ring-amber-200',
    dot: 'bg-amber-500',
    label: 'Draft',
  },
  Published: {
    pill: 'bg-emerald-100 text-emerald-800 ring-1 ring-inset ring-emerald-200',
    dot: 'bg-emerald-500',
    label: 'Published',
  },
  Archived: {
    pill: 'bg-slate-100 text-slate-700 ring-1 ring-inset ring-slate-200',
    dot: 'bg-slate-400',
    label: 'Archived',
  },
};

export const CATEGORY_LABEL: Record<ProjectDocCategory, string> = {
  DecisionLog: 'Decision log',
  ToRAcknowledgement: 'ToR acknowledgement',
  MeetingNote: 'Meeting note',
  ChangeRecord: 'Change record',
  Other: 'Other',
};

export const CATEGORY_OPTIONS: { value: ProjectDocCategory; label: string }[] = [
  { value: 'DecisionLog', label: 'Decision log' },
  { value: 'ToRAcknowledgement', label: 'ToR acknowledgement' },
  { value: 'MeetingNote', label: 'Meeting note' },
  { value: 'ChangeRecord', label: 'Change record' },
  { value: 'Other', label: 'Other' },
];

export function makeProjectDocId(title: string): string {
  const slug =
    (title || 'doc')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'doc';
  const suffix = (Date.now() % 1_000_000).toString(36);
  return `pgd-${slug}-${suffix}`;
}
