export const PROJECTS: string[] = [];

export const WORKSTREAMS = [
  "Resourcing",
  "Finance",
  "Programme Delivery",
  "Building Safety",
  "Fire Safety",
  "Planning",
  "Procurement",
  "Environmental",
  "Stakeholder",
  "Technical",
  "Quality",
  "Legal",
  "Corporate Risk",
  "Reputational",
];

export const CATEGORIES = [
  "Finance / Financial",
  "Building Safety",
  "Health & Safety",
  "Procurement",
  "Planning",
  "Environmental",
  "Legal / Regulatory",
  "Reputational",
  "Technical",
  "Operational",
  "Strategic",
  "Social Housing Regulation",
];

export const KRI_LIST = [
  "Building Control Safety Compliance KRI",
  "Programme Delivery Excellence KRI",
  "Programme Financial Sustainability KRI",
  "Resource & Capability Adequacy KRI",
  "Strategic Objectives & Adaptability KRI",
  "Supply Chain & Safety Performance KRI",
  "Technical Delivery & Infrastructure KRI",
];

export const KRI_OWNERS: Record<string, string> = {
  "Building Control Safety Compliance KRI": "Osama",
  "Programme Delivery Excellence KRI": "Margaret",
  "Programme Financial Sustainability KRI": "Hemali",
  "Resource & Capability Adequacy KRI": "Zoe",
  "Strategic Objectives & Adaptability KRI": "Zoe",
  "Supply Chain & Safety Performance KRI": "Zoe",
  "Technical Delivery & Infrastructure KRI": "Richard",
};

export interface KRIMetadata {
  components: string;
  metricLabel: string;
  thresholdType:
    | "high_risks"
    | "overdue"
    | "pct_overdue"
    | "avg_age"
    | "project_pct"
    | "residual_exp"
    | "reduction_pct"
    | "count"
    | "percent"
    | "currency"
    | "reduction";
  green: string;
  amber: string;
}

export const KRI_METADATA: Record<string, KRIMetadata> = {
  "Building Control Safety Compliance KRI": {
    components:
      "Building Control delays, Fire safety (LFB), Safety compliance, Building Safety Act, Regulatory relations (PCR Compliance)",
    metricLabel: "High Risks",
    thresholdType: "high_risks",
    green: "<=3",
    amber: "4-6",
  },
  "Programme Delivery Excellence KRI": {
    components:
      "Schedule performance, Quality delivery (defects), Contractor performance, Building Control, Handover Excellence",
    metricLabel: "Overdue Risks",
    thresholdType: "overdue",
    green: "0-1",
    amber: "2-3",
  },
  "Programme Financial Sustainability KRI": {
    components:
      "Budget performance, Cost control, Funding security, Revenue generation, Loss & expense vs contingency",
    metricLabel: "% Overdue",
    thresholdType: "pct_overdue",
    green: "<=10%",
    amber: "11-25%",
  },
  "Resource & Capability Adequacy KRI": {
    components:
      "Resource capacity, Skills adequacy, Personnel availability, Specialist resources, Resource availability",
    metricLabel: "Avg Risk Age (Days)",
    thresholdType: "avg_age",
    green: "<=30",
    amber: "31-60",
  },
  "Strategic Objectives & Adaptability KRI": {
    components:
      "Corporate Plan delivery, Target achievement, Policy compliance, Estate optimisation, Political alignment",
    metricLabel: "% Projects Impacted",
    thresholdType: "project_pct",
    green: "<=25%",
    amber: "26-50%",
  },
  "Supply Chain & Safety Performance KRI": {
    components:
      "Contractor performance, Materials availability, Safety performance, Quality standards, Risk management",
    metricLabel: "Residual Exposure (£)",
    thresholdType: "residual_exp",
    green: "<=£2M",
    amber: "£2M-£4M",
  },
  "Technical Delivery & Infrastructure KRI": {
    components:
      "Design quality, Infrastructure coordination, Utilities integration, Systems integration, Data management (key document approval)",
    metricLabel: "Risk Reduction (%)",
    thresholdType: "reduction_pct",
    green: ">=50%",
    amber: "30-49%",
  },
};

