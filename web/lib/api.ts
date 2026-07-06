import { authBridge } from "./auth/authBridge";
import { isDesktop } from "./desktop/isDesktop";
import { useAccessRequestStore } from "../store/accessRequestStore";

const getAuthHeaders = async () => {
  const token = await authBridge.getIdToken();
  if (!token) {
    throw new Error("Not authenticated");
  }
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
};

// API URL resolution:
//  - Desktop  → `window.cedar.apiBaseUrl` (set in apps/desktop/main.cjs from
//    `app.isPackaged`; auto-switches between localhost in dev and the baked
//    production URL in the packaged DMG). No manual .env.local toggling.
//  - Web      → relative `/api` (Vercel rewrites to the serverless function).
//
// Env-var fallbacks remain for safety (and for testing harnesses that mock
// neither window.cedar nor a real Vite env), but the hot path on desktop is
// always the main-process-resolved URL exposed via preload.
const env = (import.meta as any).env || {};
const cedar = typeof window !== "undefined" ? (window as any).cedar : null;
const API_URL = isDesktop
  ? (cedar?.apiBaseUrl ||
     env.VITE_DESKTOP_API_URL ||
     env.VITE_API_URL ||
     "https://cedarguard.co.uk/api")
  : (env.VITE_API_URL || "/api");

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
      if (code === "ACCESS_RESTRICTED") {
        // Global safety net: surface the shared Request Access modal even for
        // calls that weren't pre-gated client-side. Callers still receive the
        // thrown ApiError for their own try/catch/loading-state handling.
        useAccessRequestStore.getState().open(action);
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
  // Unauthenticated: the user has no session yet when requesting a sign-in link.
  // Does NOT go through callApi (which requires a Bearer token). The server always
  // answers 200 { success: true } regardless of whether the address exists.
  sendMagicLink: async (email: string): Promise<{ success: boolean }> => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);
    try {
      const res = await fetch(`${API_URL}?action=sendMagicLink`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      if (!res.ok) throw new ApiError("Could not send the sign-in link", res.status);
      return { success: true };
    } catch (err: any) {
      clearTimeout(timeoutId);
      if (err.name === "AbortError") {
        throw new ApiError("Request timed out. Please try again.", 408);
      }
      if (err instanceof TypeError) {
        throw new ApiError("Network error. Please check your connection and try again.", 0);
      }
      throw err;
    }
  },

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
  /**
 * Generic Gemini wrapper — sends a prompt + config + optional `action`
 * tag to the existing `aiRoutes.geminiPrompt` server route. The route does
 * the dual-key + dual-model + retry rotation; the response is the parsed
 * JSON (or text) result. Used by TAC + any other surface that needs a
 * one-shot prompt without its own Firestore write side-effects.
   */
  geminiPrompt: (
    prompt: string,
    config?: any,
    action?: string,
    inlineParts?: Array<{ mimeType: string; data: string }>,
  ) =>
    callApi(
      "geminiPrompt",
      { prompt, config, action, inlineParts },
      90000,
    ),
  analyzeCompliance: (prompt: string, config: any) =>
    callApi("analyzeCompliance", { prompt, config }),
  analyzeRisks: (prompt: string, config: any) =>
    callApi("analyzeRisks", { prompt, config }),
  analyzeControls: (prompt: string, config: any) =>
    callApi("analyzeControls", { prompt, config }),
  chatWithAI: (messages: any[]) => callApi("chatWithAI", { messages }),

  // ── Fact-Check / Validation ──────────────────────────────────────────
  // runFactCheck makes TWO AI calls (web gather + structure) → long timeout.
  validationRunFactCheck: (payload: {
    surface: string;
    targetType?: string;
    targetId: string;
    contextId?: string | null;
    label?: string;
    content: string;
    ratingsContext?: string;
  }) => callApi("validationRunFactCheck", payload, 120000),
  validationGet: (surface: string, targetId: string) =>
    callApi("validationGet", { surface, targetId }),
  validationGetForContext: (contextId?: string | null) =>
    callApi("validationGetForContext", { contextId }),
  validationSetStatus: (
    surface: string,
    targetId: string,
    status: "validated" | "rejected",
    note?: string,
  ) => callApi("validationSetStatus", { surface, targetId, status, note }),
  validationAttachSource: (
    surface: string,
    targetId: string,
    attachment: {
      kind: "link" | "file";
      title?: string;
      url?: string;
      base64?: string;
      mime?: string;
    },
  ) => callApi("validationAttachSource", { surface, targetId, attachment }),
  validationRemoveAttachment: (surface: string, targetId: string, url: string) =>
    callApi("validationRemoveAttachment", { surface, targetId, url }),

  saveData: (collection: string, data: any, projectId?: string | null) =>
    callApi("saveData", { collection, data, projectId }),
  getData: (collection: string, projectId?: string | null) =>
    callApi("getData", { collection, projectId }),

  // Resource Planner (tenant-scoped schemes + assumptions + Excel import)
  resourceListSchemes: () => callApi("resourceListSchemes"),
  resourceUpsertScheme: (scheme: any) =>
    callApi("resourceUpsertScheme", { scheme }),
  resourceDeleteScheme: (id: string) =>
    callApi("resourceDeleteScheme", { id }),
  resourceGetAssumptions: () => callApi("resourceGetAssumptions"),
  resourceSaveAssumptions: (assumptions: any) =>
    callApi("resourceSaveAssumptions", { assumptions }),
  resourceImportSchemesDryRun: (base64: string) =>
    callApi("resourceImportSchemesDryRun", { base64 }, 120000),
  resourceImportSchemesCommit: (base64: string) =>
    callApi("resourceImportSchemesCommit", { base64 }, 120000),

  // Controls library (tenant-scoped first-class control records)
  controlsList: () => callApi("controlsList"),
  controlsUpsert: (control: any) => callApi("controlsUpsert", { control }),
  controlsDelete: (id: string) => callApi("controlsDelete", { id }),

  // Incident management (tenant-scoped formal incident register)
  incidentsList: () => callApi("incidentsList"),
  incidentsUpsert: (incident: any) => callApi("incidentsUpsert", { incident }),
  incidentsDelete: (id: string) => callApi("incidentsDelete", { id }),

  // Learning & improvement — AI-suggested actions from assurance signals
  learningSuggestImprovements: (signals: string) =>
    callApi("learningSuggestImprovements", { signals }, 120000),

  // Assurance escalation hub (tenant-scoped escalated alerts + their AI actions)
  assuranceList: () => callApi("assuranceList"),
  assuranceUpsert: (alert: any) => callApi("assuranceUpsert", { alert }),
  assuranceDelete: (id: string) => callApi("assuranceDelete", { id }),
  assuranceGenerateActions: (alert: any) =>
    callApi("assuranceGenerateActions", { alert }, 120000),

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
  // Add an evidence record. Two call shapes:
  //   - File upload: pass `file: { base64, mime }` alongside `document`.
  //     Server uploads to GCS as a private object via Admin SDK + writes
  //     Firestore. Capped at 3 MB per file (Vercel serverless body limit).
  //   - External link: omit `file`; pass the link URL inside `document.url`
  //     with `document.storagePath: 'external-link'`. Server skips upload.
  addEvidence: (
    projectId: string,
    document: any,
    file?: { base64: string; mime: string },
  ) => callApi("addEvidence", { projectId, document, file }),
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
  adminGetActivity: (limit?: number) =>
    callApi("adminGetActivity", limit ? { limit } : {}),
  adminGetProjects: () => callApi("adminGetProjects"),
  adminGetProgrammes: () => callApi("adminGetProgrammes"),

  getMyAccessRequest: () => callApi("getMyAccessRequest"),
  createAccessRequest: (reason?: string, attemptedAction?: string) =>
    callApi("createAccessRequest", { reason, attemptedAction }),
  adminGetAccessRequests: () => callApi("adminGetAccessRequests"),
  adminApproveAccessRequest: (requestId: string) =>
    callApi("adminApproveAccessRequest", { requestId }),
  adminRejectAccessRequest: (requestId: string, reason?: string) =>
    callApi("adminRejectAccessRequest", { requestId, reason }),
  getAssignablePMs: () => callApi("getAssignablePMs"),
  clientGetProgrammeManagers: () => callApi("clientGetProgrammeManagers"),

  adminGetMappings: () => callApi("adminGetMappings"),
  adminSaveMapping: (mapping: any) => callApi("adminSaveMapping", { mapping }),
  adminDeleteMapping: (id: string) => callApi("adminDeleteMapping", { id }),

  adminGetPricingConfig: () => callApi("adminGetPricingConfig"),
  adminUpdatePricingConfig: (config: any) =>
    callApi("adminUpdatePricingConfig", { config }),

  // ── AI model configuration ──────────────────────────────────────────
  // Super-admin endpoints for the AI Models admin tab; auth-only endpoint
  // exposing the active chat lineup to every signed-in user; super-admin
  // endpoint exposing the live OpenRouter catalog for the picker dropdown.
  adminGetAIModelConfig: () => callApi("adminGetAIModelConfig"),
  adminUpdateAIModelConfig: (config: any) =>
    callApi("adminUpdateAIModelConfig", { config }),
  getActiveChatModels: () => callApi("getActiveChatModels"),
  adminGetOpenRouterCatalog: (opts: { force?: boolean } = {}) =>
    callApi("adminGetOpenRouterCatalog", { force: opts.force === true }),

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

  // Programme Governance — editor sandbox
  governanceSandboxSaveSection: (sectionId: string, content: any, wordCount: number) =>
    callApi("governanceSandboxSaveSection", { sectionId, content, wordCount }),
  governanceSandboxLoadSection: (sectionId: string) =>
    callApi("governanceSandboxLoadSection", { sectionId }),
  governanceRenderSandboxPdf: (
    content: any,
    extras?: {
      councilLogoDataUri?: string | null;
      signatureDataUris?: Partial<Record<"A" | "B", string>>;
      meta?: Record<string, any>;
    },
  ) => callApi("governanceRenderSandboxPdf", { content, ...(extras ?? {}) }),

  // Programme Governance — branding assets
  governanceGetCouncilAssets: () => callApi("governanceGetCouncilAssets"),
  governanceUploadCouncilLogo: (fileBase64: string) =>
    callApi("governanceUploadCouncilLogo", { fileBase64 }),
  governanceDeleteCouncilLogo: () => callApi("governanceDeleteCouncilLogo"),
  governanceUploadCouncilStamp: (stampId: string, label: string, fileBase64: string) =>
    callApi("governanceUploadCouncilStamp", { stampId, label, fileBase64 }),
  governanceDeleteCouncilStamp: (stampId: string) =>
    callApi("governanceDeleteCouncilStamp", { stampId }),
  governanceGetUserSignature: () => callApi("governanceGetUserSignature"),
  governanceUploadUserSignature: (fileBase64: string) =>
    callApi("governanceUploadUserSignature", { fileBase64 }),
  governanceDeleteUserSignature: () => callApi("governanceDeleteUserSignature"),

  // Programme Governance — framework / bodies / thresholds / ToR
  governanceGetFramework: () => callApi("governanceGetFramework"),
  governancePublishFramework: () => callApi("governancePublishFramework"),
  governanceUpsertBody: (bodyId: string, patch: any) =>
    callApi("governanceUpsertBody", { bodyId, patch }),
  governanceDeleteBody: (bodyId: string) =>
    callApi("governanceDeleteBody", { bodyId }),
  governanceUpsertThreshold: (thresholdId: string, patch: any) =>
    callApi("governanceUpsertThreshold", { thresholdId, patch }),
  governanceDeleteThreshold: (thresholdId: string) =>
    callApi("governanceDeleteThreshold", { thresholdId }),
  governanceListToRVersions: (ownerBodyId: string) =>
    callApi("governanceListToRVersions", { ownerBodyId }),
  governanceUpsertToR: (ownerBodyId: string, patch: any, publish?: boolean) =>
    callApi("governanceUpsertToR", { ownerBodyId, patch, publish: !!publish }),
  governanceExportFrameworkDiagram: () =>
    callApi("governanceExportFrameworkDiagram"),
  governanceExportFrameworkConstitution: () =>
    callApi("governanceExportFrameworkConstitution"),

  // Programme Governance — report templates
  governanceListTemplates: () => callApi("governanceListTemplates"),
  governanceGetTemplate: (templateId: string) =>
    callApi("governanceGetTemplate", { templateId }),
  governanceUpsertTemplate: (templateId: string, patch: any) =>
    callApi("governanceUpsertTemplate", { templateId, patch }),
  governancePublishTemplate: (templateId: string) =>
    callApi("governancePublishTemplate", { templateId }),
  governanceDuplicateTemplate: (templateId: string, newId: string) =>
    callApi("governanceDuplicateTemplate", { templateId, newId }),
  governanceAiRecommendTemplate: (intake: string) =>
    callApi("governanceAiRecommendTemplate", { intake }),

  // Programme Governance — Forward Plan
  governanceListForwardPlanItems: () => callApi("governanceListForwardPlanItems"),
  governanceGetForwardPlanItem: (itemId: string) =>
    callApi("governanceGetForwardPlanItem", { itemId }),
  governanceUpsertForwardPlanItem: (itemId: string, patch: any) =>
    callApi("governanceUpsertForwardPlanItem", { itemId, patch }),
  governanceSoftDeleteForwardPlanItem: (itemId: string, reason: string) =>
    callApi("governanceSoftDeleteForwardPlanItem", { itemId, reason }),
  governanceRestoreForwardPlanItem: (itemId: string) =>
    callApi("governanceSoftDeleteForwardPlanItem", { itemId, restore: true }),
  governanceMarkForwardPlanItemDecided: (itemId: string, outcome?: string) =>
    callApi("governanceMarkForwardPlanItemDecided", { itemId, outcome }),
  governanceImportForwardPlanDryRun: (fileBase64: string) =>
    callApi("governanceImportForwardPlanDryRun", { fileBase64 }),
  governanceImportForwardPlanCommit: (fileBase64: string) =>
    callApi("governanceImportForwardPlanCommit", { fileBase64 }),
  // Reports CRUD shell
  governanceListReports: () => callApi("governanceListReports"),
  governanceGetReport: (reportId: string) =>
    callApi("governanceGetReport", { reportId }),
  governanceUpsertReport: (reportId: string, patch: any) =>
    callApi("governanceUpsertReport", { reportId, patch }),
  governanceSoftDeleteReport: (reportId: string, reason: string) =>
    callApi("governanceSoftDeleteReport", { reportId, reason }),
  governanceRestoreReport: (reportId: string) =>
    callApi("governanceSoftDeleteReport", { reportId, restore: true }),
  // Report sections (Tiptap editor)
  governanceListReportSections: (reportId: string) =>
    callApi("governanceListReportSections", { reportId }),
  governanceSaveReportSection: (
    reportId: string,
    sectionId: string,
    patch: { content?: any; wordCount?: number },
  ) => callApi("governanceSaveReportSection", { reportId, sectionId, patch }),
  // Report state machine + amendments
  governanceSubmitReport: (reportId: string) =>
    callApi("governanceSubmitReport", { reportId }),
  governanceWithdrawReport: (reportId: string) =>
    callApi("governanceWithdrawReport", { reportId }),
  governanceRequestAmendments: (
    reportId: string,
    amendments: Array<{ text: string; sectionId?: string | null }>,
  ) => callApi("governanceRequestAmendments", { reportId, amendments }),
  governanceApproveReport: (reportId: string) =>
    callApi("governanceApproveReport", { reportId }),
  governanceAbandonReport: (reportId: string, reason: string) =>
    callApi("governanceAbandonReport", { reportId, reason }),
  governanceListAmendments: (reportId: string) =>
    callApi("governanceListAmendments", { reportId }),
  governanceResolveAmendment: (amendmentId: string) =>
    callApi("governanceResolveAmendment", { amendmentId }),
  // Report PDF + sign Part A
  governanceRenderReportPdf: (
    reportId: string,
    opts?: { noWatermark?: boolean; redactPart2?: boolean },
  ) =>
    callApi("governanceRenderReportPdf", {
      reportId,
      noWatermark: opts?.noWatermark === true,
      redactPart2: opts?.redactPart2 === true,
    }),
  governanceSignPartA: (reportId: string) =>
    callApi("governanceSignPartA", { reportId }),
  governanceListReviewers: () => callApi("governanceListReviewers"),
  // Senior PM intermediate review + Unlock-for-correction
  governanceSeniorPmApprove: (reportId: string) =>
    callApi("governanceSeniorPmApprove", { reportId }),
  governanceSeniorPmRequestAmendments: (
    reportId: string,
    amendments: Array<{ text: string; sectionId?: string | null }>,
  ) => callApi("governanceSeniorPmRequestAmendments", { reportId, amendments }),
  governanceUnlockReport: (reportId: string, reason: string) =>
    callApi("governanceUnlockReport", { reportId, reason }),
  // My Reports (PM personal workspace)
  governanceListMyOpenAmendments: () =>
    callApi("governanceListMyOpenAmendments"),
  // Meetings CRUD shell
  governanceListMeetings: () => callApi("governanceListMeetings"),
  governanceGetMeeting: (meetingId: string) =>
    callApi("governanceGetMeeting", { meetingId }),
  governanceUpsertMeeting: (meetingId: string, patch: any) =>
    callApi("governanceUpsertMeeting", { meetingId, patch }),
  governanceSoftDeleteMeeting: (meetingId: string, reason: string) =>
    callApi("governanceSoftDeleteMeeting", { meetingId, reason }),
  governanceRestoreMeeting: (meetingId: string) =>
    callApi("governanceSoftDeleteMeeting", { meetingId, restore: true }),
  governanceMarkMeetingHeld: (meetingId: string) =>
    callApi("governanceMarkMeetingHeld", { meetingId }),
  governanceCancelMeeting: (meetingId: string, reason: string) =>
    callApi("governanceCancelMeeting", { meetingId, reason }),
  governanceRescheduleMeeting: (
    meetingId: string,
    newDate: string,
    reason: string,
    newTimeStart?: string,
    newTimeEnd?: string,
  ) =>
    callApi("governanceRescheduleMeeting", {
      meetingId,
      newDate,
      newTimeStart,
      newTimeEnd,
      reason,
    }),
  // Meetings tabs
  governanceSaveMeetingMinutes: (
    meetingId: string,
    content: any,
    wordCount: number,
  ) =>
    callApi("governanceSaveMeetingMinutes", { meetingId, content, wordCount }),
  governanceAddMeetingDecision: (meetingId: string, text: string) =>
    callApi("governanceAddMeetingDecision", { meetingId, text }),
  governanceDeleteMeetingDecision: (meetingId: string, decisionId: string) =>
    callApi("governanceDeleteMeetingDecision", { meetingId, decisionId }),
  governanceAddMeetingActionItem: (
    meetingId: string,
    text: string,
    ownerLabel: string,
    dueDate: string | null,
  ) =>
    callApi("governanceAddMeetingActionItem", {
      meetingId,
      text,
      ownerLabel,
      dueDate,
    }),
  governanceToggleMeetingActionItem: (meetingId: string, actionItemId: string) =>
    callApi("governanceToggleMeetingActionItem", { meetingId, actionItemId }),
  governanceDeleteMeetingActionItem: (meetingId: string, actionItemId: string) =>
    callApi("governanceDeleteMeetingActionItem", { meetingId, actionItemId }),
  governanceUpdateMeetingLinks: (
    meetingId: string,
    linkedReportIds: string[] | undefined,
    linkedProjectIds: string[] | undefined,
  ) =>
    callApi("governanceUpdateMeetingLinks", {
      meetingId,
      linkedReportIds,
      linkedProjectIds,
    }),
  // workspace member picker (reusable primitive)
  governanceListWorkspaceMembers: () =>
    callApi("governanceListWorkspaceMembers"),
  // Schedule view + bulk creation
  governanceBulkCreateRecurringMeetings: (params: {
    governanceBodyId: string;
    pattern: "weekly" | "monthly" | "quarterly";
    dayOfMonth?: number;
    weekDay?: number;
    startDate: string;
    numOccurrences: number;
    timeStart: string;
    timeEnd: string;
    location: string;
    chairLabel: string;
    shiftBankHolidays?: boolean;
  }) => callApi("governanceBulkCreateRecurringMeetings", params),
  governanceImportMeetingsDryRun: (fileBase64: string) =>
    callApi("governanceImportMeetingsDryRun", { fileBase64 }),
  governanceImportMeetingsCommit: (fileBase64: string) =>
    callApi("governanceImportMeetingsCommit", { fileBase64 }),
  governanceExportMeetingsXlsx: () =>
    callApi("governanceExportMeetingsXlsx"),
  // Proposed/Confirm/Decline/Withdraw flow
  governanceConfirmFpItem: (itemId: string) =>
    callApi("governanceConfirmFpItem", { itemId }),
  governanceDeclineFpItem: (itemId: string, reason: string) =>
    callApi("governanceDeclineFpItem", { itemId, reason }),
  governanceWithdrawFpItem: (itemId: string) =>
    callApi("governanceWithdrawFpItem", { itemId }),
  // Project Governance Folder
  governanceListProjectDocs: (projectId?: string) =>
    callApi("governanceListProjectDocs", { projectId }),
  governanceGetProjectDoc: (docId: string) =>
    callApi("governanceGetProjectDoc", { docId }),
  governanceUpsertProjectDoc: (docId: string, patch: any) =>
    callApi("governanceUpsertProjectDoc", { docId, patch }),
  governancePublishProjectDoc: (docId: string) =>
    callApi("governancePublishProjectDoc", { docId }),
  governanceListProjectDocVersions: (docId: string) =>
    callApi("governanceListProjectDocVersions", { docId }),
  governanceSoftDeleteProjectDoc: (docId: string, reason: string) =>
    callApi("governanceSoftDeleteProjectDoc", { docId, reason }),
  governanceRestoreProjectDoc: (docId: string) =>
    callApi("governanceSoftDeleteProjectDoc", { docId, restore: true }),
  // Archive & Audit. optional `asOfMonth` switches
  // the aggregator to the monthly snapshot.
  governanceListArchive: (args: { asOfMonth?: string } = {}) =>
    callApi("governanceListArchive", args),
  governanceGetArchiveAuditTrail: (entityId: string) =>
    callApi("governanceGetArchiveAuditTrail", { entityId }),
  governanceExportArchiveFoi: () => callApi("governanceExportArchiveFoi"),
  // Governance Dashboard (role-aware aggregator).
  // optional `asOfMonth` switches the dashboard to the monthly snapshot.
  governanceGetDashboard: (args: { asOfMonth?: string } = {}) =>
    callApi("governanceGetDashboard", args),
  // Standalone briefing rewrite (Gemini with stub fallback)
  governanceGenerateBriefing: (params: {
    role: "pgm" | "pm";
    stubLines: string[];
    greetingName?: string;
  }) => callApi("governanceGenerateBriefing", params),
  // Chase engine + manual nudge + chase log
  governanceNudgeItem: (itemId: string) =>
    callApi("governanceNudgeItem", { itemId }),
  governanceListChaseEvents: () => callApi("governanceListChaseEvents"),

  // Automatic detection & alert engine — in-app reads (the cron write path is
  // not exposed to the client).
  listDetectedAlerts: () => callApi("listDetectedAlerts"),
  markDetectedAlertRead: (id: string) =>
    callApi("markDetectedAlertRead", { id }),

  // Historical Reporting Capability — month-end snapshot reads.
  // Cron-driven write paths are not exposed to the client. Super-admin
  // correction endpoint lands in.
  hrcListAvailableMonths: () => callApi("hrcListAvailableMonths"),
  hrcReadSnapshot: (yearMonth: string, collection: string) =>
    callApi("hrcReadSnapshot", { yearMonth, collection }),
  hrcRunMonthlySnapshot: (
    args: { yearMonth?: string; force?: boolean } = {},
  ) => callApi("hrcRunMonthlySnapshot", args),
  hrcInspectSnapshot: (yearMonth: string, clientId?: string) =>
    callApi("hrcInspectSnapshot", clientId ? { yearMonth, clientId } : { yearMonth }),
  hrcGetDeploymentMeta: () => callApi("hrcGetDeploymentMeta"),
  // super_admin correction.
  hrcCorrectSnapshotRow: (args: {
    yearMonth: string;
    collection: string;
    docId: string;
    patch: Record<string, any>;
    reason: string;
    clientId?: string;
  }) => callApi("hrcCorrectSnapshotRow", args),
  hrcListCorrections: (args: {
    yearMonth: string;
    collection?: string;
    docId?: string;
    clientId?: string;
  }) => callApi("hrcListCorrections", args),

  // Technical Assurance Companion (TAC) — Enquiry capture
  tacListEnquiries: (args?: { mine?: boolean }) =>
    callApi("tacListEnquiries", args ?? {}),
  tacGetEnquiry: (enquiryId: string) =>
    callApi("tacGetEnquiry", { enquiryId }),
  tacUpsertEnquiry: (
    enquiryId: string | null,
    patch: Record<string, any>,
  ) => callApi("tacUpsertEnquiry", { enquiryId, patch }),
  // Base64 file upload — server decodes, uploads to GCS via Admin SDK with
  // makePublic, and appends metadata to the enquiry doc (with the stable
  // public URL). Capped at 3 MB per file due to Vercel's 4.5 MB serverless
  // body limit. Downloads use the stored public URL directly (no API call).
  tacAttachFile: (args: {
    enquiryId: string;
    fileName: string;
    mimeType: string;
    fileBase64: string;
  }) => callApi("tacAttachFile", args),
  tacRemoveAttachment: (enquiryId: string, attachmentId: string) =>
    callApi("tacRemoveAttachment", { enquiryId, attachmentId }),
  /**
 * Permanently deletes an enquiry — wipes the doc, every `tabs/*`
 * deliverable, and every Firebase Storage attachment referenced by the
 * enquiry. Issued RFIs in the workspace register are NOT cascaded.
   */
  tacDeleteEnquiry: (enquiryId: string) =>
    callApi("tacDeleteEnquiry", { enquiryId }),

  // Technical Assurance Companion (TAC) — two-step insight pipeline
  // (the actual Gemini call goes through the existing `geminiPrompt` route).
  tacBuildInsightPrompt: (enquiryId: string) =>
    callApi("tacBuildInsightPrompt", { enquiryId }),
  tacFinaliseInsight: (enquiryId: string, summary: any) =>
    callApi("tacFinaliseInsight", { enquiryId, summary }),
  tacGetEnquiryDeliverable: (
    enquiryId: string,
    tabId: "summary" | "drawing" | "rfi" | "costProgramme" | "compliance" = "summary",
  ) => callApi("tacGetEnquiryDeliverable", { enquiryId, tabId }),

  // Technical Assurance Companion (TAC) — RFI tab + register
  tacUpsertRfiDraft: (enquiryId: string, rfi: any) =>
    callApi("tacUpsertRfiDraft", { enquiryId, rfi }),
  tacIssueRfi: (enquiryId: string) =>
    callApi("tacIssueRfi", { enquiryId }),
  tacListRfis: (projectId?: string) =>
    callApi("tacListRfis", projectId ? { projectId } : {}),
  // Cost & programme tab.
  tacListCostRates: () => callApi("tacListCostRates", {}),
  tacExportCostCsv: (enquiryId: string) =>
    callApi("tacExportCostCsv", { enquiryId }),
  // Compliance & citations tab.
  tacDownloadCompliancePack: (enquiryId: string) =>
    callApi("tacDownloadCompliancePack", { enquiryId }),
  tacSaveToGoldenThread: (enquiryId: string) =>
    callApi("tacSaveToGoldenThread", { enquiryId }),
  // Feedback + Audit + Archive.
  tacSubmitFeedback: (args: {
    enquiryId: string;
    thumbs: "up" | "down";
    reason?: "inaccurate" | "missed_regulation" | "wrong_stage" | "other";
    note?: string;
  }) => callApi("tacSubmitFeedback", args),
  tacFlagForAudit: (enquiryId: string, reviewerNote?: string) =>
    callApi("tacFlagForAudit", { enquiryId, reviewerNote }),
  tacResolveFlag: (enquiryId: string, reviewerNote: string) =>
    callApi("tacResolveFlag", { enquiryId, reviewerNote }),
  tacArchiveEnquiry: (enquiryId: string, restore?: boolean) =>
    callApi("tacArchiveEnquiry", { enquiryId, restore: !!restore }),
  tacListAuditFlagged: () => callApi("tacListAuditFlagged", {}),
  // Close + Unlock + Decision Log + Add to PM report.
  tacCloseEnquiry: (enquiryId: string) =>
    callApi("tacCloseEnquiry", { enquiryId }),
  tacUnlockEnquiry: (enquiryId: string, reason: string) =>
    callApi("tacUnlockEnquiry", { enquiryId, reason }),
  tacExportDecisionLog: (projectId: string) =>
    callApi("tacExportDecisionLog", { projectId }),
  tacAddToProjectReport: (enquiryId: string) =>
    callApi("tacAddToProjectReport", { enquiryId }),
  tacRemoveFromProjectReport: (enquiryId: string) =>
    callApi("tacRemoveFromProjectReport", { enquiryId }),
  tacListProjectReportEnquiries: (projectId: string) =>
    callApi("tacListProjectReportEnquiries", { projectId }),
  // Share-for-review.
  tacShareEnquiry: (args: {
    enquiryId: string;
    sharedWithUid: string;
    note?: string;
  }) => callApi("tacShareEnquiry", args),
  tacDecideOnShare: (args: {
    enquiryId: string;
    shareId: string;
    decision: "approved" | "rejected";
    decisionNote?: string;
  }) => callApi("tacDecideOnShare", args),
  tacListSharedWithMe: () => callApi("tacListSharedWithMe", {}),
  // Polish.
  tacScanCitationIntegrity: () => callApi("tacScanCitationIntegrity", {}),
  // Admin rates editor.
  tacUpsertCostRate: (rate: {
    rateId: string;
    category: string;
    description: string;
    unit: string;
    rate: number;
  }) => callApi("tacUpsertCostRate", { rate }),
  tacDeleteCostRate: (rateId: string) =>
    callApi("tacDeleteCostRate", { rateId }),

  // --- Integrations (per-tenant external connections) ---
  integrationsGetStatus: () => callApi("integrationsGetStatus", {}),
  integrationSaveProvider: (
    provider: string,
    config: Record<string, any>,
    secrets?: Record<string, any>,
  ) => callApi("integrationSaveProvider", { provider, config, secrets }),
  integrationDisconnect: (provider: string) =>
    callApi("integrationDisconnect", { provider }),
  integrationTest: (provider: string) =>
    callApi("integrationTest", { provider }),
  integrationGenerateFeedKey: () =>
    callApi("integrationGenerateFeedKey", {}),
  integrationRevokeFeedKey: () => callApi("integrationRevokeFeedKey", {}),
};
