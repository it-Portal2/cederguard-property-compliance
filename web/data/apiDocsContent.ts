import {
  KeyRound,
  Server,
  Users,
  Briefcase,
  LayoutDashboard,
  ShieldAlert,
  Database,
  Terminal,
  type LucideIcon,
} from 'lucide-react';

export interface ApiParam {
  name: string;
  type: string;
  required?: boolean;
  description: string;
}

export interface ApiCodeVariant {
  id: string;
  label: string;
  code: string;
}

export interface ApiRbacRole {
  icon: LucideIcon;
  variant: 'client' | 'pm' | 'admin';
  title: string;
  description: string;
}

export interface ApiEndpoint {
  path: string;
  action?: string;
}

export interface ApiSection {
  id: string;
  navGroup: string;
  navLabel: string;
  method?: 'POST';
  title: string;
  icon?: LucideIcon;
  paragraphs: string[];
  endpoint?: ApiEndpoint;
  calloutType?: 'warn' | 'info' | 'danger';
  callout?: string;
  requiredRole?: string;
  requestParams?: ApiParam[];
  responseParams?: ApiParam[];
  codeVariants?: ApiCodeVariant[];
  responseExample?: ApiCodeVariant;
  rbacRoles?: ApiRbacRole[];
  steps?: string[];
}

export const API_PAGE_TITLE = 'Platform API Reference';
export const API_PAGE_LEDE =
  "Integrate Cedar Risk data into your BI dashboards, ERP systems, or custom scripts. All endpoints enforce your organisation's RBAC.";

