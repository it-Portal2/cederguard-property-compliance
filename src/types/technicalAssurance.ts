// Technical Assurance Companion — shared types (Phase 0).
//
// Entity shapes locked per plan §TAC-5. Phase 0 only declares the contracts;
// later phases (1, 2, 5, 6) hydrate the Firestore writes + reads against
// these shapes.
//
// All entities tenant-scoped by `clientId` (multi-tenant invariant — lesson #10).

// Mirrors `RIBA_STAGES[].id` in src/constants/ribaStages.ts. Declared locally
// so we don't have to alter the existing file (which exports the array but
// no type union).
export type RibaStage = "S0" | "S1" | "S2" | "S3" | "S4" | "S5" | "S6" | "S7";

// --- Extra role for TAC ----------------------------------------------------
// Stored on `users/{uid}.extraRoles[]`. Additive to the existing CanonicalRole
// union — does NOT widen `CanonicalRole` itself, so the rest of the codebase
// is unaffected.
export type TacExtraRole = "compliance_lead";

// --- Enquiry ---------------------------------------------------------------
export type EnquiryStatus =
  | "Draft"
  | "Generating"
  | "Open"
  | "AwaitingReview"
  | "Approved"
  | "Closed"
  | "Archived";

export type EnquiryAttachmentScanStatus =
  | "pending"
  | "clean"
  | "infected"
  | "failed";

export interface EnquiryAttachment {
  id: string;
  storagePath: string;
  /** Public download URL produced by the storage layer (server-side). */
  url?: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  avScanStatus: EnquiryAttachmentScanStatus;
  avScanAt?: string;
  uploadedAt: string;
  uploadedBy: string;
}

export interface EnquiryBimReference {
  connector: "bim360" | "procore" | "sharepoint";
  externalId: string;
  label: string;
  fetchedAt: string;
}

export interface EnquiryFeedback {
  thumbs: "up" | "down";
  reason?: "inaccurate" | "missed_regulation" | "wrong_stage" | "other";
  note?: string;
  submittedBy: string;
  submittedAt: string;
}

export interface EnquiryAuditFlag {
  flaggedBy: string;
  flaggedAt: string;
  reviewerNote?: string;
  resolvedAt?: string;
  resolvedBy?: string;
}

export interface EnquiryShare {
  shareId: string;
  sharedWith: string;
  sharedAt: string;
  decision?: "approved" | "rejected";
  decisionNote?: string;
  decidedAt?: string;
}

export interface Enquiry {
  id: string;
  clientId: string;
  projectId: string;
  ribaStage: RibaStage;
  title: string;
  query: string;
  attachments: EnquiryAttachment[];
  bimReferences?: EnquiryBimReference[];
  status: EnquiryStatus;
  ownerUid: string;
  createdAt: string;
  updatedAt: string;
  closedAt?: string;
  closedBy?: string;
  goldenThreadId?: string;
  feedback?: EnquiryFeedback;
  flaggedForAudit?: EnquiryAuditFlag;
  shares?: EnquiryShare[];
  softDeleted?: boolean;
  deletionReason?: string;
  deletedAt?: string;
  deletedBy?: string;
}

// --- Enquiry deliverables (sub-collection) --------------------------------
export type EnquiryDeliverableTab =
  | "summary"
  | "drawing"
  | "rfi"
  | "costProgramme"
  | "compliance";

export interface EnquiryDeliverable<TContent = unknown> {
  tabId: EnquiryDeliverableTab;
  content: TContent;
  generatedAt: string;
  generatedBy: "ai" | string;
  versionNumber: number;
}

// Tab-specific content shapes (filled by Phases 2-7).
export interface SummaryInsightOption {
  id: string;
  label: string;
  summary: string;
  compliance: "compliant" | "borderline" | "non-compliant";
  costDelta: number;
  programmeDelta: number;
  /** AI rationale for the option — shown under the summary line. */
  rationale?: string;
  recommended?: boolean;
}

export interface SummaryInsightCitation {
  /** Must resolve to a `regulationsCorpus` doc id. */
  regId: string;
  /** Short reason this citation applies. */
  appliedTo: string;
  /** Verbatim ≤300-char excerpt from the corpus entry. */
  quote: string;
}

export interface SummaryTabContent {
  lede: string;
  options: SummaryInsightOption[];
  /** Cited regulations — every regId must resolve in the corpus. */
  citations: SummaryInsightCitation[];
  complianceSnapshot: Array<{ check: string; status: "pass" | "warn" | "fail" }>;
  nextActions: string[];
  /** Drawing-tab content produced by the same Gemini call. Present only when
   *  the enquiry has a PDF attachment; otherwise the Drawing tab renders an
   *  empty-state. */
  drawing?: DrawingTabContent;
  /** RFI-tab content produced by the same Gemini call. Always present. */
  rfi?: RfiTabContent;
}

export type DrawingAnnotationSeverity = "info" | "warning" | "critical";

