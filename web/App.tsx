import React from 'react';
import { BrowserRouter, HashRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';

import { MobileNav } from './components/MobileNav';

import { Dashboard } from './features/reporting/pages/Dashboard';
import { ComplianceSetup } from './features/compliance/pages/ComplianceSetup';
import { ComplianceTracker } from './features/compliance/pages/ComplianceTracker';
import { ComplianceDashboard } from './features/compliance/pages/ComplianceDashboard';
import { LinkedRegs } from './features/compliance/pages/LinkedRegs';
import { ComplianceAlerts } from './features/compliance/pages/ComplianceAlerts';
import { RiskRegister } from './features/risk/pages/RiskRegister';
import { RiskIssues } from './features/risk/pages/RiskIssues';
import { RiskAggregation } from './features/risk/pages/RiskAggregation';
import { RiskTracker } from './features/risk/pages/RiskTracker';
import { RiskAlerts } from './features/risk/pages/RiskAlerts';
import { RiskDashboard } from './features/risk/pages/RiskDashboard';
import { AIRiskID } from './features/risk/pages/AIRiskID';
import { AdminPanel } from './features/admin/pages/AdminPanel';
import { AuthProvider } from './components/AuthProvider';
import { Login } from './pages/Login';
import { useStore } from './store/useStore';

// New pages
import { PublicLayout } from './components/public/PublicLayout';
import { Landing } from './pages/Landing';
import { About } from './pages/public/About';
import { Product } from './pages/public/Product';
import { News } from './pages/public/News';
import { Support } from './pages/public/Support';
import { NewsArticle } from './pages/public/NewsArticle';
import { Contact } from './pages/public/Contact';
import { Projects } from './features/projects/pages/Projects';
import { ProjectInitiation } from './features/projects/pages/ProjectInitiation';
import { MyTasks } from './features/learning/pages/MyTasks';
import { WorkspaceSettings } from './features/admin/pages/WorkspaceSettings';
import { RegulationLibrary } from './features/learning/pages/RegulationLibrary';
import { RiskSetup } from './features/risk/pages/RiskSetup';
import { ProgrammeContext } from './features/programmes/pages/ProgrammeContext';
import { ProgrammeInitiation } from './features/programmes/pages/ProgrammeInitiation';
import { Programmes } from './features/programmes/pages/Programmes';
import { AIControlSuggestions } from './features/compliance/pages/AIControlSuggestions';
import { AIComplianceOutlook } from './features/compliance/pages/AIComplianceOutlook';
import { KRITracker } from './features/risk/pages/KRITracker';
import { TrendsHeatmaps } from './features/reporting/pages/TrendsHeatmaps';
import AlertsPage from './features/reporting/pages/AlertsPage';
import { ProgrammeRiskRegister } from './features/programmes/pages/ProgrammeRiskRegister';
import { ProgrammeIssues } from './features/programmes/pages/ProgrammeIssues';
import { ExecutiveReport } from './features/reporting/pages/ExecutiveReport';
import { ProjectReport } from './features/projects/pages/ProjectReport';
import { ClientProgrammeReport } from './features/programmes/pages/ClientProgrammeReport';
import { ProgrammeReport } from './features/programmes/pages/ProgrammeReport';
import { EvidenceDocuments } from './features/compliance/pages/EvidenceDocuments';
import { DeveloperSettings } from './features/admin/pages/DeveloperSettings';
import IntegrationsPage from './features/integrations/pages/IntegrationsPage';
import { APIDocs } from './features/admin/pages/APIDocs';
import { HelpCenter } from './features/learning/pages/HelpCenter';
import { ClientTeamPanel } from './features/admin/pages/ClientTeamPanel';
import { MappingManager } from './components/admin/MappingManager';
import { RoleGuard } from './components/RoleGuard';
import { Calendar } from './features/reporting/pages/Calendar';
import { CostCalculator } from './features/admin/pages/CostCalculator';
import { CPDTraining } from './features/learning/pages/CPDTraining';
import { LessonsLearned } from './features/learning/pages/LessonsLearned';
import { ProjectPlan } from './features/projects/pages/ProjectPlan';


import { BillingPanel } from './features/admin/pages/BillingPanel';
import { MobileHeader } from './components/MobileHeader';
import { ProfileSettingsModal } from './components/ProfileSettingsModal';
import { GlobalAIAssistant } from './components/GlobalAIAssistant';
import DemoModeBanner from './components/DemoModeBanner';
import { CommandPalette } from './components/CommandPalette';
import { RequestAccessModal } from './components/RequestAccessModal';
import { useAccessRequestStore } from './store/accessRequestStore';

// Programme Governance (placeholder pages)
import { GovernanceDashboardPage } from './features/governance/pages/DashboardPage';
import { GovernanceForwardPlanPage } from './features/governance/pages/ForwardPlanPage';
import { GovernanceMyReportsPage } from './features/governance/pages/MyReportsPage';
import { GovernanceTemplatesPage } from './features/governance/pages/TemplatesPage';
import { GovernanceMeetingsPage } from './features/governance/pages/MeetingsPage';
import { GovernanceFrameworkPage } from './features/governance/pages/FrameworkPage';
import { GovernanceArchivePage } from './features/governance/pages/ArchivePage';
import { GovernanceBoardCalendarPage } from './features/governance/pages/BoardCalendarPage';
import { ProjectGovernanceDocsPage } from './features/governance/pages/ProjectGovernanceDocsPage';
// Programme Governance (editor sandbox)
import { GovernanceEditorSandboxPage } from './features/governance/pages/EditorSandboxPage';
// Programme Governance (Reports CRUD shell)
import { GovernanceReportsListPage } from './features/governance/pages/ReportsListPage';
// Programme Governance (Report authoring with Tiptap editor)
import { ReportAuthoringPage } from './features/governance/pages/ReportAuthoringPage';

// Technical Assurance Companion (placeholder pages)
import { TacEnquiriesListPage } from './features/technicalAssurance/pages/EnquiriesListPage';
import { TacEnquiryWorkspacePage } from './features/technicalAssurance/pages/EnquiryWorkspacePage';
import { TacRfiRegisterPage } from './features/technicalAssurance/pages/RfiRegisterPage';
import { TacAuditDashboardPage } from './features/technicalAssurance/pages/AuditDashboardPage';
import { ComplianceLeadGuard } from './features/technicalAssurance/components/ComplianceLeadGuard';
import ResourcePlannerDashboardPage from './features/resourcePlanner/pages/DashboardPage';
import SchemeRegisterPage from './features/resourcePlanner/pages/SchemeRegisterPage';
import DemandForecastPage from './features/resourcePlanner/pages/DemandForecastPage';
import ResourceTimelinePage from './features/resourcePlanner/pages/TimelinePage';
import ResourceAssumptionsPage from './features/resourcePlanner/pages/AssumptionsPage';
import ResourceCapacityPage from './features/resourcePlanner/pages/CapacityPage';
import ControlsRegisterPage from './features/controls/pages/ControlsRegisterPage';
import IncidentsRegisterPage from './features/incidents/pages/IncidentsRegisterPage';
import LearningEnginePage from './features/learning/pages/LearningEnginePage';
import AssuranceHubPage from './features/assurance/pages/AssuranceHubPage';
import { ChatPage } from './features/chat/pages/ChatPage';

// Desktop-shell support
import { isDesktop } from './lib/desktop/isDesktop';
import FirstRunWizard from './components/desktop/FirstRunWizard';
import HealthBanner from './components/desktop/HealthBanner';

// On desktop (file:// origin) BrowserRouter pushes synthetic paths via the
// History API, which breaks relative asset URLs (logo.png etc.) on any route
// deeper than the root. HashRouter keeps the document URL anchored at
// index.html so `./logo.png` always resolves correctly. Web build keeps
// BrowserRouter for clean URLs.
const Router = isDesktop ? HashRouter : BrowserRouter;

function ContextSwitchingOverlay() {
  const isContextSwitching = useStore(state => state.isContextSwitching);
  if (!isContextSwitching) return null;
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-white/45 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="flex flex-col items-center gap-4 bg-white rounded-lg border border-slate-200 shadow-2xl shadow-slate-900/10 px-10 py-8">
        <div className="relative">
          <div className="w-12 h-12 rounded-full border-4 border-indigo-100" />
          <div className="absolute inset-0 w-12 h-12 rounded-full border-4 border-indigo-600 border-t-transparent animate-spin" />
        </div>
        <div className="text-center">
          <p className="text-sm font-bold text-slate-900 tracking-tight">Switching context</p>
          <p className="text-[11px] text-slate-400 font-medium mt-0.5 uppercase tracking-widest">Loading data…</p>
        </div>
      </div>
    </div>
  );
}