export const API_SECTIONS: ApiSection[] = [
  {
    id: 'authentication',
    navGroup: 'Getting Started',
    navLabel: 'Authentication',
    title: 'Authentication',
    icon: KeyRound,
    paragraphs: [
      'All API endpoints require authentication using an API Key. You can generate an API key from the Developer Settings page inside the portal. Your API key inherits the exact permissions of your user account.',
      'Provide the key in the HTTP Authorization header as a Bearer token.',
    ],
    calloutType: 'warn',
    callout:
      'Security Warning · Treat your API key like a password. Do not commit it to public repositories or expose it in client-side code. If compromised, revoke it immediately from the dashboard.',
    codeVariants: [
      {
        id: 'header',
        label: 'HTTP Header',
        code: 'Authorization: Bearer cdR_XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
      },
    ],
  },
  {
    id: 'base-url',
    navGroup: 'Getting Started',
    navLabel: 'Base architecture',
    title: 'Base Architecture (RPC)',
    icon: Server,
    paragraphs: [
      'The API uses a single RPC-style endpoint. All requests are made as POST requests to the base URL, with the desired operation specified in the JSON body via the action property.',
      'Every request is a POST. The action field tells the server which operation to perform, scoped to the permissions of the API key used.',
    ],
    endpoint: { path: 'https://cedarguard.co.uk/api' },
    codeVariants: [
      {
        id: 'body',
        label: 'JSON · Request body',
        code: '{\n  "action": "clientGetProjectData"\n}',
      },
    ],
  },
  {
    id: 'rbac',
    navGroup: 'Getting Started',
    navLabel: 'Role-based access',
    title: 'Role-Based Access Control',
    icon: Users,
    paragraphs: [
      'Your API key is bound to your user role. Attempting to call an endpoint you lack permissions for will result in a 403 Forbidden error.',
    ],
    rbacRoles: [
      {
        variant: 'client',
        icon: Briefcase,
        title: 'Client Admin',
        description:
          'Can view all programmes, all projects across the organization, invite PMs, and access aggregated reporting metrics.',
      },
      {
        variant: 'pm',
        icon: LayoutDashboard,
        title: 'Project Manager',
        description:
          'Can only query and modify projects they are explicitly assigned to. Can read/write risks, issues, and compliance evidence.',
      },
      {
        variant: 'admin',
        icon: ShieldAlert,
        title: 'Super Admin',
        description:
          'Can access global tenant statistics, pricing configurations, global mapping standards, and tenant-wide billing.',
      },
    ],
    codeVariants: [
      {
        id: '403',
        label: 'HTTP · 403 Response',
        code: '{\n  "success": false,\n  "error": "Forbidden",\n  "code": 403,\n  "detail": "This API key (role: pm) cannot perform action \'clientGetProjectData\'"\n}',
      },
    ],
  },
  {
    id: 'client-projects',
    navGroup: 'Client Admin API',
    navLabel: 'Get portfolio & RAG',
    method: 'POST',
    title: 'Get Portfolio & RAG Status',
    paragraphs: [
      'Retrieves all projects across the organization, including aggregated counts of open risks, compliance items, issues, and an automatically calculated RAG status (Red/Amber/Green) for BI dashboards.',
    ],
    endpoint: { path: '/api', action: 'clientGetProjectData' },
    requiredRole: 'client-admin or higher',
    requestParams: [
      { name: 'action', type: 'string', required: true, description: 'Must be "clientGetProjectData".' },
    ],
    responseParams: [
      { name: 'success', type: 'boolean', description: 'Always returned. true on success.' },
      { name: 'projects[]', type: 'array', description: 'All projects with health, exposure, and RAG aggregates.' },
      { name: 'projects[].rag', type: 'string', description: 'One of "Red", "Amber", "Green".' },
      { name: 'projects[].compPct', type: 'number', description: 'Compliance completion %, 0–100.' },
      { name: 'projects[].riskOpen', type: 'number', description: 'Count of open (un-closed) risks.' },
    ],
    codeVariants: [
      {
        id: 'curl',
        label: 'cURL Request',
        code: `curl -X POST https://cedarguard.co.uk/api \\
  -H "Authorization: Bearer cdR_YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"action": "clientGetProjectData"}'`,
      },
      {
        id: 'node',
        label: 'Node.js',
        code: `const res = await fetch("https://cedarguard.co.uk/api", {
  method: "POST",
  headers: {
    "Authorization": \`Bearer \${process.env.CG_API_KEY}\`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ action: "clientGetProjectData" }),
});
const data = await res.json();`,
      },
      {
        id: 'python',
        label: 'Python',
        code: `import requests, os

res = requests.post(
  "https://cedarguard.co.uk/api",
  headers={
    "Authorization": f"Bearer {os.environ['CG_API_KEY']}",
    "Content-Type": "application/json",
  },
  json={"action": "clientGetProjectData"},
)
data = res.json()`,
      },
    ],
    responseExample: {
      id: 'resp',
      label: 'JSON Response',
      code: `{
  "success": true,
  "projects": [
    {
      "id": "project_id_123",
      "name": "Riverside Estate Refurbishment",
      "rag": "Red",
      "compPct": 45,
      "riskTotal": 12,
      "riskOpen": 4,
      "riskHigh": 2,
      "issueOpen": 1,
      "isPublished": true,
      "setupProgress": 100
    }
  ]
}`,
    },
  },
  {
    id: 'client-team',
    navGroup: 'Client Admin API',
    navLabel: 'Invite project manager',
    method: 'POST',
    title: 'Invite a Project Manager',
    paragraphs: [
      'Programmatically invite new Project Managers to your tenant workspace. They will receive an email invitation to set their password.',
    ],
    endpoint: { path: '/api', action: 'inviteProjectManager' },
    requiredRole: 'client-admin or higher',
    requestParams: [
      { name: 'action', type: 'string', required: true, description: 'Must be "inviteProjectManager".' },
      { name: 'pmEmail', type: 'string', required: true, description: 'Work email of the PM to invite.' },
      { name: 'pmName', type: 'string', required: true, description: 'Display name.' },
      {
        name: 'pmRole',
        type: 'string',
        description:
          'One of "Project Manager", "Senior PM", "Assistant PM", "Coordinator". Defaults to "Project Manager".',
      },
    ],
    codeVariants: [
      {
        id: 'curl',
        label: 'cURL Request',
        code: `curl -X POST https://cedarguard.co.uk/api \\
  -H "Authorization: Bearer cdR_YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "action": "inviteProjectManager",
    "pmEmail": "john.doe@housingassoc.co.uk",
    "pmName": "John Doe",
    "pmRole": "Project Manager"
  }'`,
      },
    ],
  },
  {
    id: 'pm-projects',
    navGroup: 'Project Manager API',
    navLabel: 'Get project data',
    method: 'POST',
    title: 'Get Project Data (Read)',
    paragraphs: [
      'Generic endpoint to fetch specific collections — risks, issues, complianceItems — for a given projectId.',
    ],
    endpoint: { path: '/api', action: 'getData' },
    requiredRole: 'project-manager or higher, with assignment to the project',
    requestParams: [
      { name: 'action', type: 'string', required: true, description: 'Must be "getData".' },
      { name: 'collection', type: 'string', required: true, description: 'One of "risks", "issues", "complianceItems".' },
      { name: 'projectId', type: 'string', required: true, description: 'ID of the project to read.' },
    ],
    codeVariants: [
      {
        id: 'curl',
        label: 'cURL Request (Get Risks)',
        code: `curl -X POST https://cedarguard.co.uk/api \\
  -H "Authorization: Bearer cdR_YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "action": "getData",
    "collection": "risks",
    "projectId": "project_id_123"
  }'`,
      },
    ],
  },
  {
    id: 'pm-data',
    navGroup: 'Project Manager API',
    navLabel: 'Save (upsert) data',
    method: 'POST',
    title: 'Create or Update Data (Upsert)',
    paragraphs: [
      'If an item in the array has an existing id, it will be updated. If it lacks an id, a new record is created.',
    ],
    endpoint: { path: '/api', action: 'saveData' },
    calloutType: 'info',
    callout:
      "Activity-logged · Every create/update/delete through this endpoint is recorded in the activity log with the API key's bound identity and a timestamp.",
    codeVariants: [
      {
        id: 'curl',
        label: 'cURL Request (Upsert Issue)',
        code: `curl -X POST https://cedarguard.co.uk/api \\
  -H "Authorization: Bearer cdR_YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "action": "saveData",
    "collection": "issues",
    "projectId": "project_id_123",
    "data": [
      {
        "id": "issue_889",
        "desc": "Fire doors failed inspection on Floor 3",
        "status": "Open",
        "severity": 5
      }
    ]
  }'`,
      },
    ],
  },
  {
    id: 'use-case-sync',
    navGroup: 'Quickstarts',
    navLabel: 'BI sync (PowerBI / Tableau)',
    title: 'Use Case: Automated BI Sync',
    icon: Database,
    paragraphs: [
      'Most organizations want to pull their Cedar Risk metrics into a centralized corporate PowerBI dashboard. You can achieve this using a nightly CRON job or an Azure Logic App.',
    ],
    steps: [
      'Generate a Service Account Key: Log in as a Client Admin, go to Developer Settings, and generate a long-lived API key named "PowerBI Sync".',
      'Fetch the Portfolio: Run a script that calls the clientGetProjectData action to get the high-level RAG statuses and aggregate counts for all projects.',
      'Fetch Details (Iterative): If detail-level drill-downs are needed in PowerBI, loop through the returned project.ids and call getData with collection: "risks" and collection: "issues".',
      'Store in Data Warehouse: Dump the resulting JSON into your Snowflake, BigQuery, or SQL Server staging tables, flattening the arrays for PowerBI ingestion.',
    ],
    codeVariants: [
      {
        id: 'node',
        label: 'Node.js · Nightly Sync',
        code: `const KEY = process.env.CG_API_KEY;

async function cgPost(body) {
  const res = await fetch("https://cedarguard.co.uk/api", {
    method: "POST",
    headers: {
      "Authorization": \`Bearer \${KEY}\`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  return res.json();
}

// 1. Fetch portfolio
const { projects } = await cgPost({
  action: "clientGetProjectData",
});

// 2. Fetch detail per project
for (const p of projects) {
  const { data: risks } = await cgPost({
    action: "getData",
    collection: "risks",
    projectId: p.id,
  });
  await writeToWarehouse(p, risks);
}`,
      },
    ],
  },
  {
    id: 'postman',
    navGroup: 'Quickstarts',
    navLabel: 'Postman collection',
    title: 'Ready for Postman?',
    icon: Terminal,
    paragraphs: [
      'Test the API immediately without writing a single line of code. Copy the JSON snippet below to import a pre-configured Cedar API Collection directly into Postman.',
    ],
    steps: [
      'Open Postman → File → Import → Raw Text.',
      'Paste the JSON collection.',
      'Set environment variable api_key to your generated key.',
      'Send the first request — you should see your portfolio response in seconds.',
    ],
    codeVariants: [
      {
        id: 'postman',
        label: 'Postman Collection v2.1',
        code: `{
  "info": {
    "name": "CedarGuard API",
    "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  },
  "item": [
    {
      "name": "Get Portfolio RAG",
      "request": {
        "method": "POST",
        "header": [
          { "key": "Authorization", "value": "Bearer {{api_key}}" },
          { "key": "Content-Type", "value": "application/json" }
        ],
        "url": { "raw": "https://cedarguard.co.uk/api", "host": ["https://cedarguard.co.uk"], "path": ["api"] },
        "body": { "mode": "raw", "raw": "{\\"action\\": \\"clientGetProjectData\\"}" }
      }
    }
  ]
}`,
      },
    ],
  },
];
