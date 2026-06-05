import React, { useState } from 'react';
import { HelpCircle, BookOpen, Users, Shield, LayoutDashboard, CheckSquare, AlertTriangle, FileWarning, Briefcase, ScanSearch, BarChart, ClipboardList, PieChart, Settings2, FolderKanban, KeyRound, Terminal, Search, ChevronDown, ChevronRight, CheckCircle2, ArrowRight, Lightbulb, Target, BellRing, ScrollText, FileText, Lock, TrendingUp, Layers, Building2, Plus, Activity } from 'lucide-react';
import { Link } from 'react-router';
import { useStore } from '../../../store/useStore';
import { isSuperAdmin, isAtLeastClientAdmin, isAtLeastPM } from '../../../lib/roles';
import { AIInquiryPopup } from '../../../components/AIInquiryPopup';
import PageHeader from '../../../components/PageHeader';

/* ────────────────────────────────────────────────────── */
/*  Types                                                 */
/* ────────────────────────────────────────────────────── */
interface HelpTopic {
  id: string;
  icon: React.FC<any>;
  title: string;
  description: string;
  steps?: string[];
  link?: string;
  linkLabel?: string;
  tip?: string;
}

interface RoleTab {
  id: string;
  label: string;
  icon: React.FC<any>;
  color: string;
  bg: string;
  border: string;
  description: string;
  topics: HelpTopic[];
}

