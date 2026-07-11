import type { AgentDef, RetrievalBundle } from '../registry.js';
import { buildSuggestionsSchema } from '../pipeline.js';
import { BundleBuilder, readTenantCollection } from '../retrieval.js';

/** Governance reports and meetings are workspace-wide (no project field), so they are
 *  read tenant-wide regardless of scope. Controls are context-scoped. */
async function retrieve(ctx: any, scope: any): Promise<RetrievalBundle> {
  const portfolio = { kind: 'portfolio' as const, contextId: null };
  const [reports, meetings, controls] = await Promise.all([
    readTenantCollection(ctx, 'reports', portfolio),
    readTenantCollection(ctx, 'meetings', portfolio),
    readTenantCollection(ctx, 'controls', scope),
  ]);

  return new BundleBuilder()
    .add('reports', 'GOVERNANCE_REPORTS', reports, (r) => r.id, (r) => r.title, (r) => [
      { label: 'status', value: r.status }, { label: 'scheme', value: r.scheme },
      { label: 'owner', value: r.ownerLabel },
    ])
    .add('meetings', 'GOVERNANCE_MEETINGS', meetings, (r) => r.id || r._id, (r) => r.title || r.name, (r) => [
      { label: 'status', value: r.status }, { label: 'date', value: r.date || r.scheduledFor },
    ])
    .add('controls', 'CONTROLS', controls, (r) => r.id, (r) => r.title, (r) => [
      { label: 'status', value: r.status }, { label: 'group', value: r.complianceGroup },
    ])
    .build();
}

const PAYLOAD_PROPS = {
  title: { type: 'string' },
  description: { type: 'string' },
  complianceGroup: { type: 'string' },
  reference: { type: 'string' },
  capaType: { type: 'string', enum: ['Corrective', 'Preventive', 'Improvement', 'Detective'] },
  severity: { type: 'string', enum: ['Low', 'Medium', 'High', 'Critical'] },
  failureReason: { type: 'string', enum: ['alert_not_acted', 'control_failed', 'incident_occurred', 'other'] },
  text: { type: 'string' },
};

export const governanceAgent: AgentDef = {
  key: 'governance',
  label: 'Governance & Control',
  requestType: 'governance',
  scopeKinds: ['project', 'programme', 'portfolio'],
  allowedOutputTypes: ['control', 'capaTask', 'narrative', 'escalation'],
  retrieve,
  buildPrompt(bundle) {
    const prompt = [
      'You are a governance officer for a UK property/construction programme.',
      'Assess governance readiness from the reports, meetings and controls below, and propose, for review:',
      '- control: a control the governance framework needs but does not have (title, complianceGroup).',
      '- capaTask: a decision or action a board/meeting must take (set capaType).',
      '- narrative: a short board-assurance readiness summary (advisory text, not a record).',
      '- escalation: raise a governance failure into the Assurance hub for enforcement (severity, failureReason).',
      '',
      'Ground every suggestion in the records below and cite their bracketed ids in sourceIds. Do not',
      'fabricate reports, meetings or decisions, and never approve a report or issue a statutory position.',
      'If evidence is missing, say so in missingEvidence and lower confidence.',
      '',
      bundle.fenced,
    ].join('\n');

    return {
      prompt,
      responseSchema: buildSuggestionsSchema(['control', 'capaTask', 'narrative', 'escalation'], PAYLOAD_PROPS),
      temperature: 0.3,
      maxOutputTokens: 4096,
    };
  },
};
