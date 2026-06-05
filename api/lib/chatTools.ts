// AI Chat Tool Registry.
// Each tool: name, description, Gemini-compatible JSON-Schema parameters,
// a role gate predicate, and an execute() that returns minimal projections.
// executeTool() is the single chokepoint that enforces the role gate and
// calls isAuthorizedForContext where needed.

import type { ApiContext } from "./context.js";
import { ROLE_STRINGS } from "../../shared/constants/roleConstants.js";
import { FieldValue, FieldPath } from "firebase-admin/firestore";

export type ToolName =
  | "listAccessibleProjects"
  | "getProjectDetails"
  | "listAccessibleProgrammes"
  | "getProgrammeDetails"
  | "searchRisks"
  | "searchIssues"
  | "searchComplianceItems"
  | "getKRIs"
  | "searchForwardPlanItems"
  | "searchMeetings"
  | "searchReports"
  | "searchTacEnquiries"
  | "searchRfis"
  | "searchMeetingTemplates"
  | "getGovernanceFramework"
  | "listProjectGovernanceDocs"
  | "listGovernanceArchive"
  | "listAuditFlaggedTacEnquiries"
  | "getMyTasks"
  | "getMonthlyHistoricalSnapshot"
  | "crossTenantListClients";

export interface ToolDef {
  name: ToolName;
  description: string;
  parameters: {
    type: "object";
    properties: Record<string, any>;
    required?: string[];
  };
  isAllowed: (ctx: ApiContext) => boolean;
  execute: (ctx: ApiContext, args: Record<string, any>) => Promise<any>;
}

// --- Role predicates ---
const anySignedIn = (_ctx: ApiContext) => true;
const isProgrammeManager = (ctx: ApiContext) =>
  ctx.isAdmin ||
  ctx.isClientAdmin ||
  ctx.userData?.role === ROLE_STRINGS.PROGRAMME_MANAGER ||
  ctx.userData?.role === ROLE_STRINGS.SENIOR_PM ||
  ctx.userData?.role === ROLE_STRINGS.STRATEGIC_DIRECTOR;
const isAdminOnly = (ctx: ApiContext) => ctx.isAdmin;

// Hard upper bound on records the AI can pull in one call. Anything larger
// would push the prompt over a free model's context window in the next round.
const TOOL_RESULT_HARD_CAP = 100;

// --- Helpers ---
async function getAccessibleProjectIds(ctx: ApiContext): Promise<string[]> {
  const { db, uid, email, isAdmin, isClientAdmin, primaryUid, userData } = ctx;

  if (isAdmin) {
    // Super admin: cross-tenant. Ordered by most-recently-updated so the AI
    // sees an actionable slice, not an alphabetical lottery.
    const snap = await db
      .collection("projects")
      .orderBy("updatedAt", "desc")
      .limit(500)
      .get();
    return snap.docs.map((d) => d.id);
  }

  if (isClientAdmin) {
    const snap = await db
      .collection("projects")
      .where("clientId", "==", primaryUid)
      .limit(200)
      .get();
    return snap.docs.map((d) => d.id);
  }

  // Programme Manager — projects under their programmes
  if (userData?.role === ROLE_STRINGS.PROGRAMME_MANAGER ||
      userData?.role === ROLE_STRINGS.SENIOR_PM) {
    const [progSnap, projSnap] = await Promise.all([
      db.collection("programmes").where("clientId", "==", primaryUid).get(),
      db.collection("projects").where("clientId", "==", primaryUid).get(),
    ]);
    const myProgIds = progSnap.docs
      .filter((d) => {
        const p = d.data();
        return (
          p.userId === uid ||
          p.pm === email ||
          (Array.isArray(p.assignedPMIds) && p.assignedPMIds.includes(uid))
        );
      })
      .map((d) => d.id);

    return projSnap.docs
      .filter((d) => myProgIds.includes(d.data().programmeId))
      .map((d) => d.id);
  }

  // Project Manager — own projects
  const snaps = await Promise.all([
    db.collection("projects").where("userId", "==", uid).limit(50).get(),
    db.collection("projects").where("pmId", "==", uid).limit(50).get(),
    db.collection("projects").where("creatorId", "==", uid).limit(50).get(),
  ]);
  const ids = new Set<string>();
  for (const s of snaps) {
    for (const d of s.docs) ids.add(d.id);
  }
  return [...ids].slice(0, 100);
}

/**
 * Resolve a programme id to the set of project ids inside that programme
 * that the current user is also allowed to see. Used by every search tool
 * that accepts a `programmeId` filter — lets the AI ask "risks in
 * Greater London Housing Renewal 2026" and bridge programme → projects →
 * sub-collection reads without leaking projects from another tenant.
 */
async function resolveProgrammeProjectIds(
  ctx: ApiContext,
  programmeId: string,
): Promise<string[]> {
  const { db, primaryUid, isAdmin, isClientAdmin } = ctx;
  if (!programmeId || typeof programmeId !== "string") return [];
  const authorised = await ctx.isAuthorizedForContext(programmeId);
  if (!authorised) return [];

  let query: FirebaseFirestore.Query = db
    .collection("projects")
    .where("programmeId", "==", programmeId);
  if (!isAdmin) {
    query = query.where("clientId", "==", primaryUid);
  }
  const snap = await query.limit(500).get();
  const programmeProjectIds = snap.docs.map((d) => d.id);

  // Admin and client_admin see every project in their tenant — no extra
  // narrowing needed. PM / Programme Manager only see projects they're
  // assigned to, so intersect with their accessible set.
  if (isAdmin || isClientAdmin) return programmeProjectIds;
  const accessible = new Set(await getAccessibleProjectIds(ctx));
  return programmeProjectIds.filter((id) => accessible.has(id));
}

/**
 * One-shot resolver for the (projectId? | programmeId? | nothing) arg
 * triple every search tool now accepts. Returns the project ids to read
 * sub-collections from. The order matters:
 *   - projectId wins (most specific)
 *   - programmeId next (programme expansion)
 *   - otherwise all accessible projects
 *
 * CRITICAL — every branch must authorise BEFORE returning an id.
 * `readProjectSubCollection` reads `projects/{id}/data/{subDoc}` via the
 * Admin SDK (which bypasses Firestore rules), so if an unauthorised id
 * slips through here the downstream read leaks foreign-tenant data. The
 * bare-projectId branch in particular used to return the arg verbatim;
 * the model can be steered into supplying a foreign id (via scopeContext
 * pollution, a leaked screenshot, ID guessing, etc.) so we now require
 * `isAuthorizedForContext` to clear before yielding it.
 */
async function resolveTargetProjectIds(
  ctx: ApiContext,
  args: { projectId?: string; programmeId?: string },
): Promise<string[]> {
  if (args.projectId) {
    const ok = await ctx.isAuthorizedForContext(args.projectId);
    return ok ? [args.projectId] : [];
  }
  if (args.programmeId) return resolveProgrammeProjectIds(ctx, args.programmeId);
  return getAccessibleProjectIds(ctx);
}

async function readProjectSubCollection(
  ctx: ApiContext,
  projectId: string,
  subDoc: string,
): Promise<any[]> {
  const { db } = ctx;
  const doc = await db
    .collection("projects")
    .doc(projectId)
    .collection("data")
    .doc(subDoc)
    .get();
  if (!doc.exists) return [];
  const d = doc.data() as any;
  return Array.isArray(d?.data) ? d.data : [];
}

