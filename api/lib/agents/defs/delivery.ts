import type { AgentDef, RetrievalBundle } from '../registry.js';
import { buildSuggestionsSchema } from '../pipeline.js';
import { BundleBuilder, readContextArray, readTenantCollection } from '../retrieval.js';

async function retrieve(ctx: any, scope: any): Promise<RetrievalBundle> {
  const [tasks, risks, schemes] = await Promise.all([
    readContextArray(ctx, scope.contextId, 'tasks'),
    readContextArray(ctx, scope.contextId, 'risks'),
    readTenantCollection(ctx, 'resourceSchemes', scope),
  ]);

  return new BundleBuilder()
    .add('tasks', 'ACTIONS', tasks, (r) => r.id, (r) => r.title, (r) => [
      { label: 'owner', value: r.owner }, { label: 'status', value: r.status },
      { label: 'dueDate', value: r.dueDate }, { label: 'priority', value: r.priority },
      { label: 'capaType', value: r.capaType },
    ])
    .add('risks', 'RISKS', risks, (r) => r.id, (r) => r.title, (r) => [
      { label: 'owner', value: r.owner }, { label: 'status', value: r.status },
      { label: 'dueDate', value: r.dueDate },
    ])
    .add('resourceSchemes', 'RESOURCE_SCHEMES', schemes, (r) => r.id, (r) => r.name, (r) => [
      { label: 'route', value: r.route }, { label: 'status', value: r.status },
      { label: 'complexity', value: r.complexity },
    ])
    .build();
}

export const deliveryAgent: AgentDef = {
  key: 'delivery',
  label: 'Resource & Delivery Assurance',
  requestType: 'delivery',
  scopeKinds: ['project', 'programme'],
  allowedOutputTypes: ['capaTask', 'escalation', 'narrative'],
  retrieve,
  buildPrompt(bundle, scope) {
    const scopeWord = scope.kind === 'programme' ? 'this programme' : 'this project';
    const prompt = [
      'You are a delivery assurance officer for a UK property/construction programme.',
      `Scan the actions, risks and resource schemes for ${scopeWord} for delivery pressure, and propose,`,
      'for an officer to review:',
      '- capaTask: an action to fix an ownership gap, an overdue item, or an unassigned scheme (set capaType).',
      '- escalation: raise a serious delivery/cost/EOT exposure into the Assurance hub (severity, failureReason).',
      '- narrative: a short delivery-pressure summary (advisory text, not a record).',
      '',
      'Flag: actions with no owner or past their due date, risks past review with no owner, and schemes',
      'without a clear route or status. Ground every suggestion in the records below and cite their',
      'bracketed ids in sourceIds. Do not invent owners, dates or costs; put gaps in missingEvidence.',
      '',
      bundle.fenced,
    ].join('\n');

    return {
      prompt,
      responseSchema: buildSuggestionsSchema(['capaTask', 'escalation', 'narrative'], {
        title: { type: 'string' },
        description: { type: 'string' },
        owner: { type: 'string' },
        capaType: { type: 'string', enum: ['Corrective', 'Preventive', 'Improvement', 'Detective'] },
        severity: { type: 'string', enum: ['Low', 'Medium', 'High', 'Critical'] },
        failureReason: { type: 'string', enum: ['alert_not_acted', 'control_failed', 'incident_occurred', 'other'] },
        text: { type: 'string' },
      }),
      temperature: 0.3,
      maxOutputTokens: 4096,
    };
  },
};
