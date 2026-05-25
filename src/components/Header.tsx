import { useState, useRef, useEffect } from "react";
import { useStore } from "../store/useStore";
import {
  LogOut,
  User,
  ChevronDown,
  FolderKanban,
  Plus,
  Loader2,
  LayoutTemplate,
  LayoutDashboard,
  Bell,
  BellDot,
  X,
  Check,
  Menu,
  Search,
} from "lucide-react";
import { clsx } from "clsx";
import { SinceLastVisitBadge } from "./SinceLastVisitBadge";
import { logout } from "../lib/firebase";
import { useNavigate, useLocation } from "react-router";
import { ProfileSettingsModal } from "./ProfileSettingsModal";
import { api } from "../lib/api";
import {
  isAtLeastClientAdmin,
  isSuperAdmin,
  isAtLeastPM,
  canCreateProject,
  canCreateProgramme,
  UserRole,
} from "../lib/roles";
import { formatDistanceToNow } from "date-fns";
import { safeFormatDistanceToNow } from "../lib/utils";
import TableTooltip from "./table/TableTooltip";

export function Header() {
  const {
    user,
    projects,
    setProjects,
    programmes,
    activeProjectId,
    activeProgrammeId,
    setActiveProject,
    setActiveProgramme,
    loadProjectData,
    loadProgrammeData,
    loadAggregateData,
    fetchProjects,
    fetchProgrammes,
    notifications,
    clearNotifications,
    markNotificationAsRead,
    isMobileMenuOpen,
    setMobileMenuOpen,
    isContextSwitching,
    setContextSwitching,
  } = useStore();

  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [showProjectDropdown, setShowProjectDropdown] = useState(false);
  const [showProgrammeDropdown, setShowProgrammeDropdown] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [showNotificationDropdown, setShowNotificationDropdown] =
    useState(false);
  const [showContextDropdown, setShowContextDropdown] = useState(false);

  const userDropdownRef = useRef<HTMLDivElement>(null);
  const projectDropdownRef = useRef<HTMLDivElement>(null);
  const programmeDropdownRef = useRef<HTMLDivElement>(null);
  const notificationDropdownRef = useRef<HTMLDivElement>(null);
  const contextDropdownRef = useRef<HTMLDivElement>(null);

  const navigate = useNavigate();

  // Role detection
  const userRole = (user?.role || user?.profile?.role) as UserRole | undefined;
  const userIsSuperAdmin = isSuperAdmin(user?.email, userRole);

  // Fetch projects and programmes based on role
  useEffect(() => {
    const init = async () => {
      // Load all data on mount for authorized roles to populate context lookups
      if (
        user &&
        (userIsSuperAdmin ||
          isAtLeastPM(userRole as any) ||
          isAtLeastClientAdmin(userRole as any))
      ) {
        await Promise.all([fetchProjects(), fetchProgrammes()]);
      }
    };
    init();
  }, [user, userIsSuperAdmin, userRole, fetchProjects, fetchProgrammes]);

  // Handle clicking outside to close dropdowns
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        userDropdownRef.current &&
        !userDropdownRef.current.contains(event.target as Node)
      ) {
        setShowUserDropdown(false);
      }
      if (
        projectDropdownRef.current &&
        !projectDropdownRef.current.contains(event.target as Node)
      ) {
        setShowProjectDropdown(false);
      }
      if (
        programmeDropdownRef.current &&
        !programmeDropdownRef.current.contains(event.target as Node)
      ) {
        setShowProgrammeDropdown(false);
      }
      if (
        notificationDropdownRef.current &&
        !notificationDropdownRef.current.contains(event.target as Node)
      ) {
        setShowNotificationDropdown(false);
      }
      if (
        contextDropdownRef.current &&
        !contextDropdownRef.current.contains(event.target as Node)
      ) {
        setShowContextDropdown(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLogout = async () => {
    try {
      await logout();
      useStore.getState().setUser(null);
      navigate("/login");
    } catch (error) {
      console.error("Logout failed", error);
    }
  };

  const handleProjectSwitch = async (projectId: string) => {
    if (projectId === activeProjectId) {
      setShowProjectDropdown(false);
      return;
    }
    setContextSwitching(true);
    setShowProjectDropdown(false);
    try {
      await loadProjectData(projectId);
      navigate(`/dashboard?projectId=${projectId}`);
    } catch (e) {
      console.error("Failed to switch project", e);
    } finally {
      setContextSwitching(false);
    }
  };

  const handleProgrammeSwitch = async (programmeId: string) => {
    if (programmeId === activeProgrammeId) {
      setShowProgrammeDropdown(false);
      return;
    }
    setContextSwitching(true);
    setShowProgrammeDropdown(false);
    try {
      await loadProgrammeData(programmeId);
      navigate(`/dashboard?programmeId=${programmeId}`);
    } catch (e) {
      console.error("Failed to switch programme", e);
    } finally {
      setContextSwitching(false);
    }
  };

  const getInitials = (name?: string, email?: string) => {
    if (name)
      return name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .substring(0, 2)
        .toUpperCase();
    if (email) return email.substring(0, 2).toUpperCase();
    return "U";
  };

  const initials = getInitials(user?.displayName, user?.email);
  const activeProject = (Array.isArray(projects) ? projects : []).find(
    (p) => p.id === activeProjectId,
  );
  const activeProgramme = (Array.isArray(programmes) ? programmes : []).find(
    (p) => p.id === activeProgrammeId,
  );

  const location = useLocation();
  const isDashboard =
    location.pathname === "/" || location.pathname === "/dashboard";

  const handleSelectChange = async (value: string) => {
    setContextSwitching(true);
    try {
      if (value === "aggregate") {
        await loadAggregateData();
        navigate("/dashboard");
      } else if (value.startsWith("project:")) {
        const projectId = value.split(":")[1];
        await loadProjectData(projectId);
        navigate(`/dashboard?projectId=${projectId}`);
      } else if (value.startsWith("programme:")) {
        const programmeId = value.split(":")[1];
        await loadProgrammeData(programmeId);
        navigate(`/dashboard?programmeId=${programmeId}`);
      }
    } finally {
      setContextSwitching(false);
    }
  };

  return (
    <header className="bg-white border-b border-slate-200 h-14 flex items-center px-4 justify-between shrink-0 gap-4 print:hidden">
      {/* ─── GLOBAL CONTEXT SELECTOR ─── */}
      <div className="flex-1 flex items-center gap-2 md:gap-4 min-w-0">
        <button
          onClick={() => setMobileMenuOpen(!isMobileMenuOpen)}
          className="md:hidden p-2 -ml-2 text-slate-500 hover:bg-slate-100 rounded-lg transition-colors"
        >
          <Menu className="w-5 h-5" />
        </button>
        {/* ── v4 context pill — custom button + dropdown menu ── */}
        <div className="relative shrink-0" ref={contextDropdownRef}>
          <button
            type="button"
            onClick={() => setShowContextDropdown((v) => !v)}
            disabled={isContextSwitching}
            className="inline-flex items-center gap-2 h-9 pl-2 pr-2.5 bg-white border border-slate-200 rounded-md text-sm font-medium text-slate-900 hover:bg-slate-50 transition-colors disabled:opacity-60"
            aria-haspopup="menu"
            aria-expanded={showContextDropdown}
            title="Switch context"
          >
            <span className="inline-flex w-5 h-5 items-center justify-center rounded bg-indigo-50 text-indigo-600 shrink-0">
              <LayoutTemplate className="w-3 h-3" />
            </span>
            <span className="flex flex-col items-start min-w-0 leading-tight max-w-35 sm:max-w-50 md:max-w-60 lg:max-w-70">
              <span className="font-mono uppercase tracking-wide text-[10px] text-slate-500">
                Active context
              </span>
              <span className="block w-full truncate text-sm text-slate-900">
                {activeProject?.name ||
                  activeProgramme?.name ||
                  "Portfolio Aggregate"}
              </span>
            </span>
            {isContextSwitching ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-500 shrink-0" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            )}
          </button>
          {showContextDropdown && (
            <div className="absolute left-0 top-full mt-1.5 z-50 min-w-70 max-h-[60vh] rounded-md border border-slate-300 bg-white shadow-lg p-1.5 flex flex-col">
              <div className="px-2 pt-1 pb-1.5 font-mono uppercase tracking-wide text-[10px] font-medium text-slate-400">
                Switch context
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowContextDropdown(false);
                  handleSelectChange("aggregate");
                }}
                className={clsx(
                  "w-full grid grid-cols-[20px_1fr_14px] items-center gap-2.5 px-2 py-2 rounded text-left transition-colors",
                  !activeProjectId && !activeProgrammeId
                    ? "bg-indigo-50"
                    : "hover:bg-slate-50",
                )}
              >
                <span className="inline-flex w-5 h-5 items-center justify-center rounded bg-indigo-50 text-indigo-600">
                  <LayoutTemplate className="w-3 h-3" />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-slate-900 truncate">
                    Portfolio Aggregate
                  </span>
                  <span className="block text-[11px] text-slate-500 truncate">
                    All authorized projects
                  </span>
                </span>
                {!activeProjectId && !activeProgrammeId ? (
                  <Check className="w-3.5 h-3.5 text-indigo-600" />
                ) : (
                  <span />
                )}
              </button>

              {/* Programmes Section */}
              {(Array.isArray(programmes) ? programmes : []).length > 0 ? (
                <>
                  <div className="px-2 pt-2 pb-1 font-mono uppercase tracking-wide text-[10px] font-medium text-slate-400">
                    Programmes
                  </div>
                  <div
                    className={clsx(
                      "flex flex-col",
                      (Array.isArray(programmes) ? programmes : []).length >
                        3 && "max-h-[calc(3*36px)] overflow-y-auto",
                    )}
                  >
                    {(Array.isArray(programmes) ? programmes : []).map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => {
                          setShowContextDropdown(false);
                          handleSelectChange(`programme:${p.id}`);
                        }}
                        className={clsx(
                          "w-full grid grid-cols-[20px_1fr_14px] items-center gap-2.5 px-2 py-2 rounded text-left transition-colors",
                          activeProgrammeId === p.id
                            ? "bg-indigo-50"
                            : "hover:bg-slate-50",
                        )}
                      >
                        <span className="inline-flex w-5 h-5 items-center justify-center rounded bg-indigo-50 text-indigo-600">
                          <FolderKanban className="w-3 h-3" />
                        </span>
                        <TableTooltip
                          content={p.name}
                          variant="cell"
                          align="start"
                        >
                          <span className="block text-sm font-medium text-slate-900 truncate">
                            {p.name}
                          </span>
                        </TableTooltip>
                        {activeProgrammeId === p.id ? (
                          <Check className="w-3.5 h-3.5 text-indigo-600" />
                        ) : (
                          <span />
                        )}
                      </button>
                    ))}
                  </div>
                </>
              ) : (
                <div className="px-3 py-3 text-center">
                  <p className="text-xs text-slate-500 font-medium">
                    No programmes yet
                  </p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Create a programme to get started
                  </p>
                </div>
              )}

              {/* Projects Section */}
              {(Array.isArray(projects) ? projects : []).length > 0 ? (
                <>
                  <div className="px-2 pt-2 pb-1 font-mono uppercase tracking-wide text-[10px] font-medium text-slate-400">
                    Projects
                  </div>
                  <div
                    className={clsx(
                      "flex flex-col",
                      (Array.isArray(projects) ? projects : []).length > 3 &&
                        "max-h-[calc(3*36px)] overflow-y-auto",
                    )}
                  >
                    {(Array.isArray(projects) ? projects : []).map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => {
                          setShowContextDropdown(false);
                          handleSelectChange(`project:${p.id}`);
                        }}
                        className={clsx(
                          "w-full grid grid-cols-[20px_1fr_14px] items-center gap-2.5 px-2 py-2 rounded text-left transition-colors",
                          activeProjectId === p.id
                            ? "bg-indigo-50"
                            : "hover:bg-slate-50",
                        )}
                      >
                        <span className="inline-flex w-5 h-5 items-center justify-center rounded bg-indigo-50 text-indigo-600">
                          <LayoutDashboard className="w-3 h-3" />
                        </span>
                        <TableTooltip
                          content={p.name}
                          variant="cell"
                          align="start"
                        >
                          <span className="block text-sm font-medium text-slate-900 truncate">
                            {p.name}
                          </span>
                        </TableTooltip>
                        {activeProjectId === p.id ? (
                          <Check className="w-3.5 h-3.5 text-indigo-600" />
                        ) : (
                          <span />
                        )}
                      </button>
                    ))}
                  </div>
                </>
              ) : (
                <div className="px-3 py-3 text-center">
                  <p className="text-xs text-slate-500 font-medium">
                    No projects yet
                  </p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Create a project to get started
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── New programme / New project quick-actions (v4 calm styling) ── */}
        <div className="hidden lg:flex items-center gap-2 pl-3 ml-1 border-l border-slate-200 h-8">
          {(userIsSuperAdmin || canCreateProgramme(userRole as any)) && (
            <button
              onClick={() => {
                setActiveProgramme(null);
                setActiveProject(null);
                navigate("/programmes/new");
              }}
              className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-md border border-slate-200 bg-white text-xs font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition-colors"
              title="Initiate New Programme"
            >
              <Plus className="w-3.5 h-3.5" />
              New programme
            </button>
          )}
          {(userIsSuperAdmin || canCreateProject(userRole as any)) && (
            <button
              onClick={() => {
                setActiveProject(null);
                setActiveProgramme(null);
                navigate("/project/initiation");
              }}
              className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-md bg-indigo-600 hover:bg-indigo-500 text-xs font-medium text-white transition-colors"
              title="Initiate New Project"
            >
              <Plus className="w-3.5 h-3.5" />
              New project
            </button>
          )}
        </div>
      </div>

      {/* ⌘K command palette trigger + Since-last-visit badge */}
      <div className="hidden md:flex items-center gap-2 shrink-0">
        <SinceLastVisitBadge />
        <button
          type="button"
          onClick={() =>
            window.dispatchEvent(new CustomEvent("cg:open-command-palette"))
          }
          className="hidden lg:inline-flex items-center gap-2 h-8 px-2.5 rounded-md border border-slate-200 bg-slate-50 text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors text-xs"
          aria-label="Open command palette"
          title="Open command palette (⌘K)"
        >
          <Search className="w-3.5 h-3.5" />
          <span className="text-slate-400">Search…</span>
          <span className="ml-2 inline-flex items-center gap-0.5">
            <kbd className="font-mono text-[10px] px-1.5 py-0.5 rounded border border-slate-200 bg-white text-slate-500">
              ⌘
            </kbd>
            <kbd className="font-mono text-[10px] px-1.5 py-0.5 rounded border border-slate-200 bg-white text-slate-500">
              K
            </kbd>
          </span>
        </button>
      </div>

      {/* Notifications */}
      <div
        className="relative flex items-center gap-3 shrink-0"
        ref={notificationDropdownRef}
      >
        <button
          onClick={() => setShowNotificationDropdown(!showNotificationDropdown)}
          className="p-2 rounded-lg hover:bg-slate-50 relative text-slate-500 hover:text-indigo-600 transition-all"
        >
          {(Array.isArray(notifications) ? notifications : []).some(
            (n) => n.status === "Unread",
          ) ? (
            <BellDot className="w-5 h-5 text-indigo-500" />
          ) : (
            <Bell className="w-5 h-5" />
          )}
          {(Array.isArray(notifications) ? notifications : []).filter(
            (n) => n.status === "Unread",
          ).length > 0 && (
            <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full border border-white" />
          )}
        </button>

        {showNotificationDropdown && (
          <div className="absolute right-0 top-10 mt-2 w-80 bg-white rounded-lg shadow-xl border border-slate-200 z-50 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <span className="text-sm font-semibold text-slate-800">
                Notifications
              </span>
              <button
                onClick={() => clearNotifications()}
                className="text-[10px] font-bold text-indigo-600 hover:text-indigo-700 uppercase tracking-wider"
              >
                Clear All
              </button>
            </div>

            <div className="max-h-96 overflow-y-auto">
              {(Array.isArray(notifications) ? notifications : []).length ===
              0 ? (
                <div className="px-4 py-8 text-center">
                  <Bell className="w-8 h-8 text-slate-200 mx-auto mb-2" />
                  <p className="text-sm text-slate-500">No notifications yet</p>
                </div>
              ) : (
                (Array.isArray(notifications) ? notifications : []).map(
                  (notification) => (
                    <div
                      key={notification.id}
                      className={`px-4 py-3 border-b border-slate-50 last:border-b-0 hover:bg-slate-50 transition-colors flex gap-3 ${notification.status === "Unread" ? "bg-indigo-50/30" : ""}`}
                    >
                      <div
                        className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${notification.status === "Unread" ? "bg-indigo-500" : "bg-transparent"}`}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <p
                            className={`text-sm font-medium ${notification.status === "Unread" ? "text-slate-900" : "text-slate-600"}`}
                          >
                            {notification.title}
                          </p>
                          <span className="text-[10px] text-slate-400 whitespace-nowrap pt-1">
                            {safeFormatDistanceToNow(
                              notification.time,
                              formatDistanceToNow,
                            )}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">
                          {notification.message || notification.body}
                        </p>
                        {notification.status === "Unread" && (
                          <button
                            onClick={() =>
                              markNotificationAsRead(notification.id)
                            }
                            className="mt-2 text-[10px] font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
                          >
                            <Check className="w-3 h-3" />
                            Mark as read
                          </button>
                        )}
                      </div>
                    </div>
                  ),
                )
              )}
            </div>
          </div>
        )}
      </div>

      {/* User menu */}
      <div
        className="relative flex items-center gap-3 shrink-0"
        ref={userDropdownRef}
      >
        <button
          onClick={() => setShowUserDropdown(!showUserDropdown)}
          className="w-8 h-8 rounded-full bg-indigo-100 ring-2 ring-transparent hover:ring-indigo-300 text-indigo-700 flex items-center justify-center text-sm font-bold transition-all"
        >
          {user?.photoURL ? (
            <img
              src={user.photoURL}
              alt="Profile"
              className="w-8 h-8 rounded-full object-cover"
            />
          ) : (
            initials
          )}
        </button>

        {showUserDropdown && (
          <div className="absolute right-0 top-10 mt-2 w-52 bg-white rounded-lg shadow-xl py-1 border border-slate-200 z-50">
            <div className="px-4 py-3 border-b border-slate-100">
              <p className="text-sm font-semibold text-slate-800 truncate">
                {user?.displayName || "User"}
              </p>
              <p className="text-xs text-slate-500 truncate">{user?.email}</p>
            </div>

            <button
              onClick={() => {
                setShowUserDropdown(false);
                setIsSettingsOpen(true);
              }}
              className="w-full text-left px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2 transition-colors"
            >
              <User className="w-4 h-4" />
              Profile Settings
            </button>

            <button
              onClick={handleLogout}
              className="w-full text-left px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2 transition-colors border-t border-slate-100 mt-1"
            >
              <LogOut className="w-4 h-4" />
              Sign out
            </button>
          </div>
        )}
      </div>

      <ProfileSettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />
    </header>
  );
}
