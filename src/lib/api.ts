import { auth } from "./firebase";

const getAuthHeaders = async () => {
  const user = auth.currentUser;
  if (!user) {
    throw new Error("Not authenticated");
  }
  const token = await user.getIdToken();
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
};

const API_URL = (import.meta as any).env.VITE_API_URL || "/api";

export class ApiError extends Error {
  status: number;
  retryAfter?: number;
  code?: string;
  constructor(
    message: string,
    status: number,
    retryAfter?: number,
    extras?: { code?: string },
  ) {
    super(message);
    this.status = status;
    this.retryAfter = retryAfter;
    this.code = extras?.code;
    this.name = "ApiError";
  }
}

async function callApi(
  action: string,
  body: any = {},
  timeout: number = 120000,
) {
  const headers = await getAuthHeaders();

  // Create an AbortController for timeout management
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const res = await fetch(`${API_URL}?action=${encodeURIComponent(action)}`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!res.ok) {
      let msg = "Request failed";
      let retryAfter: any = null;
      let code: string | undefined = undefined;
      const textResponse = await res.text();
      try {
        const parsed = JSON.parse(textResponse);
        if (parsed.error) msg = parsed.error;
        else if (parsed.message) msg = parsed.message;
        if (parsed.retryAfter) retryAfter = parsed.retryAfter;
        if (typeof parsed.code === "string") code = parsed.code;
      } catch (e) {
        msg = textResponse || `${res.status} ${res.statusText}`;
      }
      throw new ApiError(msg, res.status, retryAfter, { code });
    }

    const textResponse = await res.text();
    try {
      return JSON.parse(textResponse);
    } catch (e) {
      throw new Error(
        `Failed to parse response: ${textResponse.substring(0, 50)}...`,
      );
    }
  } catch (err: any) {
    clearTimeout(timeoutId);
    if (err.name === "AbortError") {
      throw new ApiError(
        `Request timed out after ${timeout / 1000} seconds. Please check your connection and try again.`,
        408,
      );
    }
    if (err instanceof TypeError) {
      throw new ApiError(
        "Network error. Please check your connection and try again.",
        0,
      );
    }
    throw err;
  }
}

