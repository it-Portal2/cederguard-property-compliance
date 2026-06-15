// Static demo dataset builders behind "Load Demo Data". Pure data (no React/
// store/API). buildDemoProgramme() = a programme with child projects;
// buildDemoProject() = a standalone project. All ids use the 'cgdemo-' prefix.

import type {
  Programme,
  Project,
  RiskItem,
  IssueItem,
  ComplianceItem,
} from '../../store/useStore';
import { SEED_RISKS, SEED_ISSUES, SEED_KRIS, type KRI } from '../../data/riskData';
import { COMPLIANCE_ITEMS } from '../../data/complianceData';
import { DEMO_ID_PREFIX } from '../demoMode';

// ── Stable demo ids ────────────────────────────────────────────────────────
export const DEMO_PROGRAMME_ID = `${DEMO_ID_PREFIX}prog-1`;
export const DEMO_PROGRAMME_CHILD_IDS = [
  `${DEMO_ID_PREFIX}proj-1`,
  `${DEMO_ID_PREFIX}proj-2`,
];
export const DEMO_PROJECT_ID = `${DEMO_ID_PREFIX}proj-solo`;

// Display names (declared up-front — referenced by the questionnaire fixtures below).
const PROGRAMME_NAME = 'North London Decent Homes Programme';
const CHILD_NAMES = ['Maple Gardens Phase 2', 'Beech Rise Tower'];
const SOLO_NAME = 'Elm Street Retrofit';

/** The shape every loader injects into the store. */
export interface DemoBundle {
  programme: Programme | null;
  projects: Project[];
  risks: RiskItem[];
  issues: IssueItem[];
  kris: KRI[];
  complianceItems: ComplianceItem[];
  complianceAnalysis: any | null;
  projectInfo: any;
  lastAnalysisResults: any | null;
}

// Deterministic index-based spreads (no randomness → reproducible fixtures).
function complianceStatusFor(i: number): string {
  return i % 5 === 0 ? 'pending' : 'applicable';
}

// Raw COMPLIANCE_ITEMS have no `stage`; give a realistic spread so the KPI
// (Live/Archived = complete) and velocity chart show progress.
function complianceStageFor(i: number): string {
  const m = i % 10;
  if (m <= 3) return 'Live'; // 40% complete
  if (m === 4) return 'Archived'; // 10% complete (archived)
  if (m <= 6) return 'In Progress'; // 20% in progress
  if (m <= 8) return 'Information Gap'; // 20% not started
  return 'Risk Identified'; // 10% flagged
}

// ISO date `n` days before now (computed at load time → always recent).
function daysAgoISO(n: number): string {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() - n);
  return d.toISOString();
}

// Deterministic sine-hash in [0,1) — scatters items unevenly so the velocity
// bars get a varied skyline (no Math.random → reproducible).
function pseudoRandom(seed: number): number {
  const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
}

function complianceDayOffset(i: number): number {
  return Math.floor(pseudoRandom(i) * 45);
}

// `completedAt` (verification day) — only Live/Archived items carry it, matching
// how real items get it from store.updateComplianceItem. Drives the velocity chart.
function completedAtFor(i: number, stage: string): string | undefined {
  if (stage === 'Live' || stage === 'Archived') {
    return daysAgoISO(complianceDayOffset(i));
  }
  return undefined;
}

// Static "AI compliance analysis" in the shape AnalysisSummary reads.
function buildComplianceAnalysis(itemIds: string[]): any {
  return {
    category: 'A',
    summary:
      'This scheme is a Higher-Risk Building under the Building Safety Act 2022 — subject to the full Gateway regime, a digital Golden Thread and Accountable Person duties. The Fire Safety Order, CDM 2015, planning consent and the RSH consumer standards also apply, alongside SHDF/PAS 2035 retrofit obligations.',
    regulatoryAuthorities: [
      'Building Safety Regulator',
      'Local Planning Authority',
      'HSE',
      'Fire Authority',
      'Regulator of Social Housing',
    ],
    requiredApprovals: [
      'Planning Permission',
      'Gateway 2 Approval',
      'Gateway 3 / Completion',
      'Building Control Approval',
    ],
    criticalActions: [
      'Register the Accountable Person with the BSR before occupation',
      'Establish and maintain the digital Golden Thread',
      'Lock the fire strategy at design freeze',
      'Submit the Gateway 2 pack before start on site',
    ],
    keyRisks: [
      'HRB Gateway approval delays',
      'Fire-strategy sign-off',
      'Golden Thread completeness',
      'Resident engagement obligations',
    ],
    applicableIds: itemIds,
    conditionalIds: [],
    excludedIds: [],
  };
}

