export type IncidentStatus =
  | "Open"
  | "Investigating"
  | "Action Taken"
  | "Closed";

export const INCIDENT_STATUSES: IncidentStatus[] = [
  "Open",
  "Investigating",
  "Action Taken",
  "Closed",
];

export type IncidentSeverity = "Low" | "Medium" | "High" | "Critical";

export const INCIDENT_SEVERITIES: IncidentSeverity[] = [
  "Low",
  "Medium",
  "High",
  "Critical",
];

/** Project-relevant incident categories — used for repeat-incident detection (same type + window). */
export const INCIDENT_TYPES: string[] = [
  "Health & Safety",
  "Fire Safety",
  "Building Safety",
  "Environmental",
  "Data Breach",
  "Resident / Customer",
  "Quality Defect",
  "Near Miss",
  "Security",
  "Other",
];

export const INCIDENT_STATUS_STYLES: Record<IncidentStatus, string> = {
  Open: "bg-red-50 text-red-700 ring-1 ring-red-200",
  Investigating: "bg-amber-50 text-amber-700 ring-1 ring-amber-200",
  "Action Taken": "bg-blue-50 text-blue-700 ring-1 ring-blue-200",
  Closed: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200",
};

export const INCIDENT_SEVERITY_STYLES: Record<IncidentSeverity, string> = {
  Low: "bg-slate-100 text-slate-600 ring-1 ring-slate-200",
  Medium: "bg-amber-50 text-amber-700 ring-1 ring-amber-200",
  High: "bg-orange-50 text-orange-700 ring-1 ring-orange-200",
  Critical: "bg-red-50 text-red-700 ring-1 ring-red-200",
};

export interface Incident {
  id: string;
  title: string;
  type: string;
  /** ISO date-time the incident occurred. */
  occurredAt?: string | null;
  location?: string;
  projectId?: string | null;
  programmeId?: string | null;
  projectName?: string | null;
  severity: IncidentSeverity;
  immediateImpact?: string;
  residentImpact?: string;
  /** Regulatory relevance / which framework or body it touches. */
  regulatoryRelevance?: string;
  complianceGroup?: string;
  owner?: string;
  rootCause?: string;
  linkedRiskIds?: string[];
  linkedControlIds?: string[];
  actionsTaken?: string;
  escalationRoute?: string;
  status: IncidentStatus;
  lessonsLearned?: string;
  evidenceIds?: string[];
  closedAt?: string | null;
  createdAt?: any;
  updatedAt?: any;
}
