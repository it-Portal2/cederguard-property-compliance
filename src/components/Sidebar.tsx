import React from 'react';
import { NavLink } from 'react-router';
import {
  LayoutDashboard, CheckSquare, Settings2, FolderKanban, BookOpen, Shield,
  FileCheck2, Files, Link2, AlertTriangle, FileWarning, Activity,
  ShieldAlert, Brain, BarChart, BellRing, Layers, TrendingUp,
  ClipboardList, PieChart, ScrollText, Gavel, Users, User, LogOut,
  ChevronDown, ChevronRight, FileBarChart, LayoutTemplate, Plus, Target, Wand2,
  Terminal, KeyRound, HelpCircle, Calculator, Rocket, CreditCard, FileText, Calendar as CalendarIcon, X, Map
} from 'lucide-react';
import { clsx } from 'clsx';
import { useStore } from '../store/useStore';
import { logout } from '../lib/firebase';
import { useNavigate, useSearchParams, useLocation } from 'react-router';
import { useState, useEffect } from 'react';
import { isSuperAdmin, isAtLeastClientAdmin, isAtLeastPM, canCreateProject, canCreateProgramme, isSystemAdmin } from '../lib/roles';

interface NavGroupProps {
  label: string;
  children: React.ReactNode;
  adminOnly?: boolean;
  isAdmin: boolean;
  isOpen?: boolean;
  onToggle?: () => void;
}

function NavGroup({ label, children, adminOnly = false, isAdmin, isOpen, onToggle }: NavGroupProps) {
  if (adminOnly && !isAdmin) return null;
  return (
    <div className="mb-2">
      <button
        onClick={onToggle}
        className={clsx(
          "w-full flex items-center justify-between px-3 mb-1 py-3 md:py-1.5 text-[10px] font-black uppercase tracking-widest transition-all group/groupbtn",
          isOpen ? "text-indigo-600 bg-indigo-50/50 rounded-lg" : "text-slate-400 hover:text-indigo-600"
        )}
      >
        <span className="group-hover/groupbtn:translate-x-1 transition-transform truncate pr-2 text-left">{label}</span>
        {isOpen ? <ChevronDown className="w-4 h-4 md:w-3.5 md:h-3.5 flex-shrink-0" /> : <ChevronRight className="w-4 h-4 md:w-3.5 md:h-3.5 flex-shrink-0" />}
      </button>
      {isOpen && (
        <div className="space-y-0.5 animate-in fade-in slide-in-from-top-1 duration-200">
          {children}
        </div>
      )}
    </div>
  );
}

function NavItem({ to, icon: Icon, label, iconClass }: { to: string; icon: any; label: string; iconClass?: string }) {
  const [searchParams] = useSearchParams();
  const fromInitiation = searchParams.get('from') === 'initiation';

  let finalTo = to;
  if (fromInitiation && !to.includes('from=initiation')) {
    finalTo += (to.includes('?') ? '&' : '?') + 'from=initiation';
  }

  return (
    <NavLink
      to={finalTo}
      className={({ isActive }) => clsx(
        "flex items-center gap-2.5 px-3 py-3 md:py-2 rounded-xl text-[13px] font-bold transition-all duration-300 group",
        isActive
          ? "bg-slate-900 text-white shadow-lg shadow-slate-200 scale-[1.02]"
          : "text-slate-500 hover:bg-indigo-50 hover:text-indigo-600 hover:pl-4"
      )}
      onClick={() => {
        // Auto-close mobile menu on navigation
        if (window.innerWidth < 768) {
          useStore.getState().setMobileMenuOpen(false);
        }
      }}
    >
      <Icon className={clsx("w-4 h-4 flex-shrink-0 transition-transform duration-300 group-hover:scale-110", iconClass)} />
      <span className="truncate">{label}</span>
    </NavLink>
  );
}

