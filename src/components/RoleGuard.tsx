import React from 'react';
import { Navigate } from 'react-router';
import { useStore } from '../store/useStore';
import { isSuperAdmin, isAtLeastClientAdmin, isAtLeastPM } from '../lib/roles';

interface RoleGuardProps {
  children: React.ReactNode;
  requireAdmin?: boolean;
  requireClientAdmin?: boolean;
  requirePM?: boolean;
}

export function RoleGuard({ 
  children, 
  requireAdmin = false, 
  requireClientAdmin = false, 
  requirePM = false 
}: RoleGuardProps) {
  const { user } = useStore();
  const userRole = user?.role || user?.profile?.role;
  const userEmail = user?.email;

  console.log('[RoleGuard] user:', { email: userEmail, role: userRole, rawRole: user?.role, profileRole: user?.profile?.role, userKeys: user ? Object.keys(user) : 'null' });
  console.log('[RoleGuard] checks:', { requireAdmin, requireClientAdmin, requirePM });

  const isAdmin = isSuperAdmin(userEmail, userRole);
  const isClientAdmin = isAtLeastClientAdmin(userRole) || isAdmin;
  const isPM = isAtLeastPM(userRole) || isClientAdmin;

  console.log('[RoleGuard] results:', { isAdmin, isClientAdmin, isPM });

  if (requireAdmin && !isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  if (requireClientAdmin && !isClientAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  if (requirePM && !isPM) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}
