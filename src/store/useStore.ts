import { create } from 'zustand';
import { COMPLIANCE_ITEMS } from '../data/complianceData';
import { SEED_RISKS, SEED_ISSUES, SEED_KRIS, type KRI } from '../data/riskData';
export type { KRI };
import { api } from '../lib/api';
import { isAtLeastClientAdmin } from '../lib/roles';
import { generateId, isValidDateString } from '../lib/utils';
import { auth } from '../lib/firebase';

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
  status: 'In Progress' | 'Completed' | 'Delayed' | 'Pending';
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
  status?: 'Draft' | 'Active' | 'Completed';
  createdAt?: string;
  updatedAt?: string;

  // Persistent Progress Tracking
  complianceSetupDone?: boolean;
  riskSetupDone?: boolean;
  aiRiskDiscoveryDone?: boolean;
  deliveryTeamDone?: boolean;
  isPublished?: boolean;
  setupProgress?: number;

  // Extended fields used across the app
  overallRAG?: string;
  escalationRoute?: string;
  funders?: string[];
  milestones?: ProgrammeMilestone[];
  isArchived?: boolean;
  clientId?: string;
  userId?: string;

  // Metadata for Service Management Bar
  lastRiskRun?: string;
  lastComplianceRun?: string;
}

export interface RiskItem {
  id: string;
  projectId?: string;
  programmeId?: string;
  project: string;
  projectName?: string;
  workstream: string;
  kri: string;
  dateAdded: string;
  title: string;
  desc: string;
  cause?: string;
  category: string;
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
  lastReviewDate?: string;
  nextReviewDate?: string;
  nextReview?: string;
  priority?: string;
  programme?: string;
  impact?: 'Low' | 'Medium' | 'High' | 'Critical';
  likelihood?: 'Low' | 'Medium' | 'High' | 'Critical';
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
  severity: number | 'Low' | 'Medium' | 'High' | 'Critical';
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
  type: 'compliance' | 'risk' | 'issue' | 'system';
  title: string;
  message: string;
  body?: string;
  status: 'Read' | 'Unread';
  time: string;
  severity: 'Low' | 'Medium' | 'High' | 'Critical';
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
  status?: 'Draft' | 'Active' | 'Completed';
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
  rag?: 'Green' | 'Amber' | 'Red';
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
  pmId?: string;
  costCentreCode?: string;
  fundingStreams?: string[];
  numberOfUnits?: number;
  numberOfStoreys?: string;
  typeOfUnits?: string;
  bedroomsPerProperty?: string;
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
  status: 'Pending' | 'In Progress' | 'Completed';
  priority: 'Low' | 'Medium' | 'High' | 'Critical';
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
  updateComplianceItem: (id: string, updates: Partial<ComplianceItem>) => Promise<void>;
  addComplianceItem: (item: Partial<ComplianceItem>) => Promise<void>;
  deleteComplianceItem: (id: string) => void;
  
  // Risk Management
  risks: RiskItem[];
  setRisks: (risks: RiskItem[]) => void;
  addRisk: (risk: RiskItem) => Promise<void>;
  updateRisk: (id: string, updates: Partial<RiskItem>) => Promise<void>;
  deleteRisk: (id: string) => Promise<void>;
  
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
  addNotification: (notification: Partial<AppNotification> & { title: string; type: AppNotification['type'] }) => void;
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
}

