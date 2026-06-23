import { create } from "zustand";
import { COMPLIANCE_ITEMS } from "../data/complianceData";
import { SEED_RISKS, SEED_ISSUES, SEED_KRIS, type KRI } from "../data/riskData";
import { calculateMatrixScore } from "../data/riskScoringMatrix";
import toast from "react-hot-toast";
// Demo mode (client-only; localStorage, never the DB).
import {
  isDemoId,
  isDemoActive,
  setDemoFlag,
  clearDemoFlag,
  getDemoFlag,
} from "../lib/demoMode";
import {
  buildDemoProgramme,
  buildDemoProject,
  DEMO_PROJECT_ID,
  type DemoBundle,
} from "../lib/demoData";

// surface Severe-escalation notification toast when the server reports
// it fired Strategic Director alerts. Called from every risks-save path
// (addRisk, updateRisk, approveRisk, dismissRisk, etc.) — the server only
// returns `severeNotified` when an Impact-5 transition was actually detected.
function notifySevereEscalation(
  response: { severeNotified?: { count: number; recipientCount: number } } | undefined,
) {
  const s = response?.severeNotified;
  if (!s || s.count <= 0) return;
  const recipientLabel = s.recipientCount === 1 ? "Strategic Director" : "Strategic Directors";
  const riskLabel = s.count === 1 ? "risk" : "risks";
  if (s.recipientCount > 0) {
    toast.success(
      `Severe ${riskLabel} flagged — ${recipientLabel} notified (${s.recipientCount}).`,
      { duration: 5000 },
    );
  } else {
    toast.success(
      `Severe ${riskLabel} flagged — no Strategic Director assigned; logged for review.`,
      { duration: 5000 },
    );
  }
}
export type { KRI };
import {
  getCategoryName,
  getWorkstreamName,
  getCategoryId,
  getWorkstreamId,
} from "../data/riskTaxonomy";
import { api } from "../lib/api";
import {
  type ValidationRecord,
  type ValidationSurface,
  validationKey,
} from "../lib/validation";
import { getGrossScore, getResidualScore } from "../lib/riskMetrics";
import { isAtLeastClientAdmin, isAtLeastProgrammeManager } from "../lib/roles";
import { generateId, isValidDateString } from "../lib/utils";
import type {
  ResourceScheme,
  ResourceAssumptions,
} from "../lib/resourcePlanner/types";
import {
  DEFAULT_RATE_CARD,
  DEFAULT_COMPLEXITY_MAP,
  DEFAULT_OVERHEAD_PCT,
  DEFAULT_LEAVE_PCT,
  FY_BASE_YEAR,
} from "../lib/resourcePlanner/constants";
import { horizonFromIndices } from "../lib/resourcePlanner/quarters";
import {
  normalizeScheme,
  schemeBoundaryIndices,
} from "../lib/resourcePlanner/compute";
import { authBridge } from "../lib/auth/authBridge";
import { enqueueBestEffort } from "./mutations";

/**
 * Check if a value looks like a valid category ID (starts with "cat-")
 */
const isValidCategoryIdFormat = (id: string): boolean => {
  return id.startsWith("cat-");
};

/**
 * Check if a value looks like a valid workstream ID (starts with "ws-")
 */
const isValidWorkstreamIdFormat = (id: string): boolean => {
  return id.startsWith("ws-");
};

/**
 * Normalize risk data to ensure both ID and name fields are populated.
 * Handles both ID-based (new) and name-only (legacy) risk data.
 * Also handles cases where names were incorrectly stored in ID fields.
 */
export const normalizeRisk = (risk: Partial<RiskItem>): Partial<RiskItem> => {
  const normalized = { ...risk };

  //  backfill (one-shot, idempotent): every risk's grossRating /
  // residualRating is recomputed from the calibrated 5×5 matrix
  // PDF + answer. Existing risks persisted under the
  // old `L × I` rule (e.g. L=1,I=2 → 2) recompute to matrix value (→ 3) on
  // first read. Second read is a no-op — the stored value already equals
  // the matrix value, so the override is identity.
  const gL = Number(normalized.grossL) || 0;
  const gI = Number(normalized.grossI) || 0;
  const rL = Number(normalized.residualL) || 0;
  const rI = Number(normalized.residualI) || 0;
  if (gL > 0 && gI > 0) {
    normalized.grossRating = calculateMatrixScore(gL, gI);
  }
  if (rL > 0 && rI > 0) {
    normalized.residualRating = calculateMatrixScore(rL, rI);
  }

  // Backfill ALE fields for legacy risks that were saved before ALE
  // computation existed. Uses the same formula as RiskModal at save time.
  if (!normalized.residualALE && normalized.residualImpact && normalized.residualProb) {
    const prob = normalized.residualProb > 1 ? normalized.residualProb / 100 : normalized.residualProb;
    normalized.residualALE = normalized.residualImpact * prob;
  }
  if (!normalized.grossALE && normalized.grossImpact && normalized.grossProb) {
    const prob = normalized.grossProb > 1 ? normalized.grossProb / 100 : normalized.grossProb;
    normalized.grossALE = normalized.grossImpact * prob;
  }

  // CASE 1: Check if categoryId exists but is actually a name (not a valid ID format)
  if (
    normalized.categoryId &&
    !isValidCategoryIdFormat(normalized.categoryId)
  ) {
    // The "ID" field contains a name - use it to resolve the proper ID
    const properId = getCategoryId(normalized.categoryId);
    // Only update if we got a valid ID back
    if (isValidCategoryIdFormat(properId)) {
      normalized.categoryId = properId;
    }
  }

  // CASE 2: Check if workstreamId exists but is actually a name
  if (
    normalized.workstreamId &&
    !isValidWorkstreamIdFormat(normalized.workstreamId)
  ) {
    const properId = getWorkstreamId(normalized.workstreamId);
    if (isValidWorkstreamIdFormat(properId)) {
      normalized.workstreamId = properId;
    }
  }

  // CASE 3: Has valid IDs, resolve names
  if (normalized.categoryId && isValidCategoryIdFormat(normalized.categoryId)) {
    normalized.category = getCategoryName(normalized.categoryId);
  }
  if (
    normalized.workstreamId &&
    isValidWorkstreamIdFormat(normalized.workstreamId)
  ) {
    normalized.workstream = getWorkstreamName(normalized.workstreamId);
  }

  // CASE 4: Has names but no valid IDs (legacy data)
  if (
    normalized.category &&
    (!normalized.categoryId || !isValidCategoryIdFormat(normalized.categoryId))
  ) {
    normalized.categoryId = getCategoryId(normalized.category);
  }
  if (
    normalized.workstream &&
    (!normalized.workstreamId ||
      !isValidWorkstreamIdFormat(normalized.workstreamId))
  ) {
    normalized.workstreamId = getWorkstreamId(normalized.workstream);
  }

  // Risk-to-Issue conversion engine backfill (idempotent). `dependencies`
  // defaults to an empty array. `probHistory` is seeded with ONE baseline
  // snapshot from the risk's current scores so the trend signal has a starting
  // point and fires on the very next re-score — rather than needing two future
  // edits to accumulate history. The baseline is dated from existing stable
  // fields (lastReviewDate → dateAdded), never "now", so repeated reads of an
  // un-resaved risk don't churn the date. A non-empty probHistory is left as-is.
  if (!Array.isArray(normalized.dependencies)) {
    normalized.dependencies = [];
  }
  if (!Array.isArray(normalized.probHistory) || normalized.probHistory.length === 0) {
    const gScore = getGrossScore(normalized);
    const rScore = getResidualScore(normalized);
    normalized.probHistory =
      gScore > 0 || rScore > 0
        ? [
            {
              date: normalized.lastReviewDate || normalized.dateAdded || "",
              grossScore: gScore,
              residualScore: rScore,
              residualProb: normalized.residualProb,
            },
          ]
        : [];
  }

  return normalized;
};

export interface MilestoneHistory {
  id: string;
  date: string;
  comment: string;
  updatedAt: string;
  updatedBy: string;
}

export interface TeamMember {
  id: string;
  name: string;
  role: string;
  email: string;
  phone?: string;
  organization?: string;
}

export interface ProjectInfo {
  name: string;
  type: string;
  loc: string;
  scope: string;
  orgtype: string;
  tenure: string;
  storeys: string;
  height: string;
  units: string;
  mixed: string;
  completion: string;
  funding: string;
  value: string;
  proc: string;
  warranty: string;
  leasehold: string;
  vulnerability: string;
  occupied: string;
  ap: string;
  bim: string;
  notes: string;
  chars: string[];
  programmeId?: string;
  riba?: string;
  employersAgent?: string;
  architect?: string;
  mainContractor?: string;
  startOnSite?: string;
  targetPC?: string;

  // Additional fields
  costCentreCode?: string;
  fundingStreams?: string[];
  numberOfUnits?: number;
  numberOfStoreys?: string;
  typeOfUnits?: string;
  bedroomsPerProperty?: string;
  [key: string]: any; // Support dynamic questionnaire IDs (q1_1, q2_1, etc.)
}

export interface ProgrammeMilestone {
  id: string;
  name: string;
  updatedBy: string;
  status: "In Progress" | "Completed" | "Delayed" | "Pending";
  category: string;
  owner?: string;
  evidence?: string;
  historicalUpdates: any[];
  isKey?: boolean;
  date?: string;
  stage?: string;
  description?: string;
  history?: any[];
}

export interface ComplianceItem {
  id: string;
  name?: string;
  status?: string;
  projectId?: string;
  programmeId?: string;
  [key: string]: any;
}

export interface RegulationItem {
  id?: string;
  cat: string;
  name: string;
  reg: string;
  risk: string;
  req: string;
  penalty: string;
  when: string;
  alerts: string;
  owners: string;
  process: string;
  evidence: string;
  status: string;
  tag: string;
  category: string;
  lastUpdated?: string;
  updates?: { id: string; date: string; content: string; author?: string }[];
}

export interface PricingConfig {
  firestore: {
    readsPer100k: number;
    writesPer100k: number;
    deletesPer100k: number;
    storagePerGBMonth: number;
    freeTierReadsPerDay: number;
    freeTierWritesPerDay: number;
    freeTierStorageGB: number;
  };
  gemini: {
    inputPer1kTokens: number;
    outputPer1kTokens: number;
    avgPromptTokens: number;
    avgResponseTokens: number;
    thinkingTokensEstimate: number;
  };
  vercel: {
    basePlanUSD: number;
    includedBandwidthGB: number;
    ovageBandwidthPerGB: number;
    includedFunctionMs: number;
    avgApiCallDurationMs: number;
    avgApiCallsPerUserPerDay: number;
    avgBandwidthPerUserGB: number;
  };
  firebaseStorage: {
    storagePerGBMonth: number;
    downloadPerGB: number;
    uploadOps100k: number;
    downloadOps100k: number;
    freeStorageGB: number;
    freeDownloadGBPerDay: number;
    avgDocSizeMB: number;
    avgDocsPerProjectPerYear: number;
  };
  support: {
    tier1AgentHourlyGBP: number;
    tier2EngineerHourlyGBP: number;
    avgTicketsPerClientMonthly: number;
    avgTicketMinutesTier1: number;
    avgEscalationRatePct: number;
    avgEscalationMinutes: number;
  };
  training: {
    trainerDayRateGBP: number;
    travelExpensesPerSessionGBP: number;
    initialOnboardingDays: number;
    annualRefresherDays: number;
    clientsPerCohort: number;
  };
  devOps: {
    seniorDevDayRateGBP: number;
    infraMaintenanceDaysPerYear: number;
    devDaysPerClientPerYear: number;
  };
  basePlatformFeeGBP: number;
  usdToGbp: number;
}

export interface Programme {
  id: string;
  reference: string;
  name: string;
  type: string;
  sro: string;
  pm: string;
  sponsor: string;
  boardComposition: string;
  reportingCycle: string;
  governanceFramework: string;
  strategicObjectives: string;
  geographicScope: string;
  programmeStartDate: string;
  programmeEndDate: string;
  createdBy: string;
  governanceStructure?: string;
  assuranceRegime?: string;
  boardMembers?: string[];
  riskAppetite?: string;
  programmeScale?: string;
  fundingStatus?: string;
  keyDependencies?: string[];
  criticalSuccessFactors?: string[];

  // Scale & Financials
  totalProjects: number | string;
  totalUnits: string;
  totalValue: string;
  totalGrant: string;
  contingencyPct: string;
  fundingSources: string;
  resourceConstraints: string;

  // Regulatory & Compliance
  rshStandards: string[];
  regulatoryObligations: string[];
  hrbScheme: string;
  leaseholderStatus: string;
  complianceReportingBody?: string;
  hasHRB?: string;
  hasLeasehold?: string;
  deliveryTeam?: TeamMember[];

