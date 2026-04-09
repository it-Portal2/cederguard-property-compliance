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
  VIEWER: "viewer",
} as const;
