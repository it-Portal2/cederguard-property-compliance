import { AGENTS } from '../registry.js';
import { riskIncidentAgent } from './riskIncident.js';
import { complianceAgent } from './compliance.js';
import { governanceAgent } from './governance.js';
import { evidenceAgent } from './evidence.js';
import { technicalAgent } from './technical.js';
import { monitoringAgent } from './monitoring.js';
import { deliveryAgent } from './delivery.js';

// Register every implemented agent. Importing this module wires the registry; the
// route imports it once so the AGENTS map is populated before any request.
AGENTS.riskIncident = riskIncidentAgent;
AGENTS.compliance = complianceAgent;
AGENTS.governance = governanceAgent;
AGENTS.evidence = evidenceAgent;
AGENTS.technical = technicalAgent;
AGENTS.monitoring = monitoringAgent;
AGENTS.delivery = deliveryAgent;