export interface KRI {
  id: string;
  name: string;
  owner: string;
  totalRisks?: number;
  highRisks?: number;
  overdue?: number;
  overduePct?: number;
  avgRiskAge?: number;
  projectsPct?: number;
  residualExposure?: number;
  riskReductionPct?: number;
  status?: "Green" | "Yellow" | "Red";
  escalation?: "None" | "Project" | "Programme";
  components?: string;
  metricLabel?: string;
  thresholdType?:
    | "high_risks"
    | "overdue"
    | "pct_overdue"
    | "avg_age"
    | "project_pct"
    | "residual_exp"
    | "reduction_pct"
    | "count"
    | "percent"
    | "currency"
    | "reduction";
  green?: string;
  amber?: string;
}

export const SEED_KRIS: KRI[] = KRI_LIST.map((name, i) => ({
  id: `KRI-${(i + 1).toString().padStart(3, "0")}`,
  name,
  owner: KRI_OWNERS[name] || "Lead Auditor",
  ...KRI_METADATA[name],
  thresholdType: KRI_METADATA[name].thresholdType as any,
}));

export const RISK_STATUSES = [
  "Open",
  "Closed",
  "Managed",
  "Mitigated",
  "Tolerated",
];
export const RISK_RESPONSES = [
  "Avoid",
  "Reduce",
  "Transfer",
  "Accept",
  "Escalate",
];
export const APPETITES = ["Averse", "Minimal", "Cautious", "Open", "Hungry"];
export const ISSUE_STATUSES = [
  "1. Investigating",
  "2. Escalated",
  "3. Implementing Fix",
  "4. Resolved",
  "5. Unassigned",
];
export const ISSUE_RESPONSES = [
  "Resolve",
  "Escalate",
  "Monitor",
  "Accept",
  "Transfer",
];
export const FINANCIAL_RATINGS = [
  "Under £50k",
  "£50k-£250k",
  "£250k-£1M",
  "£1M-£10M",
  "Over £10M",
];
export const RAD_OPTIONS = ["R - Review", "A - Action", "D - Decision"];
export const REVIEW_PLANS = ["Accept", "Review", "Escalate"];

function rr(l: number, i: number) {
  return (l || 0) * (i || 0);
}

