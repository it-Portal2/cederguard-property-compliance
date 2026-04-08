export type UserRole =
  | "admin"
  | "client_admin"
  | "programme_manager"
  | "project_manager"
  | "senior_pm"
  | "senior_project_manager"
  | "assistant_project_manager"
  | "project_coordinator"
  | "viewer";

// Default admin emails – override with VITE_SYSTEM_ADMIN_EMAILS env var (comma-separated)
const DEFAULT_ADMIN_EMAILS = [
  "jitbanerjeesujan@gmail.com",
  "ali@cedarguard.co.uk",
  "support@cedarguard.co.uk",
  "admin@cedarguard.co.uk",
  "anthony.baafi@gmail.com",
  "anthony@cedar-strategies.com",
];

export const SYSTEM_ADMIN_EMAILS: string[] = (() => {
  const envEmails = import.meta.env.VITE_SYSTEM_ADMIN_EMAILS;
  if (envEmails && typeof envEmails === "string") {
    return envEmails
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);
  }
  return DEFAULT_ADMIN_EMAILS;
})();

export const SUPER_ADMIN_EMAIL =
  SYSTEM_ADMIN_EMAILS[0] || "admin@cedarguard.co.uk";

export const ROLES = {
  ADMIN: "admin",
  CLIENT_ADMIN: "client_admin",
  PROJECT_MANAGER: "project_manager",
} as const;

export const isSystemAdmin = (email?: string) => {
  return !!(email && SYSTEM_ADMIN_EMAILS.includes(email.toLowerCase()));
};

export const isSuperAdmin = (email?: string, role?: string) => {
  // A Super Admin is someone with the 'admin' role OR a system admin
  return role === "admin" || isSystemAdmin(email);
};

export const isAtLeastClientAdmin = (role?: UserRole) => {
  if (!role) return false;
  return ["admin", "client_admin"].includes(role);
};

export const isAtLeastPM = (role?: UserRole) => {
  if (!role) return false;
  return [
    "admin",
    "client_admin",
    "project_manager",
    "senior_pm",
    "senior_project_manager",
    "assistant_project_manager",
    "project_coordinator",
  ].includes(role);
};

export const isAtLeastProgrammeManager = (role?: UserRole) => {
  if (!role) return false;
  return ["admin", "client_admin", "programme_manager"].includes(role);
};

export const canCreateProject = (role?: UserRole) => {
  if (!role) return false;
  // Super Admin, Client Admin, and any Project Manager role can create projects.
  return role === "admin" || role === "client_admin" || isAtLeastPM(role);
};

export const canCreateProgramme = (role?: UserRole) => {
  if (!role) return false;
  // Super Admin and Client Admin can create programmes
  return ["admin", "client_admin"].includes(role);
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
  return role === "client_admin";
};

export const isPM = (role?: string) => {
  return [
    "project_manager",
    "senior_pm",
    "senior_project_manager",
    "assistant_project_manager",
    "project_coordinator",
  ].includes(role || "");
};
