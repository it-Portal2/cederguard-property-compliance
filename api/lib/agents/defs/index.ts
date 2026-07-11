import { AGENTS } from '../registry.js';
import { riskIncidentAgent } from './riskIncident.js';
import { complianceAgent } from './compliance.js';
import { governanceAgent } from './governance.js';
import { evidenceAgent } from './evidence.js';

// Register every implemented agent. Importing this module wires the registry; the
// route imports it once so the AGENTS map is populated before any request. Agents
// land here as they are built (AG8–AG15).
AGENTS.riskIncident = riskIncidentAgent;
AGENTS.compliance = complianceAgent;
AGENTS.governance = governanceAgent;
AGENTS.evidence = evidenceAgent;
