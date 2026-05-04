// OB-1 — Get Started onboarding step registry.
//
// Role-aware step list shown in the first-login modal. Steps reflect
// the actual canonical setup flow in this codebase (programme →
// project → compliance → risk → team → governance → reports), not
// generic stock copy.
//
// ClientAdmin / SuperAdmin → 7 steps starting with "Create your first programme".
// Pure ProjectManager → 6 steps starting with "Create your first project"
// (PMs cannot create programmes — `canCreateProgramme(role)` is false).

import {
  Layers,
  Briefcase,
  ShieldCheck,
  AlertTriangle,
  Users,
  Gavel,
  FileText,
  Compass,
  type LucideIcon,
} from "lucide-react";
import type { UserRole } from "../../lib/roles";

export interface OnboardingStep {
  /** Stable key used for analytics + react keys. */
  key: string;
  /** Heading shown in bold on the step card. */
  title: string;
  /** One-line description, slate-500 muted. */
  description: string;
  /** Route the primary CTA navigates to (only the FIRST step is used as
   *  the deep-link target — but every step carries its href so future
   *  per-step "Go" buttons can read it). */
  href: string;
  /** lucide-react icon for the left badge. */
  icon: LucideIcon;
}

const STEP_PROGRAMME: OnboardingStep = {
  key: "programme",
  title: "Create your first programme",
  description:
    "Programmes group related projects under one strategic outcome — housing, infrastructure, regeneration.",
  href: "/programmes/new",
  icon: Layers,
};

const STEP_PROJECT_CLIENT_ADMIN: OnboardingStep = {
  key: "project",
  title: "Create your first project",
  description:
    "Each project sits inside a programme and tracks its own scope, RIBA stage, team and milestones.",
  href: "/project/initiation",
  icon: Briefcase,
};

const STEP_PROJECT_PM: OnboardingStep = {
  key: "project",
  title: "Create your first project",
  description:
    "Set up the project name, RIBA stage, location and pull together your delivery team.",
  href: "/project/initiation",
  icon: Briefcase,
};

const STEP_COMPLIANCE: OnboardingStep = {
  key: "compliance",
  title: "Set up the compliance profile",
  description:
    "A 5-phase questionnaire identifies the regulations that apply to your project. AI helps surface gaps.",
  href: "/compliance/setup",
  icon: ShieldCheck,
};

const STEP_RISK_CLIENT_ADMIN: OnboardingStep = {
  key: "risk",
  title: "Set up the risk register",
  description:
    "Capture programme- and project-level risks. KRIs and thresholds drive your alerts.",
  href: "/risk/setup",
  icon: AlertTriangle,
};

const STEP_RISK_PM: OnboardingStep = {
  key: "risk",
  title: "Set up the risk register",
  description:
    "Capture project-level risks. KRIs and thresholds drive your alerts.",
  href: "/risk/setup",
  icon: AlertTriangle,
};

const STEP_TEAM_CLIENT_ADMIN: OnboardingStep = {
  key: "team",
  title: "Invite your delivery team",
  description:
    "Add Project Managers and Senior PMs by email. Roles control what each member can edit.",
  href: "/team",
  icon: Users,
};

const STEP_TEAM_PM: OnboardingStep = {
  key: "team",
  title: "Invite your delivery team",
  description:
    "Add team members by email. Roles control what each member can edit.",
  href: "/team",
  icon: Users,
};

const STEP_GOVERNANCE_CLIENT_ADMIN: OnboardingStep = {
  key: "governance",
  title: "Configure programme governance",
  description:
    "Set up your governance framework, board calendar and report templates for member-level decisions.",
  href: "/governance/framework",
  icon: Gavel,
};

const STEP_GOVERNANCE_PM: OnboardingStep = {
  key: "governance",
  title: "Explore programme governance",
  description:
    "Browse Forward Plan, board calendar and report templates set up by your Programme Manager.",
  href: "/governance/dashboard",
  icon: Compass,
};

const STEP_REPORT: OnboardingStep = {
  key: "report",
  title: "Generate your first report",
  description:
    "Pull a project status report from your live data — exports to PDF, ready for the board pack.",
  href: "/reporting/project",
  icon: FileText,
};

/**
 * Returns the role-aware onboarding step list.
 * `canCreateProgramme` is taken as an explicit boolean so the caller
 * can compute it once via the role helper without this module having
 * to reach into role-helper internals.
 */
export function getOnboardingSteps(
  _role: UserRole | undefined,
  canCreateProgramme: boolean,
): OnboardingStep[] {
  if (canCreateProgramme) {
    return [
      STEP_PROGRAMME,
      STEP_PROJECT_CLIENT_ADMIN,
      STEP_COMPLIANCE,
      STEP_RISK_CLIENT_ADMIN,
      STEP_TEAM_CLIENT_ADMIN,
      STEP_GOVERNANCE_CLIENT_ADMIN,
      STEP_REPORT,
    ];
  }
  return [
    STEP_PROJECT_PM,
    STEP_COMPLIANCE,
    STEP_RISK_PM,
    STEP_TEAM_PM,
    STEP_GOVERNANCE_PM,
    STEP_REPORT,
  ];
}
