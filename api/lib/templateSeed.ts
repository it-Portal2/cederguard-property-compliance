// 13 starter templates for the governance library.
// Codes locked in Round 5 Q4: GW1-3, KM1-6, SHLD, FIN2, CABREP, OTHER.
// Senior-PM-review defaults locked in Round 5 Q5.

export type TemplateCategory =
  | 'gateway'
  | 'milestone'
  | 'finance'
  | 'shareholder'
  | 'cabinet'
  | 'other';

export interface SeedSection {
  id: string;
  order: number;
  name: string;
  guidance: string;
  mandatory: boolean;
  statutory: boolean;
  aiDraftAllowed: boolean;
  complianceCheck: boolean;
  citedRegulations?: string[];
  routingRules?: string;
  requiredAttachments?: string[];
}

export interface SeedTemplate {
  id: string;
  code: string;
  category: TemplateCategory;
  title: string;
  description: string;
  requireSeniorPmReview: boolean;
  defaultRoute: string;
  sections: SeedSection[];
}

// Canonical section blocks reused across templates so we stay DRY. Each
// factory returns a fresh copy per template so ordering + IDs are stable.
function mandatoryStatutory(id: string, order: number, name: string, guidance: string, extras: Partial<SeedSection> = {}): SeedSection {
  return {
    id,
    order,
    name,
    guidance,
    mandatory: true,
    statutory: true,
    aiDraftAllowed: false,
    complianceCheck: false,
    ...extras,
  };
}
function mandatory(id: string, order: number, name: string, guidance: string, extras: Partial<SeedSection> = {}): SeedSection {
  return {
    id,
    order,
    name,
    guidance,
    mandatory: true,
    statutory: false,
    aiDraftAllowed: true,
    complianceCheck: false,
    ...extras,
  };
}
function optional(id: string, order: number, name: string, guidance: string, extras: Partial<SeedSection> = {}): SeedSection {
  return {
    id,
    order,
    name,
    guidance,
    mandatory: false,
    statutory: false,
    aiDraftAllowed: true,
    complianceCheck: false,
    ...extras,
  };
}

// Standard gateway / milestone section layout — consistent with the Southwark
// GW2 + Enfield KD samples and the plan §17 prefab skeletons.
function gatewayStyleSections(variant: 'gateway' | 'milestone' | 'cabinet'): SeedSection[] {
  const isGateway = variant === 'gateway';
  return [
    mandatoryStatutory('header', 1, 'Header metadata', 'Decision taker, date, wards, classification, report title.'),
    mandatory('recommendations', 2, 'Recommendations', 'What you are asking the decision taker to approve. Numbered list.', { complianceCheck: true }),
    mandatory('background', 3, 'Background', 'Context and narrative. Why this paper, why now.', { aiDraftAllowed: true }),
    mandatory('financial', 4, 'Financial implications', 'Spend, savings, budget envelope, capital vs revenue. S151 concurrent comment required.', {
      complianceCheck: true,
      citedRegulations: ['Local Government Act 1972 s.151'],
    }),
    mandatory('legal', 5, 'Legal implications', 'Statutory basis, contractual risk, delegated authority. Monitoring Officer concurrent comment required.', {
      complianceCheck: true,
      citedRegulations: ['Local Government Act 2000'],
    }),
    mandatory('community', 6, 'Community impact & equalities', 'Equalities Impact Assessment (ENIA) must be attached for procurement reports.', {
      ...(isGateway ? { requiredAttachments: ['ENIA'] } : {}),
      complianceCheck: true,
    }),
    mandatory('risk', 7, 'Risk assessment', 'Strategic, financial, reputational risks + mitigations. Table format preferred.', { aiDraftAllowed: true }),
    mandatory('conclusion', 8, 'Conclusion', 'Summary of why the recommendations should be accepted.', { aiDraftAllowed: true }),
    mandatoryStatutory('background-docs', 9, 'Background documents', 'Links to prior reports referenced in this paper.'),
    mandatoryStatutory('appendices', 10, 'Appendices', 'Open / Closed (Part 2) classification per appendix.'),
    mandatoryStatutory('part-a', 11, 'Part A — Sign-off', 'Strategic Director signature block. AI drafting is NOT permitted for this section.', {
      citedRegulations: ['Scheme of Delegation'],
    }),
    mandatoryStatutory('part-b', 12, 'Part B — Conflicts declaration', 'Declaration of conflicts of interest. AI drafting is NOT permitted for this section.'),
    mandatoryStatutory('audit-footer', 13, 'Audit trail footer', 'Auto-populated from report metadata (Lead officer, Version, Dated, Key decision flag, Consultation).'),
  ];
}

