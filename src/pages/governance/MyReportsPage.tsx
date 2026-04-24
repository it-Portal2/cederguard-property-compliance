import { ClipboardList } from 'lucide-react';
import { GovernancePlaceholder } from '../../components/governance/GovernancePlaceholder';

export function GovernanceMyReportsPage() {
  return (
    <GovernancePlaceholder
      icon={ClipboardList}
      title="My reports"
      description="Personal workspace for Project Managers: drafting, amendments, AI briefing, deadlines and feedback from the Programme Manager."
      phaseLabel="Ships in Phase 7 · My Reports"
    />
  );
}