export function Sidebar() {
  const { user, activeProjectId, activeProgrammeId, isMobileMenuOpen, setMobileMenuOpen, setProfileSettingsOpen } = useStore();
  const navigate = useNavigate();
  const [showHiddenSetup, setShowHiddenSetup] = useState(false);
  const location = useLocation();
  const [openGroup, setOpenGroup] = useState<string | null>('Overview');

  const toggleGroup = (group: string) => {
    setOpenGroup(prev => prev === group ? null : group);
  };

  // Auto-expand based on route
  useEffect(() => {
    const path = location.pathname;
    if (path.startsWith('/dashboard') || path.startsWith('/calendar') || path.startsWith('/tasks')) {
      setOpenGroup('Overview');
    } else if (path.startsWith('/project/initiation') || path.startsWith('/projects/edit') || path.startsWith('/project/plan')) {
      setOpenGroup('Project Initiation');
    } else if (path.startsWith('/programmes')) {
      setOpenGroup('Programme Initiation');
    } else if (path.startsWith('/projects')) {
      setOpenGroup('Overview');
    } else if (path.startsWith('/compliance')) {
      setOpenGroup('Compliance');
    } else if (path.startsWith('/regulations')) {
      setOpenGroup('Regulations Library');
    } else if (path.startsWith('/risk') && !path.startsWith('/risk/ai')) {
      setOpenGroup('Risk Management');
    } else if (path.startsWith('/risk/ai') || path.startsWith('/ai/')) {
      setOpenGroup('Automated Intelligence');
    } else if (path.startsWith('/monitoring')) {
      setOpenGroup('Monitoring & Reporting');
    } else if (path.startsWith('/reporting')) {
      setOpenGroup('Reports');
    } else if (path.startsWith('/governance')) {
      setOpenGroup('Programme Governance');
    } else if (path.startsWith('/setup/workspace') || path.startsWith('/team') || path.startsWith('/admin')) {
      setOpenGroup('Account');
    } else if (path.startsWith('/developer')) {
      setOpenGroup('Developer / API');
    } else if (path.startsWith('/help')) {
      setOpenGroup('Help');
    }
  }, [location.pathname]);

  const userRole = user?.role;
  const isAdmin = isSuperAdmin(user?.email, userRole);
  const isClientAdmin = isAtLeastClientAdmin(userRole) || isAdmin;
  const isProjectManager = isAtLeastPM(userRole);
  // PMs + Client Admins both get access to core project functionality
  const hasCoreAccess = isClientAdmin || isProjectManager;
  const canNewProject = canCreateProject(userRole);
  const canNewProgramme = canCreateProgramme(userRole);


  const handleLogout = async () => {
    try {
      await logout();
      useStore.getState().setUser(null);
      navigate('/login');
    } catch (error) {
      console.error('Logout failed', error);
    }
  };

  return (
    <>
      {/* Mobile Backdrop overlay */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/50 z-40 md:hidden backdrop-blur-sm transition-opacity"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      <div className={clsx(
        "w-64 bg-white border-r border-slate-200 flex flex-col h-full fixed inset-y-0 left-0 z-50 transform transition-transform duration-300 md:relative md:translate-x-0 print:hidden",
        isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        {/* Logo */}
        <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
          <img
            src="/logo.png"
            alt="Cedar – Risk Intelligence & Compliance Platform"
            className="w-full max-w-[150px] h-auto object-contain"
          />
          <button 
            className="md:hidden p-1 text-slate-400 hover:bg-slate-100 rounded-lg transition-colors"
            onClick={() => setMobileMenuOpen(false)}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

      <div className="flex-1 overflow-y-auto py-3 px-2 space-y-4">


        {/* OVERVIEW */}
        {hasCoreAccess && (
          <NavGroup 
            label="Overview" 
            isAdmin={hasCoreAccess} 
            isOpen={openGroup === 'Overview'} 
            onToggle={() => toggleGroup('Overview')}
          >
            <NavItem to="/dashboard" icon={LayoutDashboard} label="Dashboard" />
            <NavItem to="/calendar" icon={CalendarIcon} label="Calendar" />
            <NavItem to="/my-tasks" icon={CheckSquare} label="My Tasks" />
            <NavItem to="/projects" icon={FolderKanban} label="All Projects" />
          </NavGroup>
        )}

        {/* PROGRAMME INITIATION */}
        {canNewProgramme && (
          <NavGroup 
            label="Programme Initiation" 
            isAdmin={true} 
            isOpen={openGroup === 'Programme Initiation'} 
            onToggle={() => toggleGroup('Programme Initiation')}
          >
            <NavItem to="/programmes" icon={LayoutTemplate} label="All Programmes" />
            <NavItem to="/programmes/new" icon={Rocket} label="Programme Initiation" iconClass="text-indigo-600" />
            <NavItem to="/compliance/linked-regs?type=programme" icon={Link2} label="Programme Plan" />
          </NavGroup>
        )}


        {/* PROJECT INITIATION */}
        {canNewProject && (
          <NavGroup 
            label="Project Initiation" 
            isAdmin={true} 
            isOpen={openGroup === 'Project Initiation'} 
            onToggle={() => toggleGroup('Project Initiation')}
          >
            <NavItem to="/project/initiation" icon={Rocket} label="Project Initiation" iconClass="text-indigo-600" />
            <NavItem to="/project/plan" icon={Map} label="Project Plan" iconClass="text-blue-500" />
          </NavGroup>
        )}

        {/* COMPLIANCE */}
        <NavGroup 
          label="Compliance" 
          isAdmin={hasCoreAccess} 
          isOpen={openGroup === 'Compliance'} 
          onToggle={() => toggleGroup('Compliance')}
        >
          <NavItem to={`/compliance/setup${activeProjectId ? '?type=project' : activeProgrammeId ? '?type=programme' : ''}`} icon={Brain} label="Setup" />
          <NavItem to={`/compliance/dashboard${activeProjectId ? '?type=project' : activeProgrammeId ? '?type=programme' : ''}`} icon={LayoutDashboard} label="Dashboard" />
          <NavItem to={`/compliance/tracker${activeProjectId ? '?type=project' : activeProgrammeId ? '?type=programme' : ''}`} icon={CheckSquare} label="Tracker" />
          <NavItem to={`/compliance/alerts${activeProjectId ? '?type=project' : activeProgrammeId ? '?type=programme' : ''}`} icon={AlertTriangle} label="Alerts" />
          <NavItem to={`/compliance/evidence${activeProjectId ? '?type=project' : activeProgrammeId ? '?type=programme' : ''}`} icon={Files} label="Evidence & Documents" />
        </NavGroup>

        {/* REGULATIONS LIBRARY */}
        <NavGroup 
          label="Regulations Library" 
          isAdmin={hasCoreAccess} 
          isOpen={openGroup === 'Regulations Library'} 
          onToggle={() => toggleGroup('Regulations Library')}
        >
          <NavItem to="/regulations" icon={BookOpen} label="Regulations Library" />
          <NavItem to="/regulations/cpd" icon={Activity} label="CPD Training - Beta" iconClass="text-indigo-500" />
        </NavGroup>

        {/* RISK MANAGEMENT */}
        <NavGroup 
          label="Risk Management" 
          isAdmin={hasCoreAccess} 
          isOpen={openGroup === 'Risk Management'} 
          onToggle={() => toggleGroup('Risk Management')}
        >
          <NavItem to={`/risk/setup${activeProjectId ? '?type=project' : activeProgrammeId ? '?type=programme' : ''}`} icon={Brain} label="Risk Setup" />
          <NavItem to={`/risk/dashboard${activeProjectId ? '?type=project' : activeProgrammeId ? '?type=programme' : ''}`} icon={LayoutDashboard} label="Dashboard" />
          <NavItem to={`${activeProjectId ? '/risk/register?type=project' : activeProgrammeId ? '/risk/programme-register?type=programme' : '/risk/register'}`} icon={Layers} label="Risk Register" />
          <NavItem to={`/risk/issues?type=${activeProgrammeId ? 'programme' : 'project'}`} icon={FileWarning} label="Issues Log" />
          <NavItem to={`/risk/alerts${activeProjectId ? '?type=project' : activeProgrammeId ? '?type=programme' : ''}`} icon={ShieldAlert} label="Risk Alerts" />
          <NavItem to="/lessons-learned" icon={FileBarChart} label="Lessons Learned" />
        </NavGroup>

        {/* AUTOMATED INTELLIGENCE */}
        <NavGroup 
          label="Automated Intelligence" 
          isAdmin={hasCoreAccess} 
          isOpen={openGroup === 'Automated Intelligence'} 
          onToggle={() => toggleGroup('Automated Intelligence')}
        >
          <NavItem to="/risk/ai" icon={Wand2} label="AI Risk Inquiry" iconClass="text-indigo-600" />
          <NavItem to="/ai/controls" icon={ShieldAlert} label="Mitigation & Control Strategy" iconClass="text-indigo-600" />
          <NavItem to="/ai/compliance" icon={Brain} label="Compliance Posture Outlook" iconClass="text-indigo-600" />
        </NavGroup>

        {/* MONITORING & REPORTING — Client Admin only */}
        {isClientAdmin && (
          <NavGroup 
            label="Monitoring & Reporting" 
            isAdmin={true} 
            isOpen={openGroup === 'Monitoring & Reporting'} 
            onToggle={() => toggleGroup('Monitoring & Reporting')}
          >
            <NavItem to="/monitoring/kri" icon={BarChart} label="KRI Tracker" />
            <NavItem to="/monitoring/alerts" icon={BellRing} label="Alerts & Thresholds" />
            <NavItem to="/monitoring/aggregation" icon={Layers} label="Risk Aggregation Data" />
            <NavItem to="/monitoring/heatmaps" icon={TrendingUp} label="Trends & Heatmaps" />
          </NavGroup>
        )}

        {/* REPORTS */}
        <NavGroup
          label="Reports"
          isAdmin={hasCoreAccess}
          isOpen={openGroup === 'Reports'}
          onToggle={() => toggleGroup('Reports')}
        >
          {isClientAdmin && (
            <>
              <NavItem to="/reporting/executive" icon={PieChart} label="Executive Reports" />
              <NavItem to="/reporting/programme-report" icon={BarChart} label="Programme Report" />
            </>
          )}
          <NavItem to="/reporting/project" icon={ClipboardList} label="Project Reports" />
        </NavGroup>

        {/* PROGRAMME GOVERNANCE */}
        {hasCoreAccess && (
          <NavGroup
            label="Programme Governance"
            isAdmin={hasCoreAccess}
            isOpen={openGroup === 'Programme Governance'}
            onToggle={() => toggleGroup('Programme Governance')}
          >
            <NavItem to="/governance/dashboard" icon={LayoutDashboard} label="Dashboard" />
            <NavItem to="/governance/forward-plan" icon={CalendarIcon} label="Forward Plan" />
            {isProjectManager && (
              <NavItem to="/governance/my-reports" icon={ClipboardList} label="My Reports" />
            )}
            <NavItem to="/governance/reports" icon={FileText} label="Reports & Templates" />
            <NavItem to="/governance/meetings" icon={Users} label="Meetings" />
            {isClientAdmin && (
              <NavItem to="/governance/framework" icon={Gavel} label="Framework" iconClass="text-indigo-600" />
            )}
            <NavItem to="/governance/archive" icon={ScrollText} label="Archive & Audit" />
          </NavGroup>
        )}

        {/* ACCOUNT */}
        {(isClientAdmin || isAdmin) && (
          <NavGroup 
            label="Account" 
            isAdmin={hasCoreAccess} 
            isOpen={openGroup === 'Account'} 
            onToggle={() => toggleGroup('Account')}
          >
            {isClientAdmin && <NavItem to="/setup/workspace" icon={Settings2} label="Workspace Management" />}
            {isSystemAdmin(user?.email) && (
              <>
                <NavItem to="/team" icon={Users} label="Team Management" iconClass="text-indigo-500" />
                <NavItem to="/admin/billing" icon={CreditCard} label="Billing & Subscription" iconClass="text-emerald-500" />
                <NavItem to="/admin" icon={Shield} label="Platform Admin" iconClass="text-orange-500" />
                <NavItem to="/admin/calculator" icon={Calculator} label="Cost Calculator" iconClass="text-violet-500" />
              </>
            )}
          </NavGroup>
        )}

        {/* DEVELOPER — visible to all Client Admins */}
        {isClientAdmin && (
          <NavGroup 
            label="Developer / API" 
            isAdmin={isClientAdmin} 
            isOpen={openGroup === 'Developer / API'} 
            onToggle={() => toggleGroup('Developer / API')}
          >
            <NavItem to="/developer/keys" icon={KeyRound} label="API Keys" />
            <NavItem to="/developer/docs" icon={Terminal} label="API Documentation" />
          </NavGroup>
        )}

        {/* HELP */}
        {hasCoreAccess && (
          <NavGroup 
            label="Help" 
            isAdmin={true} 
            isOpen={openGroup === 'Help'} 
            onToggle={() => toggleGroup('Help')}
          >
            <NavItem to="/help" icon={HelpCircle} label="Help Centre" iconClass="text-indigo-500" />
          </NavGroup>
        )}

      {/* Profile & Sign Out */}
        <div className="pt-2 pb-8 md:pb-2 border-t border-slate-100 space-y-0.5">
          <button
            onClick={() => setProfileSettingsOpen(true)}
            className="w-full text-left flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-[13px] font-medium transition-colors text-slate-600 hover:bg-slate-100 hover:text-slate-900"
          >
            <User className="w-3.5 h-3.5 flex-shrink-0" /> Profile Settings
          </button>
          <button
            onClick={handleLogout}
            className="w-full text-left flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-[13px] font-medium transition-colors text-red-600 hover:bg-red-50 mb-6"
          >
            <LogOut className="w-3.5 h-3.5 flex-shrink-0" /> Sign Out
          </button>
        </div>
      </div>

      </div>
    </>
  );
}
