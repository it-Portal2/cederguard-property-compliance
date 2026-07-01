export const INTEGRATION_PROVIDERS = [
  'googleCalendar',
  'outlookCalendar',
  'slack',
  'teams',
  'sharepoint',
  'powerbi',
] as const;

export type IntegrationProvider = (typeof INTEGRATION_PROVIDERS)[number];

export type FieldType = 'text' | 'textarea' | 'json' | 'number' | 'select';

export interface ProviderField {
  key: string;
  label: string;
  type: FieldType;
  secret?: boolean;
  required?: boolean;
  placeholder?: string;
  help?: string;
  helpLink?: { label: string; url: string };
  options?: { value: string; label: string }[];
}

export interface SyncCategory {
  key: string;
  label: string;
}

export interface ProviderMeta {
  id: IntegrationProvider;
  name: string;
  description: string;
  logo: string;
  brand: string;
  website: string;
  /** 'feed' providers (Power BI) collect no user credentials — they generate a feed key instead. */
  kind: 'alert' | 'calendar' | 'documents' | 'feed';
  fields: ProviderField[];
  syncCategories: SyncCategory[];
  setupTitle: string;
  setupSteps: string[];
}

const LOGO_BASE = `${import.meta.env.BASE_URL}integrations/`;

const ALERT_CATEGORIES: SyncCategory[] = [
  { key: 'severeRisk', label: 'Risk alerts' },
  { key: 'governanceApproval', label: 'Governance approvals' },
  { key: 'complianceDeadline', label: 'Compliance deadlines' },
  { key: 'deadlineEscalation', label: 'Deadline escalations' },
];

const CALENDAR_CATEGORIES: SyncCategory[] = [
  { key: 'meetings', label: 'Governance meetings' },
  { key: 'keyDecisions', label: 'Gateway / key decisions' },
  { key: 'milestones', label: 'Project milestones' },
  { key: 'complianceDeadlines', label: 'Compliance deadlines' },
  { key: 'riskReviews', label: 'Risk reviews' },
];

