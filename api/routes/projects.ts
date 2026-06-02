import { FieldValue } from "firebase-admin/firestore";
import { ApiContext } from "../lib/context.js";
import { ROLE_STRINGS } from "../../src/lib/roleConstants.js";
import { logActivity } from "../lib/activityLog.js";

export const projectRoutes: Record<
  string,
  (req: any, res: any, ctx: ApiContext) => Promise<any>
> = {
  createProject: async (req, res, ctx) => {
    const { db, uid, email, isAdmin, isClientAdmin } = ctx;
    const data = req.body?.data;
    if (!data) return res.status(400).json({ error: "Missing data" });

    let ownerId = data.projectManagerId || uid;
    if (ownerId && ownerId.includes("@")) {
      const mappedUserSnap = await db
        .collection("users")
        .where("email", "==", ownerId.toLowerCase())
        .limit(1)
        .get();
      if (!mappedUserSnap.empty) ownerId = mappedUserSnap.docs[0].id;
    }

    const projectClientId = isAdmin
      ? data.clientId || ""
      : isClientAdmin
        ? uid
        : ctx.userData.clientId || ctx.primaryUid || uid;

    const docRef = await db.collection("projects").add({
      ...data,
      userId: ownerId,
      clientId: projectClientId,
      creatorId: uid,
      programmeManagerId: data.programmeManagerId || null,
      createdAt: FieldValue.serverTimestamp(),
    });

    // Auto-roster: if the project has both a PM and a programme, ensure the PM is on the
    // programme's assignedPMIds roster (keeps roster consistent with project reality).
    if (ownerId && typeof ownerId === "string" && !ownerId.includes("@") && data.programmeId) {
      try {
        await db.collection("programmes").doc(data.programmeId).update({
          assignedPMIds: FieldValue.arrayUnion(ownerId),
        });
      } catch (e) {
        console.warn(
          `[createProject] Auto-roster failed for programme ${data.programmeId}:`,
          (e as any)?.message || e,
        );
      }
    }

    if (data.pmEmails && typeof data.pmEmails === "string") {
      const emails = data.pmEmails
        .split(",")
        .map((e: string) => e.trim().toLowerCase())
        .filter(Boolean);
      if (emails.length > 0) {
        await Promise.all(
          emails.map((pmEmail: string) =>
            db.collection("invitations").add({
              email: pmEmail,
              invitedBy: uid,
              role: "project_manager",
              projectId: docRef.id,
              createdAt: FieldValue.serverTimestamp(),
            }),
          ),
        );
      }
    }

    await logActivity(ctx, "project_created", {
      category: "create",
      entityType: "project",
      entityId: docRef.id,
      entityName: data.name || "Unnamed",
    });

    return res.status(200).json({ success: true, id: docRef.id });
  },

  getProjects: async (req, res, ctx) => {
    return projectRoutes.clientGetProjects(req, res, ctx);
  },

  clientGetProjects: async (req, res, ctx) => {
    const { db, uid, email, userData, primaryUid, isAdmin, isClientAdmin } =
      ctx;

    if (isAdmin) {
      const allSnap = await db.collection("projects").get();
      const allProjects = allSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
      return res.status(200).json({ success: true, projects: allProjects });
    }

    const orgUsersSnap = await db
      .collection("users")
      .where("clientId", "==", primaryUid)
      .get();
    const pmMap: Record<string, any> = {};
    orgUsersSnap.docs.forEach((d) => {
      pmMap[d.id] = d.data();
    });

    if (primaryUid !== uid && !pmMap[primaryUid]) {
      const rootDoc = await db.collection("users").doc(primaryUid).get();
      if (rootDoc.exists) pmMap[primaryUid] = rootDoc.data();
    }
    pmMap[uid] = userData;
    pmMap[primaryUid] = pmMap[primaryUid] || {};

    const queries = [];

    if (isClientAdmin) {
      queries.push(
        db.collection("projects").where("clientId", "==", primaryUid).get(),
      );

      const allMemberIdentifiers = [
        ...new Set([uid, primaryUid, ...Object.keys(pmMap)]),
      ];
      Object.values(pmMap).forEach((m) => {
        if (m.email) allMemberIdentifiers.push(m.email.toLowerCase());
      });

      const uniqueIdentifiers = Array.from(new Set(allMemberIdentifiers));
      for (let i = 0; i < uniqueIdentifiers.length; i += 10) {
        const chunk = uniqueIdentifiers.slice(i, i + 10);
        queries.push(
          db.collection("projects").where("userId", "in", chunk).get(),
        );
      }
    } else {
      // Regular user (Project Manager or Programme Manager)
      queries.push(db.collection("projects").where("userId", "==", uid).get());
      queries.push(
        db.collection("projects").where("creatorId", "==", uid).get(),
      );
      if (email) {
        queries.push(db.collection("projects").where("pm", "==", email).get());
        queries.push(
          db.collection("projects").where("userId", "==", email).get(),
        );
      }

      // Programme Manager: Fetch projects associated with their managed programmes
      if (userData.role === ROLE_STRINGS.PROGRAMME_MANAGER) {
        const progQueries = [
          db.collection("programmes").where("userId", "==", uid).get(),
          db.collection("programmes").where("creatorId", "==", uid).get(),
        ];
        if (email) {
          progQueries.push(
            db.collection("programmes").where("pm", "==", email).get(),
          );
        }

        const progSnapshots = await Promise.all(progQueries);
        const managedProgIds = new Set<string>();
        progSnapshots.forEach((snap) =>
          snap.docs.forEach((doc) => managedProgIds.add(doc.id)),
        );

        const progIds = Array.from(managedProgIds);
        if (progIds.length > 0) {
          for (let i = 0; i < progIds.length; i += 10) {
            const chunk = progIds.slice(i, i + 10);
            queries.push(
              db.collection("projects").where("programmeId", "in", chunk).get(),
            );
          }
        }
      }
    }

    const snapshots = await Promise.all(queries);

    const projectMap = new Map();
    snapshots.forEach((snap) => {
      snap.docs.forEach((doc) => {
        projectMap.set(doc.id, { id: doc.id, ...doc.data() });
      });
    });

    const allProjects = Array.from(projectMap.values());

    allProjects.forEach((p) => {
      const pmInfo = pmMap[p.userId] || {};
      p.pmName =
        pmInfo.displayName ||
        pmInfo.companyName ||
        pmInfo.email ||
        (p.userId === primaryUid ? "Client Admin" : "Member");
      p.pmEmail = pmInfo.email || "";
    });

    if (email) {
      const invitationsSnapshot = await db
        .collection("invitations")
        .where("email", "==", email)
        .get();
      const assignedProjectIds = invitationsSnapshot.docs
        .map((doc) => doc.data().projectId)
        .filter(Boolean);
      if (assignedProjectIds.length > 0) {
        const uniqueAssignedIds = [...new Set(assignedProjectIds)];
        for (const pid of uniqueAssignedIds) {
          if (!projectMap.has(pid)) {
            const aDoc = await db.collection("projects").doc(pid).get();
            if (aDoc.exists) allProjects.push({ id: aDoc.id, ...aDoc.data() });
          }
        }
      }
    }

    return res.status(200).json({ success: true, projects: allProjects });
  },

  updateProject: async (req, res, ctx) => {
    const { db, uid, email, isAuthorizedForContext } = ctx;
    const { id, data } = req.body;
    if (!id || !data)
      return res.status(400).json({ error: "Missing id or data" });

    if (!(await isAuthorizedForContext(id))) {
      return res
        .status(403)
        .json({ error: "Forbidden: You do not have access to this project." });
    }

    await db
      .collection("projects")
      .doc(id)
      .update({ ...data, updatedAt: FieldValue.serverTimestamp() });

    if (data.pmEmails && typeof data.pmEmails === "string") {
      const emails = data.pmEmails
        .split(",")
        .map((e: string) => e.trim().toLowerCase())
        .filter(Boolean);
      for (const pmEmail of emails) {
        await db.collection("invitations").add({
          email: pmEmail,
          invitedBy: uid,
          role: "project_manager",
          projectId: id,
          updatedAt: FieldValue.serverTimestamp(),
        });
      }
    }

    // Capture the project's real name for the log (payload may be a partial update).
    const projName =
      data?.name ??
      (await db.collection("projects").doc(id).get()).data()?.name ??
      null;
    await logActivity(ctx, "project_updated", {
      category: "update",
      entityType: "project",
      entityId: id,
      entityName: projName,
      details: { changedFields: Object.keys(data || {}) },
    });
    return res.status(200).json({ success: true });
  },

  deleteProject: async (req, res, ctx) => {
    const { db, uid, email, isAuthorizedForContext } = ctx;
    const { id } = req.body;
    if (!id) return res.status(400).json({ error: "Missing id" });

    if (!(await isAuthorizedForContext(id))) {
      return res
        .status(403)
        .json({ error: "Forbidden: You do not have access to this project." });
    }

    // Capture the project's name BEFORE deletion so the log shows what was deleted.
    const deletedProjectName =
      (await db.collection("projects").doc(id).get()).data()?.name ?? null;

    // 1. Delete all documents in the projects/{id}/data subcollection
    const dataSnap = await db
      .collection("projects")
      .doc(id)
      .collection("data")
      .get();
    if (!dataSnap.empty) {
      const dataBatch = db.batch();
      dataSnap.docs.forEach((doc) => dataBatch.delete(doc.ref));
      await dataBatch.commit();
    }

    // 2. Delete all evidence documents linked to this project
    const evidenceSnap = await db
      .collection("evidence")
      .where("project", "==", id)
      .get();
    if (!evidenceSnap.empty) {
      // Firestore batch limit is 500 — chunk if needed
      for (let i = 0; i < evidenceSnap.docs.length; i += 500) {
        const evidenceBatch = db.batch();
        evidenceSnap.docs
          .slice(i, i + 500)
          .forEach((doc) => evidenceBatch.delete(doc.ref));
        await evidenceBatch.commit();
      }
    }

    // 3. Delete the project document itself
    await db.collection("projects").doc(id).delete();

    await logActivity(ctx, "project_deleted", {
      category: "delete",
      entityType: "project",
      entityId: id,
      entityName: deletedProjectName,
    });
    return res.status(200).json({ success: true });
  },

  getProjectById: async (req, res, ctx) => {
    const { db, isAuthorizedForContext } = ctx;
    const { id } = req.body;
    if (!id) return res.status(400).json({ error: "Missing id" });

    if (!(await isAuthorizedForContext(id))) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const doc = await db.collection("projects").doc(id).get();
    if (!doc.exists)
      return res.status(404).json({ error: "Project not found" });

    await logActivity(ctx, "project_viewed", {
      category: "read",
      entityType: "project",
      entityId: id,
      entityName: doc.data()?.name ?? null,
    });

    return res
      .status(200)
      .json({ success: true, data: { id: doc.id, ...doc.data() } });
  },

  getPortfolioData: async (req, res, ctx) => {
    const { db, uid, primaryUid, isAdmin, userData, email } = ctx;

    if (isAdmin) {
      const allSnap = await db.collection("projects").get();
      const allProjects = allSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
      return res.status(200).json({ success: true, projects: allProjects });
    }

    const queries = [];

    if (
      userData.role === ROLE_STRINGS.CLIENT_ADMIN ||
      userData.role === ROLE_STRINGS.ENTERPRISE
    ) {
      queries.push(
        db.collection("projects").where("clientId", "==", primaryUid).get(),
      );
    } else {
      queries.push(db.collection("projects").where("userId", "==", uid).get());
      queries.push(
        db.collection("projects").where("creatorId", "==", uid).get(),
      );
      if (email) {
        queries.push(db.collection("projects").where("pm", "==", email).get());
        queries.push(
          db.collection("projects").where("userId", "==", email).get(),
        );
      }

      // Programme Manager: Aggregate projects via managed programmes
      if (userData.role === ROLE_STRINGS.PROGRAMME_MANAGER) {
        const progQueries = [
          db.collection("programmes").where("userId", "==", uid).get(),
          db.collection("programmes").where("creatorId", "==", uid).get(),
        ];
        if (email) {
          progQueries.push(
            db.collection("programmes").where("pm", "==", email).get(),
          );
        }
        const progSnaps = await Promise.all(progQueries);
        const progIds = Array.from(
          new Set(progSnaps.flatMap((s) => s.docs.map((d) => d.id))),
        );

        if (progIds.length > 0) {
          for (let i = 0; i < progIds.length; i += 10) {
            queries.push(
              db
                .collection("projects")
                .where("programmeId", "in", progIds.slice(i, i + 10))
                .get(),
            );
          }
        }
      }
    }

    // 4. Fetch from team members as a safety net (Client Admins/Enterprise/Programme Managers only)
    // Regular PMs should NOT see other PMs' projects - strict tenant isolation
    let pmsSnap: any = null;
    if (
      userData.role === ROLE_STRINGS.CLIENT_ADMIN ||
      userData.role === ROLE_STRINGS.ENTERPRISE ||
      userData.role === ROLE_STRINGS.PROGRAMME_MANAGER
    ) {
      pmsSnap = await db
        .collection("users")
        .where("clientId", "==", primaryUid)
        .get();
      const pmUids = pmsSnap.docs
        .map((d: any) => d.id)
        .filter((id: string) => id !== uid && id !== primaryUid);

      // Process UIDs in chunks of 10 for 'in' query
      for (let i = 0; i < pmUids.length; i += 10) {
        const chunk = pmUids.slice(i, i + 10);
        queries.push(
          db.collection("projects").where("userId", "in", chunk).get(),
        );
      }
    }

    const snaps = await Promise.all(queries);
    const projectMap = new Map();

    snaps.forEach((snap) => {
      snap.docs.forEach((doc) => {
        projectMap.set(doc.id, { id: doc.id, ...doc.data() });
      });
    });

    const allProjects = Array.from(projectMap.values());

    // Cache PM names/emails for enrichment
    const pmMap: Record<string, any> = {};

    // If safety net ran, we have pmsSnap; otherwise fetch just the current user
    if (pmsSnap) {
      pmsSnap.docs.forEach((d: any) => {
        pmMap[d.id] = d.data();
      });
    } else {
      // For regular PMs, just fetch their own user data
      const userDoc = await db.collection("users").doc(uid).get();
      if (userDoc.exists) pmMap[uid] = userDoc.data();
    }

    const ownerDoc = await db.collection("users").doc(primaryUid).get();
    if (ownerDoc.exists) pmMap[primaryUid] = ownerDoc.data();

    const enrichedProjects = await Promise.all(
      allProjects.map(async (project) => {
        try {
          const [compDoc, riskDoc, issueDoc, activitySnap] = await Promise.all([
            db
              .collection("projects")
              .doc(project.id)
              .collection("data")
              .doc("complianceItems")
              .get(),
            db
              .collection("projects")
              .doc(project.id)
              .collection("data")
              .doc("risks")
              .get(),
            db
              .collection("projects")
              .doc(project.id)
              .collection("data")
              .doc("issues")
              .get(),
            db
              .collection("activityLogs")
              .where("projectId", "==", project.id)
              .orderBy("timestamp", "desc")
              .limit(1)
              .get(),
          ]);

          const complianceItems = compDoc.exists
            ? compDoc.data()?.data || []
            : [];
          const risks = riskDoc.exists ? riskDoc.data()?.data || [] : [];
          const issues = issueDoc.exists ? issueDoc.data()?.data || [] : [];
          const lastActivity = activitySnap.docs[0]?.data()?.timestamp || null;

          const compTotal = complianceItems.length;
          const compComplete = complianceItems.filter(
            (c: any) => c.stage === "Complete",
          ).length;
          const compPct =
            compTotal > 0 ? Math.round((compComplete / compTotal) * 100) : 0;
          const compHighRisk = complianceItems.filter(
            (c: any) => c.risk === "High" && c.stage !== "Complete",
          ).length;

          const riskOpen = risks.filter((r: any) => r.status === "Open").length;
          const riskHigh = risks.filter(
            (r: any) => (r.grossRating || 0) >= 16,
          ).length;
          const riskEscalated = risks.filter((r: any) => r.escalated).length;

          const issueOpen = issues.filter(
            (i: any) => i.status !== "4. Resolved",
          ).length;
          const issueEscalated = issues.filter(
            (i: any) => i.status === "2. Escalated",
          ).length;

          let rag = "Green";
          if (riskHigh > 0 || compHighRisk > 2) rag = "Red";
          else if (riskOpen > 3 || compPct < 50) rag = "Amber";

          const pmInfo = pmMap[project.userId] || {};

          return {
            ...project,
            pmName:
              pmInfo.displayName ||
              pmInfo.companyName ||
              pmInfo.email ||
              (project.userId === primaryUid ? "Client Admin" : "Member"),
            pmEmail: pmInfo.email || "",
            lastActivity,
            compTotal,
            compComplete,
            compPct,
            compHighRisk,
            riskTotal: risks.length,
            riskOpen,
            riskHigh,
            riskEscalated,
            issueTotal: issues.length,
            issueOpen,
            issueEscalated,
            rag,
          };
        } catch (_) {
          return {
            ...project,
            pmName: "Unknown",
            rag: "Grey",
            compPct: 0,
            riskTotal: 0,
            issueTotal: 0,
            lastActivity: null,
          };
        }
      }),
    );

    return res.status(200).json({ success: true, projects: enrichedProjects });
  },

  clientGetProjectData: async (req, res, ctx) => {
    return projectRoutes.getPortfolioData(req, res, ctx);
  },
};
