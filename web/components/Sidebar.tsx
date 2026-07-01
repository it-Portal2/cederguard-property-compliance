import React from "react";
import { NavLink } from "react-router";
import {
  LayoutDashboard,
  CheckSquare,
  Settings2,
  FolderKanban,
  BookOpen,
  Shield,
  FileCheck2,
  Files,
  Link2,
  AlertTriangle,
  FileWarning,
  Activity,
  ShieldAlert,
  Brain,
  BarChart,
  BellRing,
  Layers,
  TrendingUp,
  ClipboardList,
  PieChart,
  ScrollText,
  Gavel,
  Users,
  LogOut,
  ChevronDown,
  FileBarChart,
  Gauge,
  LayoutTemplate,
  Plus,
  Target,
  Wand2,
  Terminal,
  KeyRound,
  HelpCircle,
  Rocket,
  FileText,
  Calendar as CalendarIcon,
  X,
  Map,
  FolderClosed,
  MessageSquare,
  ShieldCheck,
  Lightbulb,
  Search,
  SlidersHorizontal,
  Blocks,
} from "lucide-react";
import { clsx } from "clsx";
import { useStore } from "../store/useStore";
import { authBridge } from "../lib/auth/authBridge";
import UserAvatar from "./UserAvatar";
import { useNavigate, useSearchParams, useLocation } from "react-router";
import { useState, useEffect } from "react";
import {
  isSuperAdmin,
  isAtLeastClientAdmin,
  isAtLeastPM,
  canCreateProject,
  canCreateProgramme,
  isComplianceLead,
} from "../lib/roles";

interface NavGroupProps {
  label: string;
  children: React.ReactNode;
  adminOnly?: boolean;
  isAdmin: boolean;
  isOpen?: boolean;
  onToggle?: () => void;
}

// Tiny context for the filter — NavItem reads `query` and self-hides on miss.
const SidebarFilterContext = React.createContext<{ query: string }>({
  query: "",
});

function NavGroup({
  label,
  children,
  adminOnly = false,
  isAdmin,
  isOpen,
  onToggle,
}: NavGroupProps) {
  const { query } = React.useContext(SidebarFilterContext);
  if (adminOnly && !isAdmin) return null;
  // While filtering, always expand and rely on NavItem self-hide.
  // If the group label itself doesn't match the query, NavItem children
  // still hide individually so an empty group is acceptable (renders as
  // just the header). Keep it simple.
  const expanded = query ? true : isOpen;
  return (
    <div className="mb-1">
      <button
        onClick={onToggle}
        className={clsx(
          "w-full flex items-center justify-between px-2.5 py-2 rounded-md font-mono text-[10px] font-medium uppercase tracking-wide transition-colors",
          expanded
            ? "text-slate-700"
            : "text-slate-600 hover:text-slate-700 hover:bg-slate-50",
        )}
      >
        <span className="truncate pr-2 text-left">{label}</span>
        <ChevronDown
          className={clsx(
            "w-3 h-3 shrink-0 transition-transform duration-150 opacity-60",
            expanded ? "rotate-0" : "-rotate-90",
          )}
        />
      </button>
      {expanded && <div className="space-y-0.5 pb-1">{children}</div>}
    </div>
  );
}

function NavItem({
  to,
  icon: Icon,
  label,
  iconClass,
}: {
  to: string;
  icon: any;
  label: string;
  iconClass?: string;
}) {
  const [searchParams] = useSearchParams();
  const fromInitiation = searchParams.get("from") === "initiation";
  const { query } = React.useContext(SidebarFilterContext);

  // Hide on filter miss (case-insensitive substring on the label).
  if (query && !label.toLowerCase().includes(query.toLowerCase())) {
    return null;
  }

  let finalTo = to;
  if (fromInitiation && !to.includes("from=initiation")) {
    finalTo += (to.includes("?") ? "&" : "?") + "from=initiation";
  }

  return (
    <NavLink
      to={finalTo}
      className={({ isActive }) =>
        clsx(
          "relative flex items-center gap-2.5 px-2.5 py-2 md:py-1.5 rounded-md text-[13px] font-medium transition-colors group",
          isActive
            ? "bg-indigo-50 text-slate-900"
            : "text-slate-700 hover:bg-slate-50 hover:text-slate-900",
        )
      }
      onClick={() => {
        if (window.innerWidth < 768) {
          useStore.getState().setMobileMenuOpen(false);
        }
      }}
    >
      {({ isActive }) => (
        <>
          {isActive && (
            <span
              aria-hidden="true"
              className="absolute -left-1.5 top-1.5 bottom-1.5 w-0.5 rounded-full bg-indigo-600"
            />
          )}
          <Icon
            className={clsx(
              "w-4 h-4 flex-shrink-0 transition-colors",
              isActive
                ? "text-indigo-600"
                : "text-slate-500 group-hover:text-slate-700",
              iconClass,
            )}
          />
          <span className="truncate">{label}</span>
        </>
      )}
    </NavLink>
  );
}