  // Strategic Risk Context
  knownStrategicRisks: string;
  notes: string;
  status?: "Draft" | "Active" | "Completed";
  createdAt?: string;
  updatedAt?: string;

  // Persistent Progress Tracking
  complianceSetupDone?: boolean;
  riskSetupDone?: boolean;
  aiRiskDiscoveryDone?: boolean;
  deliveryTeamDone?: boolean;
  isPublished?: boolean;
  setupProgress?: number;

  // Governance Profile (.5 — standardised taxonomy that
  // mirrors the Programme Governance Framework's tiers + thresholds).
  // Linked: picking a value resolves to a matching body / authority band
  // in the live framework. Free-text legacy fields above (sro, sponsor,
  // governanceFramework, escalationRoute) are no longer rendered in the
  // Programme Setup form but kept in storage for legacy programmes.
  decisionDeliveryLevel?: 'Strategic' | 'Corporate' | 'Programme' | 'Project' | '';
  financialThreshold?: 'Under £100k' | '£100k – £500k' | '£500k – £5m' | '£5m+' | '';
  riskRegulatoryProfile?:
    | 'Building Safety / Compliance-critical'
    | 'Financial / Legal / Regulatory'
    | 'Standard'
    | '';
  decisionAuthority?:
    | 'Cabinet / Members'
    | 'Executive Team'
    | 'Strategic Director'
    | 'Delegated Officer'
    | '';

  // Extended fields used across the app
  overallRAG?: string;
  escalationRoute?: string;
  funders?: string[];
  milestones?: ProgrammeMilestone[];
  isArchived?: boolean;
  clientId?: string;
  userId?: string;
  creatorId?: string;

  // PM roster — explicit membership edited via invite flow or WorkspaceSettings "Manage programmes"
  assignedPMIds?: string[];

  // Metadata for Service Management Bar
  lastRiskRun?: string;
  lastComplianceRun?: string;
}

/**
 * A point-in-time snapshot of a risk's calibrated scores, used to detect a
 * rising probability/severity trend for the Risk-to-Issue conversion engine
 * (src/lib/riskConversion.ts). Seeded once from current scores by normalizeRisk
 * and appended to by updateRisk whenever likelihood/impact changes.
 */
export interface ProbSnapshot {
  date: string;
  grossScore: number;
  residualScore: number;
  residualProb?: number;
}

export interface RiskItem {
  id: string;
  projectId?: string;
  programmeId?: string;
  project: string;
  projectName?: string;
  workstream: string;
  workstreamId?: string; // NEW: ID-based reference
  kri: string;
  dateAdded: string;
  title: string;
  desc: string;
  cause?: string;
  category: string;
  categoryId?: string; // NEW: ID-based reference
  grossL: number;
  grossI: number;
  grossRating?: number;
  response: string;
  owner: string;
  controls?: string;
  residualL: number;
  residualI: number;
  residualRating?: number;
  appetite?: string;
  furtherAction?: string;
  status: string;
  dueDate: string;
  escalated: boolean;
  grossImpact?: number;
  grossProb?: number;
  residualImpact?: number;
  residualProb?: number;
  residualALE?: number;
  riskReduction?: number;
  riskReductionPct?: number;
  isNew?: boolean;
  convertedToIssue?: boolean;
  isProgrammeLevel?: boolean;
  grossALE?: number;
  // Risk-to-Issue conversion engine inputs (src/lib/riskConversion.ts):
  // `dependencies` = ids of other risks this one depends on (cascade signal);
  // `probHistory` = score snapshots over time (probability-trend signal).
  dependencies?: string[];
  probHistory?: ProbSnapshot[];
  lastReviewDate?: string;
  nextReviewDate?: string;
  nextReview?: string;
  priority?: string;
  programme?: string;
  impact?: "Low" | "Medium" | "High" | "Critical";
  likelihood?: "Low" | "Medium" | "High" | "Critical";
  mitigation?: string;
}

export interface IssueItem {
  id: string;
  projectId?: string;
  programmeId?: string;
  project?: string;
  projectName?: string;
  linkedRisk?: string;
  linkedRiskId?: string;
  dateAdded: string;
  dateReported?: string;
  title?: string;
  desc: string;
  impact: string;
  owner: string;
  priority: number;
  severity: number | "Low" | "Medium" | "High" | "Critical";
  response: string;
  responsDesc?: string;
  controlOwner?: string;
  progress?: string;
  dateUpdated?: string;
  deadline?: string;
  status: string;
  lessonsLearnt?: string;
  isProgrammeLevel?: boolean;
  category?: string;
  completedAt?: string;
}

export interface AppNotification {
  id: string;
  type: "compliance" | "risk" | "issue" | "system";
  title: string;
  message: string;
  body?: string;
  status: "Read" | "Unread";
  time: string;
  severity: "Low" | "Medium" | "High" | "Critical";
  projectId?: string;
  programmeId?: string;
  read?: boolean;
  link?: string;
}

export interface Project {
  id: string;
  name: string;
  type: string;
  loc: string;
  units: string;
  client: string;
  clientId?: string;
  programmeId?: string;
  status?: "Draft" | "Active" | "Completed";
  createdAt?: string;
  createdBy?: string;

  // Persistent Progress Tracking
  complianceSetupDone?: boolean;
  riskSetupDone?: boolean;
  aiRiskDiscoveryDone?: boolean;
  deliveryTeamDone?: boolean;
  deliveryTeam?: TeamMember[];
  isPublished?: boolean;
  setupProgress?: number;

  // Additional fields for list views
  reference?: string;
  schemeType?: string;
  pmName?: string;
  rag?: "Green" | "Amber" | "Red";
  riba?: string;
  isHRB?: boolean;
  overdueCount?: number;
  hasLeaseholders?: boolean;
  alertsCount?: number;
  storeys?: string;
  contractValue?: string;
  funding?: string;
  leaseholders?: boolean;
  lastReviewedAt?: string;
  updatedAt?: string;
  procurementRoute?: string;
  employersAgent?: string;
  architect?: string;
  mainContractor?: string;
  startOnSite?: string;
  targetPC?: string;

  // Additional fields for forms and reporting
  projectManagerId?: string;
  programmeManagerId?: string;
  pmId?: string;
  costCentreCode?: string;
  fundingStreams?: string[];
  numberOfUnits?: number;
  numberOfStoreys?: string;
  typeOfUnits?: string;
  bedroomsPerProperty?: string;
  // Project Cost (mirrors Programme's portfolio financials, slim variant —
  // no Volume Targets / Project Count which are aggregate-only concepts).
  // Stored as strings so the form input round-trips cleanly; consumers
  // parse on read.
  totalValue?: string;
  totalGrant?: string;
  contingencyPct?: string;
  // Governance Profile (.5 — same standardised taxonomy as
  // Programme so Project-level reports / FP entries can resolve to the
  // same Framework bodies + thresholds).
  decisionDeliveryLevel?: 'Strategic' | 'Corporate' | 'Programme' | 'Project' | '';
  financialThreshold?: 'Under £100k' | '£100k – £500k' | '£500k – £5m' | '£5m+' | '';
  riskRegulatoryProfile?:
    | 'Building Safety / Compliance-critical'
    | 'Financial / Legal / Regulatory'
    | 'Standard'
    | '';
  decisionAuthority?:
    | 'Cabinet / Members'
    | 'Executive Team'
    | 'Strategic Director'
    | 'Delegated Officer'
    | '';
  reportingCycle?: string;
  scope?: string;
  description?: string;
  isArchived?: boolean;
  manager?: string;
  milestones?: any[];

  // Metadata for Service Management Bar
  lastRiskRun?: string;
  lastComplianceRun?: string;
}

export interface TaskItem {
  id: string;
  title: string;
  description?: string;
  status: "Pending" | "In Progress" | "Completed";
  priority: "Low" | "Medium" | "High" | "Critical";
  dueDate: string;
  projectName?: string;
  projectId?: string;
  isProgrammeLevel?: boolean;
  completedAt?: string;
  owner?: string;
  programmeId?: string;
  riskId?: string;
  issueId?: string;
}

export interface AppState {
  user: any;
  isInitialized: boolean;
  setUser: (user: any) => void;
  isDarkMode: boolean;
  toggleDarkMode: () => void;
  isMarketingDarkMode: boolean;
  toggleMarketingDarkMode: () => void;
  activeProject: Project | null;
  setActiveProject: (project: Project | string | null) => void;
  activeProgramme: Programme | null;
  setActiveProgramme: (programme: Programme | string | null) => void;
  projects: Project[];
  setProjects: (projects: Project[]) => void;
  programmes: Programme[];
  setProgrammes: (programmes: Programme[]) => void;
  currentProject: any;
  setCurrentProject: (project: any) => void;
  projectInfo: any;
  setProjectInfo: (info: any) => void;
  activeProjectId: string | null;
  activeProgrammeId: string | null;
  setActiveProjectId: (id: string | null) => void;
  setActiveProgrammeId: (id: string | null) => void;
  suggestedRisks?: any;
  setSuggestedRisks: (risks: any) => void;
  strategicRiskAnalysis?: any;
  setStrategicRiskAnalysis: (analysis: any) => void;
  isMobileMenuOpen: boolean;
  isContextSwitching: boolean;
  setContextSwitching: (val: boolean) => void;
  clientId: string | null;
  portfolioInfo: {
    projectCount: number;
    programmeCount: number;
    userCount: number;
  } | null;
  setPortfolioInfo: (info: any) => void;
  wipeAllCurrentData: () => Promise<void>;

  // Compliance
  complianceItems: ComplianceItem[];
  setComplianceItems: (items: ComplianceItem[]) => void;
  updateComplianceItem: (
    id: string,
    updates: Partial<ComplianceItem>,
  ) => Promise<void>;
  addComplianceItem: (item: Partial<ComplianceItem>) => Promise<void>;
  deleteComplianceItem: (id: string) => Promise<void>;
  bulkDeleteComplianceItems: (ids: string[]) => Promise<void>;

  // Fact-Check / Validation — keyed by `${surface}:${targetId}` (validationKey).
  validationsByKey: Record<string, ValidationRecord | null>;
  runFactCheck: (payload: {
    surface: ValidationSurface | string;
    targetType?: string;
    targetId: string;
    contextId?: string | null;
    label?: string;
    content: string;
    ratingsContext?: string;
  }) => Promise<ValidationRecord | null>;
  loadValidation: (
    surface: string,
    targetId: string,
  ) => Promise<ValidationRecord | null>;
  setValidationStatus: (
    surface: string,
    targetId: string,
    status: "validated" | "rejected",
    note?: string,
  ) => Promise<void>;
  attachValidationSource: (
    surface: string,
    targetId: string,
    attachment: {
      kind: "link" | "file";
      title?: string;
      url?: string;
      base64?: string;
      mime?: string;
    },
  ) => Promise<void>;
  removeValidationSource: (
    surface: string,
    targetId: string,
    url: string,
  ) => Promise<void>;

  // Risk Management
  risks: RiskItem[];
  setRisks: (risks: RiskItem[]) => void;
  addRisk: (risk: RiskItem) => Promise<void>;
  updateRisk: (id: string, updates: Partial<RiskItem>) => Promise<void>;
  deleteRisk: (id: string) => Promise<void>;

  // Mutation pending set — contains entity keys like "risk:R-001" while a
  // write is in flight for that entity. UI subscribes to dim rows, disable
  // action buttons, and show per-row spinners. Replaced atomically on change.
  pendingMutations: Set<string>;
  isPendingMutation: (entityKey: string) => boolean;

  // Issues
  issues: IssueItem[];
  setIssues: (issues: IssueItem[]) => void;
  addIssue: (issue: IssueItem) => Promise<void>;
  updateIssue: (id: string, updates: Partial<IssueItem>) => Promise<void>;

  // KRIs
  kris: KRI[];
  setKRIs: (kris: KRI[]) => void;
  addKRI: (kri: KRI) => Promise<void>;
  updateKRI: (id: string, updates: any) => Promise<void>;
  deleteKRI: (id: string) => Promise<void>;

  // Regulatory
  customRegulations: RegulationItem[];
  addCustomRegulation: (item: RegulationItem) => Promise<void>;
  updateRegulationItem: (item: RegulationItem) => Promise<void>;
  remoteDomains: any[];
  setRemoteDomains: (domains: any[]) => void;

  // Notifications
  notifications: AppNotification[];
  addNotification: (
    notification: Partial<AppNotification> & {
      title: string;
      type: AppNotification["type"];
    },
  ) => void;
  clearNotifications: () => void;
  markNotificationAsRead: (id: string) => void;

  // Alerts State
  acknowledgedAlerts: string[];
  snoozedAlerts: Record<string, number>;
  ackAlert: (id: string) => void;
  snoozeAlert: (id: string, days: number) => void;
  resetAlerts: () => void;

  // CPD Training State
  cpdModules: any[];
  updateCPDModule: (id: string, updates: any) => void;

