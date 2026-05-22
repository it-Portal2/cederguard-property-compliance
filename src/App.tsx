import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';

import { MobileNav } from './components/MobileNav';

import { Dashboard } from './pages/Dashboard';
import { ComplianceSetup } from './pages/ComplianceSetup';
import { ComplianceTracker } from './pages/ComplianceTracker';
import { ComplianceDashboard } from './pages/ComplianceDashboard';
import { LinkedRegs } from './pages/LinkedRegs';
import { ComplianceAlerts } from './pages/ComplianceAlerts';
import { RiskRegister } from './pages/RiskRegister';
import { RiskIssues } from './pages/RiskIssues';
import { RiskAggregation } from './pages/RiskAggregation';
import { RiskTracker } from './pages/RiskTracker';
import { RiskAlerts } from './pages/RiskAlerts';
import { RiskDashboard } from './pages/RiskDashboard';
import { AIRiskID } from './pages/AIRiskID';
import { AdminPanel } from './pages/AdminPanel';
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
import { Projects } from './pages/Projects';
import { ProjectInitiation } from './pages/ProjectInitiation';
import { MyTasks } from './pages/MyTasks';
import { WorkspaceSettings } from './pages/WorkspaceSettings';
import { RegulationLibrary } from './pages/RegulationLibrary';
import { RiskSetup } from './pages/RiskSetup';
import { ProgrammeContext } from './pages/ProgrammeContext';
import { ProgrammeInitiation } from './pages/ProgrammeInitiation';
import { Programmes } from './pages/Programmes';
import { AIControlSuggestions } from './pages/AIControlSuggestions';
import { AIComplianceOutlook } from './pages/AIComplianceOutlook';
import { KRITracker } from './pages/KRITracker';
import { TrendsHeatmaps } from './pages/TrendsHeatmaps';
import { ProgrammeRiskRegister } from './pages/ProgrammeRiskRegister';
import { ProgrammeIssues } from './pages/ProgrammeIssues';
import { ExecutiveReport } from './pages/ExecutiveReport';
import { ProjectReport } from './pages/ProjectReport';
import { ClientProgrammeReport } from './pages/ClientProgrammeReport';
import { ProgrammeReport } from './pages/ProgrammeReport';
import { EvidenceDocuments } from './pages/EvidenceDocuments';
import { DeveloperSettings } from './pages/DeveloperSettings';
import { APIDocs } from './pages/APIDocs';
import { HelpCenter } from './pages/HelpCenter';
import { ClientTeamPanel } from './pages/ClientTeamPanel';
import { MappingManager } from './components/admin/MappingManager';
import { RoleGuard } from './components/RoleGuard';
import { Calendar } from './pages/Calendar';
import { CostCalculator } from './pages/CostCalculator';
import { CPDTraining } from './pages/CPDTraining';
import { LessonsLearned } from './pages/LessonsLearned';
import { ProjectPlan } from './pages/ProjectPlan';


import { BillingPanel } from './pages/BillingPanel';
import { MobileHeader } from './components/MobileHeader';
import { ProfileSettingsModal } from './components/ProfileSettingsModal';
import { GlobalAIAssistant } from './components/GlobalAIAssistant';
import { CommandPalette } from './components/CommandPalette';

// Programme Governance (placeholder pages)
import { GovernanceDashboardPage } from './pages/governance/DashboardPage';
import { GovernanceForwardPlanPage } from './pages/governance/ForwardPlanPage';
import { GovernanceMyReportsPage } from './pages/governance/MyReportsPage';
import { GovernanceTemplatesPage } from './pages/governance/TemplatesPage';
import { GovernanceMeetingsPage } from './pages/governance/MeetingsPage';
import { GovernanceFrameworkPage } from './pages/governance/FrameworkPage';
import { GovernanceArchivePage } from './pages/governance/ArchivePage';
import { GovernanceBoardCalendarPage } from './pages/governance/BoardCalendarPage';
import { ProjectGovernanceDocsPage } from './pages/governance/ProjectGovernanceDocsPage';
// Programme Governance (editor sandbox)
import { GovernanceEditorSandboxPage } from './pages/governance/EditorSandboxPage';
// Programme Governance (Reports CRUD shell)
import { GovernanceReportsListPage } from './pages/governance/ReportsListPage';
// Programme Governance (Report authoring with Tiptap editor)
import { ReportAuthoringPage } from './pages/governance/ReportAuthoringPage';

// Technical Assurance Companion (placeholder pages)
import { TacEnquiriesListPage } from './pages/technicalAssurance/EnquiriesListPage';
import { TacEnquiryWorkspacePage } from './pages/technicalAssurance/EnquiryWorkspacePage';
import { TacRfiRegisterPage } from './pages/technicalAssurance/RfiRegisterPage';
import { TacAuditDashboardPage } from './pages/technicalAssurance/AuditDashboardPage';
import { ComplianceLeadGuard } from './components/technicalAssurance/ComplianceLeadGuard';
import { ChatPage } from './pages/ChatPage';

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
  const routerLocation = useLocation();
  const mainRef = React.useRef<HTMLDivElement>(null);

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
        <div className="hidden md:block print:hidden">
          <Header />
        </div>
        <main ref={mainRef} className="flex-1 overflow-y-auto p-4 md:p-6 pb-[calc(env(safe-area-inset-bottom)+5rem)] md:pb-6 print:overflow-visible print:p-0">
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
              <Route path="/reporting/executive" element={<ExecutiveReport />} />
              <Route path="/reporting/project" element={<ProjectReport />} />
              <Route path="/reporting/programme" element={<ClientProgrammeReport />} />
              <Route path="/reporting/programme-report" element={<ProgrammeReport />} />

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

              {/* AI Chat */}
              {/* AI Chat is gated to PM+ — viewers shouldn't be able to query
                  data their UI normally hides via the assistant. */}
              <Route path="/chat" element={<RoleGuard requirePM><ChatPage /></RoleGuard>} />

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
