import { ROLE_STRINGS, type CanonicalRole, type PmLevel } from "./roleConstants";

export type { CanonicalRole, PmLevel };

export type UserRole =
  | "admin"
  | "client_admin"
  | "enterprise"
  | "programme_manager"
  | "project_manager"
  | "senior_pm"
  | "senior_project_manager"
  | "assistant_project_manager"
  | "project_coordinator"
  | "strategic_director"
  | "viewer";

// Admin emails must be configured via VITE_SYSTEM_ADMIN_EMAILS env var (comma-separated).
// No hardcoded fallback — omitting the env var means no system admins are granted via email.
export const SYSTEM_ADMIN_EMAILS: string[] = (() => {
  const envEmails = import.meta.env.VITE_SYSTEM_ADMIN_EMAILS;
  if (envEmails && typeof envEmails === "string") {
    return envEmails
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);
  }
  return [];
})();

export const SUPER_ADMIN_EMAIL =
  SYSTEM_ADMIN_EMAILS[0] || "admin@cedarguard.co.uk";

export const ROLES = {
  ADMIN: ROLE_STRINGS.ADMIN,
  CLIENT_ADMIN: ROLE_STRINGS.CLIENT_ADMIN,
  PROJECT_MANAGER: ROLE_STRINGS.PROJECT_MANAGER,
} as const;

export const isSystemAdmin = (email?: string) => {
  return !!(email && SYSTEM_ADMIN_EMAILS.includes(email.toLowerCase()));
};

export const isSuperAdmin = (email?: string, role?: string) => {
  // A Super Admin is someone with the 'admin' role OR a system admin
  return role === ROLE_STRINGS.ADMIN || isSystemAdmin(email);
};

export const isAtLeastClientAdmin = (role?: UserRole) => {
  if (!role) return false;
  return [ROLE_STRINGS.ADMIN, ROLE_STRINGS.CLIENT_ADMIN].includes(role as any);
};

export const isAtLeastPM = (role?: UserRole) => {
  if (!role) return false;
  return [
    ROLE_STRINGS.ADMIN,
    ROLE_STRINGS.CLIENT_ADMIN,
    ROLE_STRINGS.PROJECT_MANAGER,
    ROLE_STRINGS.SENIOR_PM,
    ROLE_STRINGS.SENIOR_PROJECT_MANAGER,
    ROLE_STRINGS.ASSISTANT_PM,
    ROLE_STRINGS.PROJECT_COORDINATOR,
  ].includes(role as any);
};

export const isAtLeastProgrammeManager = (role?: UserRole) => {
  if (!role) return false;
  return [ROLE_STRINGS.ADMIN, ROLE_STRINGS.CLIENT_ADMIN, ROLE_STRINGS.PROGRAMME_MANAGER].includes(role as any);
};

export const canCreateProject = (role?: UserRole) => {
  if (!role) return false;
  // Super Admin, Client Admin, and any Project Manager role can create projects.
  return role === ROLE_STRINGS.ADMIN || role === ROLE_STRINGS.CLIENT_ADMIN || isAtLeastPM(role);
};

export const canCreateProgramme = (role?: UserRole) => {
  if (!role) return false;
  // Super Admin and Client Admin can create programmes
  return [ROLE_STRINGS.ADMIN, ROLE_STRINGS.CLIENT_ADMIN].includes(role as any);
};

export const canCreateCompliance = (role?: UserRole) => {
  if (!role) return false;
  // Admin, Client Admin, and PM (SRO) roles can create compliance requirements
  return isAtLeastClientAdmin(role) || isAtLeastPM(role);
};

export const canCreateRisk = (role?: UserRole) => {
  if (!role) return false;
  // Admin, Client Admin, and PM (SRO) roles can create risks
  return isAtLeastClientAdmin(role) || isAtLeastPM(role);
};

export const canManageWorkspace = (role?: UserRole) => {
  return isAtLeastClientAdmin(role);
};

export const canViewExecutiveReports = (role?: UserRole) => {
  return isAtLeastClientAdmin(role);
};