function AppContent() {
  const user = useStore(state => state.user);
  const isProfileSettingsOpen = useStore(state => state.isProfileSettingsOpen);
  const setProfileSettingsOpen = useStore(state => state.setProfileSettingsOpen);
  const isAccessRequestOpen = useAccessRequestStore(state => state.isOpen);
  const accessRequestAttemptedAction = useAccessRequestStore(state => state.attemptedAction);
  const closeAccessRequestModal = useAccessRequestStore(state => state.close);
  const routerLocation = useLocation();
  const mainRef = React.useRef<HTMLDivElement>(null);

  // --- Desktop: read encrypted config (backend choice) before first render ---
  // On the web, isDesktop is false → these refs are noops.
  // On desktop, we ask the Electron main process for the saved config; if none
  // exists, we render the first-run wizard. The real safeStorage round-trip
  // lands in Task 8 — until then config:get returns null and the wizard always
  // shows after a fresh launch.
  const [desktopConfig, setDesktopConfig] = React.useState<any>(null);
  const [desktopConfigLoaded, setDesktopConfigLoaded] = React.useState<boolean>(!isDesktop);

  const loadDesktopConfig = React.useCallback(async () => {
    if (!isDesktop) {
      setDesktopConfigLoaded(true);
      return;
    }
    try {
      const cfg = await (window as any).cedar?.config?.get?.();
      setDesktopConfig(cfg ?? null);
    } catch (err) {
      console.error('Failed to read desktop config:', err);
    }
    setDesktopConfigLoaded(true);
  }, []);

  React.useEffect(() => {
    loadDesktopConfig();
  }, [loadDesktopConfig]);

  // Global scroll-to-top on route change
  React.useEffect(() => {
    if (mainRef.current) {
      mainRef.current.scrollTop = 0;
    }
  }, [routerLocation.pathname]);

  // Global ⌘K / Ctrl+K command palette. State lives here so the palette
  // overlays the entire authenticated layout. Header.tsx (and any other
  // surface) opens the palette by dispatching `cg:open-command-palette`
  // on `window` — no prop drilling.
  const [commandPaletteOpen, setCommandPaletteOpen] = React.useState(false);
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCommandPaletteOpen((v) => !v);
      }
    };
    const onOpen = () => setCommandPaletteOpen(true);
    window.addEventListener('keydown', onKey);
    window.addEventListener('cg:open-command-palette', onOpen);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('cg:open-command-palette', onOpen);
    };
  }, []);

  // Desktop: while the encrypted config is being read from the main process,
  // render nothing rather than flash the public/marketing surface.
  if (isDesktop && !desktopConfigLoaded) {
    return null;
  }

  // Desktop, fresh install: no backend choice yet → first-run wizard.
  // Marketing routes (Landing, About, Product, News, Support, Contact) are
  // skipped entirely on desktop — they belong only to the web build.
  if (isDesktop && !desktopConfig) {
    return (
      <FirstRunWizard
        onComplete={async (backend) => {
          await (window as any).cedar?.setup?.complete?.({ backend });
          await loadDesktopConfig();
        }}
      />
    );
  }

  // Desktop, config saved but not signed in → render Login directly
  // (no public routes). Magic-link is hidden on desktop in Task 12.
  if (isDesktop && !user) {
    return <Login />;
  }

  // Web build, no user → existing public routes + login.
  if (!user) {
    return (
      <Routes>
        <Route element={<PublicLayout />}>
          <Route path="/" element={<Landing />} />
          <Route path="/about" element={<About />} />
          <Route path="/product" element={<Product />} />
          <Route path="/news" element={<News />} />
          <Route path="/news/:id" element={<NewsArticle />} />
          <Route path="/support" element={<Support />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/api-docs" element={<APIDocs />} />
          <Route path="/help" element={<HelpCenter />} />
        </Route>
        <Route path="/login" element={<Login />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    );
  }

  return (
    <div className="flex h-screen bg-slate-50 font-sans text-slate-800 safe-top print:block print:h-auto print:overflow-visible">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden print:overflow-visible print:block">
        <MobileHeader />
        <div className="hidden lg:block print:hidden">
          <Header />
        </div>
        <DemoModeBanner />
        <main ref={mainRef} className="flex-1 overflow-y-auto p-4 lg:p-6 pb-[calc(env(safe-area-inset-bottom)+5rem)] lg:pb-6 print:overflow-visible print:p-0">
          <div className="max-w-[1600px] mx-auto">
            <Routes>
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/programmes" element={<RoleGuard requireClientAdmin><Programmes /></RoleGuard>} />
              <Route path="/programmes/new" element={<RoleGuard requireClientAdmin><ProgrammeInitiation /></RoleGuard>} />
              <Route path="/programmes/edit/:id" element={<RoleGuard requireClientAdmin><ProgrammeInitiation /></RoleGuard>} />

              {/* Overview*/}
              <Route path="/my-tasks" element={<MyTasks />} />
              <Route path="/calendar" element={<Calendar />} />
              <Route path="/projects" element={<Projects />} />
              
              {/* v3.0 Canonical Project Routes*/}
              <Route path="/project/initiation" element={<ProjectInitiation />} />
              <Route path="/project/plan" element={<ProjectPlan />} />
              
              {/* Old Route Redirects*/}
              <Route path="/projects/new" element={<Navigate to="/project/initiation" replace />} />
              <Route path="/initiate" element={<Navigate to="/project/initiation" replace />} />
              <Route path="/project-plan" element={<Navigate to="/project/plan" replace />} />
              <Route path="/projects/edit/:id" element={<ProjectInitiation />} />

              {/* Setup (Client Admin)*/}
              <Route path="/setup/workspace" element={<RoleGuard requireClientAdmin><WorkspaceSettings /></RoleGuard>} />
              <Route path="/integrations" element={<RoleGuard requireClientAdmin><IntegrationsPage /></RoleGuard>} />
              <Route path="/setup/programme" element={<RoleGuard requireClientAdmin><ProgrammeInitiation /></RoleGuard>} />
              <Route path="/setup/project" element={<ComplianceSetup />} />
              
              {/* v3.0 Canonical Regulation Routes*/}
              <Route path="/regulations" element={<RegulationLibrary />} />
              <Route path="/regulations/cpd" element={<CPDTraining />} />
              
              {/* Old Route Redirects*/}
              <Route path="/setup/regulations" element={<Navigate to="/regulations" replace />} />
              <Route path="/training" element={<Navigate to="/regulations/cpd" replace />} />

              {/* Compliance*/}
              <Route path="/compliance/setup" element={<ComplianceSetup />} />
              <Route path="/compliance/dashboard" element={<ComplianceDashboard />} />
              <Route path="/compliance/tracker" element={<ComplianceTracker />} />
              <Route path="/compliance/evidence" element={<EvidenceDocuments />} />
              <Route path="/compliance/linked-regs" element={<LinkedRegs />} />
              <Route path="/compliance/alerts" element={<ComplianceAlerts />} />

              {/* Risk Management*/}
              <Route path="/risk/programme-context" element={<ProgrammeContext />} />
              <Route path="/risk/setup" element={<RiskSetup />} />
              <Route path="/risk/dashboard" element={<RiskDashboard />} />
              <Route path="/risk/programme-register" element={<ProgrammeRiskRegister />} />
              <Route path="/risk/register" element={<RiskRegister />} />
              <Route path="/risk/programme-issues" element={<ProgrammeIssues />} />
              <Route path="/risk/issues" element={<RiskIssues />} />
              <Route path="/risk/alerts" element={<RiskAlerts />} />
              <Route path="/risk/report" element={<Navigate to="/reporting/project" replace />} />

              {/* Monitoring & Reporting*/}
              <Route path="/monitoring/kri" element={<KRITracker />} />
              <Route path="/monitoring/alerts" element={<RiskAlerts />} />
              <Route path="/monitoring/aggregation" element={<RiskAggregation />} />
              <Route path="/monitoring/heatmaps" element={<TrendsHeatmaps />} />
              <Route path="/monitoring/detected-alerts" element={<AlertsPage />} />
              <Route path="/reporting/executive" element={<ExecutiveReport />} />
              <Route path="/reporting/project" element={<ProjectReport />} />
              <Route path="/reporting/programme" element={<ClientProgrammeReport />} />
              <Route path="/reporting/programme-report" element={<ProgrammeReport />} />

              {/* Resource Planner — Programme Manager tier only (admin /
                  client_admin / programme_manager); project managers excluded. */}
              <Route path="/resource-planner" element={<Navigate to="/resource-planner/dashboard" replace />} />
              <Route path="/resource-planner/dashboard" element={<RoleGuard requireProgrammeManager><ResourcePlannerDashboardPage /></RoleGuard>} />
              <Route path="/resource-planner/schemes" element={<RoleGuard requireProgrammeManager><SchemeRegisterPage /></RoleGuard>} />
              <Route path="/resource-planner/forecast" element={<RoleGuard requireProgrammeManager><DemandForecastPage /></RoleGuard>} />
              <Route path="/resource-planner/capacity" element={<RoleGuard requireProgrammeManager><ResourceCapacityPage /></RoleGuard>} />
              <Route path="/resource-planner/timeline" element={<RoleGuard requireProgrammeManager><ResourceTimelinePage /></RoleGuard>} />
              <Route path="/resource-planner/assumptions" element={<RoleGuard requireProgrammeManager><ResourceAssumptionsPage /></RoleGuard>} />

              {/* Assurance escalation hub — view + manage gated in-page (PM+) */}
              <Route path="/assurance" element={<AssuranceHubPage />} />

              {/* Controls library — view = any signed-in user; edits gated in-page (PM+) */}
              <Route path="/controls" element={<Navigate to="/controls/register" replace />} />
              <Route path="/controls/register" element={<ControlsRegisterPage />} />

              {/* Incident management — log = any signed-in user; close/delete gated (PM+) */}
              <Route path="/incidents" element={<Navigate to="/incidents/register" replace />} />
              <Route path="/incidents/register" element={<IncidentsRegisterPage />} />

              {/* Learning & improvement engine — recurrence signals + AI-suggested CAPA actions */}
              <Route path="/learning/improvement" element={<LearningEnginePage />} />

              {/* SaaS & Admin*/}
              <Route path="/admin/*" element={<RoleGuard requireAdmin><AdminPanel /></RoleGuard>} />
              <Route path="/admin/calculator" element={<RoleGuard requireAdmin><CostCalculator /></RoleGuard>} />
              <Route path="/admin/mapping" element={<RoleGuard requireAdmin><MappingManager /></RoleGuard>} />

              {/* Automated Intelligence*/}
              <Route path="/risk/ai" element={<AIRiskID />} />
              <Route path="/ai/controls" element={<AIControlSuggestions />} />
              <Route path="/ai/compliance" element={<AIComplianceOutlook />} />

              {/* Developer*/}
              {/* Developer*/}
              <Route path="/developer/keys" element={<DeveloperSettings />} />
              <Route path="/developer/docs" element={<APIDocs />} />
              
              {/* Old Route Redirects*/}
              <Route path="/settings/developer" element={<Navigate to="/developer/keys" replace />} />
              <Route path="/api-docs" element={<Navigate to="/developer/docs" replace />} />

              {/* Help Center*/}
              <Route path="/help" element={<HelpCenter />} />

              {/* Team Management*/}
              <Route path="/team" element={<RoleGuard requireAdmin><ClientTeamPanel /></RoleGuard>} />

              {/* Knowledge & Training*/}
              <Route path="/training" element={<CPDTraining />} />
              <Route path="/lessons-learned" element={<LessonsLearned />} />

              {/* Billing*/}
              <Route path="/admin/billing" element={<RoleGuard requireAdmin><BillingPanel /></RoleGuard>} />

              {/* Programme Governance*/}
              <Route path="/governance/dashboard" element={<RoleGuard requirePM><GovernanceDashboardPage /></RoleGuard>} />
              <Route path="/governance/forward-plan" element={<RoleGuard requirePM><GovernanceForwardPlanPage /></RoleGuard>} />
              <Route path="/governance/my-reports" element={<RoleGuard requirePM><GovernanceMyReportsPage /></RoleGuard>} />
              <Route path="/governance/reports" element={<RoleGuard requirePM><GovernanceTemplatesPage /></RoleGuard>} />
              <Route path="/governance/reports-list" element={<RoleGuard requirePM><GovernanceReportsListPage /></RoleGuard>} />
              <Route path="/governance/reports-list/:id" element={<RoleGuard requirePM><ReportAuthoringPage /></RoleGuard>} />
              <Route path="/governance/meetings" element={<RoleGuard requirePM><GovernanceMeetingsPage /></RoleGuard>} />
              <Route path="/governance/framework" element={<RoleGuard requireClientAdmin><GovernanceFrameworkPage /></RoleGuard>} />
              <Route path="/governance/archive" element={<RoleGuard requirePM><GovernanceArchivePage /></RoleGuard>} />
              {/*public board calendar. Q14 = c.
 Read-only view of every scheduled meeting; available
 to all signed-in workspace members (no PM role gate).*/}
              <Route path="/governance/board-calendar" element={<GovernanceBoardCalendarPage />} />
              {/* Project Governance Folder. Scopes by global
 activeProjectId (mirrors ComplianceTracker / RiskRegister).*/}
              <Route path="/governance/project-docs" element={<RoleGuard requirePM><ProjectGovernanceDocsPage /></RoleGuard>} />
              <Route path="/governance/editor-sandbox" element={<RoleGuard requireClientAdmin><GovernanceEditorSandboxPage /></RoleGuard>} />

              {/* Technical Assurance Companion (TAC) — placeholders.
 Routes shipped now so the sidebar links resolve; real
 surfaces land in Phases 1-9 per plan §TAC-8.*/}
              <Route path="/technical-assurance/enquiries" element={<RoleGuard requirePM><TacEnquiriesListPage /></RoleGuard>} />
              <Route path="/technical-assurance/enquiries/:id" element={<RoleGuard requirePM><TacEnquiryWorkspacePage /></RoleGuard>} />
              <Route path="/technical-assurance/rfis" element={<RoleGuard requirePM><TacRfiRegisterPage /></RoleGuard>} />
              <Route path="/technical-assurance/audit" element={<ComplianceLeadGuard><TacAuditDashboardPage /></ComplianceLeadGuard>} />

              {/* AI Chat — viewers can open the page (read-only preview), but
                  sending a message is blocked client-side with the Request
                  Access modal and, defence-in-depth, server-side (chatStream is
                  not in the viewer allowlist). */}
              <Route path="/chat" element={<ChatPage />} />

              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </div>
        </main>
        <MobileNav />
        {/* Global CedarGuard AI floating button — appears on every authenticated
 route except those with their own per-page AI button (skip set inside
 the component) and routes where it doesn't fit (login, editor sandbox,
 report authoring).*/}
        <GlobalAIAssistant />
        {/* Global ⌘K command palette — opened by Cmd/Ctrl+K or by
            dispatching `cg:open-command-palette` on window. */}
        <CommandPalette
          open={commandPaletteOpen}
          onClose={() => setCommandPaletteOpen(false)}
        />
        {/* Global Modals rendered at the root to avoid CSS positioning traps*/}
        {isProfileSettingsOpen && (
          <ProfileSettingsModal
            isOpen={isProfileSettingsOpen}
            onClose={() => setProfileSettingsOpen(false)}
          />
        )}
        <RequestAccessModal
          isOpen={isAccessRequestOpen}
          onClose={closeAccessRequestModal}
          attemptedAction={accessRequestAttemptedAction}
        />
        {/* Full-page context-switching overlay — sits above everything*/}
        <ContextSwitchingOverlay />
      </div>
    </div>

  );
}

import { ErrorBoundary } from './components/ErrorBoundary';
import { NotificationWrapper } from './components/NotificationWrapper';
import { Toaster } from 'react-hot-toast';
import { CustomToast } from './components/CustomToast';

export default function App() {
  const setDeferredPrompt = useStore(state => state.setDeferredPrompt);
  const isDarkMode = useStore(state => state.isDarkMode);
  const isMarketingDarkMode = useStore(state => state.isMarketingDarkMode);
  const user = useStore(state => state.user);

  React.useEffect(() => {
    // Determine which theme to apply based on whether the user is in the portal or public view
    // Note: Public routes like /help and /api-docs are handled by PublicLayout when unauthenticated
    const themeToApply = user ? isDarkMode : isMarketingDarkMode;

    if (themeToApply) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode, isMarketingDarkMode, user]);


  React.useEffect(() => {
    // PWA install prompt is web-only. Desktop ships as a native binary.
    if (isDesktop) return;

    const handler = (e: any) => {
      // Prevent the mini-infobar from appearing on mobile
      e.preventDefault();
      // Stash the event so it can be triggered later.
      console.log('Capture beforeinstallprompt', e);
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handler);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
    };
  }, [setDeferredPrompt]);

  return (
    <Router>
      <ErrorBoundary>
        {/* PT-HealthBanner — non-blocking offline indicator. Renders nothing
            on web or when the backend is reachable; thin red sticky banner
            otherwise. Above AuthProvider so it shows even pre-sign-in. */}
        <HealthBanner />
        <AuthProvider>
          <NotificationWrapper>
            <AppContent />
            <Toaster
              position="top-right"
              toastOptions={{
                success: { duration: 4000 },
                error:   { duration: 6000 },
              }}
            >
              {(t) => <CustomToast t={t} />}
            </Toaster>
          </NotificationWrapper>
        </AuthProvider>
      </ErrorBoundary>
    </Router>
  );
}