export interface DrawingAnnotation {
  id: string;
  /** Display number (e.g. "1", "2", "3") — server keeps these stable across regenerations. */
  number: string;
  label: string;
  /** Page in the source PDF the annotation belongs to (1-indexed). */
  page: number;
  /** Optional dimensional measurement called out (e.g. "60mm" or "1.2m"). */
  dimension?: string;
  note?: string;
  severity: DrawingAnnotationSeverity;
  /** Optional reference to a citation regId from the corpus (links callout to a regulation). */
  regId?: string;
}

export interface DrawingTabContent {
  /** Storage path of the source PDF this is annotating (if any). */
  basePdfPath?: string;
  /** Public download URL of the source PDF (for the EmbedPDF viewer). */
  basePdfUrl?: string;
  /** File name of the source PDF (for the header strip). */
  basePdfFileName?: string;
  /** Server-rendered SVG overlay if Phase 4b ships pdf-lib. Reserved field. */
  overlaySvg?: string;
  annotations: DrawingAnnotation[];
  /** One-line note that frames the drawing markup as a whole. */
  summaryNote?: string;
}

export type RfiPriority = "high" | "medium" | "low";

export type RfiTabStatus = "Draft" | "Issued" | "Responded" | "Closed";

export interface RfiWalkthroughChapter {
  id: string;
  /** Display order, e.g. "1", "2", "3". */
  number: string;
  /** Short caption, ≤80 chars. */
  caption: string;
  /** 1-2 sentence description of the install / inspection step. */
  description: string;
}

export interface RfiRecipient {
  uid?: string;
  email: string;
  name?: string;
  role?: string;
}

export interface RfiTabContent {
  /** Auto-generated on Issue (e.g. "RFI-AC-0001"). Empty in Draft state. */
  rfiNumber: string;
  status: RfiTabStatus;
  subject: string;
  body: string;
  priority: RfiPriority;
  recipients: RfiRecipient[];
  /** Q11=B locked — text-only install chapters generated by the same AI run. */
  walkthroughChapters?: RfiWalkthroughChapter[];
  /** ISO timestamp of issue. */
  issuedAt?: string;
  issuedBy?: string;
  attachments?: Array<{ enquiryAttachmentId: string }>;
}

export interface CostProgrammeTabContent {
  costLines: Array<{
    rateId?: string;
    description: string;
    unit: string;
    quantity: number;
    rate: number;
    total: number;
  }>;
  totalDelta: number;
  programmeBars: Array<{
    label: string;
    startDate: string;
    endDate: string;
    track: number;
  }>;
  floatRemaining: number;
}

export interface ComplianceTabContent {
  dimensionalChecks: Array<{ check: string; status: "pass" | "warn" | "fail" }>;
  systemChecks: Array<{ check: string; status: "pass" | "warn" | "fail" }>;
  citations: Array<{
    regId: string;
    documentLabel: string;
    clause: string;
    quote: string;
    appliedTo: string;
  }>;
  softFlags: string[];
}

// --- RFI register ---------------------------------------------------------
export type RfiStatus = "Draft" | "Issued" | "Responded" | "Closed";

export interface Rfi {
  rfiNumber: string;
  clientId: string;
  projectId: string;
  enquiryId: string;
  recipients: Array<{
    uid?: string;
    email: string;
    name?: string;
    role?: string;
  }>;
  priority: "high" | "medium" | "low";
  subject: string;
  body: string;
  attachments: Array<{ enquiryAttachmentId: string }>;
  status: RfiStatus;
  issuedAt?: string;
  issuedBy?: string;
  response?: { text: string; respondedAt: string; respondedBy: string };
}

// --- Cost rates library (council-editable) --------------------------------
export type CostRateCategory =
  | "preliminaries"
  | "substructure"
  | "frame"
  | "me"
  | "finishes"
  | "external"
  | "fees";

export type CostRateUnit = "m" | "m2" | "m3" | "no" | "hr" | "item";

export interface CostRate {
  rateId: string;
  clientId: string;
  category: CostRateCategory;
  description: string;
  unit: CostRateUnit;
  rate: number;
  currency: "GBP";
  source: "seed" | "spons-2026" | "custom";
  lastUpdated: string;
  lastUpdatedBy: string;
}

// --- Regulations corpus (platform-wide) ----------------------------------
export type RegulationDocument =
  | "adb-vol1"
  | "adb-vol2"
  | "adk"
  | "bsa-2022"
  | "pas-2035"
  | "awaabs-law"
  | "cdm-2015"
  | "rsh-cs"
  | "gt-guidance";

export interface RegulationCorpusEntry {
  regId: string;
  document: RegulationDocument;
  documentLabel: string;
  clause: string;
  text: string;
  source: { url: string; documentVersion: string; verifiedAt: string };
  appliesTo?: string[];
  ribaRelevance?: RibaStage[];
}
