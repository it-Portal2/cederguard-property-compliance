import React from 'react';
import { useStore } from '../store/useStore';
import { Menu, Bell, BellDot, User } from 'lucide-react';
import UserAvatar from './UserAvatar';

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

  const hasUnread = notifications.some(n => !n.read);

  return (
    <header className="md:hidden print:hidden bg-white/80 backdrop-blur-md border-b border-slate-200/60 min-h-16 pt-safe grid grid-cols-[4.5rem_minmax(0,1fr)_6rem] items-center gap-2 px-4 sticky top-0 z-40 transition-all duration-300 no-select">
      <div className="flex items-center justify-start">
        <button
          onClick={() => setMobileMenuOpen(!isMobileMenuOpen)}
          className="p-3 -ml-3 text-slate-500 hover:bg-slate-100 rounded-lg transition-colors touch-target"
        >
          <Menu className="w-5 h-5" />
        </button>
      </div>

      {/* Centered Logo for Native App Feel */}
      <div className="pointer-events-none flex min-w-0 items-center justify-center">
        <img
          src={`${import.meta.env.BASE_URL}logo.png`}
          alt="CedarGuard"
          className="h-11 w-full max-w-[13.5rem] object-contain sm:h-12"
        />
      </div>

      <div className="flex items-center justify-end gap-1">
        <button className="p-3 text-slate-500 hover:bg-slate-50 rounded-lg relative transition-all touch-target">
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
          className="w-8 h-8 rounded-full flex items-center justify-center hover:ring-2 hover:ring-indigo-500 transition-all ml-1 touch-target"
        >
          <UserAvatar
            photoURL={user?.photoURL}
            displayName={user?.displayName}
            email={user?.email}
            size="sm"
          />
        </button>
      </div>
    </header>
  );
}
