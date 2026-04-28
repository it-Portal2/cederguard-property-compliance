// Phase 8a — client-side meeting types. Mirrors api/lib/meetingsSeed.ts.

export type MeetingStatus = 'Scheduled' | 'Held' | 'Cancelled';

export interface Attendee {
  uid: string | null;
  label: string;
  // Optional metadata — populated for both workspace members (uid set)
  // and external attendees (uid null). Backwards-compatible: legacy
  // attendees with only `{uid, label}` continue to render correctly.
  email?: string | null;
  role?: string | null;
}

export interface MeetingMinutes {
  content: any | null;
  wordCount: number;
  lastEditedAt: string | null;
  lastEditedBy: string | null;
}

export interface MeetingDecision {
  id: string;
  text: string;
  takenAt: string;
  takenBy: string;
}

export type ActionItemStatus = 'open' | 'done';

export interface MeetingActionItem {
  id: string;
  text: string;
  ownerUid: string | null;
  ownerLabel: string;
  dueDate: string | null;
  status: ActionItemStatus;
  createdAt: string;
  createdBy: string;
  resolvedAt: string | null;
  resolvedBy: string | null;
}

export interface Meeting {
  _id: string;
  id: string;
  clientId: string;

  title: string;
  governanceBodyId: string | null;
  governanceBodyLabel: string;
  date: string;
  timeStart: string;
  timeEnd: string;
  location: string;
  chairUid: string | null;
  chairLabel: string;

  status: MeetingStatus;
  attendees: Attendee[];
  agenda: string[];

  // Phase 8b
  minutes?: MeetingMinutes;
  decisions?: MeetingDecision[];
  actionItems?: MeetingActionItem[];
  linkedReportIds?: string[];
  linkedProjectIds?: string[];

  ownerUid: string;

  softDeleted: boolean;
  deletionReason: string | null;
  deletedAt: string | null;
  deletedBy: string | null;

  heldAt: string | null;
  heldBy: string | null;
  cancelledAt: string | null;
  cancelledBy: string | null;
  cancellationReason: string | null;

  createdAt: string;
  createdBy: string;
  updatedAt: string;
  updatedBy: string;
  seeded?: boolean;
}

export const STATUS_STYLES: Record<
  MeetingStatus,
  { label: string; cls: string; dot: string }
> = {
  Scheduled: {
    label: 'Scheduled',
    cls: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    dot: 'bg-indigo-500',
  },
  Held: {
    label: 'Held',
    cls: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    dot: 'bg-emerald-500',
  },
  Cancelled: {
    label: 'Cancelled',
    cls: 'bg-slate-100 text-slate-600 border-slate-200',
    dot: 'bg-slate-400',
  },
};