export const api = {
  createProject: (data: any) => callApi("createProject", { data }),
  getProjects: () => callApi("getProjects"),
  updateProject: (id: string, data: any) =>
    callApi("updateProject", { id, data }),
  updateProgramme: (id: string, data: any) =>
    callApi("updateProgramme", { id, data }),
  deleteProject: (id: string) => callApi("deleteProject", { id }),
  deleteProgramme: (id: string) => callApi("deleteProgramme", { id }),

  // Client Admin: invite a PM, view all PMs and their projects.
  // Invites always create a canonical project_manager; pmLevel is a sub-level.
  inviteProjectManager: (
    pmEmail: string,
    pmName: string,
    pmLevel: string,
    programmeIds?: string[],
  ) =>
    callApi("inviteProjectManager", {
      pmEmail,
      pmName,
      pmLevel,
      programmeIds: programmeIds || [],
    }),
  clientGetPMs: () => callApi("clientGetPMs"),
  clientGetTeam: () => callApi("clientGetTeam"),
  clientRemoveUser: (targetUid: string) =>
    callApi("clientRemoveUser", { targetUid }),
  cancelInvite: (inviteId: string) => callApi("cancelInvite", { inviteId }),
  updateInvite: (
    inviteId: string,
    updates: { pmLevel?: string; programmeIds?: string[]; name?: string },
  ) => callApi("updateInvite", { inviteId, ...updates }),
  clientUpdateUserRole: (targetUid: string, role: string) =>
    callApi("clientUpdateUserRole", { targetUid, role }),
  clientGetProjects: () => callApi("clientGetProjects"),
  // Full enriched project data with compliance, risk, and issues summaries per project
  clientGetProjectData: () => callApi("clientGetProjectData"),
  getPortfolioData: () => callApi("getPortfolioData"),
  clientGetPortfolioInfo: () => callApi("clientGetPortfolioInfo"),

  testGemini: (prompt: string) => callApi("geminiPrompt", { prompt }),
  analyzeCompliance: (prompt: string, config: any) =>
    callApi("analyzeCompliance", { prompt, config }),
  analyzeRisks: (prompt: string, config: any) =>
    callApi("analyzeRisks", { prompt, config }),
  analyzeControls: (prompt: string, config: any) =>
    callApi("analyzeControls", { prompt, config }),
  chatWithAI: (messages: any[]) => callApi("chatWithAI", { messages }),

  saveData: (collection: string, data: any, projectId?: string | null) =>
    callApi("saveData", { collection, data, projectId }),
  getData: (collection: string, projectId?: string | null) =>
    callApi("getData", { collection, projectId }),
  clientGetProgrammesByManager: (supervisorId: string) =>
    callApi("clientGetProgrammesByManager", { supervisorId }),
  clientGetMySupervisors: () => callApi("clientGetMySupervisors"),
  getPMsAssignedToProgramme: (programmeId: string) =>
    callApi("getPMsAssignedToProgramme", { programmeId }),
  addPMToProgramme: (programmeId: string, userId: string) =>
    callApi("addPMToProgramme", { programmeId, userId }),
  removePMFromProgramme: (programmeId: string, userId: string) =>
    callApi("removePMFromProgramme", { programmeId, userId }),
  setPmLevel: (targetUid: string, pmLevel: string) =>
    callApi("setPmLevel", { targetUid, pmLevel }),
  clientAssignSupervisor: (targetUid: string, supervisorUid: string | null) =>
    callApi("clientAssignSupervisor", { targetUid, supervisorUid }),
  clientUpdateMemberProfile: (targetUid: string, displayName: string) =>
    callApi("clientUpdateMemberProfile", { targetUid, displayName }),
  adminAssignSupervisor: (targetUid: string, supervisorUid: string | null) =>
    callApi("adminAssignSupervisor", { targetUid, supervisorUid }),
  adminPromoteUser: (targetUid: string, newRole: string, pmLevel?: string) =>
    callApi("adminPromoteUser", { targetUid, newRole, pmLevel }),
  getSystemMappings: () => callApi("getSystemMappings"),

  getEvidence: (projectId: string) => callApi("getEvidence", { projectId }),
  addEvidence: (projectId: string, document: any) =>
    callApi("addEvidence", { projectId, document }),
  deleteEvidence: (docId: string) => callApi("deleteEvidence", { docId }),
  updateEvidence: (docId: string, updates: any) =>
    callApi("updateEvidence", { docId, updates }),

  saveProfile: (profile: any) => callApi("saveProfile", { profile }),
  getProfile: () => callApi("getProfile"),
  deleteUserAccount: (targetUid?: string) =>
    callApi("deleteUserAccount", { targetUid }),

  adminStats: () => callApi("adminStats"),
  adminGetUsers: () => callApi("adminGetUsers"),
  adminUpdateUser: (targetUid: string, updates: any) =>
    callApi("adminUpdateUser", { targetUid, updates }),
  adminGetActivity: () => callApi("adminGetActivity"),
  adminGetProjects: () => callApi("adminGetProjects"),
  adminGetProgrammes: () => callApi("adminGetProgrammes"),
  getAssignablePMs: () => callApi("getAssignablePMs"),
  clientGetProgrammeManagers: () => callApi("clientGetProgrammeManagers"),

  adminGetMappings: () => callApi("adminGetMappings"),
  adminSaveMapping: (mapping: any) => callApi("adminSaveMapping", { mapping }),
  adminDeleteMapping: (id: string) => callApi("adminDeleteMapping", { id }),

  adminGetPricingConfig: () => callApi("adminGetPricingConfig"),
  adminUpdatePricingConfig: (config: any) =>
    callApi("adminUpdatePricingConfig", { config }),

  adminCreateInvoice: (invoice: any) =>
    callApi("adminCreateInvoice", { invoice }),
  adminGetInvoices: () => callApi("adminGetInvoices"),
  adminDeleteInvoice: (id: string) => callApi("adminDeleteInvoice", { id }),
  clientGetInvoices: () => callApi("clientGetInvoices"),
  clientResetWorkspaceData: () => callApi("clientResetWorkspaceData"),

  adminDeleteProgramme: (id: string) => callApi("adminDeleteProgramme", { id }),
  adminDeleteProject: (id: string) => callApi("adminDeleteProject", { id }),
  adminTransferProgramme: (id: string, targetUser: any) =>
    callApi("adminTransferProgramme", { id, targetUser }),
  adminTransferProject: (id: string, targetUser: any) =>
    callApi("adminTransferProject", { id, targetUser }),

  // API Key Management
  generateApiKey: (name: string) => callApi("generateApiKey", { name }),
  getApiKeys: () => callApi("getApiKeys"),
  revokeApiKey: (keyId: string) => callApi("revokeApiKey", { keyId }),

  getProjectById: (id: string) => callApi("getProjectById", { id }),
  getProgrammeById: (id: string) => callApi("getProgrammeById", { id }),

  // Compliance Library Management
  getComplianceLibrary: () => callApi("getComplianceLibrary"),
  upsertComplianceLibraryItem: (item: any) =>
    callApi("upsertComplianceLibraryItem", { item }),
  deleteComplianceLibraryItem: (id: string) =>
    callApi("deleteComplianceLibraryItem", { id }),
  getComplianceDomains: () => callApi("getComplianceDomains"),
  upsertComplianceDomain: (name: string) =>
    callApi("upsertComplianceDomain", { name }),

  // User Preferences
  savePreference: (key: string, value: any) =>
    callApi("savePreference", { key, value }),
  getPreferences: () => callApi("getPreferences"),
};
