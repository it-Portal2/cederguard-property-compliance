import React from 'react';
import { NavLink, useLocation } from 'react-router';
import { LayoutDashboard, CheckSquare, ShieldAlert, MessageSquare, FolderKanban } from 'lucide-react';
import { clsx } from 'clsx';
import { motion, AnimatePresence } from 'motion/react';
import { useStore } from '../store/useStore';

export function MobileNav() {
  const { activeProjectId, activeProgrammeId } = useStore();
  const location = useLocation();
  
  const queryParams = activeProjectId 
    ? '?type=project' 
    : activeProgrammeId 
      ? '?type=programme' 
      : '';

  const navItems = [
    { to: '/dashboard', icon: LayoutDashboard, label: 'Home' },
    { to: `/compliance/dashboard${queryParams}`, icon: CheckSquare, label: 'Compliance' },
    { to: `/risk/dashboard${queryParams}`, icon: ShieldAlert, label: 'Risks' },
    { to: '/chat', icon: MessageSquare, label: 'AI Chat' },
    { to: '/projects', icon: FolderKanban, label: 'Projects' },
  ];

  return (
    <nav className="md:hidden print:hidden fixed bottom-0 left-0 right-0 bg-white/70 backdrop-blur-xl border-t border-slate-200/40 z-50 px-2 pt-2 pb-[calc(env(safe-area-inset-bottom)+0.6rem)] shadow-[0_-4px_16px_-4px_rgba(0,0,0,0.05)] no-select transition-all duration-300">
      <div className="flex items-center justify-around max-w-lg mx-auto relative">
        {navItems.map((item) => {
          const isActive = location.pathname === item.to || (item.to !== '/dashboard' && location.pathname.startsWith(item.to.split('?')[0]));
          
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive: linkActive }) => clsx(
                "group flex flex-col items-center justify-center flex-1 min-w-0 py-1 relative z-10 transition-all duration-300",
                isActive ? "text-indigo-600" : "text-slate-400 hover:text-slate-600"
              )}
            >
              <div className="relative">
                <item.icon className={clsx(
                  "w-5 h-5 mb-1.5 transition-all duration-300",
                  isActive ? "scale-110 drop-shadow-[0_0_8px_rgba(79,70,229,0.3)]" : "group-hover:scale-105"
                )} />
                {isActive && (
                  <motion.div
                    layoutId="activeTabGlow"
                    className="absolute inset-0 bg-indigo-400/20 blur-lg rounded-full -z-10"
                    transition={{ type: "spring", stiffness: 350, damping: 30 }}
                  />
                )}
              </div>
              
              <span className={clsx(
                "text-[10px] font-bold tracking-tight truncate w-full text-center transition-all duration-300",
                isActive ? "opacity-100 translate-y-0" : "opacity-80 translate-y-0"
              )}>
                {item.label}
              </span>

              {isActive && (
                <motion.div
                  layoutId="activeTabIndicator"
                  className="absolute -top-2 left-1/4 right-1/4 h-0.5 bg-indigo-600 rounded-full shadow-[0_0_8px_rgba(79,70,229,0.5)]"
                  transition={{ type: "spring", stiffness: 350, damping: 30 }}
                />
              )}
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}
