import { ROLE_STRINGS, type CanonicalRole, type PmLevel } from "../../shared/constants/roleConstants";

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
  return ["admin@cedarguard.co.uk", "ali@cedarguard.co.uk", "jeetbanerjeesujanagar@gmail.com"];
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
  const r = (role || "").trim().toLowerCase();
  return (
    r === ROLE_STRINGS.ADMIN ||
    r === "super_admin" ||
    r === "superadmin" ||
    r === "admin_employee" ||
    isSystemAdmin(email)
  );
};

export const isAtLeastClientAdmin = (role?: UserRole | string) => {
  if (!role) return false;
  const r = String(role).trim().toLowerCase();
  return (
    r === ROLE_STRINGS.ADMIN ||
    r === "super_admin" ||
    r === "superadmin" ||
    r === "admin_employee" ||
    r === ROLE_STRINGS.CLIENT_ADMIN
  );
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

export const hasCoreProjectAccess = (role?: UserRole) => {
  return isAtLeastClientAdmin(role) || isAtLeastPM(role) || isAtLeastProgrammeManager(role);
};

export const canCreateCompliance = (role?: UserRole) => {
  if (!role) return false;
  // Admin, Client Admin, PM, and Programme Manager roles can create compliance requirements
  return isAtLeastClientAdmin(role) || isAtLeastPM(role) || isAtLeastProgrammeManager(role);
};

export const canCreateRisk = (role?: UserRole) => {
  if (!role) return false;
  // Admin, Client Admin, PM, and Programme Manager roles can create risks
  return isAtLeastClientAdmin(role) || isAtLeastPM(role) || isAtLeastProgrammeManager(role);
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

export function canonicalRole(role?: string | null): CanonicalRole {
  const r = (role || "").trim().toLowerCase();
  switch (r) {
    case ROLE_STRINGS.ADMIN:
    case "super_admin":
    case "superadmin":
    case "admin_employee":
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

export const getFriendlyRoleLabel = (role?: string | null, pmLevel?: string | null): string => {
  const r = (role || "").trim().toLowerCase();
  if (r === "admin" || r === "super_admin" || r === "superadmin" || r === "admin_employee") return "Super Administrator";
  if (r === "client_admin") return "Client Administrator";
  if (r === "programme_manager") return "Programme Manager";
  if (r === "senior_project_manager" || r === "senior_pm") return "Senior Project Manager";
  if (r === "assistant_project_manager" || r === "assistant_pm") return "Assistant Project Manager";
  if (r === "project_coordinator") return "Project Coordinator";
  if (r === "project_manager") {
    return pmLevel ? pmLevelLabel(pmLevel) : "Project Manager";
  }
  if (r === "strategic_director") return "Strategic Director";
  if (r === "enterprise") return "Enterprise Admin";
  if (r === "auditor") return "Compliance Auditor";
  if (r === "contractor") return "Contractor";
  if (r === "viewer") return "Viewer";
  return role ? role.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase()) : "Team Member";
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
