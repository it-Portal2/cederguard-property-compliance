import { useState } from "react";
import toast from "react-hot-toast";
import { useNavigate } from "react-router";
import { useStore } from "../../store/useStore";
import type { AssuranceAlert } from "./types";

// Shared "Escalate to Assurance" behaviour: PM+ gate, dedupe-while-open (Q14),
// toast + optional navigate. Used by the Incidents / Controls registers and the
// Improvement engine so the escalate logic lives in one place.
export function useEscalateToAssurance() {
  const escalateToAssurance = useStore((s) => s.escalateToAssurance);
  const assuranceAlerts = useStore((s) => s.assuranceAlerts);
  const canEscalate = useStore((s) => s.canManageAssurance)();
  const navigate = useNavigate();
  const [escalatingId, setEscalatingId] = useState<string | null>(null);

  // An item counts as already escalated only while its escalation is still open.
  const isEscalated = (refId: string) =>
    assuranceAlerts.some(
      (x) => x.sourceRef?.id === refId && x.status !== "Resolved" && x.status !== "Dismissed",
    );

  const escalate = async (
    refId: string,
    input: Partial<AssuranceAlert>,
    opts?: { navigate?: boolean },
  ): Promise<boolean> => {
    if (isEscalated(refId)) {
      toast.error("This is already escalated to Assurance.");
      return false;
    }
    setEscalatingId(refId);
    try {
      await escalateToAssurance(input);
      toast.success("Escalated to Assurance — generating actions.");
      if (opts?.navigate !== false) navigate("/assurance");
      return true;
    } catch (e: any) {
      toast.error(e?.message || "Could not escalate to Assurance.");
      return false;
    } finally {
      setEscalatingId(null);
    }
  };

  return { canEscalate, escalatingId, isEscalated, escalate };
}