/* ────────────────────────────────────────────────────── */
/*  Data                                                  */
/* ────────────────────────────────────────────────────── */
const roleTabs: RoleTab[] = [
  {
    id: 'client-admin',
    label: 'Client Admin',
    icon: Shield,
    color: 'text-indigo-600',
    bg: 'bg-indigo-50',
    border: 'border-indigo-200',
    description: 'You have full visibility and control over your entire organisation — all projects, programmes, users, compliance, and risk data.',
    topics: [
      {
        id: 'workspace',
        icon: Settings2,
        title: 'Set Up Your Workspace',
        description: 'Configure your organisation name, branding, and default settings before onboarding your team.',
        steps: [
          'Go to Setup → Workspace Settings',
          'Enter your organisation name and contact details',
          'Set your default risk appetite and RAG thresholds',
          'Save — this applies across all projects in your account',
        ],
        link: '/setup/workspace',
        linkLabel: 'Open Workspace Settings',
        tip: 'Do this first — it sets the foundation for all projects.',
      },
      {
        id: 'users',
        icon: Users,
        title: 'Invite & Manage Users',
        description: 'Add Project Managers, Senior PMs, and other team members. Assign roles to control what they can see.',
        steps: [
          'Go to Account → User & Role Management',
          'Click "Invite User" and enter their email address',
          'Select a role: Senior PM, Project Manager, Assistant PM, or Coordinator',
          'The user will receive a magic link to sign in — no password needed',
        ],
        link: '/team',
        linkLabel: 'Open Team Management',
        tip: 'Roles are enforced everywhere — Project Managers only see their own projects.',
      },
      {
        id: 'regulations',
        icon: BookOpen,
        title: 'Configure the Regulation Library',
        description: 'Add the specific statutes, regulations, and standards your organisation must comply with.',
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
        icon: Building2,
        title: 'Create & Manage Programmes',
        description: 'Group related projects into a programme for portfolio-level risk and compliance visibility.',
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
        icon: BarChart,
        title: 'Monitor KRIs, Heatmaps & Alerts',
        description: 'Track portfolio-wide key risk indicators and receive alerts when thresholds are breached.',
        steps: [
          'Go to Monitoring & Reporting → KRI Tracker',
          'Review current KRI scores against your defined thresholds',
          'Go to Trends & Heatmaps to see risk distribution across projects',
          'Configure alert thresholds in Alerts & Thresholds',
        ],
        link: '/monitoring/kri',
        linkLabel: 'Open KRI Tracker',
        tip: 'KRIs give you early warning — configure thresholds during workspace setup.',
      },
      {
        id: 'reports',
        icon: PieChart,
        title: 'Generate Executive & Programme Reports',
        description: 'Produce board-ready PDF reports covering overall risk posture and compliance status.',
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
        icon: KeyRound,
        title: 'Generate API Keys for Integrations',
        description: 'Create API keys to allow your IT team to integrate Cedar Guard with Northgate, SAP, or other systems.',
        steps: [
          'Go to Developer / API → API Keys',
          'Click "Generate New Key" and give it a descriptive name',
          'Copy the key immediately — it is only shown once',
          'Share with your IT team and refer to the API Documentation for endpoints',
        ],
        link: '/settings/developer',
        linkLabel: 'Open API Keys',
        tip: 'API keys are scoped to your organisation — they cannot access other tenants\' data.',
      },
    ],
  },
  {
    id: 'senior-pm',
    label: 'Senior PM',
    icon: TrendingUp,
    color: 'text-violet-600',
    bg: 'bg-violet-50',
    border: 'border-violet-200',
    description: 'You oversee multiple projects and can view aggregated risk and compliance across your portfolio. You can also support other PMs.',
    topics: [
      {
        id: 'dashboard',
        icon: LayoutDashboard,
        title: 'Understanding Your Dashboard',
        description: 'Your dashboard shows an overview of all projects assigned to you — RAG status, open risks, and compliance alerts at a glance.',
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
        icon: AlertTriangle,
        title: 'Review the Risk Register',
        description: 'View, add, and update risks for your project. Assign owners, set likelihood/impact scores, and log mitigations.',
        steps: [
          'Select your active project in the top header',
          'Go to Risk Management → Risk Register',
          'Review existing risks — red rows require immediate attention',
          'Click "Add Risk" to log a new risk with full RAID detail',
          'Assign a risk owner and a due date for each action',
        ],
        link: '/risk/register',
        linkLabel: 'Open Risk Register',
        tip: 'Always assign a risk owner — unowned risks are flagged as critical.',
      },
      {
        id: 'issues',
        icon: FileWarning,
        title: 'Issues Log',
        description: 'Track active issues that have already materialised (as opposed to risks, which are potential).',
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
        icon: CheckSquare,
        title: 'Compliance Tracker',
        description: 'Check and update the compliance status for each regulatory requirement linked to your project.',
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
    id: 'pm',
    label: 'Project Manager',
    icon: FolderKanban,
    color: 'text-cyan-600',
    bg: 'bg-cyan-50',
    border: 'border-cyan-200',
    description: 'You manage one or more assigned projects end-to-end — from initial setup, through risk and compliance tracking, to reporting.',
    topics: [
      {
        id: 'create-project',
        icon: Plus,
        title: 'Creating a New Project',
        description: 'Set up a new project with all the key details — budget, units, funding streams, and cost centre codes.',
        steps: [
          'Go to My Projects → Create a Project',
          'Enter the project name, status, and description',
          'Fill in Cost Centre Code and select Funding Streams (Grant, RTB receipts, S106, etc.)',
          'Add unit details: number of units, storeys, unit types, and bedroom mix',
          'Click Save — your project is now live and ready for compliance and risk setup',
        ],
        link: '/projects/new',
        linkLabel: 'Create a Project',
        tip: 'Fill in as much detail as possible — it feeds into all reports and AI analysis.',
      },
      {
        id: 'compliance-setup',
        icon: Briefcase,
        title: 'Setting Up Compliance for a Project',
        description: 'Link relevant regulations from the Regulation Library to your project to begin tracking.',
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
        icon: Target,
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
        icon: ScanSearch,
        title: 'Using AI Risk Inquiry',
        description: 'Let the AI engine analyse your project and automatically identify potential risks you may have missed.',
        steps: [
          'Go to Automated Intelligence → AI Risk Inquiry',
          'Review the AI-generated risk suggestions based on your project type',
          'Accept risks you agree with — they\'ll be added directly to your Risk Register',
          'Dismiss any that aren\'t applicable with a note',
        ],
        link: '/risk/ai',
        linkLabel: 'Open AI Risk Inquiry',
        tip: 'Run this at the start of a project and after any major scope changes.',
      },
      {
        id: 'evidence',
        icon: FileText,
        title: 'Uploading Evidence & Documents',
        description: 'Store supporting documents, certificates, and approvals against your compliance items.',
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
        icon: ClipboardList,
        title: 'Generating a Project Report',
        description: 'Produce a formatted project status report covering risks, compliance, and AI narrative summary.',
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
    id: 'assistant-pm',
    label: 'Assistant PM',
    icon: Activity,
    color: 'text-teal-600',
    bg: 'bg-teal-50',
    border: 'border-teal-200',
    description: 'You support Project Managers with data entry, tracking, and document management on assigned projects.',
    topics: [
      {
        id: 'tasks',
        icon: CheckSquare,
        title: 'Managing Your Tasks',
        description: 'Your My Tasks list shows all actions assigned to you across your projects — keep it up to date.',
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
        icon: AlertTriangle,
        title: 'Updating Risk Register Entries',
        description: 'Keep risk data current by updating status, actions taken, and owner comments.',
        steps: [
          'Go to Risk Management → Risk Register',
          'Find the risk you need to update',
          'Click the pencil icon to edit — update the status, mitigation actions, and comments',
          'All changes are logged with your name and timestamp for audit purposes',
        ],
        link: '/risk/register',
        linkLabel: 'Open Risk Register',
        tip: 'Never delete a risk — change its status to Closed instead to preserve the audit trail.',
      },
      {
        id: 'upload-evidence',
        icon: FileText,
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
    id: 'coordinator',
    label: 'Coordinator',
    icon: ClipboardList,
    color: 'text-amber-600',
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    description: 'You have read-only or limited access to project data — your role is to monitor status and support reporting.',
    topics: [
      {
        id: 'view-dashboard',
        icon: LayoutDashboard,
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
        icon: CheckSquare,
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
        icon: BellRing,
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

/* ────────────────────────────────────────────────────── */
/*  Accordion Topic Card                                  */
/* ────────────────────────────────────────────────────── */
const TopicCard: React.FC<{ topic: HelpTopic; accentColor: string }> = ({ topic, accentColor }) => {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-slate-200 rounded-lg overflow-hidden bg-white shadow-sm">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left hover:bg-slate-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg bg-slate-100`}>
            <topic.icon className={`w-4 h-4 ${accentColor}`} />
          </div>
          <div>
            <p className="text-slate-800 font-semibold text-sm">{topic.title}</p>
            <p className="text-slate-500 text-xs mt-0.5">{topic.description}</p>
          </div>
        </div>
        {open
          ? <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
          : <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />}
      </button>

      {open && (
        <div className="px-5 pb-5 border-t border-slate-100 pt-4 space-y-4">
          {topic.steps && (
            <ol className="space-y-2">
              {topic.steps.map((step, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span className={`mt-0.5 w-5 h-5 rounded-full bg-slate-100 text-slate-600 text-[11px] font-bold flex items-center justify-center shrink-0`}>
                    {i + 1}
                  </span>
                  <span className="text-slate-700 text-sm leading-relaxed">{step}</span>
                </li>
              ))}
            </ol>
          )}
          {topic.tip && (
            <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
              <Lightbulb className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
              <p className="text-amber-800 text-xs font-medium">{topic.tip}</p>
            </div>
          )}
          {topic.link && (
            <Link
              to={topic.link}
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-indigo-600 hover:text-indigo-700 transition-colors"
            >
              {topic.linkLabel || 'Go there now'} <ArrowRight className="w-4 h-4" />
            </Link>
          )}
        </div>
      )}
    </div>
  );
}

/* ────────────────────────────────────────────────────── */
/*  Main Page                                             */
/* ────────────────────────────────────────────────────── */
export function HelpCenter() {
  const { user } = useStore();
  const userRole = user?.role || user?.profile?.role;
  const isAdmin = isSuperAdmin(user?.email, userRole);
  const isClientAdmin = isAtLeastClientAdmin(userRole) || isAdmin;
  const isPM = isAtLeastPM(userRole);

  // Auto-select the most relevant tab for the logged-in role
  const defaultTab = isClientAdmin
    ? 'client-admin'
    : userRole === 'senior_pm' || userRole === 'senior-pm'
    ? 'senior-pm'
    : userRole === 'coordinator'
    ? 'coordinator'
    : userRole === 'assistant_pm' || userRole === 'assistant-pm'
    ? 'assistant-pm'
    : 'pm';

  const [activeTab, setActiveTab] = useState(defaultTab);
  const [search, setSearch] = useState('');

  const current = roleTabs.find(t => t.id === activeTab) ?? roleTabs[0];

  const filteredTopics = current.topics.filter(t =>
    !search ||
    t.title.toLowerCase().includes(search.toLowerCase()) ||
    t.description.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 mb-8">
        <PageHeader
          title="Help Centre"
          subtitle="Step-by-step guides for every role. Select your role below to get started."
          breadcrumbs={[{label:"Help"},{label:"Help Centre"}]}
        />
        {/* Search */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3 w-full md:w-auto">
          <div className="relative flex-1 md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search guides..."
              className="w-full pl-9 pr-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-lg text-sm text-slate-700 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-300 transition-all shadow-sm"
            />
          </div>
          <AIInquiryPopup 
            trigger={
              <button className="flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-lg transition-all shadow-md hover:shadow-indigo-200 group">
                <Briefcase className="w-4 h-4 group-hover:animate-pulse" />
                AI Regulatory Search
              </button>
            }
          />
        </div>
      </div>


      {/* Role Tabs */}
      <div className="flex flex-wrap gap-2">
        {roleTabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => { setActiveTab(tab.id); setSearch(''); }}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all border ${
              activeTab === tab.id
                ? `${tab.bg} ${tab.color} ${tab.border}`
                : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300 hover:bg-slate-50'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Role Description */}
      <div className={`px-5 py-4 rounded-lg border ${current.border} ${current.bg} flex items-start gap-3`}>
        <current.icon className={`w-5 h-5 mt-0.5 shrink-0 ${current.color}`} />
        <div>
          <p className={`font-bold text-sm ${current.color}`}>{current.label} Role</p>
          <p className="text-slate-600 text-sm mt-0.5">{current.description}</p>
        </div>
      </div>

      {/* Topics */}
      {filteredTopics.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <Search className="w-8 h-8 mx-auto mb-3 opacity-40" />
          <p className="text-sm">No guides found matching "<span className="font-semibold">{search}</span>"</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredTopics.map(topic => (
            <TopicCard key={topic.id} topic={topic} accentColor={current.color} />
          ))}
        </div>
      )}

      {/* Footer help block */}
      <div className="mt-8 p-6 rounded-lg bg-gradient-to-br from-indigo-50 to-slate-50 border border-indigo-100 flex items-start gap-4">
        <div className="p-3 bg-indigo-100 rounded-lg shrink-0">
          <BookOpen className="w-5 h-5 text-indigo-600" />
        </div>
        <div>
          <p className="font-bold text-slate-800 mb-1">Still need help?</p>
          <p className="text-slate-500 text-sm mb-3">Contact your Client Admin for workspace-specific questions, or reach out to the Cedar Guard support team.</p>
          <div className="flex flex-wrap gap-3">
            <AIInquiryPopup 
              trigger={
                <button className="inline-flex items-center gap-1.5 text-sm font-semibold text-indigo-600 hover:text-indigo-700">
                  <Briefcase className="w-4 h-4" /> Ask AI Regulatory Guide
                </button>
              }
            />
            <span className="text-slate-300">|</span>
            <Link
              to="/api-docs"
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-indigo-600 hover:text-indigo-700"
            >
              <Terminal className="w-4 h-4" /> API Documentation
            </Link>
            <span className="text-slate-300">|</span>
            <a
              href="mailto:support@cedarguard.co.uk"
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-indigo-600 hover:text-indigo-700"
            >
              support@cedarguard.co.uk
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