// Shared questionnaire metadata (read by ComplianceSetup + determineProjectCategory).
// `hrb: true` forces Category A (Higher-Risk) — the richest demo profile.
const DEMO_PROGRAMME_INFO: any = {
  name: PROGRAMME_NAME,
  type: 'Decent Homes / Retrofit',
  loc: 'North London — 3 boroughs',
  scope:
    'Bring 1,240 homes to the Decent Homes Standard and EPC C while maintaining building-safety compliance.',
  value: '£5m–£20 million',
  ap: 'Director of Housing Delivery',
  hrb: true,
  hasHRB: 'Yes',
  hasLeasehold: 'Yes',
  completion: '2030-03',
  notes: 'Demo programme — illustrative data only.',
  // Programme questionnaire answers (q1_1 … q10_2).
  q1_1: 'No', q1_2: 'Yes', q1_3: 'Yes', q1_4: 'Yes', q1_5: 'Yes', q1_6: 'Yes',
  q2_tenures: ['Social Rent', 'Affordable Rent', 'Shared Ownership', 'Leasehold'],
  q2_1: 'Yes', q2_2: 'Yes', q2_3: 'Yes', q2_4: 'Yes', q2_5: 'No',
  q3_1: 'Yes', q3_2: 'Yes', q3_3: 'Yes', q3_4: 'Yes', q3_5: 'Yes', q3_6: 'Yes',
  q4_1: 'Yes', q4_2: 'Yes', q4_3: 'Yes', q4_4: 'Yes',
  q5_1: 'Yes', q5_2: 'Yes', q5_3: 'No', q5_4: 'Yes', q5_5: 'Yes', q5_6: 'Yes',
  q6_1: 'No', q6_2: 'Yes', q6_3: 'Yes', q6_4: 'Yes', q6_5: 'No',
  q7_1: 'Yes', q7_2: 'No', q7_3: 'No', q7_4: 'No',
  q8_1: 'Yes', q8_2: 'No', q8_3: 'No', q8_4: 'Yes', q8_5: 'Yes',
  q9_1: 'Yes', q9_2: 'Yes', q9_3: 'Yes', q9_4: 'Yes',
  q10_1: 'No', q10_2: 'Yes',
};

const DEMO_PROJECT_INFO: any = {
  name: SOLO_NAME,
  type: 'Decarbonisation / energy efficiency retrofit',
  loc: 'Camden',
  scope: 'Whole-house retrofit + cladding remediation of an occupied 84-unit HRB.',
  value: '£5m–£20 million',
  ap: 'Project Director',
  hrb: true,
  hasHRB: 'Yes',
  hasLeasehold: 'Yes',
  completion: '2027-09',
  notes: 'Demo project — illustrative data only.',
  // Project questionnaire answers (p1_* … p10_*).
  p1_type: 'Decarbonisation / energy efficiency retrofit',
  p1_client: 'Registered Provider / Housing Association',
  p1_units: '51–100 units',
  p1_value: '£5m–£20 million',
  p1_occupied: 'Yes', p1_phased: 'Yes', p1_land: 'No',
  p2_height: '18–30 metres',
  p2_storeys: '8–15 storeys',
  p2_use: ['Residential — general needs'],
  p2_hrb: 'Yes', p2_listed: 'No', p2_conservation: 'No', p2_cladding: 'Yes', p2_lifts: 'Yes',
  p3_g2: 'Yes', p3_g3: 'Yes', p3_golden: 'Yes', p3_ap: 'Yes', p3_bsm: 'Yes', p3_safety_case: 'Yes', p3_residents: 'Yes',
  p4_notifiable: 'Yes', p4_pd: 'Yes', p4_pc: 'Yes', p4_cpp: 'Yes', p4_demolition: 'No', p4_structural: 'Yes', p4_hazmat: 'Yes', p4_temporary: 'Yes',
  p5_s20: 'Yes', p5_decant: 'No', p5_vulnerable: 'Yes', p5_supported: 'No', p5_consultation: 'Yes', p5_party_wall: 'No',
  p6_shdf: 'Yes', p6_pas: 'Yes', p6_epc: 'D', p6_target_epc: 'C',
  p6_measures: ['External wall insulation', 'Loft / roof insulation', 'Heat pump installation', 'Solar PV', 'Ventilation (MVHR)'],
  p6_moisture: 'Yes', p6_pv: 'Yes',
  p7_route: 'Design and build', p7_framework: 'Yes', p7_threshold: 'Yes', p7_jv: 'No', p7_form: 'JCT Design and Build', p7_bond: 'Yes', p7_sv: 'Yes',
  p8_pp: 'Yes', p8_pd: 'No', p8_change_use: 'No', p8_s106: 'No', p8_bng: 'No', p8_flood: 'No', p8_eia: 'No',
  p9_brownfield: 'Yes', p9_contamination: 'No', p9_ecology: 'No', p9_trees: 'No', p9_groundwater: 'No', p9_noise: 'Yes', p9_utilities: 'No',
  p10_welfare: 'Yes', p10_fire: 'Yes', p10_emergency: 'Yes', p10_traffic: 'Yes', p10_safe_systems: 'Yes', p10_insurance: 'Yes',
};