// Programme-level sub-collection reader. IMPORTANT: programme data shares the
// SAME Firestore path family as project data — `projects/{id}/data/{subDoc}` —
// with the programmeId used as the {id}. See useStore.loadProgrammeData and
// api/routes/data.ts:getData where `api.getData("risks", programmeId)` hits
// exactly this path. Reading from `programmes/{id}/data/...` returned nothing
// because that collection isn't where the app writes.
async function readProgrammeSubCollection(
  ctx: ApiContext,
  programmeId: string,
  subDoc: string,
): Promise<any[]> {
  const { db } = ctx;
  if (!programmeId) return [];
  const authorised = await ctx.isAuthorizedForContext(programmeId);
  if (!authorised) return [];
  const doc = await db
    .collection("projects")
    .doc(programmeId)
    .collection("data")
    .doc(subDoc)
    .get();
  if (!doc.exists) return [];
  const d = doc.data() as any;
  return Array.isArray(d?.data) ? d.data : [];
}

// Reads the same sub-collection across many projects concurrently. Annotates
// each row with its parent project id and returns a flat array.
async function readProjectSubCollectionsBulk(
  ctx: ApiContext,
  projectIds: string[],
  subDoc: string,
): Promise<Array<{ projectId: string; row: any }>> {
  const results = await Promise.all(
    projectIds.map(async (pid) => {
      const rows = await readProjectSubCollection(ctx, pid, subDoc);
      return rows.map((row) => ({ projectId: pid, row }));
    }),
  );
  return results.flat();
}

// Batched project-name lookup. Returns a Map<projectId, projectName>.
// Used by the search tools to enrich each row with a HUMAN-READABLE project
// label so the AI never has to fall back to a raw projectId in its prose
// (free models ignore the "no raw IDs" prompt rule about 30% of the time;
// removing the ID from the AI-facing projection makes the rule moot).
async function fetchProjectNames(
  ctx: ApiContext,
  projectIds: string[],
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const unique = [...new Set(projectIds.filter(Boolean))];
  if (unique.length === 0) return out;
  // Firestore Admin `in` clause supports up to 30 ids per query. Chunk.
  const CHUNK = 30;
  const chunks: string[][] = [];
  for (let i = 0; i < unique.length; i += CHUNK) chunks.push(unique.slice(i, i + CHUNK));
  await Promise.all(
    chunks.map(async (ids) => {
      // documentId() lookup avoids exposing other fields and is index-free.
      const snap = await ctx.db
        .collection("projects")
        .where(FieldPath.documentId(), "in", ids)
        .get();
      for (const d of snap.docs) {
        const data = d.data() as any;
        const name =
          (typeof data?.name === "string" && data.name) ||
          (typeof data?.projectName === "string" && data.projectName) ||
          null;
        if (name) out.set(d.id, name);
      }
    }),
  );
  return out;
}

