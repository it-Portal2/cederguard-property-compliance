// AI Chat Tool Registry.
// Each tool: name, description, Gemini-compatible JSON-Schema parameters,
// a role gate predicate, and an execute() that returns minimal projections.
// executeTool() is the single chokepoint that enforces the role gate and
// calls isAuthorizedForContext where needed.

import type { ApiContext } from "./context.js";
import { ROLE_STRINGS } from "../../src/lib/roleConstants.js";

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
  | "getMyTasks"
  | "getMonthlyHistoricalSnapshot"
  | "crossTenantListClients"
  | "setQueryClientContext";

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

// --- Helpers ---
async function getAccessibleProjectIds(ctx: ApiContext): Promise<string[]> {
  const { db, uid, email, isAdmin, isClientAdmin, primaryUid, userData } = ctx;

  if (isAdmin) {
    // Super admin: return all projects (capped at 200)
    const snap = await db.collection("projects").limit(200).get();
    return snap.docs.map((d) => d.id);
  }

  if (isClientAdmin) {
    const snap = await db
      .collection("projects")
      .where("clientId", "==", primaryUid)
      .limit(100)
      .get();
    return snap.docs.map((d) => d.id);
  }

  // Programme Manager — projects under their programmes
  if (userData?.role === ROLE_STRINGS.PROGRAMME_MANAGER ||
      userData?.role === ROLE_STRINGS.SENIOR_PM) {
    const progSnap = await db
      .collection("programmes")
      .where("clientId", "==", primaryUid)
      .get();
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

    const projSnap = await db
      .collection("projects")
      .where("clientId", "==", primaryUid)
      .get();
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
  return [...ids].slice(0, 50);
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

// --- Tool definitions ---
export const CHAT_TOOLS: ToolDef[] = [
  // ── Projects ──────────────────────────────────────────────────────────
  {
    name: "listAccessibleProjects",
    description:
      "List all projects the current user has access to. Returns id, name, status, programme, RIBA stage, and key dates.",
    parameters: {
      type: "object",
      properties: {
        statusFilter: {
          type: "string",
          description: "Optional: filter by project status (e.g. 'Active', 'Complete')",
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
      const projectIds = await getAccessibleProjectIds(ctx);
      if (!projectIds.length) return [];

      const limit = Math.min(Number(args.limit) || 50, 100);
      const results: any[] = [];

      // Firestore `in` operator max 30 items per query
      const chunks: string[][] = [];
      for (let i = 0; i < projectIds.length; i += 30) {
        chunks.push(projectIds.slice(i, i + 30));
      }

      for (const chunk of chunks) {
        const snap = await db
          .collection("projects")
          .where("__name__", "in", chunk)
          .get();
        for (const d of snap.docs) {
          const p = d.data();
          if (args.statusFilter && p.status !== args.statusFilter) continue;
          results.push({
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
          if (results.length >= limit) break;
        }
        if (results.length >= limit) break;
      }
      return results;
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
      const { db, uid, email, isAdmin, isClientAdmin, primaryUid, userData } = ctx;
      const limit = Math.min(Number(args.limit) || 50, 100);

      let snap: FirebaseFirestore.QuerySnapshot;
      if (isAdmin) {
        snap = await db.collection("programmes").limit(limit).get();
      } else {
        snap = await db
          .collection("programmes")
          .where("clientId", "==", primaryUid)
          .limit(limit)
          .get();
      }

      const results: any[] = [];
      for (const d of snap.docs) {
        const p = d.data();
        const canSee =
          isAdmin ||
          isClientAdmin ||
          p.userId === uid ||
          p.pm === email ||
          (Array.isArray(p.assignedPMIds) && p.assignedPMIds.includes(uid));
        if (!canSee) continue;
        results.push({
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
      return results;
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
      "Search risks across accessible projects. Returns id, title, category, likelihood, impact, score, status, owner, and project.",
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
      const projectIds = args.projectId
        ? [args.projectId]
        : await getAccessibleProjectIds(ctx);

      if (!projectIds.length) return [];

      const { query, status, minScore, limit: rawLimit } = args;
      const limit = Math.min(Number(rawLimit) || 50, 100);
      const results: any[] = [];
      const q = (query || "").toLowerCase();

      for (const pid of projectIds) {
        if (results.length >= limit) break;
        const risks = await readProjectSubCollection(ctx, pid, "risks");
        for (const r of risks) {
          if (results.length >= limit) break;
          if (status && r.status !== status) continue;
          if (minScore != null && (r.score ?? r.riskScore ?? 0) < minScore) continue;
          if (q && !`${r.title} ${r.description}`.toLowerCase().includes(q)) continue;
          results.push({
            id: r.id,
            projectId: pid,
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
      }
      return results;
    },
  },

  // ── Issues ────────────────────────────────────────────────────────────
  {
    name: "searchIssues",
    description:
      "Search issues across accessible projects. Returns id, title, priority, status, owner, linked risk, and project.",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "Text search in title/description" },
        projectId: { type: "string", description: "Limit to a specific project" },
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
      const projectIds = args.projectId
        ? [args.projectId]
        : await getAccessibleProjectIds(ctx);
      if (!projectIds.length) return [];

      const { query, priority, status, limit: rawLimit } = args;
      const limit = Math.min(Number(rawLimit) || 50, 100);
      const results: any[] = [];
      const q = (query || "").toLowerCase();

      for (const pid of projectIds) {
        if (results.length >= limit) break;
        const issues = await readProjectSubCollection(ctx, pid, "issues");
        for (const i of issues) {
          if (results.length >= limit) break;
          if (status && i.status !== status) continue;
          if (priority && i.priority !== priority) continue;
          if (q && !`${i.title} ${i.description}`.toLowerCase().includes(q)) continue;
          results.push({
            id: i.id,
            projectId: pid,
            title: i.title,
            description: i.description,
            priority: i.priority,
            status: i.status,
            owner: i.owner,
            dueDate: i.dueDate,
            linkedRiskId: i.linkedRiskId,
          });
        }
      }
      return results;
    },
  },

  // ── Compliance Items ──────────────────────────────────────────────────
  {
    name: "searchComplianceItems",
    description:
      "Search compliance items across accessible projects. Returns id, title, domain, status, regulation, and project.",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "Text search in title/description" },
        projectId: { type: "string", description: "Limit to a specific project" },
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
      const projectIds = args.projectId
        ? [args.projectId]
        : await getAccessibleProjectIds(ctx);
      if (!projectIds.length) return [];

      const { query, domain, status, limit: rawLimit } = args;
      const limit = Math.min(Number(rawLimit) || 50, 100);
      const results: any[] = [];
      const q = (query || "").toLowerCase();

      for (const pid of projectIds) {
        if (results.length >= limit) break;
        const items = await readProjectSubCollection(ctx, pid, "complianceItems");
        for (const c of items) {
          if (results.length >= limit) break;
          if (status && c.status !== status) continue;
          if (domain && c.domain !== domain) continue;
          if (q && !`${c.title || c.item} ${c.description}`.toLowerCase().includes(q)) continue;
          results.push({
            id: c.id,
            projectId: pid,
            title: c.title || c.item,
            domain: c.domain,
            status: c.status,
            regulation: c.regulation || c.regulationRef,
            dueDate: c.dueDate,
            owner: c.owner,
            evidenceRequired: c.evidenceRequired,
          });
        }
      }
      return results;
    },
  },

  // ── KRIs ──────────────────────────────────────────────────────────────
  {
    name: "getKRIs",
    description:
      "Get Key Risk Indicators (KRIs) for accessible projects. Returns id, name, value, threshold, status, and project.",
    parameters: {
      type: "object",
      properties: {
        projectId: { type: "string", description: "Limit to a specific project" },
        breached: {
          type: "boolean",
          description: "If true, return only KRIs that have breached their threshold",
        },
        limit: { type: "number", description: "Max results (default 50)" },
      },
    },
    isAllowed: anySignedIn,
    execute: async (ctx, args) => {
      const projectIds = args.projectId
        ? [args.projectId]
        : await getAccessibleProjectIds(ctx);
      if (!projectIds.length) return [];

      const limit = Math.min(Number(args.limit) || 50, 100);
      const results: any[] = [];

      for (const pid of projectIds) {
        if (results.length >= limit) break;
        const kris = await readProjectSubCollection(ctx, pid, "kris");
        for (const k of kris) {
          if (results.length >= limit) break;
          const isBreached =
            k.currentValue != null &&
            k.threshold != null &&
            Number(k.currentValue) >= Number(k.threshold);
          if (args.breached === true && !isBreached) continue;
          results.push({
            id: k.id,
            projectId: pid,
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
      }
      return results;
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
      const { db, primaryUid } = ctx;
      const limit = Math.min(Number(args.limit) || 50, 100);
      const q = (args.query || "").toLowerCase();

      const snap = await db
        .collection("forwardPlanItems")
        .where("clientId", "==", primaryUid)
        .limit(limit * 2)
        .get();
      const results: any[] = [];

      for (const d of snap.docs) {
        if (results.length >= limit) break;
        const item = d.data();
        if (item.deletedAt) continue;
        if (args.status && item.status !== args.status) continue;
        if (args.governanceBodyId && item.governanceBodyId !== args.governanceBodyId) continue;
        if (q && !`${item.title} ${item.description || ""}`.toLowerCase().includes(q)) continue;
        results.push({
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
      return results;
    },
  },

  // ── Meetings ──────────────────────────────────────────────────────────
  {
    name: "searchMeetings",
    description:
      "Search governance meetings. Returns id, title, governance body, date, status, attendees, and linked reports.",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "Text search in meeting title/location" },
        status: {
          type: "string",
          description: "Filter by status (e.g. 'Scheduled', 'Held', 'Cancelled')",
        },
        governanceBodyId: { type: "string", description: "Filter by governance body" },
        fromDate: { type: "string", description: "ISO date: only meetings on or after this date" },
        limit: { type: "number", description: "Max results (default 50)" },
      },
    },
    isAllowed: isProgrammeManager,
    execute: async (ctx, args) => {
      const { db, primaryUid } = ctx;
      const limit = Math.min(Number(args.limit) || 50, 100);
      const q = (args.query || "").toLowerCase();

      const snap = await db
        .collection("meetings")
        .where("clientId", "==", primaryUid)
        .limit(limit * 2)
        .get();

      const results: any[] = [];
      for (const d of snap.docs) {
        if (results.length >= limit) break;
        const m = d.data();
        if (m.deletedAt) continue;
        if (args.status && m.status !== args.status) continue;
        if (args.governanceBodyId && m.governanceBodyId !== args.governanceBodyId) continue;
        if (args.fromDate && m.date < args.fromDate) continue;
        if (q && !`${m.title || ""} ${m.location || ""}`.toLowerCase().includes(q)) continue;
        results.push({
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
      return results;
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
      const { db, primaryUid } = ctx;
      const limit = Math.min(Number(args.limit) || 50, 100);
      const q = (args.query || "").toLowerCase();

      const snap = await db
        .collection("reports")
        .where("clientId", "==", primaryUid)
        .limit(limit * 2)
        .get();

      const results: any[] = [];
      for (const d of snap.docs) {
        if (results.length >= limit) break;
        const r = d.data();
        if (r.deletedAt) continue;
        if (args.status && r.status !== args.status) continue;
        if (q && !`${r.title || ""} ${r.reference || ""}`.toLowerCase().includes(q)) continue;
        results.push({
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
      return results;
    },
  },

  // ── TAC Enquiries ─────────────────────────────────────────────────────
  {
    name: "searchTacEnquiries",
    description:
      "Search Technical Assurance Companion enquiries. Returns id, reference, subject, status, project, and stage.",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "Text search in subject/reference" },
        status: {
          type: "string",
          description: "Filter by status (e.g. 'Draft', 'Open', 'Closed')",
        },
        projectId: { type: "string", description: "Filter by project" },
        limit: { type: "number", description: "Max results (default 50)" },
      },
    },
    isAllowed: anySignedIn,
    execute: async (ctx, args) => {
      const { db, uid, primaryUid, isAdmin, isClientAdmin } = ctx;
      const limit = Math.min(Number(args.limit) || 50, 100);
      const q = (args.query || "").toLowerCase();

      let baseQuery = isAdmin
        ? db.collection("enquiries").limit(limit * 2)
        : db.collection("enquiries").where("clientId", "==", primaryUid).limit(limit * 2);

      const snap = await baseQuery.get();
      const results: any[] = [];

      for (const d of snap.docs) {
        if (results.length >= limit) break;
        const e = d.data();
        if (e.deletedAt) continue;
        if (args.status && e.status !== args.status) continue;
        if (args.projectId && e.projectId !== args.projectId) continue;
        if (q && !`${e.subject || ""} ${e.reference || ""}`.toLowerCase().includes(q)) continue;
        // doc id is {clientId}_{enquiryId} — expose just the entity id for routing
        const bareId = (e.id as string) ?? d.id.replace(`${primaryUid}_`, "");
        results.push({
          id: bareId,
          reference: e.reference,
          subject: e.subject,
          status: e.status,
          projectId: e.projectId,
          ribaStage: e.ribaStage,
          createdAt: e.createdAt,
          closedAt: e.closedAt,
          createdBy: e.createdBy,
        });
      }
      return results;
    },
  },

  // ── RFIs ──────────────────────────────────────────────────────────────
  {
    name: "searchRfis",
    description:
      "Search Request for Information (RFI) items across TAC enquiries. Returns rfi number, subject, status, enquiry, and project.",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "Text search in subject" },
        projectId: { type: "string", description: "Filter by project" },
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
      const limit = Math.min(Number(args.limit) || 50, 100);
      const q = (args.query || "").toLowerCase();

      // RFIs are stored in the workspace-level rfiRegister collection
      let baseQuery = isAdmin
        ? db.collection("rfis").limit(limit * 2)
        : db.collection("rfis").where("clientId", "==", primaryUid).limit(limit * 2);

      const snap = await baseQuery.get();
      const results: any[] = [];

      for (const d of snap.docs) {
        if (results.length >= limit) break;
        const r = d.data();
        if (args.status && r.status !== args.status) continue;
        if (args.projectId && r.projectId !== args.projectId) continue;
        if (q && !`${r.subject || ""} ${r.rfiNumber || ""}`.toLowerCase().includes(q)) continue;
        results.push({
          id: r.rfiNumber ?? d.id,  // rfiNumber used as citation id for route ?rfiNumber=X
          rfiNumber: r.rfiNumber,
          subject: r.subject,
          status: r.status,
          enquiryId: r.enquiryId,
          projectId: r.projectId,
          issuedAt: r.issuedAt,
          responseDeadline: r.responseDeadline,
          respondedAt: r.respondedAt,
        });
      }
      return results;
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
      const limit = Math.min(Number(args.limit) || 50, 100);
      const results: any[] = [];

      const pushTasks = (tasks: any[]) => {
        for (const t of tasks) {
          if (results.length >= limit) break;
          if (args.status && t.status !== args.status) continue;
          results.push({
            id: t.id,
            title: t.title,
            description: t.description,
            status: t.status,
            priority: t.priority,
            dueDate: t.dueDate,
            projectId: t.projectId,
            projectName: t.projectName,
          });
        }
      };

      // 1. User-scoped tasks (no project context): users/{uid}/data/tasks
      const userTaskDoc = await db
        .collection("users")
        .doc(uid)
        .collection("data")
        .doc("tasks")
        .get();
      if (userTaskDoc.exists) {
        const d = userTaskDoc.data() as any;
        pushTasks(Array.isArray(d?.data) ? d.data : []);
      }

      // 2. Tasks from accessible projects: projects/{pid}/data/tasks
      if (results.length < limit) {
        const projectIds = await getAccessibleProjectIds(ctx);
        for (const pid of projectIds) {
          if (results.length >= limit) break;
          const projTaskDoc = await db
            .collection("projects")
            .doc(pid)
            .collection("data")
            .doc("tasks")
            .get();
          if (projTaskDoc.exists) {
            const d = projTaskDoc.data() as any;
            pushTasks(Array.isArray(d?.data) ? d.data : []);
          }
        }
      }

      return results;
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
      const limit = Math.min(Number(args.limit) || 50, 100);
      const snap = await db
        .collection("users")
        .where("role", "in", ["client_admin", "enterprise"])
        .limit(limit)
        .get();
      return snap.docs.map((d) => {
        const u = d.data();
        return {
          id: d.id,
          email: u.email,
          displayName: u.displayName,
          organisation: u.organisation,
          role: u.role,
          createdAt: u.createdAt,
          active: u.active !== false,
        };
      });
    },
  },

  {
    name: "setQueryClientContext",
    description:
      "ADMIN ONLY. Sets the client context for subsequent queries in this conversation, allowing admin to answer questions on behalf of a specific client.",
    parameters: {
      type: "object",
      properties: {
        clientId: {
          type: "string",
          description: "The UID of the client organisation to query as",
        },
      },
      required: ["clientId"],
    },
    isAllowed: isAdminOnly,
    execute: async (ctx, args) => {
      // This is a logical tool — the model uses it for context-setting.
      // The actual scoping is done by the caller when primaryUid is overridden.
      const { db } = ctx;
      const doc = await db.collection("users").doc(args.clientId).get();
      if (!doc.exists) return { error: "Client not found" };
      const u = doc.data() as any;
      return {
        success: true,
        clientId: args.clientId,
        organisation: u.organisation,
        email: u.email,
        contextNote:
          "Subsequent queries in this conversation will be scoped to this client. Use other tools to fetch their data.",
      };
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
  try {
    const result = await tool.execute(ctx, toolArgs ?? {});
    return { result };
  } catch (err: any) {
    console.error(`[chatTools] ${toolName} error:`, err?.message);
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
