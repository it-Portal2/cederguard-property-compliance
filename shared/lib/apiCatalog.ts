// Single source of truth for the public API reference. Pure data — no runtime
// imports — so it is safe to import from BOTH web/ (docs page render) and api/
// (the coverage test that cross-checks it against the real route registry).
//
// Every callable action MUST appear here (enforced by api/__tests__/apiCatalog.test.ts),
// except the INTERNAL_ACTIONS below. Detail is tiered honestly: core external-facing
// actions carry full params + multi-language examples; the internal long tail carries
// at least a description + required role, so nothing is hidden but we don't fabricate
// hundreds of code samples for operations no external caller uses.

export interface ApiParam {
  name: string;
  type: string;
  required?: boolean;
  description: string;
}

export interface ApiExample {
  curl?: string;
  node?: string;
  python?: string;
}

export interface ApiActionDoc {
  /** The `action` query/body value — the key in the server's allRoutes map. */
  action: string;
  /** Nav group this action is listed under (see GROUP_ORDER). */
  group: string;
  title: string;
  description: string;
  /** Human-readable minimum role, e.g. "Any signed-in user", "PM+", "Admin". */
  requiredRole: string;
  params?: ApiParam[];
  example?: ApiExample;
  responseExample?: string;
}

/** Prose sections rendered above the action reference (no `action` of their own). */
export interface ApiPrimer {
  id: string;
  group: string;
  title: string;
  /** Markdown-ish body; the docs page renders paragraphs + code fences. */
  body: string;
  example?: ApiExample;
}

// Actions intentionally NOT part of the public reference:
//  • chatStream — a streaming SSE endpoint, not a JSON action.
//  • the CRON_SECRET-gated engines — a normal API key gets CRON_FORBIDDEN; they
//    are invoked only by Vercel cron with the cron secret.
export const INTERNAL_ACTIONS: readonly string[] = [
  "chatStream",
  "runAlertEngine",
  "runChaseEngine",
  "hrcRunMonthlySnapshot",
  "hrcRunRetentionPurge",
  "tacRefreshCorpus",
];

export const GROUP_ORDER: readonly string[] = [
  "Getting Started",
  "Authentication & Keys",
  "Projects",
  "Programmes",
  "Data (Risks / Issues / Compliance)",
  "Evidence",
  "Portfolio & Client",
  "Team",
  "Profile & Preferences",
  "Compliance Library",
  "Risk & Compliance AI",
  "Controls",
  "Incidents",
  "Assurance",
  "AI Agents",
  "Learning & Improvement",
  "Resource Planner",
  "Fact-Check / Validation",
  "Technical Assurance",
  "Programme Governance",
  "Historical Reporting",
  "Monitoring & Alerts",
  "Notifications",
  "Integrations",
  "Admin",
  "Access Requests",
];

const BASE_URL = "https://cedarguard.co.uk/api";

export const API_PRIMERS: ApiPrimer[] = [
  {
    id: "base-url",
    group: "Getting Started",
    title: "Base URL & RPC model",
    body: `Every endpoint is a POST to a single RPC URL with an \`action\` selector. The action can be a query parameter or a top-level body field; the body is JSON.\n\nBase URL: ${BASE_URL}`,
    example: {
      curl: `curl -X POST "${BASE_URL}?action=getProjects" \\\n  -H "Authorization: Bearer cdR_your_key_here" \\\n  -H "Content-Type: application/json" \\\n  -d '{}'`,
    },
  },
  {
    id: "authentication",
    group: "Getting Started",
    title: "Authentication",
    body: `Send an API key as a Bearer token: \`Authorization: Bearer cdR_...\`. Generate keys in Developer Settings → API Keys. A key inherits its owner's role and is shown only once at creation — store it securely. Keys are held hashed server-side and cannot be recovered; revoke and regenerate if lost.\n\nA browser session (Firebase ID token) authenticates the same endpoints; the API key is for server-to-server and CLI callers.`,
  },
  {
    id: "roles",
    group: "Getting Started",
    title: "Roles & access",
    body: `Actions are gated by role: viewer (read-only, cannot generate keys), project_manager (PM), client_admin, and super_admin. Each action below lists its minimum role. A request that lacks the role returns 403; an unauthenticated request returns 401. Multi-tenant data is scoped to the caller's workspace.`,
  },
];