// Full demo seed data — only loaded when user clicks "Load Demo Data"
export const SEED_RISKS = [
  {
    id: "PR_0005",
    projectId: "P001",
    programmeId: "PROG-001",
    project: "P001 – Bermondsey Estate",
    workstream: "Finance",
    kri: "Programme Financial Sustainability KRI",
    dateAdded: "2026-02-28",
    title: "Failure to deliver a sustainable Financial Strategy",
    desc: "Failure to deliver a sustainable Financial Strategy which meets with Making Bromley Even Better priorities and failure of individual departments to meet budget",
    cause:
      "1. Council Tax Report 2025/26 Budget identifying 'budget gap'.\n2. Fair Funding 2.0 implementation expected 2026/27.\n3. Increased demand on housing (homelessness), social care.\n4. Dependency on external grants.\n5. National living wage increases.",
    category: "Finance / Financial",
    grossL: 4,
    grossI: 5,
    response: "Reduce",
    owner: "Hemali",
    controls:
      "Regular update to forward forecast.\nRegular analysis of funding changes.\nTransformation options considered early.\nBudget monitoring with Director action.\nQuarterly review of growth pressures.\nGrowth Reduction Board chaired by Chief Executive.",
    residualL: 3,
    residualI: 5,
    appetite: "Cautious",
    furtherAction:
      "Chief Officers to explore further measures to reduce overspend.\nTransformation opportunities being pursued.",
    status: "Open",
    dueDate: "2026-02-26",
    escalated: false,
    grossImpact: 100000,
    grossProb: 0.8,
    residualImpact: 50000,
    residualProb: 0.6,
  },
  {
    id: "PR_0006",
    projectId: "P001",
    programmeId: "PROG-001",
    project: "P001 – Bermondsey Estate",
    workstream: "Reputational",
    kri: "Strategic Objectives & Adaptability KRI",
    dateAdded: "2026-01-15",
    title: "Ineffective governance and management of contracts and procurement",
    desc: "Ineffective governance and management of contracts and procurement leading to value for money risks and service disruptions.",
    cause:
      "1. Non-compliance with Procurement Act 2023.\n2. Poor record keeping.\n3. Insufficient engagement with support services.\n4. Poor planning for commissioning.",
    category: "Legal / Regulatory",
    grossL: 3,
    grossI: 4,
    response: "Reduce",
    owner: "Zoe",
    controls:
      "Gateway process to support decisions.\nContracts Database and Quarterly Reports.\nMember scrutiny for high-value contracts.\nStaff training programme.",
    residualL: 2,
    residualI: 4,
    appetite: "Cautious",
    furtherAction:
      "Procurement Pipeline Summer 2025.\nUpdate and adoption of revised Contract Procedure Rules.",
    status: "Open",
    dueDate: "2026-03-31",
    escalated: false,
    grossImpact: 50001,
    grossProb: 0.6,
    residualImpact: 50001,
    residualProb: 0.4,
  },
  {
    id: "PR_0007",
    projectId: "P006",
    programmeId: "PROG-001",
    project: "P006 – Canada Water HRB",
    workstream: "Corporate Risk",
    kri: "Strategic Objectives & Adaptability KRI",
    dateAdded: "2026-01-10",
    title: "Failure to maintain and develop ICT information systems",
    desc: "Failure to maintain and develop ICT information systems to reliably support departmental service delivery.",
    cause:
      "1. Systems not fit for purpose.\n2. Insufficient capacity/skill within IT.\n3. Reliance on stability of ICT infrastructure.",
    category: "Technical",
    grossL: 3,
    grossI: 4,
    response: "Reduce",
    owner: "Richard",
    controls:
      "Cloud migration project.\nRobust backup arrangements.\nEnhanced antivirus/cyber security.",
    residualL: 2,
    residualI: 4,
    appetite: "Cautious",
    furtherAction:
      "Review data storage/hosting arrangements.\nCompletion of cloud migration.",
    status: "Open",
    dueDate: "2026-06-30",
    escalated: false,
    grossImpact: 50002,
    grossProb: 0.6,
    residualImpact: 50002,
    residualProb: 0.4,
  },
  {
    id: "PR_0008",
    projectId: "P001",
    programmeId: "PROG-001",
    project: "P001 – Bermondsey Estate",
    workstream: "Corporate Risk",
    kri: "Supply Chain & Safety Performance KRI",
    dateAdded: "2026-01-20",
    title: "IT Security Failure",
    desc: "Failure of IT Security leading to potential corruption, loss of data, or loss of systems.",
    cause:
      "1. Cyber attack or intrusion.\n2. GDPR non-compliance.\n3. Failure to manage sensitive information assets.",
    category: "Technical",
    grossL: 4,
    grossI: 5,
    response: "Reduce",
    owner: "Zoe",
    controls:
      "SOC implemented for proactive monitoring.\nGDPR training programme.\nRegular Penetration Testing.\nPatch updates regularly undertaken.",
    residualL: 3,
    residualI: 5,
    appetite: "Averse",
    furtherAction:
      "Review AI Policy.\nCyber Assessment Framework Stage 1 complete October 2025.",
    status: "Open",
    dueDate: "2026-10-31",
    escalated: true,
    grossImpact: 50003,
    grossProb: 0.8,
    residualImpact: 50003,
    residualProb: 0.6,
  },
  {
    id: "PR_0009",
    projectId: "P001",
    programmeId: "PROG-001",
    project: "P001 – Bermondsey Estate",
    workstream: "Corporate Risk",
    kri: "Programme Delivery Excellence KRI",
    dateAdded: "2025-12-01",
    title:
      "Failure to maintain robust Business Continuity and Emergency Planning",
    desc: "Failure to maintain robust Business Continuity and Emergency Planning arrangements.",
    cause:
      "1. Insufficient Emergency Planning structure.\n2. Inadequate partnership collaboration.\n3. Lack of testing/exercising of plans.",
    category: "Reputational",
    grossL: 3,
    grossI: 4,
    response: "Reduce",
    owner: "Margaret",
    controls:
      "Business Continuity plans in place at service level.\nOn-call rota for Emergency Management.\nOngoing training and testing programme.",
    residualL: 3,
    residualI: 3,
    appetite: "Cautious",
    furtherAction:
      "Learning from corporate testing embedded into review of BCP plans.",
    status: "Managed",
    dueDate: "2026-05-31",
    escalated: false,
    grossImpact: 50004,
    grossProb: 0.6,
    residualImpact: 50004,
    residualProb: 0.6,
  },
  {
    id: "PR_0010",
    projectId: "P001",
    programmeId: "PROG-001",
    project: "P001 – Bermondsey Estate",
    workstream: "Corporate Risk",
    kri: "Resource & Capability Adequacy KRI",
    dateAdded: "2026-02-05",
    title: "Failure to deliver effective Children's services",
    desc: "Unable to deliver an effective children's service to fulfil statutory obligations in safeguarding.",
    cause:
      "1. Recruitment and retention challenges.\n2. Budget pressures affecting service delivery.",
    category: "Legal / Regulatory",
    grossL: 3,
    grossI: 5,
    response: "Reduce",
    owner: "Zoe",
    controls:
      "Multi Agency Bromley Children's Safeguarding Partnership.\nDedicated HR recruitment programme.\nQuality Assurance Audit Programme.",
    residualL: 2,
    residualI: 5,
    appetite: "Averse",
    furtherAction:
      "Robust audit cycle in place.\nDemand Management forecasts informing MTFS.",
    status: "Open",
    dueDate: "2026-12-31",
    escalated: true,
    grossImpact: 50005,
    grossProb: 0.6,
    residualImpact: 50005,
    residualProb: 0.4,
  },
  {
    id: "PR_0011",
    projectId: "P001",
    programmeId: "PROG-001",
    project: "P001 – Bermondsey Estate",
    workstream: "Corporate Risk",
    kri: "Strategic Objectives & Adaptability KRI",
    dateAdded: "2026-01-20",
    title: "Temporary Accommodation volume and budget pressures",
    desc: "Inability to effectively manage homelessness volume and placements costs.",
    cause:
      "1. Subsidy freeze.\n2. Rising cost of placements.\n3. Reduction in affordable housing supply.",
    category: "Strategic",
    grossL: 5,
    grossI: 5,
    response: "Reduce",
    owner: "Director of Housing",
    controls:
      "Focus on prevention and diversion.\nHomelessness Strategy implementation.\nAcquisition of More Homes Bromley properties.",
    residualL: 5,
    residualI: 4,
    appetite: "Minimal",
    furtherAction:
      "Approval to progress with 3 housing sites.\nProgress counter fraud work on TA properties.",
    status: "Open",
    dueDate: "2026-09-30",
    escalated: true,
    grossImpact: 50006,
    grossProb: 1.0,
    residualImpact: 50006,
    residualProb: 1.0,
  },
  {
    id: "PR_KRI_F01",
    projectId: "P001",
    programmeId: "PROG-001",
    project: "P001 – Bermondsey Estate",
    workstream: "Finance",
    kri: "Programme Financial Sustainability KRI",
    dateAdded: "2026-03-01",
    title: "Programme Financial Sustainability Pressure",
    desc: "Financial risk score at 63% due to high contractor claims and budget pressures.",
    cause:
      "12/54 schemes showing budget pressure; £2.3M contractor claims; £15M GLA grant at risk; Sales income £8M below forecast.",
    category: "Finance / Financial",
    grossL: 4,
    grossI: 5,
    response: "Reduce",
    owner: "Hemali",
    controls:
      "Budget control board; Regular funding reviews; Market monitoring.",
    residualL: 3,
    residualI: 4,
    appetite: "Cautious",
    furtherAction:
      "Review sales strategy for major schemes; Negotiate GLA milestones.",
    status: "Open",
    dueDate: "2026-06-30",
    escalated: true,
    grossImpact: 2300000,
    grossProb: 0.8,
    residualImpact: 1200000,
    residualProb: 0.6,
  },
  {
    id: "PR_KRI_RS01",
    projectId: "P001",
    programmeId: "PROG-001",
    project: "P001 – Bermondsey Estate",
    workstream: "Resourcing",
    kri: "Resource & Capability Adequacy KRI",
    dateAdded: "2026-03-01",
    title: "Resource & Capability Constraints",
    desc: "Resource adequacy score at 62% due to vacancies and skill gaps.",
    cause:
      "15 vacant posts; Fire safety expertise gap affecting 8 schemes; 4 key managers at departure risk; 6 senior recruitment failures.",
    category: "Operational",
    grossL: 4,
    grossI: 4,
    response: "Reduce",
    owner: "Zoe",
    controls: "Human resource planning; Specialist skill procurement.",
    residualL: 3,
    residualI: 3,
    appetite: "Minimal",
    furtherAction:
      "Accelerate recruitment for fire safety roles; Implement retention plan for key managers.",
    status: "Open",
    dueDate: "2026-04-30",
    escalated: false,
    grossImpact: 500000,
    grossProb: 0.7,
    residualImpact: 200000,
    residualProb: 0.5,
  },
  {
    id: "PR_KRI_R01",
    projectId: "P001",
    programmeId: "PROG-001",
    project: "P001 – Bermondsey Estate",
    workstream: "Building Safety",
    kri: "Building Control Safety Compliance KRI",
    dateAdded: "2026-03-01",
    title: "Regulatory Compliance & Building Control Risks",
    desc: "Compliance score at 59% (Red) due to significant BC delays and fire safety rejections.",
    cause:
      "18 schemes experiencing BC delays; LFB issues on 6 schemes; Lightning protection gaps on 7 buildings; 9 schemes at Gateway risk.",
    category: "Building Safety",
    grossL: 5,
    grossI: 5,
    response: "Reduce",
    owner: "Osama",
    controls:
      "BSR liaison; Quality assurance cycles; Regular safety inspections.",
    residualL: 4,
    residualI: 4,
    appetite: "Averse",
    furtherAction:
      "Priority review of Gateway submissions; Rectify lightning protection gaps.",
    status: "Open",
    dueDate: "2026-05-31",
    escalated: true,
    grossImpact: 1000000,
    grossProb: 0.9,
    residualImpact: 600000,
    residualProb: 0.7,
  },
  {
    id: "PR_KRI_P01",
    projectId: "P006",
    programmeId: "PROG-001",
    project: "P006 – Canada Water HRB",
    workstream: "Programme Delivery",
    kri: "Programme Delivery Excellence KRI",
    dateAdded: "2026-03-01",
    title: "Programme Delivery Milestone Slips",
    desc: "Delivery score at 68% (Amber) due to planning delays and construction underperformance.",
    cause:
      "15% of milestones slipped by >4 weeks; Construction delays on 12 projects; Planning appeals on 3 major schemes; Quality audit failures on 5 buildings.",
    category: "Operational",
    grossL: 4,
    grossI: 4,
    response: "Reduce",
    owner: "Margaret",
    controls:
      "Weekly delivery board; Tier 1 contractor monthly reviews; Enhanced QA monitoring.",
    residualL: 3,
    residualI: 4,
    appetite: "Cautious",
    furtherAction:
      "Recovery plans requested from non-performing contractors; Review planning strategy with counsel.",
    status: "Open",
    dueDate: "2026-07-31",
    escalated: false,
    grossImpact: 750000,
    grossProb: 0.7,
    residualImpact: 350000,
    residualProb: 0.5,
  },
  {
    id: "PR_KRI_C01",
    projectId: "P001",
    programmeId: "PROG-001",
    project: "P001 – Bermondsey Estate",
    workstream: "Stakeholder",
    kri: "Supply Chain & Safety Performance KRI",
    dateAdded: "2026-03-01",
    title: "Supply Chain Instability & Safety Risks",
    desc: "Supply chain score at 71% (Amber) following contractor solvency concerns.",
    cause:
      "3 contractors identified with high risk credit scores; 12% increase in safety incidents; Long lead times for structural steel; Quality concerns on window packages.",
    category: "Reputational",
    grossL: 4,
    grossI: 5,
    response: "Reduce",
    owner: "Zoe",
    controls:
      "Financial standing monitoring; Independent safety audits; Supply chain diversification.",
    residualL: 3,
    residualI: 4,
    appetite: "Minimal",
    furtherAction:
      "Due diligence on alternative supply routes; Intensive safety training for sub-contractors.",
    status: "Open",
    dueDate: "2026-06-30",
    escalated: true,
    grossImpact: 1200000,
    grossProb: 0.6,
    residualImpact: 600000,
    residualProb: 0.5,
  },
  {
    id: "PR_KRI_T01",
    projectId: "P001",
    programmeId: "PROG-001",
    project: "P001 – Bermondsey Estate",
    workstream: "Technical",
    kri: "Technical Delivery & Infrastructure KRI",
    dateAdded: "2026-03-01",
    title: "Technical Integration & Infrastructure Delays",
    desc: "Technical score at 65% (Amber) due to utility connection bottlenecks.",
    cause:
      "Significant delays in UKPN/Thames Water connections; Design integration errors on 4 HRBs; Failure to meet sustainability targets on 2 schemes.",
    category: "Technical",
    grossL: 3,
    grossI: 4,
    response: "Reduce",
    owner: "Richard",
    controls:
      "Utility liaison officer; Technical design review gateway; Sustainability audit programme.",
    residualL: 2,
    residualI: 4,
    appetite: "Cautious",
    furtherAction:
      "Executive escalation to utility providers; Technical workshops for complex HRB designs.",
    status: "Open",
    dueDate: "2026-08-31",
    escalated: false,
    grossImpact: 400000,
    grossProb: 0.7,
    residualImpact: 150000,
    residualProb: 0.5,
  },
].map((r) => {
  const gR = rr(r.grossL, r.grossI);
  const cR = rr(r.residualL, r.residualI);
  const gALE = (r.grossImpact || 0) * (r.grossProb || 0);
  const rALE = (r.residualImpact || 0) * (r.residualProb || 0);
  return {
    ...r,
    grossRating: gR,
    residualRating: cR,
    grossALE: gALE,
    residualALE: rALE,
    riskReduction: gALE - rALE,
    riskReductionPct: gR > 0 ? Math.round((1 - cR / gR) * 100) : 0,
  };
});

