import { ClipboardList } from "lucide-react";
import { TacPlaceholder } from "../../components/technicalAssurance/TacPlaceholder";

// Phase 0 placeholder. Phase 5 replaces with the project-scoped RFI register
// (DynamicTable + filters + status pills).

export function TacRfiRegisterPage() {
  return (
    <TacPlaceholder
      icon={ClipboardList}
      title="RFI register"
      description="Project-scoped Requests for Information issued from enquiries. Status pills, recipient lists, response capture. Surface lands in Phase 5."
      phaseLabel="Phase 5 — RFI / instruction"
    />
  );
}