// ── Programme fixture ───────────────────────────────────────────────────────

function demoProgramme(): Programme {
  return {
    id: DEMO_PROGRAMME_ID,
    reference: 'NLDH-2026',
    name: PROGRAMME_NAME,
    type: 'Decent Homes / Retrofit',
    sro: 'Margaret Whitfield',
    pm: 'Daniel Osei',
    sponsor: 'Director of Housing Delivery',
    boardComposition: 'Programme Board · Delivery Board · Assurance Panel',
    reportingCycle: 'Monthly',
    governanceFramework: 'Four-tier programme governance model',
    strategicObjectives:
      'Bring 100% of in-scope homes to Decent Homes Standard and EPC C by 2030 while maintaining building-safety compliance.',
    geographicScope: 'North London — 3 boroughs',
    programmeStartDate: '2026-01-06',
    programmeEndDate: '2030-03-31',
    createdBy: 'Demo data',
    totalProjects: DEMO_PROGRAMME_CHILD_IDS.length,
    totalUnits: '1,240',
    totalValue: '48000000',
    totalGrant: '12500000',
    contingencyPct: '5',
    fundingSources: 'Social Housing Decarbonisation Fund · HRA · Grant',
    resourceConstraints:
      'Single delivery team shared across schemes; specialist fire-engineering capacity limited.',
    rshStandards: ['Safety & Quality Standard', 'Transparency Standard'],
    regulatoryObligations: ['Building Safety Act 2022', 'Awaab’s Law', 'CDM 2015'],
    hrbScheme: 'Yes',
    leaseholderStatus: 'Mixed tenure',
    knownStrategicRisks:
      'Fire-strategy sign-off delays, grant-funding clawback risk, supply-chain capacity.',
    notes: 'Demo programme — illustrative data only.',
    status: 'Active',
    isPublished: true,
    complianceSetupDone: true,
    riskSetupDone: true,
    aiRiskDiscoveryDone: true,
    deliveryTeamDone: true,
    setupProgress: 100,
    overallRAG: 'Amber',
    decisionDeliveryLevel: 'Programme',
    financialThreshold: '£5m+',
    riskRegulatoryProfile: 'Building Safety / Compliance-critical',
    decisionAuthority: 'Strategic Director',
  };
}

function demoProgrammeChildren(): Project[] {
  return DEMO_PROGRAMME_CHILD_IDS.map((id, i) => ({
    id,
    name: CHILD_NAMES[i] ?? `Demo Scheme ${i + 1}`,
    type: 'Residential refurbishment',
    loc: 'North London',
    units: i === 0 ? '620' : '620',
    client: PROGRAMME_NAME,
    programmeId: DEMO_PROGRAMME_ID,
    status: 'Active',
    isPublished: true,
    complianceSetupDone: true,
    riskSetupDone: true,
    aiRiskDiscoveryDone: true,
    setupProgress: 100,
    rag: i === 0 ? 'Amber' : 'Green',
    riba: '4',
    isHRB: i === 0,
    decisionDeliveryLevel: 'Project',
    financialThreshold: '£5m+',
    riskRegulatoryProfile: 'Building Safety / Compliance-critical',
    decisionAuthority: 'Strategic Director',
  }));
}

