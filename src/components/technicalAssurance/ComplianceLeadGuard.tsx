import React from "react";
import { Navigate } from "react-router";
import { useStore } from "../../store/useStore";
import { isSuperAdmin, isComplianceLead } from "../../lib/roles";

// Compliance-Lead-only route gate for the TAC audit dashboard.
//
// Implemented as a separate component (not a new prop on RoleGuard) so the
// existing RoleGuard logic stays untouched (lesson §25 ADD-never-MODIFY).
// Super admins always pass — they need cross-tenant audit access.

interface ComplianceLeadGuardProps {
  children: React.ReactNode;
}

export function ComplianceLeadGuard({ children }: ComplianceLeadGuardProps) {
  const { user } = useStore();
  if (!user) return <Navigate to="/login" replace />;

  const userEmail = user?.email;
  const userRole = user?.role || user?.profile?.role;
  if (isSuperAdmin(userEmail, userRole)) return <>{children}</>;

  if (!isComplianceLead(user)) {
    return <Navigate to="/dashboard" replace />;
  }
  return <>{children}</>;
}