  // General App State
  isSidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  isProfileSettingsOpen: boolean;
  setProfileSettingsOpen: (open: boolean) => void;
  deferredPrompt: any;
  setDeferredPrompt: (prompt: any) => void;

  // New Dashboard & Data Methods
  complianceAnalysis: any | null;
  loadDemoData: () => Promise<void>;
  clearData: () => Promise<void>;
  // Demo mode (client-only, localStorage-backed; no DB writes).
  loadDemoProgramme: () => void;
  loadDemoProject: () => void;
  clearDemo: () => Promise<void>;
  loadProjectData: (projectId: string, persist?: boolean) => Promise<void>;
  loadProgrammeData: (programmeId: string, persist?: boolean) => Promise<void>;
  fetchProjects: () => Promise<void>;
  fetchProgrammes: () => Promise<void>;
  loadAggregateData: () => Promise<void>;
  deleteProject: (id: string) => Promise<void>;

  // API Methods
  saveData: (key: string, data: any) => Promise<void>;
  loadAllData: () => Promise<void>;
  updateProject: (id: string, updates: any) => Promise<void>;
  updateProgramme: (id: string, updates: any) => Promise<void>;

  // Missing properties used in components
  lessonsLearned: any[];
  addLessonLearned: (lesson: any) => Promise<void>;
  deleteLessonLearned: (id: string) => Promise<void>;
  addRisks: (risks: RiskItem[]) => Promise<void>;
  convertToIssue: (riskId: string) => Promise<void>;
  escalateRisk: (riskId: string, projectId: string) => Promise<void>;

  // Compliance Helpers
  getActiveItems: () => any[];
  getPendingItems: () => any[];
  addComplianceUpdate: (itemId: string, update: any) => Promise<void>;

  // Risk & Issue Helpers
  getPendingRisks: () => RiskItem[];
  getPendingIssues: () => IssueItem[];
  approveRisk: (id: string) => Promise<void>;
  approveIssue: (id: string) => Promise<void>;
  dismissRisk: (id: string) => Promise<void>;
  dismissIssue: (id: string) => Promise<void>;

  canEditCompliance: () => boolean;
  isComplianceLocked: boolean;
  setComplianceLocked: (locked: boolean) => void;

  // Billing & Pricing
  pricingConfig: PricingConfig | null;
  fetchPricingConfig: () => Promise<void>;
  updatePricingConfig: (updates: Partial<PricingConfig>) => Promise<void>;
  // Task Management
  tasks: TaskItem[];
  addTask: (task: TaskItem) => void;
  updateTask: (id: string, updates: Partial<TaskItem>) => void;
  deleteTask: (id: string) => void;

  // Additional methods
  deleteIssue: (id: string) => Promise<void>;
  deleteProgramme: (id: string) => Promise<void>;
  archiveProgramme: (id: string) => Promise<void>;
  unarchiveProgramme: (id: string) => Promise<void>;
  archiveProject: (id: string) => Promise<void>;
  unarchiveProject: (id: string) => Promise<void>;
  resetAllData: () => Promise<void>;

  setIsMarketingDarkMode: (isDark: boolean) => void;
  setNotifications: (ns: AppNotification[]) => void;
  installPWA: () => void;
  setMobileMenuOpen: (isOpen: boolean) => void;

  setComplianceAnalysis: (data: any) => void;
  addConditionalItems: (items: any[]) => void;
  lastAnalysisResults: any | null;
  setLastAnalysisResults: (results: any) => void;
  initStore: () => Promise<void>;
  setFcmToken: (token: string) => void;
  adminDeleteProgramme: (id: string) => Promise<void>;
  adminDeleteProject: (id: string) => Promise<void>;
  adminTransferProgramme: (id: string, targetUser: any) => Promise<void>;
  adminTransferProject: (id: string, targetUser: any) => Promise<void>;

  // Management Permission Helper
  canManageContext: () => boolean;

  // Resource Planner (tenant-scoped: schemes + assumptions)
  resourceSchemes: ResourceScheme[];
  resourceAssumptions: ResourceAssumptions | null;
  resourcePlannerLoading: boolean;
  resourcePlannerLoaded: boolean;
  loadResourcePlanner: (force?: boolean) => Promise<void>;
  saveResourceScheme: (scheme: ResourceScheme) => Promise<ResourceScheme>;
  deleteResourceScheme: (id: string) => Promise<void>;
  saveResourceAssumptions: (assumptions: ResourceAssumptions) => Promise<void>;
  canManageResourcePlanner: () => boolean;
}

/**
 * Build a fully-populated assumptions object from the seed rate card, defaulting
 * the horizon to the schemes' data range (answer 9-C). Used when a tenant has no
 * saved assumptions yet so the pages always have something to compute from.
 */
const buildDefaultAssumptions = (
  schemes: ResourceScheme[],
): ResourceAssumptions => {
  const idxs = schemes.flatMap(schemeBoundaryIndices);
  const horizon = idxs.length
    ? horizonFromIndices(idxs)
    : { startFy: FY_BASE_YEAR, endFy: FY_BASE_YEAR + 10 };
  return {
    rateCard: DEFAULT_RATE_CARD,
    complexityMap: DEFAULT_COMPLEXITY_MAP,
    overheadPct: DEFAULT_OVERHEAD_PCT,
    leavePct: DEFAULT_LEAVE_PCT,
    horizon,
    supplyByRole: {},
  };
};

