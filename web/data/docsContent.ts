import {
  Shield,
  TrendingUp,
  FolderKanban,
  Activity,
  ClipboardList,
  type LucideIcon,
} from 'lucide-react';

export interface DocTopic {
  id: string;
  title: string;
  description: string;
  steps?: string[];
  tip?: string;
  link?: string;
  linkLabel?: string;
}

export interface DocRole {
  key: string;
  label: string;
  icon: LucideIcon;
  description: string;
  topics: DocTopic[];
}

export const DOC_ROLES: DocRole[] = [
  {
    key: 'client-admin',
    label: 'Client Admin',
    icon: Shield,
    description:
      'You have full visibility and control over your entire organisation — all projects, programmes, users, compliance, and risk data.',
    topics: [
      {
        id: 'workspace',
        title: 'Set Up Your Workspace',
        description:
          'Configure your organisation name, branding, and default settings before onboarding your team.',
        steps: [
          'Go to Setup → Workspace Settings',
          'Enter your organisation name and contact details',
          'Set your default risk appetite and RAG thresholds',
          'Save — this applies across all projects in your account',
        ],
        tip: 'Do this first — it sets the foundation for all projects.',
        link: '/setup/workspace',
        linkLabel: 'Open Workspace Settings',
      },
      {
        id: 'users',
        title: 'Invite & Manage Users',
        description:
          'Add Project Managers, Senior PMs, and other team members. Assign roles to control what they can see.',
        steps: [
          'Go to Account → User & Role Management',
          'Click "Invite User" and enter their email address',
          'Select a role: Senior PM, Project Manager, Assistant PM, or Coordinator',
          'The user will receive a magic link to sign in — no password needed',
        ],
        tip: 'Roles are enforced everywhere — Project Managers only see their own projects.',
        link: '/team',
        linkLabel: 'Open Team Management',
      },
      {
        id: 'regulations',
        title: 'Configure the Regulation Library',
        description:
          'Add the specific statutes, regulations, and standards your organisation must comply with.',
        steps: [
          'Go to Setup → Regulation Library',
          'Browse or search for relevant legislation (e.g. Building Safety Act 2022)',
          'Add regulations to your library with interpretation notes',
          'Link regulations to specific projects via Compliance Setup',
        ],
        link: '/setup/regulations',
        linkLabel: 'Open Regulation Library',
      },
      {
        id: 'programmes',
        title: 'Create & Manage Programmes',
        description:
          'Group related projects into a programme for portfolio-level risk and compliance visibility.',
        steps: [
          'Go to Programme → Create a Programme',
          'Add a programme name, description, and lead officer',
          'Assign existing projects to the programme',
          'View aggregate risk and compliance status in Programme Reports',
        ],
        link: '/setup/programme',
        linkLabel: 'Create a Programme',
      },
      {
        id: 'monitoring',
        title: 'Monitor KRIs, Heatmaps & Alerts',
        description:
          'Track portfolio-wide key risk indicators and receive alerts when thresholds are breached.',
        steps: [
          'Go to Monitoring & Reporting → KRI Tracker',
          'Review current KRI scores against your defined thresholds',
          'Go to Trends & Heatmaps to see risk distribution across projects',
          'Configure alert thresholds in Alerts & Thresholds',
        ],
        tip: 'KRIs give you early warning — configure thresholds during workspace setup.',
        link: '/monitoring/kri',
        linkLabel: 'Open KRI Tracker',
      },
      {
        id: 'reports',
        title: 'Generate Executive & Programme Reports',
        description:
          'Produce board-ready PDF reports covering overall risk posture and compliance status.',
        steps: [
          'Go to Reports → Executive Reports',
          'Select report date range and programmes to include',
          'Click Generate — the report compiles automatically using live data',
          'Download PDF or share link with your board',
        ],
        link: '/reporting/executive',
        linkLabel: 'Open Executive Reports',
      },
      {
        id: 'api',
        title: 'Generate API Keys for Integrations',
        description:
          'Create API keys to allow your IT team to integrate CedarGuard with Northgate, SAP, or other systems.',
        steps: [
          'Go to Developer / API → API Keys',
          'Click "Generate New Key" and give it a descriptive name',
          'Copy the key immediately — it is only shown once',
          'Share with your IT team and refer to the API Documentation for endpoints',
        ],
        tip: "API keys are scoped to your organisation — they cannot access other tenants' data.",
        link: '/settings/developer',
        linkLabel: 'Open API Keys',
      },
    ],
  },
  {
    key: 'senior-pm',
    label: 'Senior PM',
    icon: TrendingUp,
    description:
      'You oversee multiple projects and can view aggregated risk and compliance across your portfolio. You can also support other PMs.',
    topics: [
      {
        id: 'dashboard',
        title: 'Understanding Your Dashboard',
        description:
          'Your dashboard shows an overview of all projects assigned to you — RAG status, open risks, and compliance alerts at a glance.',
        steps: [
          'Go to Dashboard after logging in',
          'Review the RAG (Red/Amber/Green) status for each project',
          'Click on any project card to drill into its detail',
          'Open My Tasks to see your outstanding actions',
        ],
        link: '/dashboard',
        linkLabel: 'Go to Dashboard',
      },
      {
        id: 'risk-register',
        title: 'Review the Risk Register',
        description:
          'View, add, and update risks for your project. Assign owners, set likelihood/impact scores, and log mitigations.',
        steps: [
          'Select your active project in the top header',
          'Go to Risk Management → Risk Register',
          'Review existing risks — red rows require immediate attention',
          'Click "Add Risk" to log a new risk with full RAID detail',
          'Assign a risk owner and a due date for each action',
        ],
        tip: 'Always assign a risk owner — unowned risks are flagged as critical.',
        link: '/risk/register',
        linkLabel: 'Open Risk Register',
      },
      {
        id: 'issues',
        title: 'Issues Log',
        description:
          'Track active issues that have already materialised (as opposed to risks, which are potential).',
        steps: [
          'Go to Risk Management → Issues Log',
          'Log new issues with impact description and resolution plan',
          'Update issue status as work progresses (Open → In Progress → Resolved)',
          'Resolved issues are archived but remain auditable',
        ],
        link: '/risk/issues',
        linkLabel: 'Open Issues Log',
      },
      {
        id: 'compliance-tracker',
        title: 'Compliance Tracker',
        description:
          'Check and update the compliance status for each regulatory requirement linked to your project.',
        steps: [
          'Select your project in the header',
          'Go to Compliance → Tracker',
          'Review items marked Amber or Red — these need action',
          'Update status and add evidence notes for completed items',
          'Upload supporting evidence via Compliance → Evidence & Documents',
        ],
        link: '/compliance/tracker',
        linkLabel: 'Open Compliance Tracker',
      },
    ],
  },
  {
    key: 'pm',
    label: 'Project Manager',
    icon: FolderKanban,
    description:
      'You manage one or more assigned projects end-to-end — from initial setup, through risk and compliance tracking, to reporting.',
    topics: [
      {
        id: 'create-project',
        title: 'Creating a New Project',
        description:
          'Set up a new project with all the key details — budget, units, funding streams, and cost centre codes.',
        steps: [
          'Go to My Projects → Create a Project',
          'Enter the project name, status, and description',
          'Fill in Cost Centre Code and select Funding Streams (Grant, RTB receipts, S106, etc.)',
          'Add unit details: number of units, storeys, unit types, and bedroom mix',
          'Click Save — your project is now live and ready for compliance and risk setup',
        ],
        tip: 'Fill in as much detail as possible — it feeds into all reports and AI analysis.',
        link: '/projects/new',
        linkLabel: 'Create a Project',
      },
      {
        id: 'compliance-setup',
        title: 'Setting Up Compliance for a Project',
        description:
          'Link relevant regulations from the Regulation Library to your project to begin tracking.',
        steps: [
          'Select your project and go to Compliance → Setup',
          'Choose the regulations that apply to your project from the library',
          'Set target compliance dates for each regulation',
          'The Compliance Tracker will now show these as active items to track',
        ],
        link: '/compliance/setup',
        linkLabel: 'Open Compliance Setup',
      },
      {
        id: 'risk-setup',
        title: 'Setting Up Risk for a Project',
        description: 'Configure risk categories, appetite, and scoring matrix for your project.',
        steps: [
          'Go to Risk Management → Setup',
          'Define risk categories relevant to your project (e.g. Financial, Environmental, Safety)',
          'Set the risk appetite level — this determines your RAG thresholds',
          'Click Save — you can now start logging risks in the Risk Register',
        ],
        link: '/risk/setup',
        linkLabel: 'Open Risk Setup',
      },
      {
        id: 'ai-risk',
        title: 'Using AI Risk Inquiry',
        description:
          'Let the AI engine analyse your project and automatically identify potential risks you may have missed.',
        steps: [
          'Go to Automated Intelligence → AI Risk Inquiry',
          'Review the AI-generated risk suggestions based on your project type',
          "Accept risks you agree with — they'll be added directly to your Risk Register",
          "Dismiss any that aren't applicable with a note",
        ],
        tip: 'Run this at the start of a project and after any major scope changes.',
        link: '/risk/ai',
        linkLabel: 'Open AI Risk Inquiry',
      },
      {
        id: 'evidence',
        title: 'Uploading Evidence & Documents',
        description:
          'Store supporting documents, certificates, and approvals against your compliance items.',
        steps: [
          'Go to Compliance → Evidence & Documents',
          'Click "Upload Document" and select your file',
          'Link the document to a specific compliance item or regulation',
          'Evidence is time-stamped and auditable — it cannot be deleted without a log entry',
        ],
        link: '/compliance/evidence',
        linkLabel: 'Open Evidence Vault',
      },
      {
        id: 'project-report',
        title: 'Generating a Project Report',
        description:
          'Produce a formatted project status report covering risks, compliance, and AI narrative summary.',
        steps: [
          'Go to Reports → Project Reports',
          'Select the project and report date',
          'Click Generate — the report includes risk RAG status, compliance overview, and AI summary',
          'Download as PDF to share with your client admin or board',
        ],
        link: '/reporting/project',
        linkLabel: 'Open Project Reports',
      },
    ],
  },
  {
    key: 'assistant-pm',
    label: 'Assistant PM',
    icon: Activity,
    description:
      'You support Project Managers with data entry, tracking, and document management on assigned projects.',
    topics: [
      {
        id: 'tasks',
        title: 'Managing Your Tasks',
        description:
          'Your My Tasks list shows all actions assigned to you across your projects — keep it up to date.',
        steps: [
          'Go to Dashboard → My Tasks',
          'Review tasks ordered by due date — overdue tasks are shown in red',
          'Click on a task to open the linked risk or compliance item',
          'Mark actions as complete when done — this updates the register automatically',
        ],
        link: '/my-tasks',
        linkLabel: 'Open My Tasks',
      },
      {
        id: 'update-risks',
        title: 'Updating Risk Register Entries',
        description: 'Keep risk data current by updating status, actions taken, and owner comments.',
        steps: [
          'Go to Risk Management → Risk Register',
          'Find the risk you need to update',
          'Click the pencil icon to edit — update the status, mitigation actions, and comments',
          'All changes are logged with your name and timestamp for audit purposes',
        ],
        tip: 'Never delete a risk — change its status to Closed instead to preserve the audit trail.',
        link: '/risk/register',
        linkLabel: 'Open Risk Register',
      },
      {
        id: 'upload-evidence',
        title: 'Uploading Evidence Documents',
        description: 'Upload certificates, approvals, and supporting documents to the Evidence Vault.',
        steps: [
          'Go to Compliance → Evidence & Documents',
          'Click Upload and select your file (PDF, Word, image)',
          'Add a description and link to the relevant compliance item',
          'Click Save — the document is stored securely and time-stamped',
        ],
        link: '/compliance/evidence',
        linkLabel: 'Open Evidence Vault',
      },
    ],
  },
  {
    key: 'coordinator',
    label: 'Coordinator',
    icon: ClipboardList,
    description:
      'You have read-only or limited access to project data — your role is to monitor status and support reporting.',
    topics: [
      {
        id: 'view-dashboard',
        title: 'Viewing the Dashboard',
        description: 'Your dashboard gives you a live overview of project status across your assigned projects.',
        steps: [
          'Log in and go to Dashboard',
          'Review the RAG status for each project — Green (on track), Amber (monitor), Red (critical)',
          'Click on a project card for a detailed view',
          'Check My Tasks for any actions specifically assigned to you',
        ],
        link: '/dashboard',
        linkLabel: 'Go to Dashboard',
      },
      {
        id: 'view-compliance',
        title: 'Viewing Compliance Status',
        description: 'Review the compliance tracker to see current status of all regulatory requirements.',
        steps: [
          'Go to Compliance → Tracker',
          'Items in Red are overdue or failed — flag these to your PM',
          'Items in Amber are upcoming — check their due dates',
          'Items in Green are compliant',
        ],
        link: '/compliance/tracker',
        linkLabel: 'Open Compliance Tracker',
      },
      {
        id: 'alerts',
        title: 'Reviewing Alerts',
        description: 'Compliance and risk alerts notify the team of urgent items that need attention.',
        steps: [
          'Go to Compliance → Alerts or Risk Management → Alerts',
          'Review open alerts — each shows the risk or compliance item that triggered it',
          'Forward alerts to the relevant Project Manager if they need action',
          'Alerts are automatically cleared when the underlying item is resolved',
        ],
        link: '/risk/alerts',
        linkLabel: 'Open Alerts',
      },
    ],
  },
];
