import { useState } from "react";
import { useNavigate } from "react-router";
import toast from "react-hot-toast";
import { useStore } from "../../store/useStore";
import { isAtLeastClientAdmin, isAtLeastPM } from "../../lib/roles";

/**
 * Shared entry point for running an agent from any module page. Resolves the scope from
 * the active context, calls the store's runAgent, toasts the outcome and (by default)
 * navigates to the review queue. Running is open to core-access users (Client Admin or
 * PM+); the server is the guarantee and viewers are denied there regardless.
 */
export function useRunAgent() {
  const navigate = useNavigate();
  const runAgent = useStore((s) => s.runAgent);
  const user = useStore((s) => s.user);
  const activeProjectId = useStore((s) => s.activeProjectId);
  const activeProgrammeId = useStore((s) => s.activeProgrammeId);

  const role = user?.role || user?.profile?.role;
  const canRun = isAtLeastClientAdmin(role) || isAtLeastPM(role);

  const [runningKey, setRunningKey] = useState<string | null>(null);

  const run = async (
    agentKey: string,
    opts: { question?: string; navigateToQueue?: boolean } = {},
  ): Promise<boolean> => {
    if (!canRun) {
      toast.error("You need Project Manager access to run an agent.");
      return false;
    }
    const scope = activeProjectId
      ? { contextKind: "project" as const, contextId: activeProjectId }
      : activeProgrammeId
        ? { contextKind: "programme" as const, contextId: activeProgrammeId }
        : { contextKind: "portfolio" as const, contextId: null };

    setRunningKey(agentKey);
    const toastId = toast.loading("Running agent — reading your records…");
    try {
      const suggestions = await runAgent({ agentKey, ...scope, question: opts.question });
      toast.success(
        suggestions.length
          ? `Drafted ${suggestions.length} suggestion${suggestions.length === 1 ? "" : "s"} for review.`
          : "The agent found nothing new to suggest.",
        { id: toastId },
      );
      if (opts.navigateToQueue !== false && suggestions.length) navigate("/agents/suggestions");
      return true;
    } catch (e: any) {
      toast.error(e?.message || "The agent could not complete this run.", { id: toastId });
      return false;
    } finally {
      setRunningKey(null);
    }
  };

  return { run, runningKey, canRun };
}