export const useStore = create<AppState>((set, get) => {
  // Shared pending-mutation setter — replaces the Set atomically so Zustand
  // selectors subscribed to pendingMutations re-render on every change.
  const setPending = (key: string, pending: boolean) =>
    set((s) => {
      const next = new Set(s.pendingMutations);
      if (pending) next.add(key);
      else next.delete(key);
      return { pendingMutations: next };
    });

  // ── Demo mode helpers (client-only; NO api.* calls) ──────────────────────
  // A project/child id → programme bundle (which contains the children); the
  // standalone solo id → project bundle.
  const resolveDemoBundle = (id: string): DemoBundle =>
    id === DEMO_PROJECT_ID ? buildDemoProject() : buildDemoProgramme();

  // Keep the in-memory demo rows when a real fetch refreshes the lists (the API
  // never returns them). Inert when no demo is loaded.
  const keepDemo = <T extends { id: string }>(fresh: T[], current: T[]): T[] => {
    if (!isDemoActive()) return fresh;
    const demoRows = current.filter((x) => isDemoId(x.id));
    if (demoRows.length === 0) return fresh;
    return [...fresh.filter((x) => !isDemoId(x.id)), ...demoRows];
  };

  // Inject a demo bundle + set the active context (merge by id = idempotent;
  // normalizeRisk like the real loaders). `activeId` = the context to show.
  const applyDemoBundle = (bundle: DemoBundle, activeId: string) => {
    const normRisks = bundle.risks.map((r) => normalizeRisk(r) as RiskItem);
    set((s) => {
      const demoProg = bundle.programme;
      const programmes = demoProg
        ? [...s.programmes.filter((p) => p.id !== demoProg.id), demoProg]
        : s.programmes;
      const incomingProjIds = new Set(bundle.projects.map((p) => p.id));
      const projects = [
        ...s.projects.filter((p) => !incomingProjIds.has(p.id)),
        ...bundle.projects,
      ];
      const asProgramme = !!demoProg && demoProg.id === activeId;
      const activeProj = asProgramme
        ? null
        : bundle.projects.find((p) => p.id === activeId) ||
          bundle.projects[0] ||
          null;
      return {
        programmes,
        projects,
        risks: normRisks,
        issues: bundle.issues,
        kris: bundle.kris,
        complianceItems: bundle.complianceItems,
        complianceAnalysis: bundle.complianceAnalysis,
        lastAnalysisResults: bundle.lastAnalysisResults,
        projectInfo: bundle.projectInfo,
        suggestedRisks: [],
        strategicRiskAnalysis: null,
        activeProgramme: asProgramme ? demoProg! : null,
        activeProgrammeId: asProgramme ? demoProg!.id : null,
        activeProject: activeProj,
        activeProjectId: activeProj ? activeProj.id : null,
      };
    });
  };

  return {
  // ── Fact-Check / Validation ──────────────────────────────────────────
  validationsByKey: {},
  runFactCheck: async (payload) => {
    const res: any = await api.validationRunFactCheck(payload);
    const rec: ValidationRecord | null = res?.record ?? null;
    if (rec) {
      const key = validationKey(
        payload.surface as ValidationSurface,
        payload.targetId,
      );
      set((s) => ({ validationsByKey: { ...s.validationsByKey, [key]: rec } }));
    }
    return rec;
  },
  loadValidation: async (surface, targetId) => {
    const res: any = await api.validationGet(surface, targetId);
    const rec: ValidationRecord | null = res?.record ?? null;
    const key = validationKey(surface as ValidationSurface, targetId);
    set((s) => ({ validationsByKey: { ...s.validationsByKey, [key]: rec } }));
    return rec;
  },
  setValidationStatus: async (surface, targetId, status, note) => {
    await api.validationSetStatus(surface, targetId, status, note);
    await get().loadValidation(surface, targetId);
  },
  attachValidationSource: async (surface, targetId, attachment) => {
    await api.validationAttachSource(surface, targetId, attachment);
    await get().loadValidation(surface, targetId);
  },
  removeValidationSource: async (surface, targetId, url) => {
    await api.validationRemoveAttachment(surface, targetId, url);
    await get().loadValidation(surface, targetId);
  },

  user: null,
  clientId: null,
  portfolioInfo: null,
  setPortfolioInfo: (info) => set({ portfolioInfo: info }),
  deferredPrompt: null,
  isInitialized: false,
  // Reset isInitialized on every setUser so the next login always re-runs
  // initStore from scratch. Without this, logging out and back in skips
  // initStore (it returns early because isInitialized is still true from the
  // previous session), leaving the store user as the bare Firebase auth object
  // (no .role), which makes all role-gated sidebar items invisible.
  setUser: (user) => set({ user, isInitialized: false }),
  isDarkMode: false,
  toggleDarkMode: () => {
    const next = !get().isDarkMode;
    set({ isDarkMode: next });
    api.savePreference("darkMode", next);
  },
  isMarketingDarkMode: false,
  toggleMarketingDarkMode: () =>
    set({ isMarketingDarkMode: !get().isMarketingDarkMode }),
  lastAnalysisResults: null,
  activeProject: null,
  setActiveProject: (proj) => {
    // T10: clear stale per-context AI-result state on a context switch. Unlike
    // complianceAnalysis/lastAnalysisResults (reloaded per-context from the DB),
    // these AIRiskID in-memory results are NOT refetched, so without this the
    // previous context's risk insights linger into the new one (the mixup).
    set({ suggestedRisks: [], strategicRiskAnalysis: null });
    if (typeof proj === "string") {
      const found = get().projects.find((p) => p.id === proj);
      set({
        activeProject: found || null,
        activeProjectId: proj,
        activeProgramme: null,
        activeProgrammeId: null,
      });
      api.savePreference("activeProjectId", proj);
      api.savePreference("activeProgrammeId", null);
    } else {
      set({
        activeProject: proj,
        activeProjectId: proj?.id || null,
        activeProgramme: null,
        activeProgrammeId: null,
      });
      if (proj?.id) {
        api.savePreference("activeProjectId", proj.id);
        api.savePreference("activeProgrammeId", null);
      } else {
        api.savePreference("activeProjectId", null);
      }
    }
  },
  activeProgramme: null,
  setActiveProgramme: (prog) => {
    // T10: clear stale per-context AI-result state on a context switch (see
    // setActiveProject above for the rationale).
    set({ suggestedRisks: [], strategicRiskAnalysis: null });
    if (typeof prog === "string") {
      const found = get().programmes.find((p) => p.id === prog);
      set({
        activeProgramme: found || null,
        activeProgrammeId: prog,
        activeProject: null,
        activeProjectId: null,
      });
      api.savePreference("activeProgrammeId", prog);
      api.savePreference("activeProjectId", null);
    } else {
      set({
        activeProgramme: prog,
        activeProgrammeId: prog?.id || null,
        activeProject: null,
        activeProjectId: null,
      });
      if (prog?.id) {
        api.savePreference("activeProgrammeId", prog.id);
        api.savePreference("activeProjectId", null);
      } else {
        api.savePreference("activeProgrammeId", null);
      }
    }
  },
  projects: [],
  setProjects: (projects) => set({ projects }),
  programmes: [],
  setProgrammes: (programmes) => set({ programmes }),
  currentProject: null,
  setCurrentProject: (currentProject) => set({ currentProject }),
  projectInfo: {},
  setProjectInfo: (info: any) => {
    set({ projectInfo: info });
    const contextId = get().activeProjectId || get().activeProgrammeId;
    api.saveData("projectInfo", info, contextId).catch(console.error);
  },
  suggestedRisks: [],
  setSuggestedRisks: (risks: any) => set({ suggestedRisks: risks }),
  strategicRiskAnalysis: null,
  setStrategicRiskAnalysis: (analysis: any) =>
    set({ strategicRiskAnalysis: analysis }),
  activeProjectId: null,
  activeProgrammeId: null,
  setActiveProjectId: (id) => set({ activeProjectId: id }),
  setActiveProgrammeId: (id) => set({ activeProgrammeId: id }),
  isMobileMenuOpen: false,
  setMobileMenuOpen: (isOpen) => set({ isMobileMenuOpen: isOpen }),
  isContextSwitching: false,
  setContextSwitching: (val) => set({ isContextSwitching: val }),

  // Compliance
  complianceItems: [],
  setComplianceItems: (complianceItems) => {
    set({ complianceItems });
    const contextId = get().activeProjectId || get().activeProgrammeId;
    if (contextId) {
      api
        .saveData("complianceItems", complianceItems, contextId)
        .catch(console.error);
    }
  },
  updateComplianceItem: async (id, updates) => {
    const { complianceItems } = get();
    const prev = complianceItems;
    const next = complianceItems.map((item) => {
      if (item.id === id) {
        const isNowClosed =
          (updates.stage === "Live" || updates.status === "Closed") &&
          item.stage !== "Live" &&
          item.status !== "Closed";
        return {
          ...item,
          ...updates,
          completedAt: isNowClosed
            ? new Date().toISOString()
            : updates.stage === "In Progress"
              ? undefined
              : item.completedAt,
        };
      }
      return item;
    });
    set({ complianceItems: next });
    const contextId = get().activeProjectId || get().activeProgrammeId;
    try {
      await api.saveData("complianceItems", next, contextId);
    } catch (err) {
      set({ complianceItems: prev });
      throw err;
    }
  },
  addComplianceItem: async (item) => {
    const { complianceItems } = get();
    const prev = complianceItems;
    const newItem: ComplianceItem = {
      id: item.id || generateId("REQ"),
      cat: "General",
      name: "",
      reg: "",
      risk: "Medium",
      req: "",
      penalty: "",
      when: "",
      alerts: "",
      owners: "",
      process: "",
      evidence: "",
      status: "applicable",
      tag: "manual",
      category: "General",
      ...item,
    } as ComplianceItem;
    const updated = [...complianceItems, newItem];
    set({ complianceItems: updated });
    const contextId = get().activeProjectId || get().activeProgrammeId;
    try {
      await api.saveData("complianceItems", updated, contextId);
    } catch (err) {
      set({ complianceItems: prev });
      throw err;
    }
  },
  deleteComplianceItem: async (id) => {
    const { complianceItems } = get();
    const prev = complianceItems;
    const updated = complianceItems.filter((i) => i.id !== id);
    set({ complianceItems: updated });
    const contextId = get().activeProjectId || get().activeProgrammeId;
    try {
      await api.saveData("complianceItems", updated, contextId);
    } catch (err) {
      set({ complianceItems: prev });
      throw err;
    }
  },
  bulkDeleteComplianceItems: async (ids) => {
    const { complianceItems } = get();
    const prev = complianceItems;
    const next = complianceItems.filter((i) => !ids.includes(i.id));
    set({ complianceItems: next });
    const contextId = get().activeProjectId || get().activeProgrammeId;
    try {
      await api.saveData("complianceItems", next, contextId);
    } catch (err) {
      set({ complianceItems: prev });
      throw err;
    }
  },
  getActiveItems: () => {
    const { complianceItems, activeProjectId, activeProgrammeId } = get();
    // Items are "active" if their status is "applicable" OR if status is
    // missing/unrecognised (backwards-compat for items saved before status was introduced).
    const isActive = (s: string | undefined) => !s || s === "applicable";
    return complianceItems.filter((i) => {
      if (activeProjectId)
        return i.projectId === activeProjectId && isActive(i.status);
      if (activeProgrammeId)
        return i.programmeId === activeProgrammeId && isActive(i.status);
      return isActive(i.status);
    });
  },
  getPendingItems: () => {
    const { complianceItems, activeProjectId, activeProgrammeId } = get();
    return complianceItems.filter((i) => {
      if (activeProjectId)
        return i.projectId === activeProjectId && i.status === "pending";
      if (activeProgrammeId)
        return i.programmeId === activeProgrammeId && i.status === "pending";
      return i.status === "pending";
    });
  },
  getPendingRisks: () => {
    const { risks, activeProjectId, activeProgrammeId } = get();
    return risks.filter((r) => {
      if (activeProjectId)
        return r.projectId === activeProjectId && r.status === "pending";
      if (activeProgrammeId)
        return r.programmeId === activeProgrammeId && r.status === "pending";
      return r.status === "pending";
    });
  },
  getPendingIssues: () => {
    const { issues, activeProjectId, activeProgrammeId } = get();
    return issues.filter((i) => {
      if (activeProjectId)
        return i.projectId === activeProjectId && i.status === "pending";
      if (activeProgrammeId)
        return i.programmeId === activeProgrammeId && i.status === "pending";
      return i.status === "pending";
    });
  },
  approveRisk: async (id) => {
    const prevRisks = get().risks;
    const prevRow = prevRisks.find((r) => r.id === id);
    if (!prevRow) return;
    const contextId = get().activeProjectId || get().activeProgrammeId;
    const entityKey = `risk:${id}`;
    const updated = prevRisks.map((r) =>
      r.id === id ? { ...r, status: "Open", isProgrammeLevel: true } : r,
    );

    setPending(entityKey, true);
    try {
      await api.saveData("risks", updated, contextId);
      set({ risks: updated });
    } finally {
      setPending(entityKey, false);
    }
  },
  dismissRisk: async (id) => {
    const prevRisks = get().risks;
    const prevRow = prevRisks.find((r) => r.id === id);
    if (!prevRow) return;
    const contextId = get().activeProjectId || get().activeProgrammeId;
    const entityKey = `risk:${id}`;
    const updated = prevRisks.filter((r) => r.id !== id);

    setPending(entityKey, true);
    try {
      await api.saveData("risks", updated, contextId);
      set({ risks: updated });
    } finally {
      setPending(entityKey, false);
    }
  },
  approveIssue: async (id) => {
    const { issues } = get();
    const updated = issues.map((i) =>
      i.id === id ? { ...i, status: "1. Investigating" } : i,
    );
    set({ issues: updated });
    const contextId = get().activeProjectId || get().activeProgrammeId;
    await api.saveData("issues", updated, contextId);
  },
  dismissIssue: async (id) => {
    const { issues } = get();
    const updated = issues.filter((i) => i.id !== id);
    set({ issues: updated });
    const contextId = get().activeProjectId || get().activeProgrammeId;
    await api.saveData("issues", updated, contextId);
  },
  addComplianceUpdate: async (itemId, update) => {
    const { complianceItems } = get();
    const updated = complianceItems.map((item) => {
      if (item.id === itemId) {
        return {
          ...item,
          updates: [update, ...(Array.isArray(item.updates) ? item.updates : [])],
          lastUpdated: new Date().toISOString(),
        };
      }
      return item;
    });
    set({ complianceItems: updated });
    const contextId = get().activeProjectId || get().activeProgrammeId;
    await api.saveData("complianceItems", updated, contextId);
  },
  isComplianceLocked: false,
  setComplianceLocked: (isComplianceLocked) => set({ isComplianceLocked }),

  // Risk Management
  risks: [],
  setRisks: (risks) => set({ risks }),

  // ── Mutation pending state ─────────────────────────────────────────────
  // Tracks which entity-scoped mutations are currently in-flight so the UI
  // can reflect progress and block duplicate user actions.
  pendingMutations: new Set<string>(),
  isPendingMutation: (entityKey) => get().pendingMutations.has(entityKey),
  addRisk: async (risk) => {
    const normalizedRisk = normalizeRisk(risk) as RiskItem;

    // Resolve and stamp programmeId on escalated risks before saving
    if (normalizedRisk.escalated) {
      const resolvedProgrammeId =
        normalizedRisk.programmeId ||
        (get().projects as any[]).find((p: any) => p.id === normalizedRisk.projectId)?.programmeId ||
        get().activeProgrammeId ||
        '';
      if (resolvedProgrammeId) normalizedRisk.programmeId = resolvedProgrammeId;
    }

    const contextId = get().activeProjectId || get().activeProgrammeId;
    const entityKey = `risk:${normalizedRisk.id}`;
    const updated = [normalizedRisk, ...get().risks];

    setPending(entityKey, true);
    try {
      const result = await api.saveData("risks", updated, contextId);
      set({ risks: updated });
      notifySevereEscalation(result);
    } finally {
      setPending(entityKey, false);
    }

    // Primary write confirmed — best-effort secondary side-effects.
    if (normalizedRisk.escalated) {
      get().addNotification({
        id: generateId("NOTIF"),
        type: "risk",
        title: "Risk Escalated",
        message: `Risk "${normalizedRisk.title}" has been escalated to the programme level.`,
        status: "Unread",
        time: new Date().toISOString(),
        severity: "High",
      });
      if (normalizedRisk.programmeId) {
        const progId = normalizedRisk.programmeId;
        enqueueBestEffort(
          `risks:${progId}`,
          async () => {
            const progRes = await api.getData("risks", progId);
            const progRisks: any[] = progRes.success ? (progRes.data || []) : [];
            const idx = progRisks.findIndex((r: any) => r.id === normalizedRisk.id);
            if (idx >= 0) progRisks[idx] = normalizedRisk;
            else progRisks.push(normalizedRisk);
            await api.saveData("risks", progRisks, progId);
          },
          `addRisk dual-write (programme ${progId})`,
        );
      }
    }
  },
  updateRisk: async (id, updates) => {
    const prevRisks = get().risks;
    const prevRow = prevRisks.find((r) => r.id === id);
    if (!prevRow) return;

    // Track programmeId for post-save operations
    let escalateProgrammeId = '';
    let deescalateProgrammeId = '';
    let deescalateProjectId = '';
    let syncProgrammeId = '';

    const updated = prevRisks.map((risk) => {
      if (risk.id === id) {
        const merged = { ...risk, ...updates };
        // Normalize to ensure both ID and name fields are populated
        const next = normalizeRisk(merged) as RiskItem;

        // Append a probability snapshot whenever the calibrated score changes,
        // so the conversion engine (src/lib/riskConversion.ts) can detect an
        // upward trend. The baseline point was already seeded by normalizeRisk
        // on load (from the OLD score), so a score change yields ≥2 points.
        // Unchanged saves (e.g. title-only edits) append nothing.
        const prevG = getGrossScore(risk);
        const prevR = getResidualScore(risk);
        const nextG = getGrossScore(next);
        const nextR = getResidualScore(next);
        if (nextG !== prevG || nextR !== prevR) {
          const history = Array.isArray(next.probHistory)
            ? [...next.probHistory]
            : [];
          history.push({
            date: new Date().toISOString().split("T")[0],
            grossScore: nextG,
            residualScore: nextR,
            residualProb: next.residualProb,
          });
          next.probHistory = history;
        }

        if (updates.escalated === true && !risk.escalated) {
          // Ensure projectId is stamped — needed for reliable de-escalation later
          if (!next.projectId) next.projectId = get().activeProjectId || '';
          // Resolve programmeId so the risk appears in the programme register
          const resolved =
            next.programmeId ||
            (get().projects as any[]).find((p: any) => p.id === next.projectId)?.programmeId ||
            get().activeProgrammeId ||
            '';
          if (resolved) {
            next.programmeId = resolved;
            escalateProgrammeId = resolved;
          }
          get().addNotification({
            id: generateId("NOTIF"),
            type: "risk",
            title: "Risk Escalated",
            message: `Risk "${next.title}" has been escalated to the programme level.`,
            status: "Unread",
            time: new Date().toISOString(),
            severity: "High",
          });
          if (next.status !== "Escalated") next.status = "Escalated";
        } else if (updates.escalated === false && risk.escalated) {
          // Track both paths so we can clean up programme and update project
          deescalateProgrammeId = risk.programmeId || get().activeProgrammeId || '';
          deescalateProjectId = risk.projectId || '';
          // Reset status and clear programme link on the in-memory record
          if (next.status === 'Escalated') next.status = 'Open';
          next.programmeId = '';
        } else if (updates.escalated === undefined && risk.escalated && risk.programmeId) {
          // Editing an already-escalated risk — keep programme path in sync
          syncProgrammeId = risk.programmeId;
          if (next.programmeId !== risk.programmeId) next.programmeId = risk.programmeId;
        }

        return next;
      }
      return risk;
    });

    const contextId = get().activeProjectId || get().activeProgrammeId;
    const entityKey = `risk:${id}`;

    setPending(entityKey, true);
    try {
      const result = await api.saveData("risks", updated, contextId);
      set({ risks: updated });
      notifySevereEscalation(result);
    } finally {
      setPending(entityKey, false);
    }

    // Primary write confirmed — dispatch programme-path side-effects through
    // the queue keyed by the programme id so they serialize safely with each
    // other and with concurrent mutations on the same programme.
    if (escalateProgrammeId) {
      const progId = escalateProgrammeId;
      enqueueBestEffort(
        `risks:${progId}`,
        async () => {
          const escalatedRisk = get().risks.find((r) => r.id === id);
          if (!escalatedRisk) return;
          const progRes = await api.getData("risks", progId);
          const progRisks: any[] = progRes.success ? (progRes.data || []) : [];
          const idx = progRisks.findIndex((r: any) => r.id === id);
          if (idx >= 0) progRisks[idx] = escalatedRisk;
          else progRisks.push(escalatedRisk);
          await api.saveData("risks", progRisks, progId);
        },
        `updateRisk escalate dual-write (programme ${progId})`,
      );
    }

    if (deescalateProgrammeId) {
      const progId = deescalateProgrammeId;
      enqueueBestEffort(
        `risks:${progId}`,
        async () => {
          const progRes = await api.getData("risks", progId);
          const progRisks: any[] = progRes.success ? (progRes.data || []) : [];
          const cleaned = progRisks.filter((r: any) => r.id !== id);
          if (cleaned.length !== progRisks.length) {
            await api.saveData("risks", cleaned, progId);
          }
        },
        `updateRisk deescalate programme cleanup (${progId})`,
      );
    }

    // When de-escalating, project-path update runs best-effort. Resolves the
    // originating project id if missing, then patches the project's risk row.
    if (deescalateProgrammeId) {
      const progId = deescalateProgrammeId;
      const knownProjectId = deescalateProjectId;
      enqueueBestEffort(
        `risks:project-lookup:${progId}`,
        async () => {
          let projId = knownProjectId;
          if (!projId) {
            const progProjects = (get().projects as any[]).filter(
              (p: any) => p.programmeId === progId,
            );
            for (const proj of progProjects) {
              const res = await api.getData("risks", proj.id);
              if (res.success && (res.data || []).some((r: any) => r.id === id)) {
                projId = proj.id;
                break;
              }
            }
          }
          if (!projId) return;
          const projRes = await api.getData("risks", projId);
          const projRisks: any[] = projRes.success ? (projRes.data || []) : [];
          const idx = projRisks.findIndex((r: any) => r.id === id);
          if (idx >= 0) {
            projRisks[idx] = {
              ...projRisks[idx],
              escalated: false,
              status: "Open",
              programmeId: "",
            };
            await api.saveData("risks", projRisks, projId);
          }
        },
        `updateRisk deescalate project update`,
      );
    }

    if (syncProgrammeId) {
      const progId = syncProgrammeId;
      enqueueBestEffort(
        `risks:${progId}`,
        async () => {
          const updatedRisk = get().risks.find((r) => r.id === id);
          if (!updatedRisk) return;
          const progRes = await api.getData("risks", progId);
          const progRisks: any[] = progRes.success ? (progRes.data || []) : [];
          const idx = progRisks.findIndex((r: any) => r.id === id);
          if (idx >= 0) {
            progRisks[idx] = updatedRisk;
            await api.saveData("risks", progRisks, progId);
          }
        },
        `updateRisk sync programme (${progId})`,
      );
    }
  },
  deleteRisk: async (id) => {
    const prevRisks = get().risks;
    const riskToDelete = prevRisks.find((r) => r.id === id);
    if (!riskToDelete) return;

    const contextId = get().activeProjectId || get().activeProgrammeId;
    const entityKey = `risk:${id}`;
    const updated = prevRisks.filter((r) => r.id !== id);

    setPending(entityKey, true);
    try {
      await api.saveData("risks", updated, contextId);
      set({ risks: updated });
    } finally {
      setPending(entityKey, false);
    }

    // Best-effort programme-path cleanup — runs after primary delete confirms.
    if (riskToDelete.escalated && riskToDelete.programmeId) {
      const progId = riskToDelete.programmeId;
      enqueueBestEffort(
        `risks:${progId}`,
        async () => {
          const progRes = await api.getData("risks", progId);
          const progRisks: any[] = progRes.success ? (progRes.data || []) : [];
          const cleaned = progRisks.filter((r: any) => r.id !== id);
          if (cleaned.length !== progRisks.length) {
            await api.saveData("risks", cleaned, progId);
          }
        },
        `deleteRisk programme cleanup (${progId})`,
      );
    }
  },
  addRisks: async (newRisks) => {
    const { risks } = get();
    // Normalize all risks to ensure both ID and name fields are populated
    const normalizedRisks = newRisks.map((r) => normalizeRisk(r) as RiskItem);
    const updated = [...normalizedRisks, ...risks];
    set({ risks: updated });
    const contextId = get().activeProjectId || get().activeProgrammeId;
    await api.saveData("risks", updated, contextId);
  },

  // Issues
  issues: [],
  setIssues: (issues) => set({ issues }),
  addIssue: async (issue) => {
    const { issues } = get();
    const next = [issue, ...issues];
    set({ issues: next });
    const contextId = get().activeProjectId || get().activeProgrammeId;
    await api.saveData("issues", next, contextId);
  },
  updateIssue: async (id, updates) => {
    const { issues } = get();
    const updated = issues.map((issue) =>
      issue.id === id ? { ...issue, ...updates } : issue,
    );
    set({ issues: updated });
    const contextId = get().activeProjectId || get().activeProgrammeId;
    await api.saveData("issues", updated, contextId);
  },

  // KRIs
  kris: [],
  setKRIs: (kris) => set({ kris }),
  addKRI: async (kri) => {
    const { kris } = get();
    const next = [kri, ...kris];
    set({ kris: next });
    const contextId = get().activeProjectId || get().activeProgrammeId;
    await api.saveData("kris", next, contextId);
  },
  updateKRI: async (id, updates) => {
    const { kris } = get();
    const updated = kris.map((kri) =>
      kri.id === id ? { ...kri, ...updates } : kri,
    );
    set({ kris: updated });
    const contextId = get().activeProjectId || get().activeProgrammeId;
    await api.saveData("kris", updated, contextId);
  },
  deleteKRI: async (id) => {
    const { kris } = get();
    const updated = kris.filter((k) => k.id !== id);
    set({ kris: updated });
    const contextId = get().activeProjectId || get().activeProgrammeId;
    await api.saveData("kris", updated, contextId);
  },

  // Regulatory
  customRegulations: [],
  remoteDomains: [],
  setRemoteDomains: (domains: any[]) => set({ remoteDomains: domains }),
  addCustomRegulation: async (item) => {
    const { customRegulations } = get();
    const updated = [item, ...customRegulations];
    set({ customRegulations: updated });
    const contextId = get().activeProjectId || get().activeProgrammeId;
    await api.saveData("customRegulations", updated, contextId);
  },
  updateRegulationItem: async (item) => {
    const { customRegulations } = get();
    const updated = customRegulations.map((r) => (r.id === item.id ? item : r));
    set({ customRegulations: updated });
    const contextId = get().activeProjectId || get().activeProgrammeId;
    await api.saveData("customRegulations", updated, contextId);
  },

  // Notifications
  notifications: [],
  addNotification: (notification) =>
    set((state) => {
      const newNotif: AppNotification = {
        id: generateId("NOTIF"),
        status: "Unread",
        time:
          notification.time && isValidDateString(notification.time)
            ? notification.time
            : new Date().toISOString(),
        severity: "Medium",
        message: notification.message || notification.body || "",
        ...notification,
      };
      // Ensure time was not overridden by .notification with invalid value
      if (!isValidDateString(newNotif.time)) {
        newNotif.time = new Date().toISOString();
      }
      return { notifications: [newNotif, ...state.notifications] };
    }),
  clearNotifications: () => set({ notifications: [] }),
  markNotificationAsRead: (id) =>
    set((state) => ({
      notifications: state.notifications.map((n) =>
        n.id === id ? { ...n, status: "Read" } : n,
      ),
    })),

  // Alerts State
  acknowledgedAlerts: [],
  snoozedAlerts: {},
  ackAlert: (id) =>
    set((state) => ({ acknowledgedAlerts: [...state.acknowledgedAlerts, id] })),
  snoozeAlert: (id, days) =>
    set((state) => ({
      snoozedAlerts: {
        ...state.snoozedAlerts,
        [id]: Date.now() + days * 86400000,
      },
    })),
  resetAlerts: () => set({ acknowledgedAlerts: [], snoozedAlerts: {} }),

  // CPD Training State
  cpdModules: [],
  updateCPDModule: (id, updates) =>
    set((state) => ({
      cpdModules: state.cpdModules.map((m) =>
        m.id === id ? { ...m, ...updates } : m,
      ),
    })),

  // General App State
  isSidebarOpen: true,
  setSidebarOpen: (isSidebarOpen) => set({ isSidebarOpen }),
  isProfileSettingsOpen: false,
  setProfileSettingsOpen: (isProfileSettingsOpen) =>
    set({ isProfileSettingsOpen }),
  setDeferredPrompt: (deferredPrompt) => set({ deferredPrompt }),

  // New Dashboard & Data Methods
  complianceAnalysis: null,
  loadDemoData: async () => {
    const SEED_TASKS_LINKED: TaskItem[] = [
      {
        id: generateId("TSK"),
        title: "Explore further measures to reduce overspend",
        status: "Pending",
        priority: "High",
        dueDate: "2026-04-15",
        riskId: "PR_0005",
        projectId: "P001",
        owner: "Hemali",
      },
      {
        id: generateId("TSK"),
        title: "Update and adopt revised Contract Procedure Rules",
        status: "Completed",
        priority: "Medium",
        dueDate: "2026-03-25",
        riskId: "PR_0006",
        projectId: "P001",
        owner: "Zoe",
        completedAt: "2026-03-24T10:00:00Z",
      },
      {
        id: generateId("TSK"),
        title: "Commission fire engineer peer review",
        status: "Pending",
        priority: "Critical",
        dueDate: "2026-04-01",
        issueId: "PI-0002",
        projectId: "P001",
        owner: "Project Director",
      },
    ];

    set({
      risks: SEED_RISKS,
      issues: SEED_ISSUES,
      kris: SEED_KRIS,
      complianceItems: COMPLIANCE_ITEMS,
      tasks: SEED_TASKS_LINKED,
    });
    const seedContextId = get().activeProjectId || get().activeProgrammeId;
    await Promise.all([
      api.saveData("risks", SEED_RISKS, seedContextId),
      api.saveData("issues", SEED_ISSUES, seedContextId),
      api.saveData("kris", SEED_KRIS, seedContextId),
      api.saveData("complianceItems", COMPLIANCE_ITEMS, seedContextId),
      api.saveData("tasks", SEED_TASKS_LINKED, seedContextId),
    ]);
  },

  // ── Demo mode (client-only; localStorage-backed; NO database writes) ──────
  // Admin-triggered. Stashes the real context the admin is on so clearDemo can
  // restore exactly that view, then overlays the static fixture in memory.
  loadDemoProgramme: () => {
    // Preserve the original prior context across re-applies (e.g. on refresh).
    const existing = getDemoFlag();
    const prior = existing?.prior ?? {
      projectId: get().activeProjectId,
      programmeId: get().activeProgrammeId,
    };
    setDemoFlag("programme", prior);
    const bundle = buildDemoProgramme();
    applyDemoBundle(bundle, bundle.programme!.id);
  },
  loadDemoProject: () => {
    const existing = getDemoFlag();
    const prior = existing?.prior ?? {
      projectId: get().activeProjectId,
      programmeId: get().activeProgrammeId,
    };
    setDemoFlag("project", prior);
    applyDemoBundle(buildDemoProject(), DEMO_PROJECT_ID);
  },
  clearDemo: async () => {
    const flag = getDemoFlag();
    const prior = flag?.prior;
    clearDemoFlag();
    // Raise the global "Switching context" overlay for the whole restore and go
    // straight to the prior context (no null → aggregate flash).
    set((s) => ({
      isContextSwitching: true,
      projects: s.projects.filter((p) => !isDemoId(p.id)),
      programmes: s.programmes.filter((p) => !isDemoId(p.id)),
      risks: [],
      issues: [],
      kris: [],
      complianceItems: [],
      complianceAnalysis: null,
      lastAnalysisResults: null,
      projectInfo: {},
      suggestedRisks: [],
      strategicRiskAnalysis: null,
      activeProject: null,
      activeProgramme: null,
      activeProjectId: prior?.projectId ?? null,
      activeProgrammeId: prior?.programmeId ?? null,
    }));
    // Restore live real data, then drop the overlay once it resolves.
    try {
      await get().fetchProjects();
      await get().fetchProgrammes();
      if (prior?.projectId) {
        await get().loadProjectData(prior.projectId, false);
      } else if (prior?.programmeId) {
        await get().loadProgrammeData(prior.programmeId, false);
      } else {
        await get().loadAggregateData();
      }
    } finally {
      set({ isContextSwitching: false });
    }
  },
  clearData: async () => {
    set({
      projects: [],
      programmes: [],
      risks: [],
      issues: [],
      kris: [],
      complianceItems: [],
      activeProject: null,
      activeProgramme: null,
      activeProjectId: null,
      activeProgrammeId: null,
    });
    await Promise.all([
      api.savePreference("activeProjectId", null),
      api.savePreference("activeProgrammeId", null),
    ]);
  },
  loadProjectData: async (projectId: string, persist: boolean = true) => {
    // Demo mode: serve the static bundle, never the API (inert for real ids).
    if (isDemoId(projectId)) {
      applyDemoBundle(resolveDemoBundle(projectId), projectId);
      return;
    }
    // T10: clear stale per-context AI-result state (suggestedRisks /
    // strategicRiskAnalysis are not reloaded per-context — see setActiveProject).
    set({ suggestedRisks: [], strategicRiskAnalysis: null });
    // Stale-context guard helper: returns true if the user has navigated away
    // from this project while our async fetches were in-flight.
    // IMPORTANT: only valid AFTER this function has set activeProjectId below.
    const isStale = () => get().activeProjectId !== projectId;

    let project = get().projects.find((p) => p.id === projectId);

    // Claim context immediately with cached data — don't block on API roundtrip.
    // Fire getProjectById as a background refresh to hydrate deep metadata (milestones, etc.).
    if (project) {
      set({
        activeProject: project,
        activeProjectId: projectId,
        activeProgramme: null,
        activeProgrammeId: null,
      });
    } else {
      set({
        activeProjectId: projectId,
        activeProject: null,
        activeProgramme: null,
        activeProgrammeId: null,
      });
    }

    // Background refresh for deep metadata (milestones etc) — non-blocking
    api.getProjectById(projectId).then((res) => {
      if (res.success && res.data && !isStale()) {
        set((state) => ({
          projects: state.projects.some((p) => p.id === projectId)
            ? state.projects.map((p) => p.id === projectId ? { ...p, ...res.data } : p)
            : [res.data as Project, ...state.projects],
          activeProject: res.data as Project,
        }));
      }
    }).catch(console.error);

    // Fire preference save as a background task — never await it.
    // Awaiting it was the primary cause of visible loading delay (~400-800ms
    // extra latency before data fetches even started).
    if (persist) {
      Promise.all([
        api.savePreference("activeProjectId", projectId),
        api.savePreference("activeProgrammeId", null),
      ]).catch(console.error);
    }

    if (isStale()) return;

    // FETCH LATEST data for this project to ensure we don't have stale "pre-fill" state
    // Stamp each item with projectId so the Calendar filter can match them by context.
    await Promise.all([
      api.getData("risks", projectId).then((res) => {
        if (isStale()) return;
        set({
          risks: res.success
            ? (res.data || []).map(
                (r: any) => normalizeRisk({ ...r, projectId }) as RiskItem,
              )
            : [],
        });
      }),
      api.getData("issues", projectId).then((res) => {
        if (isStale()) return;
        set({
          issues: res.success
            ? (res.data || []).map((i: any) => ({ ...i, projectId }))
            : [],
        });
      }),
      // KRIs: load from project path → fallback to user-level legacy path
      //       → auto-seed standard KRIs if still empty
      (async () => {
        const ctxRes = await api.getData("kris", projectId);
        if (isStale()) return;
        const ctxKRIs = ctxRes.success ? ctxRes.data || [] : [];
        if (ctxKRIs.length > 0) {
          set({ kris: ctxKRIs });
          return;
        }
        const userRes = await api.getData("kris");
        if (isStale()) return;
        const userKRIs = userRes.success ? userRes.data || [] : [];
        if (userKRIs.length > 0) {
          set({ kris: userKRIs });
          // Migrate to project path so future loads skip this fallback
          api.saveData("kris", userKRIs, projectId).catch(console.error);
          return;
        }
        // Nothing anywhere — seed the 7 standard KRIs for this project context
        set({ kris: SEED_KRIS });
        api.saveData("kris", SEED_KRIS, projectId).catch(console.error);
      })(),
      api.getData("complianceItems", projectId).then((res) => {
        if (isStale()) return;
        set({
          complianceItems: res.success
            ? (res.data || []).map((c: any) => ({
                ...c,
                projectId,
                // Normalise status — items saved without a status default to "applicable"
                status: c.status || "applicable",
                // Normalise updates — Firestore can return a plain object instead of array
                updates: Array.isArray(c.updates) ? c.updates : [],
              }))
            : [],
        });
      }),
      api.getData("tasks", projectId).then((res) => {
        if (isStale()) return;
        set({
          tasks: res.success
            ? (res.data || []).map((t: any) => ({ ...t, projectId }))
            : [],
        });
      }),
      api
        .getData("customRegulations", projectId)
        .then((res) => {
          if (isStale()) return;
          set({ customRegulations: res.success ? res.data || [] : [] });
        }),
      api.getData("complianceAnalysis", projectId).then((res) => {
        if (isStale()) return;
        const data = res.success ? res.data || null : null;
        set({
          complianceAnalysis: data,
          lastAnalysisResults: data, // Keep both in sync
        });
      }),
      api.getData("projectInfo", projectId).then((res) => {
        if (isStale()) return;
        if (
          res.success &&
          res.data &&
          typeof res.data === "object" &&
          Object.keys(res.data).length > 0
        ) {
          set({ projectInfo: res.data });
        } else {
          set({ projectInfo: {} });
        }
      }),
    ]);
  },
  loadAggregateData: async () => {
    // Demo mode: don't run the portfolio aggregate (it would wipe the demo
    // overlay and write null-context prefs to the server).
    if (isDemoActive()) return;
    set({
      activeProject: null,
      activeProjectId: null,
      activeProgramme: null,
      activeProgrammeId: null,
      // Drop the previous context's AI results so they can't bleed into the
      // portfolio view (mirrors loadProjectData / loadProgrammeData).
      suggestedRisks: [],
      strategicRiskAnalysis: null,
      complianceAnalysis: null,
      lastAnalysisResults: null,
    });

    // Stale-context guard: aggregate is "current" only when both IDs are null.
    // If the user selects a specific project/programme while we're loading,
    // one of these will become non-null and we must bail out.
    const isStale = () =>
      get().activeProjectId !== null || get().activeProgrammeId !== null;

    console.log("Portfolio aggregate context activated. Fetching data...");

    try {
      const [portfolioRes] = await Promise.all([
        api.clientGetProjectData(),
        api.savePreference("activeProjectId", null),
        api.savePreference("activeProgrammeId", null),
      ]);

      if (isStale()) return; // User switched away — bail out

      if (portfolioRes.success && Array.isArray(portfolioRes.projects)) {
        const enrichedProjects = portfolioRes.projects;

        // Fetch per-project risks/issues/compliance data in parallel
        const perProjectData = await Promise.all(
          enrichedProjects.map(async (proj: any) => {
            try {
              const [risksRes, issuesRes, compRes] = await Promise.all([
                api.getData("risks", proj.id),
                api.getData("issues", proj.id),
                api.getData("complianceItems", proj.id),
              ]);
              return {
                risks: (risksRes.success && Array.isArray(risksRes.data)
                  ? risksRes.data
                  : []
                ).map(
                  (r: any) =>
                    normalizeRisk({ ...r, projectId: proj.id }) as RiskItem,
                ),
                issues: (issuesRes.success && Array.isArray(issuesRes.data)
                  ? issuesRes.data
                  : []
                ).map((i: any) => ({ ...i, projectId: proj.id })),
                complianceItems: (compRes.success && Array.isArray(compRes.data)
                  ? compRes.data
                  : []
                ).map((c: any) => ({ ...c, projectId: proj.id })),
              };
            } catch {
              return { risks: [], issues: [], complianceItems: [] };
            }
          }),
        );

        if (isStale()) return; // User switched away — bail out

        // Flatten all per-project arrays into aggregate store state
        const allRisks = perProjectData.flatMap((d) => d.risks);
        const allIssues = perProjectData.flatMap((d) => d.issues);
        const allCompliance = perProjectData.flatMap((d) => d.complianceItems);

        set({
          risks: allRisks,
          issues: allIssues,
          complianceItems: allCompliance,
          portfolioInfo: {
            projectCount: enrichedProjects.length,
            programmeCount: get().programmes?.length || 0,
            userCount: 0,
          },
        });
      }

      console.log("Portfolio aggregate data loaded.");
    } catch (error) {
      console.error("Failed to load portfolio aggregate data:", error);
    }
  },

  // Task Management
  tasks: [],
  addTask: async (task) => {
    const { tasks } = get();
    const next = [task, ...tasks];
    set({ tasks: next });
    const contextId =
      task.projectId ||
      task.programmeId ||
      get().activeProjectId ||
      get().activeProgrammeId;
    await api.saveData("tasks", next, contextId);
  },
  updateTask: async (id, updates) => {
    const { tasks } = get();
    const next = tasks.map((t) => {
      if (t.id === id) {
        const isNowCompleted =
          updates.status === "Completed" && t.status !== "Completed";
        return {
          ...t,
          ...updates,
          completedAt: isNowCompleted
            ? new Date().toISOString()
            : updates.status === "Pending"
              ? undefined
              : t.completedAt,
        };
      }
      return t;
    });
    set({ tasks: next });
    const contextId = get().activeProjectId || get().activeProgrammeId;
    await api.saveData("tasks", next, contextId);
  },
  deleteTask: async (id) => {
    const { tasks } = get();
    const next = tasks.filter((t) => t.id !== id);
    set({ tasks: next });
    const contextId = get().activeProjectId || get().activeProgrammeId;
    await api.saveData("tasks", next, contextId);
  },

  deleteIssue: async (id) => {
    const { issues } = get();
    const next = issues.filter((i) => i.id !== id);
    set({ issues: next });
    const contextId = get().activeProjectId || get().activeProgrammeId;
    await api.saveData("issues", next, contextId);
  },
  deleteProgramme: async (id) => {
    await api.deleteProgramme(id);
    const { programmes } = get();
    set({ programmes: programmes.filter((p) => p.id !== id) });
  },
  deleteProject: async (id) => {
    await api.deleteProject(id);
    const { projects, activeProjectId } = get();
    const wasActive = activeProjectId === id;
    set({
      projects: projects.filter((p) => p.id !== id),
      ...(wasActive
        ? {
            activeProjectId: null,
            activeProject: null,
            risks: [],
            issues: [],
            tasks: [],
            complianceItems: [],
            kris: [],
            complianceAnalysis: null,
            lastAnalysisResults: null,
            projectInfo: {},
          }
        : {}),
    });
  },
  archiveProgramme: async (id) => {
    await api.updateProgramme(id, { isArchived: true });
    const { programmes } = get();
    set({
      programmes: programmes.map((p) =>
        p.id === id ? { ...p, isArchived: true } : p,
      ),
    });
  },
  unarchiveProgramme: async (id) => {
    await api.updateProgramme(id, { isArchived: false });
    const { programmes } = get();
    set({
      programmes: programmes.map((p) =>
        p.id === id ? { ...p, isArchived: false } : p,
      ),
    });
  },
  archiveProject: async (id) => {
    await api.updateProject(id, { isArchived: true });
    const { projects } = get();
    set({
      projects: projects.map((p) =>
        p.id === id ? { ...p, isArchived: true } : p,
      ),
    });
  },
  unarchiveProject: async (id) => {
    await api.updateProject(id, { isArchived: false });
    const { projects } = get();
    set({
      projects: projects.map((p) =>
        p.id === id ? { ...p, isArchived: false } : p,
      ),
    });
  },
  resetAllData: async () => {
    await api.clientResetWorkspaceData();
    set({
      projects: [],
      programmes: [],
      risks: [],
      issues: [],
      kris: [],
      complianceItems: [],
    });
  },
  adminDeleteProgramme: async (id) => {
    await api.adminDeleteProgramme(id);
    const { programmes } = get();
    set({ programmes: programmes.filter((p) => p.id !== id) });
  },
  adminDeleteProject: async (id) => {
    await api.adminDeleteProject(id);
    const { projects } = get();
    set({ projects: projects.filter((p) => p.id !== id) });
  },
  adminTransferProgramme: async (id, targetUser) => {
    await api.adminTransferProgramme(id, targetUser);
    const { programmes } = get();
    set({
      programmes: programmes.map((p) =>
        p.id === id
          ? {
              ...p,
              userId: targetUser.uid,
              pm: targetUser.email,
              clientId: targetUser.clientId || targetUser.uid,
            }
          : p,
      ),
    });
  },
  adminTransferProject: async (id, targetUser) => {
    await api.adminTransferProject(id, targetUser);
    const { projects } = get();
    set({
      projects: projects.map((p) =>
        p.id === id
          ? {
              ...p,
              userId: targetUser.uid,
              pm: targetUser.email,
              clientId: targetUser.clientId || targetUser.uid,
            }
          : p,
      ),
    });
  },

  setFcmToken: (token) => console.log("FCM Token set:", token),
  setNotifications: (ns) =>
    set({
      notifications: (Array.isArray(ns) ? ns : []).map((n) => ({
        ...n,
        time: isValidDateString(n.time) ? n.time : new Date().toISOString(),
      })),
    }),
  installPWA: () => console.log("Install PWA triggered"),
  setIsMarketingDarkMode: (isDark) => set({ isMarketingDarkMode: isDark }),
  setComplianceAnalysis: (data) => set({ complianceAnalysis: data }),
  addConditionalItems: (items) => {
    const existing = get().complianceItems;
    const existingIds = new Set(existing.map((i: any) => i.id));
    // Ensure every added item has a status — default to "applicable"
    const deduped = items
      .filter((i: any) => !existingIds.has(i.id))
      .map((i: any) => ({ ...i, status: i.status || "applicable" }));
    if (deduped.length === 0) return;
    const next = [...existing, ...deduped];
    set({ complianceItems: next });
    const contextId = get().activeProjectId || get().activeProgrammeId;
    if (contextId) {
      api.saveData("complianceItems", next, contextId).catch(console.error);
    }
  },
  setLastAnalysisResults: (results) => set({ lastAnalysisResults: results }),

  // API Methods
  saveData: async (key, data) => {
    const contextId = get().activeProjectId || get().activeProgrammeId;
    await api.saveData(key, data, contextId);
  },
  initStore: async () => {
    const { isInitialized } = get();
    if (isInitialized) return;

    try {
      console.log("Synchronizing store state...");

      const currentUser = authBridge.getCurrentAccount();
      if (!currentUser) {
        // Wait a bit for auth to initialize if it hasn't
        await new Promise((resolve) => {
          const unsubscribe = authBridge.onAuthChange((account) => {
            unsubscribe();
            resolve(account);
          });
          setTimeout(resolve, 2000); // Max wait 2s
        });
      }

      if (!authBridge.getCurrentAccount()) {
        set({ isInitialized: true });
        return;
      }

      // 1. Get profile first to establish role/clientId context
      const profileResult = await api.getProfile();
      if (profileResult.success && profileResult.profile) {
        const firestoreProfile = profileResult.profile;
        const authUser = authBridge.getCurrentAccount();

        // Merge photoURL and displayName from Firebase Auth if Firestore doesn't
        // have them yet (new Google sign-up: Firebase has them, Firestore doc doesn't).
        const photoURL = firestoreProfile.photoURL || authUser?.photoURL || null;
        const displayName = firestoreProfile.displayName || authUser?.displayName || null;

        // BUG FIX (5.5b post-audit): preserve `uid` from Firebase Auth when
        // we overwrite the user with the Firestore profile. The profile
        // doc doesn't store uid as a field (uid IS the doc id), so without
        // this merge `user.uid` ended up undefined after init — which
        // silently broke every governance page that filters by
        // `r.ownerUid === user?.uid` (MyReports, MeetingsPage,
        // ForwardPlanPage owner checks, etc.). PMs saw empty MyReports
        // even after creating a report. PgMs didn't notice because the
        // `isAdmin || .` short-circuit hid it.
        set({
          user: {
            ...firestoreProfile,
            uid: authUser?.uid ?? firestoreProfile.uid,
            email: firestoreProfile.email ?? authUser?.email,
            photoURL,
            displayName,
          },
          clientId: firestoreProfile.clientId || null,
        });

        // Persist missing fields to Firestore non-blocking so future loads
        // also carry them (fixes "image gone after refresh" for new users).
        // Always initialize photoURL and displayName keys on the doc — even
        // for magic-link sign-ups where Firebase Auth supplies neither —
        // so the variables always exist alongside the user data.
        const photoURLMissing = !('photoURL' in firestoreProfile);
        const displayNameMissing = !('displayName' in firestoreProfile);
        const photoURLNeedsBackfill = !firestoreProfile.photoURL && !!photoURL;
        const displayNameNeedsBackfill = !firestoreProfile.displayName && !!displayName;
        if (photoURLMissing || displayNameMissing || photoURLNeedsBackfill || displayNameNeedsBackfill) {
          const toSave: Record<string, string | null> = {};
          if (photoURLMissing || photoURLNeedsBackfill) toSave.photoURL = photoURL;
          if (displayNameMissing || displayNameNeedsBackfill) toSave.displayName = displayName;
          api.saveProfile(toSave).catch(console.error);
        }
      }

      // 2. Hydrate all baseline data and preferences in parallel
      const [preferencesRes] = await Promise.all([
        api.getPreferences(),
        get().fetchProjects(),
        get().fetchProgrammes(),
      ]);

      console.log(
        "Store hydration complete. Restoring preferences...",
        preferencesRes,
      );

      // 3. Restore user's last active context from preferences, then load its data
      // FIX: Backend returns { success, preferences: {.} }, NOT { success, data: {.} }
      const prefs = preferencesRes?.preferences || preferencesRes?.data || {};
      const restoredProjectId = prefs.activeProjectId;
      const restoredProgrammeId = prefs.activeProgrammeId;

      // Demo overlay survives refresh: re-apply the fixture instead of the
      // server-preference context (leading branch so isInitialized still runs).
      const demoFlag = getDemoFlag();
      if (demoFlag) {
        console.log("Restoring demo overlay:", demoFlag.kind);
        if (demoFlag.kind === "programme") get().loadDemoProgramme();
        else get().loadDemoProject();
      } else if (restoredProjectId) {
        console.log("Restoring active project context:", restoredProjectId);
        await get().loadProjectData(restoredProjectId, false);
      } else if (restoredProgrammeId) {
        console.log("Restoring active programme context:", restoredProgrammeId);
        await get().loadProgrammeData(restoredProgrammeId, false);
      }

      // 4. Mark initialization complete AFTER data is fully loaded
      set({ isInitialized: true });
    } catch (e) {
      console.error("Store sync failed:", e);
      set({ isInitialized: true });
    }
  },

  loadAllData: async () => {
    try {
      await Promise.all([get().fetchProjects(), get().fetchProgrammes()]);

      const [risksRes, issuesRes, krisRes, complianceRes, tasksRes] =
        await Promise.all([
          api.getData("risks"),
          api.getData("issues"),
          api.getData("kris"),
          api.getData("complianceItems"),
          api.getData("tasks"),
        ]);

      set({
        risks: risksRes.success
          ? (risksRes.data || []).map((r: any) => normalizeRisk(r) as RiskItem)
          : [],
        issues: issuesRes.success ? issuesRes.data || [] : [],
        kris: krisRes.success ? krisRes.data || [] : [],
        complianceItems: complianceRes.success ? complianceRes.data || [] : [],
        tasks: tasksRes.success ? tasksRes.data || [] : [],
      });
      console.log(`Store initialized with other data.`);
    } catch (error) {
      console.error("Failed to load data:", error);
    }
  },

  wipeAllCurrentData: async () => {
    const { projects, programmes } = get();
    console.log(
      `Wiping ${projects.length} projects and ${programmes.length} programmes...`,
    );

    // Clear local state
    set({
      projects: [],
      programmes: [],
      risks: [],
      issues: [],
      kris: [],
      complianceItems: [],
      tasks: [],
      activeProject: null,
      activeProgramme: null,
      activeProjectId: null,
      activeProgrammeId: null,
    });

    // Clear preferences
    await Promise.all([
      api.savePreference("activeProjectId", null),
      api.savePreference("activeProgrammeId", null),
    ]);
  },
  loadProgrammeData: async (programmeId: string, persist: boolean = true) => {
    // Demo mode: serve the static bundle, never the API. Inert for real ids.
    if (isDemoId(programmeId)) {
      applyDemoBundle(resolveDemoBundle(programmeId), programmeId);
      return;
    }
    // T10: clear stale per-context AI-result state (see setActiveProject).
    set({ suggestedRisks: [], strategicRiskAnalysis: null });
    // Stale-context guard helper: returns true if the user has navigated away
    // from this programme while our async fetches were in-flight.
    // IMPORTANT: only valid AFTER this function has set activeProgrammeId below.
    const isStale = () => get().activeProgrammeId !== programmeId;

    let programme = get().programmes.find((p) => p.id === programmeId);

    // Claim context immediately with cached data — don't block on API roundtrip.
    // Fire getProgrammeById as background refresh to hydrate deep metadata.
    if (programme) {
      set({
        activeProgramme: programme,
        activeProgrammeId: programmeId,
        activeProject: null,
        activeProjectId: null,
      });
    } else {
      set({
        activeProgrammeId: programmeId,
        activeProgramme: null,
        activeProject: null,
        activeProjectId: null,
      });
    }

    // Background refresh for deep metadata — non-blocking
    api.getProgrammeById(programmeId).then((res) => {
      if (res.success && res.data && !isStale()) {
        set((state) => ({
          programmes: state.programmes.some((p) => p.id === programmeId)
            ? state.programmes.map((p) => p.id === programmeId ? { ...p, ...res.data } : p)
            : [res.data as Programme, ...state.programmes],
          activeProgramme: res.data as Programme,
        }));
      }
    }).catch(console.error);

    // Fire preference save as a background task — never await it.
    // Awaiting it was the primary cause of visible loading delay (~400-800ms
    // extra latency before data fetches even started).
    if (persist) {
      Promise.all([
        api.savePreference("activeProgrammeId", programmeId),
        api.savePreference("activeProjectId", null),
      ]).catch(console.error);
    }

    if (isStale()) return;

    // FIX: Fetch programme-level compliance, risk, and issue data
    // Programme data is stored under projects/{programmeId}/data/. path (same as project data)
    // Stamp each item with programmeId so the Calendar filter can match them by context.
    await Promise.all([
      // Risks: merge programme-level + per-project risks for this programme
      (async () => {
        const res = await api.getData("risks", programmeId);
        if (isStale()) return;
        const progRisks = res.success
          ? (res.data || []).map(
              (r: any) => normalizeRisk({ ...r, programmeId }) as RiskItem,
            )
          : [];

        const progProjects = get().projects.filter(
          (p: any) => p.programmeId === programmeId,
        );
        const projRiskArrays = await Promise.all(
          progProjects.map((proj: any) =>
            api.getData("risks", proj.id).then((r: any) =>
              r.success
                ? (r.data || []).map(
                    (risk: any) =>
                      normalizeRisk({
                        ...risk,
                        projectId: proj.id,
                        programmeId,
                      }) as RiskItem,
                  )
                : [],
            ),
          ),
        );

        const seenRiskIds = new Set(progRisks.map((r: any) => r.id));
        const allRisks = [...progRisks];
        for (const projRisks of projRiskArrays) {
          for (const risk of projRisks) {
            if (!seenRiskIds.has(risk.id)) {
              seenRiskIds.add(risk.id);
              allRisks.push(risk);
            }
          }
        }
        if (!isStale()) set({ risks: allRisks });
      })(),

      // Issues: merge programme-level + per-project issues for this programme
      (async () => {
        const res = await api.getData("issues", programmeId);
        const progIssues = res.success
          ? (res.data || []).map((i: any) => ({ ...i, programmeId }))
          : [];

        const progProjects = get().projects.filter(
          (p: any) => p.programmeId === programmeId,
        );
        const projIssueArrays = await Promise.all(
          progProjects.map((proj: any) =>
            api.getData("issues", proj.id).then((r: any) =>
              r.success
                ? (r.data || []).map((i: any) => ({
                    ...i,
                    projectId: proj.id,
                    programmeId,
                  }))
                : [],
            ),
          ),
        );

        const seenIds = new Set(progIssues.map((i: any) => i.id));
        const allIssues = [...progIssues];
        for (const projIssues of projIssueArrays) {
          for (const issue of projIssues) {
            if (!seenIds.has(issue.id)) {
              seenIds.add(issue.id);
              allIssues.push(issue);
            }
          }
        }
        if (!isStale()) set({ issues: allIssues });
      })(),

      // KRIs: merge programme-level + per-project KRIs + user-level legacy fallback
      (async () => {
        const progRes = await api.getData("kris", programmeId);
        if (isStale()) return;
        const progKRIs = progRes.success ? progRes.data || [] : [];

        // Fetch KRIs from each project in this programme
        const progProjects = get().projects.filter(
          (p: any) => p.programmeId === programmeId,
        );
        const projKRIArrays = await Promise.all(
          progProjects.map((proj: any) =>
            api
              .getData("kris", proj.id)
              .then((r: any) => (r.success ? r.data || [] : [])),
          ),
        );

        const seenKRIIds = new Set(progKRIs.map((k: any) => k.id));
        const allKRIs = [...progKRIs];
        for (const projKRIs of projKRIArrays) {
          for (const kri of projKRIs) {
            if (!seenKRIIds.has(kri.id)) {
              seenKRIIds.add(kri.id);
              allKRIs.push(kri);
            }
          }
        }

        if (allKRIs.length > 0) {
          if (!isStale()) set({ kris: allKRIs });
          return;
        }
        // Fall back to user-level legacy path (seed data)
        const userRes = await api.getData("kris");
        const userKRIs = userRes.success ? userRes.data || [] : [];
        if (userKRIs.length > 0) {
          if (!isStale()) set({ kris: userKRIs });
          api.saveData("kris", userKRIs, programmeId).catch(console.error);
          return;
        }
        // Nothing anywhere — seed the 7 standard KRIs for this programme context
        if (!isStale()) set({ kris: SEED_KRIS });
        api.saveData("kris", SEED_KRIS, programmeId).catch(console.error);
      })(),
      api.getData("complianceItems", programmeId).then((res) => {
        if (isStale()) return;
        set({
          complianceItems: res.success
            ? (res.data || []).map((c: any) => ({
                ...c,
                programmeId,
                // Normalise status — items saved without a status default to "applicable"
                status: c.status || "applicable",
                // Normalise updates — Firestore can return a plain object instead of array
                updates: Array.isArray(c.updates) ? c.updates : [],
              }))
            : [],
        });
      }),
      api.getData("tasks", programmeId).then((res) => {
        if (isStale()) return;
        set({
          tasks: res.success
            ? (res.data || []).map((t: any) => ({ ...t, programmeId }))
            : [],
        });
      }),
      api
        .getData("customRegulations", programmeId)
        .then((res) => {
          if (isStale()) return;
          set({ customRegulations: res.success ? res.data || [] : [] });
        }),
      api.getData("complianceAnalysis", programmeId).then((res) => {
        if (isStale()) return;
        const data = res.success ? res.data || null : null;
        set({
          complianceAnalysis: data,
          lastAnalysisResults: data, // Keep both in sync
        });
      }),
      api.getData("projectInfo", programmeId).then((res) => {
        if (isStale()) return;
        if (
          res.success &&
          res.data &&
          typeof res.data === "object" &&
          Object.keys(res.data).length > 0
        ) {
          set({ projectInfo: res.data });
        } else {
          set({ projectInfo: {} });
        }
      }),
    ]);
  },
  fetchProjects: async () => {
    try {
      // Both getProjects & clientGetProjects hit the same unified backend handler.
      // It queries by clientId + userId + invitations to cover all scenarios.
      const res = await api.getProjects();
      if (res?.projects) {
        console.log(`fetchProjects: received ${res.projects.length} projects`);
        set({ projects: keepDemo(res.projects, get().projects) });

        // If we got 0 projects but user had previously created one, retry after a delay
        // to handle Firestore index consistency lag
        if (res.projects.length === 0) {
          setTimeout(async () => {
            try {
              const retryRes = await api.getProjects();
              if (retryRes?.projects?.length > 0) {
                console.log(
                  `fetchProjects retry: received ${retryRes.projects.length} projects`,
                );
                set({ projects: keepDemo(retryRes.projects, get().projects) });
              }
            } catch (retryErr) {
              console.error("fetchProjects retry failed", retryErr);
            }
          }, 2500);
        }
      } else {
        console.warn("fetchProjects: no projects field in response", res);
      }
    } catch (e) {
      console.error("Failed to fetch projects", e);
    }
  },
  fetchProgrammes: async () => {
    try {
      const res = await api.getData("programmes");
      const data = res?.data || res;
      const programmes = Array.isArray(data) ? data : [];
      console.log(`fetchProgrammes: received ${programmes.length} programmes`);
      set({ programmes: keepDemo(programmes, get().programmes) });

      // Retry on empty results to handle Firestore lag
      if (programmes.length === 0) {
        setTimeout(async () => {
          try {
            const retryRes = await api.getData("programmes");
            const retryData = retryRes?.data || retryRes;
            const retryProgrammes = Array.isArray(retryData) ? retryData : [];
            if (retryProgrammes.length > 0) {
              console.log(
                `fetchProgrammes retry: received ${retryProgrammes.length} programmes`,
              );
              set({ programmes: keepDemo(retryProgrammes, get().programmes) });
            }
          } catch (retryErr) {
            console.error("fetchProgrammes retry failed", retryErr);
          }
        }, 2500);
      }
    } catch (e) {
      console.error("Failed to fetch programmes", e);
    }
  },
  updateProject: async (id, updates) => {
    const { projects } = get();
    const updated = projects.map((p) =>
      p.id === id ? { ...p, ...updates } : p,
    );
    set({ projects: updated });
    if (get().activeProject?.id === id) {
      set({ activeProject: { ...get().activeProject!, ...updates } });
    }
    await api.updateProject(id, updates);
  },
  updateProgramme: async (id, updates) => {
    const { programmes } = get();
    const updated = programmes.map((p) =>
      p.id === id ? { ...p, ...updates } : p,
    );
    set({ programmes: updated });
    if (get().activeProgramme?.id === id) {
      set({ activeProgramme: { ...get().activeProgramme!, ...updates } });
    }
    await api.updateProgramme(id, updates);
  },

  // Lessons Learned
  lessonsLearned: [],
  addLessonLearned: async (lesson) => {
    const { lessonsLearned } = get();
    const next = [lesson, ...lessonsLearned];
    set({ lessonsLearned: next });
    const contextId = get().activeProjectId || get().activeProgrammeId;
    await api.saveData("lessonsLearned", next, contextId);
  },
  deleteLessonLearned: async (id) => {
    const { lessonsLearned } = get();
    const next = lessonsLearned.filter((l) => l.id !== id);
    set({ lessonsLearned: next });
    const contextId = get().activeProjectId || get().activeProgrammeId;
    await api.saveData("lessonsLearned", next, contextId);
  },

  // Conversions & Escalations
  convertToIssue: async (riskId: string) => {
    const risk = get().risks.find((r) => r.id === riskId);
    if (!risk) return;
    const prevRiskShape = { ...risk };

    const resolvedProjectId = risk.projectId || get().activeProjectId || "";
    const resolvedProgrammeId =
      risk.programmeId || get().activeProgrammeId || "";

    const newIssue: IssueItem = {
      id: generateId("ISS"),
      projectId: resolvedProjectId,
      programmeId: resolvedProgrammeId,
      project: risk.project,
      linkedRisk: risk.id,
      dateAdded: new Date().toISOString().split("T")[0],
      desc: risk.desc,
      impact: "Converted from risk: " + risk.title,
      owner: risk.owner,
      priority: 3,
      severity: risk.grossL > 0 && risk.grossI > 0 ? calculateMatrixScore(risk.grossL, risk.grossI) : 3,
      response: "Resolve",
      status: "1. Investigating",
    };

    const contextId = get().activeProjectId || get().activeProgrammeId;
    const entityKey = `risk:${riskId}`;
    const updatedRisks = get().risks.map((r) =>
      r.id === riskId ? { ...r, status: "Closed", convertedToIssue: true } : r,
    );
    const updatedIssues = [newIssue, ...get().issues];

    setPending(entityKey, true);
    try {
      await api.saveData("risks", updatedRisks, contextId);
      try {
        await api.saveData("issues", updatedIssues, contextId);
      } catch (issuesErr) {
        // risks write committed but issues failed — compensate by reverting
        // the risk row on the server so client+server stay consistent.
        try {
          const compensated = updatedRisks.map((r) =>
            r.id === riskId ? prevRiskShape : r,
          );
          await api.saveData("risks", compensated, contextId);
        } catch (compErr) {
          console.error(
            "[convertToIssue] compensating risks save failed — server may be half-committed until next refresh",
            compErr,
          );
        }
        throw issuesErr;
      }
      set({ risks: updatedRisks, issues: updatedIssues });
    } finally {
      setPending(entityKey, false);
    }
  },
  escalateRisk: async (riskId: string, _projectId: string) => {
    const { risks } = get();
    const risk = risks.find((r) => r.id === riskId);
    if (!risk) return;

    const escalatedRisk: RiskItem = {
      ...risk,
      id: generateId("RSK-ESC"),
      isProgrammeLevel: true,
      escalated: true,
      dateAdded: new Date().toISOString().split("T")[0],
      status: "Open",
    };

    const updatedRisks = risks.map((r) =>
      r.id === riskId ? { ...r, escalated: true, status: "Escalated" } : r,
    );

    set({ risks: [escalatedRisk, ...updatedRisks] });
    const contextId = get().activeProjectId || get().activeProgrammeId;
    await api.saveData("risks", [escalatedRisk, ...updatedRisks], contextId);

    get().addNotification({
      id: generateId("NOTIF"),
      type: "risk",
      title: "Risk Escalated",
      message: `Risk "${risk.title}" has been escalated to programme level.`,
      status: "Unread",
      time: "Just now",
      severity: "High",
    });
  },

  // Helpers
  canEditCompliance: () => {
    const { user, isComplianceLocked } = get();
    if (isComplianceLocked)
      return isAtLeastClientAdmin(user?.role || user?.profile?.role);
    return true;
  },

  // Billing & Pricing
  pricingConfig: null,
  fetchPricingConfig: async () => {
    try {
      const config = await api.getData("pricingConfig");
      // If no config found, or it's missing fields, the components will merge it with DEFAULT_PRICING
      set({ pricingConfig: config || null });
    } catch (e) {
      console.error("Failed to fetch pricing config", e);
    }
  },
  updatePricingConfig: async (updates) => {
    const current = get().pricingConfig || {};
    const next = { ...current, ...updates } as PricingConfig;
    set({ pricingConfig: next });
    const contextId = get().activeProjectId || get().activeProgrammeId;
    await api.saveData("pricingConfig", next, contextId);
  },

  // ---- Resource Planner (tenant-scoped) -------------------------------------
  resourceSchemes: [],
  resourceAssumptions: null,
  resourcePlannerLoading: false,
  resourcePlannerLoaded: false,

  loadResourcePlanner: async (force = false) => {
    if (get().resourcePlannerLoading) return;
    if (get().resourcePlannerLoaded && !force) return;
    set({ resourcePlannerLoading: true });
    try {
      const [schemesRes, assumpRes] = await Promise.all([
        api.resourceListSchemes(),
        api.resourceGetAssumptions(),
      ]);
      const schemes: ResourceScheme[] = ((schemesRes?.schemes as any[]) || []).map(
        (s) => normalizeScheme(s),
      );
      const persisted = (assumpRes?.assumptions as ResourceAssumptions) || null;
      const assumptions = persisted
        ? { ...buildDefaultAssumptions(schemes), ...persisted }
        : buildDefaultAssumptions(schemes);
      set({
        resourceSchemes: schemes,
        resourceAssumptions: assumptions,
        resourcePlannerLoaded: true,
      });
    } catch (e) {
      console.error("loadResourcePlanner failed", e);
    } finally {
      set({ resourcePlannerLoading: false });
    }
  },

  saveResourceScheme: async (scheme) => {
    const res = await api.resourceUpsertScheme(scheme);
    const id = res?.id || scheme.id;
    const saved = normalizeScheme(
      { ...scheme, id },
      get().resourceAssumptions?.complexityMap,
    );
    set((s) => {
      const exists = s.resourceSchemes.some((x) => x.id === id);
      const list = exists
        ? s.resourceSchemes.map((x) => (x.id === id ? saved : x))
        : [...s.resourceSchemes, saved];
      list.sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")));
      return { resourceSchemes: list };
    });
    return saved;
  },

  deleteResourceScheme: async (id) => {
    await api.resourceDeleteScheme(id);
    set((s) => ({
      resourceSchemes: s.resourceSchemes.filter((x) => x.id !== id),
    }));
  },

  saveResourceAssumptions: async (assumptions) => {
    await api.resourceSaveAssumptions(assumptions);
    set({ resourceAssumptions: assumptions });
  },

  canManageResourcePlanner: () => {
    const { user } = get();
    if (!user) return false;
    return isAtLeastProgrammeManager(user.role || user.profile?.role);
  },

  canManageContext: () => {
    const { user, activeProject, activeProgramme } = get();
    if (!user) return false;

    // Admins and Client Admins can manage everything
    const role = user.role || user.profile?.role;
    if (isAtLeastClientAdmin(role)) return true;

    // Project Managers can manage their own projects
    if (activeProject) {
      return (
        activeProject.projectManagerId === user.uid ||
        activeProject.pmId === user.uid ||
        activeProject.createdBy === user.uid
      );
    }

    // Programme Managers (if not CA) can manage their own programmes
    if (activeProgramme) {
      return (
        activeProgramme.userId === user.uid ||
        activeProgramme.createdBy === user.uid
      );
    }

    return false;
  },
  };
});
