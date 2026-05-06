import { ShieldCheck } from "lucide-react";
import { TacPlaceholder } from "../../components/technicalAssurance/TacPlaceholder";

// Phase 0 placeholder. Phase 8 replaces with the Compliance Lead audit
// dashboard — flagged enquiries, thumbs-down feedback queue, reviewer notes.
// Gated by `extraRoles: ['compliance_lead']` (see ComplianceLeadGuard).

export function TacAuditDashboardPage() {
  return (
    <TacPlaceholder
      icon={ShieldCheck}
      title="Audit dashboard"
      description="Compliance Lead view of flagged enquiries and feedback. Reviewer notes, resolution flow, audit trail. Surface lands in Phase 8."
      phaseLabel="Phase 8 — Audit + feedback"
    />
  );
}
