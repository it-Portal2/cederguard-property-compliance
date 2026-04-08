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
  ...notificationsRoutes
};
