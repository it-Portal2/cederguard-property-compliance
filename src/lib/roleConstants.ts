// Shared role string constants — safe to import from both frontend (Vite) and backend (Node).
// No env references. Keep in sync with UserRole in src/lib/roles.ts.
export const ROLE_STRINGS = {
  ADMIN: "admin",
  CLIENT_ADMIN: "client_admin",
  ENTERPRISE: "enterprise",
  PROGRAMME_MANAGER: "programme_manager",
  PROJECT_MANAGER: "project_manager",
  SENIOR_PM: "senior_pm",
  SENIOR_PROJECT_MANAGER: "senior_project_manager",
  ASSISTANT_PM: "assistant_project_manager",
  PROJECT_COORDINATOR: "project_coordinator",
  STRATEGIC_DIRECTOR: "strategic_director",
  VIEWER: "viewer",
} as const;

export const PM_LEVELS = ["senior", "standard", "assistant", "coordinator"] as const;
export type PmLevel = (typeof PM_LEVELS)[number];

export const CANONICAL_ROLES = [
  "super_admin",
  "client_admin",
  "project_manager",
  "strategic_director",
  "viewer",
  "enterprise",
] as const;
export type CanonicalRole = (typeof CANONICAL_ROLES)[number];
