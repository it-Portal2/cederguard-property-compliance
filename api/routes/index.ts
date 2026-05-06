import { projectRoutes } from './projects.js';
import { programmeRoutes } from './programmes.js';
import { adminRoutes } from './admin.js';
import { teamRoutes } from './team.js';
import { dataRoutes } from './data.js';
import { authRoutes } from './auth.js';
import { aiRoutes } from './ai.js';
import { complianceRoutes } from './compliance.js';
import { profileRoutes } from './profile.js';
import { notificationsRoutes } from './notifications.js';
import { governanceRoutes } from './governance.js';
import { governanceFrameworkRoutes } from './governanceFramework.js';
import { governanceTemplatesRoutes } from './governanceTemplates.js';
import { governanceForwardPlanRoutes } from './governanceForwardPlan.js';
import { governanceReportsRoutes } from './governanceReports.js';
import { governanceMeetingsRoutes } from './governanceMeetings.js';
import { governanceProjectDocsRoutes } from './governanceProjectDocs.js';
import { governanceArchiveRoutes } from './governanceArchive.js';
import { governanceDashboardRoutes } from './governanceDashboard.js';
import { governanceCronRoutes } from './governanceCron.js';
import { historicalReportingRoutes } from './historicalReporting.js';
import { technicalAssuranceRoutes } from './technicalAssurance.js';

export const allRoutes: Record<string, any> = {
  ...projectRoutes,
  ...programmeRoutes,
  ...adminRoutes,
  ...teamRoutes,
  ...dataRoutes,
  ...authRoutes,
  ...aiRoutes,
  ...complianceRoutes,
  ...profileRoutes,
  ...notificationsRoutes,
  ...governanceRoutes,
  ...governanceFrameworkRoutes,
  ...governanceTemplatesRoutes,
  ...governanceForwardPlanRoutes,
  ...governanceReportsRoutes,
  ...governanceMeetingsRoutes,
  ...governanceProjectDocsRoutes,
  ...governanceArchiveRoutes,
  ...governanceDashboardRoutes,
  ...governanceCronRoutes,
  ...historicalReportingRoutes,
  ...technicalAssuranceRoutes,
};
