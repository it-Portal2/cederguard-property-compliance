// Meetings CRUD shell.
// Storage: `meetings/{clientId_meetingId}`. Seed runs on
// first list-call so PgMs see real data immediately. 8b adds tabs +
// state transitions; 8a is title / body / date / time / location /
// chair / attendees / agenda + soft-delete.

export type MeetingStatus = 'Scheduled' | 'Held' | 'Cancelled';

export const ALL_MEETING_STATUSES: MeetingStatus[] = [
  'Scheduled',
  'Held',
  'Cancelled',
];

export interface SeedAttendee {
  uid: string | null;
  label: string;
}

export interface SeedMeeting {
  id: string;
  title: string;
  governanceBodyId: string | null;
  governanceBodyLabel: string;
  date: string; // ISO yyyy-mm-dd
  timeStart: string; // HH:mm
  timeEnd: string; // HH:mm
  location: string;
  chairUid: string | null;
  chairLabel: string;
  status: MeetingStatus;
  attendees: SeedAttendee[];
  /** One bullet per agenda item — markdown not required in 8a.*/
  agenda: string[];
  softDeleted: boolean;
  deletionReason?: string | null;
}

// Three sample meetings spanning every status so the filter chrome is
// visually verifiable from first load.
export const SEED_MEETINGS: SeedMeeting[] = [
  {
    id: 'mtg-dpb-2026-05',
    title: 'DPB · May 2026',
    governanceBodyId: 'dpb',
    governanceBodyLabel: 'DPB · Departmental Project Board',
    date: '2026-05-08',
    timeStart: '10:00',
    timeEnd: '12:00',
    location: 'Tooley Street · Room 4.12',
    chairUid: null,
    chairLabel: 'Strategic Director · Housing',
    status: 'Scheduled',
    attendees: [
      { uid: null, label: 'PgM · Walworth estates' },
      { uid: null, label: 'PM · Cladding' },
      { uid: null, label: 'S151 Officer' },
    ],
    agenda: [
      'Aspen Court KM4 — recommendations',
      'Walworth Block A — GW2 status',
      'Risk register · top 5 changes',
    ],
    softDeleted: false,
  },
  {
    id: 'mtg-ccrb-2026-04',
    title: 'CCRB · April 2026',
    governanceBodyId: 'ccrb',
    governanceBodyLabel: 'CCRB · Corporate Contracts Review Board',
    date: '2026-04-22',
    timeStart: '14:00',
    timeEnd: '16:00',
    location: 'Tooley Street · Room 3.04',
    chairUid: null,
    chairLabel: 'Director of Procurement',
    status: 'Held',
    attendees: [
      { uid: null, label: 'PgM · Strategic Housing' },
      { uid: null, label: 'PM · Materials' },
      { uid: null, label: 'Monitoring Officer' },
    ],
    agenda: [
      'Materials framework refresh',
      'KM3 award decision',
      'AOB',
    ],
    softDeleted: false,
  },
  {
    id: 'mtg-cmt-2026-03-cancelled',
    title: 'CMT · March 2026 (cancelled)',
    governanceBodyId: 'cmt',
    governanceBodyLabel: 'CMT · Corporate Management Team',
    date: '2026-03-19',
    timeStart: '09:00',
    timeEnd: '11:00',
    location: 'Tooley Street · Boardroom',
    chairUid: null,
    chairLabel: 'Chief Executive',
    status: 'Cancelled',
    attendees: [
      { uid: null, label: 'PgM · Walworth estates' },
    ],
    agenda: ['Quarterly review · deferred to April'],
    softDeleted: false,
  },
];
