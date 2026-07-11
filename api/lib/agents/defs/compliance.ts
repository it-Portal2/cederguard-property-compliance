import type { AgentDef, RetrievalBundle } from '../registry.js';
import { buildSuggestionsSchema } from '../pipeline.js';
import { BundleBuilder, readContextArray, readTenantCollection } from '../retrieval.js';

async function retrieve(ctx: any, scope: any): Promise<RetrievalBundle> {
  const [complianceItems, controls] = await Promise.all([
    readContextArray(ctx, scope.contextId, 'complianceItems'),
    readTenantCollection(ctx, 'controls', scope),
  ]);

  return new BundleBuilder()
    .add('complianceItems', 'COMPLIANCE_ITEMS', complianceItems, (r) => r.id, (r) => r.name || r.title, (r) => [
      { label: 'stage', value: r.stage }, { label: 'status', value: r.status },
      { label: 'domain', value: r.domain || r.category },
      { label: 'owner', value: r.owner },
      { label: 'evidenceRequired', value: r.evidenceRequired ? 'yes' : 'no' },
      { label: 'dueDate', value: r.dueDate },
    ])
    .add('controls', 'CONTROLS', controls, (r) => r.id, (r) => r.title, (r) => [
      { label: 'status', value: r.status }, { label: 'group', value: r.complianceGroup },
    ])
    .build();
}

const PAYLOAD_PROPS = {
  name: { type: 'string' },
  description: { type: 'string' },
  category: { type: 'string' },
  domain: { type: 'string' },
  owner: { type: 'string' },
  evidenceRequired: { type: 'boolean' },
  title: { type: 'string' },
  reference: { type: 'string' },
  complianceGroup: { type: 'string' },
  text: { type: 'string' },
};

export const complianceAgent: AgentDef = {
  key: 'compliance',
  label: 'Compliance & Obligations',
  requestType: 'compliance',
  scopeKinds: ['project', 'programme'],
  allowedOutputTypes: ['complianceItem', 'control', 'evidenceGap', 'narrative'],
  retrieve,
  buildPrompt(bundle, scope) {
    const scopeWord = scope.kind === 'programme' ? 'this programme' : 'this project';
    const prompt = [
      'You are a compliance and obligations officer for a UK property/construction programme.',
      `Review the compliance items and controls for ${scopeWord} and propose, for an officer to review:`,
      '- complianceItem: a NEW obligation not yet tracked (give name, domain, owner, whether evidence is required).',
      '- control: a control checklist item that would satisfy an obligation (title, complianceGroup).',
      '- evidenceGap: an obligation that requires evidence but has none — the action to obtain it.',
      '- narrative: a short compliance-gap summary (this is advisory text, not a record).',
      '',
      'Ground every suggestion in the records below and cite their bracketed ids in sourceIds. Never mark',
      'an obligation complete, never mark a control verified, and never fabricate a regulation or a source.',
      'If evidence is missing, put it in missingEvidence and lower confidence.',
      '',
      bundle.fenced,
    ].join('\n');

    return {
      prompt,
      responseSchema: buildSuggestionsSchema(
        ['complianceItem', 'control', 'evidenceGap', 'narrative'],
        PAYLOAD_PROPS,
      ),
      temperature: 0.3,
      maxOutputTokens: 4096,
    };
  },
};
