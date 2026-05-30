import React, { useState } from 'react';
import { Code, Terminal, Book, KeyRound, Server, Copy, Check, Users, ShieldAlert, LayoutDashboard, Database, Activity, Briefcase } from 'lucide-react';
import PageHeader from '../components/PageHeader';

export function APIDocs() {
  const [copiedSection, setCopiedSection] = useState<string | null>(null);

  const copyCode = (code: string, section: string) => {
    navigator.clipboard.writeText(code);
    setCopiedSection(section);
    setTimeout(() => setCopiedSection(null), 2000);
  };

  const CodeBlock = ({ code, language, section }: { code: string, language: string, section: string }) => (
    <div className="relative mt-4 mb-8 bg-white dark:bg-[#0f1117] rounded-lg overflow-hidden group border border-slate-200 dark:border-slate-800 shadow-2xl transition-colors duration-500">
      <div className="flex items-center justify-between px-4 py-3 bg-slate-50 dark:bg-[#1a1d27] border-b border-slate-200 dark:border-slate-800/80 transition-colors">
        <span className="text-[11px] font-mono font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">{language}</span>
        <button 
          onClick={() => copyCode(code, section)}
          className="text-slate-400 hover:text-white transition-colors p-1.5 bg-slate-800 hover:bg-slate-700 rounded-md"
          title="Copy code"
        >
          {copiedSection === section ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
        </button>
      </div>
      <pre className="p-5 text-sm font-mono text-slate-900 dark:text-slate-200 overflow-x-auto leading-relaxed bg-slate-50 dark:bg-[#0f1117]">
        <code className="text-slate-900 dark:text-slate-200">{code}</code>
      </pre>
    </div>
  );

  return (
    <div>

      <PageHeader
        title="Platform API Reference"
        subtitle="Integrate Cedar Risk data into your BI dashboards, ERP systems, or custom scripts. All endpoints enforce your organisation's RBAC."
        breadcrumbs={[{label:"Developer / API"},{label:"API Documentation"}]}
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
        {/* Navigation Sidebar */}
        <div className="lg:col-span-3 hidden lg:block">
          <nav className="sticky top-24 flex flex-col gap-1 pr-6 border-r border-slate-200 dark:border-white/10 transition-colors duration-500">
            <h3 className="text-[10px] font-mono font-medium text-slate-500 dark:text-slate-500 uppercase tracking-wide pl-2">Getting Started</h3>
            <a href="#authentication" className="text-sm font-semibold text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 py-2 px-3 rounded-lg hover:bg-slate-50 dark:hover:bg-white/5 transition-all">Authentication</a>
            <a href="#base-url" className="text-sm font-semibold text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 py-2 px-3 rounded-lg hover:bg-slate-50 dark:hover:bg-white/5 transition-all">Base Architecture</a>
            <a href="#rbac" className="text-sm font-semibold text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 py-2 px-3 rounded-lg hover:bg-slate-50 dark:hover:bg-white/5 transition-all">Role-Based Access</a>
            
            <h3 className="text-[10px] font-mono font-medium text-slate-500 dark:text-slate-500 uppercase tracking-wide mt-8 mb-3 pl-2">Client Admin API</h3>
            <a href="#client-projects" className="text-sm font-semibold text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 py-2 px-3 rounded-lg hover:bg-slate-50 dark:hover:bg-white/5 transition-all">Get Portfolio & RAG</a>
            <a href="#client-team" className="text-sm font-semibold text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 py-2 px-3 rounded-lg hover:bg-slate-50 dark:hover:bg-white/5 transition-all">Manage Teams & PMs</a>
            
            <h3 className="text-[10px] font-mono font-medium text-slate-500 dark:text-slate-500 uppercase tracking-wide mt-8 mb-3 pl-2">Project Manager API</h3>
            <a href="#pm-projects" className="text-sm font-semibold text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 py-2 px-3 rounded-lg hover:bg-slate-50 dark:hover:bg-white/5 transition-all">Assigned Projects</a>
            <a href="#pm-data" className="text-sm font-semibold text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 py-2 px-3 rounded-lg hover:bg-slate-50 dark:hover:bg-white/5 transition-all">Risks, Issues & Tasks</a>
            
            <h3 className="text-[10px] font-mono font-medium text-slate-500 dark:text-slate-500 uppercase tracking-wide mt-8 mb-3 pl-2">Super Admin API</h3>
            <a href="#admin-stats" className="text-sm font-semibold text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 py-2 px-3 rounded-lg hover:bg-slate-50 dark:hover:bg-white/5 transition-all">Global Statistics</a>
            
            <h3 className="text-[10px] font-mono font-medium text-slate-500 dark:text-slate-500 uppercase tracking-wide mt-8 mb-3 pl-2">Quickstarts</h3>

            <a href="#use-case-sync" className="text-sm font-semibold text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 py-2 px-3 rounded-lg hover:bg-slate-50 dark:hover:bg-white/5 transition-all">Use Case: BI Sync</a>
            <a href="#postman" className="text-sm font-semibold text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 py-2 px-3 rounded-lg hover:bg-slate-50 dark:hover:bg-white/5 transition-all">Postman Collection</a>
          </nav>
        </div>

        {/* Content */}
        <div className="lg:col-span-9 space-y-16">
          
          {/* Authentication Section */}
          <section id="authentication" className="scroll-mt-24">
            <div className="flex items-center gap-4 mb-6">
              <div className="p-3 bg-indigo-100 dark:bg-indigo-500/20 rounded-lg">
                <KeyRound className="w-8 h-8 text-indigo-600 dark:text-indigo-400" />
              </div>
              <h2 className="text-3xl font-semibold text-slate-900 dark:text-white tracking-tight">Authentication</h2>
            </div>
            <p className="text-lg text-slate-600 dark:text-slate-300 mb-6 leading-relaxed">
              All API endpoints require authentication using an API Key. You can generate an API key from the <strong>Developer Settings</strong> page inside the portal. 
              Your API key inherits the exact permissions of your user account.
            </p>
            <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 p-5 rounded-lg mb-6 text-amber-900 dark:text-amber-200 shadow-inner">
              <strong className="font-bold flex items-center gap-2 mb-1"><ShieldAlert className="w-5 h-5" /> Security Warning</strong> 
              Treat your API key like a password. Do not commit it to public repositories or expose it in client-side code. If compromised, revoke it immediately from the dashboard.
            </div>
            <p className="text-slate-600 dark:text-slate-400 font-medium mb-3">Provide the key in the HTTP <code className="bg-slate-100 dark:bg-white/10 px-2 py-1 rounded-md text-sm text-pink-600 dark:text-pink-400 font-mono mx-1">Authorization</code> header as a Bearer token:</p>
            <CodeBlock 
              section="auth"
              language="HTTP Header"
              code={"Authorization: Bearer cdR_XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"} 
            />
          </section>

          {/* Base URL Section */}
          <section id="base-url" className="scroll-mt-24">
            <div className="flex items-center gap-4 mb-6">
              <div className="p-3 bg-emerald-100 dark:bg-emerald-500/20 rounded-lg">
                <Server className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
              </div>
              <h2 className="text-3xl font-semibold text-slate-900 dark:text-white tracking-tight">Base Architecture (RPC)</h2>
            </div>
            <p className="text-lg text-slate-600 dark:text-slate-300 leading-relaxed mb-6">
              The API uses a single RPC-style endpoint. All requests are made as <code className="bg-slate-100 dark:bg-white/10 px-2 py-1 rounded-md text-sm font-mono text-pink-600 dark:text-pink-400 mx-1">POST</code> requests to the base URL, with the desired operation specified in the JSON body via the <code className="bg-slate-100 dark:bg-white/10 px-2 py-1 rounded-md text-sm font-mono text-pink-600 dark:text-pink-400 mx-1">action</code> property.
            </p>
            <div className="bg-slate-50 dark:bg-[#0f1117] border border-slate-200 dark:border-slate-800 p-6 rounded-lg flex items-center gap-4 font-mono text-base text-slate-800 dark:text-slate-200 shadow-sm">
              <span className="font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-500/10 px-3 py-1 rounded-md">POST</span>
              <span>https://[your-platform-domain]/api</span>
            </div>
          </section>

          {/* RBAC Section */}
          <section id="rbac" className="scroll-mt-24">
            <div className="flex items-center gap-4 mb-6">
              <div className="p-3 bg-purple-100 dark:bg-purple-500/20 rounded-lg">
                <Users className="w-8 h-8 text-purple-600 dark:text-purple-400" />
              </div>
              <h2 className="text-3xl font-semibold text-slate-900 dark:text-white tracking-tight">Role-Based Access Control</h2>
            </div>
            <p className="text-lg text-slate-600 dark:text-slate-300 leading-relaxed mb-6">
              Your API key is bound to your user role. Attempting to call an endpoint you lack permissions for will result in a <code className="font-mono text-red-500">403 Forbidden</code> error.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              <div className="bg-white dark:bg-[#13151a] p-6 rounded-lg border border-slate-200 dark:border-white/10 shadow-sm">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-blue-100 dark:bg-blue-500/20 rounded-lg"><Briefcase className="w-5 h-5 text-blue-600 dark:text-blue-400"/></div>
                  <h4 className="font-bold text-slate-900 dark:text-white">Client Admin</h4>
                </div>
                <p className="text-sm text-slate-600 dark:text-slate-400">Can view all programmes, all projects across the organization, invite PMs, and access aggregated reporting metrics.</p>
              </div>
              <div className="bg-white dark:bg-[#13151a] p-6 rounded-lg border border-slate-200 dark:border-white/10 shadow-sm">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-emerald-100 dark:bg-emerald-500/20 rounded-lg"><LayoutDashboard className="w-5 h-5 text-emerald-600 dark:text-emerald-400"/></div>
                  <h4 className="font-bold text-slate-900 dark:text-white">Project Manager</h4>
                </div>
                <p className="text-sm text-slate-600 dark:text-slate-400">Can only query and modify projects they are explicitly assigned to. Can read/write risks, issues, and compliance evidence.</p>
              </div>
              <div className="bg-white dark:bg-[#13151a] p-6 rounded-lg border border-slate-200 dark:border-white/10 shadow-sm">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-rose-100 dark:bg-rose-500/20 rounded-lg"><ShieldAlert className="w-5 h-5 text-rose-600 dark:text-rose-400"/></div>
                  <h4 className="font-bold text-slate-900 dark:text-white">Super Admin</h4>
                </div>
                <p className="text-sm text-slate-600 dark:text-slate-400">Can access global tenant statistics, pricing configurations, global mapping standards, and tenant-wide billing.</p>
              </div>
            </div>
          </section>

          <hr className="border-slate-200 dark:border-white/10" />

          {/* Client Admin API */}
          <section id="client-projects" className="scroll-mt-24">
            <h2 className="text-3xl font-semibold text-slate-900 dark:text-white mb-6 tracking-tight">Client Admin & Program Manager API</h2>
            <p className="text-lg text-slate-600 dark:text-slate-400 mb-8">Endpoints designed for organizational oversight and program-level management.</p>
            
            <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-4">Get Portfolio & RAG Status</h3>
            <p className="text-slate-600 dark:text-slate-400 mb-4">Retrieves all projects across the organization, including aggregated counts of open risks, compliance items, issues, and an automatically calculated RAG status (Red/Amber/Green) for BI dashboards.</p>
            
            <CodeBlock 
              section="curl-client-rag"
              language="cURL Request"
              code={`curl -X POST https://cedarguard.co.uk/api \\
  -H "Authorization: Bearer cdR_YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"action": "clientGetProjectData"}'`} 
            />

            <CodeBlock 
              section="resp-client-rag"
              language="JSON Response"
              code={`{
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
}`} 
            />

            <h3 id="client-team" className="text-xl font-bold text-slate-900 dark:text-white mb-4 mt-12 scroll-mt-24">Manage Teams</h3>
            <p className="text-slate-600 dark:text-slate-400 mb-4">Programmatically invite new Project Managers to your tenant workspace. They will receive an email invitation to set their password.</p>
            <CodeBlock 
              section="curl-invite-pm"
              language="cURL Request"
              code={`curl -X POST https://cedarguard.co.uk/api \\
  -H "Authorization: Bearer cdR_YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "action": "inviteProjectManager",
    "pmEmail": "john.doe@housingassoc.co.uk",
    "pmName": "John Doe",
    "pmRole": "Project Manager"
  }'`} 
            />
          </section>

          <hr className="border-slate-200 dark:border-white/10" />

          {/* Project Manager API */}
          <section id="pm-projects" className="scroll-mt-24">
            <h2 className="text-3xl font-semibold text-slate-900 dark:text-white mb-6 tracking-tight">Project Manager API</h2>
            <p className="text-lg text-slate-600 dark:text-slate-400 mb-8">Endpoints designed for project-level data ingestion, syncing risk registers, and updating compliance trackers.</p>
            
            <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-4">Read/Write Specific Project Data</h3>
            <p className="text-slate-600 dark:text-slate-400 mb-4">Generic endpoints to fetch and save specific collections (<code className="font-mono text-sm">risks</code>, <code className="font-mono text-sm">issues</code>, <code className="font-mono text-sm">complianceItems</code>) for a given Project ID.</p>
            
            <CodeBlock 
              section="curl-get-data"
              language="cURL Request (Get Risks)"
              code={`curl -X POST https://cedarguard.co.uk/api \\
  -H "Authorization: Bearer cdR_YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "action": "getData",
    "collection": "risks",
    "projectId": "project_id_123"
  }'`} 
            />

            <h3 id="pm-data" className="text-xl font-bold text-slate-900 dark:text-white mb-4 mt-12 scroll-mt-24">Create or Update Data (Upsert)</h3>
            <p className="text-slate-600 dark:text-slate-400 mb-4">If an item in the array has an existing <code className="font-mono text-sm">id</code>, it will be updated. If it lacks an <code className="font-mono text-sm">id</code>, a new record is created.</p>
            <CodeBlock 
              section="curl-save-data"
              language="cURL Request (Upsert Issue)"
              code={`curl -X POST https://cedarguard.co.uk/api \\
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
  }'`} 
            />
          </section>

          <hr className="border-slate-200 dark:border-white/10" />

          {/* Quickstarts */}
          <section id="use-case-sync" className="scroll-mt-24">
            <h2 className="text-3xl font-semibold text-slate-900 dark:text-white mb-6 tracking-tight">Use Case: Automated BI Sync</h2>
            <div className="bg-white dark:bg-[#13151a] p-8 rounded-lg border border-slate-200 dark:border-white/10 shadow-lg">
              <div className="flex items-start gap-6">
                <div className="p-4 bg-indigo-100 dark:bg-indigo-500/20 rounded-lg shrink-0">
                  <Database className="w-8 h-8 text-indigo-600 dark:text-indigo-400" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-3">Syncing Cedar Data to PowerBI / Tableau</h3>
                  <p className="text-slate-600 dark:text-slate-400 mb-6 leading-relaxed">
                    Most organizations want to pull their Cedar Risk metrics into a centralized corporate PowerBI dashboard. You can achieve this using a nightly CRON job or an Azure Logic App.
                  </p>
                  <ol className="list-decimal list-outside ml-5 space-y-4 text-slate-700 dark:text-slate-300">
                    <li className="pl-2">
                      <strong>Generate a Service Account Key</strong>: Log in as a Client Admin, go to Developer Settings, and generate a long-lived API key named "PowerBI Sync".
                    </li>
                    <li className="pl-2">
                      <strong>Fetch the Portfolio</strong>: Run a script that calls the <code className="bg-slate-100 dark:bg-white/10 px-1.5 py-0.5 rounded font-mono text-sm text-pink-600 dark:text-pink-400">clientGetProjectData</code> action to get the high-level RAG statuses and aggregate counts for all projects.
                    </li>
                    <li className="pl-2">
                      <strong>Fetch Details (Iterative)</strong>: If detail-level drill-downs are needed in PowerBI, loop through the returned <code className="font-mono text-sm">project.id</code>s and call <code className="bg-slate-100 dark:bg-white/10 px-1.5 py-0.5 rounded font-mono text-sm text-pink-600 dark:text-pink-400">getData</code> with <code className="font-mono text-sm">collection: "risks"</code> and <code className="font-mono text-sm">collection: "issues"</code>.
                    </li>
                    <li className="pl-2">
                      <strong>Store in Data Warehouse</strong>: Dump the resulting JSON into your Snowflake, BigQuery, or SQL Server staging tables, flattening the arrays for PowerBI ingestion.
                    </li>
                  </ol>
                </div>
              </div>
            </div>
          </section>

          <section id="postman" className="scroll-mt-24 bg-slate-100 dark:bg-slate-900 rounded-lg p-10 overflow-hidden relative border border-slate-200 dark:border-slate-800 shadow-2xl transition-colors duration-500">
            <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/20 rounded-full blur-[100px] -mr-20 -mt-20"></div>
            <div className="relative z-10">
              <h2 className="text-3xl font-semibold text-slate-900 dark:text-white mb-4 tracking-tight">Ready for Postman?</h2>
              <p className="text-slate-600 dark:text-slate-300 text-lg max-w-2xl mb-8 leading-relaxed">
                Test the API immediately without writing a single line of code. Copy the JSON snippet below to import a pre-configured Cedar API Collection directly into Postman.
              </p>
              
              <CodeBlock 
                section="postman-json"
                language="Postman Collection v2.1"
                code={`{
  "info": {
    "name": "Cedar Property Compliance & Risk API",
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
}`} 
              />
            </div>
          </section>

        </div>
      </div>
    </div>
  );
}
