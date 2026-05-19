import React from "react";
import { useNavigate } from "react-router";
import { CheckCircle2, AlertCircle, Shield, Rocket, ChevronRight, ScanSearch } from 'lucide-react';
import { clsx } from "clsx";
import { useStore } from "../store/useStore";
import { isSuperAdmin, isAtLeastClientAdmin } from "../lib/roles";

type StepStatus = "complete" | "active" | "not-started";

interface PubStepProps {
  num: string;
  label: string;
  info: string;
  status: StepStatus;
}

const PubStep: React.FC<PubStepProps> = ({ num, label, info, status }) => {
  const cfg: Record<
    StepStatus,
    { bg: string; icon: React.ReactNode; text: string }
  > = {
    complete: {
      bg: "bg-emerald-500",
      icon: <CheckCircle2 className="w-3.5 h-3.5 text-white" />,
      text: "text-emerald-700",
    },
    active: {
      bg: "bg-amber-400",
      icon: <AlertCircle className="w-3.5 h-3.5 text-white" />,
      text: "text-slate-800",
    },
    "not-started": {
      bg: "bg-slate-200",
      icon: <span className="text-[10px] font-bold text-slate-400">{num}</span>,
      text: "text-slate-400",
    },
  };
  const c = cfg[status];
  return (
    <div className="flex items-start gap-3 sm:gap-4 py-3">
      <div
        className={clsx(
          "w-6 h-6 rounded-lg flex items-center justify-center shadow-sm shrink-0 mt-0.5",
          c.bg,
        )}
      >
        {c.icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className={clsx("text-[13px] font-bold leading-snug", c.text)}>
          {label}
        </p>
        <p className="text-[10px] text-slate-400 font-medium mt-1">{info}</p>
      </div>
    </div>
  );
};

interface PublicationChecklistProps {
  onPublish?: () => void;
  loading?: boolean;
}

export function PublicationChecklist({
  onPublish,
  loading,
}: PublicationChecklistProps) {
  const navigate = useNavigate();
  const {
    activeProjectId,
    activeProgrammeId,
    projects,
    programmes,
    user,
    complianceItems,
    risks,
  } = useStore();
  const userRole = user?.role || (user as any)?.profile?.role;

  // Support both projects and programmes
  const project = (Array.isArray(projects) ? projects : []).find(
    (p) => p.id === activeProjectId,
  );
  const programme = (Array.isArray(programmes) ? programmes : []).find(
    (p) => p.id === activeProgrammeId,
  );
  const activeEntity = project || programme;
  const isProg = !!programme && !project;
  const contextId = activeProjectId || activeProgrammeId;
  const activeType = isProg ? "programme" : "project";

  const deliveryTeamComplete =
    !!activeEntity?.deliveryTeamDone ||
    !!(activeEntity as any)?.projectManagerId;

  const canPublish =
    (activeEntity?.complianceSetupDone ||
      (contextId &&
        (Array.isArray(complianceItems) ? complianceItems : []).some(
          (i) => i.projectId === contextId || i.programmeId === contextId,
        ))) &&
    ((activeEntity?.riskSetupDone && activeEntity?.aiRiskDiscoveryDone) ||
      (contextId &&
        (Array.isArray(risks) ? risks : []).filter(
          (r) => r.projectId === contextId || r.programmeId === contextId,
        ).length >= 3)) &&
    deliveryTeamComplete;

  const steps: {
    num: string;
    label: string;
    info: string;
    status: StepStatus;
  }[] = [
    {
      num: "1",
      label: isProg ? "1. Create a programme" : "1. Create a project",
      info: isProg
        ? "Initial programme creation and core metadata setup."
        : "Initial project creation and core metadata setup.",
      status: activeEntity ? "complete" : "active",
    },
    {
      num: "2",
      label: "2. Complete Compliance Setup",
      info: "Executing AI analysis and identifying obligations.",
      status:
        activeEntity?.complianceSetupDone ||
        (contextId &&
          (Array.isArray(complianceItems) ? complianceItems : []).some(
            (i) => i.projectId === contextId || i.programmeId === contextId,
          ))
          ? "complete"
          : activeEntity
            ? "active"
            : "not-started",
    },
    {
      num: "3",
      label: "3. Complete Risk Setup",
      info: "Registering mandatory 3+ strategic risks.",
      status:
        (!!activeEntity?.riskSetupDone &&
          !!activeEntity?.aiRiskDiscoveryDone) ||
        (Array.isArray(risks) ? risks : []).filter(
          (r) => r.projectId === contextId || r.programmeId === contextId,
        ).length >= 3
          ? "complete"
          : activeEntity?.complianceSetupDone ||
              (contextId &&
                (Array.isArray(complianceItems) ? complianceItems : []).some(
                  (i) =>
                    i.projectId === contextId || i.programmeId === contextId,
                ))
            ? "active"
            : "not-started",
    },
    {
      num: "4",
      label: "4. Assign Delivery Team",
      info: "Adding technical and management stakeholders.",
      status: deliveryTeamComplete
        ? "complete"
        : (activeEntity?.riskSetupDone && activeEntity?.aiRiskDiscoveryDone) ||
            (contextId &&
              (Array.isArray(risks) ? risks : []).filter(
                (r) => r.projectId === contextId || r.programmeId === contextId,
              ).length >= 3)
          ? "active"
          : "not-started",
    },
    {
      num: "5",
      label: "5. Publish",
      info: "Final readiness for internal/client publication.",
      status: activeEntity?.isPublished
        ? "complete"
        : canPublish
          ? "active"
          : "not-started",
    },
  ];

  const completedCount = steps.filter((s) => s.status === "complete").length;
  const progress = activeEntity?.isPublished
    ? 100
    : Math.round((completedCount / steps.length) * 100);
  const isComplete = activeEntity?.isPublished;

  return (
    <div className="relative overflow-hidden bg-white rounded-lg border border-slate-200 shadow-lg">
      {loading && (
        <div className="absolute inset-0 z-50 bg-white/60 backdrop-blur-[2px] flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="w-10 h-10 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin shadow-md" />
            <span className="text-sm font-black text-indigo-900 tracking-widest uppercase">Processing</span>
          </div>
        </div>
      )}
      {/* Header */}
      <div className="bg-slate-50/80 px-4 sm:px-6 py-4 sm:py-5 border-b border-slate-100">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg border-2 bg-emerald-50 border-emerald-100 text-emerald-700">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-[13px] font-black text-slate-900 leading-none">
                Compliance & Risk Setup
              </h3>
              <p className="text-[10px] text-slate-500 font-bold mt-1 uppercase tracking-tighter">
                Project Publication Status
              </p>
            </div>
          </div>
          <div
            className={clsx(
              "text-[10px] font-black px-2.5 py-1.5 rounded-lg uppercase tracking-wider shadow-sm",
              isComplete
                ? "bg-emerald-500 text-white"
                : canPublish
                  ? "bg-amber-500 text-white"
                  : "bg-rose-500 text-white",
            )}
          >
            {isComplete
              ? "Published"
              : canPublish
                ? "Ready to Publish"
                : "Action Required"}
          </div>
        </div>

        {/* Progress bar */}
        <div className="space-y-1.5">
          <div className="flex items-end justify-between">
            <span className="text-[11px] font-black text-slate-500 uppercase tracking-widest">
              Overall Completion
            </span>
            <span className="text-2xl font-black text-slate-900 tracking-tight">
              {progress}%
            </span>
          </div>
          <div className="w-full h-3 bg-slate-200/50 rounded-full overflow-hidden shadow-inner border border-slate-100 p-0.5">
            <div
              className={clsx(
                "h-full rounded-full transition-all duration-1000 ease-out shadow-sm",
                isComplete
                  ? "bg-emerald-500"
                  : canPublish
                    ? "bg-amber-500"
                    : "bg-indigo-600",
              )}
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>

      {/* Steps */}
      <div className="px-4 sm:px-6 pt-5 pb-2">
        <div className="text-[11px] font-black text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-2 pb-2 border-b border-slate-50">
          <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-pulse" />
          Mandatory Requirements
        </div>
        <div className="space-y-1">
          {steps.map((step) => (
            <div key={step.num}>
              <PubStep
                num={step.num}
                label={step.label}
                info={step.info}
                status={step.status}
              />
              {/* Actions for Step 2 (Compliance) */}
              {step.num === "2" && (
                <div className="pl-9 pb-2">
                  {step.status === "active" ? (
                    <button
                      onClick={() =>
                        navigate(
                          `/compliance/setup?type=${activeType}&from=initiation`,
                        )
                      }
                      className="text-[10px] font-black text-indigo-600 hover:text-indigo-700 uppercase tracking-widest flex items-center gap-1 bg-indigo-50 px-3 py-1.5 rounded-lg border border-indigo-100 transition-all active:scale-95"
                    >
                      Continue to Compliance Setup
                      <ChevronRight className="w-3 h-3" />
                    </button>
                  ) : step.status === "complete" ? (
                    <button
                      onClick={() =>
                        navigate(
                          `/compliance/dashboard?type=${activeType}&from=initiation`,
                        )
                      }
                      className="text-[10px] font-black text-emerald-600 hover:text-emerald-700 uppercase tracking-widest flex items-center gap-1 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-100 transition-all active:scale-95"
                    >
                      View Compliance Dashboard
                      <CheckCircle2 className="w-3 h-3" />
                    </button>
                  ) : null}
                </div>
              )}
              {/* Actions for Step 3 (Risk) */}
              {step.num === "3" && (
                <div className="pl-9 pb-2">
                  {!activeEntity?.riskSetupDone &&
                  (activeEntity?.complianceSetupDone ||
                    (Array.isArray(complianceItems)
                      ? complianceItems
                      : []
                    ).some(
                      (i) =>
                        i.projectId === contextId ||
                        i.programmeId === contextId,
                    )) ? (
                    <button
                      onClick={() =>
                        navigate(
                          `/risk/setup?type=${activeType}&from=initiation`,
                        )
                      }
                      className="text-[10px] font-black text-indigo-600 hover:text-indigo-700 uppercase tracking-widest flex items-center gap-1 bg-indigo-50 px-3 py-1.5 rounded-lg border border-indigo-100 transition-all active:scale-95"
                    >
                      Continue to Risk Setup
                      <ChevronRight className="w-3 h-3" />
                    </button>
                  ) : activeEntity?.riskSetupDone &&
                    !activeEntity?.aiRiskDiscoveryDone ? (
                    <button
                      onClick={() =>
                        navigate(`/risk/ai?type=${activeType}&from=initiation`)
                      }
                      className="text-[10px] font-black text-indigo-600 hover:text-indigo-700 uppercase tracking-widest flex items-center gap-1 bg-indigo-50 px-3 py-1.5 rounded-lg border border-indigo-100 transition-all active:scale-95 animate-pulse shadow-sm"
                    >
                      Complete AI Risk Inquiry
                      <ScanSearch className="w-3 h-3" />
                    </button>
                  ) : step.status === "complete" ? (
                    <button
                      onClick={() =>
                        navigate(
                          `/risk/dashboard?type=${activeType}&from=initiation`,
                        )
                      }
                      className="text-[10px] font-black text-emerald-600 hover:text-emerald-700 uppercase tracking-widest flex items-center gap-1 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-100 transition-all active:scale-95"
                    >
                      View Risk Dashboard
                      <CheckCircle2 className="w-3 h-3" />
                    </button>
                  ) : null}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* CTA */}
      <div className="px-4 sm:px-6 pb-6 pt-2">
        <button
          disabled={!canPublish || loading}
          onClick={() => {
            const isAdmin = isSuperAdmin(user?.email, userRole);
            const isClientAdmin = isAtLeastClientAdmin(userRole) || isAdmin;
            if (isComplete)
              navigate(
                isClientAdmin
                  ? "/dashboard?type=programme"
                  : "/dashboard?type=project",
              );
            else if (onPublish) onPublish();
          }}
          className={clsx(
            "w-full flex items-center justify-center gap-2 px-6 py-4 text-xs font-black uppercase tracking-[0.2em] rounded-lg transition-all shadow-xl active:scale-95 mt-4",
            canPublish && !loading
              ? isComplete
                ? "bg-emerald-500 hover:bg-emerald-600 shadow-emerald-200"
                : "bg-indigo-600 hover:bg-indigo-700 shadow-indigo-200"
              : "bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200 shadow-none",
            "text-white",
          )}
        >
          {loading ? (
            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : isComplete ? (
            <>
              <CheckCircle2 className="w-4 h-4" /> VIEW{" "}
              {activeType.toUpperCase()} DASHBOARD
            </>
          ) : (
            <>
              <Rocket className="w-4 h-4" /> PUBLISH {activeType.toUpperCase()}
            </>
          )}
        </button>
        {!isComplete && (
          <p className="text-[11px] text-center text-slate-500 mt-3 font-bold px-4 leading-relaxed bg-slate-50 py-2.5 rounded-lg border border-dashed border-slate-200">
            Complete all requirements above to enable {activeType} publication.
          </p>
        )}
      </div>
    </div>
  );
}
