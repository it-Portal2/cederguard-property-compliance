import type { ApiContext } from '../context.js';
import type { AgentScope, RetrievalBundle } from './registry.js';
import type { RecordCitation } from '../../../shared/types/agents.js';
import { fenceRecords, FENCE_PREAMBLE } from './fencing.js';

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

/**
 * Read evidence records for a context. Evidence is scoped by its `project` field (which
 * holds a project OR programme id), so a single equality query on the context id — no
 * composite index. Returns [] for portfolio scope.
 */
export async function readContextEvidence(
  ctx: ApiContext,
  contextId: string | null,
  limit = 300,
): Promise<any[]> {
  if (!contextId) return [];
  const snap = await ctx.db.collection('evidence').where('project', '==', contextId).limit(limit).get();
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
}

/**
 * Accumulates fenced record blocks into a RetrievalBundle. Every agent's retrieve()
 * adds its collections through this, so the validId set, citation map, per-collection
 * retrieved-ids audit and truncation flag are assembled the same way everywhere.
 */
export class BundleBuilder {
  private validIds = new Set<string>();
  private citations = new Map<string, RecordCitation>();
  private retrieved: { collection: string; ids: string[] }[] = [];
  private recordCounts: Record<string, number> = {};
  private truncated = false;
  private blocks: string[] = [];

  add(
    collection: string,
    tag: string,
    records: any[],
    id: (r: any) => string,
    label: (r: any) => string,
    fields: (r: any) => { label: string; value: unknown }[],
  ): this {
    const f = fenceRecords({ collection, tag, records, id, label, fields });
    for (const [k, v] of f.citations) {
      this.validIds.add(k);
      this.citations.set(k, v);
    }
    this.retrieved.push({ collection, ids: f.ids });
    this.recordCounts[collection] = f.count;
    this.truncated = this.truncated || f.truncated;
    this.blocks.push(f.text);
    return this;
  }

  build(): RetrievalBundle {
    return {
      fenced: [FENCE_PREAMBLE, '', ...this.blocks].join('\n'),
      validIds: this.validIds,
      citations: this.citations,
      retrieved: this.retrieved,
      recordCounts: this.recordCounts,
      truncated: this.truncated,
    };
  }
}
