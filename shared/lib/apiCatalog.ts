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
];

/** Set of every action name documented in this catalog (for the coverage test). */
export function documentedActionSet(): Set<string> {
  return new Set(API_ACTIONS.map((a) => a.action));
}