export const useStore = create<AppState>((set, get) => ({
  user: null,
  clientId: null,
  portfolioInfo: null,
  setPortfolioInfo: (info) => set({ portfolioInfo: info }),
  deferredPrompt: null,
  isInitialized: false,
  setUser: (user) => set({ user }),
  isDarkMode: false,
  toggleDarkMode: () => {
    const next = !get().isDarkMode;
    set({ isDarkMode: next });
    api.savePreference('darkMode', next);
  },
  isMarketingDarkMode: false,
  toggleMarketingDarkMode: () => set({ isMarketingDarkMode: !get().isMarketingDarkMode }),
  lastAnalysisResults: null,
  activeProject: null,
  setActiveProject: (proj) => {
    if (typeof proj === 'string') {
      const found = get().projects.find(p => p.id === proj);
      set({ 
        activeProject: found || null, 
        activeProjectId: proj,
        activeProgramme: null,
        activeProgrammeId: null
      });
      api.savePreference('activeProjectId', proj);
      api.savePreference('activeProgrammeId', null);
    } else {
      set({ 
        activeProject: proj, 
        activeProjectId: proj?.id || null,
        activeProgramme: null,
        activeProgrammeId: null
      });
      if (proj?.id) {
        api.savePreference('activeProjectId', proj.id);
        api.savePreference('activeProgrammeId', null);
      } else {
        api.savePreference('activeProjectId', null);
      }
    }
  },
  activeProgramme: null,
  setActiveProgramme: (prog) => {
    if (typeof prog === 'string') {
      const found = get().programmes.find(p => p.id === prog);
      set({ 
        activeProgramme: found || null, 
        activeProgrammeId: prog,
        activeProject: null,
        activeProjectId: null
      });
      api.savePreference('activeProgrammeId', prog);
      api.savePreference('activeProjectId', null);
    } else {
      set({ 
        activeProgramme: prog, 
        activeProgrammeId: prog?.id || null,
        activeProject: null,
        activeProjectId: null
      });
      if (prog?.id) {
        api.savePreference('activeProgrammeId', prog.id);
        api.savePreference('activeProjectId', null);
      } else {
        api.savePreference('activeProgrammeId', null);
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
    api.saveData('projectInfo', info, contextId).catch(console.error);
  },
  suggestedRisks: [],
  setSuggestedRisks: (risks: any) => set({ suggestedRisks: risks }),
  strategicRiskAnalysis: null,
  setStrategicRiskAnalysis: (analysis: any) => set({ strategicRiskAnalysis: analysis }),
  activeProjectId: null,
  activeProgrammeId: null,
  setActiveProjectId: (id) => set({ activeProjectId: id }),
  setActiveProgrammeId: (id) => set({ activeProgrammeId: id }),
  isMobileMenuOpen: false,
  setMobileMenuOpen: (isOpen) => set({ isMobileMenuOpen: isOpen }),

  // Compliance
  complianceItems: [],
  setComplianceItems: (complianceItems) => {
    set({ complianceItems });
    const contextId = get().activeProjectId || get().activeProgrammeId;
    if (contextId) {
      api.saveData('complianceItems', complianceItems, contextId).catch(console.error);
    }
  },
  updateComplianceItem: async (id, updates) => {
    const { complianceItems } = get();
    const next = complianceItems.map(item => {
      if (item.id === id) {
        const isNowClosed = (updates.stage === 'Live' || updates.status === 'Closed') && (item.stage !== 'Live' && item.status !== 'Closed');
        return { 
          ...item, 
          ...updates,
          completedAt: isNowClosed ? new Date().toISOString() : (updates.stage === 'In Progress' ? undefined : item.completedAt)
        };
      }
      return item;
    });
    set({ complianceItems: next });
    const contextId = get().activeProjectId || get().activeProgrammeId;
    await api.saveData('complianceItems', next, contextId);
  },
  addComplianceItem: async (item) => {
    const { complianceItems } = get();
    const newItem: ComplianceItem = {
      id: item.id || generateId('REQ'),
      cat: 'General',
      name: '',
      reg: '',
      risk: 'Medium',
      req: '',
      penalty: '',
      when: '',
      alerts: '',
      owners: '',
      process: '',
      evidence: '',
      status: 'applicable',
      tag: 'manual',
      category: 'General',
      ...item
    } as ComplianceItem;
    const updated = [...complianceItems, newItem];
    set({ complianceItems: updated });
    const contextId = get().activeProjectId || get().activeProgrammeId;
    await api.saveData('complianceItems', updated, contextId);
  },
  deleteComplianceItem: async (id) => {
    const { complianceItems } = get();
    const updated = complianceItems.filter(i => i.id !== id);
    set({ complianceItems: updated });
    const contextId = get().activeProjectId || get().activeProgrammeId;
    await api.saveData('complianceItems', updated, contextId);
  },
  getActiveItems: () => {
    const { complianceItems, activeProjectId, activeProgrammeId } = get();
    return complianceItems.filter(i => {
      if (activeProjectId) return i.projectId === activeProjectId && i.status === 'applicable';
      if (activeProgrammeId) return i.programmeId === activeProgrammeId && i.status === 'applicable';
      return i.status === 'applicable';
    });
  },
  getPendingItems: () => {
    const { complianceItems, activeProjectId, activeProgrammeId } = get();
    return complianceItems.filter(i => {
      if (activeProjectId) return i.projectId === activeProjectId && i.status === 'pending';
      if (activeProgrammeId) return i.programmeId === activeProgrammeId && i.status === 'pending';
      return i.status === 'pending';
    });
  },
  getPendingRisks: () => {
    const { risks, activeProjectId, activeProgrammeId } = get();
    return risks.filter(r => {
      if (activeProjectId) return r.projectId === activeProjectId && r.status === 'pending';
      if (activeProgrammeId) return r.programmeId === activeProgrammeId && r.status === 'pending';
      return r.status === 'pending';
    });
  },
  getPendingIssues: () => {
    const { issues, activeProjectId, activeProgrammeId } = get();
    return issues.filter(i => {
      if (activeProjectId) return i.projectId === activeProjectId && i.status === 'pending';
      if (activeProgrammeId) return i.programmeId === activeProgrammeId && i.status === 'pending';
      return i.status === 'pending';
    });
  },
  approveRisk: async (id) => {
    const { risks } = get();
    const updated = risks.map(r => r.id === id ? { ...r, status: 'Open', isProgrammeLevel: true } : r);
    set({ risks: updated });
    const contextId = get().activeProjectId || get().activeProgrammeId;
    await api.saveData('risks', updated, contextId);
  },
  dismissRisk: async (id) => {
    const { risks } = get();
    const updated = risks.filter(r => r.id !== id);
    set({ risks: updated });
    const contextId = get().activeProjectId || get().activeProgrammeId;
    await api.saveData('risks', updated, contextId);
  },
  approveIssue: async (id) => {
    const { issues } = get();
    const updated = issues.map(i => i.id === id ? { ...i, status: '1. Investigating' } : i);
    set({ issues: updated });
    const contextId = get().activeProjectId || get().activeProgrammeId;
    await api.saveData('issues', updated, contextId);
  },
  dismissIssue: async (id) => {
    const { issues } = get();
    const updated = issues.filter(i => i.id !== id);
    set({ issues: updated });
    const contextId = get().activeProjectId || get().activeProgrammeId;
    await api.saveData('issues', updated, contextId);
  },
  addComplianceUpdate: async (itemId, update) => {
    const { complianceItems } = get();
    const updated = complianceItems.map(item => {
      if (item.id === itemId) {
        return {
          ...item,
          updates: [update, ...(item.updates || [])],
          lastUpdated: new Date().toISOString()
        };
      }
      return item;
    });
    set({ complianceItems: updated });
    const contextId = get().activeProjectId || get().activeProgrammeId;
    await api.saveData('complianceItems', updated, contextId);
  },
  isComplianceLocked: false,
  setComplianceLocked: (isComplianceLocked) => set({ isComplianceLocked }),

  // Risk Management
  risks: [],
  setRisks: (risks) => set({ risks }),
  addRisk: async (risk) => {
    const { risks } = get();
    const newRisks = [risk, ...risks];
    set({ risks: newRisks });
    
    // If escalated, trigger notification
    if (risk.escalated) {
      get().addNotification({
        id: generateId('NOTIF'),
        type: 'risk',
        title: 'Risk Escalated',
        message: `Risk "${risk.title}" has been escalated to the programme level.`,
        status: 'Unread',
        time: new Date().toISOString(),
        severity: 'High'
      });
    }

    const contextId = get().activeProjectId || get().activeProgrammeId;
    await api.saveData('risks', newRisks, contextId);
  },
  updateRisk: async (id, updates) => {
    const { risks } = get();
    const updated = risks.map(risk => {
      if (risk.id === id) {
        const next = { ...risk, ...updates };
        if (updates.escalated && !risk.escalated) {
          get().addNotification({
            id: generateId('NOTIF'),
            type: 'risk',
            title: 'Risk Escalated',
            message: `Risk "${next.title}" has been escalated to the programme level.`,
            status: 'Unread',
            time: new Date().toISOString(),
            severity: 'High'
          });
          if (next.status !== 'Escalated') next.status = 'Escalated';
        }
        return next;
      }
      return risk;
    });
    set({ risks: updated });
    const contextId = get().activeProjectId || get().activeProgrammeId;
    await api.saveData('risks', updated, contextId);
  },
  deleteRisk: async (id) => {
    const { risks } = get();
    const updated = risks.filter(risk => risk.id !== id);
    set({ risks: updated });
    const contextId = get().activeProjectId || get().activeProgrammeId;
    await api.saveData('risks', updated, contextId);
  },
  addRisks: async (newRisks) => {
    const { risks } = get();
    const updated = [...newRisks, ...risks];
    set({ risks: updated });
    const contextId = get().activeProjectId || get().activeProgrammeId;
    await api.saveData('risks', updated, contextId);
  },

  // Issues
  issues: [],
  setIssues: (issues) => set({ issues }),
  addIssue: async (issue) => {
    const { issues } = get();
    const next = [issue, ...issues];
    set({ issues: next });
    const contextId = get().activeProjectId || get().activeProgrammeId;
    await api.saveData('issues', next, contextId);
  },
  updateIssue: async (id, updates) => {
    const { issues } = get();
    const updated = issues.map(issue => issue.id === id ? { ...issue, ...updates } : issue);
    set({ issues: updated });
    const contextId = get().activeProjectId || get().activeProgrammeId;
    await api.saveData('issues', updated, contextId);
  },

  // KRIs
  kris: [],
  setKRIs: (kris) => set({ kris }),
  addKRI: async (kri) => {
    const { kris } = get();
    const next = [kri, ...kris];
    set({ kris: next });
    const contextId = get().activeProjectId || get().activeProgrammeId;
    await api.saveData('kris', next, contextId);
  },
  updateKRI: async (id, updates) => {
    const { kris } = get();
    const updated = kris.map(kri => kri.id === id ? { ...kri, ...updates } : kri);
    set({ kris: updated });
    const contextId = get().activeProjectId || get().activeProgrammeId;
    await api.saveData('kris', updated, contextId);
  },
  deleteKRI: async (id) => {
    const { kris } = get();
    const updated = kris.filter(k => k.id !== id);
    set({ kris: updated });
    const contextId = get().activeProjectId || get().activeProgrammeId;
    await api.saveData('kris', updated, contextId);
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
    await api.saveData('customRegulations', updated, contextId);
  },
  updateRegulationItem: async (item) => {
    const { customRegulations } = get();
    const updated = customRegulations.map(r => r.id === item.id ? item : r);
    set({ customRegulations: updated });
    const contextId = get().activeProjectId || get().activeProgrammeId;
    await api.saveData('customRegulations', updated, contextId);
  },

  // Notifications
  notifications: [],
  addNotification: (notification) => set(state => {
    const newNotif: AppNotification = {
      id: generateId('NOTIF'),
      status: 'Unread',
      time: (notification.time && isValidDateString(notification.time)) ? notification.time : new Date().toISOString(),
      severity: 'Medium',
      message: notification.message || notification.body || '',
      ...notification
    };
    // Ensure time was not overridden by ...notification with invalid value
    if (!isValidDateString(newNotif.time)) {
      newNotif.time = new Date().toISOString();
    }
    return { notifications: [newNotif, ...state.notifications] };
  }),
  clearNotifications: () => set({ notifications: [] }),
  markNotificationAsRead: (id) => set(state => ({
    notifications: state.notifications.map(n => n.id === id ? { ...n, status: 'Read' } : n)
  })),

  // Alerts State
  acknowledgedAlerts: [],
  snoozedAlerts: {},
  ackAlert: (id) => set((state) => ({ acknowledgedAlerts: [...state.acknowledgedAlerts, id] })),
  snoozeAlert: (id, days) => set((state) => ({ 
    snoozedAlerts: { ...state.snoozedAlerts, [id]: Date.now() + days * 86400000 } 
  })),
  resetAlerts: () => set({ acknowledgedAlerts: [], snoozedAlerts: {} }),

  // CPD Training State
  cpdModules: [],
  updateCPDModule: (id, updates) => set((state) => ({
    cpdModules: state.cpdModules.map(m => m.id === id ? { ...m, ...updates } : m)
  })),

  // General App State
  isSidebarOpen: true,
  setSidebarOpen: (isSidebarOpen) => set({ isSidebarOpen }),
  isProfileSettingsOpen: false,
  setProfileSettingsOpen: (isProfileSettingsOpen) => set({ isProfileSettingsOpen }),
  setDeferredPrompt: (deferredPrompt) => set({ deferredPrompt }),

  // New Dashboard & Data Methods
  complianceAnalysis: null,
  loadDemoData: async () => {
    const SEED_TASKS_LINKED: TaskItem[] = [
      {
        id: generateId('TSK'),
        title: "Explore further measures to reduce overspend",
        status: "Pending",
        priority: "High",
        dueDate: "2026-04-15",
        riskId: "PR_0005",
        projectId: "P001",
        owner: "Hemali"
      },
      {
        id: generateId('TSK'),
        title: "Update and adopt revised Contract Procedure Rules",
        status: "Completed",
        priority: "Medium",
        dueDate: "2026-03-25",
        riskId: "PR_0006",
        projectId: "P001",
        owner: "Zoe",
        completedAt: "2026-03-24T10:00:00Z"
      },
      {
        id: generateId('TSK'),
        title: "Commission fire engineer peer review",
        status: "Pending",
        priority: "Critical",
        dueDate: "2026-04-01",
        issueId: "PI-0002",
        projectId: "P001",
        owner: "Project Director"
      }
    ];

    set({
      risks: SEED_RISKS,
      issues: SEED_ISSUES,
      kris: SEED_KRIS,
      complianceItems: COMPLIANCE_ITEMS,
      tasks: SEED_TASKS_LINKED
    });
    await Promise.all([
      api.saveData('risks', SEED_RISKS),
      api.saveData('issues', SEED_ISSUES),
      api.saveData('kris', SEED_KRIS),
      api.saveData('complianceItems', COMPLIANCE_ITEMS),
      api.saveData('tasks', SEED_TASKS_LINKED)
    ]);
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
      activeProgrammeId: null
    });
    await Promise.all([
      api.savePreference('activeProjectId', null),
      api.savePreference('activeProgrammeId', null)
    ]);
  },
  loadProjectData: async (projectId, persist = true) => {
    const { projects } = get();
    let project = projects.find(p => p.id === projectId);
    
    if (!project) {
      // IF not immediately found due to Firestore index lag, explicitly fetch the document by ID
      try {
        const res = await api.getProjectById(projectId);
        if (res.success && res.data) {
          project = res.data;
          set(state => {
            const exists = state.projects.some(p => p.id === projectId);
            if (exists) {
              return { projects: state.projects.map(p => p.id === projectId ? { ...p, ...res.data } : p) };
            }
            return { projects: [project as Project, ...state.projects] };
          });
        }
      } catch (err) {
        console.error('Explicit project fetch failed:', err);
      }
    }

    if (project) {
      set({ 
        activeProject: project,
        activeProjectId: projectId,
        activeProgramme: null,
        activeProgrammeId: null
      });
    } else {
      set({ 
        activeProjectId: projectId,
        activeProject: null,
        activeProgramme: null,
        activeProgrammeId: null 
      });
    }

    if (persist) {
      await Promise.all([
        api.savePreference('activeProjectId', projectId),
        api.savePreference('activeProgrammeId', null)
      ]);
    }
    
    // FETCH LATEST data for this project to ensure we don't have stale "pre-fill" state
    // Stamp each item with projectId so the Calendar filter can match them by context.
    await Promise.all([
      api.getData('risks', projectId).then(res => set({ risks: res.success ? (res.data || []).map((r: any) => ({ ...r, projectId })) : [] })),
      api.getData('issues', projectId).then(res => set({ issues: res.success ? (res.data || []).map((i: any) => ({ ...i, projectId })) : [] })),
      api.getData('kris', projectId).then(res => set({ kris: res.success ? (res.data || []) : [] })),
      api.getData('complianceItems', projectId).then(res => set({ complianceItems: res.success ? (res.data || []).map((c: any) => ({ ...c, projectId })) : [] })),
      api.getData('tasks', projectId).then(res => set({ tasks: res.success ? (res.data || []).map((t: any) => ({ ...t, projectId })) : [] })),
      api.getData('complianceAnalysis', projectId).then(res => {
        const data = res.success ? (res.data || null) : null;
        set({ 
          complianceAnalysis: data,
          lastAnalysisResults: data // Keep both in sync
        });
      }),
      api.getData('projectInfo', projectId).then(res => {
        if (res.success && res.data && typeof res.data === 'object' && Object.keys(res.data).length > 0) {
          set({ projectInfo: res.data });
        } else {
          set({ projectInfo: {} });
        }
      })
    ]);
  },
  loadAggregateData: async () => {
    set({
      activeProject: null,
      activeProjectId: null,
      activeProgramme: null,
      activeProgrammeId: null
    });
    console.log('Portfolio aggregate context activated. Fetching data...');
    
    try {
      const [portfolioRes] = await Promise.all([
        api.clientGetProjectData(),
        api.savePreference('activeProjectId', null),
        api.savePreference('activeProgrammeId', null)
      ]);

      if (portfolioRes.success && Array.isArray(portfolioRes.projects)) {
        const enrichedProjects = portfolioRes.projects;

        // Fetch per-project risks/issues/compliance data in parallel
        const perProjectData = await Promise.all(
          enrichedProjects.map(async (proj: any) => {
            try {
              const [risksRes, issuesRes, compRes] = await Promise.all([
                api.getData('risks', proj.id),
                api.getData('issues', proj.id),
                api.getData('complianceItems', proj.id)
              ]);
              return {
                risks: (risksRes.success && Array.isArray(risksRes.data) ? risksRes.data : []).map((r: any) => ({ ...r, projectId: proj.id })),
                issues: (issuesRes.success && Array.isArray(issuesRes.data) ? issuesRes.data : []).map((i: any) => ({ ...i, projectId: proj.id })),
                complianceItems: (compRes.success && Array.isArray(compRes.data) ? compRes.data : []).map((c: any) => ({ ...c, projectId: proj.id }))
              };
            } catch {
              return { risks: [], issues: [], complianceItems: [] };
            }
          })
        );

        // Flatten all per-project arrays into aggregate store state
        const allRisks = perProjectData.flatMap(d => d.risks);
        const allIssues = perProjectData.flatMap(d => d.issues);
        const allCompliance = perProjectData.flatMap(d => d.complianceItems);

        set({
          risks: allRisks,
          issues: allIssues,
          complianceItems: allCompliance,
          portfolioInfo: {
            projectCount: enrichedProjects.length,
            programmeCount: get().programmes?.length || 0,
            userCount: 0
          }
        });
      }
      
      console.log('Portfolio aggregate data loaded.');
    } catch (error) {
      console.error('Failed to load portfolio aggregate data:', error);
    }
  },

  // Task Management
  tasks: [],
  addTask: async (task) => {
    const { tasks } = get();
    const next = [task, ...tasks];
    set({ tasks: next });
    const contextId = task.projectId || task.programmeId || get().activeProjectId || get().activeProgrammeId;
    await api.saveData('tasks', next, contextId);
  },
  updateTask: async (id, updates) => {
    const { tasks } = get();
    const next = tasks.map(t => {
      if (t.id === id) {
        const isNowCompleted = updates.status === 'Completed' && t.status !== 'Completed';
        return { 
          ...t, 
          ...updates, 
          completedAt: isNowCompleted ? new Date().toISOString() : (updates.status === 'Pending' ? undefined : t.completedAt)
        };
      }
      return t;
    });
    set({ tasks: next });
    const contextId = get().activeProjectId || get().activeProgrammeId;
    await api.saveData('tasks', next, contextId);
  },
  deleteTask: async (id) => {
    const { tasks } = get();
    const next = tasks.filter(t => t.id !== id);
    set({ tasks: next });
    const contextId = get().activeProjectId || get().activeProgrammeId;
    await api.saveData('tasks', next, contextId);
  },


  deleteIssue: async (id) => {
    const { issues } = get();
    const next = issues.filter(i => i.id !== id);
    set({ issues: next });
    const contextId = get().activeProjectId || get().activeProgrammeId;
    await api.saveData('issues', next, contextId);
  },
  deleteProgramme: async (id) => {
    await api.deleteProgramme(id);
    const { programmes } = get();
    set({ programmes: programmes.filter(p => p.id !== id) });
  },
  deleteProject: async (id) => {
    await api.deleteProject(id);
    const { projects, activeProjectId } = get();
    const wasActive = activeProjectId === id;
    set({
      projects: projects.filter(p => p.id !== id),
      ...(wasActive ? {
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
      } : {}),
    });
  },
  archiveProgramme: async (id) => {
    await api.updateProgramme(id, { isArchived: true });
    const { programmes } = get();
    set({ programmes: programmes.map(p => p.id === id ? { ...p, isArchived: true } : p) });
  },
  unarchiveProgramme: async (id) => {
    await api.updateProgramme(id, { isArchived: false });
    const { programmes } = get();
    set({ programmes: programmes.map(p => p.id === id ? { ...p, isArchived: false } : p) });
  },
  archiveProject: async (id) => {
    await api.updateProject(id, { isArchived: true });
    const { projects } = get();
    set({ projects: projects.map(p => p.id === id ? { ...p, isArchived: true } : p) });
  },
  unarchiveProject: async (id) => {
    await api.updateProject(id, { isArchived: false });
    const { projects } = get();
    set({ projects: projects.map(p => p.id === id ? { ...p, isArchived: false } : p) });
  },
  resetAllData: async () => {
    set({ projects: [], programmes: [], risks: [], issues: [], kris: [], complianceItems: [] });
  },
  adminDeleteProgramme: async (id) => {
    await api.adminDeleteProgramme(id);
    const { programmes } = get();
    set({ programmes: programmes.filter(p => p.id !== id) });
  },
  adminDeleteProject: async (id) => {
    await api.adminDeleteProject(id);
    const { projects } = get();
    set({ projects: projects.filter(p => p.id !== id) });
  },
  adminTransferProgramme: async (id, targetUser) => {
    await api.adminTransferProgramme(id, targetUser);
    const { programmes } = get();
    set({ 
      programmes: programmes.map(p => p.id === id ? { 
        ...p, 
        userId: targetUser.uid, 
        pm: targetUser.email, 
        clientId: targetUser.clientId || targetUser.uid 
      } : p) 
    });
  },
  adminTransferProject: async (id, targetUser) => {
    await api.adminTransferProject(id, targetUser);
    const { projects } = get();
    set({ 
      projects: projects.map(p => p.id === id ? { 
        ...p, 
        userId: targetUser.uid, 
        pm: targetUser.email, 
        clientId: targetUser.clientId || targetUser.uid 
      } : p) 
    });
  },
  
  setFcmToken: (token) => console.log('FCM Token set:', token),
  setNotifications: (ns) => set({ 
    notifications: (Array.isArray(ns) ? ns : []).map(n => ({
      ...n,
      time: isValidDateString(n.time) ? n.time : new Date().toISOString()
    }))
  }),
  installPWA: () => console.log('Install PWA triggered'),
  setIsMarketingDarkMode: (isDark) => set({ isMarketingDarkMode: isDark }),
  setComplianceAnalysis: (data) => set({ complianceAnalysis: data }),
  addConditionalItems: (items) => {
    const existing = get().complianceItems;
    const existingIds = new Set(existing.map((i: any) => i.id));
    const deduped = items.filter((i: any) => !existingIds.has(i.id));
    if (deduped.length === 0) return;
    const next = [...existing, ...deduped];
    set({ complianceItems: next });
    const contextId = get().activeProjectId || get().activeProgrammeId;
    if (contextId) {
      api.saveData('complianceItems', next, contextId).catch(console.error);
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
      console.log('Synchronizing store state...');
      
      const currentUser = auth.currentUser;
      if (!currentUser) {
        // Wait a bit for auth to initialize if it hasn't
        await new Promise(resolve => {
          const unsubscribe = auth.onAuthStateChanged(user => {
            unsubscribe();
            resolve(user);
          });
          setTimeout(resolve, 2000); // Max wait 2s
        });
      }

      if (!auth.currentUser) {
        set({ isInitialized: true });
        return;
      }

      // 1. Get profile first to establish role/clientId context
      const profileResult = await api.getProfile();
      if (profileResult.success && profileResult.profile) {
        set({ 
          user: profileResult.profile,
          clientId: profileResult.profile.clientId || null
        });
      }

      // 2. Hydrate all baseline data and preferences in parallel
      const [preferencesRes] = await Promise.all([
        api.getPreferences(),
        get().fetchProjects(),
        get().fetchProgrammes()
      ]);

      console.log('Store hydration complete. Restoring preferences...', preferencesRes);

      // 3. Restore user's last active context from preferences, then load its data
      // FIX: Backend returns { success, preferences: {...} }, NOT { success, data: {...} }
      const prefs = preferencesRes?.preferences || preferencesRes?.data || {};
      const restoredProjectId = prefs.activeProjectId;
      const restoredProgrammeId = prefs.activeProgrammeId;

      if (restoredProjectId) {
        console.log('Restoring active project context:', restoredProjectId);
        await get().loadProjectData(restoredProjectId, false);
      } else if (restoredProgrammeId) {
        console.log('Restoring active programme context:', restoredProgrammeId);
        await get().loadProgrammeData(restoredProgrammeId, false);
      }

      // 4. Mark initialization complete AFTER data is fully loaded
      set({ isInitialized: true });

    } catch (e) {
      console.error('Store sync failed:', e);
      set({ isInitialized: true });
    }
  },

  loadAllData: async () => {
    try {
      await Promise.all([
        get().fetchProjects(),
        get().fetchProgrammes(),
      ]);

      const [
        risksRes,
        issuesRes,
        krisRes,
        complianceRes,
        tasksRes
      ] = await Promise.all([
        api.getData('risks'),
        api.getData('issues'),
        api.getData('kris'),
        api.getData('complianceItems'),
        api.getData('tasks')
      ]);

      set({
        risks: risksRes.success ? (risksRes.data || []) : [],
        issues: issuesRes.success ? (issuesRes.data || []) : [],
        kris: krisRes.success ? (krisRes.data || []) : [],
        complianceItems: complianceRes.success ? (complianceRes.data || []) : [],
        tasks: tasksRes.success ? (tasksRes.data || []) : []
      });
      console.log(`Store initialized with other data.`);
    } catch (error) {
      console.error('Failed to load data:', error);
    }
  },

  wipeAllCurrentData: async () => {
    const { projects, programmes } = get();
    console.log(`Wiping ${projects.length} projects and ${programmes.length} programmes...`);
    
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
      activeProgrammeId: null
    });
    
    // Clear preferences
    await Promise.all([
      api.savePreference('activeProjectId', null),
      api.savePreference('activeProgrammeId', null)
    ]);
  },
  loadProgrammeData: async (programmeId, persist = true) => {
    const { programmes } = get();
    let programme = programmes.find(p => p.id === programmeId);
    
    if (!programme) {
      // Fetch explicitly to bypass Firestore index lag
      try {
        const res = await api.getProgrammeById(programmeId);
        if (res.success && res.data) {
          programme = res.data;
          set(state => {
            const exists = state.programmes.some(p => p.id === programmeId);
            if (exists) {
              return { programmes: state.programmes.map(p => p.id === programmeId ? { ...p, ...res.data } : p) };
            }
            return { programmes: [programme as Programme, ...state.programmes] };
          });
        }
      } catch (err) {
        console.error('Explicit programme fetch failed:', err);
      }
    }

    if (programme) {
      set({ 
        activeProgramme: programme,
        activeProgrammeId: programmeId,
        activeProject: null,
        activeProjectId: null
      });
    } else {
       set({ 
        activeProgrammeId: programmeId,
        activeProgramme: null,
        activeProject: null,
        activeProjectId: null 
      });
    }

    if (persist) {
      await Promise.all([
        api.savePreference('activeProgrammeId', programmeId),
        api.savePreference('activeProjectId', null)
      ]);
    }

    // FIX: Fetch programme-level compliance, risk, and issue data
    // Programme data is stored under projects/{programmeId}/data/... path (same as project data)
    // Stamp each item with programmeId so the Calendar filter can match them by context.
    await Promise.all([
      api.getData('risks', programmeId).then(res => set({ risks: res.success ? (res.data || []).map((r: any) => ({ ...r, programmeId })) : [] })),
      api.getData('issues', programmeId).then(res => set({ issues: res.success ? (res.data || []).map((i: any) => ({ ...i, programmeId })) : [] })),
      api.getData('kris', programmeId).then(res => set({ kris: res.success ? (res.data || []) : [] })),
      api.getData('complianceItems', programmeId).then(res => set({ complianceItems: res.success ? (res.data || []).map((c: any) => ({ ...c, programmeId })) : [] })),
      api.getData('tasks', programmeId).then(res => set({ tasks: res.success ? (res.data || []).map((t: any) => ({ ...t, programmeId })) : [] })),
      api.getData('complianceAnalysis', programmeId).then(res => {
        const data = res.success ? (res.data || null) : null;
        set({ 
          complianceAnalysis: data,
          lastAnalysisResults: data // Keep both in sync
        });
      }),
      api.getData('projectInfo', programmeId).then(res => {
        if (res.success && res.data && typeof res.data === 'object' && Object.keys(res.data).length > 0) {
          set({ projectInfo: res.data });
        } else {
          set({ projectInfo: {} });
        }
      })
    ]);
  },
  fetchProjects: async () => {
    try {
      // Both getProjects & clientGetProjects hit the same unified backend handler.
      // It queries by clientId + userId + invitations to cover all scenarios.
      const res = await api.getProjects();
      if (res?.projects) {
        console.log(`fetchProjects: received ${res.projects.length} projects`);
        set({ projects: res.projects });

        // If we got 0 projects but user had previously created one, retry after a delay
        // to handle Firestore index consistency lag
        if (res.projects.length === 0) {
          setTimeout(async () => {
            try {
              const retryRes = await api.getProjects();
              if (retryRes?.projects?.length > 0) {
                console.log(`fetchProjects retry: received ${retryRes.projects.length} projects`);
                set({ projects: retryRes.projects });
              }
            } catch (retryErr) {
              console.error('fetchProjects retry failed', retryErr);
            }
          }, 2500);
        }
      } else {
        console.warn('fetchProjects: no projects field in response', res);
      }
    } catch (e) {
      console.error('Failed to fetch projects', e);
    }
  },
  fetchProgrammes: async () => {
    try {
      const res = await api.getData('programmes');
      const data = res?.data || res;
      const programmes = Array.isArray(data) ? data : [];
      console.log(`fetchProgrammes: received ${programmes.length} programmes`);
      set({ programmes });

      // Retry on empty results to handle Firestore lag
      if (programmes.length === 0) {
        setTimeout(async () => {
          try {
            const retryRes = await api.getData('programmes');
            const retryData = retryRes?.data || retryRes;
            const retryProgrammes = Array.isArray(retryData) ? retryData : [];
            if (retryProgrammes.length > 0) {
              console.log(`fetchProgrammes retry: received ${retryProgrammes.length} programmes`);
              set({ programmes: retryProgrammes });
            }
          } catch (retryErr) {
            console.error('fetchProgrammes retry failed', retryErr);
          }
        }, 2500);
      }
    } catch (e) {
      console.error('Failed to fetch programmes', e);
    }
  },
  updateProject: async (id, updates) => {
    const { projects } = get();
    const updated = projects.map(p => p.id === id ? { ...p, ...updates } : p);
    set({ projects: updated });
    if (get().activeProject?.id === id) {
      set({ activeProject: { ...get().activeProject!, ...updates } });
    }
    await api.updateProject(id, updates);
  },
  updateProgramme: async (id, updates) => {
    const { programmes } = get();
    const updated = programmes.map(p => p.id === id ? { ...p, ...updates } : p);
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
    await api.saveData('lessonsLearned', next, contextId);
  },

  // Conversions & Escalations
  convertToIssue: async (riskId: string) => {
    const risk = get().risks.find(r => r.id === riskId);
    if (!risk) return;

    const newIssue: IssueItem = {
      id: generateId('ISS'),
      projectId: risk.projectId,
      programmeId: risk.programmeId,
      project: risk.project,
      linkedRisk: risk.id,
      dateAdded: new Date().toISOString().split('T')[0],
      desc: risk.desc,
      impact: "Converted from risk: " + risk.title,
      owner: risk.owner,
      priority: 3,
      severity: (risk.grossL * risk.grossI) || 3,
      response: "Resolve",
      status: "1. Investigating",
    };

    const updatedRisks = get().risks.map(r => 
      r.id === riskId ? { ...r, status: 'Closed', convertedToIssue: true } : r
    );

    set(state => ({
      issues: [newIssue, ...state.issues],
      risks: updatedRisks
    }));

    const contextId = get().activeProjectId || get().activeProgrammeId;
    await api.saveData('risks', updatedRisks, contextId);
    await api.saveData('issues', [newIssue, ...get().issues], contextId);
  },
  escalateRisk: async (riskId: string, projectId: string) => {
    const { risks } = get();
    const risk = risks.find(r => r.id === riskId);
    if (!risk) return;

    const escalatedRisk: RiskItem = {
      ...risk,
      id: generateId('RSK-ESC'),
      isProgrammeLevel: true,
      escalated: true,
      dateAdded: new Date().toISOString().split('T')[0],
      status: 'Open'
    };

    const updatedRisks = risks.map(r => 
      r.id === riskId ? { ...r, escalated: true, status: 'Escalated' } : r
    );

    set({ risks: [escalatedRisk, ...updatedRisks] });
    const contextId = get().activeProjectId || get().activeProgrammeId;
    await api.saveData('risks', [escalatedRisk, ...updatedRisks], contextId);

    get().addNotification({
      id: generateId('NOTIF'),
      type: 'risk',
      title: 'Risk Escalated',
      message: `Risk "${risk.title}" has been escalated to programme level.`,
      status: 'Unread',
      time: 'Just now',
      severity: 'High'
    });
  },

  // Helpers
  canEditCompliance: () => {
    const { user, isComplianceLocked } = get();
    if (isComplianceLocked) return isAtLeastClientAdmin(user?.role || user?.profile?.role);
    return true;
  },

  // Billing & Pricing
  pricingConfig: null,
  fetchPricingConfig: async () => {
    try {
      const config = await api.getData('pricingConfig');
      // If no config found, or it's missing fields, the components will merge it with DEFAULT_PRICING
      set({ pricingConfig: config || null }); 
    } catch (e) {
      console.error('Failed to fetch pricing config', e);
    }
  },
  updatePricingConfig: async (updates) => {
    const current = get().pricingConfig || {};
    const next = { ...current, ...updates } as PricingConfig;
    set({ pricingConfig: next });
    const contextId = get().activeProjectId || get().activeProgrammeId;
    await api.saveData('pricingConfig', next, contextId);
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
  }
}));
