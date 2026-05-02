// Phase 9 — Project Governance Folder.
//
// Per-project versioned governance docs (decision logs, ToR
// acknowledgements, meeting attendance notes, etc.). Each doc lives in
// `projectGovernanceDocs/{clientId_docId}` (lesson #10) and carries
// optional cross-references to a Report and/or Meeting.
//
// State machine:  Draft → Published (version++) → optionally
//                 superseded by a new Draft → Published v2 → ...
//                 Draft + Published can both be soft-deleted; restore
//                 via the same endpoint with `restore: true`.
//
// Versioning: every Publish snapshots the doc into a sub-collection
// `projectGovernanceDocs/{clientId_docId}/versions/{n}` (transactional).

export type ProjectDocStatus = 'Draft' | 'Published' | 'Archived';

export const ALL_PROJECT_DOC_STATUSES: ProjectDocStatus[] = [
  'Draft',
  'Published',
  'Archived',
];

export type ProjectDocCategory =
  | 'DecisionLog'
  | 'ToRAcknowledgement'
  | 'MeetingNote'
  | 'ChangeRecord'
  | 'Other';

export const ALL_PROJECT_DOC_CATEGORIES: ProjectDocCategory[] = [
  'DecisionLog',
  'ToRAcknowledgement',
  'MeetingNote',
  'ChangeRecord',
  'Other',
];

export interface SeedProjectDoc {
  id: string;
  projectId: string;
  title: string;
  category: ProjectDocCategory;
  summary: string;
  /** Tiptap JSON. Null → editor will start from a placeholder. */
  content: any | null;
  status: ProjectDocStatus;
  version: number;
  linkedReportId?: string | null;
  linkedMeetingId?: string | null;
}

// Two seeds so the table has visible content on first load. Tied to
// the same Aspen Court project ID seeded by Phase 6/8 so cross-links
// look real. If the workspace doesn't have that project, the docs
// still render — projectId is just a string filter.
export const SEED_PROJECT_DOCS: SeedProjectDoc[] = [
  {
    id: 'pgd-aspen-tor-ack',
    projectId: 'demo-aspen-court',
    title: 'Aspen Court · DPB Terms of Reference acknowledgement',
    category: 'ToRAcknowledgement',
    summary:
      'PM acknowledges the DPB Terms of Reference v3 published 14 March 2026 and confirms reporting cadence for Aspen Court.',
    content: null,
    status: 'Published',
    version: 1,
    linkedReportId: null,
    linkedMeetingId: 'mtg-dpb-2026-05',
  },
  {
    id: 'pgd-aspen-decision-log',
    projectId: 'demo-aspen-court',
    title: 'Aspen Court · Decision log v1 (Q1 2026)',
    category: 'DecisionLog',
    summary:
      'Captures the cladding works key decision routed via DPB → CCRB on 8 May 2026.',
    content: null,
    status: 'Draft',
    version: 0,
    linkedReportId: 'rpt-aspen-km4',
    linkedMeetingId: null,
  },
];
