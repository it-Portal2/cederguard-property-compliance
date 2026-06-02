// Shared model for the Fact-Check / Validation mechanism.
//
// Pure, framework-agnostic types + constants + helpers used across the
// validation feature: the FactCheckPanel, the useValidationGate hook, and the
// useStore validation slice. The api/routes/validation.ts handlers build
// records structurally (they don't import this client module) and do their own
// server-side role gating via ApiContext.
//
// SINGLE SOURCE OF TRUTH for "what is a validation record / fact-check result /
// citation kind / soft-flag threshold". Retune CONFIDENCE_SOFT_FLAG here.

import { isAtLeastPM, type UserRole } from "./roles";

// ── Status & surfaces ────────────────────────────────────────────────────

/** Lifecycle of a validation record. */
export type ValidationStatus =
  | "unchecked" //            no fact-check has been run yet
  | "awaiting_validation" //  a fact-check ran; a person (PM+) must sign off
  | "validated" //            a PM+ confirmed it — the approval gate is unblocked
  | "rejected"; //            a PM+ rejected it — must re-run / fix first

/** The AI surfaces a fact-check can attach to. */
export type ValidationSurface =
  | "risk"
  | "compliance"
  | "technical"
  | "mitigation"
  | "outlook"
  | "chat";

// ── Fact-check result shape ──────────────────────────────────────────────

export type ClaimVerdict = "supported" | "unsupported" | "uncertain";

/** A single factual claim the AI made, with the verification verdict. */
export interface FactCheckClaim {
  claim: string;
  verdict: ClaimVerdict;
  note?: string;
}

/**
 * A sanity-check flag on the AI's own judgement (Q6=B) — e.g. a risk score
 * that looks out of line. Advisory only: the person decides; the AI never
 * overrides a rating.
 */
export interface RatingFlag {
  field: string; //    e.g. "grossScore", "severity"
  observed: string; // the value that looked off
  note: string; //     why it was flagged
}

export interface FactCheckResult {
  claims: FactCheckClaim[];
  ratingFlags: RatingFlag[];
  /** Model-estimated 0..1 confidence (NOT token-level logprobs — see Q5/Q8). */
  overallConfidence: number;
  summary: string;
}

// ── Citations & attachments ──────────────────────────────────────────────

/**
 * A source behind an answer. `kind:"web"` carries an external `url` (from the
 * OpenRouter web plugin / Gemini grounding); `kind:"record"` carries an in-app
 * `route` deep-link (the records the AI actually read). Both render in one list.
 */
export interface ValidationCitation {
  kind: "web" | "record";
  label: string;
  url?: string; //    web sources
  route?: string; //  in-app record deep-link
  title?: string;
  snippet?: string;
}

/** A user-attached source: a pasted link or an uploaded file (Q7=A). */
export interface ValidationAttachment {
  kind: "link" | "file";
  url: string;
  title: string;
  storagePath?: string; // present for uploaded files (GCS object path)
  addedBy?: string;
  addedAt?: string;
}

// ── Audit event (append-only, Q8=A) ────────────────────────────────────────

export interface ValidationEvent {
  type:
    | "fact_check_run"
    | "validated"
    | "rejected"
    | "source_added"
    | "source_removed";
  by: string; //     uid
  byName?: string;
  at: string; //     ISO 8601
  note?: string;
}

// ── The record ─────────────────────────────────────────────────────────────

export interface ValidationRecord {
  id: string;
  clientId: string;
  contextId: string; //  project or programme id ("" for cross-context chat)
  surface: ValidationSurface;
  targetType: string; // e.g. "riskAnalysis" | "complianceAnalysis" | "chatMessage"
  targetId: string; //   id of the thing being validated
  label: string; //      human label for the audit log / UI
  status: ValidationStatus;
  factCheck?: FactCheckResult;
  citations: ValidationCitation[];
  attachments: ValidationAttachment[];
  initiatedBy: string;
  initiatedAt: string;
  validatedBy?: string;
  validatedAt?: string;
  events: ValidationEvent[];
}

// ── Constants ────────────────────────────────────────────────────────────

/**
 * Below this model-estimated confidence, the UI soft-flags the result as
 * "needs attention" (Q5=A). It never hard-blocks — the person still decides.
 */
export const CONFIDENCE_SOFT_FLAG = 0.85;

// ── Pure helpers ───────────────────────────────────────────────────────────

const STATUS_LABELS: Record<ValidationStatus, string> = {
  unchecked: "Not checked",
  awaiting_validation: "Awaiting validation",
  validated: "Validated",
  rejected: "Rejected",
};

export function statusLabel(status: ValidationStatus): string {
  return STATUS_LABELS[status] ?? "Unknown";
}

/** A result is soft-flagged when its confidence is below the threshold. */
export function isLowConfidence(confidence: number | undefined): boolean {
  return typeof confidence === "number" && confidence < CONFIDENCE_SOFT_FLAG;
}

/** Only PM and above may clear validation (Q3=A). Reuses the roles helper. */
export function canValidate(role?: UserRole | string | null): boolean {
  return isAtLeastPM(role as UserRole | undefined);
}

/** Stable cache/lookup key for a validation by surface + target. */
export function validationKey(
  surface: ValidationSurface,
  targetId: string,
): string {
  return `${surface}:${targetId}`;
}

/**
 * True when a surface's final approval/submit action must be blocked.
 * Anything other than an explicit "validated" leaves approval gated.
 */
export function isApprovalBlocked(status: ValidationStatus | undefined): boolean {
  return status !== "validated";
}
