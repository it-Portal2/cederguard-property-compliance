import { Users } from 'lucide-react';
import { GovernancePlaceholder } from '../../components/governance/GovernancePlaceholder';

export function GovernanceMeetingsPage() {
  return (
    <GovernancePlaceholder
      icon={Users}
      title="Meetings"
      description="Agenda, attendees, minutes, decisions and action items for each governance body — linked to reports and projects."
      phaseLabel="Ships in Phase 8 · Meetings"
    />
  );
}
