// Friendly display names for AI tool calls. Used by both the activity
// timeline and any future surface that needs to surface "what the AI is
// doing right now" in human-readable form.

export const TOOL_DISPLAY_NAMES: Record<string, string> = {
  listAccessibleProjects: "Searching projects",
  getProjectDetails: "Loading project details",
  listAccessibleProgrammes: "Searching programmes",
  getProgrammeDetails: "Loading programme details",
  searchRisks: "Searching risks",
  searchIssues: "Searching issues",
  searchComplianceItems: "Searching compliance items",
  getKRIs: "Loading KRIs",
  searchForwardPlanItems: "Searching forward plan",
  searchMeetings: "Searching meetings",
  searchReports: "Searching reports",
  searchMeetingTemplates: "Loading templates",
  getGovernanceFramework: "Loading governance framework",
  listProjectGovernanceDocs: "Loading project governance docs",
  listGovernanceArchive: "Loading governance archive",
  listAuditFlaggedTacEnquiries: "Loading audit-flagged enquiries",
  searchTacEnquiries: "Searching enquiries",
  searchRfis: "Searching RFIs",
  getMyTasks: "Loading tasks",
  getMonthlyHistoricalSnapshot: "Loading historical snapshot",
  crossTenantListClients: "Listing client workspaces",
  // Synthetic event used by the server-side cascading fallback.
  _fallback: "Switching AI provider",
};

export function labelForTool(name: string): string {
  return TOOL_DISPLAY_NAMES[name] ?? name;
}
