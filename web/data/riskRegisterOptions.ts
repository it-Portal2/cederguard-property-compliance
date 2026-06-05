// Risk Register dropdown master-data. Projects and programmes use distinct
// option sets — call the branching helpers below with a risk so the correct
// list is returned based on `isProgrammeLevel`.

// =====================================================================
// Risk Owner
// =====================================================================

export const RISK_OWNER_OPTIONS_PROJECT: readonly string[] = [
  "Strategic Director",
  "Strategic Lead A",
  "Strategic Lead B",
  "Strategic Lead C",
  "Strategic Lead D",
];

export const RISK_OWNER_OPTIONS_PROGRAMME: readonly string[] = [
  "Strategic Director",
  "Stuart Davis",
  "Zoe Davies",
  "SPM PMO",
  "Strategic Leads",
];

// =====================================================================
// Control Owner
// =====================================================================

export const CONTROL_OWNER_OPTIONS_PROJECT: readonly string[] = [
  "Stuart Davis",
  "Strategic Lead",
  "Senior Project Manager",
  "Project Manager",
  "Contractor",
  "Employer's Agent",
  "Clerk of Works",
  "Design Team",
  "Finance",
  "Legal",
];

export const CONTROL_OWNER_OPTIONS_PROGRAMME: readonly string[] = [
  "Osama Shoush",
  "Margaret Burrell",
  "Hemali Topiwala",
  "Zoe Davies",
  "Richard Ekelegbu",
];

// =====================================================================
// Status enum (note: PROJECT has "In Progress"; PROGRAMME has "Tolerated")
// =====================================================================

export const STATUS_OPTIONS_PROJECT: readonly string[] = [
  "Open",
  "Closed",
  "Managed",
  "Mitigated",
  "In Progress",
];

export const STATUS_OPTIONS_PROGRAMME: readonly string[] = [
  "Open",
  "Closed",
  "Managed",
  "Mitigated",
  "Tolerated",
];

// =====================================================================
// Phase concept — PROJECT uses Phase; PROGRAMME uses Programme grouping
// =====================================================================

export const PHASE_OPTIONS_PROJECT: readonly string[] = [
  "Dormant",
  "Active",
  "Imminent",
  "Materialised",
];

export const PROGRAMME_PHASE_OPTIONS: readonly string[] = [
  "Overall Programme",
  "Pre 2026 Programme",
  "Future Programme 2026+",
];

// =====================================================================
// Risk response + Risk review plan (shared across both registers)
// =====================================================================

export const RISK_RESPONSE_OPTIONS: readonly string[] = [
  "Avoid",
  "Reduce",
  "Transfer",
  "Accept",
];

export const RISK_REVIEW_PLAN_OPTIONS: readonly string[] = [
  "Accept",
  "Review",
  "Escalate",
];

// =====================================================================
// Workstream — project + programme share the same vocabulary but differ
// in one or two entries (programme adds "PMO" and "Future Programme")
// =====================================================================

export const WORKSTREAM_OPTIONS_PROJECT: readonly string[] = [
  "Programme",
  "Procurement",
  "Resourcing",
  "GLA",
  "Financial",
  "Health & Safety",
  "Political",
  "Reputational",
  "Political / Reputational",
  "Resident",
  "Leaseholder Engagement",
];

export const WORKSTREAM_OPTIONS_PROGRAMME: readonly string[] = [
  "Programme",
  "Procurement",
  "Resourcing",
  "PMO",
  "GLA",
  "Financial",
  "Health & Safety",
  "Political",
  "Reputational",
  "Political / Reputational",
  "Future Programme",
  "Resident",
  "Leaseholder Engagement",
];

// =====================================================================
// KRI — PROJECT has 7 KRI options; PROGRAMME has NO KRI column.
// Preserved verbatim from client Excel including the "Exvellence" typo
// in row R9 (flagged to client for confirmation ).
// =====================================================================

export const KRI_OPTIONS_PROJECT: readonly string[] = [
  "Project Financial Sustainability KRI",
  "Resource & Capability Adequacy KRI",
  "Strategic Objectives & Adaptability KRI",
  "Supply Chain & Safety Performance KRI",
  "Technical Delivery & Infrastructure KRI",
  "Building Control Safety Compliance KRI",
  "Project Delivery Exvellence KRI", // Excel typo preserved — flagged to client
];

// =====================================================================
// Branching helpers — single import surface for every consumer
// =====================================================================

type RiskKindInput = { isProgrammeLevel?: boolean | null };

function isProgramme(risk: RiskKindInput): boolean {
  return !!risk?.isProgrammeLevel;
}

export function riskOwnerOptions(risk: RiskKindInput): readonly string[] {
  return isProgramme(risk)
    ? RISK_OWNER_OPTIONS_PROGRAMME
    : RISK_OWNER_OPTIONS_PROJECT;
}

export function controlOwnerOptions(risk: RiskKindInput): readonly string[] {
  return isProgramme(risk)
    ? CONTROL_OWNER_OPTIONS_PROGRAMME
    : CONTROL_OWNER_OPTIONS_PROJECT;
}

export function statusOptions(risk: RiskKindInput): readonly string[] {
  return isProgramme(risk)
    ? STATUS_OPTIONS_PROGRAMME
    : STATUS_OPTIONS_PROJECT;
}

/**
 * Phase column — only applies to PROJECT risks. Programme risks use
 * `programmePhaseOptions` instead. Returns null when the risk is
 * programme-level so callers can hide the column.
 */
export function phaseOptions(risk: RiskKindInput): readonly string[] | null {
  return isProgramme(risk) ? null : PHASE_OPTIONS_PROJECT;
}

/**
 * Programme grouping — only applies to PROGRAMME risks. Returns null for
 * project risks so callers can hide the column.
 */
export function programmePhaseOptions(
  risk: RiskKindInput,
): readonly string[] | null {
  return isProgramme(risk) ? PROGRAMME_PHASE_OPTIONS : null;
}

export function workstreamOptions(risk: RiskKindInput): readonly string[] {
  return isProgramme(risk)
    ? WORKSTREAM_OPTIONS_PROGRAMME
    : WORKSTREAM_OPTIONS_PROJECT;
}

/**
 * KRI — only PROJECT risks have a KRI column master data.
 * Returns null for programme risks (callers should hide the column).
 */
export function kriOptionsOrNull(
  risk: RiskKindInput,
): readonly string[] | null {
  return isProgramme(risk) ? null : KRI_OPTIONS_PROJECT;
}
