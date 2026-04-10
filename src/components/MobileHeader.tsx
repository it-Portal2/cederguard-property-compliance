import React from 'react';
import { useStore } from '../store/useStore';
import { Menu, Bell, BellDot, User } from 'lucide-react';

export function MobileHeader() {
  const { 
    user, 
    notifications, 
    isMobileMenuOpen, 
    setMobileMenuOpen,
    activeProjectId,
    projects,
    setProfileSettingsOpen
  } = useStore();

  const activeProject = projects.find(p => p.id === activeProjectId);
  const initials = user?.displayName 
    ? user.displayName.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase()
    : user?.email?.substring(0, 2).toUpperCase() || 'U';

  const hasUnread = notifications.some(n => !n.read);

  return (
    <header className="md:hidden print:hidden bg-white/80 backdrop-blur-md border-b border-slate-200/60 min-h-[3.5rem] pt-safe flex items-center px-4 justify-between sticky top-0 z-40 transition-all duration-300 no-select relative">
      <div className="flex items-center gap-1">
        <button
          onClick={() => setMobileMenuOpen(!isMobileMenuOpen)}
          className="p-3 -ml-3 text-slate-500 hover:bg-slate-100 rounded-xl transition-colors touch-target"
        >
          <Menu className="w-5 h-5" />
        </button>
      </div>

      {/* Centered Logo for Native App Feel */}
      <div className="absolute left-1/2 -translate-x-1/2 pointer-events-none">
        <img src="/logo.png" alt="CedarGuard" className="h-[22px] w-auto object-contain" />
      </div>

      <div className="flex items-center gap-1">
        <button className="p-3 text-slate-500 hover:bg-slate-50 rounded-xl relative transition-all touch-target">
          {hasUnread ? (
            <BellDot className="w-5 h-5 text-indigo-500" />
          ) : (
            <Bell className="w-5 h-5" />
          )}
          {hasUnread && (
            <span className="absolute top-3 right-3 w-2 h-2 bg-red-500 rounded-full border border-white animate-pulse" />
          )}
        </button>
        <button 
          onClick={() => setProfileSettingsOpen(true)}
          className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-bold border border-indigo-200 shadow-sm overflow-hidden hover:ring-2 hover:ring-indigo-500 transition-all ml-1 touch-target"
        >
          {user?.photoURL ? (
            <img src={user.photoURL} alt="Profile" className="w-8 h-8 object-cover" />
          ) : (
            initials
          )}
        </button>
      </div>
    </header>
  );
}
