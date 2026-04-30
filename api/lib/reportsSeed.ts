// Reports starter sample — small set covering the variety of states users
// will see in the list view (Draft, In Review, Approved, Sealed,
// soft-deleted). Per the user's principle: "seed data is for UI checking;
// production users build everything via CRUD". Kept intentionally small.

export type ReportStatus =
  | 'Draft'
  | 'PendingSeniorPmReview'
  | 'InReview'
  | 'AmendmentsRequested'
  | 'Approved'
  | 'Sealed'
  | 'Withdrawn'
  | 'Abandoned';

export interface SeedReport {
  id: string;
  title: string;
  /** Real seeded template short id (e.g. 'gw1', 'gw2'). Server prefixes
   *  with `${clientId}_` when reading the templates collection. */
  templateId: string;
  /** Display label — usually `${code} · ${title}` of the linked template. */
  templateLabel: string;
  /** Real seeded FP item short id (e.g. 'fp-published-key-supplies'). */
  forwardPlanItemId: string;
  /** Display label — usually the FP item's title. */
  forwardPlanItemLabel: string;
  status: ReportStatus;
  ownerLabel: string;
  reviewerLabel?: string;
  partClassification: 'Open' | 'Closed' | 'Part 1 and 2';
  isHRB: boolean;
  targetBoardDate?: string;
  // Phase 5.5b — optional meeting reference. When set, the report's
  // "next board date" derives from `meetings/{id}.date` and an FP item
  // auto-gets created/updated as `Proposed`. Required at Submit-for-
  // Review time per Q18; optional at Draft.
  targetMeetingId?: string | null;
  /** Free-text scheme name surfaced in the list. */
  scheme: string;
  softDeleted: boolean;
  deletionReason?: string;
}

// Seed reports link to the real seeded templates (api/lib/templateSeed.ts:
// gw1, gw2, gw3, km4, cabrep) and real seeded FP items
// (api/lib/forwardPlanSeed.ts: fp-draft-housing-fence, fp-published-key-supplies,
// etc.). When a fresh workspace is seeded these IDs resolve correctly and
// the lazy section-instantiation in governanceListReportSections kicks in
// on first open of the editor.
export const SEED_REPORTS: SeedReport[] = [
  {
    id: 'rpt-draft-housing-fence',
    title: 'Estate fencing replacement programme — GW1',
    templateId: 'gw1',
    templateLabel: 'GW1 · Strategic outline case',
    forwardPlanItemId: 'fp-draft-housing-fence',
    forwardPlanItemLabel: 'Estate fencing replacement programme',
    status: 'Draft',
    ownerLabel: 'PM · Walworth estates',
    partClassification: 'Open',
    isHRB: false,
    targetBoardDate: '2026-06-15',
    scheme: 'Walworth estate refresh',
    softDeleted: false,
  },
  {
    id: 'rpt-inreview-materials-gw2',
    title: 'Building Materials Framework — GW2 contract award',
    templateId: 'gw2',
    templateLabel: 'GW2 · Award recommendation',
    forwardPlanItemId: 'fp-published-key-supplies',
    forwardPlanItemLabel: 'Building Materials Framework — call-off procurement',
    status: 'InReview',
    ownerLabel: 'PM · Materials',
    reviewerLabel: 'Programme Manager — Construction',
    partClassification: 'Part 1 and 2',
    isHRB: false,
    targetBoardDate: '2026-08-12',
    scheme: 'HRA capital programme 2026/27',
    softDeleted: false,
  },
  {
    id: 'rpt-amendments-cladding',
    title: 'Brixton Hill cladding remediation — GW3 amendment',
    templateId: 'gw3',
    templateLabel: 'GW3 · Variation report',
    // No matching FP item in the seed — leaves both empty so the picker
    // surfaces the user to add a real one. Demonstrates the genuine
    // unlinked case for the amber hint.
    forwardPlanItemId: '',
    forwardPlanItemLabel: '',
    status: 'AmendmentsRequested',
    ownerLabel: 'PM · Cladding',
    reviewerLabel: 'Programme Manager — Building Safety',
    partClassification: 'Open',
    isHRB: true,
    targetBoardDate: '2026-07-22',
    scheme: 'Brixton Hill cladding',
    softDeleted: false,
  },
  {
    id: 'rpt-approved-aspen',
    title: 'Aspen Court refurbishment — KM4 mid-stage report',
    templateId: 'km4',
    templateLabel: 'KM4 · Mid-stage milestone',
    forwardPlanItemId: 'fp-decided-aspen-court',
    forwardPlanItemLabel: 'Aspen Court refurbishment — contract award',
    status: 'Approved',
    ownerLabel: 'PM · Refurb',
    reviewerLabel: 'Programme Manager — Construction',
    partClassification: 'Open',
    isHRB: false,
    targetBoardDate: '2026-04-22',
    scheme: 'Aspen Court · Phase 2',
    softDeleted: false,
  },
  {
    id: 'rpt-soft-deleted-tenancy',
    title: 'Tenancy Strategy refresh — superseded draft',
    templateId: 'cabrep',
    templateLabel: 'CABREP · Cabinet paper (general)',
    forwardPlanItemId: 'fp-published-non-key-policy',
    forwardPlanItemLabel: 'Tenancy Strategy refresh — annual review',
    status: 'Draft',
    ownerLabel: 'PM · Strategic Housing',
    partClassification: 'Open',
    isHRB: false,
    scheme: 'Strategic Housing Policy',
    softDeleted: true,
    deletionReason: 'Combined into the new annual review template; was a duplicate.',
  },
];
