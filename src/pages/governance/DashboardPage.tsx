import { LayoutDashboard } from 'lucide-react';
import { GovernancePlaceholder } from '../../components/governance/GovernancePlaceholder';

export function GovernanceDashboardPage() {
  return (
    <GovernancePlaceholder
      icon={LayoutDashboard}
      title="Governance dashboard"
      description="Role-aware morning briefing, key metrics, approvals inbox, upcoming boards and team workload."
      phaseLabel="Ships in Phase 11 · Dashboard"
    />
  );
}
