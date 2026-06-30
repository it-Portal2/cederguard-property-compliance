export type AssuranceActionType =
  | "Detective"
  | "Preventive"
  | "Corrective"
  | "Improvement";

/** Action types in the order they read as a response lifecycle. */
export const ASSURANCE_ACTION_TYPES: AssuranceActionType[] = [
  "Detective",
  "Corrective",
  "Preventive",
  "Improvement",
];

/** Tailwind pill classes per action type (matches the MyTasks CAPA badge palette). */
export const ACTION_TYPE_STYLES: Record<AssuranceActionType, string> = {
  Detective: "bg-violet-50 text-violet-700 ring-1 ring-violet-200",
  Corrective: "bg-rose-50 text-rose-700 ring-1 ring-rose-200",
  Preventive: "bg-blue-50 text-blue-700 ring-1 ring-blue-200",
  Improvement: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200",
};

export interface GeneratedAction {
  id: string;
  type: AssuranceActionType;
  title: string;
  rationale: string;
  /** Best-effort match to an existing control id (Q1=c grounding). */
  linkedControlId?: string | null;
  adopted?: boolean;
  /** The CAPA task id created when the action is adopted. */
  taskId?: string | null;
}

export type AssuranceSource =
  | "compliance"
  | "risk"
  | "governance"
  | "incident"
  | "control"
  | "direct";
export type AssuranceSeverity = "Low" | "Medium" | "High" | "Critical";

// WHY this reached Assurance — the failure that triggered the final enforcement layer.
export type AssuranceFailureReason =
  | "alert_not_acted"
  | "control_failed"
  | "incident_occurred"
  | "other";

export const ASSURANCE_FAILURE_LABELS: Record<AssuranceFailureReason, string> = {
  alert_not_acted: "Alert raised but not acted on",
  control_failed: "Control failed despite being in place",
  incident_occurred: "Incident occurred",
  other: "Other",
};
export type AssuranceStatus = "Open" | "In Review" | "Resolved" | "Dismissed";
export type AssuranceGenerationStatus =
  | "pending"
  | "generating"
  | "done"
  | "failed";

export const ASSURANCE_SEVERITIES: AssuranceSeverity[] = [
  "Low",
  "Medium",
  "High",
  "Critical",
];
export const ASSURANCE_STATUSES: AssuranceStatus[] = [
  "Open",
  "In Review",
  "Resolved",
  "Dismissed",
];

export const ASSURANCE_SOURCE_LABELS: Record<AssuranceSource, string> = {
  compliance: "Compliance",
  risk: "Risk",
  governance: "Governance",
  incident: "Incident",
  control: "Control",
  direct: "Direct entry",
};

export interface AssuranceAlert {
  id: string;
  title: string;
  description?: string;
  source: AssuranceSource;
  /** Snapshot of where it came from (the live alert it was escalated from). */
  sourceRef?: { kind: string; id: string; label: string } | null;
  severity: AssuranceSeverity;
  status: AssuranceStatus;
  /** Why it reached Assurance (the failure that triggered it). */
  failureReason?: AssuranceFailureReason;
  projectId?: string | null;
  programmeId?: string | null;
  projectName?: string | null;
  owner?: string;
  generationStatus?: AssuranceGenerationStatus;
  generatedActions?: GeneratedAction[];
  createdAt?: any;
  updatedAt?: any;
}
