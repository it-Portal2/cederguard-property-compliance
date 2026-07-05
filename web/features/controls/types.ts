export type ControlStatus =
  | "Effective"
  | "Partially Effective"
  | "Failed"
  | "Not Tested"
  | "Retired";

export const CONTROL_STATUSES: ControlStatus[] = [
  "Effective",
  "Partially Effective",
  "Failed",
  "Not Tested",
  "Retired",
];

/** Tailwind class strings for the status pill, keyed by status. */
export const CONTROL_STATUS_STYLES: Record<ControlStatus, string> = {
  Effective: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200",
  "Partially Effective": "bg-amber-50 text-amber-700 ring-1 ring-amber-200",
  Failed: "bg-red-50 text-red-700 ring-1 ring-red-200",
  "Not Tested": "bg-slate-100 text-slate-600 ring-1 ring-slate-200",
  Retired: "bg-slate-50 text-slate-400 ring-1 ring-slate-200",
};

export interface Control {
  id: string;
  title: string;
  reference?: string;
  description?: string;
  owner?: string;
  status: ControlStatus;
  /** Compliance-group classification — a DOMAINS id (e.g. "hs", "bs"). */
  complianceGroup?: string;
  /** Optional scope tag — a control may be org-wide or tied to a project/programme. */
  projectId?: string | null;
  programmeId?: string | null;
  projectName?: string | null;
  linkedRegulationIds?: string[];
  linkedRiskIds?: string[];
  /** Evidence linkage — contract field; the picker UI lands in Phase 4. */
  evidenceIds?: string[];
  /** How the control was created. "ai-suggestion" = promoted from an AI mitigation suggestion. */
  origin?: "manual" | "ai-suggestion";
  /** When promoted from an AI suggestion, the id of the risk it was suggested for. */
  sourceRiskId?: string | null;
  lastReviewDate?: string | null;
  createdAt?: any;
  updatedAt?: any;
}
