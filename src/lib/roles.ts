import { ROLE_STRINGS } from "./roleConstants";

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