// --- Tool definitions ---
export const CHAT_TOOLS: ToolDef[] = [
  // ── Projects ──────────────────────────────────────────────────────────
  {
    name: "listAccessibleProjects",
    description:
      "List all projects the current user has access to. Optionally filter by programmeId to enumerate only projects under that programme — useful for answering 'what projects are in this programme'. Returns id, name, status, programme, RIBA stage, and key dates.",
    parameters: {
      type: "object",
      properties: {
        statusFilter: {
          type: "string",
          description: "Optional: filter by project status (e.g. 'Active', 'Complete')",
        },
        programmeId: {
          type: "string",
          description:
            "Optional: only return projects under this programme. Use this to enumerate a programme's children.",
        },
        limit: {
          type: "number",
          description: "Max results (default 50, max 100)",
        },
      },
    },
    isAllowed: anySignedIn,
    execute: async (ctx, args) => {
      const { db } = ctx;
      const projectIds = args.programmeId
        ? await resolveProgrammeProjectIds(ctx, args.programmeId)
        : await getAccessibleProjectIds(ctx);
      if (!projectIds.length) return [];

      const limit = Math.min(Number(args.limit) || 50, TOOL_RESULT_HARD_CAP);

      // Firestore `in` operator max 30 items per query — read every chunk in parallel.
      const chunks: string[][] = [];
      for (let i = 0; i < projectIds.length; i += 30) {
        chunks.push(projectIds.slice(i, i + 30));
      }
      const snapshots = await Promise.all(
        chunks.map((chunk) =>
          db.collection("projects").where("__name__", "in", chunk).get(),
        ),
      );

      const matched: any[] = [];
      for (const snap of snapshots) {
        for (const d of snap.docs) {
          const p = d.data();
          if (args.statusFilter && p.status !== args.statusFilter) continue;
          matched.push({
            id: d.id,
            name: p.name || p.projectName,
            status: p.status,
            ribaStage: p.ribaStage,
            programmeId: p.programmeId,
            programmeName: p.programmeName,
            startDate: p.startDate,
            endDate: p.endDate,
            location: p.location,
            clientId: p.clientId,
          });
        }
      }
      const truncated = matched.length > limit;
      const out = matched.slice(0, limit);
      return truncated ? [...out, { _truncated: true, totalMatched: matched.length, returned: out.length }] : out;
    },
  },

  {
    name: "getProjectDetails",
    description:
      "Get full details for a specific project by ID, including contact info, team, financials.",
    parameters: {
      type: "object",
      properties: {
        projectId: {
          type: "string",
          description: "The project document ID",
        },
      },
      required: ["projectId"],
    },
    isAllowed: anySignedIn,
    execute: async (ctx, args) => {
      const { db, isAuthorizedForContext } = ctx;
      const { projectId } = args;
      if (!(await isAuthorizedForContext(projectId))) {
        return { error: "Not authorised to view this project" };
      }
      const doc = await db.collection("projects").doc(projectId).get();
      if (!doc.exists) return { error: "Project not found" };
      const p = doc.data() as any;
      return {
        id: doc.id,
        name: p.name || p.projectName,
        description: p.description,
        status: p.status,
        ribaStage: p.ribaStage,
        programmeId: p.programmeId,
        programmeName: p.programmeName,
        startDate: p.startDate,
        endDate: p.endDate,
        location: p.location,
        contractValue: p.contractValue,
        projectManager: p.projectManager || p.pm,
        clientName: p.clientName,
        sector: p.sector,
        procurementRoute: p.procurementRoute,
        deliveryMethod: p.deliveryMethod,
        keyMilestones: p.keyMilestones,
      };
    },
  },

  // ── Programmes ────────────────────────────────────────────────────────
  {
    name: "listAccessibleProgrammes",
    description:
      "List all programmes the current user has access to. Returns id, name, status, PM, and project count.",
    parameters: {
      type: "object",
      properties: {
        limit: { type: "number", description: "Max results (default 50)" },
      },
    },
    isAllowed: anySignedIn,
    execute: async (ctx, args) => {
      const { db, uid, email, isAdmin, isClientAdmin, primaryUid } = ctx;
      const limit = Math.min(Number(args.limit) || 50, TOOL_RESULT_HARD_CAP);
      const READ_CAP = Math.min(limit * 3, 300);

      const snap = isAdmin
        ? await db.collection("programmes").orderBy("updatedAt", "desc").limit(READ_CAP).get()
        : await db
            .collection("programmes")
            .where("clientId", "==", primaryUid)
            .limit(READ_CAP)
            .get();

      const matched: any[] = [];
      for (const d of snap.docs) {
        const p = d.data();
        const canSee =
          isAdmin ||
          isClientAdmin ||
          p.userId === uid ||
          p.pm === email ||
          (Array.isArray(p.assignedPMIds) && p.assignedPMIds.includes(uid));
        if (!canSee) continue;
        matched.push({
          id: d.id,
          name: p.name,
          status: p.status,
          pm: p.pm,
          startDate: p.startDate,
          endDate: p.endDate,
          totalBudget: p.totalBudget,
          projectCount: p.projectCount,
          clientId: p.clientId,
        });
      }
      const truncated = matched.length > limit || snap.size === READ_CAP;
      const out = matched.slice(0, limit);
      return truncated ? [...out, { _truncated: true, totalMatched: matched.length, returned: out.length }] : out;
    },
  },

  {
    name: "getProgrammeDetails",
    description: "Get full details for a specific programme by ID.",
    parameters: {
      type: "object",
      properties: {
        programmeId: {
          type: "string",
          description: "The programme document ID",
        },
      },
      required: ["programmeId"],
    },
    isAllowed: anySignedIn,
    execute: async (ctx, args) => {
      const { db, isAuthorizedForContext } = ctx;
      const { programmeId } = args;
      if (!(await isAuthorizedForContext(programmeId))) {
        return { error: "Not authorised to view this programme" };
      }
      const doc = await db.collection("programmes").doc(programmeId).get();
      if (!doc.exists) return { error: "Programme not found" };
      const p = doc.data() as any;
      return {
        id: doc.id,
        name: p.name,
        description: p.description,
        status: p.status,
        pm: p.pm,
        startDate: p.startDate,
        endDate: p.endDate,
        totalBudget: p.totalBudget,
        objectives: p.objectives,
        stakeholders: p.stakeholders,
        riskProfile: p.riskProfile,
        clientId: p.clientId,
      };
    },
  },

  // ── Risks ─────────────────────────────────────────────────────────────
  {
    name: "searchRisks",
    description:
      "Search risks across accessible projects. Accepts EITHER projectId for a single project OR programmeId to expand across every project inside that programme. Returns id, title, category, likelihood, impact, score, status, owner, and project.",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Text to search within risk title or description",
        },
        projectId: {
          type: "string",
          description: "Filter to a specific project ID",
        },
        programmeId: {
          type: "string",
          description:
            "Filter to a specific programme — expands to every project under that programme the user can access. Use this when the user asks about risks for a programme.",
        },
        status: {
          type: "string",
          description: "Filter by risk status (e.g. 'Open', 'Closed', 'Mitigated')",
        },
        minScore: {
          type: "number",
          description: "Filter risks with score >= this value",
        },
        limit: { type: "number", description: "Max results (default 50)" },
      },
    },
    isAllowed: anySignedIn,
    execute: async (ctx, args) => {
      const projectIds = await resolveTargetProjectIds(ctx, args);
      const { query, status, minScore, limit: rawLimit } = args;
      const limit = Math.min(Number(rawLimit) || 50, TOOL_RESULT_HARD_CAP);
      const q = (query || "").toLowerCase();

      // Programme-level risks live at programmes/{progId}/data/risks
      // (not under any project). When programmeId is set we MUST pull
      // these alongside the per-project rows or programme-level risks
      // are invisible — which was the original bug.
      const programmeRows = args.programmeId
        ? (await readProgrammeSubCollection(ctx, args.programmeId, "risks")).map((row) => ({
            projectId: null as string | null,
            row,
          }))
        : [];

      if (!projectIds.length && programmeRows.length === 0) return [];

      const projectRows = await readProjectSubCollectionsBulk(ctx, projectIds, "risks");
      const all = [...programmeRows, ...projectRows];
      const nameMap = await fetchProjectNames(
        ctx,
        all.map((x) => x.projectId).filter((p): p is string => !!p),
      );

      const matched: any[] = [];
      for (const { projectId: pid, row: r } of all) {
        if (!r || !r.id) continue;
        if (status && r.status !== status) continue;
        if (minScore != null && (r.score ?? r.riskScore ?? 0) < minScore) continue;
        if (q && !`${r.title ?? ""} ${r.description ?? ""}`.toLowerCase().includes(q)) continue;
        matched.push({
          id: r.id,
          // Human-readable project label — the AI quotes this in prose
          // rather than leaking the raw projectId. Citation chips use
          // item.id (risk id) so chip routing is unaffected.
          project: pid ? nameMap.get(pid) ?? "(project name unavailable)" : null,
          scope: pid ? "project" : "programme",
          title: r.title,
          category: r.category,
          likelihood: r.likelihood,
          impact: r.impact,
          score: r.score ?? r.riskScore,
          status: r.status,
          owner: r.owner,
          dueDate: r.dueDate,
          controls: r.controls,
        });
      }
      const truncated = matched.length > limit;
      const out = matched.slice(0, limit);
      return truncated ? [...out, { _truncated: true, totalMatched: matched.length, returned: out.length }] : out;
    },
  },

  // ── Issues ────────────────────────────────────────────────────────────
  {
    name: "searchIssues",
    description:
      "Search issues across accessible projects. Accepts EITHER projectId for a single project OR programmeId to expand across every project under that programme. Returns id, title, priority, status, owner, linked risk, and project.",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "Text search in title/description" },
        projectId: { type: "string", description: "Limit to a specific project" },
        programmeId: {
          type: "string",
          description:
            "Filter to a specific programme — expands to every project under that programme.",
        },
        priority: {
          type: "string",
          description: "Filter by priority (e.g. 'High', 'Medium', 'Low')",
        },
        status: { type: "string", description: "Filter by status (e.g. 'Open', 'Closed')" },
        limit: { type: "number", description: "Max results (default 50)" },
      },
    },
    isAllowed: anySignedIn,
    execute: async (ctx, args) => {
      const projectIds = await resolveTargetProjectIds(ctx, args);
      const { query, priority, status, limit: rawLimit } = args;
      const limit = Math.min(Number(rawLimit) || 50, TOOL_RESULT_HARD_CAP);
      const q = (query || "").toLowerCase();

      const programmeRows = args.programmeId
        ? (await readProgrammeSubCollection(ctx, args.programmeId, "issues")).map((row) => ({
            projectId: null as string | null,
            row,
          }))
        : [];
      if (!projectIds.length && programmeRows.length === 0) return [];

      const projectRows = await readProjectSubCollectionsBulk(ctx, projectIds, "issues");
      const all = [...programmeRows, ...projectRows];
      const nameMap = await fetchProjectNames(
        ctx,
        all.map((x) => x.projectId).filter((p): p is string => !!p),
      );

      const matched: any[] = [];
      for (const { projectId: pid, row: i } of all) {
        if (!i || !i.id) continue;
        if (status && i.status !== status) continue;
        if (priority && i.priority !== priority) continue;
        if (q && !`${i.title ?? ""} ${i.description ?? ""}`.toLowerCase().includes(q)) continue;
        matched.push({
          id: i.id,
          project: pid ? nameMap.get(pid) ?? "(project name unavailable)" : null,
          scope: pid ? "project" : "programme",
          title: i.title,
          description: i.description,
          priority: i.priority,
          status: i.status,
          owner: i.owner,
          dueDate: i.dueDate,
          linkedRiskId: i.linkedRiskId,
        });
      }
      const truncated = matched.length > limit;
      const out = matched.slice(0, limit);
      return truncated ? [...out, { _truncated: true, totalMatched: matched.length, returned: out.length }] : out;
    },
  },

  // ── Compliance Items ──────────────────────────────────────────────────
  {
    name: "searchComplianceItems",
    description:
      "Search compliance items across accessible projects. Accepts EITHER projectId for a single project OR programmeId to expand across every project under that programme. Returns id, title, domain, status, regulation, and project.",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "Text search in title/description" },
        projectId: { type: "string", description: "Limit to a specific project" },
        programmeId: {
          type: "string",
          description:
            "Filter to a specific programme — expands to every project under that programme.",
        },
        domain: { type: "string", description: "Filter by compliance domain" },
        status: {
          type: "string",
          description: "Filter by status (e.g. 'Compliant', 'Non-Compliant', 'Pending')",
        },
        limit: { type: "number", description: "Max results (default 50)" },
      },
    },
    isAllowed: anySignedIn,
    execute: async (ctx, args) => {
      const projectIds = await resolveTargetProjectIds(ctx, args);
      const { query, domain, status, limit: rawLimit } = args;
      const limit = Math.min(Number(rawLimit) || 50, TOOL_RESULT_HARD_CAP);
      const q = (query || "").toLowerCase();

      const programmeRows = args.programmeId
        ? (await readProgrammeSubCollection(ctx, args.programmeId, "complianceItems")).map((row) => ({
            projectId: null as string | null,
            row,
          }))
        : [];
      if (!projectIds.length && programmeRows.length === 0) return [];

      const projectRows = await readProjectSubCollectionsBulk(ctx, projectIds, "complianceItems");
      const all = [...programmeRows, ...projectRows];
      const nameMap = await fetchProjectNames(
        ctx,
        all.map((x) => x.projectId).filter((p): p is string => !!p),
      );

      const matched: any[] = [];
      for (const { projectId: pid, row: c } of all) {
        if (!c || !c.id) continue;
        if (status && c.status !== status) continue;
        if (domain && c.domain !== domain) continue;
        if (q && !`${c.title ?? c.item ?? ""} ${c.description ?? ""}`.toLowerCase().includes(q)) continue;
        matched.push({
          id: c.id,
          project: pid ? nameMap.get(pid) ?? "(project name unavailable)" : null,
          scope: pid ? "project" : "programme",
          title: c.title || c.item,
          domain: c.domain,
          status: c.status,
          regulation: c.regulation || c.regulationRef,
          dueDate: c.dueDate,
          owner: c.owner,
          evidenceRequired: c.evidenceRequired,
        });
      }
      const truncated = matched.length > limit;
      const out = matched.slice(0, limit);
      return truncated ? [...out, { _truncated: true, totalMatched: matched.length, returned: out.length }] : out;
    },
  },

  // ── KRIs ──────────────────────────────────────────────────────────────
  {
    name: "getKRIs",
    description:
      "Get Key Risk Indicators (KRIs) for accessible projects. Accepts EITHER projectId for a single project OR programmeId to expand across every project under that programme. Returns id, name, value, threshold, status, and project.",
    parameters: {
      type: "object",
      properties: {
        projectId: { type: "string", description: "Limit to a specific project" },
        programmeId: {
          type: "string",
          description:
            "Filter to a specific programme — expands to every project under that programme.",
        },
        breached: {
          type: "boolean",
          description: "If true, return only KRIs that have breached their threshold",
        },
        limit: { type: "number", description: "Max results (default 50)" },
      },
    },
    isAllowed: anySignedIn,
    execute: async (ctx, args) => {
      const projectIds = await resolveTargetProjectIds(ctx, args);
      const limit = Math.min(Number(args.limit) || 50, TOOL_RESULT_HARD_CAP);

      const programmeRows = args.programmeId
        ? (await readProgrammeSubCollection(ctx, args.programmeId, "kris")).map((row) => ({
            projectId: null as string | null,
            row,
          }))
        : [];
      if (!projectIds.length && programmeRows.length === 0) return [];

      const projectRows = await readProjectSubCollectionsBulk(ctx, projectIds, "kris");
      const all = [...programmeRows, ...projectRows];
      const nameMap = await fetchProjectNames(
        ctx,
        all.map((x) => x.projectId).filter((p): p is string => !!p),
      );

      const matched: any[] = [];
      for (const { projectId: pid, row: k } of all) {
        if (!k || !k.id) continue;
        const isBreached =
          k.currentValue != null &&
          k.threshold != null &&
          Number(k.currentValue) >= Number(k.threshold);
        if (args.breached === true && !isBreached) continue;
        matched.push({
          id: k.id,
          project: pid ? nameMap.get(pid) ?? "(project name unavailable)" : null,
          scope: pid ? "project" : "programme",
          name: k.name,
          description: k.description,
          currentValue: k.currentValue,
          threshold: k.threshold,
          unit: k.unit,
          status: k.status,
          isBreached,
          trend: k.trend,
        });
      }
      const truncated = matched.length > limit;
      const out = matched.slice(0, limit);
      return truncated ? [...out, { _truncated: true, totalMatched: matched.length, returned: out.length }] : out;
    },
  },

  // ── Forward Plan ──────────────────────────────────────────────────────
  {
    name: "searchForwardPlanItems",
    description:
      "Search governance forward plan items. Returns id, title, governance body, meeting date, status, and decision.",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "Text search in title/description" },
        status: {
          type: "string",
          description: "Filter by status (e.g. 'Proposed', 'Confirmed', 'Decided')",
        },
        governanceBodyId: { type: "string", description: "Filter by governance body" },
        limit: { type: "number", description: "Max results (default 50)" },
      },
    },
    isAllowed: isProgrammeManager,
    execute: async (ctx, args) => {
      const { db, primaryUid, isAdmin } = ctx;
      const limit = Math.min(Number(args.limit) || 50, TOOL_RESULT_HARD_CAP);
      const q = (args.query || "").toLowerCase();

      // Pull a wide page, then JS-filter. Hard upper read cap prevents
      // unbounded scans regardless of how restrictive the JS filters are.
      const READ_CAP = Math.min(limit * 5, 500);
      let baseQuery: FirebaseFirestore.Query = isAdmin
        ? db.collection("forwardPlanItems")
        : db.collection("forwardPlanItems").where("clientId", "==", primaryUid);
      const snap = await baseQuery
        .orderBy("updatedAt", "desc")
        .limit(READ_CAP)
        .get();

      const matched: any[] = [];
      for (const d of snap.docs) {
        const item = d.data();
        if (item.deletedAt) continue;
        if (args.status && item.status !== args.status) continue;
        if (args.governanceBodyId && item.governanceBodyId !== args.governanceBodyId) continue;
        if (q && !`${item.title ?? ""} ${item.description ?? ""}`.toLowerCase().includes(q)) continue;
        matched.push({
          id: d.id,
          title: item.title,
          description: item.description,
          status: item.status,
          governanceBodyId: item.governanceBodyId,
          meetingDate: item.meetingDate,
          decision: item.decision,
          submittedBy: item.submittedBy,
        });
      }
      const truncated = matched.length > limit || snap.size === READ_CAP;
      const out = matched.slice(0, limit);
      return truncated ? [...out, { _truncated: true, totalMatched: matched.length, returned: out.length, hint: "Refine filters to narrow results." }] : out;
    },
  },

  // ── Meetings ──────────────────────────────────────────────────────────
  {
    name: "searchMeetings",
    description:
      "Search governance meetings. Returns id, title, governance body, date, status, attendees, and linked reports. Use governanceBodyId to scope to a specific board, or projectId to find meetings that have linked a given project.",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "Text search in meeting title/location" },
        status: {
          type: "string",
          description: "Filter by status (e.g. 'Scheduled', 'Held', 'Cancelled')",
        },
        governanceBodyId: { type: "string", description: "Filter by governance body" },
        projectId: { type: "string", description: "Filter to meetings whose linkedProjectIds contains this project" },
        fromDate: { type: "string", description: "ISO date: only meetings on or after this date" },
        limit: { type: "number", description: "Max results (default 50)" },
      },
    },
    isAllowed: isProgrammeManager,
    execute: async (ctx, args) => {
      const { db, primaryUid, isAdmin } = ctx;
      const limit = Math.min(Number(args.limit) || 50, TOOL_RESULT_HARD_CAP);
      const q = (args.query || "").toLowerCase();
      // Authorise project scoping. Server-side check so the AI can't probe a
      // foreign project by passing its id; unauthorised → empty result set,
      // not an error (consistent with other tools).
      if (args.projectId) {
        const ok = await ctx.isAuthorizedForContext(args.projectId);
        if (!ok) return [];
      }

      const READ_CAP = Math.min(limit * 5, 500);
      let baseQuery: FirebaseFirestore.Query = isAdmin
        ? db.collection("meetings")
        : db.collection("meetings").where("clientId", "==", primaryUid);
      const snap = await baseQuery
        .orderBy("date", "desc")
        .limit(READ_CAP)
        .get();

      const matched: any[] = [];
      for (const d of snap.docs) {
        const m = d.data();
        if (m.deletedAt) continue;
        if (args.status && m.status !== args.status) continue;
        if (args.governanceBodyId && m.governanceBodyId !== args.governanceBodyId) continue;
        if (args.projectId) {
          const linked = Array.isArray(m.linkedProjectIds) ? m.linkedProjectIds : [];
          if (!linked.includes(args.projectId)) continue;
        }
        if (args.fromDate && m.date < args.fromDate) continue;
        if (q && !`${m.title ?? ""} ${m.location ?? ""}`.toLowerCase().includes(q)) continue;
        matched.push({
          id: d.id,
          title: m.title,
          governanceBodyId: m.governanceBodyId,
          date: m.date,
          timeStart: m.timeStart,
          timeEnd: m.timeEnd,
          location: m.location,
          status: m.status,
          chair: m.chairLabel,
          linkedReportIds: m.linkedReportIds,
        });
      }
      const truncated = matched.length > limit || snap.size === READ_CAP;
      const out = matched.slice(0, limit);
      return truncated ? [...out, { _truncated: true, totalMatched: matched.length, returned: out.length, hint: "Refine filters to narrow results." }] : out;
    },
  },

  // ── Governance Reports ────────────────────────────────────────────────
  {
    name: "searchReports",
    description:
      "Search governance reports. Returns id, reference, title, status, author, submission date, and linked programme.",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "Text search in title/reference" },
        status: {
          type: "string",
          description: "Filter by status (e.g. 'Draft', 'Submitted', 'Approved')",
        },
        limit: { type: "number", description: "Max results (default 50)" },
      },
    },
    isAllowed: anySignedIn,
    execute: async (ctx, args) => {
      const { db, primaryUid, isAdmin } = ctx;
      const limit = Math.min(Number(args.limit) || 50, TOOL_RESULT_HARD_CAP);
      const q = (args.query || "").toLowerCase();

      const READ_CAP = Math.min(limit * 5, 500);
      let baseQuery: FirebaseFirestore.Query = isAdmin
        ? db.collection("reports")
        : db.collection("reports").where("clientId", "==", primaryUid);
      const snap = await baseQuery
        .orderBy("updatedAt", "desc")
        .limit(READ_CAP)
        .get();

      const matched: any[] = [];
      for (const d of snap.docs) {
        const r = d.data();
        if (r.deletedAt) continue;
        if (args.status && r.status !== args.status) continue;
        if (q && !`${r.title ?? ""} ${r.reference ?? ""}`.toLowerCase().includes(q)) continue;
        matched.push({
          id: d.id,
          reference: r.reference,
          title: r.title,
          status: r.status,
          authorId: r.authorId,
          authorName: r.authorName,
          submittedAt: r.submittedAt,
          approvedAt: r.approvedAt,
          programmeId: r.programmeId,
          linkedProjectIds: r.linkedProjectIds,
        });
      }
      const truncated = matched.length > limit || snap.size === READ_CAP;
      const out = matched.slice(0, limit);
      return truncated ? [...out, { _truncated: true, totalMatched: matched.length, returned: out.length, hint: "Refine filters to narrow results." }] : out;
    },
  },

  // ── TAC Enquiries ─────────────────────────────────────────────────────
  {
    name: "searchTacEnquiries",
    description:
      "Search Technical Assurance Companion enquiries. Accepts projectId for one project or programmeId to filter to enquiries on every project under that programme. Returns id, reference, subject, status, project, and stage.",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "Text search in subject/reference" },
        status: {
          type: "string",
          description: "Filter by status (e.g. 'Draft', 'Open', 'Closed')",
        },
        projectId: { type: "string", description: "Filter by project" },
        programmeId: {
          type: "string",
          description:
            "Filter to enquiries whose project sits under this programme.",
        },
        limit: { type: "number", description: "Max results (default 50)" },
      },
    },
    isAllowed: anySignedIn,
    execute: async (ctx, args) => {
      const { db, primaryUid, isAdmin } = ctx;
      const limit = Math.min(Number(args.limit) || 50, TOOL_RESULT_HARD_CAP);
      const q = (args.query || "").toLowerCase();

      // If programmeId was supplied, resolve to project ids up-front so we
      // can apply the filter in JS after the Firestore read.
      let programmeProjectIdSet: Set<string> | null = null;
      if (args.programmeId) {
        const ids = await resolveProgrammeProjectIds(ctx, args.programmeId);
        programmeProjectIdSet = new Set(ids);
        if (programmeProjectIdSet.size === 0) return [];
      }

      const READ_CAP = Math.min(limit * 5, 500);
      let baseQuery: FirebaseFirestore.Query = isAdmin
        ? db.collection("enquiries")
        : db.collection("enquiries").where("clientId", "==", primaryUid);
      const snap = await baseQuery
        .orderBy("updatedAt", "desc")
        .limit(READ_CAP)
        .get();

      const stagedDocs: Array<{ d: any; e: any; bareId: string }> = [];
      for (const d of snap.docs) {
        const e = d.data();
        if (e.deletedAt) continue;
        if (args.status && e.status !== args.status) continue;
        if (args.projectId && e.projectId !== args.projectId) continue;
        if (programmeProjectIdSet && !programmeProjectIdSet.has(e.projectId)) continue;
        if (q && !`${e.subject ?? ""} ${e.reference ?? ""}`.toLowerCase().includes(q)) continue;
        // doc id is `{ownerClientId}_{enquiryId}`. Prefer the stored bare id if
        // present; otherwise strip the doc's OWN clientId prefix (not the
        // caller's — works for cross-tenant admin reads).
        const ownerClientId = (e.clientId as string) || primaryUid;
        const prefix = `${ownerClientId}_`;
        const bareId = typeof e.id === "string" && e.id.length > 0
          ? e.id
          : d.id.startsWith(prefix)
            ? d.id.slice(prefix.length)
            : d.id;
        if (!bareId) continue;
        stagedDocs.push({ d, e, bareId });
      }
      const nameMap = await fetchProjectNames(
        ctx,
        stagedDocs.map((s) => s.e.projectId).filter((p): p is string => !!p),
      );
      const matched: any[] = stagedDocs.map(({ e, bareId }) => ({
        id: bareId,
        reference: e.reference,
        subject: e.subject,
        status: e.status,
        project: e.projectId ? nameMap.get(e.projectId) ?? "(project name unavailable)" : null,
        ribaStage: e.ribaStage,
        createdAt: e.createdAt,
        closedAt: e.closedAt,
        createdBy: e.createdBy,
      }));
      const truncated = matched.length > limit || snap.size === READ_CAP;
      const out = matched.slice(0, limit);
      return truncated ? [...out, { _truncated: true, totalMatched: matched.length, returned: out.length, hint: "Refine filters to narrow results." }] : out;
    },
  },

  // ── RFIs ──────────────────────────────────────────────────────────────
  {
    name: "searchRfis",
    description:
      "Search Request for Information (RFI) items across TAC enquiries. Accepts projectId for one project or programmeId to filter to RFIs on every project under that programme. Returns rfi number, subject, status, enquiry, and project.",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "Text search in subject" },
        projectId: { type: "string", description: "Filter by project" },
        programmeId: {
          type: "string",
          description:
            "Filter to RFIs whose project sits under this programme.",
        },
        status: {
          type: "string",
          description: "Filter by RFI status (e.g. 'Draft', 'Issued', 'Responded')",
        },
        limit: { type: "number", description: "Max results (default 50)" },
      },
    },
    isAllowed: anySignedIn,
    execute: async (ctx, args) => {
      const { db, primaryUid, isAdmin } = ctx;
      const limit = Math.min(Number(args.limit) || 50, TOOL_RESULT_HARD_CAP);
      const q = (args.query || "").toLowerCase();

      let programmeProjectIdSet: Set<string> | null = null;
      if (args.programmeId) {
        const ids = await resolveProgrammeProjectIds(ctx, args.programmeId);
        programmeProjectIdSet = new Set(ids);
        if (programmeProjectIdSet.size === 0) return [];
      }

      const READ_CAP = Math.min(limit * 5, 500);
      let baseQuery: FirebaseFirestore.Query = isAdmin
        ? db.collection("rfis")
        : db.collection("rfis").where("clientId", "==", primaryUid);
      const snap = await baseQuery
        .orderBy("issuedAt", "desc")
        .limit(READ_CAP)
        .get();

      const stagedRfis: Array<{ r: any }> = [];
      for (const d of snap.docs) {
        const r = d.data();
        // Citation chip routes to ?rfiNumber=X — require a real rfiNumber.
        if (!r.rfiNumber) continue;
        if (args.status && r.status !== args.status) continue;
        if (args.projectId && r.projectId !== args.projectId) continue;
        if (programmeProjectIdSet && !programmeProjectIdSet.has(r.projectId)) continue;
        if (q && !`${r.subject ?? ""} ${r.rfiNumber}`.toLowerCase().includes(q)) continue;
        stagedRfis.push({ r });
      }
      const nameMap = await fetchProjectNames(
        ctx,
        stagedRfis.map((s) => s.r.projectId).filter((p): p is string => !!p),
      );
      const matched: any[] = stagedRfis.map(({ r }) => ({
        id: r.rfiNumber,
        rfiNumber: r.rfiNumber,
        subject: r.subject,
        status: r.status,
        enquiryId: r.enquiryId,
        project: r.projectId ? nameMap.get(r.projectId) ?? "(project name unavailable)" : null,
        issuedAt: r.issuedAt,
        responseDeadline: r.responseDeadline,
        respondedAt: r.respondedAt,
      }));
      const truncated = matched.length > limit || snap.size === READ_CAP;
      const out = matched.slice(0, limit);
      return truncated ? [...out, { _truncated: true, totalMatched: matched.length, returned: out.length, hint: "Refine filters to narrow results." }] : out;
    },
  },

  // ── Governance Templates (report / meeting templates) ─────────────────
  {
    name: "searchMeetingTemplates",
    description:
      "List governance report and meeting templates available in this workspace. Use to answer 'what templates do we have' / 'show me the gateway report template'. Returns id, category, title, description, defaultRoute, and whether senior PM review is required.",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "Text search in title/description" },
        category: { type: "string", description: "Filter by category (e.g. 'PartA', 'PartB', 'KeyDecision')" },
        limit: { type: "number", description: "Max results (default 50)" },
      },
    },
    isAllowed: anySignedIn,
    execute: async (ctx, args) => {
      const { db, primaryUid } = ctx;
      const limit = Math.min(Number(args.limit) || 50, TOOL_RESULT_HARD_CAP);
      const q = (args.query || "").toLowerCase();
      const snap = await db
        .collection("reportTemplates")
        .where("clientId", "==", primaryUid)
        .limit(500)
        .get();
      const matched: any[] = [];
      for (const d of snap.docs) {
        const t = d.data();
        if (args.category && t.category !== args.category) continue;
        if (q && !`${t.title ?? ""} ${t.description ?? ""}`.toLowerCase().includes(q)) continue;
        matched.push({
          id: d.id,
          category: t.category,
          title: t.title,
          description: t.description,
          defaultRoute: t.defaultRoute,
          requireSeniorPmReview: t.requireSeniorPmReview,
          sectionCount: Array.isArray(t.sections) ? t.sections.length : 0,
        });
      }
      const truncated = matched.length > limit;
      const out = matched.slice(0, limit);
      return truncated ? [...out, { _truncated: true, totalMatched: matched.length, returned: out.length, hint: "Refine by category or query." }] : out;
    },
  },

  // ── Governance Framework (bodies + thresholds + TORs) ─────────────────
  {
    name: "getGovernanceFramework",
    description:
      "Get the workspace governance framework: list of governance bodies (boards/committees) with cadence + chair, financial/risk thresholds, and active terms-of-reference per body. Use this BEFORE searching meetings/forward plan/reports when the user asks about a specific board so you can pass the right governanceBodyId.",
    parameters: { type: "object", properties: {} },
    isAllowed: anySignedIn,
    execute: async (ctx) => {
      const { db, primaryUid } = ctx;
      const [bodiesSnap, torSnap] = await Promise.all([
        db.collection("governanceBodies").where("clientId", "==", primaryUid).get(),
        db
          .collection("termsOfReference")
          .where("clientId", "==", primaryUid)
          .where("status", "in", ["draft", "published"])
          .get(),
      ]);
      const torByBody: Record<string, any> = {};
      for (const d of torSnap.docs) {
        const data = d.data() as any;
        const owner = data.ownerBodyId;
        if (!owner) continue;
        const existing = torByBody[owner];
        if (!existing || (data.status === "draft" && existing.status === "published")) {
          torByBody[owner] = data;
        }
      }
      return {
        bodies: bodiesSnap.docs.map((d) => {
          const b = d.data() as any;
          const tor = torByBody[d.id];
          return {
            id: d.id,
            name: b.name,
            type: b.type,
            cadence: b.cadence,
            chairLabel: b.chairLabel,
            torStatus: tor?.status ?? null,
            torSummary: tor?.summary ?? null,
          };
        }),
      };
    },
  },

  // ── Project Governance Docs (per-project signed-off documents) ────────
  {
    name: "listProjectGovernanceDocs",
    description:
      "List project governance documents (charter, brief, scope, risk strategy etc.) for one project or all projects under a programme. Returns id, projectId, docType, title, status, version, signedAt.",
    parameters: {
      type: "object",
      properties: {
        projectId: { type: "string", description: "Scope to a single project" },
        programmeId: { type: "string", description: "Scope to every project under this programme" },
        status: { type: "string", description: "Filter by status (e.g. 'Draft', 'Published')" },
        limit: { type: "number", description: "Max results (default 50)" },
      },
    },
    isAllowed: anySignedIn,
    execute: async (ctx, args) => {
      const { db, primaryUid, isAdmin } = ctx;
      const limit = Math.min(Number(args.limit) || 50, TOOL_RESULT_HARD_CAP);
      // Authorise the scoping arg the same way the search tools do.
      if (args.projectId) {
        const ok = await ctx.isAuthorizedForContext(args.projectId);
        if (!ok) return [];
      }
      const targetProjectIds = new Set(await resolveTargetProjectIds(ctx, args));
      if (targetProjectIds.size === 0) return [];

      let baseQuery: FirebaseFirestore.Query = isAdmin
        ? db.collection("projectGovernanceDocs")
        : db.collection("projectGovernanceDocs").where("clientId", "==", primaryUid);
      const READ_CAP = Math.min(limit * 5, 500);
      const snap = await baseQuery.limit(READ_CAP).get();
      const staged: Array<{ d: any; doc: any }> = [];
      for (const d of snap.docs) {
        const doc = d.data() as any;
        if (doc.deletedAt) continue;
        if (doc.projectId && !targetProjectIds.has(doc.projectId)) continue;
        if (args.status && doc.status !== args.status) continue;
        staged.push({ d, doc });
      }
      const nameMap = await fetchProjectNames(
        ctx,
        staged.map((s) => s.doc.projectId).filter((p): p is string => !!p),
      );
      const matched: any[] = staged.map(({ d, doc }) => ({
        id: d.id,
        project: doc.projectId ? nameMap.get(doc.projectId) ?? "(project name unavailable)" : null,
        docType: doc.docType,
        title: doc.title,
        status: doc.status,
        version: doc.version,
        signedAt: doc.signedAt,
        updatedAt: doc.updatedAt,
      }));
      const truncated = matched.length > limit || snap.size === READ_CAP;
      const out = matched.slice(0, limit);
      return truncated ? [...out, { _truncated: true, totalMatched: matched.length, returned: out.length, hint: "Refine by projectId or status." }] : out;
    },
  },

  // ── Governance Archive (sealed/held/published artefacts) ──────────────
  {
    name: "listGovernanceArchive",
    description:
      "List sealed governance artefacts in the workspace archive: sealed reports, held meetings, and published project governance documents. Read-only audit trail; use for 'show me the archive' / 'what's been sealed this year'.",
    parameters: {
      type: "object",
      properties: {
        kind: {
          type: "string",
          description: "Filter to one kind: 'report' | 'meeting' | 'projectDoc'. Omit for all.",
        },
        limit: { type: "number", description: "Max results per kind (default 30)" },
      },
    },
    isAllowed: isProgrammeManager,
    execute: async (ctx, args) => {
      const { db, primaryUid } = ctx;
      const limit = Math.min(Number(args.limit) || 30, TOOL_RESULT_HARD_CAP);
      const wantReports = !args.kind || args.kind === "report";
      const wantMeetings = !args.kind || args.kind === "meeting";
      const wantDocs = !args.kind || args.kind === "projectDoc";

      const [reportsSnap, meetingsSnap, docsSnap] = await Promise.all([
        wantReports
          ? db
              .collection("reports")
              .where("clientId", "==", primaryUid)
              .where("status", "==", "Sealed")
              .limit(limit)
              .get()
          : Promise.resolve(null),
        wantMeetings
          ? db
              .collection("meetings")
              .where("clientId", "==", primaryUid)
              .where("status", "==", "Held")
              .limit(limit)
              .get()
          : Promise.resolve(null),
        wantDocs
          ? db
              .collection("projectGovernanceDocs")
              .where("clientId", "==", primaryUid)
              .where("status", "==", "Published")
              .limit(limit)
              .get()
          : Promise.resolve(null),
      ]);

      const docProjectIds: string[] = docsSnap
        ? docsSnap.docs
            .map((d) => (d.data() as any)?.projectId)
            .filter((p): p is string => !!p)
        : [];
      const docNameMap = await fetchProjectNames(ctx, docProjectIds);

      return {
        reports: reportsSnap
          ? reportsSnap.docs.map((d) => {
              const r = d.data() as any;
              return {
                id: d.id,
                reference: r.reference,
                title: r.title,
                sealedAt: r.sealedAt ?? r.approvedAt ?? null,
                authorName: r.authorName,
              };
            })
          : [],
        meetings: meetingsSnap
          ? meetingsSnap.docs.map((d) => {
              const m = d.data() as any;
              return {
                id: d.id,
                title: m.title,
                date: m.date,
                governanceBodyId: m.governanceBodyId,
                chair: m.chairLabel,
              };
            })
          : [],
        projectDocs: docsSnap
          ? docsSnap.docs.map((d) => {
              const doc = d.data() as any;
              return {
                id: d.id,
                project: doc.projectId
                  ? docNameMap.get(doc.projectId) ?? "(project name unavailable)"
                  : null,
                docType: doc.docType,
                title: doc.title,
                version: doc.version,
                signedAt: doc.signedAt,
              };
            })
          : [],
      };
    },
  },

  // ── TAC Audit-flagged enquiries (Compliance Lead / admin only) ────────
  {
    name: "listAuditFlaggedTacEnquiries",
    description:
      "Compliance-lead / admin only. List TAC enquiries currently flagged for audit OR carrying thumbs-down feedback. Powers the Audit Dashboard. Returns id, title, RIBA stage, status, owner, flag and feedback summaries.",
    parameters: {
      type: "object",
      properties: {
        limit: { type: "number", description: "Max results (default 50)" },
      },
    },
    // Compliance Lead permission is checked on the route; we mirror that here
    // with the closest existing predicate (programme manager / admin) and let
    // the inner execute do the precise role check.
    isAllowed: isProgrammeManager,
    execute: async (ctx, args) => {
      const { db, primaryUid, isAdmin, isClientAdmin, userData } = ctx;
      // Mirror isComplianceLeadCtx — but without importing route-internal
      // helpers. Compliance Lead is signalled by admin/client_admin or by an
      // explicit role string. Anyone else: empty array (silent denial keeps
      // the AI from leaking that the dashboard exists).
      const isComplianceLead =
        isAdmin ||
        isClientAdmin ||
        userData?.role === "compliance_lead" ||
        userData?.role === ROLE_STRINGS.STRATEGIC_DIRECTOR;
      if (!isComplianceLead) return [];

      const limit = Math.min(Number(args.limit) || 50, TOOL_RESULT_HARD_CAP);
      const snap = await db
        .collection("enquiries")
        .where("clientId", "==", primaryUid)
        .limit(500)
        .get();
      const matched: any[] = [];
      for (const d of snap.docs) {
        const data = d.data() as any;
        const isFlagged =
          data.flaggedForAudit && !data.flaggedForAudit.resolvedAt;
        const hasThumbsDown = data.feedback?.thumbs === "down";
        if (!isFlagged && !hasThumbsDown) continue;
        matched.push({
          id: data.id ?? d.id.replace(`${primaryUid}_`, ""),
          title: data.title ?? "",
          ribaStage: data.ribaStage ?? "S0",
          status: data.status ?? "Draft",
          ownerUid: data.ownerUid ?? "",
          projectId: data.projectId ?? null,
          flaggedAt: data.flaggedForAudit?.flaggedAt ?? null,
          flagReason: data.flaggedForAudit?.reason ?? null,
          thumbs: data.feedback?.thumbs ?? null,
        });
      }
      // Same sort as the route: open flags first (oldest), then thumbs-down.
      matched.sort((a: any, b: any) => {
        const aOpen = !!a.flaggedAt;
        const bOpen = !!b.flaggedAt;
        if (aOpen && !bOpen) return -1;
        if (!aOpen && bOpen) return 1;
        return (a.flaggedAt ?? "").localeCompare(b.flaggedAt ?? "");
      });
      const out = matched.slice(0, limit);
      const truncated = matched.length > limit;
      return truncated ? [...out, { _truncated: true, totalMatched: matched.length, returned: out.length, hint: "Increase limit if you need more." }] : out;
    },
  },

  // ── My Tasks ──────────────────────────────────────────────────────────
  {
    name: "getMyTasks",
    description:
      "Get the current user's personal task list. Returns id, title, status, priority, due date, and linked project.",
    parameters: {
      type: "object",
      properties: {
        status: { type: "string", description: "Filter by status (e.g. 'Pending', 'Done')" },
        limit: { type: "number", description: "Max results (default 50)" },
      },
    },
    isAllowed: anySignedIn,
    execute: async (ctx, args) => {
      const { db, uid } = ctx;
      const limit = Math.min(Number(args.limit) || 50, TOOL_RESULT_HARD_CAP);

      // User-scoped + accessible-project tasks fetched in parallel.
      const projectIdsPromise = getAccessibleProjectIds(ctx);
      const userTaskDocPromise = db
        .collection("users").doc(uid).collection("data").doc("tasks").get();

      const [userTaskDoc, projectIds] = await Promise.all([
        userTaskDocPromise,
        projectIdsPromise,
      ]);

      const projTasksFlat = await readProjectSubCollectionsBulk(ctx, projectIds, "tasks");
      const userTasks: any[] = userTaskDoc.exists
        ? (Array.isArray((userTaskDoc.data() as any)?.data) ? (userTaskDoc.data() as any).data : [])
        : [];

      // Resolve project names up-front so we don't leak raw projectIds.
      const taskProjectIds = [
        ...userTasks.map((t: any) => t?.projectId).filter((p: any): p is string => !!p),
        ...projTasksFlat.map((r) => r.projectId).filter((p): p is string => !!p),
      ];
      const taskNameMap = await fetchProjectNames(ctx, taskProjectIds);

      const matched: any[] = [];
      const acceptTask = (t: any, pid?: string) => {
        if (!t || !t.id) return;
        if (args.status && t.status !== args.status) return;
        const resolvedPid = (t.projectId as string | undefined) ?? pid;
        const resolvedName =
          (typeof t.projectName === "string" && t.projectName) ||
          (resolvedPid ? taskNameMap.get(resolvedPid) ?? null : null);
        matched.push({
          id: t.id,
          title: t.title,
          description: t.description,
          status: t.status,
          priority: t.priority,
          dueDate: t.dueDate,
          project: resolvedName ?? (resolvedPid ? "(project name unavailable)" : null),
        });
      };
      for (const t of userTasks) acceptTask(t);
      for (const { projectId: pid, row: t } of projTasksFlat) acceptTask(t, pid);

      const truncated = matched.length > limit;
      const out = matched.slice(0, limit);
      return truncated ? [...out, { _truncated: true, totalMatched: matched.length, returned: out.length }] : out;
    },
  },

  // ── Historical Snapshot ───────────────────────────────────────────────
  {
    name: "getMonthlyHistoricalSnapshot",
    description:
      "Get a month-end historical snapshot for a given collection (risks, complianceItems, issues, kris). Useful for trend analysis.",
    parameters: {
      type: "object",
      properties: {
        yearMonth: {
          type: "string",
          description: "Year-month in YYYY-MM format (e.g. '2025-03')",
        },
        collection: {
          type: "string",
          description: "Collection name: 'risks', 'complianceItems', 'issues', or 'kris'",
        },
        projectId: {
          type: "string",
          description: "Filter to a specific project ID",
        },
        limit: { type: "number", description: "Max results (default 50)" },
      },
      required: ["yearMonth", "collection"],
    },
    isAllowed: anySignedIn,
    execute: async (ctx, args) => {
      const { db, primaryUid } = ctx;
      const { yearMonth, collection: col, projectId, limit: rawLimit } = args;
      const limit = Math.min(Number(rawLimit) || 50, 100);

      const validCollections = ["risks", "complianceItems", "issues", "kris"];
      if (!validCollections.includes(col)) {
        return { error: `Invalid collection. Must be one of: ${validCollections.join(", ")}` };
      }

      // Storage path: monthlySnapshots/{clientId}_{yearMonth}/{collection}/{projId}
      const parentId = `${primaryUid}_${yearMonth}`;
      let colRef = db
        .collection("monthlySnapshots")
        .doc(parentId)
        .collection(col)
        .limit(limit);

      const snap = await colRef.get();
      return snap.docs
        .filter((d) => !projectId || d.id === projectId)
        .map((d) => {
          const row = d.data() as any;
          return {
            yearMonth,
            collection: col,
            ownerScope: d.id,
            recordedAt: row.recordedAt,
            data: Array.isArray(row.data) ? row.data.slice(0, 20) : row.data,
          };
        });
    },
  },

  // ── Super Admin only ──────────────────────────────────────────────────
  {
    name: "crossTenantListClients",
    description:
      "ADMIN ONLY. List all client organisations on the platform with basic stats.",
    parameters: {
      type: "object",
      properties: {
        limit: { type: "number", description: "Max results (default 50)" },
      },
    },
    isAllowed: isAdminOnly,
    execute: async (ctx, args) => {
      const { db } = ctx;
      const limit = Math.min(Number(args.limit) || 50, TOOL_RESULT_HARD_CAP);
      const snap = await db
        .collection("users")
        .where("role", "in", ["client_admin", "enterprise"])
        .limit(limit)
        .get();
      // Cross-tenant queries are audit-logged unconditionally. Fire-and-forget
      // so a logging failure never blocks the user; failures land in stderr
      // for ops visibility.
      db.collection("auditEvents")
        .add({
          actorUid: ctx.uid,
          actorEmail: ctx.email,
          action: "chat.crossTenantListClients",
          args: { limit },
          resultCount: snap.size,
          ts: FieldValue.serverTimestamp(),
        })
        .catch((e) =>
          console.error("[auditEvents] crossTenantListClients log failed:", e?.message),
        );
      // Minimal projection only — never expose user emails to the AI provider.
      return snap.docs.map((d) => {
        const u = d.data();
        return {
          id: d.id,
          displayName: u.displayName,
          organisation: u.organisation,
          role: u.role,
          createdAt: u.createdAt,
          active: u.active !== false,
        };
      });
    },
  },

];

