// Single source of truth for resolving the ACTIVE SCOPE (project / programme /
// portfolio) into the human wording that AI insight prompts + dashboard labels
// must use. Pure + framework-agnostic — no React, no store import — so both
// pages (which read activeProject*/activeProgramme* from the store) and, later,
// aiService prompt builders can share it.
//
// Wording rules (user-confirmed):
//   project   → "this project"      / "Project Health"   / "Project Health Score"
//   programme → "this programme"    / "Programme Health" / "Programme Health Score"
//   portfolio → "this organisation" / "Portfolio Health" / "Portfolio Health Score"
//
// Why this exists: several aiService prompt builders + static dashboard headings
// hardcoded "organisation"/"Portfolio" regardless of the actual scope (e.g. the
// Risk Dashboard showing "PORTFOLIO HEALTH" while a single programme is active).

export type AiScopeKind = "project" | "programme" | "portfolio";

export interface AiScope {
  /** Which scope is active. */
  scope: AiScopeKind;
  /** Lowercase bare noun: "project" | "programme" | "portfolio". */
  noun: string;
  /**
   * Possessive phrase for prompt prose: "this project" | "this programme" |
   * "this organisation". (Portfolio deliberately says "organisation", not
   * "portfolio", per the confirmed wording rule.)
   */
  possessive: string;
  /** The entity's display name, or a portfolio fallback for the top level. */
  label: string;
  /** Static card/section heading (no "Score"): e.g. "Programme Health". */
  healthHeading: string;
  /** Prose health-score label: e.g. "Programme Health Score". */
  healthLabel: string;
}

export interface ResolveAiScopeArgs {
  activeProjectId?: string | null;
  activeProgrammeId?: string | null;
  /** Active project record — only `.name` is read (kept loose to avoid a store-type dep). */
  activeProject?: { name?: string | null } | null;
  /** Active programme record — only `.name` is read. */
  activeProgramme?: { name?: string | null } | null;
  /** Optional label shown when neither a project nor a programme is active. */
  portfolioLabel?: string;
}

const TITLE: Record<AiScopeKind, string> = {
  project: "Project",
  programme: "Programme",
  portfolio: "Portfolio",
};

const POSSESSIVE: Record<AiScopeKind, string> = {
  project: "this project",
  programme: "this programme",
  portfolio: "this organisation",
};

/**
 * Resolve the active context into scope wording. A project takes precedence over
 * a programme (a project is always the narrower, more specific context); with
 * neither active it's portfolio/organisation-wide.
 */
export function resolveAiScope(args: ResolveAiScopeArgs): AiScope {
  const {
    activeProjectId,
    activeProgrammeId,
    activeProject,
    activeProgramme,
    portfolioLabel = "Portfolio",
  } = args;

  let scope: AiScopeKind;
  let label: string;
  if (activeProjectId) {
    scope = "project";
    label = activeProject?.name?.trim() || "this project";
  } else if (activeProgrammeId) {
    scope = "programme";
    label = activeProgramme?.name?.trim() || "this programme";
  } else {
    scope = "portfolio";
    label = portfolioLabel;
  }

  return {
    scope,
    noun: scope,
    possessive: POSSESSIVE[scope],
    label,
    healthHeading: `${TITLE[scope]} Health`,
    healthLabel: `${TITLE[scope]} Health Score`,
  };
}
