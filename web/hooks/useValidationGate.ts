// useValidationGate — drop-in gate state for a fact-checkable artifact.
// Loads the validation record for (surface, targetId) from the store, exposes
// the live status, whether approval is blocked (anything other than
// "validated"), and a runFactCheck helper. Used by ValidateButton and by each
// surface to disable its approve/submit action until validated.

import { useCallback, useEffect, useState } from "react";
import { useStore } from "../store/useStore";
import { validationKey, type ValidationSurface } from "../lib/validation";

export interface RunFactCheckInput {
  content: string;
  contextId?: string | null;
  label?: string;
  ratingsContext?: string;
  targetType?: string;
}

export function useValidationGate(
  surface: string,
  targetId: string | null | undefined,
) {
  const key = targetId
    ? validationKey(surface as ValidationSurface, targetId)
    : "";
  const record = useStore((s) => (key ? s.validationsByKey[key] ?? null : null));
  const loadValidation = useStore((s) => s.loadValidation);
  const runFactCheckStore = useStore((s) => s.runFactCheck);

  // `loading` is true until the FIRST status fetch for this target resolves, so
  // the UI can show a neutral "checking" state instead of flashing the unchecked
  // CTA on refresh (the content is restored instantly but status loads async).
  const [loading, setLoading] = useState<boolean>(!!targetId);

  useEffect(() => {
    if (!targetId) {
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    Promise.resolve(loadValidation(surface, targetId)).finally(() => {
      if (active) setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [surface, targetId, loadValidation]);

  const status = record?.status ?? "unchecked";
  const isValidated = status === "validated";
  const isBlocked = !isValidated;

  const runFactCheck = useCallback(
    (input: RunFactCheckInput) => {
      if (!targetId) return Promise.resolve(null);
      return runFactCheckStore({ surface, targetId, ...input });
    },
    [surface, targetId, runFactCheckStore],
  );

  const refresh = useCallback(
    () => (targetId ? loadValidation(surface, targetId) : Promise.resolve(null)),
    [surface, targetId, loadValidation],
  );

  return { record, status, isValidated, isBlocked, loading, runFactCheck, refresh };
}
