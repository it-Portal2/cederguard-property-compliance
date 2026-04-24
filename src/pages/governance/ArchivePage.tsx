import { ScrollText } from 'lucide-react';
import { GovernancePlaceholder } from '../../components/governance/GovernancePlaceholder';

export function GovernanceArchivePage() {
  return (
    <GovernancePlaceholder
      icon={ScrollText}
      title="Archive & audit"
      description="Immutable archive of every sealed decision, FOI-safe export with Part 2 redaction, and the Golden Thread trail for HRB projects."
      phaseLabel="Ships in Phase 10 · Archive"
    />
  );
}
