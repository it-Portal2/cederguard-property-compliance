import { ApiContext } from './context.js';

// Deny-by-default allowlist: the ONLY action names a `viewer` role may call.
// Everything else — including the AI actions in api/routes/ai.ts, which is
// out-of-bounds to edit and has no role checks of its own — is rejected here,
// before it ever reaches its handler. This is the single enforcement point
// for viewer restrictions across the whole API.
export const VIEWER_ALLOWED_ACTIONS: ReadonlySet<string> = new Set([
  // auth/session/profile plumbing every signed-in user needs
  'ping',
  'getProfile',
  'saveProfile',
  'getPreferences',
  'savePreference',
  'getApiKeys',
  // self-service: a viewer may delete their OWN account (the handler defaults
  // to the caller's uid; deleting any other user still requires isAdmin)
  'deleteUserAccount',

  // read-only project/programme/portfolio data
  'getProjects',
  'clientGetProjects',
  'getProjectById',
  'getPortfolioData',
  'clientGetProjectData',
  'getProgrammeById',

  // read-only compliance/risk/controls/incidents/assurance data
  'getData',
  'getEvidence',
  'getComplianceLibrary',
  'getComplianceDomains',
  'controlsList',
  'incidentsList',
  'assuranceList',
  'validationGet',
  'validationGetForContext',

  // read-only team/org context, so a viewer can see who to ask
  'clientGetTeam',
  'clientGetPMs',
  'getAssignablePMs',

  // read-only own-profile signature (rendered in Profile Settings) — reads
  // the caller's own users/{uid}.signatureUrl, no write
  'governanceGetUserSignature',

  // read-only resource planner / historical reporting
  'resourceListSchemes',
  'resourceGetAssumptions',
  'hrcReadSnapshot',
  'hrcListAvailableMonths',
  'hrcGetDeploymentMeta',

  // the access-request flow itself must always be reachable
  'getMyAccessRequest',
  'createAccessRequest',
]);

export const ACCESS_RESTRICTED_CODE = 'ACCESS_RESTRICTED';

/**
 * Returns true (and has already written the 403 response) if this request
 * must be blocked. Call immediately after ctx is built, before dispatch.
 */
export function blockIfViewerRestricted(
  req: any,
  res: any,
  ctx: ApiContext,
  action: string,
): boolean {
  if (ctx.userData?.role !== 'viewer') return false;
  if (VIEWER_ALLOWED_ACTIONS.has(action)) return false;

  res.status(403).json({
    error: 'This action requires an upgraded account role.',
    code: ACCESS_RESTRICTED_CODE,
    message: 'Your account currently has read-only (Viewer) access. Request access from your workspace admin to unlock this action.',
    action,
  });
  return true;
}