function financeSections(): SeedSection[] {
  return [
    mandatoryStatutory('header', 1, 'Header metadata', 'Decision taker, date, classification.'),
    mandatory('summary', 2, 'Financial summary', 'Headline numbers, period covered, variance against budget.', { complianceCheck: true }),
    mandatory('variance', 3, 'Variance analysis', 'Where we are against forecast, why, and planned response.'),
    mandatory('forecast', 4, 'Forecast', 'Outturn projection + confidence level.'),
    optional('recommendations', 5, 'Recommendations', 'Actions requested of the decision taker.', { mandatory: true }),
    mandatoryStatutory('part-a', 6, 'Part A — S151 sign-off', 'Section 151 Officer signature block.'),
    mandatoryStatutory('audit-footer', 7, 'Audit trail footer', 'Auto-populated.'),
  ];
}

function shareholderSections(): SeedSection[] {
  return [
    mandatoryStatutory('header', 1, 'Header metadata', 'Decision taker, date, classification.'),
    mandatory('proposal', 2, 'Shareholder proposal', 'What the company is asking of the shareholder (the council).', { complianceCheck: true }),
    mandatory('rationale', 3, 'Strategic rationale', 'Why this decision now.'),
    mandatory('financial-impact', 4, 'Financial impact on shareholder', 'Exposure to the council.'),
    mandatory('alternatives', 5, 'Alternative options', 'What was considered and why rejected.'),
    optional('conclusion', 6, 'Conclusion', 'Summary.', { mandatory: true }),
    mandatoryStatutory('part-a', 7, 'Part A — Shareholder sign-off', 'Shareholder representative signature.'),
    mandatoryStatutory('audit-footer', 8, 'Audit trail footer', 'Auto-populated.'),
  ];
}

function otherSections(): SeedSection[] {
  return [
    mandatoryStatutory('header', 1, 'Header metadata', 'Decision taker, date, classification.'),
    mandatory('purpose', 2, 'Purpose of report', 'What this report sets out to do.'),
    mandatory('body', 3, 'Body', 'Main content of the paper.', { aiDraftAllowed: true }),
    optional('recommendations', 4, 'Recommendations', 'Optional — include if a decision is being requested.'),
    mandatoryStatutory('audit-footer', 5, 'Audit trail footer', 'Auto-populated.'),
  ];
}

// ── The 13 starter templates ──────────────────────────────────────────────