export const PROVIDERS: ProviderMeta[] = [
  {
    id: 'googleCalendar',
    name: 'Google Calendar',
    description: 'Automatically sync governance activities, milestones and assurance reviews to a shared calendar.',
    logo: `${LOGO_BASE}google-calendar.svg`,
    brand: '#4285F4',
    website: 'https://calendar.google.com',
    kind: 'calendar',
    fields: [
      {
        key: 'serviceAccountJson',
        label: 'Service account key (JSON)',
        type: 'json',
        secret: true,
        required: true,
        help: 'Create a service account in Google Cloud Console and upload its JSON key.',
        helpLink: { label: 'Google Cloud Console', url: 'https://console.cloud.google.com' },
      },
      {
        key: 'calendarId',
        label: 'Calendar ID',
        type: 'text',
        required: true,
        placeholder: 'abc123@group.calendar.google.com',
        help: 'From the calendar’s Settings → Integrate calendar.',
      },
      {
        key: 'defaultDurationMin',
        label: 'Default duration (minutes, when no end time)',
        type: 'number',
        placeholder: '60',
      },
    ],
    syncCategories: CALENDAR_CATEGORIES,
    setupTitle: 'Connect a Google service account',
    setupSteps: [
      'Open console.cloud.google.com and create (or pick) a project.',
      'Go to APIs & Services → Library, search “Google Calendar API” and click Enable.',
      'Go to APIs & Services → Credentials → Create Credentials → Service account. Name it and click Done (no roles needed).',
      'Open the service account → Keys tab → Add Key → Create new key → JSON. A JSON file downloads — upload it below.',
      'In Google Calendar, open the target calendar’s Settings and sharing → Share with specific people → add the service-account email with “Make changes to events”.',
      'On the same settings page, scroll to Integrate calendar and copy the Calendar ID into the field below → Save → Test.',
    ],
  },
  {
    id: 'outlookCalendar',
    name: 'Outlook Calendar',
    description: 'Synchronise governance meetings, milestones and reviews with a Microsoft 365 calendar.',
    logo: `${LOGO_BASE}outlook.svg`,
    brand: '#0F6CBD',
    website: 'https://outlook.office.com/calendar',
    kind: 'calendar',
    fields: [
      { key: 'tenantId', label: 'Directory (tenant) ID', type: 'text', required: true, placeholder: 'contoso.onmicrosoft.com or a GUID' },
      { key: 'clientId', label: 'Application (client) ID', type: 'text', required: true, placeholder: '00000000-0000-0000-0000-000000000000' },
      {
        key: 'clientSecret',
        label: 'Client secret',
        type: 'text',
        secret: true,
        required: true,
        help: 'The secret Value (not the Secret ID) from Certificates & secrets.',
      },
      { key: 'mailbox', label: 'Target mailbox (UPN)', type: 'text', required: true, placeholder: 'governance@yourcompany.com' },
    ],
    syncCategories: CALENDAR_CATEGORIES,
    setupTitle: 'Register a Microsoft Entra app (admin required)',
    setupSteps: [
      'Sign in to entra.microsoft.com as an admin.',
      'Go to App registrations → New registration (single tenant, no redirect URI) → Register.',
      'On Overview, copy the Application (client) ID and Directory (tenant) ID into the fields below.',
      'Go to API permissions → Add a permission → Microsoft Graph → Application permissions → add Calendars.ReadWrite.',
      'Click Grant admin consent for your tenant (a Global / Privileged Role Admin must do this).',
      'Go to Certificates & secrets → New client secret → copy the Value immediately and paste it below.',
      'Enter the target mailbox (the shared calendar’s address) → Save → Test.',
    ],
  },
  {
    id: 'slack',
    name: 'Slack',
    description: 'Keep delivery teams aligned with instant risk, governance and compliance alerts in a channel.',
    logo: `${LOGO_BASE}slack.svg`,
    brand: '#611f69',
    website: 'https://slack.com',
    kind: 'alert',
    fields: [
      {
        key: 'webhookUrl',
        label: 'Incoming webhook URL',
        type: 'text',
        secret: true,
        required: true,
        placeholder: 'https://hooks.slack.com/services/T…/B…/…',
        help: 'Create a Slack app with Incoming Webhooks and copy the channel’s webhook URL.',
        helpLink: { label: 'Slack apps', url: 'https://api.slack.com/apps' },
      },
    ],
    syncCategories: ALERT_CATEGORIES,
    setupTitle: 'Create a Slack incoming webhook',
    setupSteps: [
      'Go to api.slack.com/apps → Create New App → From scratch. Name it and pick your workspace.',
      'In the sidebar under Features, open Incoming Webhooks and toggle Activate Incoming Webhooks on.',
      'Click Add New Webhook to Workspace, choose the channel to post to, then click Allow.',
      'Copy the Webhook URL and paste it below → Save → Test.',
    ],
  },
  {
    id: 'teams',
    name: 'Microsoft Teams',
    description: 'Post AI-powered governance, risk and compliance updates to a Teams channel.',
    logo: `${LOGO_BASE}microsoft-teams.svg`,
    brand: '#4b53bc',
    website: 'https://teams.microsoft.com',
    kind: 'alert',
    fields: [
      {
        key: 'webhookUrl',
        label: 'Workflow webhook URL',
        type: 'text',
        secret: true,
        required: true,
        placeholder: 'https://…logic.azure.com/…',
        help: 'Create a Teams Workflow (“Post to a channel when a webhook request is received”) and copy its URL.',
        helpLink: { label: 'How to set up', url: 'https://support.microsoft.com/office/8ae491c7-0394-4861-ba59-055e33f75498' },
      },
    ],
    syncCategories: ALERT_CATEGORIES,
    setupTitle: 'Create a Teams Workflow webhook',
    setupSteps: [
      'In Teams, open the target channel’s ••• menu → Workflows.',
      'Choose the template “Post to a channel when a webhook request is received”.',
      'Confirm the Team and Channel, then click Add workflow.',
      'Copy the generated webhook URL and paste it below → Save → Test.',
    ],
  },
  {
    id: 'sharepoint',
    name: 'Microsoft SharePoint',
    description: 'Keep sealed board reports and evidence in a secure, audit-ready document library.',
    logo: `${LOGO_BASE}sharepoint.svg`,
    brand: '#038387',
    website: 'https://www.microsoft.com/microsoft-365/sharepoint',
    kind: 'documents',
    fields: [
      { key: 'tenantId', label: 'Directory (tenant) ID', type: 'text', required: true, placeholder: 'contoso.onmicrosoft.com or a GUID' },
      { key: 'clientId', label: 'Application (client) ID', type: 'text', required: true, placeholder: '00000000-0000-0000-0000-000000000000' },
      { key: 'clientSecret', label: 'Client secret', type: 'text', secret: true, required: true, help: 'The secret Value from Certificates & secrets. Can reuse your Outlook app.' },
      { key: 'siteHost', label: 'Site hostname', type: 'text', required: true, placeholder: 'contoso.sharepoint.com' },
      { key: 'sitePath', label: 'Site path', type: 'text', required: true, placeholder: '/sites/Compliance' },
      { key: 'folderPath', label: 'Folder (document library path)', type: 'text', placeholder: 'CedarGuard/Reports' },
    ],
    syncCategories: [
      { key: 'sealedReports', label: 'Sealed board reports' },
      { key: 'evidence', label: 'Evidence documents' },
    ],
    setupTitle: 'Register a Microsoft Entra app (admin required)',
    setupSteps: [
      'In entra.microsoft.com → App registrations, reuse your Outlook app or create a new registration.',
      'Go to API permissions → Add → Microsoft Graph → Application permissions → add Sites.Selected (recommended) or Sites.ReadWrite.All.',
      'Click Grant admin consent for your tenant.',
      'Under Certificates & secrets, create a client secret and copy the Value.',
      'For Sites.Selected, a SharePoint/Global admin must grant the app write access on the specific site.',
      'Enter the site hostname, site path and target folder below → Save → Test.',
    ],
  },
  {
    id: 'powerbi',
    name: 'Microsoft Power BI',
    description: 'Transform project data into executive dashboards with a live, read-only data feed.',
    logo: `${LOGO_BASE}powerbi.svg`,
    brand: '#F2C811',
    website: 'https://powerbi.microsoft.com',
    kind: 'feed',
    fields: [
      {
        key: 'dataScope',
        label: 'Data scope',
        type: 'select',
        options: [
          { value: 'all', label: 'All datasets' },
          { value: 'risks', label: 'Risks' },
          { value: 'compliance', label: 'Compliance' },
          { value: 'governance', label: 'Governance' },
          { value: 'resource', label: 'Resource planning' },
        ],
      },
    ],
    syncCategories: [],
    setupTitle: 'Connect Power BI to your feed',
    setupSteps: [
      'Click Generate feed key below, then copy the feed URL (it already contains your key — keep it secret).',
      'Open Power BI Desktop → Home ribbon → Get data → Web.',
      'Paste the feed URL and click OK. If prompted to sign in, choose Anonymous → Connect.',
      'Click Load, build your report, then Publish to the Power BI Service.',
      'For scheduled cloud refresh: in the Service, open the dataset’s Settings → Data source credentials → Anonymous, turn “Skip test connection” ON, then set the refresh schedule.',
    ],
  },
];

export function getProvider(id: string): ProviderMeta | undefined {
  return PROVIDERS.find((p) => p.id === id);
}
