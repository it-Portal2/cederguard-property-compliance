import type { AgentDef, RetrievalBundle } from '../registry.js';
import { buildSuggestionsSchema } from '../pipeline.js';
import { BundleBuilder, readContextArray, readTenantCollection } from '../retrieval.js';

async function retrieve(ctx: any, scope: any): Promise<RetrievalBundle> {
  const [risks, kris, complianceItems, incidents, detected] = await Promise.all([
    readContextArray(ctx, scope.contextId, 'risks'),
    readContextArray(ctx, scope.contextId, 'kris'),
    readContextArray(ctx, scope.contextId, 'complianceItems'),
    readTenantCollection(ctx, 'incidents', scope),
    readTenantCollection(ctx, 'detectedAlerts', scope, { limit: 100 }),
  ]);

  return new BundleBuilder()
    .add('risks', 'RISKS', risks, (r) => r.id, (r) => r.title, (r) => [
      { label: 'grossI', value: r.grossI }, { label: 'residualI', value: r.residualI },
      { label: 'status', value: r.status },
    ])
    .add('kris', 'KRIS', kris, (r) => r.id, (r) => r.name || r.title, (r) => [
      { label: 'status', value: r.status },
    ])
    .add('complianceItems', 'COMPLIANCE_ITEMS', complianceItems, (r) => r.id, (r) => r.name || r.title, (r) => [
      { label: 'stage', value: r.stage },
    ])
    .add('incidents', 'INCIDENTS', incidents, (r) => r.id, (r) => r.title, (r) => [
      { label: 'severity', value: r.severity }, { label: 'status', value: r.status },
    ])
    .add('detectedAlerts', 'DETECTED_ALERTS', detected, (r) => r.id, (r) => r.title || r.signalKind, (r) => [
      { label: 'kind', value: r.signalKind }, { label: 'entity', value: r.entityName },
    ])
    .build();
}

export const monitoringAgent: AgentDef = {
  key: 'monitoring',
  label: 'Monitoring & Reporting',
  requestType: 'monitoring',
  scopeKinds: ['project', 'programme', 'portfolio'],
  allowedOutputTypes: ['narrative', 'escalation'],
  retrieve,
  buildPrompt(bundle, scope) {
    const scopeWord = scope.kind === 'portfolio' ? 'the organisation' : scope.kind === 'programme' ? 'this programme' : 'this project';
    const prompt = [
      'You are a monitoring and reporting officer for a UK property/construction programme.',
      `Summarise the posture of ${scopeWord} from the risks, KRIs, compliance items, incidents and`,
      'detected alerts below, for an officer to review. Produce:',
      '- narrative: an executive/programme summary. It MUST clearly separate what is a verified fact',
      '  (drawn from the records) from your own analysis, and note where evidence is missing. Do not',
      '  present analysis or projection as fact.',
      '- escalation: raise a genuinely urgent signal into the Assurance hub (severity, failureReason).',
      '',
      'Ground every statement in the records below and cite their bracketed ids in sourceIds. Do not',
      'invent figures, trends or records. Put anything you cannot support in missingEvidence.',
      '',
      bundle.fenced,
    ].join('\n');

    return {
      prompt,
      responseSchema: buildSuggestionsSchema(['narrative', 'escalation'], {
        title: { type: 'string' },
        text: { type: 'string' },
        severity: { type: 'string', enum: ['Low', 'Medium', 'High', 'Critical'] },
        failureReason: { type: 'string', enum: ['alert_not_acted', 'control_failed', 'incident_occurred', 'other'] },
        description: { type: 'string' },
      }),
      temperature: 0.3,
      maxOutputTokens: 4096,
    };
  },
};