export function buildDemoProgramme(): DemoBundle {
  const programme = demoProgramme();
  const projects = demoProgrammeChildren();

  // Stamp every risk to the programme (so programme-scope filters surface it)
  // AND round-robin a child projectId (so drilling into a child also works).
  const risks: RiskItem[] = SEED_RISKS.map((r, i) => {
    const childId = DEMO_PROGRAMME_CHILD_IDS[i % DEMO_PROGRAMME_CHILD_IDS.length];
    const isProgLevel = i % 3 === 0;
    return {
      ...r,
      projectId: childId,
      programmeId: DEMO_PROGRAMME_ID,
      project: isProgLevel ? PROGRAMME_NAME : (CHILD_NAMES[i % CHILD_NAMES.length] ?? PROGRAMME_NAME),
      isProgrammeLevel: isProgLevel,
      // Recent spread dates (SEED dates are months old) so sparklines have shape.
      dateAdded: daysAgoISO((i * 7) % 60),
    };
  });

  const issues: IssueItem[] = SEED_ISSUES.map((it, i) => {
    const childId = DEMO_PROGRAMME_CHILD_IDS[i % DEMO_PROGRAMME_CHILD_IDS.length];
    return {
      ...it,
      projectId: childId,
      programmeId: DEMO_PROGRAMME_ID,
      project: CHILD_NAMES[i % CHILD_NAMES.length] ?? PROGRAMME_NAME,
      dateAdded: daysAgoISO((i * 9) % 45),
    };
  });

  const complianceItems: ComplianceItem[] = COMPLIANCE_ITEMS.map((c, i) => {
    const stage = complianceStageFor(i);
    return {
      ...c,
      projectId: DEMO_PROGRAMME_CHILD_IDS[i % DEMO_PROGRAMME_CHILD_IDS.length],
      programmeId: DEMO_PROGRAMME_ID,
      status: complianceStatusFor(i),
      stage,
      dateAdded: daysAgoISO(complianceDayOffset(i)),
      completedAt: completedAtFor(i, stage),
      isProgrammeLevel: true,
    };
  });

  const complianceAnalysis = buildComplianceAnalysis(
    complianceItems.filter((c) => c.status === 'applicable').map((c) => c.id),
  );

  return {
    programme,
    projects,
    risks,
    issues,
    kris: SEED_KRIS,
    complianceItems,
    complianceAnalysis,
    projectInfo: { ...DEMO_PROGRAMME_INFO },
    lastAnalysisResults: complianceAnalysis,
  };
}

// ── Standalone project fixture (independent — NOT a child of the programme) ──

function demoSoloProject(): Project {
  return {
    id: DEMO_PROJECT_ID,
    name: SOLO_NAME,
    type: 'Whole-house retrofit',
    loc: 'Camden',
    units: '84',
    client: 'Demo Housing Association',
    // NO programmeId — this is a standalone project.
    status: 'Active',
    isPublished: true,
    complianceSetupDone: true,
    riskSetupDone: true,
    aiRiskDiscoveryDone: true,
    setupProgress: 100,
    rag: 'Amber',
    riba: '5',
    isHRB: false,
    contractValue: '6200000',
    decisionDeliveryLevel: 'Project',
    financialThreshold: '£5m+',
    riskRegulatoryProfile: 'Building Safety / Compliance-critical',
    decisionAuthority: 'Delegated Officer',
  };
}

export function buildDemoProject(): DemoBundle {
  const project = demoSoloProject();

  const risks: RiskItem[] = SEED_RISKS.map((r, i) => ({
    ...r,
    projectId: DEMO_PROJECT_ID,
    programmeId: undefined,
    project: SOLO_NAME,
    isProgrammeLevel: false,
    escalated: false,
    dateAdded: daysAgoISO((i * 7) % 60),
  }));

  const issues: IssueItem[] = SEED_ISSUES.map((it, i) => ({
    ...it,
    projectId: DEMO_PROJECT_ID,
    programmeId: undefined,
    project: SOLO_NAME,
    dateAdded: daysAgoISO((i * 9) % 45),
  }));

  const complianceItems: ComplianceItem[] = COMPLIANCE_ITEMS.map((c, i) => {
    const stage = complianceStageFor(i);
    return {
      ...c,
      projectId: DEMO_PROJECT_ID,
      programmeId: undefined,
      status: complianceStatusFor(i),
      stage,
      dateAdded: daysAgoISO(complianceDayOffset(i)),
      completedAt: completedAtFor(i, stage),
      isProgrammeLevel: false,
    };
  });

  const complianceAnalysis = buildComplianceAnalysis(
    complianceItems.filter((c) => c.status === 'applicable').map((c) => c.id),
  );

  return {
    programme: null,
    projects: [project],
    risks,
    issues,
    kris: SEED_KRIS,
    complianceItems,
    complianceAnalysis,
    projectInfo: { ...DEMO_PROJECT_INFO },
    lastAnalysisResults: complianceAnalysis,
  };
}