export const SEED_ISSUES = [
  {
    id: "PI-0001",
    projectId: "P001",
    programmeId: "PROG-001",
    linkedRisk: "",
    dateAdded: "2026-02-28",
    desc: "Lack of consistency when collating and storing maintenance and components data, warranties, True Compliance data etc. for schemes in the team",
    impact:
      "Creates risk of non-compliance with Golden Thread obligations and RSH inspection findings.",
    owner: "Data Manager",
    priority: 1,
    severity: 1,
    response: "Resolve",
    responsDesc:
      "True Compliance implementation ongoing. Fire safety case folder created as standard in project folder structures. Apex discontinued, moving to True Compliance.",
    controlOwner: "Head of Asset Management",
    progress:
      "Mar26: True Compliance implementation ongoing.\nJan26: Fire safety case folder created as standard in project folder structures. Apex discontinued.\nJul25: Work underway to rectify for a number of schemes as part of RSH inspection prep.",
    dateUpdated: "2026-02-28",
    deadline: "2026-06-30",
    status: "5. Unassigned",
    lessonsLearnt: "Y",
    project: "P001 – Bermondsey Estate",
  },
  {
    id: "PI-0002",
    projectId: "P001",
    programmeId: "PROG-001",
    linkedRisk: "R-002",
    dateAdded: "2026-01-25",
    desc: "Gateway 2 fire strategy not locked — architect and fire engineer disagreeing on compartmentation approach.",
    impact:
      "Blocks Gateway 2 submission. BSR will not approve without resolved fire strategy.",
    owner: "Project Director",
    priority: 4,
    severity: 5,
    response: "Escalate",
    responsDesc:
      "Fire engineer peer review commissioned. Pre-submission meeting with BSR planned.",
    controlOwner: "Project Director",
    progress:
      "Feb26: Peer review appointed.\nJan26: Issue first identified at design review.",
    dateUpdated: "2026-02-15",
    deadline: "2026-03-31",
    status: "2. Escalated",
    lessonsLearnt: "Y",
    project: "P001 – Bermondsey Estate",
  },
  {
    id: "PI-0003",
    projectId: "P005",
    programmeId: "PROG-001",
    linkedRisk: "R-006",
    dateAdded: "2026-02-01",
    desc: "Homes England IMS system not updated with latest programme dates — start on site claim at risk.",
    impact:
      "Grant claim cannot be submitted without IMS update. Clawback risk if milestones missed.",
    owner: "Development Finance Manager",
    priority: 4,
    severity: 4,
    response: "Resolve",
    responsDesc: "IMS updated and confirmed with Homes England grant manager.",
    controlOwner: "Head of Development Finance",
    progress: "Feb26: IMS updated — confirmed by HE.",
    dateUpdated: "2026-02-20",
    deadline: "2026-03-15",
    status: "4. Resolved",
    lessonsLearnt: "N",
    project: "P005 – Surrey Quays Phase 2",
  },
  {
    id: "PI-0004",
    projectId: "P009",
    programmeId: "PROG-001",
    linkedRisk: "R-010",
    dateAdded: "2026-02-18",
    desc: "12 damp and mould complaints logged in February 2026 — response times tracking at 18 days average, exceeding 14-day Awaab's Law requirement.",
    impact:
      "Statutory breach of Section 10A (Awaab's Law). RSH inspection risk.",
    owner: "Head of Repairs",
    priority: 5,
    severity: 5,
    response: "Escalate",
    responsDesc:
      "Emergency contractor resource commissioned. Daily triage call established.",
    controlOwner: "Director of Housing",
    progress:
      "Feb26: Emergency resource commissioned. Triage call daily.\n18 Feb: Issue escalated to Director of Housing.",
    dateUpdated: "2026-02-22",
    deadline: "2026-03-07",
    status: "2. Escalated",
    lessonsLearnt: "Y",
    project: "P009 – Herne Hill Capital Works",
  },
  {
    id: "PI-0005",
    projectId: "P001",
    programmeId: "PROG-001",
    linkedRisk: "R-001",
    dateAdded: "2026-02-10",
    desc: "Q3 budget monitoring showing overspend of £340k in homelessness service — no mitigation plan submitted by service Director.",
    impact:
      "Full year overspend likely to exceed £1.2M unless mitigated. S114 notice risk increases.",
    owner: "Strategic Director – Finance",
    priority: 5,
    severity: 5,
    response: "Resolve",
    responsDesc:
      "Chief Executive chaired emergency budget meeting 14 Feb. Mitigation plan required by 28 Feb.",
    controlOwner: "Chief Executive",
    progress:
      "28 Feb: Mitigation plan received and under review.\n14 Feb: Emergency meeting chaired by CEO.",
    dateUpdated: "2026-02-28",
    deadline: "2026-03-31",
    status: "3. Implementing Fix",
    lessonsLearnt: "Y",
    project: "P001 – Bermondsey Estate",
  },
];
