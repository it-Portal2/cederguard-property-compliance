import React from 'react';
import { Navigate } from 'react-router';
import { useStore } from '../store/useStore';
import { isSuperAdmin, isAtLeastClientAdmin, isAtLeastPM, isAtLeastProgrammeManager } from '../lib/roles';

interface RoleGuardProps {
  children: React.ReactNode;
  requireAdmin?: boolean;
  requireClientAdmin?: boolean;
  requireProgrammeManager?: boolean;
  requirePM?: boolean;
}

export function RoleGuard({
  children,
  requireAdmin = false,
  requireClientAdmin = false,
  requireProgrammeManager = false,
  requirePM = false
}: RoleGuardProps) {
  const { user } = useStore();
  const userRole = user?.role || user?.profile?.role;
  const userEmail = user?.email;

  const isAdmin = isSuperAdmin(userEmail, userRole);
  const isClientAdmin = isAtLeastClientAdmin(userRole) || isAdmin;
  // Programme Manager tier = admin / client_admin / programme_manager.
  // Deliberately EXCLUDES plain project managers.
  const isProgrammeManager = isAtLeastProgrammeManager(userRole) || isAdmin;
  const isPM = isAtLeastPM(userRole) || isClientAdmin;

  if (requireAdmin && !isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  if (requireClientAdmin && !isClientAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  if (requireProgrammeManager && !isProgrammeManager) {
    return <Navigate to="/dashboard" replace />;
  }

  if (requirePM && !isPM) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}
