import type { AgentDef, RetrievalBundle } from '../registry.js';
import { buildSuggestionsSchema } from '../pipeline.js';
import { BundleBuilder, readContextArray, readTenantCollection } from '../retrieval.js';

async function retrieve(ctx: any, scope: any): Promise<RetrievalBundle> {
  const [risks, issues, kris, incidents, controls] = await Promise.all([
    readContextArray(ctx, scope.contextId, 'risks'),
    readContextArray(ctx, scope.contextId, 'issues'),
    readContextArray(ctx, scope.contextId, 'kris'),
    readTenantCollection(ctx, 'incidents', scope),
    readTenantCollection(ctx, 'controls', scope),
  ]);

  return new BundleBuilder()
    .add('risks', 'RISKS', risks, (r) => r.id, (r) => r.title, (r) => [
      { label: 'category', value: r.category },
      { label: 'grossL', value: r.grossL }, { label: 'grossI', value: r.grossI },
      { label: 'residualL', value: r.residualL }, { label: 'residualI', value: r.residualI },
      { label: 'status', value: r.status }, { label: 'owner', value: r.owner },
    ])
    .add('issues', 'ISSUES', issues, (r) => r.id, (r) => r.title, (r) => [
      { label: 'priority', value: r.priority }, { label: 'status', value: r.status },
    ])
    .add('kris', 'KRIS', kris, (r) => r.id, (r) => r.name || r.title, (r) => [
      { label: 'status', value: r.status }, { label: 'threshold', value: r.threshold },
    ])
    .add('incidents', 'INCIDENTS', incidents, (r) => r.id, (r) => r.title, (r) => [
      { label: 'type', value: r.type }, { label: 'severity', value: r.severity },
      { label: 'occurredAt', value: r.occurredAt }, { label: 'rootCause', value: r.rootCause },
      { label: 'evidence', value: (r.evidenceIds?.length ? 'present' : 'none') },
      { label: 'status', value: r.status },
    ])
    .add('controls', 'CONTROLS', controls, (r) => r.id, (r) => r.title, (r) => [
      { label: 'status', value: r.status }, { label: 'group', value: r.complianceGroup },
    ])
    .build();
}

const PAYLOAD_PROPS = {
  title: { type: 'string' },
  desc: { type: 'string' },
  category: { type: 'string' },
  owner: { type: 'string' },
  grossL: { type: 'number' }, grossI: { type: 'number' },
  residualL: { type: 'number' }, residualI: { type: 'number' },
  capaType: { type: 'string', enum: ['Corrective', 'Preventive', 'Improvement', 'Detective'] },
  incidentId: { type: 'string' },
  rootCause: { type: 'string' },
  lessonsLearned: { type: 'string' },
  problem: { type: 'string' }, resolution: { type: 'string' }, prevention: { type: 'string' },
};

export const riskIncidentAgent: AgentDef = {
  key: 'riskIncident',
  label: 'Risk & Incident',
  requestType: 'risk',
  scopeKinds: ['project', 'programme'],
  allowedOutputTypes: ['risk', 'capaTask', 'incidentUpdate', 'lessonLearned'],
  retrieve,
  buildPrompt(bundle, scope) {
    const scopeWord = scope.kind === 'programme' ? 'this programme' : 'this project';
    const prompt = [
      'You are a risk and incident officer for a UK property/construction compliance programme.',
      `Analyse the risk register, issues, KRIs, incidents and controls for ${scopeWord} and propose`,
      'improvements for an officer to review. You may propose:',
      '- risk: a NEW risk not yet on the register (give category, gross/residual likelihood & impact 1-5, owner).',
      '- capaTask: a corrective/preventive action, e.g. to close an evidence or data gap. Set capaType.',
      '- incidentUpdate: fill a MISSING field on an existing incident (its id in incidentId) — root cause,',
      '  lessons learned or impact. Flag incidents missing severity, root cause or evidence as incomplete.',
      '  You may NEVER change an incident\'s status or close it.',
      '- lessonLearned: a lesson from a recurring or closed incident (problem/resolution/prevention).',
      '',
      'Ground every suggestion in the records below and cite their bracketed ids in sourceIds. Do not',
      'invent records, ids, scores or facts. If evidence is missing, say so in missingEvidence and lower',
      'confidence. Never propose closing an incident, downgrading a risk, or marking anything verified.',
      '',
      bundle.fenced,
    ].join('\n');

    return {
      prompt,
      responseSchema: buildSuggestionsSchema(
        ['risk', 'capaTask', 'incidentUpdate', 'lessonLearned'],
        PAYLOAD_PROPS,
      ),
      temperature: 0.3,
      maxOutputTokens: 4096,
    };
  },
};