export function Sidebar() {
  const {
    user,
    activeProjectId,
    activeProgrammeId,
    isMobileMenuOpen,
    setMobileMenuOpen,
    setProfileSettingsOpen,
  } = useStore();
  const navigate = useNavigate();
  const [showHiddenSetup, setShowHiddenSetup] = useState(false);
  const location = useLocation();
  const [openGroup, setOpenGroup] = useState<string | null>("Overview");
  const [navQuery, setNavQuery] = useState("");

  const toggleGroup = (group: string) => {
    setOpenGroup((prev) => (prev === group ? null : group));
  };

  // Auto-expand based on route
  useEffect(() => {
    const path = location.pathname;
    if (path.startsWith("/chat")) {
      setOpenGroup("Overview");
    } else if (
      path.startsWith("/dashboard") ||
      path.startsWith("/calendar") ||
      path.startsWith("/tasks")
    ) {
      setOpenGroup("Overview");
    } else if (
      path.startsWith("/project/initiation") ||
      path.startsWith("/projects/edit") ||
      path.startsWith("/project/plan")
    ) {
      setOpenGroup("Project Initiation");
    } else if (path.startsWith("/programmes")) {
      setOpenGroup("Programme Initiation");
    } else if (path.startsWith("/projects")) {
      setOpenGroup("Overview");
    } else if (path.startsWith("/compliance")) {
      setOpenGroup("Compliance");
    } else if (path.startsWith("/regulations")) {
      setOpenGroup("Regulations Library");
    } else if (path.startsWith("/technical-assurance")) {
      setOpenGroup("Technical Assurance");
    } else if (path.startsWith("/risk") && !path.startsWith("/risk/ai")) {
      setOpenGroup("Risk Management");
    } else if (path.startsWith("/risk/ai") || path.startsWith("/ai/")) {
      setOpenGroup("Automated Intelligence");
    } else if (path.startsWith("/monitoring")) {
      setOpenGroup("Monitoring & Reporting");
    } else if (path.startsWith("/reporting")) {
      setOpenGroup("Reports");
    } else if (path.startsWith("/governance")) {
      setOpenGroup("Programme Governance");
    } else if (path.startsWith("/resource-planner")) {
      setOpenGroup("Resource Planner");
    } else if (
      path.startsWith("/assurance") ||
      path.startsWith("/controls") ||
      path.startsWith("/incidents") ||
      path.startsWith("/learning/improvement")
    ) {
      setOpenGroup("Assurance");
    } else if (
      path.startsWith("/setup/workspace") ||
      path.startsWith("/team") ||
      path.startsWith("/admin")
    ) {
      setOpenGroup("Account");
    } else if (path.startsWith("/developer")) {
      setOpenGroup("Developer / API");
    } else if (path.startsWith("/help")) {
      setOpenGroup("Help");
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
      await authBridge.signOut();
      useStore.getState().setUser(null);
      navigate("/login");
    } catch (error) {
      console.error("Logout failed", error);
    }
  };

  return (
    <>
      {/* Mobile Backdrop overlay */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 bg-slate-900/50 z-40 lg:hidden backdrop-blur-sm transition-opacity"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      <div
        className={clsx(
          "w-64 bg-white border-r border-slate-200 flex flex-col h-full fixed inset-y-0 left-0 z-50 transform transition-transform duration-300 lg:relative lg:translate-x-0 print:hidden",
          isMobileMenuOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        {/* Logo */}
        <div className="px-4 h-14 border-b border-slate-200 flex items-center justify-between shrink-0">
          <img
            src={`${import.meta.env.BASE_URL}logo.png`}
            alt="Cedar – Risk Intelligence & Compliance Platform"
            className="w-full max-w-[190px] h-11 object-contain"
          />
          <button
            className="lg:hidden p-1 text-slate-400 hover:bg-slate-100 rounded-lg transition-colors"
            onClick={() => setMobileMenuOpen(false)}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Filter input — narrows visible items by label substring. */}
        <div className="px-3 pt-3 pb-1">
          <div className="flex items-center gap-2 h-8 px-2.5 rounded-md bg-slate-50 border border-slate-200">
            <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <input
              type="text"
              value={navQuery}
              onChange={(e) => setNavQuery(e.target.value)}
              placeholder="Filter navigation…"
              className="flex-1 min-w-0 bg-transparent border-0 outline-none text-xs text-slate-700 placeholder:text-slate-400"
              aria-label="Filter sidebar navigation"
            />
            {navQuery && (
              <button
                type="button"
                onClick={() => setNavQuery("")}
                className="shrink-0 text-slate-400 hover:text-slate-700 transition-colors"
                aria-label="Clear filter"
                title="Clear"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>

        <SidebarFilterContext.Provider value={{ query: navQuery }}>
          <div className="flex-1 overflow-y-auto pb-3 px-2 space-y-1">
            {/* OVERVIEW */}
            {hasCoreAccess && (
              <NavGroup
                label="Overview"
                isAdmin={hasCoreAccess}
                isOpen={openGroup === "Overview"}
                onToggle={() => toggleGroup("Overview")}
              >
                <NavItem
                  to="/dashboard"
                  icon={LayoutDashboard}
                  label="Dashboard"
                />
                <NavItem
                  to="/chat"
                  icon={MessageSquare}
                  label="AI Chat"
                  iconClass="text-indigo-500"
                />
                <NavItem to="/calendar" icon={CalendarIcon} label="Calendar" />
                <NavItem to="/my-tasks" icon={CheckSquare} label="My Tasks" />
                <NavItem
                  to="/projects"
                  icon={FolderKanban}
                  label="All Projects"
                />
              </NavGroup>
            )}

            {/* PROGRAMME INITIATION */}
            {canNewProgramme && (
              <NavGroup
                label="Programme Initiation"
                isAdmin={true}
                isOpen={openGroup === "Programme Initiation"}
                onToggle={() => toggleGroup("Programme Initiation")}
              >
                <NavItem
                  to="/programmes"
                  icon={LayoutTemplate}
                  label="All Programmes"
                />
                <NavItem
                  to="/programmes/new"
                  icon={Rocket}
                  label="Programme Initiation"
                  iconClass="text-indigo-600"
                />
                <NavItem
                  to="/compliance/linked-regs?type=programme"
                  icon={Link2}
                  label="Programme Plan"
                />
              </NavGroup>
            )}

            {/* PROJECT INITIATION */}
            {canNewProject && (
              <NavGroup
                label="Project Initiation"
                isAdmin={true}
                isOpen={openGroup === "Project Initiation"}
                onToggle={() => toggleGroup("Project Initiation")}
              >
                <NavItem
                  to="/project/initiation"
                  icon={Rocket}
                  label="Project Initiation"
                  iconClass="text-indigo-600"
                />
                <NavItem
                  to="/project/plan"
                  icon={Map}
                  label="Project Plan"
                  iconClass="text-blue-500"
                />
              </NavGroup>
            )}

            {/* COMPLIANCE */}
            <NavGroup
              label="Compliance"
              isAdmin={hasCoreAccess}
              isOpen={openGroup === "Compliance"}
              onToggle={() => toggleGroup("Compliance")}
            >
              <NavItem
                to={`/compliance/setup${activeProjectId ? "?type=project" : activeProgrammeId ? "?type=programme" : ""}`}
                icon={Brain}
                label="Setup"
              />
              <NavItem
                to={`/compliance/dashboard${activeProjectId ? "?type=project" : activeProgrammeId ? "?type=programme" : ""}`}
                icon={LayoutDashboard}
                label="Dashboard"
              />
              <NavItem
                to={`/compliance/tracker${activeProjectId ? "?type=project" : activeProgrammeId ? "?type=programme" : ""}`}
                icon={CheckSquare}
                label="Tracker"
              />
              <NavItem
                to={`/compliance/alerts${activeProjectId ? "?type=project" : activeProgrammeId ? "?type=programme" : ""}`}
                icon={AlertTriangle}
                label="Alerts"
              />
              <NavItem
                to={`/compliance/evidence${activeProjectId ? "?type=project" : activeProgrammeId ? "?type=programme" : ""}`}
                icon={Files}
                label="Evidence & Documents"
              />
            </NavGroup>

            {/* RISK MANAGEMENT */}
            <NavGroup
              label="Risk Management"
              isAdmin={hasCoreAccess}
              isOpen={openGroup === "Risk Management"}
              onToggle={() => toggleGroup("Risk Management")}
            >
              <NavItem
                to={`/risk/setup${activeProjectId ? "?type=project" : activeProgrammeId ? "?type=programme" : ""}`}
                icon={Brain}
                label="Risk Setup"
              />
              <NavItem
                to={`/risk/dashboard${activeProjectId ? "?type=project" : activeProgrammeId ? "?type=programme" : ""}`}
                icon={LayoutDashboard}
                label="Dashboard"
              />
              <NavItem
                to={`${activeProjectId ? "/risk/register?type=project" : activeProgrammeId ? "/risk/programme-register?type=programme" : "/risk/register"}`}
                icon={Layers}
                label="Risk Register"
              />
              <NavItem
                to={`/risk/issues?type=${activeProgrammeId ? "programme" : "project"}`}
                icon={FileWarning}
                label="Issues Log"
              />
              <NavItem
                to={`/risk/alerts${activeProjectId ? "?type=project" : activeProgrammeId ? "?type=programme" : ""}`}
                icon={ShieldAlert}
                label="Risk Alerts"
              />
              <NavItem
                to="/lessons-learned"
                icon={FileBarChart}
                label="Lessons Learned"
              />
            </NavGroup>

            {/* TECHNICAL ASSURANCE — sibling of Compliance / Risk; PM-owned query surface */}
            {hasCoreAccess && (
              <NavGroup
                label="Technical Assurance"
                isAdmin={hasCoreAccess}
                isOpen={openGroup === "Technical Assurance"}
                onToggle={() => toggleGroup("Technical Assurance")}
              >
                <NavItem
                  to="/technical-assurance/enquiries"
                  icon={MessageSquare}
                  label="Enquiries"
                />
                <NavItem
                  to="/technical-assurance/rfis"
                  icon={ClipboardList}
                  label="RFI Register"
                />
                {/* Audit dashboard — Compliance Leads + Super Admins only.
                Sidebar visibility mirrors the route guard so non-eligible
                users don't see a link they can't open. */}
                {(isAdmin || isComplianceLead(user)) && (
                  <NavItem
                    to="/technical-assurance/audit"
                    icon={ShieldCheck}
                    label="Audit"
                    iconClass="text-indigo-600"
                  />
                )}
              </NavGroup>
            )}

            {/* RESOURCE PLANNER — tenant-wide FTE demand & capacity */}
            {hasCoreAccess && (
              <NavGroup
                label="Resource Planner"
                isAdmin={hasCoreAccess}
                isOpen={openGroup === "Resource Planner"}
                onToggle={() => toggleGroup("Resource Planner")}
              >
                <NavItem
                  to="/resource-planner/dashboard"
                  icon={LayoutDashboard}
                  label="Dashboard"
                />
                <NavItem
                  to="/resource-planner/schemes"
                  icon={ClipboardList}
                  label="Scheme Register"
                />
                <NavItem
                  to="/resource-planner/forecast"
                  icon={TrendingUp}
                  label="Demand Forecast"
                />
                <NavItem
                  to="/resource-planner/capacity"
                  icon={Gauge}
                  label="Capacity"
                />
                <NavItem
                  to="/resource-planner/timeline"
                  icon={CalendarIcon}
                  label="Timeline"
                />
                <NavItem
                  to="/resource-planner/assumptions"
                  icon={SlidersHorizontal}
                  label="Assumptions"
                />
              </NavGroup>
            )}

            {/* ASSURANCE — controls library, incidents (CAPA, checklists, learning to follow) */}
            {hasCoreAccess && (
              <NavGroup
                label="Assurance"
                isAdmin={hasCoreAccess}
                isOpen={openGroup === "Assurance"}
                onToggle={() => toggleGroup("Assurance")}
              >
                <NavItem
                  to="/assurance"
                  icon={ShieldAlert}
                  label="Escalations"
                />
                <NavItem
                  to="/controls/register"
                  icon={ShieldCheck}
                  label="Controls"
                />
                <NavItem
                  to="/incidents/register"
                  icon={AlertTriangle}
                  label="Incidents"
                />
                <NavItem
                  to="/learning/improvement"
                  icon={Lightbulb}
                  label="Improvement"
                />
              </NavGroup>
            )}

            {/* PROGRAMME GOVERNANCE */}
            {hasCoreAccess && (
              <NavGroup
                label="Programme Governance"
                isAdmin={hasCoreAccess}
                isOpen={openGroup === "Programme Governance"}
                onToggle={() => toggleGroup("Programme Governance")}
              >
                <NavItem
                  to="/governance/dashboard"
                  icon={LayoutDashboard}
                  label="Dashboard"
                />
                <NavItem
                  to="/governance/forward-plan"
                  icon={CalendarIcon}
                  label="Forward Plan"
                />
                {/* Role-split per prototype: pure PMs get the personal
                workspace; PgMs / Client Admins get the workspace-wide
                pipeline. Admins see both. Avoids the "two near-identical
                tables" UX trap. */}
                {isProjectManager && !isClientAdmin && (
                  <NavItem
                    to="/governance/my-reports"
                    icon={ClipboardList}
                    label="My reports"
                  />
                )}
                {isClientAdmin && (
                  <NavItem
                    to="/governance/reports-list"
                    icon={FileText}
                    label="Reports"
                  />
                )}
                {isAdmin && (
                  <NavItem
                    to="/governance/my-reports"
                    icon={ClipboardList}
                    label="My reports"
                  />
                )}
                <NavItem
                  to="/governance/reports"
                  icon={ClipboardList}
                  label="Templates"
                />
                <NavItem
                  to="/governance/meetings"
                  icon={Users}
                  label="Meetings"
                />
                <NavItem
                  to="/governance/project-docs"
                  icon={FolderClosed}
                  label="Project Governance"
                />
                {isClientAdmin && (
                  <NavItem
                    to="/governance/framework"
                    icon={Gavel}
                    label="Framework"
                    iconClass="text-indigo-600"
                  />
                )}
                <NavItem
                  to="/governance/archive"
                  icon={ScrollText}
                  label="Archive & Audit"
                />
              </NavGroup>
            )}

            {/* AUTOMATED INTELLIGENCE */}
            <NavGroup
              label="Automated Intelligence"
              isAdmin={hasCoreAccess}
              isOpen={openGroup === "Automated Intelligence"}
              onToggle={() => toggleGroup("Automated Intelligence")}
            >
              <NavItem
                to="/risk/ai"
                icon={Wand2}
                label="AI Risk Inquiry"
                iconClass="text-indigo-600"
              />
              <NavItem
                to="/ai/controls"
                icon={ShieldAlert}
                label="Mitigation & Control Strategy"
                iconClass="text-indigo-600"
              />
              <NavItem
                to="/ai/compliance"
                icon={Brain}
                label="Compliance Posture Outlook"
                iconClass="text-indigo-600"
              />
            </NavGroup>

            {/* MONITORING & REPORTING — Client Admin only */}
            {isClientAdmin && (
              <NavGroup
                label="Monitoring & Reporting"
                isAdmin={true}
                isOpen={openGroup === "Monitoring & Reporting"}
                onToggle={() => toggleGroup("Monitoring & Reporting")}
              >
                <NavItem
                  to="/monitoring/kri"
                  icon={BarChart}
                  label="KRI Tracker"
                />
                <NavItem
                  to="/monitoring/alerts"
                  icon={BellRing}
                  label="Alerts & Thresholds"
                />
                <NavItem
                  to="/monitoring/aggregation"
                  icon={Layers}
                  label="Risk Aggregation Data"
                />
                <NavItem
                  to="/monitoring/heatmaps"
                  icon={TrendingUp}
                  label="Trends & Heatmaps"
                />
              </NavGroup>
            )}

            {/* REPORTS */}
            <NavGroup
              label="Reports"
              isAdmin={hasCoreAccess}
              isOpen={openGroup === "Reports"}
              onToggle={() => toggleGroup("Reports")}
            >
              {isClientAdmin && (
                <>
                  <NavItem
                    to="/reporting/executive"
                    icon={PieChart}
                    label="Executive Reports"
                  />
                  <NavItem
                    to="/reporting/programme-report"
                    icon={BarChart}
                    label="Programme Report"
                  />
                </>
              )}
              <NavItem
                to="/reporting/project"
                icon={ClipboardList}
                label="Project Reports"
              />
            </NavGroup>

            {/* REGULATIONS LIBRARY — reference / training, not part of the daily operational flow */}
            <NavGroup
              label="Regulations Library"
              isAdmin={hasCoreAccess}
              isOpen={openGroup === "Regulations Library"}
              onToggle={() => toggleGroup("Regulations Library")}
            >
              <NavItem
                to="/regulations"
                icon={BookOpen}
                label="Regulations Library"
              />
              <NavItem
                to="/regulations/cpd"
                icon={Activity}
                label="CPD Training - Beta"
                iconClass="text-indigo-500"
              />
            </NavGroup>

            {/* ACCOUNT */}
            {(isClientAdmin || isAdmin) && (
              <NavGroup
                label="Account"
                isAdmin={hasCoreAccess}
                isOpen={openGroup === "Account"}
                onToggle={() => toggleGroup("Account")}
              >
                {isClientAdmin && (
                  <NavItem
                    to="/setup/workspace"
                    icon={Settings2}
                    label="Workspace Management"
                  />
                )}
                {isClientAdmin && (
                  <NavItem
                    to="/integrations"
                    icon={Blocks}
                    label="Integrations"
                  />
                )}
                {isAdmin && (
                  <NavItem
                    to="/admin"
                    icon={Shield}
                    label="Platform Admin"
                    iconClass="text-orange-500"
                  />
                )}
              </NavGroup>
            )}

            {/* DEVELOPER — visible to all Client Admins */}
            {isClientAdmin && (
              <NavGroup
                label="Developer / API"
                isAdmin={isClientAdmin}
                isOpen={openGroup === "Developer / API"}
                onToggle={() => toggleGroup("Developer / API")}
              >
                <NavItem
                  to="/developer/keys"
                  icon={KeyRound}
                  label="API Keys"
                />
                <NavItem
                  to="/developer/docs"
                  icon={Terminal}
                  label="API Documentation"
                />
              </NavGroup>
            )}

            {/* HELP */}
            {hasCoreAccess && (
              <NavGroup
                label="Help"
                isAdmin={true}
                isOpen={openGroup === "Help"}
                onToggle={() => toggleGroup("Help")}
              >
                <NavItem
                  to="/help"
                  icon={HelpCircle}
                  label="Help Centre"
                  iconClass="text-indigo-500"
                />
              </NavGroup>
            )}
          </div>
        </SidebarFilterContext.Provider>

        {/* Profile & Sign Out — pinned footer tray (slate-50 elevated) */}
        <div className="border-t border-slate-200 bg-slate-50/60 px-2 pt-2.5 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] space-y-1.5">
          {/* Avatar row — gradient circle + name + role mono uppercase + cog */}
          <button
            onClick={() => setProfileSettingsOpen(true)}
            className="w-full flex items-center gap-3 px-2.5 py-2.5 rounded-md transition-colors hover:bg-white text-left"
            title="Profile settings"
          >
            <UserAvatar
              photoURL={user?.photoURL}
              displayName={user?.displayName || user?.name}
              email={user?.email}
              size="sm"
            />

            <span className="min-w-0 flex-1">
              <span className="block text-[12px] font-semibold text-slate-900 truncate">
                {user?.displayName ||
                  user?.name ||
                  user?.email?.split("@")[0] ||
                  "User"}
              </span>
              <span className="block font-mono uppercase tracking-wide text-[10px] text-slate-500 truncate">
                {(user?.role || user?.profile?.role || "Member")
                  .toString()
                  .replace(/_/g, " ")}
              </span>
            </span>
            <Settings2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          </button>
          <div className="h-px bg-slate-200/50 my-1 mx-2" />
          <button
            onClick={handleLogout}
            className="w-full h-10 text-left flex items-center gap-3 px-2.5 rounded-md text-[13px] font-medium transition-all duration-150 text-slate-500 hover:text-rose-600 hover:bg-rose-50/50 group"
          >
            <span className="inline-flex w-8 h-8 items-center justify-center shrink-0 rounded-lg bg-slate-100/70 text-slate-400 group-hover:bg-rose-100/50 group-hover:text-rose-600 transition-colors">
              <LogOut className="w-3.5 h-3.5" />
            </span>
            <span>Sign Out</span>
          </button>
        </div>
      </div>
    </>
  );
}
