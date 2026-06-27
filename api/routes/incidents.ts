import { FieldValue } from 'firebase-admin/firestore';
import { ApiContext } from '../lib/context.js';
import { logActivity } from '../lib/activityLog.js';
import { ROLE_STRINGS } from '../../shared/constants/roleConstants.js';

const INCIDENTS = 'incidents';

/** PM+ gate (Client Admin / Super Admin via isClientAdmin, plus any PM-level role). */
function isPmPlus(ctx: ApiContext): boolean {
  const role = ctx.userData?.role;
  return (
    ctx.isClientAdmin ||
    role === ROLE_STRINGS.PROGRAMME_MANAGER ||
    role === ROLE_STRINGS.PROJECT_MANAGER ||
    role === ROLE_STRINGS.SENIOR_PM ||
    role === ROLE_STRINGS.SENIOR_PROJECT_MANAGER ||
    role === ROLE_STRINGS.ASSISTANT_PM ||
    role === ROLE_STRINGS.PROJECT_COORDINATOR
  );
}

function str(v: any, max: number): string {
  return v ? String(v).slice(0, max) : '';
}
function arr(v: any): string[] {
  return (Array.isArray(v) ? v : [])
    .map((x) => String(x).slice(0, 200))
    .filter(Boolean)
    .slice(0, 500);
}

function sanitizeIncident(input: any) {
  return {
    title: String(input.title).trim().slice(0, 300),
    type: str(input.type, 80) || 'Other',
    occurredAt: input.occurredAt ? String(input.occurredAt).slice(0, 40) : null,
    location: str(input.location, 300),
    projectId: input.projectId ? String(input.projectId) : null,
    programmeId: input.programmeId ? String(input.programmeId) : null,
    projectName: str(input.projectName, 300) || null,
    severity: str(input.severity, 30) || 'Low',
    immediateImpact: str(input.immediateImpact, 5000),
    residentImpact: str(input.residentImpact, 5000),
    regulatoryRelevance: str(input.regulatoryRelevance, 2000),
    complianceGroup: str(input.complianceGroup, 50),
    owner: str(input.owner, 200),
    rootCause: str(input.rootCause, 5000),
    linkedRiskIds: arr(input.linkedRiskIds),
    linkedControlIds: arr(input.linkedControlIds),
    actionsTaken: str(input.actionsTaken, 10000),
    escalationRoute: str(input.escalationRoute, 2000),
    status: str(input.status, 40) || 'Open',
    lessonsLearned: str(input.lessonsLearned, 10000),
    evidenceIds: arr(input.evidenceIds),
  };
}

export const incidentsRoutes: Record<
  string,
  (req: any, res: any, ctx: ApiContext) => Promise<any>
> = {
  incidentsList: async (_req, res, ctx) => {
    const { db, primaryUid } = ctx;
    const snap = await db
      .collection(INCIDENTS)
      .where('clientId', '==', primaryUid)
      .get();
    const incidents = snap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .sort((a: any, b: any) =>
        String(b.occurredAt || '').localeCompare(String(a.occurredAt || '')),
      );
    return res.status(200).json({ success: true, incidents });
  },

  incidentsUpsert: async (req, res, ctx) => {
    const { db, primaryUid } = ctx;
    const { incident } = req.body || {};
    if (!incident || !incident.title || !String(incident.title).trim()) {
      return res.status(400).json({ error: 'Missing incident or incident.title' });
    }

    const id: string = incident.id || db.collection(INCIDENTS).doc().id;
    const ref = db.collection(INCIDENTS).doc(id);
    const existing = await ref.get();
    if (existing.exists && existing.data()?.clientId !== primaryUid) {
      return res
        .status(403)
        .json({ error: 'Forbidden: incident belongs to another tenant.' });
    }

    const clean = sanitizeIncident(incident);

    // Closing an incident is a PM+ approval action (mirrors report sign-off);
    // re-opening a closed incident carries the same bar.
    const wasClosed = existing.data()?.status === 'Closed';
    if (clean.status === 'Closed' && !wasClosed && !isPmPlus(ctx)) {
      return res
        .status(403)
        .json({ error: 'Forbidden: only a PM or above can close an incident.' });
    }
    if (wasClosed && clean.status !== 'Closed' && !isPmPlus(ctx)) {
      return res
        .status(403)
        .json({ error: 'Forbidden: only a PM or above can re-open an incident.' });
    }

    const payload: any = {
      ...clean,
      clientId: primaryUid,
      updatedAt: FieldValue.serverTimestamp(),
    };
    if (clean.status === 'Closed' && !wasClosed) {
      payload.closedAt = new Date().toISOString();
    } else if (clean.status !== 'Closed') {
      payload.closedAt = null;
    }
    if (!existing.exists) payload.createdAt = FieldValue.serverTimestamp();

    if (payload.projectId && !(await ctx.isAuthorizedForContext(payload.projectId))) {
      return res
        .status(403)
        .json({ error: 'Forbidden: not authorised for the tagged project.' });
    }
    if (
      payload.programmeId &&
      !(await ctx.isAuthorizedForContext(payload.programmeId))
    ) {
      return res
        .status(403)
        .json({ error: 'Forbidden: not authorised for the tagged programme.' });
    }

    await ref.set(payload, { merge: true });

    await logActivity(
      ctx,
      existing.exists
        ? clean.status === 'Closed' && !wasClosed
          ? 'incident_closed'
          : 'incident_updated'
        : 'incident_created',
      {
        category:
          clean.status === 'Closed' && !wasClosed
            ? 'approve'
            : existing.exists
              ? 'update'
              : 'create',
        entityType: 'incident',
        entityId: id,
        entityName: payload.title,
      },
    );
    return res.status(200).json({ success: true, id });
  },

  incidentsDelete: async (req, res, ctx) => {
    const { db, primaryUid } = ctx;
    if (!isPmPlus(ctx)) {
      return res
        .status(403)
        .json({ error: 'Forbidden: insufficient role to delete incidents.' });
    }
    const { id } = req.body || {};
    if (!id) return res.status(400).json({ error: 'Missing id' });

    const ref = db.collection(INCIDENTS).doc(id);
    const doc = await ref.get();
    if (!doc.exists) return res.status(404).json({ error: 'Incident not found' });
    if (doc.data()?.clientId !== primaryUid) {
      return res
        .status(403)
        .json({ error: 'Forbidden: incident belongs to another tenant.' });
    }
    const title = doc.data()?.title ?? null;
    await ref.delete();

    await logActivity(ctx, 'incident_deleted', {
      category: 'delete',
      entityType: 'incident',
      entityId: id,
      entityName: title,
    });
    return res.status(200).json({ success: true });
  },
};
