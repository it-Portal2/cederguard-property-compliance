import type { ApiContext } from '../context.js';
import type { AgentScope } from './registry.js';

/**
 * Read a whole-array collection for a context (risks/issues/kris/complianceItems/tasks
 * at projects/{contextId}/data/{collection}). Returns [] for portfolio scope or a
 * missing doc. The caller MUST have authorized the context already.
 */
export async function readContextArray(
  ctx: ApiContext,
  contextId: string | null,
  collection: string,
): Promise<any[]> {
  if (!contextId) return [];
  const snap = await ctx.db.collection('projects').doc(contextId).collection('data').doc(collection).get();
  const arr = snap.exists ? (snap.data() as any)?.data : null;
  return Array.isArray(arr) ? arr : [];
}

/**
 * Read a tenant-scoped per-doc collection (controls/incidents/assuranceAlerts) with the
 * house equality-only query, optionally filtered to a project/programme context in
 * memory. Untagged (org-wide) records are included in a project/programme view, matching
 * the ProjectScope convention.
 */
export async function readTenantCollection(
  ctx: ApiContext,
  collection: string,
  scope: AgentScope,
  opts: { limit?: number } = {},
): Promise<any[]> {
  const snap = await ctx.db
    .collection(collection)
    .where('clientId', '==', ctx.primaryUid)
    .limit(opts.limit ?? 500)
    .get();
  const all = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
  if (scope.kind === 'portfolio' || !scope.contextId) return all;

  const cid = scope.contextId;
  const field = scope.kind === 'programme' ? 'programmeId' : 'projectId';
  return all.filter((r) => {
    const tagged = r.projectId || r.programmeId;
    if (!tagged) return true; // org-wide record shows in every context view
    return r[field] === cid;
  });
}
