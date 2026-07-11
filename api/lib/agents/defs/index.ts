import { AGENTS } from '../registry.js';
import { riskIncidentAgent } from './riskIncident.js';

// Register every implemented agent. Importing this module wires the registry; the
// route imports it once so the AGENTS map is populated before any request. Agents
// land here as they are built (AG8–AG15).
AGENTS.riskIncident = riskIncidentAgent;
