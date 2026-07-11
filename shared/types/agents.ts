import { ROLE_STRINGS } from "../constants/roleConstants.js";

export const AGENT_KEYS = [
  "governance",
  "riskIncident",
  "compliance",
  "technical",
  "evidence",
  "monitoring",
  "delivery",
] as const;
export type AgentKey = (typeof AGENT_KEYS)[number];

/** Brief §5 `requestType` vocabulary. */
export const REQUEST_TYPES = [
  "governance",
  "risk",
  "incident",
  "compliance",
  "technical",
  "evidence",
  "monitoring",
  "reporting",
  "delivery",
] as const;
export type RequestType = (typeof REQUEST_TYPES)[number];

/**
 * What a suggestion proposes. Each value maps 1:1 to an apply-adapter; an output
 * type with no adapter can never reach a live record. The prohibited actions
 * (close incident, downgrade risk, mark compliance complete, mark control
 * verified, external comms, commit spend) are absent here BY DESIGN — they are
 * unrepresentable, not merely blocked.
 */
export const OUTPUT_TYPES = [
  "risk",
  "control",
  "complianceItem",
  "capaTask",
  "evidenceGap",
  "incidentUpdate",
  "lessonLearned",
  "technicalAnswer",
  "narrative",
  "escalation",
] as const;
export type OutputType = (typeof OUTPUT_TYPES)[number];

export type ReviewStatus =
  | "draft"
  | "accepted"
  | "edited"
  | "rejected"
  | "applied"
  | "superseded";

export type RunStatus = "running" | "complete" | "failed";

/** `portfolio` is explicit (brief §5): a null contextId is only ever portfolio scope. */
export type ContextKind = "project" | "programme" | "portfolio";

export interface RecordCitation {
  collection: string;
  id: string;
  label: string;
}

export interface DocumentCitation {
  id: string;
  label: string;
  url?: string;
}

/** Structurally matches `WebCitation` in api/lib/aiOperationRouter.ts (web/ cannot import from api/). */
export interface WebSourceCitation {
  kind: "web";
  url: string;
  title: string;
  snippet?: string;
}

export interface SuggestionCitations {
  records: RecordCitation[];
  documents: DocumentCitation[];
  web: WebSourceCitation[];
}

export interface SuggestionReviewer {
  uid: string;
  name: string;
  decidedAt: string;
  /** Mandatory on reject (brief §10 acceptance test). */
  reason?: string;
  editDiff?: { field: string; from: unknown; to: unknown }[];
}

export interface SuggestionApplied {
  collection: string;
  recordId: string;
  at: string;
  byUid: string;
}

export interface AgentSuggestionDoc {
  id: string;
  clientId: string;
  contextKind: ContextKind;
  contextId: string | null;
  agentKey: AgentKey;
  runId: string;
  requestType: RequestType;
  outputType: OutputType;
  title: string;
  rationale: string;
  /** The draft record. Never mutated after creation — an edit lands in `editedPayload`. */
  payload: Record<string, unknown>;
  editedPayload: Record<string, unknown> | null;
  citations: SuggestionCitations;
  /** 0–1, self-reported by the model. Surfaced as "model-reported", never as calibrated. */
  confidence: number;
  assumptions: string[];
  missingEvidence: string[];
  reviewStatus: ReviewStatus;
  reviewer: SuggestionReviewer | null;
  applied: SuggestionApplied | null;
  createdAt: string;
  updatedAt: string;
}

export interface AgentRunDoc {
  id: string;
  clientId: string;
  agentKey: AgentKey;
  contextKind: ContextKind;
  contextId: string | null;
  /** Evidence of permission inheritance: the run executed as this user, with their role. */
  requestedBy: { uid: string; name: string; email: string; role: string };
  input: { question?: string } | null;
  /** Exactly which records grounded the prompt (brief §8 auditability). */
  retrieved: { collection: string; ids: string[] }[];
  promptMeta: {
    promptText: string;
    recordCounts: Record<string, number>;
    truncated: boolean;
  };
  modelUsed: string;
  latencyMs: number;
  status: RunStatus;
  error?: string;
  suggestionIds: string[];
  createdAt: string;
  updatedAt: string;
}

/**
 * The only legal review moves. `applied` is reachable only from `accepted`/`edited`,
 * which is what makes approval-before-write enforceable server-side; `rejected`,
 * `applied` and `superseded` are terminal.
 */
export const REVIEW_TRANSITIONS: Record<ReviewStatus, readonly ReviewStatus[]> = {
  draft: ["accepted", "edited", "rejected", "superseded"],
  accepted: ["applied", "rejected"],
  edited: ["applied", "rejected"],
  rejected: [],
  applied: [],
  superseded: [],
};

export function canTransition(from: ReviewStatus, to: ReviewStatus): boolean {
  return REVIEW_TRANSITIONS[from]?.includes(to) ?? false;
}

/** A suggestion may only be applied from an approved state. */
export function isApprovable(status: ReviewStatus): boolean {
  return status === "accepted" || status === "edited";
}

/**
 * PM-level roles. The SERVER gate is `ctx.isClientAdmin || AGENT_PM_ROLES.includes(role)` —
 * the isClientAdmin branch also covers admin/enterprise and the SYSTEM_ADMIN_EMAILS path,
 * which has no role string of its own.
 */
export const AGENT_PM_ROLES: readonly string[] = [
  ROLE_STRINGS.PROGRAMME_MANAGER,
  ROLE_STRINGS.PROJECT_MANAGER,
  ROLE_STRINGS.SENIOR_PM,
  ROLE_STRINGS.SENIOR_PROJECT_MANAGER,
  ROLE_STRINGS.ASSISTANT_PM,
  ROLE_STRINGS.PROJECT_COORDINATOR,
];

/**
 * Who may accept / edit / reject / apply a suggestion (PM+). Single definition so the
 * client gate can never drift from the server gate. `viewer` is excluded here and is
 * additionally denied at the dispatcher by the viewerGate allowlist.
 */
export function canReviewAgentSuggestions(role?: string | null): boolean {
  if (!role) return false;
  return (
    role === "super_admin" ||
    role === ROLE_STRINGS.ADMIN ||
    role === ROLE_STRINGS.CLIENT_ADMIN ||
    role === ROLE_STRINGS.ENTERPRISE ||
    AGENT_PM_ROLES.includes(role)
  );
}