export const isClientAdmin = (role?: string) => {
  return role === ROLE_STRINGS.CLIENT_ADMIN;
};

export const isPM = (role?: string) => {
  return [
    ROLE_STRINGS.PROJECT_MANAGER,
    ROLE_STRINGS.SENIOR_PM,
    ROLE_STRINGS.SENIOR_PROJECT_MANAGER,
    ROLE_STRINGS.ASSISTANT_PM,
    ROLE_STRINGS.PROJECT_COORDINATOR,
  ].includes((role || "") as any);
};

// Canonical role mapping — collapses granular role strings into the product tiers.
export function canonicalRole(role?: string | null): CanonicalRole {
  switch (role) {
    case ROLE_STRINGS.ADMIN:
      return "super_admin";
    case ROLE_STRINGS.CLIENT_ADMIN:
    case ROLE_STRINGS.PROGRAMME_MANAGER:
      return "client_admin";
    case ROLE_STRINGS.PROJECT_MANAGER:
    case ROLE_STRINGS.SENIOR_PM:
    case ROLE_STRINGS.SENIOR_PROJECT_MANAGER:
    case ROLE_STRINGS.ASSISTANT_PM:
    case "assistant_pm":
    case ROLE_STRINGS.PROJECT_COORDINATOR:
      return "project_manager";
    case ROLE_STRINGS.STRATEGIC_DIRECTOR:
      return "strategic_director";
    case ROLE_STRINGS.ENTERPRISE:
      return "enterprise";
    case ROLE_STRINGS.VIEWER:
      return "viewer";
    default:
      return "project_manager";
  }
}

export const isSupervisorRole = (role?: string | null) => {
  const c = canonicalRole(role);
  return c === "super_admin" || c === "client_admin";
};

export const isProjectManagerRole = (role?: string | null) => {
  return canonicalRole(role) === "project_manager";
};

export const pmLevelLabel = (level?: PmLevel | string | null): string => {
  switch (level) {
    case "senior":
      return "Senior Project Manager";
    case "standard":
      return "Project Manager";
    case "assistant":
      return "Assistant Project Manager";
    case "coordinator":
      return "Project Coordinator";
    default:
      return "Project Manager";
  }
};

export const isStrategicDirector = (role?: string | null) => {
  return canonicalRole(role) === "strategic_director";
};

// Technical Assurance Companion — Compliance Lead extra role.
// Stored alongside the user's primary role on `users/{uid}.extraRoles[]`
// (or its TAC-specific alias `tacExtraRoles[]`). Additive helper — does NOT
// widen the canonical role union, so the rest of the codebase is unaffected.
//
// A Compliance Lead is the in-house chartered reviewer who validates AI
// insights, resolves flagged enquiries and signs off on the first 50
// responses per project. Always held on top of an existing primary role
// (typically client_admin or project_manager + senior).
export function isComplianceLead(
  user:
    | {
        role?: string | null;
        extraRoles?: readonly string[] | null;
        tacExtraRoles?: readonly string[] | null;
      }
    | null
    | undefined,
): boolean {
  if (!user) return false;
  const extras = (user.extraRoles ?? []) as readonly string[];
  if (extras.includes("compliance_lead")) return true;
  const tacExtras = (user.tacExtraRoles ?? []) as readonly string[];
  return tacExtras.includes("compliance_lead");
}

// Multi-role authorisation: a user may hold additional canonical roles via `extraRoles`.
// Check the primary `role` first, then fall back to any entries in `extraRoles`.
// Leaves existing single-role helpers untouched — opt-in only.
export function userHasRole(
  user:
    | { role?: string | null; extraRoles?: CanonicalRole[] | null }
    | null
    | undefined,
  allowed: CanonicalRole[],
): boolean {
  if (!user) return false;
  const primary = canonicalRole(user.role);
  if (allowed.includes(primary)) return true;
  const extras = user.extraRoles;
  if (Array.isArray(extras)) {
    for (const r of extras) {
      if (allowed.includes(r)) return true;
    }
  }
  return false;
}
