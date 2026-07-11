import type { AgentKey, OutputType } from "../../../shared/types/agents";

export interface AgentMeta {
  key: AgentKey;
  label: string;
  blurb: string;
}

/** Display metadata for the 7 agents. The server registry is the source of truth for
 *  which agents actually run; this is purely for labels in the UI. */
export const AGENT_META: Record<AgentKey, AgentMeta> = {
  governance: { key: "governance", label: "Governance & Control", blurb: "Readiness checks, control and decision drafts." },
  riskIncident: { key: "riskIncident", label: "Risk & Incident", blurb: "Risk suggestions, incident gaps, CAPA actions." },
  compliance: { key: "compliance", label: "Compliance & Obligations", blurb: "Obligations, control checklists, evidence needs." },
  technical: { key: "technical", label: "Technical Companion", blurb: "Cited answers to a project question." },
  evidence: { key: "evidence", label: "Evidence & Audit", blurb: "Evidence gaps and audit-pack drafts." },
  monitoring: { key: "monitoring", label: "Monitoring & Reporting", blurb: "Executive and programme narrative drafts." },
  delivery: { key: "delivery", label: "Resource & Delivery Assurance", blurb: "Ownership gaps, overdue actions, delivery pressure." },
};

export const OUTPUT_TYPE_LABELS: Record<OutputType, string> = {
  risk: "Risk",
  control: "Control",
  complianceItem: "Compliance item",
  capaTask: "CAPA action",
  evidenceGap: "Evidence gap",
  incidentUpdate: "Incident update",
  lessonLearned: "Lesson learned",
  technicalAnswer: "Technical answer",
  narrative: "Narrative",
  escalation: "Escalation",
};

export const REVIEW_STATUS_STYLE: Record<string, string> = {
  draft: "text-slate-600 bg-slate-100 border-slate-200",
  accepted: "text-emerald-700 bg-emerald-50 border-emerald-200",
  edited: "text-indigo-700 bg-indigo-50 border-indigo-200",
  rejected: "text-red-700 bg-red-50 border-red-200",
  applied: "text-emerald-800 bg-emerald-100 border-emerald-300",
  superseded: "text-slate-400 bg-slate-50 border-slate-200",
};
