import type { OutputType } from '../../../../shared/types/agents.js';
import type { OutputAdapter } from './base.js';
import { riskAdapter, complianceItemAdapter, capaTaskAdapter, evidenceGapAdapter, lessonLearnedAdapter } from './arrayAdapters.js';
import { controlAdapter } from './controlAdapter.js';
import { incidentAdapter } from './incidentAdapter.js';
import { escalationAdapter } from './escalationAdapter.js';

export type { ApplyResult, OutputAdapter } from './base.js';
export { stripForbiddenFields, requireContext, str, clampInt } from './base.js';

/**
 * The Action Writer. An output type with no adapter here CANNOT reach a live record,
 * which is how the brief's prohibited actions are enforced: there is no adapter that
 * closes an incident, downgrades a risk, marks compliance complete, issues an external
 * communication or commits spend, so no approval — however senior — can produce one.
 *
 * `narrative` and `technicalAnswer` are deliberately absent for now: a narrative is
 * accept-terminal (the officer uses the approved text), and the TAC answer adapter
 * lands with the Technical Companion agent.
 */
export const ADAPTERS: Partial<Record<OutputType, OutputAdapter>> = {
  risk: riskAdapter,
  control: controlAdapter,
  complianceItem: complianceItemAdapter,
  capaTask: capaTaskAdapter,
  evidenceGap: evidenceGapAdapter,
  lessonLearned: lessonLearnedAdapter,
  incidentUpdate: incidentAdapter,
  escalation: escalationAdapter,
};

export function getAdapter(outputType: OutputType): OutputAdapter | undefined {
  return ADAPTERS[outputType];
}