export const API_ACTIONS: ApiActionDoc[] = [
  // ── Authentication & Keys ────────────────────────────────────────────────
  {
    action: "generateApiKey",
    group: "Authentication & Keys",
    title: "Generate API key",
    description:
      "Create a named API key for the calling user. The full key is returned once and stored only as a hash — save it immediately. Viewers cannot generate keys.",
    requiredRole: "PM+ (not viewer)",
    params: [{ name: "name", type: "string", required: false, description: "Label for the key (max 100 chars)." }],
    example: {
      curl: `curl -X POST "${BASE_URL}?action=generateApiKey" \\\n  -H "Authorization: Bearer cdR_your_key_here" \\\n  -H "Content-Type: application/json" \\\n  -d '{"name":"CI pipeline"}'`,
    },
    responseExample: `{ "success": true, "key": "cdR_2f1c...redacted" }`,
  },
  {
    action: "getApiKeys",
    group: "Authentication & Keys",
    title: "List API keys",
    description:
      "List the calling user's API keys. Only a masked prefix is returned — never the full key.",
    requiredRole: "Any signed-in user",
    responseExample: `{ "success": true, "keys": [ { "id": "b3c1...", "name": "CI pipeline", "prefix": "cdR_2f1c...9ab2", "createdAt": "2026-07-06T...", "lastUsed": null } ] }`,
  },
  {
    action: "revokeApiKey",
    group: "Authentication & Keys",
    title: "Revoke API key",
    description: "Delete one of the calling user's API keys by its id.",
    requiredRole: "Any signed-in user",
    params: [{ name: "keyId", type: "string", required: true, description: "The key's id (from getApiKeys)." }],
    responseExample: `{ "success": true }`,
  },
  {
    action: "deleteUserAccount",
    group: "Authentication & Keys",
    title: "Delete account",
    description:
      "Permanently delete the calling user's account and all owned data (projects, programmes, keys, auth record). Irreversible.",
    requiredRole: "Any signed-in user",
    responseExample: `{ "success": true }`,
  },

  // ── Projects ─────────────────────────────────────────────────────────────
  {
    action: "getProjects",
    group: "Projects",
    title: "List projects",
    description: "List projects the caller can access.",
    requiredRole: "Any signed-in user",
    responseExample: `{ "success": true, "projects": [ { "id": "...", "name": "...", ... } ] }`,
  },
  {
    action: "getProjectById",
    group: "Projects",
    title: "Get project",
    description: "Fetch a single project by id (authorization-checked).",
    requiredRole: "PM+ (with access)",
    params: [{ name: "projectId", type: "string", required: true, description: "Project id." }],
  },
  {
    action: "createProject",
    group: "Projects",
    title: "Create project",
    description: "Create a new project in the caller's workspace.",
    requiredRole: "PM+",
    params: [{ name: "project", type: "object", required: true, description: "Project fields (name, programmeId, etc.)." }],
  },
  {
    action: "updateProject",
    group: "Projects",
    title: "Update project",
    description: "Update fields on an existing project.",
    requiredRole: "PM+ (with access)",
    params: [{ name: "projectId", type: "string", required: true, description: "Project id." }],
  },
  {
    action: "deleteProject",
    group: "Projects",
    title: "Delete project",
    description: "Delete a project the caller owns.",
    requiredRole: "Client Admin+",
    params: [{ name: "projectId", type: "string", required: true, description: "Project id." }],
  },

  // ── Data (Risks / Issues / Compliance) ───────────────────────────────────
  {
    action: "getData",
    group: "Data (Risks / Issues / Compliance)",
    title: "Get a collection",
    description:
      "Read one of a project's data collections. `collection` is one of: risks, issues, complianceItems, kris, tasks.",
    requiredRole: "PM+ (with access)",
    params: [
      { name: "collection", type: "string", required: true, description: "risks | issues | complianceItems | kris | tasks" },
      { name: "projectId", type: "string", required: true, description: "Project id." },
    ],
    example: {
      curl: `curl -X POST "${BASE_URL}?action=getData" \\\n  -H "Authorization: Bearer cdR_your_key_here" \\\n  -H "Content-Type: application/json" \\\n  -d '{"collection":"risks","projectId":"proj_123"}'`,
    },
    responseExample: `{ "success": true, "data": [ { "id": "...", "title": "...", ... } ] }`,
  },
  {
    action: "saveData",
    group: "Data (Risks / Issues / Compliance)",
    title: "Save a collection",
    description:
      "Persist a project data collection (upsert-by-id within the array). Writes are activity-logged. `collection` is one of: risks, issues, complianceItems, kris, tasks.",
    requiredRole: "PM+ (with access)",
    params: [
      { name: "collection", type: "string", required: true, description: "risks | issues | complianceItems | kris | tasks" },
      { name: "projectId", type: "string", required: true, description: "Project id." },
      { name: "data", type: "array", required: true, description: "The full collection array to persist." },
    ],
    responseExample: `{ "success": true }`,
  },

  // ── Portfolio & Client ───────────────────────────────────────────────────
  {
    action: "clientGetProjectData",
    group: "Portfolio & Client",
    title: "Portfolio & RAG",
    description:
      "Client-admin portfolio view: projects with RAG status, compliance %, and open-risk counts.",
    requiredRole: "Client Admin+",
    responseExample: `{ "success": true, "projects": [...], "rag": {...}, "compPct": 0.82, "riskOpen": 12 }`,
  },

  // ── Team ─────────────────────────────────────────────────────────────────
  {
    action: "inviteProjectManager",
    group: "Team",
    title: "Invite Project Manager",
    description:
      "Invite a PM to the workspace by email and (optionally) assign programmes. Creates an invitation record consumed on the invitee's first sign-in.",
    requiredRole: "Client Admin+",
    params: [
      { name: "pmEmail", type: "string", required: true, description: "Invitee email." },
      { name: "pmName", type: "string", required: false, description: "Invitee display name." },
      { name: "programmeIds", type: "array", required: false, description: "Programmes to assign." },
    ],
    responseExample: `{ "success": true }`,
  },

  // ── Projects / Portfolio (continued) ─────────────────────────────────────
  { action: "clientGetProjects", group: "Projects", title: "List accessible projects", description: "Returns all projects the caller can see, scoped by admin status, organisation, ownership, PM assignment, and managed programmes.", requiredRole: "Any signed-in user (workspace-scoped)" },
  { action: "getPortfolioData", group: "Portfolio & Client", title: "Get portfolio data", description: "Returns the caller's accessible projects each enriched with aggregated compliance, risk, issue and RAG-status metrics.", requiredRole: "Any signed-in user (workspace-scoped)" },
  { action: "clientResetWorkspaceData", group: "Portfolio & Client", title: "Reset workspace data", description: "Deletes all projects, programmes, evidence, project data, and pending invitations for the caller's organisation.", requiredRole: "Any signed-in user (workspace-scoped)" },
  { action: "clientGetInvoices", group: "Portfolio & Client", title: "List my invoices", description: "Returns invoices belonging to the caller ordered by creation date.", requiredRole: "Any signed-in user (workspace-scoped)" },

  // ── Programmes ───────────────────────────────────────────────────────────
  { action: "updateProgramme", group: "Programmes", title: "Update programme", description: "Updates the fields of a programme document the caller is authorised for and records an activity-log entry.", requiredRole: "Any signed-in user (workspace-scoped)", params: [ { name: "id", type: "string", required: true, description: "Programme document id to update." }, { name: "data", type: "object", required: true, description: "Partial programme fields to write." } ] },
  { action: "deleteProgramme", group: "Programmes", title: "Delete programme", description: "Deletes a programme document the caller is authorised for and records an activity-log entry.", requiredRole: "Any signed-in user (workspace-scoped)", params: [ { name: "id", type: "string", required: true, description: "Programme document id to delete." } ] },
  { action: "getProgrammeById", group: "Programmes", title: "Get programme by id", description: "Returns a single programme document by id if the caller is authorised for it.", requiredRole: "Any signed-in user (workspace-scoped)", params: [ { name: "id", type: "string", required: true, description: "Programme document id to fetch." } ] },

  // ── Evidence ─────────────────────────────────────────────────────────────
  { action: "getEvidence", group: "Evidence", title: "Get evidence", description: "Returns evidence documents aggregated across the caller's authorised projects/programmes or scoped to a single one.", requiredRole: "Any signed-in user (workspace-scoped)", params: [ { name: "projectId", type: "string", required: false, description: "Project/programme id to scope to; omit or 'all' for the aggregate view." } ] },
  { action: "addEvidence", group: "Evidence", title: "Add evidence", description: "Creates an evidence record for an authorised project, optionally decoding and uploading a base64 file (max 3 MB).", requiredRole: "Any signed-in user (workspace-scoped)", params: [ { name: "projectId", type: "string", required: true, description: "Project id the evidence belongs to." }, { name: "document", type: "object", required: true, description: "Evidence metadata (name, type, url, etc.)." }, { name: "file", type: "object", required: false, description: "Optional { base64, mime } file payload for upload." } ] },
  { action: "deleteEvidence", group: "Evidence", title: "Delete evidence", description: "Deletes an evidence document (and its backing storage object) after verifying project access.", requiredRole: "Any signed-in user (workspace-scoped)", params: [ { name: "docId", type: "string", required: true, description: "Evidence document id to delete." } ] },
  { action: "updateEvidence", group: "Evidence", title: "Update evidence", description: "Merges updates into an existing evidence document after verifying project access.", requiredRole: "Any signed-in user (workspace-scoped)", params: [ { name: "docId", type: "string", required: true, description: "Evidence document id to update." }, { name: "updates", type: "object", required: true, description: "Fields to merge." } ] },

  // ── Data ─────────────────────────────────────────────────────────────────
  { action: "getSystemMappings", group: "Data (Risks / Issues / Compliance)", title: "Get system mappings", description: "Returns the organisation's AI system mappings for the caller's primary workspace.", requiredRole: "Any signed-in user (workspace-scoped)" },

  // ── Profile & Preferences ────────────────────────────────────────────────
  { action: "saveProfile", group: "Profile & Preferences", title: "Save profile", description: "Merges a whitelisted set of profile fields (and sanitised notification preferences) into the caller's own user document.", requiredRole: "Any signed-in user", params: [ { name: "profile", type: "object", required: true, description: "Profile fields to save; only whitelisted keys are persisted." } ] },
  { action: "getProfile", group: "Profile & Preferences", title: "Get profile", description: "Returns the caller's profile, provisioning a role from admin status, a matching invitation, or a default viewer role on first sign-in.", requiredRole: "Any signed-in user" },
  { action: "savePreference", group: "Profile & Preferences", title: "Save preference", description: "Merges a single key/value preference into the caller's own preferences document.", requiredRole: "Any signed-in user", params: [ { name: "key", type: "string", required: true, description: "Preference key to set." }, { name: "value", type: "any", required: false, description: "Value to store." } ] },
  { action: "getPreferences", group: "Profile & Preferences", title: "Get preferences", description: "Returns the caller's stored preferences document, or an empty object if none exists.", requiredRole: "Any signed-in user" },

  // ── Compliance Library ───────────────────────────────────────────────────
  { action: "getComplianceLibrary", group: "Compliance Library", title: "Get compliance library", description: "Returns all items in the global compliance library collection.", requiredRole: "Any signed-in user" },
  { action: "upsertComplianceLibraryItem", group: "Compliance Library", title: "Upsert compliance library item", description: "Creates or updates a compliance library item by id and records an admin activity-log entry.", requiredRole: "Admin", params: [ { name: "item", type: "object", required: true, description: "Library item object; must include an id." } ] },
  { action: "deleteComplianceLibraryItem", group: "Compliance Library", title: "Delete compliance library item", description: "Deletes a compliance library item by id.", requiredRole: "Admin", params: [ { name: "id", type: "string", required: true, description: "Library item id to delete." } ] },
  { action: "getComplianceDomains", group: "Compliance Library", title: "Get compliance domains", description: "Returns all compliance domains ordered alphabetically by label.", requiredRole: "Any signed-in user" },
  { action: "upsertComplianceDomain", group: "Compliance Library", title: "Upsert compliance domain", description: "Creates or overwrites a compliance domain document by id.", requiredRole: "Admin", params: [ { name: "domain", type: "object", required: true, description: "Domain object; must include an id." } ] },

  // ── Team ─────────────────────────────────────────────────────────────────
  { action: "clientGetPMs", group: "Team", title: "List PMs & pending invites", description: "Returns all project_manager users plus pending invitations for the caller's organisation.", requiredRole: "Any signed-in user (workspace-scoped)" },
  { action: "clientGetTeam", group: "Team", title: "List team members & pending invites", description: "Returns all PM-tier team members and pending invitations scoped to the caller's organisation.", requiredRole: "Any signed-in user (workspace-scoped)" },
  { action: "updateInvite", group: "Team", title: "Update invitation", description: "Updates a pending invitation's name, PM level, or assigned programmes after ownership validation.", requiredRole: "Any signed-in user (workspace-scoped)", params: [ { name: "inviteId", type: "string", required: true, description: "Id of the invitation to update." } ] },
  { action: "cancelInvite", group: "Team", title: "Cancel invitation", description: "Deletes a pending invitation belonging to the caller's organisation.", requiredRole: "Any signed-in user (workspace-scoped)", params: [ { name: "inviteId", type: "string", required: true, description: "Id of the invitation to cancel." } ] },
  { action: "clientRemoveUser", group: "Team", title: "Remove team member", description: "Detaches a non-admin user from the caller's organisation by clearing their clientId.", requiredRole: "Any signed-in user (workspace-scoped)", params: [ { name: "targetUid", type: "string", required: true, description: "Uid of the user to remove." } ] },
  { action: "clientUpdateUserRole", group: "Team", title: "Update member role", description: "Changes an org member's role to one of the allowed PM-tier roles.", requiredRole: "Any signed-in user (workspace-scoped)", params: [ { name: "targetUid", type: "string", required: true, description: "Uid of the user." }, { name: "role", type: "string", required: true, description: "New PM-tier role." } ] },
  { action: "getAssignablePMs", group: "Team", title: "List assignable PMs", description: "Returns PM-tier users (org-scoped for non-admins) eligible to be assigned to programmes or projects.", requiredRole: "Any signed-in user (workspace-scoped)" },
  { action: "clientGetMySupervisors", group: "Team", title: "List my supervisors", description: "Returns the caller's supervisor profiles derived from programme rosters and supervisorUid.", requiredRole: "Any signed-in user (workspace-scoped)" },
  { action: "clientGetProgrammeManagers", group: "Team", title: "List programme managers", description: "Returns supervisor-tier users (programme managers, client admins, admins) scoped to the caller's organisation.", requiredRole: "Any signed-in user (workspace-scoped)" },
  { action: "clientGetProgrammesByManager", group: "Team", title: "List programmes by supervisor", description: "Returns programmes created by a given supervisor, intersected with the caller's roster when a PM.", requiredRole: "Any signed-in user (workspace-scoped)", params: [ { name: "supervisorId", type: "string", required: true, description: "Uid of the supervisor." } ] },
  { action: "getPMsAssignedToProgramme", group: "Team", title: "List PMs assigned to programme", description: "Returns the project-manager profiles listed in a programme's assignedPMIds roster.", requiredRole: "Any signed-in user (workspace-scoped)", params: [ { name: "programmeId", type: "string", required: true, description: "Programme id." } ] },
  { action: "addPMToProgramme", group: "Team", title: "Add PM to programme", description: "Adds a user to a programme's assignedPMIds roster and backfills their supervisorUid if unset.", requiredRole: "Any signed-in user (workspace-scoped)", params: [ { name: "programmeId", type: "string", required: true, description: "Programme id." }, { name: "userId", type: "string", required: true, description: "Uid to add." } ] },
  { action: "removePMFromProgramme", group: "Team", title: "Remove PM from programme", description: "Removes a user from a programme's assignedPMIds roster.", requiredRole: "Any signed-in user (workspace-scoped)", params: [ { name: "programmeId", type: "string", required: true, description: "Programme id." }, { name: "userId", type: "string", required: true, description: "Uid to remove." } ] },
  { action: "setPmLevel", group: "Team", title: "Set PM level", description: "Updates a target user's PM level when the caller is their supervisor, org client admin, or an admin.", requiredRole: "Any signed-in user (workspace-scoped)", params: [ { name: "targetUid", type: "string", required: true, description: "Uid of the user." }, { name: "pmLevel", type: "string", required: true, description: "New PM level." } ] },
  { action: "clientAssignSupervisor", group: "Team", title: "Assign supervisor", description: "Sets or clears an org member's supervisorUid after validating the supervisor is a valid supervisor-tier user.", requiredRole: "Client Admin+", params: [ { name: "targetUid", type: "string", required: true, description: "Uid of the user." }, { name: "supervisorUid", type: "string", required: false, description: "Supervisor uid, or null to clear." } ] },
  { action: "clientUpdateMemberProfile", group: "Team", title: "Update member profile", description: "Updates an org member's display name when the caller is an org client admin or an admin.", requiredRole: "Client Admin+", params: [ { name: "targetUid", type: "string", required: true, description: "Uid of the member." }, { name: "displayName", type: "string", required: true, description: "New display name." } ] },
  { action: "adminAssignSupervisor", group: "Team", title: "Admin assign supervisor", description: "Sets or clears any user's supervisorUid after validating the supervisor is a valid supervisor-tier user.", requiredRole: "Admin", params: [ { name: "targetUid", type: "string", required: true, description: "Uid of the user." }, { name: "supervisorUid", type: "string", required: false, description: "Supervisor uid, or null to clear." } ] },

  // ── Risk & Compliance AI ─────────────────────────────────────────────────
  { action: "analyzeCompliance", group: "Risk & Compliance AI", title: "Analyze compliance", description: "Runs the AI engine in JSON mode over supplied content to classify compliance items with reasons.", requiredRole: "Any signed-in user", params: [ { name: "prompt", type: "string", required: true, description: "The compliance analysis prompt." }, { name: "config", type: "object", required: false, description: "Optional generation config." }, { name: "inlineParts", type: "array", required: false, description: "Optional multimodal { mimeType, data } parts (≤8)." } ] },
  { action: "analyzeRisks", group: "Risk & Compliance AI", title: "Analyze risks", description: "Runs the AI engine in JSON mode to analyze and structure risk findings from supplied content.", requiredRole: "Any signed-in user", params: [ { name: "prompt", type: "string", required: true, description: "The risk analysis prompt." }, { name: "config", type: "object", required: false, description: "Optional generation config." } ] },
  { action: "analyzeControls", group: "Risk & Compliance AI", title: "Analyze controls", description: "Runs the AI engine in JSON mode to analyze controls from supplied content and return structured results.", requiredRole: "Any signed-in user", params: [ { name: "prompt", type: "string", required: true, description: "The controls analysis prompt." }, { name: "config", type: "object", required: false, description: "Optional generation config." } ] },
  { action: "chatWithAI", group: "Risk & Compliance AI", title: "Chat with AI", description: "Sends a free-form chat prompt through the AI operation router and returns the model's text or JSON response.", requiredRole: "Any signed-in user", params: [ { name: "prompt", type: "string", required: true, description: "The chat prompt." }, { name: "config", type: "object", required: false, description: "Optional generation config." } ] },
  { action: "geminiPrompt", group: "Risk & Compliance AI", title: "Gemini prompt", description: "Core AI handler that routes an arbitrary (optionally multimodal) prompt through the AI operation router and returns text or healed JSON.", requiredRole: "Any signed-in user", params: [ { name: "prompt", type: "string", required: true, description: "The prompt text (required)." }, { name: "action", type: "string", required: false, description: "Action name that determines JSON mode and token defaults." }, { name: "config", type: "object", required: false, description: "Optional generation config." }, { name: "inlineParts", type: "array", required: false, description: "Optional multimodal parts (≤8)." } ] },
  { action: "getActiveChatModels", group: "Risk & Compliance AI", title: "Get active chat models", description: "Returns the admin-curated enabled chat models plus the default model id, read fresh from Firestore for the chat dropdown.", requiredRole: "Any signed-in user" },

  // ── Fact-Check / Validation ──────────────────────────────────────────────
  { action: "validationRunFactCheck", group: "Fact-Check / Validation", title: "Run fact-check", description: "Runs the two-call web-grounded fact-check engine over supplied content and persists an awaiting_validation record with claims, citations and flags.", requiredRole: "Any signed-in user", params: [ { name: "surface", type: "string", required: true, description: "The surface being fact-checked (e.g. chat, risk, compliance)." }, { name: "targetId", type: "string", required: true, description: "Identifier of the target artifact." }, { name: "content", type: "string", required: true, description: "The AI-generated content whose claims are verified." } ] },
  { action: "validationSetStatus", group: "Fact-Check / Validation", title: "Set validation status", description: "Marks a validation record as validated or rejected, stamping the reviewer and appending an audit event.", requiredRole: "PM+", params: [ { name: "surface", type: "string", required: true, description: "Surface of the record." }, { name: "targetId", type: "string", required: true, description: "Target id of the record." }, { name: "status", type: "string", required: true, description: "'validated' or 'rejected'." } ] },
  { action: "validationGet", group: "Fact-Check / Validation", title: "Get validation record", description: "Reads a single validation record for the given surface and targetId scoped to the caller's tenant.", requiredRole: "Any signed-in user", params: [ { name: "surface", type: "string", required: true, description: "Surface of the record." }, { name: "targetId", type: "string", required: true, description: "Target id of the record." } ] },
  { action: "validationGetForContext", group: "Fact-Check / Validation", title: "Get validations for context", description: "Returns all validation records for the caller's tenant, optionally filtered by contextId.", requiredRole: "Any signed-in user", params: [ { name: "contextId", type: "string", required: false, description: "Optional project/programme context id." } ] },
  { action: "validationAttachSource", group: "Fact-Check / Validation", title: "Attach validation source", description: "Attaches a source link or uploaded file to a validation record, uploading files to storage.", requiredRole: "Any signed-in user", params: [ { name: "surface", type: "string", required: true, description: "Surface of the record." }, { name: "targetId", type: "string", required: true, description: "Target id of the record." }, { name: "attachment", type: "object", required: true, description: "{ kind:'link', url, title } or { kind:'file', base64, mime, title }." } ] },
  { action: "validationRemoveAttachment", group: "Fact-Check / Validation", title: "Remove validation attachment", description: "Removes an attached source from a validation record by url and deletes its storage object when it is a file.", requiredRole: "Any signed-in user", params: [ { name: "surface", type: "string", required: true, description: "Surface of the record." }, { name: "targetId", type: "string", required: true, description: "Target id of the record." }, { name: "url", type: "string", required: true, description: "Url of the attachment to remove." } ] },

  // ── Notifications ────────────────────────────────────────────────────────
  { action: "registerDeviceToken", group: "Notifications", title: "Register device token", description: "Stores the caller's FCM device token and platform on their user document for push delivery.", requiredRole: "Any signed-in user", params: [ { name: "fcmToken", type: "string", required: true, description: "The FCM device token." }, { name: "platform", type: "string", required: false, description: "Client platform (default 'web')." } ] },
  { action: "sendNotification", group: "Notifications", title: "Send notification", description: "Sends a push notification to a supplied FCM token via the messaging service.", requiredRole: "Client Admin+", params: [ { name: "fcmToken", type: "string", required: true, description: "Destination FCM token." }, { name: "title", type: "string", required: false, description: "Notification title." }, { name: "body", type: "string", required: false, description: "Notification body." } ] },
  { action: "sendPushNotification", group: "Notifications", title: "Send push notification", description: "Sends a push notification with custom data to a target user by looking up their device token.", requiredRole: "Admin", params: [ { name: "targetUid", type: "string", required: true, description: "Uid of the user to notify." }, { name: "data", type: "object", required: false, description: "Optional data payload." } ] },

  // ── Integrations ─────────────────────────────────────────────────────────
  { action: "integrationsGetStatus", group: "Integrations", title: "Get integrations status", description: "Returns the masked configuration of all integration providers plus whether the caller can manage them.", requiredRole: "Any signed-in user" },
  { action: "integrationSaveProvider", group: "Integrations", title: "Save integration provider", description: "Validates and stores a provider's non-secret config and encrypted secrets, then returns the masked integration.", requiredRole: "Client Admin+", params: [ { name: "provider", type: "string", required: true, description: "Provider key (slack, teams, googleCalendar, outlookCalendar, sharepoint, powerbi)." }, { name: "config", type: "object", required: false, description: "Non-secret provider config." }, { name: "secrets", type: "object", required: false, description: "Provider secrets (webhookUrl, serviceAccountJson, clientSecret)." } ] },
  { action: "integrationTest", group: "Integrations", title: "Test integration", description: "Tests a saved provider by sending a live webhook message or performing a structural credential check.", requiredRole: "Client Admin+", params: [ { name: "provider", type: "string", required: true, description: "Provider key to test." } ] },
  { action: "integrationDisconnect", group: "Integrations", title: "Disconnect integration", description: "Disconnects a provider, clearing its stored config and cleaning up any Power BI feed key.", requiredRole: "Client Admin+", params: [ { name: "provider", type: "string", required: true, description: "Provider key to disconnect." } ] },
  { action: "integrationGenerateFeedKey", group: "Integrations", title: "Generate Power BI feed key", description: "Rotates and generates a hashed Power BI feed API key and returns the plaintext token plus the feed URL.", requiredRole: "Client Admin+" },
  { action: "integrationRevokeFeedKey", group: "Integrations", title: "Revoke Power BI feed key", description: "Revokes the Power BI feed key, deleting the stored key doc and disabling the integration.", requiredRole: "Client Admin+" },

  // ── Controls ─────────────────────────────────────────────────────────────
  { action: "controlsList", group: "Controls", title: "List controls", description: "Returns all controls belonging to the caller's tenant, sorted by title.", requiredRole: "Any signed-in user (workspace-scoped)" },
  { action: "controlsUpsert", group: "Controls", title: "Create or update a control", description: "Creates or updates a tenant-scoped control after sanitizing fields and checking access for any tagged project/programme.", requiredRole: "PM+", params: [ { name: "control", type: "object", required: true, description: "Control payload; must include a non-empty title, may carry an id to update." } ] },
  { action: "controlsDelete", group: "Controls", title: "Delete a control", description: "Deletes a control owned by the caller's tenant after verifying existence and ownership.", requiredRole: "PM+", params: [ { name: "id", type: "string", required: true, description: "Id of the control to delete." } ] },

  // ── Incidents ────────────────────────────────────────────────────────────
  { action: "incidentsList", group: "Incidents", title: "List incidents", description: "Returns all incidents belonging to the caller's tenant, sorted by most recent occurrence date.", requiredRole: "Any signed-in user (workspace-scoped)" },
  { action: "incidentsUpsert", group: "Incidents", title: "Create or update an incident", description: "Creates or updates a tenant-scoped incident; closing or re-opening additionally requires a PM-level role.", requiredRole: "Any signed-in user (workspace-scoped); close/re-open requires PM+", params: [ { name: "incident", type: "object", required: true, description: "Incident payload; must include a non-empty title, may carry an id to update." } ] },
  { action: "incidentsDelete", group: "Incidents", title: "Delete an incident", description: "Deletes an incident owned by the caller's tenant after verifying existence and ownership.", requiredRole: "PM+", params: [ { name: "id", type: "string", required: true, description: "Id of the incident to delete." } ] },

  // ── Assurance ────────────────────────────────────────────────────────────
  { action: "assuranceList", group: "Assurance", title: "List assurance alerts", description: "Returns all assurance alerts belonging to the caller's tenant, most recently created first.", requiredRole: "Any signed-in user (workspace-scoped)" },
  { action: "assuranceUpsert", group: "Assurance", title: "Create or update an assurance alert", description: "Creates or updates a tenant-scoped assurance alert after sanitizing fields and checking access for any tagged project/programme.", requiredRole: "PM+", params: [ { name: "alert", type: "object", required: true, description: "Alert payload; must include a non-empty title, may carry an id to update." } ] },
  { action: "assuranceDelete", group: "Assurance", title: "Delete an assurance alert", description: "Deletes an assurance alert owned by the caller's tenant after verifying existence and ownership.", requiredRole: "PM+", params: [ { name: "id", type: "string", required: true, description: "Id of the alert to delete." } ] },
  { action: "assuranceGenerateActions", group: "Assurance", title: "Generate assurance actions (AI)", description: "Uses AI to generate detective/preventive/corrective/improvement response actions for an escalated alert, grounded in the tenant's real controls.", requiredRole: "PM+", params: [ { name: "alert", type: "object", required: true, description: "Object carrying the alert id; the alert is re-read server-side." } ] },

  // ── AI Agents ────────────────────────────────────────────────────────────
  { action: "agentRun", group: "AI Agents", title: "Run an agent", description: "Runs one domain agent over the caller's authorised records and persists its output as DRAFT suggestions for human review. Never writes to a live record.", requiredRole: "Any signed-in user (workspace-scoped; viewers are denied)", params: [ { name: "agentKey", type: "string", required: true, description: "Which agent to run, e.g. riskIncident, compliance, technical." }, { name: "contextKind", type: "string", required: true, description: "project | programme | portfolio." }, { name: "contextId", type: "string", description: "Project or programme id; required unless contextKind is portfolio." }, { name: "question", type: "string", description: "Free-text question — required by the Technical Companion agent only." } ] },
  { action: "agentListSuggestions", group: "AI Agents", title: "List agent suggestions", description: "Returns the tenant's agent suggestions (the review queue), newest first. Technical-answer suggestions are owner-scoped to their requester and elevated TAC roles.", requiredRole: "Any signed-in user (workspace-scoped)" },
  { action: "agentListRuns", group: "AI Agents", title: "List agent runs", description: "Returns the tenant's agent run history — who ran which agent, over which records, with which model. The prompt-context audit trail.", requiredRole: "Any signed-in user (workspace-scoped)" },
  { action: "agentReviewSuggestion", group: "AI Agents", title: "Review a suggestion", description: "Accepts, edits or rejects a draft suggestion. Editing keeps the original payload and records a field-level diff; rejecting requires a reason. Does not write to any live record.", requiredRole: "PM+", params: [ { name: "suggestionId", type: "string", required: true, description: "Id of the suggestion." }, { name: "decision", type: "string", required: true, description: "accepted | edited | rejected." }, { name: "editedPayload", type: "object", description: "Reviewer's revised payload — required when decision is edited." }, { name: "reason", type: "string", description: "Required when decision is rejected." } ] },
  { action: "agentApplySuggestion", group: "AI Agents", title: "Apply a suggestion", description: "Writes an accepted or edited suggestion into its target module (risk, control, CAPA task, compliance item, evidence gap, lesson). Re-checks role, tenant, context access, sanitization and prohibited actions at apply time; idempotent. The only action in the agent layer that touches a live record.", requiredRole: "PM+", params: [ { name: "suggestionId", type: "string", required: true, description: "Id of an accepted or edited suggestion." } ] },

  // ── Learning & Improvement ───────────────────────────────────────────────
  { action: "learningSuggestImprovements", group: "Learning & Improvement", title: "Suggest improvements (AI)", description: "Uses AI to suggest up to six corrective/preventive/improvement actions from a summary of recurring assurance signals.", requiredRole: "Any signed-in user (workspace-scoped)", params: [ { name: "signals", type: "string", required: true, description: "Non-empty summary of recurring signals to base suggestions on." } ] },

  // ── Resource Planner ─────────────────────────────────────────────────────
  { action: "resourceListSchemes", group: "Resource Planner", title: "List resource schemes", description: "Returns all resource schemes belonging to the caller's tenant, sorted by name.", requiredRole: "Any signed-in user (workspace-scoped)" },
  { action: "resourceUpsertScheme", group: "Resource Planner", title: "Create or update a resource scheme", description: "Creates or updates a tenant-scoped resource scheme after verifying ownership of any existing document.", requiredRole: "Programme Manager+", params: [ { name: "scheme", type: "object", required: true, description: "Scheme payload; must include a name, may carry an id to update." } ] },
  { action: "resourceDeleteScheme", group: "Resource Planner", title: "Delete a resource scheme", description: "Deletes a resource scheme owned by the caller's tenant after verifying existence and ownership.", requiredRole: "Programme Manager+", params: [ { name: "id", type: "string", required: true, description: "Id of the scheme to delete." } ] },
  { action: "resourceGetAssumptions", group: "Resource Planner", title: "Get planner assumptions", description: "Returns the single resource-planner assumptions document for the caller's tenant, or null if none is saved.", requiredRole: "Any signed-in user (workspace-scoped)" },
  { action: "resourceSaveAssumptions", group: "Resource Planner", title: "Save planner assumptions", description: "Saves the tenant's single resource-planner assumptions document.", requiredRole: "Programme Manager+", params: [ { name: "assumptions", type: "object", required: true, description: "Assumptions payload to persist." } ] },
  { action: "resourceImportSchemesDryRun", group: "Resource Planner", title: "Preview scheme import", description: "Parses a base64 spreadsheet and returns previewed rows and a summary without writing anything.", requiredRole: "Programme Manager+", params: [ { name: "base64", type: "string", required: true, description: "Base64 (optionally data-URI) XLSX payload." } ] },
  { action: "resourceImportSchemesCommit", group: "Resource Planner", title: "Commit scheme import", description: "Parses a base64 spreadsheet and batch-writes all error-free scheme rows to the caller's tenant.", requiredRole: "Programme Manager+", params: [ { name: "base64", type: "string", required: true, description: "Base64 (optionally data-URI) XLSX payload." } ] },

  // ── Admin ────────────────────────────────────────────────────────────────
  { action: "adminDeleteProject", group: "Admin", title: "Delete project", description: "Deletes a project after verifying it belongs to the caller's organisation.", requiredRole: "Client Admin+", params: [ { name: "id", type: "string", required: true, description: "Project id to delete." } ] },
  { action: "adminDeleteProgramme", group: "Admin", title: "Delete programme", description: "Deletes a programme after verifying it belongs to the caller's organisation.", requiredRole: "Client Admin+", params: [ { name: "id", type: "string", required: true, description: "Programme id to delete." } ] },
  { action: "adminTransferProject", group: "Admin", title: "Transfer project", description: "Reassigns a project to a new owner, moving its clientId across organisations on an admin cross-org transfer.", requiredRole: "Client Admin+", params: [ { name: "id", type: "string", required: true, description: "Project id to transfer." }, { name: "targetUser", type: "object", required: true, description: "New owner ({ uid, email? })." } ] },
  { action: "adminTransferProgramme", group: "Admin", title: "Transfer programme", description: "Reassigns a programme to a new owner, moving its clientId across organisations on an admin cross-org transfer.", requiredRole: "Client Admin+", params: [ { name: "id", type: "string", required: true, description: "Programme id to transfer." }, { name: "targetUser", type: "object", required: true, description: "New owner ({ uid, email? })." } ] },
  { action: "adminStats", group: "Admin", title: "Platform stats", description: "Returns platform-wide counts of users, projects, and activity logs.", requiredRole: "Admin" },
  { action: "adminGetUsers", group: "Admin", title: "List all users", description: "Returns all auth users merged with their Firestore profile data.", requiredRole: "Admin" },
  { action: "adminGetProjects", group: "Admin", title: "List all projects", description: "Returns every project across the platform.", requiredRole: "Admin" },
  { action: "adminGetProgrammes", group: "Admin", title: "List all programmes", description: "Returns every programme across the platform.", requiredRole: "Admin" },
  { action: "adminUpdateUser", group: "Admin", title: "Update user", description: "Merges arbitrary field updates into a user's Firestore profile.", requiredRole: "Admin", params: [ { name: "targetUid", type: "string", required: true, description: "Uid to update." }, { name: "updates", type: "object", required: true, description: "Profile fields to merge." } ] },
  { action: "adminPromoteUser", group: "Admin", title: "Promote user role", description: "Changes a user's role — super admins any role, client admins limited to project_manager↔client_admin within their org.", requiredRole: "Client Admin+", params: [ { name: "targetUid", type: "string", required: true, description: "Uid to promote." }, { name: "newRole", type: "string", required: true, description: "New role." } ] },
  { action: "adminGetActivity", group: "Admin", title: "Get activity logs", description: "Returns recent activity logs ordered by timestamp, up to a capped limit.", requiredRole: "Admin", params: [ { name: "limit", type: "number", required: false, description: "Max logs (default 500, capped 2000)." } ] },
  { action: "adminGetMappings", group: "Admin", title: "Get system mappings", description: "Returns all system mapping documents.", requiredRole: "Admin" },
  { action: "adminSaveMapping", group: "Admin", title: "Save system mapping", description: "Creates or updates a mapping entry within the organisation's system mappings document.", requiredRole: "Admin", params: [ { name: "mapping", type: "object", required: true, description: "Mapping object; include an id to update." } ] },
  { action: "adminDeleteMapping", group: "Admin", title: "Delete system mapping", description: "Removes a mapping entry from the organisation's system mappings document.", requiredRole: "Admin", params: [ { name: "id", type: "string", required: true, description: "Mapping entry id." } ] },
  { action: "adminGetPricingConfig", group: "Admin", title: "Get pricing config", description: "Returns the platform pricing configuration document.", requiredRole: "Admin" },
  { action: "adminUpdatePricingConfig", group: "Admin", title: "Update pricing config", description: "Overwrites the platform pricing configuration document.", requiredRole: "Admin", params: [ { name: "config", type: "object", required: true, description: "Pricing config to save." } ] },
  { action: "adminCreateInvoice", group: "Admin", title: "Create invoice", description: "Creates a new invoice document.", requiredRole: "Admin", params: [ { name: "invoice", type: "object", required: true, description: "Invoice data." } ] },
  { action: "adminGetInvoices", group: "Admin", title: "List all invoices", description: "Returns all invoices ordered by creation date.", requiredRole: "Admin" },
  { action: "adminDeleteInvoice", group: "Admin", title: "Delete invoice", description: "Deletes an invoice document by id.", requiredRole: "Admin", params: [ { name: "id", type: "string", required: true, description: "Invoice id." } ] },
  { action: "adminGetAIModelConfig", group: "Admin", title: "Get AI model config", description: "Returns the full AI model configuration document (chat and operation models).", requiredRole: "Admin" },
  { action: "adminUpdateAIModelConfig", group: "Admin", title: "Update AI model config", description: "Validates and overwrites the AI model configuration document and busts its cache.", requiredRole: "Admin", params: [ { name: "config", type: "object", required: true, description: "Full AI model config payload." } ] },
  { action: "adminGetOpenRouterCatalog", group: "Admin", title: "Get OpenRouter catalog", description: "Fetches the OpenRouter model catalog, optionally forcing a refresh past the cache.", requiredRole: "Admin", params: [ { name: "force", type: "boolean", required: false, description: "Force a fresh upstream fetch." } ] },
  { action: "adminMigrateApiKeyHashes", group: "Admin", title: "Migrate API key hashes", description: "One-time idempotent migration of legacy plaintext-id API keys to hashed storage.", requiredRole: "Admin" },

  // ── Access Requests ──────────────────────────────────────────────────────
  { action: "getMyAccessRequest", group: "Access Requests", title: "Get my access request", description: "Returns the caller's current pending access request, if any.", requiredRole: "Any signed-in user" },
  { action: "createAccessRequest", group: "Access Requests", title: "Create access request", description: "Creates a pending Project Manager access request for the caller and notifies tenant admins (no-op if one is pending).", requiredRole: "Any signed-in user", params: [ { name: "reason", type: "string", required: false, description: "Optional reason (≤500 chars)." } ] },
  { action: "adminGetAccessRequests", group: "Access Requests", title: "List access requests", description: "Returns recent access requests ordered by creation date.", requiredRole: "Admin" },
  { action: "adminApproveAccessRequest", group: "Access Requests", title: "Approve access request", description: "Approves a pending access request, promotes the requester to project manager, and emails them.", requiredRole: "Admin", params: [ { name: "requestId", type: "string", required: true, description: "Access request id." } ] },
  { action: "adminRejectAccessRequest", group: "Access Requests", title: "Reject access request", description: "Rejects a pending access request with an optional reason and emails the requester.", requiredRole: "Admin", params: [ { name: "requestId", type: "string", required: true, description: "Access request id." } ] },

  // ── Technical Assurance ──────────────────────────────────────────────────
  { action: "tacListEnquiries", group: "Technical Assurance", title: "List enquiries", description: "Lists enquiries scoped to the caller's workspace, filtered to those they own or were shared (elevated roles see all).", requiredRole: "Any signed-in user (owner/shared-scoped)", params: [ { name: "mine", type: "boolean", required: false, description: "Restrict to the caller's own enquiries." } ] },
  { action: "tacGetEnquiry", group: "Technical Assurance", title: "Get enquiry", description: "Reads a single enquiry by id with tenant and per-user visibility guards (owner, share recipient, or elevated role).", requiredRole: "Any signed-in user (owner/shared-scoped)", params: [ { name: "enquiryId", type: "string", required: true, description: "The enquiry id." } ] },
  { action: "tacUpsertEnquiry", group: "Technical Assurance", title: "Create or update enquiry", description: "Creates a new Draft enquiry or patches an existing Draft using a whitelisted field set.", requiredRole: "Any signed-in user (owner/shared-scoped)", params: [ { name: "enquiryId", type: "string", required: false, description: "Omit to create; provide to update." }, { name: "patch", type: "object", required: true, description: "Writable fields (title, query, ribaStage, projectId)." } ] },
  { action: "tacAttachFile", group: "Technical Assurance", title: "Attach file to enquiry", description: "Decodes a base64 file, uploads it, and appends the attachment to a Draft enquiry within size caps.", requiredRole: "Any signed-in user (owner/shared-scoped)", params: [ { name: "enquiryId", type: "string", required: true, description: "Draft enquiry id." }, { name: "fileBase64", type: "string", required: true, description: "Base64 file contents." }, { name: "fileName", type: "string", required: true, description: "Original file name." } ] },
  { action: "tacRemoveAttachment", group: "Technical Assurance", title: "Remove attachment", description: "Deletes an attachment's stored file and strips it from a Draft enquiry.", requiredRole: "Any signed-in user (owner/shared-scoped)", params: [ { name: "enquiryId", type: "string", required: true, description: "Enquiry id." }, { name: "attachmentId", type: "string", required: true, description: "Attachment id." } ] },
  { action: "tacDeleteEnquiry", group: "Technical Assurance", title: "Delete enquiry", description: "Permanently deletes an enquiry along with its attachments, deliverables, and referencing RFIs.", requiredRole: "Any signed-in user (owner/shared-scoped)", params: [ { name: "enquiryId", type: "string", required: true, description: "Enquiry id." } ] },
  { action: "tacBuildInsightPrompt", group: "Technical Assurance", title: "Build insight prompt", description: "Step one of the AI pipeline: prepares the Gemini prompt and corpus citations for a Draft enquiry.", requiredRole: "Any signed-in user (owner/shared-scoped)", params: [ { name: "enquiryId", type: "string", required: true, description: "Draft enquiry id." } ] },
  { action: "tacFinaliseInsight", group: "Technical Assurance", title: "Finalise insight", description: "Step two of the AI pipeline: persists the AI-generated summary deliverable and clears the Generating status.", requiredRole: "Any signed-in user (owner/shared-scoped)", params: [ { name: "enquiryId", type: "string", required: true, description: "Enquiry id." }, { name: "summary", type: "object", required: true, description: "AI response to store as the summary." } ] },
  { action: "tacGetEnquiryDeliverable", group: "Technical Assurance", title: "Get enquiry deliverable", description: "Reads a single tab's deliverable (summary, drawing, rfi, costProgramme, compliance) for a viewable enquiry.", requiredRole: "Any signed-in user (owner/shared-scoped)", params: [ { name: "enquiryId", type: "string", required: true, description: "Enquiry id." }, { name: "tabId", type: "string", required: false, description: "summary | drawing | rfi | costProgramme | compliance." } ] },
  { action: "tacUpsertRfiDraft", group: "Technical Assurance", title: "Save RFI draft", description: "Patches the draft RFI on the enquiry's summary deliverable, rejecting edits once the RFI is Issued.", requiredRole: "Any signed-in user (owner/shared-scoped)", params: [ { name: "enquiryId", type: "string", required: true, description: "Enquiry id." }, { name: "rfi", type: "object", required: true, description: "RFI patch (subject, body, priority, recipients)." } ] },
  { action: "tacIssueRfi", group: "Technical Assurance", title: "Issue RFI", description: "Generates an RFI number, writes it to the workspace register, and flips the enquiry's draft RFI to Issued.", requiredRole: "Any signed-in user (owner/shared-scoped)", params: [ { name: "enquiryId", type: "string", required: true, description: "Enquiry id." } ] },
  { action: "tacListRfis", group: "Technical Assurance", title: "List RFIs", description: "Returns issued RFIs for the workspace, scoped to one project when given or limited to authorised projects.", requiredRole: "PM+ (with project access)", params: [ { name: "projectId", type: "string", required: false, description: "Restrict to one project the caller can access." } ] },
  { action: "tacListCostRates", group: "Technical Assurance", title: "List cost rates", description: "Returns the merged cost-rates library (shared seed plus the workspace's custom rates).", requiredRole: "Any signed-in user (owner/shared-scoped)" },
  { action: "tacUpsertCostRate", group: "Technical Assurance", title: "Create or update cost rate", description: "Creates or updates a custom workspace cost rate that shadows the shared seed library.", requiredRole: "Admin", params: [ { name: "rate", type: "object", required: true, description: "Rate ({ rateId, category, description, unit, rate })." } ] },
  { action: "tacDeleteCostRate", group: "Technical Assurance", title: "Delete cost rate", description: "Hard-deletes a custom cost rate, or writes a per-tenant hidden marker to suppress a shared-seed rate.", requiredRole: "Admin", params: [ { name: "rateId", type: "string", required: true, description: "Cost rate id." } ] },
  { action: "tacExportCostCsv", group: "Technical Assurance", title: "Export cost CSV", description: "Renders the enquiry's cost-and-programme lines as a downloadable CSV with a totals row.", requiredRole: "Any signed-in user (owner/shared-scoped)", params: [ { name: "enquiryId", type: "string", required: true, description: "Enquiry id." } ] },
  { action: "tacDownloadCompliancePack", group: "Technical Assurance", title: "Download compliance pack", description: "Renders the enquiry's compliance deliverable as a base64 PDF (requires the summary insight to exist).", requiredRole: "Any signed-in user (owner/shared-scoped)", params: [ { name: "enquiryId", type: "string", required: true, description: "Enquiry id." } ] },
  { action: "tacSaveToGoldenThread", group: "Technical Assurance", title: "Save to Golden Thread", description: "Writes an immutable, versioned Golden Thread chain document for HRB-flagged projects.", requiredRole: "Any signed-in user (owner/shared-scoped)", params: [ { name: "enquiryId", type: "string", required: true, description: "Enquiry id (linked to an HRB project)." } ] },
  { action: "tacSubmitFeedback", group: "Technical Assurance", title: "Submit feedback", description: "Records thumbs-up/down feedback on an enquiry's summary, optionally with a reason and note.", requiredRole: "Any signed-in user (owner/shared-scoped)", params: [ { name: "enquiryId", type: "string", required: true, description: "Enquiry id." }, { name: "thumbs", type: "string", required: true, description: "'up' or 'down'." } ] },
  { action: "tacFlagForAudit", group: "Technical Assurance", title: "Flag enquiry for audit", description: "Flags an enquiry for audit review, rejecting if an unresolved flag already exists.", requiredRole: "Compliance Lead+", params: [ { name: "enquiryId", type: "string", required: true, description: "Enquiry id." } ] },
  { action: "tacResolveFlag", group: "Technical Assurance", title: "Resolve audit flag", description: "Resolves an existing audit flag, appending a required resolution note.", requiredRole: "Compliance Lead+", params: [ { name: "enquiryId", type: "string", required: true, description: "Enquiry id." }, { name: "reviewerNote", type: "string", required: true, description: "Resolution note (min 5 chars)." } ] },
  { action: "tacListAuditFlagged", group: "Technical Assurance", title: "List audit-flagged enquiries", description: "Returns every workspace enquiry flagged for audit or carrying thumbs-down feedback, oldest first.", requiredRole: "Compliance Lead+" },
  { action: "tacArchiveEnquiry", group: "Technical Assurance", title: "Archive or restore enquiry", description: "Moves an enquiry to Archived (from any status except Generating), or restores it to Open.", requiredRole: "Any signed-in user (owner/shared-scoped)", params: [ { name: "enquiryId", type: "string", required: true, description: "Enquiry id." }, { name: "restore", type: "boolean", required: false, description: "Restore instead of archive." } ] },
  { action: "tacCloseEnquiry", group: "Technical Assurance", title: "Close enquiry", description: "Closes an Open/AwaitingReview/Approved enquiry and writes a Golden Thread closure record for HRB projects.", requiredRole: "Any signed-in user (owner/shared-scoped)", params: [ { name: "enquiryId", type: "string", required: true, description: "Enquiry id." } ] },
  { action: "tacUnlockEnquiry", group: "Technical Assurance", title: "Unlock closed enquiry", description: "Reopens a Closed enquiry to Open, requiring a reason appended to a permanent unlock-history trail.", requiredRole: "Compliance Lead+", params: [ { name: "enquiryId", type: "string", required: true, description: "Enquiry id." }, { name: "reason", type: "string", required: true, description: "Unlock reason (min 10 chars)." } ] },
  { action: "tacExportDecisionLog", group: "Technical Assurance", title: "Export decision log", description: "Renders a chronological PDF of every closed enquiry on a project for submission packs.", requiredRole: "PM+ (with project access)", params: [ { name: "projectId", type: "string", required: true, description: "Project id (caller must be authorised)." } ] },
  { action: "tacAddToProjectReport", group: "Technical Assurance", title: "Add enquiry to project report", description: "Flags an enquiry for inclusion in its project's status report Technical Assurance section.", requiredRole: "Any signed-in user (owner/shared-scoped)", params: [ { name: "enquiryId", type: "string", required: true, description: "Enquiry id." } ] },
  { action: "tacRemoveFromProjectReport", group: "Technical Assurance", title: "Remove enquiry from project report", description: "Clears an enquiry's project-report inclusion flag.", requiredRole: "Any signed-in user (owner/shared-scoped)", params: [ { name: "enquiryId", type: "string", required: true, description: "Enquiry id." } ] },
  { action: "tacListProjectReportEnquiries", group: "Technical Assurance", title: "List project-report enquiries", description: "Returns enriched rows for every enquiry flagged into a project's report.", requiredRole: "PM+ (with project access)", params: [ { name: "projectId", type: "string", required: true, description: "Project id (caller must be authorised)." } ] },
  { action: "tacShareEnquiry", group: "Technical Assurance", title: "Share enquiry for review", description: "Shares an enquiry with another workspace member for read-only review, flipping Open to AwaitingReview.", requiredRole: "Any signed-in user (owner/shared-scoped)", params: [ { name: "enquiryId", type: "string", required: true, description: "Enquiry id." }, { name: "sharedWithUid", type: "string", required: true, description: "Uid to share with (not yourself)." } ] },
  { action: "tacDecideOnShare", group: "Technical Assurance", title: "Decide on shared enquiry", description: "Lets a share recipient approve or reject their review, promoting AwaitingReview to Approved on the last approval.", requiredRole: "Any signed-in user (share recipient only)", params: [ { name: "enquiryId", type: "string", required: true, description: "Enquiry id." }, { name: "shareId", type: "string", required: true, description: "Share entry id (must belong to the caller)." }, { name: "decision", type: "string", required: true, description: "'approved' or 'rejected'." } ] },
  { action: "tacListSharedWithMe", group: "Technical Assurance", title: "List enquiries shared with me", description: "Returns the enquiries shared with the current user, most recently shared first.", requiredRole: "Any signed-in user (owner/shared-scoped)" },
  { action: "tacScanCitationIntegrity", group: "Technical Assurance", title: "Scan citation integrity", description: "Walks every enquiry's summary and reports citations whose regId no longer resolves in the regulations corpus.", requiredRole: "Admin" },

  // ── Programme Governance ─────────────────────────────────────────────────
  { action: "governanceSandboxSaveSection", group: "Programme Governance", title: "Save sandbox section", description: "Auto-saves a Tiptap section draft to the signed-in user's per-user editor sandbox.", requiredRole: "Any signed-in user", params: [ { name: "sectionId", type: "string", required: true, description: "Sandbox section id." }, { name: "content", type: "object", required: true, description: "Tiptap JSON document." } ] },
  { action: "governanceSandboxLoadSection", group: "Programme Governance", title: "Load sandbox section", description: "Loads a previously saved Tiptap section draft from the user's editor sandbox.", requiredRole: "Any signed-in user", params: [ { name: "sectionId", type: "string", required: true, description: "Sandbox section id." } ] },
  { action: "governanceRenderSandboxPdf", group: "Programme Governance", title: "Render sandbox PDF", description: "Renders a self-contained base64 PDF from sandbox Tiptap content.", requiredRole: "Any signed-in user", params: [ { name: "content", type: "object", required: true, description: "Tiptap JSON document." } ] },
  { action: "governanceUploadCouncilLogo", group: "Programme Governance", title: "Upload council logo", description: "Compresses and uploads the workspace council logo, storing its URL on the org-owner doc.", requiredRole: "Client Admin+", params: [ { name: "fileBase64", type: "string", required: true, description: "Base64 logo image." } ] },
  { action: "governanceDeleteCouncilLogo", group: "Programme Governance", title: "Delete council logo", description: "Removes the council logo asset and clears its URL on the org-owner doc.", requiredRole: "Client Admin+" },
  { action: "governanceUploadCouncilStamp", group: "Programme Governance", title: "Upload council stamp", description: "Compresses and uploads a named council stamp, recording it in the org-owner stamps map.", requiredRole: "Client Admin+", params: [ { name: "stampId", type: "string", required: true, description: "Stamp id (1-40 chars)." }, { name: "fileBase64", type: "string", required: true, description: "Base64 stamp image." } ] },
  { action: "governanceDeleteCouncilStamp", group: "Programme Governance", title: "Delete council stamp", description: "Deletes a named council stamp and removes it from the org-owner stamps map.", requiredRole: "Client Admin+", params: [ { name: "stampId", type: "string", required: true, description: "Stamp id." } ] },
  { action: "governanceGetCouncilAssets", group: "Programme Governance", title: "Get council assets", description: "Returns the workspace council logo URL and stamps map for embedding into reports.", requiredRole: "Any signed-in user" },
  { action: "governanceUploadUserSignature", group: "Programme Governance", title: "Upload user signature", description: "Processes and uploads the signed-in user's signature image, storing its URL on their user doc.", requiredRole: "Any signed-in user", params: [ { name: "fileBase64", type: "string", required: true, description: "Base64 PNG/JPEG signature." } ] },
  { action: "governanceDeleteUserSignature", group: "Programme Governance", title: "Delete user signature", description: "Deletes the signed-in user's signature asset and clears its URL.", requiredRole: "Any signed-in user" },
  { action: "governanceGetUserSignature", group: "Programme Governance", title: "Get user signature", description: "Returns the signed-in user's stored signature URL and last-updated timestamp.", requiredRole: "Any signed-in user" },
  { action: "governanceGetFramework", group: "Programme Governance", title: "Get framework", description: "Loads the workspace governance framework with bodies, thresholds, and active ToR, seeding a starter on first access.", requiredRole: "Any signed-in user" },
  { action: "governancePublishFramework", group: "Programme Governance", title: "Publish framework", description: "Atomically snapshots the current framework, bodies, and thresholds into the next version and marks it published.", requiredRole: "Client Admin+" },
  { action: "governanceUpsertBody", group: "Programme Governance", title: "Upsert governance body", description: "Creates or updates a governance body from an allow-listed patch and flips the framework back to draft.", requiredRole: "Client Admin+", params: [ { name: "bodyId", type: "string", required: true, description: "Body id (1-80 chars)." }, { name: "patch", type: "object", required: true, description: "Writable body fields." } ] },
  { action: "governanceDeleteBody", group: "Programme Governance", title: "Delete governance body", description: "Deletes a governance body after a cross-tenant safety check and marks the framework draft.", requiredRole: "Client Admin+", params: [ { name: "bodyId", type: "string", required: true, description: "Body id." } ] },
  { action: "governanceUpsertThreshold", group: "Programme Governance", title: "Upsert authority threshold", description: "Creates or updates an authority threshold band and flips the framework to draft.", requiredRole: "Client Admin+", params: [ { name: "thresholdId", type: "string", required: true, description: "Threshold id." }, { name: "patch", type: "object", required: true, description: "Writable threshold fields." } ] },
  { action: "governanceDeleteThreshold", group: "Programme Governance", title: "Delete authority threshold", description: "Deletes an authority threshold band and marks the framework draft.", requiredRole: "Client Admin+", params: [ { name: "thresholdId", type: "string", required: true, description: "Threshold id." } ] },
  { action: "governanceListToRVersions", group: "Programme Governance", title: "List ToR versions", description: "Lists all Terms of Reference versions for a governance body, newest first.", requiredRole: "Any signed-in user", params: [ { name: "ownerBodyId", type: "string", required: true, description: "Governance body id." } ] },
  { action: "governanceUpsertToR", group: "Programme Governance", title: "Upsert Terms of Reference", description: "Creates or updates a body's draft ToR and, when publishing, supersedes prior published versions.", requiredRole: "Client Admin+", params: [ { name: "ownerBodyId", type: "string", required: true, description: "Governance body id." }, { name: "patch", type: "object", required: true, description: "Writable ToR fields." } ] },
  { action: "governanceExportFrameworkDiagram", group: "Programme Governance", title: "Export framework diagram", description: "Renders the governance framework structure diagram as a base64 PDF.", requiredRole: "Any signed-in user" },
  { action: "governanceExportFrameworkConstitution", group: "Programme Governance", title: "Export framework constitution", description: "Renders the full governance framework constitution document as a base64 PDF.", requiredRole: "Any signed-in user" },
  { action: "governanceListTemplates", group: "Programme Governance", title: "List report templates", description: "Lists all report templates for the workspace, seeding the starter library on first read.", requiredRole: "Any signed-in user" },
  { action: "governanceGetTemplate", group: "Programme Governance", title: "Get report template", description: "Loads a single report template with full section detail after a cross-tenant check.", requiredRole: "Any signed-in user", params: [ { name: "templateId", type: "string", required: true, description: "Template id." } ] },
  { action: "governanceUpsertTemplate", group: "Programme Governance", title: "Upsert report template", description: "Creates or updates a report template and sections; statutory flags are preserved for non-super-admins.", requiredRole: "Client Admin+", params: [ { name: "templateId", type: "string", required: true, description: "Template id." }, { name: "patch", type: "object", required: true, description: "Writable template fields incl. sections." } ] },
  { action: "governancePublishTemplate", group: "Programme Governance", title: "Publish report template", description: "Atomically bumps the template version, snapshots the working doc, and marks it published.", requiredRole: "Client Admin+", params: [ { name: "templateId", type: "string", required: true, description: "Template id." } ] },
  { action: "governanceDuplicateTemplate", group: "Programme Governance", title: "Duplicate report template", description: "Transactionally copies a template to a new id as a fresh draft, guarding against id collisions.", requiredRole: "Client Admin+", params: [ { name: "templateId", type: "string", required: true, description: "Source template id." }, { name: "newId", type: "string", required: true, description: "New template id." } ] },
  { action: "governanceAiRecommendTemplate", group: "Programme Governance", title: "AI recommend template", description: "Runs a rule-based keyword scan over intake text to recommend a report template and supplements.", requiredRole: "Any signed-in user", params: [ { name: "intake", type: "string", required: false, description: "Free-text intake description." } ] },
  { action: "governanceListForwardPlanItems", group: "Programme Governance", title: "List forward plan items", description: "Lists all Forward Plan items for the workspace, seeding samples on first read.", requiredRole: "Any signed-in user" },
  { action: "governanceGetForwardPlanItem", group: "Programme Governance", title: "Get forward plan item", description: "Loads a single Forward Plan item after a cross-tenant check.", requiredRole: "Any signed-in user", params: [ { name: "itemId", type: "string", required: true, description: "Item id." } ] },
  { action: "governanceUpsertForwardPlanItem", group: "Programme Governance", title: "Upsert forward plan item", description: "Creates or updates a Forward Plan item, validating enums and recomputing the key-decision flag.", requiredRole: "Client Admin+", params: [ { name: "itemId", type: "string", required: true, description: "Item id (1-80 chars)." }, { name: "patch", type: "object", required: true, description: "Writable item fields." } ] },
  { action: "governanceSoftDeleteForwardPlanItem", group: "Programme Governance", title: "Soft-delete forward plan item", description: "Soft-deletes (or restores) a Forward Plan item, requiring a deletion reason.", requiredRole: "Client Admin+", params: [ { name: "itemId", type: "string", required: true, description: "Item id." }, { name: "restore", type: "boolean", required: false, description: "Restore instead of delete." } ] },
  { action: "governanceMarkForwardPlanItemDecided", group: "Programme Governance", title: "Mark forward plan item decided", description: "Flips a Published Forward Plan item to Decided with an optional outcome note.", requiredRole: "Client Admin+", params: [ { name: "itemId", type: "string", required: true, description: "Item id (must be Published)." } ] },
  { action: "governanceImportForwardPlanDryRun", group: "Programme Governance", title: "Import forward plan (dry run)", description: "Parses and validates an uploaded Forward Plan xlsx and returns a per-row preview without writing.", requiredRole: "Client Admin+", params: [ { name: "fileBase64", type: "string", required: true, description: "Base64 xlsx (≤5MB)." } ] },
  { action: "governanceImportForwardPlanCommit", group: "Programme Governance", title: "Import forward plan (commit)", description: "Re-parses the uploaded xlsx and batch-writes all non-error rows as new Forward Plan items.", requiredRole: "Client Admin+", params: [ { name: "fileBase64", type: "string", required: true, description: "Base64 xlsx (≤5MB)." } ] },
  { action: "governanceConfirmFpItem", group: "Programme Governance", title: "Confirm forward plan request", description: "Confirms a Proposed Forward Plan request to Published and syncs the linked report onto the meeting.", requiredRole: "Client Admin+", params: [ { name: "itemId", type: "string", required: true, description: "Item id (must be Proposed)." } ] },
  { action: "governanceDeclineFpItem", group: "Programme Governance", title: "Decline forward plan request", description: "Declines a Proposed Forward Plan request back to Draft with a required reason.", requiredRole: "Client Admin+", params: [ { name: "itemId", type: "string", required: true, description: "Item id (must be Proposed)." }, { name: "reason", type: "string", required: true, description: "Decline reason (min 5 chars)." } ] },
  { action: "governanceWithdrawFpItem", group: "Programme Governance", title: "Withdraw forward plan request", description: "Lets the requesting PM soft-delete their own Proposed Forward Plan request.", requiredRole: "Any signed-in user (workspace-scoped)", params: [ { name: "itemId", type: "string", required: true, description: "Item id (requester-only, Proposed)." } ] },
  { action: "governanceListReports", group: "Programme Governance", title: "List reports", description: "Lists all workspace reports, seeding samples and backfilling seed links on first read.", requiredRole: "Any signed-in user" },
  { action: "governanceGetReport", group: "Programme Governance", title: "Get report", description: "Loads a single report and stamps first-viewed markers that close the author's withdraw window.", requiredRole: "Any signed-in user", params: [ { name: "reportId", type: "string", required: true, description: "Report id." } ] },
  { action: "governanceUpsertReport", group: "Programme Governance", title: "Upsert report", description: "Creates or updates a Draft report, enforces a 72h meeting-slot lock, and auto-proposes a linked FP item.", requiredRole: "Any signed-in user (workspace-scoped)", params: [ { name: "reportId", type: "string", required: true, description: "Report id (1-80 chars)." }, { name: "patch", type: "object", required: true, description: "Writable report fields." } ] },
  { action: "governanceSoftDeleteReport", group: "Programme Governance", title: "Soft-delete report", description: "Soft-deletes (or restores) a report, requiring a deletion reason.", requiredRole: "Any signed-in user (workspace-scoped)", params: [ { name: "reportId", type: "string", required: true, description: "Report id." }, { name: "restore", type: "boolean", required: false, description: "Restore instead of delete." } ] },
  { action: "governanceListReportSections", group: "Programme Governance", title: "List report sections", description: "Lists a report's sections, lazily instantiating them from the template on first read.", requiredRole: "Any signed-in user", params: [ { name: "reportId", type: "string", required: true, description: "Report id." } ] },
  { action: "governanceSaveReportSection", group: "Programme Governance", title: "Save report section", description: "Auto-saves a report section's content and word count while the report is Draft.", requiredRole: "Any signed-in user (workspace-scoped)", params: [ { name: "reportId", type: "string", required: true, description: "Report id." }, { name: "sectionId", type: "string", required: true, description: "Section id." }, { name: "patch", type: "object", required: true, description: "Writable section fields." } ] },
  { action: "governanceSubmitReport", group: "Programme Governance", title: "Submit report", description: "Owner submits a Draft or resubmits an AmendmentsRequested report into the review workflow.", requiredRole: "Any signed-in user (workspace-scoped)", params: [ { name: "reportId", type: "string", required: true, description: "Report id." } ] },
  { action: "governanceWithdrawReport", group: "Programme Governance", title: "Withdraw report", description: "Owner withdraws an in-review submission back to Draft within the 1h pre-open window.", requiredRole: "Any signed-in user (workspace-scoped)", params: [ { name: "reportId", type: "string", required: true, description: "Report id." } ] },
  { action: "governanceRequestAmendments", group: "Programme Governance", title: "Request amendments", description: "Programme Manager moves an InReview report to AmendmentsRequested with amendment items.", requiredRole: "Client Admin+", params: [ { name: "reportId", type: "string", required: true, description: "Report id (InReview)." }, { name: "amendments", type: "array", required: true, description: "Amendment objects ({ text, sectionId? })." } ] },
  { action: "governanceApproveReport", group: "Programme Governance", title: "Approve report", description: "Programme Manager approves an InReview report, moving it to Approved.", requiredRole: "Client Admin+", params: [ { name: "reportId", type: "string", required: true, description: "Report id (InReview)." } ] },
  { action: "governanceAbandonReport", group: "Programme Governance", title: "Abandon report", description: "Owner or Programme Manager abandons a non-approved report with a required reason.", requiredRole: "Any signed-in user (workspace-scoped)", params: [ { name: "reportId", type: "string", required: true, description: "Report id." }, { name: "reason", type: "string", required: true, description: "Abandonment reason." } ] },
  { action: "governanceListAmendments", group: "Programme Governance", title: "List amendments", description: "Lists all amendments for a report after a cross-tenant check, by creation time.", requiredRole: "Any signed-in user", params: [ { name: "reportId", type: "string", required: true, description: "Report id." } ] },
  { action: "governanceResolveAmendment", group: "Programme Governance", title: "Resolve amendment", description: "Marks an amendment resolved (report owner or Client Admin).", requiredRole: "Any signed-in user (workspace-scoped)", params: [ { name: "amendmentId", type: "string", required: true, description: "Amendment id." } ] },
  { action: "governanceRenderReportPdf", group: "Programme Governance", title: "Render report PDF", description: "Renders a preview report PDF at the current status with optional watermark and Part 2 redaction.", requiredRole: "Any signed-in user", params: [ { name: "reportId", type: "string", required: true, description: "Report id." } ] },
  { action: "governanceSignPartA", group: "Programme Governance", title: "Sign Part A", description: "Strategic Director signs an Approved report, generating the sealed PDF and flipping status to Sealed.", requiredRole: "Strategic Director or Client Admin+", params: [ { name: "reportId", type: "string", required: true, description: "Report id (Approved)." } ] },
  { action: "governanceSeniorPmApprove", group: "Programme Governance", title: "Senior PM approve", description: "Senior Project Manager clears a PendingSeniorPmReview report to InReview.", requiredRole: "Senior PM+", params: [ { name: "reportId", type: "string", required: true, description: "Report id (PendingSeniorPmReview)." } ] },
  { action: "governanceSeniorPmRequestAmendments", group: "Programme Governance", title: "Senior PM request amendments", description: "Senior Project Manager moves a PendingSeniorPmReview report to AmendmentsRequested.", requiredRole: "Senior PM+", params: [ { name: "reportId", type: "string", required: true, description: "Report id." }, { name: "amendments", type: "array", required: true, description: "Amendment objects." } ] },
  { action: "governanceUnlockReport", group: "Programme Governance", title: "Unlock report for correction", description: "Programme Manager re-opens a Sealed report to Draft, appending a required-reason unlock-history entry.", requiredRole: "Client Admin+", params: [ { name: "reportId", type: "string", required: true, description: "Report id (Sealed)." }, { name: "reason", type: "string", required: true, description: "Unlock reason (min 5 chars)." } ] },
  { action: "governanceListReviewers", group: "Programme Governance", title: "List reviewers", description: "Lists workspace users eligible as report reviewers (admins, client admins, senior PMs, Strategic Directors).", requiredRole: "Any signed-in user" },
  { action: "governanceListMyOpenAmendments", group: "Programme Governance", title: "List my open amendments", description: "Returns every open amendment on reports owned by the signed-in user.", requiredRole: "Any signed-in user" },
  { action: "governanceGetDashboard", group: "Programme Governance", title: "Get governance dashboard", description: "Returns a role-aware governance dashboard with metrics, inbox, and an assembled briefing.", requiredRole: "Any signed-in user", params: [ { name: "asOfMonth", type: "string", required: false, description: "Optional YYYY-MM to source from a snapshot." } ] },
  { action: "governanceGenerateBriefing", group: "Programme Governance", title: "Generate briefing", description: "Rewrites caller-supplied stub lines into a role-appropriate briefing without persisting anything.", requiredRole: "Any signed-in user", params: [ { name: "role", type: "string", required: true, description: "'pgm' or 'pm'." }, { name: "stubLines", type: "array", required: true, description: "Stub strings to rewrite (max 8)." } ] },
  { action: "governanceListMeetings", group: "Programme Governance", title: "List meetings", description: "Returns all meetings in the caller's workspace, seeding demo meetings on the first read.", requiredRole: "Any signed-in user (workspace-scoped)" },
  { action: "governanceGetMeeting", group: "Programme Governance", title: "Get meeting", description: "Returns a single meeting by id with a cross-tenant ownership guard.", requiredRole: "Any signed-in user (workspace-scoped)", params: [ { name: "meetingId", type: "string", required: true, description: "Meeting id." } ] },
  { action: "governanceUpsertMeeting", group: "Programme Governance", title: "Create or update meeting", description: "Creates or edits a Scheduled meeting using a field whitelist, owner-or-admin gated.", requiredRole: "Client Admin+ (or meeting owner)", params: [ { name: "meetingId", type: "string", required: true, description: "Meeting id." }, { name: "patch", type: "object", required: false, description: "Whitelisted meeting fields." } ] },
  { action: "governanceSoftDeleteMeeting", group: "Programme Governance", title: "Soft-delete or restore meeting", description: "Soft-deletes (or restores) a meeting; blocks deleting Held meetings and needs a reason.", requiredRole: "Client Admin+ (or meeting owner)", params: [ { name: "meetingId", type: "string", required: true, description: "Meeting id." }, { name: "restore", type: "boolean", required: false, description: "Restore instead of delete." } ] },
  { action: "governanceMarkMeetingHeld", group: "Programme Governance", title: "Mark meeting held", description: "Transitions a Scheduled meeting to Held.", requiredRole: "Client Admin+ (or meeting owner)", params: [ { name: "meetingId", type: "string", required: true, description: "Meeting id." } ] },
  { action: "governanceCancelMeeting", group: "Programme Governance", title: "Cancel meeting", description: "Cancels a Scheduled meeting and flags linked forward-plan items and reports for re-routing.", requiredRole: "Client Admin+ (or meeting owner)", params: [ { name: "meetingId", type: "string", required: true, description: "Meeting id." }, { name: "reason", type: "string", required: true, description: "Cancellation reason (min 5 chars)." } ] },
  { action: "governanceRescheduleMeeting", group: "Programme Governance", title: "Reschedule meeting", description: "Moves a Scheduled meeting to a new date/time, records reschedule history, and syncs linked FP items.", requiredRole: "Client Admin+ (or meeting owner)", params: [ { name: "meetingId", type: "string", required: true, description: "Meeting id." }, { name: "newDate", type: "string", required: true, description: "New ISO date." }, { name: "reason", type: "string", required: true, description: "Reason (min 5 chars)." } ] },
  { action: "governanceSaveMeetingMinutes", group: "Programme Governance", title: "Save meeting minutes", description: "Saves Tiptap minutes content and word count on a Scheduled or Held meeting.", requiredRole: "Client Admin+ (or meeting owner)", params: [ { name: "meetingId", type: "string", required: true, description: "Meeting id." }, { name: "content", type: "object", required: false, description: "Tiptap minutes JSON." } ] },
  { action: "governanceAddMeetingDecision", group: "Programme Governance", title: "Add meeting decision", description: "Appends a decision (min 3 chars) to a Held meeting.", requiredRole: "Client Admin+ (or meeting owner)", params: [ { name: "meetingId", type: "string", required: true, description: "Held meeting id." }, { name: "text", type: "string", required: true, description: "Decision text." } ] },
  { action: "governanceDeleteMeetingDecision", group: "Programme Governance", title: "Delete meeting decision", description: "Removes a decision from a Held meeting by decision id.", requiredRole: "Client Admin+ (or meeting owner)", params: [ { name: "meetingId", type: "string", required: true, description: "Held meeting id." }, { name: "decisionId", type: "string", required: true, description: "Decision id." } ] },
  { action: "governanceAddMeetingActionItem", group: "Programme Governance", title: "Add meeting action item", description: "Appends an open action item (min 3 chars) with optional owner and due date to a Held meeting.", requiredRole: "Client Admin+ (or meeting owner)", params: [ { name: "meetingId", type: "string", required: true, description: "Held meeting id." }, { name: "text", type: "string", required: true, description: "Action item text." } ] },
  { action: "governanceToggleMeetingActionItem", group: "Programme Governance", title: "Toggle meeting action item", description: "Flips a Held meeting action item between open and done.", requiredRole: "Client Admin+ (or meeting owner)", params: [ { name: "meetingId", type: "string", required: true, description: "Held meeting id." }, { name: "actionItemId", type: "string", required: true, description: "Action item id." } ] },
  { action: "governanceDeleteMeetingActionItem", group: "Programme Governance", title: "Delete meeting action item", description: "Removes an action item from a Held meeting by id.", requiredRole: "Client Admin+ (or meeting owner)", params: [ { name: "meetingId", type: "string", required: true, description: "Held meeting id." }, { name: "actionItemId", type: "string", required: true, description: "Action item id." } ] },
  { action: "governanceUpdateMeetingLinks", group: "Programme Governance", title: "Update meeting links", description: "Updates the linked report and project id arrays on a Scheduled or Held meeting.", requiredRole: "Client Admin+ (or meeting owner)", params: [ { name: "meetingId", type: "string", required: true, description: "Meeting id." } ] },
  { action: "governanceListWorkspaceMembers", group: "Programme Governance", title: "List workspace members", description: "Returns every user in the caller's workspace for attendee and owner pickers.", requiredRole: "Any signed-in user (workspace-scoped)" },
  { action: "governanceBulkCreateRecurringMeetings", group: "Programme Governance", title: "Bulk create recurring meetings", description: "Generates a recurring series of Scheduled meetings from a pattern, shifting off UK bank holidays.", requiredRole: "Client Admin+", params: [ { name: "governanceBodyId", type: "string", required: true, description: "Governance body id." }, { name: "pattern", type: "string", required: true, description: "weekly | monthly | quarterly." }, { name: "startDate", type: "string", required: true, description: "First occurrence ISO date." }, { name: "numOccurrences", type: "number", required: true, description: "Number of meetings (1-60)." } ] },
  { action: "governanceImportMeetingsDryRun", group: "Programme Governance", title: "Import meetings (dry run)", description: "Parses an uploaded Excel file and returns validated rows plus a summary without writing.", requiredRole: "Client Admin+", params: [ { name: "fileBase64", type: "string", required: true, description: "Base64 xlsx (max 5MB)." } ] },
  { action: "governanceImportMeetingsCommit", group: "Programme Governance", title: "Import meetings (commit)", description: "Re-parses the uploaded Excel file and writes all error-free rows as Scheduled meetings.", requiredRole: "Client Admin+", params: [ { name: "fileBase64", type: "string", required: true, description: "Base64 xlsx (max 5MB)." } ] },
  { action: "governanceExportMeetingsXlsx", group: "Programme Governance", title: "Export meetings to Excel", description: "Exports all non-deleted workspace meetings as a base64 xlsx file.", requiredRole: "Client Admin+" },
  { action: "governanceListProjectDocs", group: "Programme Governance", title: "List project governance docs", description: "Returns project governance docs for the workspace, optionally filtered by project, seeding on first read.", requiredRole: "Any signed-in user (workspace-scoped)", params: [ { name: "projectId", type: "string", required: false, description: "Optional project filter." } ] },
  { action: "governanceGetProjectDoc", group: "Programme Governance", title: "Get project governance doc", description: "Returns a single project governance doc with a cross-tenant guard.", requiredRole: "Any signed-in user (workspace-scoped)", params: [ { name: "docId", type: "string", required: true, description: "Doc id." } ] },
  { action: "governanceUpsertProjectDoc", group: "Programme Governance", title: "Create or update project governance doc", description: "Creates or edits a Draft project governance doc via a field whitelist; Published docs are immutable.", requiredRole: "Client Admin+ (or doc owner)", params: [ { name: "docId", type: "string", required: true, description: "Doc id." }, { name: "patch", type: "object", required: false, description: "Whitelisted fields; projectId required on create." } ] },
  { action: "governancePublishProjectDoc", group: "Programme Governance", title: "Publish project governance doc", description: "Transactionally publishes a Draft doc, bumping the version and snapshotting it.", requiredRole: "Client Admin+ (or doc owner)", params: [ { name: "docId", type: "string", required: true, description: "Draft doc id." } ] },
  { action: "governanceListProjectDocVersions", group: "Programme Governance", title: "List project governance doc versions", description: "Returns the prior published version snapshots for a doc, newest first.", requiredRole: "Any signed-in user (workspace-scoped)", params: [ { name: "docId", type: "string", required: true, description: "Doc id." } ] },
  { action: "governanceSoftDeleteProjectDoc", group: "Programme Governance", title: "Soft-delete or restore project governance doc", description: "Soft-deletes (or restores) a project governance doc, requiring a reason on delete.", requiredRole: "Client Admin+ (or doc owner)", params: [ { name: "docId", type: "string", required: true, description: "Doc id." }, { name: "restore", type: "boolean", required: false, description: "Restore instead of delete." } ] },
  { action: "governanceListArchive", group: "Programme Governance", title: "List archive", description: "Aggregates sealed reports, held meetings, and published docs into one archive view, optionally as-of a month.", requiredRole: "Any signed-in user (workspace-scoped)", params: [ { name: "asOfMonth", type: "string", required: false, description: "Optional YYYY-MM historical snapshot." } ] },
  { action: "governanceGetArchiveAuditTrail", group: "Programme Governance", title: "Get archive audit trail", description: "Returns tenant-scoped audit events for a specific entity, newest first.", requiredRole: "Any signed-in user (workspace-scoped)", params: [ { name: "entityId", type: "string", required: true, description: "Entity id." } ] },
  { action: "governanceExportArchiveFoi", group: "Programme Governance", title: "Export archive FOI CSV", description: "Exports the archive as a metadata-only, FOI-safe CSV file encoded in base64.", requiredRole: "Any signed-in user (workspace-scoped)" },
  { action: "governanceNudgeItem", group: "Programme Governance", title: "Nudge item", description: "Fires a one-off chase for a single item in the caller's workspace outside the normal cron queue.", requiredRole: "Client Admin+", params: [ { name: "itemId", type: "string", required: true, description: "Item id to nudge." } ] },
  { action: "governanceListChaseEvents", group: "Programme Governance", title: "List chase events", description: "Returns the workspace's most recent chase-engine log rows, newest first.", requiredRole: "Any signed-in user (workspace-scoped)" },

  // ── Monitoring & Alerts ──────────────────────────────────────────────────
  { action: "listDetectedAlerts", group: "Monitoring & Alerts", title: "List detected alerts", description: "Returns the workspace's detected alerts, most recent first.", requiredRole: "Any signed-in user (workspace-scoped)" },
  { action: "markDetectedAlertRead", group: "Monitoring & Alerts", title: "Mark detected alert read", description: "Marks a detected alert as read for the current user with a cross-tenant guard.", requiredRole: "Any signed-in user (workspace-scoped)", params: [ { name: "id", type: "string", required: true, description: "Detected alert id." } ] },

  // ── Historical Reporting ─────────────────────────────────────────────────
  { action: "hrcListAvailableMonths", group: "Historical Reporting", title: "List available snapshot months", description: "Returns the YearMonth strings with snapshots for the workspace plus deployment activation markers.", requiredRole: "Any signed-in user (workspace-scoped)" },
  { action: "hrcReadSnapshot", group: "Historical Reporting", title: "Read snapshot", description: "Returns the frozen state of one collection for one month in the caller's workspace.", requiredRole: "Any signed-in user (workspace-scoped)", params: [ { name: "yearMonth", type: "string", required: true, description: "Target month (YYYY-MM)." }, { name: "collection", type: "string", required: true, description: "Snapshot collection." } ] },
  { action: "hrcInspectSnapshot", group: "Historical Reporting", title: "Inspect snapshot", description: "Returns snapshot parent metadata and per-collection row counts for a month, without the full payload.", requiredRole: "Client Admin+", params: [ { name: "yearMonth", type: "string", required: true, description: "Target month (YYYY-MM)." } ] },
  { action: "hrcListCorrections", group: "Historical Reporting", title: "List snapshot corrections", description: "Returns the correction-history entries for a snapshot, optionally filtered, newest first.", requiredRole: "Any signed-in user (workspace-scoped)", params: [ { name: "yearMonth", type: "string", required: true, description: "Target month (YYYY-MM)." } ] },
  { action: "hrcCorrectSnapshotRow", group: "Historical Reporting", title: "Correct snapshot row", description: "Patches one frozen snapshot row, appends an immutable correction-history entry, and fires an audit event.", requiredRole: "Admin", params: [ { name: "yearMonth", type: "string", required: true, description: "Target month (YYYY-MM)." }, { name: "collection", type: "string", required: true, description: "Snapshot collection." }, { name: "docId", type: "string", required: true, description: "Row id." }, { name: "patch", type: "object", required: true, description: "Fields to merge." }, { name: "reason", type: "string", required: true, description: "Correction reason (min 5 chars)." } ] },
  { action: "hrcGetDeploymentMeta", group: "Historical Reporting", title: "Get deployment meta", description: "Returns the workspace's snapshot deployment metadata (first/last snapshot month and run count).", requiredRole: "Any signed-in user (workspace-scoped)" },
];

/** Set of every action name documented in this catalog (for the coverage test). */
export function documentedActionSet(): Set<string> {
  return new Set(API_ACTIONS.map((a) => a.action));
}
