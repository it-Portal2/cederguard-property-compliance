// Historical Reporting Capability (HRC) — shared types.
//
// Two distinct shapes are stored on the server depending on the source
// collection:
//   1. Legacy collections (risks, complianceItems, issues, kris) live as a
//      single array-doc at projects/{projectId}/data/{collection}.
//      → Snapshot / history rows store the WHOLE array.
//   2. Governance collections (forwardPlanItems, meetings, reports,
//      projectGovernanceDocs, framework, templates, tors) are top-level
//      per-doc collections.
//      → Snapshot / history rows store individual docs.
//
// Both shapes share the same wrapper types defined here so the UI can
// branch off `kind` rather than duplicating logic.

export const HRC_LEGACY_COLLECTIONS = [
  "risks",
  "complianceItems",
  "issues",
  "kris",
] as const;
export type LegacyCollection = (typeof HRC_LEGACY_COLLECTIONS)[number];

export const HRC_GOVERNANCE_COLLECTIONS = [
  "forwardPlanItems",
  "meetings",
  "reports",
  "projectGovernanceDocs",
  "framework",
  "templates",
  "tors",
] as const;
export type GovernanceCollection = (typeof HRC_GOVERNANCE_COLLECTIONS)[number];

export type HrcCollection = LegacyCollection | GovernanceCollection;

export const HRC_ALL_COLLECTIONS: ReadonlyArray<HrcCollection> = [
  ...HRC_LEGACY_COLLECTIONS,
  ...HRC_GOVERNANCE_COLLECTIONS,
];

// `YYYY-MM` — the calendar month a snapshot represents.
export type YearMonth = string;

// ISO date-time string at the last instant of the month, in UK time.
// Example: "2026-05-31T23:59:59.999+01:00".
export type MonthEndIso = string;

// Parent doc on `monthlySnapshots/{clientId}_{YYYY-MM}`.
export interface MonthlySnapshotMeta {
  clientId: string;
  yearMonth: YearMonth;
  monthEndIso: MonthEndIso;
  generatedAt: string;
  generatedBy: "cron" | string;          // uid when manually triggered
  retentionUntil: string;                // ISO date — purge gate
  isHrbWorkspace: boolean;               // drives 25y vs 7y
  collectionsCovered: HrcCollection[];
  anyCorrected: boolean;                 // flips true on first super_admin edit
}

// Sub-collection rows live at:
//   monthlySnapshots/{clientId}_{YYYY-MM}/{collection}/{docId}
// where the docId scheme depends on the collection's at-rest shape.

export interface LegacyArraySnapshot<T = any> {
  kind: "legacyArray";
  collection: LegacyCollection;
  projectId: string;                     // legacy docs are scoped per project
  array: T[];                            // the whole array as it was at month-end
  itemCount: number;                     // mirror of array.length, kept for cheap counts
  capturedAt: string;
}

export interface GovernanceDocSnapshot<T = any> {
  kind: "governanceDoc";
  collection: GovernanceCollection;
  docId: string;                         // original top-level doc id
  doc: T;                                // frozen doc state at month-end
  capturedAt: string;
}

export type SnapshotEntry<T = any> =
  | LegacyArraySnapshot<T>
  | GovernanceDocSnapshot<T>;

// Field-level history rows for entities that mutate in place. Lives in
// per-collection History collections so we can answer arbitrary point-
// in-time queries (e.g. "state of risks at 14 May 10:00").
export type ChangeKind = "create" | "update" | "softDelete" | "restore" | "snapshot";

export interface HistoryRow<T = any> {
  id: string;                            // composite: `{clientId}_{ownerScope}_{ts}`
  clientId: string;
  /**
   * For LEGACY collections: ownerScope === projectId, and `prevState` /
   * `newState` are the WHOLE array. For GOVERNANCE collections:
   * ownerScope === docId, and `prevState` / `newState` are that single doc.
   */
  ownerScope: string;
  collection: HrcCollection;
  capturedAt: string;
  capturedBy: string;
  changeKind: ChangeKind;
  prevState: T | null;                   // null on create
  newState: T | null;                    // null on hard delete (rare in this app)
}

// `correctionHistory` row appended every time a super_admin edits a
// snapshot row (Q4=B). Immutable.
export interface CorrectionEvent {
  id: string;
  clientId: string;
  snapshotPath: string;                  // e.g. "monthlySnapshots/{cid}_2026-05/risks/P001"
  correctedAt: string;
  correctedBy: string;
  reason: string;                        // mandatory ≥5 chars
  before: any;
  after: any;
}

// What `useHistoricalView` returns to a page.
export interface HistoricalViewState<T = any> {
  data: T;
  loading: boolean;
  error: string | null;
  isHistorical: boolean;
  monthEnd: YearMonth | null;
  availableMonths: YearMonth[];          // populated by /listSnapshotMonths
}