// Single chokepoint: validates role gate, executes tool, returns result.
export async function executeTool(
  ctx: ApiContext,
  toolName: string,
  toolArgs: Record<string, any>,
): Promise<{ result: any; error?: string }> {
  const tool = CHAT_TOOLS.find((t) => t.name === toolName);
  if (!tool) {
    return { result: null, error: `Unknown tool: ${toolName}` };
  }
  if (!tool.isAllowed(ctx)) {
    return { result: null, error: `Forbidden: your role cannot use ${toolName}` };
  }
  const startedAt = Date.now();
  try {
    const result = await tool.execute(ctx, toolArgs ?? {});
    // Audit log — fire-and-forget. Compliance need: a forensic trail of who
    // asked the AI to fetch what. Errors land in stderr only — never block
    // the user-visible response on a logging failure.
    const resultCount = Array.isArray(result) ? result.length : result ? 1 : 0;
    ctx.db
      .collection("chatToolCallLog")
      .add({
        uid: ctx.uid,
        primaryUid: ctx.primaryUid,
        tool: toolName,
        args: toolArgs ?? {},
        resultCount,
        durationMs: Date.now() - startedAt,
        ts: FieldValue.serverTimestamp(),
      })
      .catch((e) =>
        console.error(`[chatToolCallLog] write failed for ${toolName}:`, e?.message),
      );
    return { result };
  } catch (err: any) {
    console.error(`[chatTools] ${toolName} error:`, err?.message);
    ctx.db
      .collection("chatToolCallLog")
      .add({
        uid: ctx.uid,
        primaryUid: ctx.primaryUid,
        tool: toolName,
        args: toolArgs ?? {},
        error: String(err?.message ?? "unknown"),
        durationMs: Date.now() - startedAt,
        ts: FieldValue.serverTimestamp(),
      })
      .catch(() => {});
    return { result: null, error: `Tool execution failed: ${err?.message}` };
  }
}

// Gemini-compatible tool declarations for the tool-calling API
export function getGeminiToolDeclarations(ctx: ApiContext) {
  return CHAT_TOOLS.filter((t) => t.isAllowed(ctx)).map((t) => ({
    name: t.name,
    description: t.description,
    parameters: t.parameters,
  }));
}

// OpenAI-compatible tool declarations (used by chatStream with OpenRouter/OpenAI)
export function getOpenAIToolDeclarations(ctx: ApiContext) {
  return CHAT_TOOLS.filter((t) => t.isAllowed(ctx)).map((t) => ({
    type: "function" as const,
    function: {
      name: t.name,
      description: t.description,
      parameters: t.parameters,
    },
  }));
}