export const SEED_TEMPLATES: SeedTemplate[] = [
  // Gateway (3) — all require Senior PM review
  {
    id: 'gw1',
    code: 'GW1',
    category: 'gateway',
    title: 'Gateway 1 — Strategic Outline Case',
    description: 'Initial business case approval. Sets out the strategic need, preferred option and indicative costs.',
    requireSeniorPmReview: true,
    defaultRoute: 'DPB → DCRB',
    sections: gatewayStyleSections('gateway'),
  },
  {
    id: 'gw2',
    code: 'GW2',
    category: 'gateway',
    title: 'Gateway 2 — Procurement Strategy',
    description: 'Approval of procurement route and strategy before tender issue.',
    requireSeniorPmReview: true,
    defaultRoute: 'DPB → DCRB → CCRB → Cabinet',
    sections: gatewayStyleSections('gateway'),
  },
  {
    id: 'gw3',
    code: 'GW3',
    category: 'gateway',
    title: 'Gateway 3 — Contract Award',
    description: 'Approval to award the contract to the preferred tenderer.',
    requireSeniorPmReview: true,
    defaultRoute: 'DPB → DCRB → CCRB → Cabinet',
    sections: gatewayStyleSections('gateway'),
  },

  // Key Milestones (6) — all require Senior PM review
  {
    id: 'km1',
    code: 'KM1',
    category: 'milestone',
    title: 'Key Milestone 1 — Start on Site',
    description: 'Project is mobilising on site. Confirms readiness for construction commencement.',
    requireSeniorPmReview: true,
    defaultRoute: 'DPB → Housing SMT',
    sections: gatewayStyleSections('milestone'),
  },
  {
    id: 'km2',
    code: 'KM2',
    category: 'milestone',
    title: 'Key Milestone 2 — Progress Report',
    description: 'Mid-project status report to the sponsor board.',
    requireSeniorPmReview: true,
    defaultRoute: 'DPB → Housing SMT',
    sections: gatewayStyleSections('milestone'),
  },
  {
    id: 'km3',
    code: 'KM3',
    category: 'milestone',
    title: 'Key Milestone 3 — Delivery Update',
    description: 'Detailed delivery update with programme and spend tracking.',
    requireSeniorPmReview: true,
    defaultRoute: 'DPB → Housing SMT',
    sections: gatewayStyleSections('milestone'),
  },
  {
    id: 'km4',
    code: 'KM4',
    category: 'milestone',
    title: 'Key Milestone 4 — HRB Gateway Two (BSA 2022)',
    description: 'Building Safety Act Gateway 2 submission for High-Risk Buildings. Mandatory alongside GW2 for HRB works.',
    requireSeniorPmReview: true,
    defaultRoute: 'DPB → BSB → Cabinet',
    sections: gatewayStyleSections('milestone'),
  },
  {
    id: 'km5',
    code: 'KM5',
    category: 'milestone',
    title: 'Key Milestone 5 — Completion',
    description: 'Practical completion of the project. Handover readiness report.',
    requireSeniorPmReview: true,
    defaultRoute: 'DPB → Housing SMT',
    sections: gatewayStyleSections('milestone'),
  },
  {
    id: 'km6',
    code: 'KM6',
    category: 'milestone',
    title: 'Key Milestone 6 — Lessons Learned',
    description: 'Post-completion lessons-learned review. Informs future gateway reports.',
    requireSeniorPmReview: true,
    defaultRoute: 'DPB → Housing SMT',
    sections: gatewayStyleSections('milestone'),
  },

  // Non-gateway (4) — Senior PM review NOT required by default
  {
    id: 'shld',
    code: 'SHLD',
    category: 'shareholder',
    title: 'Shareholder Approval',
    description: 'For council-owned trading companies (ALMOs, LHCs). Routes to the shareholder cabinet member.',
    requireSeniorPmReview: false,
    defaultRoute: 'Shareholder Cabinet Member',
    sections: shareholderSections(),
  },
  {
    id: 'fin2',
    code: 'FIN2',
    category: 'finance',
    title: 'Finance Report (FIN2)',
    description: 'Quarterly or event-driven finance report. S151 sign-off only; no Cabinet routing by default.',
    requireSeniorPmReview: false,
    defaultRoute: 'S151 Officer',
    sections: financeSections(),
  },
  {
    id: 'cabrep',
    code: 'CABREP',
    category: 'cabinet',
    title: 'Cabinet Report (general)',
    description: 'General Cabinet paper not tied to a gateway. Use for policy reports, consultations, annual updates.',
    requireSeniorPmReview: false,
    defaultRoute: 'DPB → Cabinet',
    sections: gatewayStyleSections('cabinet'),
  },
  {
    id: 'other',
    code: 'OTHER',
    category: 'other',
    title: 'Other (catch-all)',
    description: 'Annual monitoring reports, officer decisions, ad-hoc papers. Use when no other template fits.',
    requireSeniorPmReview: false,
    defaultRoute: 'Officer Decision',
    sections: otherSections(),
  },
];

export const TEMPLATE_CATEGORY_LABEL: Record<TemplateCategory, string> = {
  gateway: 'Gateway',
  milestone: 'Key Milestone',
  finance: 'Finance',
  shareholder: 'Shareholder',
  cabinet: 'Cabinet',
  other: 'Other',
};
