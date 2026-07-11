import type { AgentDef, RetrievalBundle } from '../registry.js';
import { buildSuggestionsSchema } from '../pipeline.js';
import { BundleBuilder, readContextArray, readContextEvidence, readTenantCollection } from '../retrieval.js';

async function retrieve(ctx: any, scope: any): Promise<RetrievalBundle> {
  const [complianceItems, controls, incidents, evidence] = await Promise.all([
    readContextArray(ctx, scope.contextId, 'complianceItems'),
    readTenantCollection(ctx, 'controls', scope),
    readTenantCollection(ctx, 'incidents', scope),
    readContextEvidence(ctx, scope.contextId),
  ]);

  return new BundleBuilder()
    .add('complianceItems', 'COMPLIANCE_ITEMS', complianceItems, (r) => r.id, (r) => r.name || r.title, (r) => [
      { label: 'stage', value: r.stage },
      { label: 'evidenceRequired', value: r.evidenceRequired ? 'yes' : 'no' },
      { label: 'owner', value: r.owner },
    ])
    .add('controls', 'CONTROLS', controls, (r) => r.id, (r) => r.title, (r) => [
      { label: 'status', value: r.status },
      { label: 'evidenceCount', value: (r.evidenceIds?.length ?? 0) },
    ])
    .add('incidents', 'INCIDENTS', incidents, (r) => r.id, (r) => r.title, (r) => [
      { label: 'severity', value: r.severity },
      { label: 'evidenceCount', value: (r.evidenceIds?.length ?? 0) },
    ])
    .add('evidence', 'EVIDENCE', evidence, (r) => r.id, (r) => r.name || r.title, (r) => [
      { label: 'type', value: r.type }, { label: 'uploaded', value: r.createdAt ? 'yes' : 'no' },
    ])
    .build();
}

const PAYLOAD_PROPS = {
  title: { type: 'string' },
  description: { type: 'string' },
  capaType: { type: 'string', enum: ['Corrective', 'Preventive', 'Improvement', 'Detective'] },
  owner: { type: 'string' },
  text: { type: 'string' },
};

export const evidenceAgent: AgentDef = {
  key: 'evidence',
  label: 'Evidence & Audit',
  requestType: 'evidence',
  scopeKinds: ['project', 'programme'],
  allowedOutputTypes: ['evidenceGap', 'capaTask', 'narrative'],
  retrieve,
  buildPrompt(bundle) {
    const prompt = [
      'You are an evidence and audit officer for a UK property/construction programme.',
      'Cross-reference the compliance items, controls and incidents below against the evidence on record',
      'and propose, for an officer to review:',
      '- evidenceGap: a control, obligation or incident that requires evidence but has none or weak evidence',
      '  — the corrective action to obtain it. Cite the exact record that is missing evidence.',
      '- capaTask: an audit or evidence-collection action (set capaType).',
      '- narrative: a short assurance/audit-pack readiness summary (advisory text, not a record).',
      '',
      'Only flag a gap when the record below actually shows missing or weak evidence — cite its bracketed',
      'id in sourceIds. Never claim evidence exists that is not listed, and never mark anything verified.',
      '',
      bundle.fenced,
    ].join('\n');

    return {
      prompt,
      responseSchema: buildSuggestionsSchema(['evidenceGap', 'capaTask', 'narrative'], PAYLOAD_PROPS),
      temperature: 0.3,
      maxOutputTokens: 4096,
    };
  },
};
