import React, { useMemo } from 'react';
import { AlertCircle, Users, Building2 as Building, Briefcase, Layers, FolderKanban, Server, DollarSign, Download, Loader2 } from 'lucide-react';
import { RoleBadge } from './constants';
import { StatsCard } from '../common/StatsCard';
import { DEFAULT_PRICING, calculatePlatformCosts } from '../../features/admin/pages/InvoiceManager';
import { useStore } from '../../store/useStore';
import { isClientAdmin } from '../../lib/roles';

interface OverviewTabProps {
    statsError: string | null;
    allUsers: any[];
    loadingUsers: boolean;
    allProgrammes: any[];
    loadingProgrammes: boolean;
    allProjects: any[];
    loadingProjects: boolean;
    setDetailsModal: (modal: { isOpen: boolean, type: 'programmes' | 'projects' | null }) => void;
    setTab: (tab: string) => void;
}

export function OverviewTab({
    statsError,
    allUsers,
    loadingUsers,
    allProgrammes,
    loadingProgrammes,
    allProjects,
    loadingProjects,
    setDetailsModal,
    setTab
}: OverviewTabProps) {
    const clientInsights = useMemo(() => {
        const insights: Record<string, {
            domain: string;
            clientAdmins: number;
            pms: number;
            totalUsers: number;
            programmes: Set<string>;
            projects: number;
            costs?: any;
        }> = {};

        (Array.isArray(allUsers) ? allUsers : []).forEach(user => {
            if (!user.email) return;
            const domain = user.email.split('@')[1];
            if (!domain || ['gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com'].includes(domain.toLowerCase())) return;

            if (!insights[domain]) {
                insights[domain] = { domain, clientAdmins: 0, pms: 0, totalUsers: 0, programmes: new Set(), projects: 0 };
            }

            insights[domain].totalUsers++;
            if (isClientAdmin(user.role)) insights[domain].clientAdmins++;
            const pmRoles = ['project_manager', 'senior_pm', 'senior_project_manager', 'senior_project_manger', 'assistant_project_manager', 'project_coordinator', 'enterprise'];
            if (pmRoles.includes(user.role)) insights[domain].pms++;
        });

        (Array.isArray(allProjects) ? allProjects : []).forEach(project => {
            const ownerDomain = project.ownerEmail?.split('@')[1];
            if (ownerDomain && insights[ownerDomain]) {
                insights[ownerDomain].projects++;
            }
        });

        (Array.isArray(allProgrammes) ? allProgrammes : []).forEach(programme => {
            const clientAdmin = allUsers.find(u => u.uid === programme.clientId || u.uid === programme.userId);
            const domain = clientAdmin?.email?.split('@')[1];
            if (domain && insights[domain]) {
                insights[domain].programmes.add(programme.id);
            }
        });

        const pricingFromStore = (useStore.getState().pricingConfig || {}) as any;
        const pricing = {
            ...DEFAULT_PRICING,
            ...pricingFromStore,
            firestore: { ...DEFAULT_PRICING.firestore, ...(pricingFromStore.firestore || {}) },
            gemini: { ...DEFAULT_PRICING.gemini, ...(pricingFromStore.gemini || {}) },
            vercel: { ...DEFAULT_PRICING.vercel, ...(pricingFromStore.vercel || {}) },
            firebaseStorage: { ...DEFAULT_PRICING.firebaseStorage, ...(pricingFromStore.firebaseStorage || {}) },
        };

        Object.values(insights).forEach(ci => {
            const avgProgs = ci.clientAdmins > 0 ? ci.programmes.size / ci.clientAdmins : 0;
            const avgPrj = ci.programmes.size > 0 ? ci.projects / ci.programmes.size : 0;
            const avgUsers = ci.clientAdmins > 0 ? ci.pms / ci.clientAdmins : 0;
            ci.costs = calculatePlatformCosts(ci.clientAdmins, avgProgs, avgPrj, avgUsers, 'medium', pricing);
        });

        return Object.values(insights).sort((a, b) => b.projects - a.projects);
    }, [allUsers, allProjects, allProgrammes]);

    const handleExportCSV = () => {
        const headers = [
            'Organization', 
            'Client Admins', 
            'Project Managers', 
            'Total Users', 
            'Programmes', 
            'Projects', 
            'Infra Cost (GBP)', 
            'AI Cost (GBP)', 
            'Storage Cost (GBP)', 
            'Est. Total Monthly Cost'
        ];
        
        const rows = clientInsights.map(ci => [
            ci.domain,
            ci.clientAdmins,
            ci.pms,
            ci.totalUsers,
            ci.programmes.size,
            ci.projects,
            ci.costs?.firestoreGBP ? (ci.costs.firestoreGBP + ci.costs.vercelGBP).toFixed(2) : '0.00',
            ci.costs?.geminiGBP?.toFixed(2) || '0.00',
            ci.costs?.storageGBP?.toFixed(2) || '0.00',
            `£${ci.costs?.infraCostGBP?.toFixed(2) || '0.00'}`
        ]);

        const csvContent = [headers, ...rows].map(row => row.join(',')).join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `cedar_platform_insights_${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
    };

    return (
        <div className="space-y-6">
            {statsError && (
                <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-lg flex items-center gap-3">
                    <AlertCircle className="w-5 h-5 shrink-0" />{statsError}
                </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <StatsCard
                    icon={Users}
                    title="Total Users"
                    value={loadingUsers ? '…' : allUsers.length}
                    iconBgClassName="bg-blue-50 dark:bg-blue-500/10"
                    iconClassName="text-blue-600 dark:text-blue-400"
                />
                <StatsCard
                    icon={Building}
                    title="Client Admins (Orgs)"
                    value={loadingUsers ? '…' : (Array.isArray(allUsers) ? allUsers : []).filter(u => ['client_admin', 'enterprise'].includes(u.role)).length}
                    iconBgClassName="bg-indigo-50 dark:bg-indigo-500/10"
                    iconClassName="text-indigo-600 dark:text-indigo-400"
                />
                <StatsCard
                    icon={Briefcase}
                    title="Project Managers"
                    value={loadingUsers ? '…' : (Array.isArray(allUsers) ? allUsers : []).filter(u => ['project_manager', 'senior_project_manager', 'assistant_project_manager', 'project_coordinator'].includes(u.role)).length}
                    iconBgClassName="bg-emerald-50 dark:bg-emerald-500/10"
                    iconClassName="text-emerald-600 dark:text-emerald-400"
                />
                <StatsCard
                    icon={Layers}
                    title="Total Programmes"
                    value={loadingProgrammes ? '…' : allProgrammes.length}
                    iconBgClassName="bg-violet-50 dark:bg-violet-500/10"
                    iconClassName="text-violet-600 dark:text-violet-400"
                    onClick={() => setDetailsModal({ isOpen: true, type: 'programmes' })}
                />
                <StatsCard
                    icon={FolderKanban}
                    title="Total Projects"
                    value={loadingProjects ? '…' : (Array.isArray(allProjects) ? allProjects : []).length}
                    iconBgClassName="bg-amber-50 dark:bg-amber-500/10"
                    iconClassName="text-amber-600 dark:text-amber-400"
                    onClick={() => setDetailsModal({ isOpen: true, type: 'projects' })}
                />
                {(() => {
                    const clientAdmins = (Array.isArray(allUsers) ? allUsers : []).filter(u => ['client_admin', 'enterprise'].includes(u.role)).length;
                    const pmCount = (Array.isArray(allUsers) ? allUsers : []).filter(u => ['project_manager', 'senior_project_manager', 'assistant_project_manager', 'project_coordinator'].includes(u.role)).length;
                    const programmes = (Array.isArray(allProgrammes) ? allProgrammes : []).length;
                    const projects = (Array.isArray(allProjects) ? allProjects : []).length;

                    const avgProgs = clientAdmins > 0 ? programmes / clientAdmins : 0;
                    const avgPrj = programmes > 0 ? projects / programmes : 0;
                    const avgUsers = clientAdmins > 0 ? pmCount / clientAdmins : 0;

                    const pricingFromStore = (useStore.getState().pricingConfig || {}) as any;
                    const pricing = {
                        ...DEFAULT_PRICING,
                        ...pricingFromStore,
                        firestore: { ...DEFAULT_PRICING.firestore, ...(pricingFromStore.firestore || {}) },
                        gemini: { ...DEFAULT_PRICING.gemini, ...(pricingFromStore.gemini || {}) },
                        vercel: { ...DEFAULT_PRICING.vercel, ...(pricingFromStore.vercel || {}) },
                        firebaseStorage: { ...DEFAULT_PRICING.firebaseStorage, ...(pricingFromStore.firebaseStorage || {}) },
                    };
                    
                    const costs = calculatePlatformCosts(clientAdmins, avgProgs, avgPrj, avgUsers, 'medium', pricing);

                    return (
                        <>
                            <StatsCard
                                icon={Briefcase}
                                title="AI Cognitive Cost"
                                value={loadingUsers || loadingProjects || loadingProgrammes ? '…' : `£${costs.geminiGBP.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
                                iconBgClassName="bg-violet-50 dark:bg-violet-500/10"
                                iconClassName="text-violet-600 dark:text-violet-400"
                            />
                            <StatsCard
                                icon={Server}
                                title="Infra & Storage"
                                value={loadingUsers || loadingProjects || loadingProgrammes ? '…' : `£${(costs.firestoreGBP + costs.vercelGBP + costs.storageGBP).toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
                                iconBgClassName="bg-slate-100 dark:bg-slate-700"
                                iconClassName="text-slate-700 dark:text-slate-200"
                            />
                            <StatsCard
                                icon={DollarSign}
                                title="Est. Monthly Cost"
                                value={loadingUsers || loadingProjects || loadingProgrammes ? '…' : `£${costs.infraCostGBP.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
                                iconBgClassName="bg-rose-50 dark:bg-rose-500/10"
                                iconClassName="text-rose-600 dark:text-rose-400"
                            />
                        </>
                    );
                })()}
            </div>

            {/* Detailed Client Administration Breakdown */}
            <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                    <div>
                        <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                            <Building className="w-4 h-4 text-indigo-500" /> 
                            Client Administration Breakdown
                        </h3>
                        <p className="text-xs text-slate-400 mt-1">Granular insights grouped by registered organizations.</p>
                    </div>
                    <button 
                        onClick={handleExportCSV}
                        className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-indigo-600 border border-slate-200 rounded-lg hover:border-indigo-200 transition-colors"
                    >
                        <Download className="w-3.5 h-3.5" /> Export Insights
                    </button>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-slate-50 border-b border-slate-100">
                            <tr>
                                <th className="px-6 py-3 font-mono uppercase tracking-wide text-[11px] font-medium text-slate-500">Organization</th>
                                <th className="px-6 py-3 font-mono uppercase tracking-wide text-[11px] font-medium text-slate-500">Client Admins</th>
                                <th className="px-6 py-3 font-mono uppercase tracking-wide text-[11px] font-medium text-slate-500">PMs / Projs</th>
                                <th className="px-6 py-3 font-mono uppercase tracking-wide text-[11px] font-medium text-slate-500">AI Cost</th>
                                <th className="px-6 py-3 font-mono uppercase tracking-wide text-[11px] font-medium text-slate-500">Infra Cost</th>
                                <th className="px-6 py-3 font-mono uppercase tracking-wide text-[11px] font-medium text-slate-500 text-right">Est. Cost</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {(loadingUsers || loadingProjects) ? (
                                <tr><td colSpan={6} className="px-6 py-12 text-center text-slate-400 ">Processing data...</td></tr>
                            ) : clientInsights.map(ci => {
                                const costs = ci.costs || {};
                                const totalInfra = (costs.firestoreGBP || 0) + (costs.vercelGBP || 0) + (costs.storageGBP || 0);

                                return (
                                    <tr key={ci.domain} className="hover:bg-slate-50 transition-colors group">
                                        <td className="px-6 py-4">
                                            <div className="flex flex-col">
                                                <span className="font-semibold text-slate-800 lowercase">{ci.domain}</span>
                                                <span className="font-mono text-[10px] text-slate-400 font-medium uppercase tracking-wide tabular-nums">{ci.programmes.size} Programmes</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-1.5">
                                                <Users className="w-3.5 h-3.5 text-slate-400" />
                                                <span className="text-slate-600 font-medium tabular-nums">{ci.clientAdmins}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex flex-col text-xs space-y-0.5">
                                                <span className="text-slate-500 flex items-center gap-1"><Briefcase className="w-3 h-3" /> {ci.pms} PMs</span>
                                                <span className="text-slate-500 flex items-center gap-1"><FolderKanban className="w-3 h-3" /> {ci.projects} Projects</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-1 text-violet-600 font-semibold tabular-nums">
                                                <Briefcase className="w-3.5 h-3.5" />
                                                £{(costs.geminiGBP || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-1 text-slate-500 font-medium tabular-nums">
                                                <Server className="w-3.5 h-3.5 opacity-50" />
                                                £{totalInfra.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex flex-col items-end">
                                                <span className="font-medium text-indigo-600 text-base tabular-nums">
                                                    £{(costs.infraCostGBP || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                                </span>
                                                <span className="font-mono text-[10px] text-slate-400 font-medium uppercase tracking-wide">per month</span>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                            {clientInsights.length === 0 && !loadingUsers && (
                                <tr><td colSpan={6} className="px-6 py-8 text-center text-slate-400">No organizational data found yet.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Quick user summary */}
            <div className="bg-white rounded-lg border border-slate-200 p-6 shadow-sm">
                <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2"><Users className="w-4 h-4 text-indigo-500" /> Recent Users</h3>
                {loadingUsers ? <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-indigo-400" /></div> : (
                    <div className="divide-y divide-slate-100">
                        {allUsers.slice(0, 8).map(u => (
                            <div key={u.uid} className="flex items-center justify-between py-3">
                                <div>
                                    <p className="text-sm font-medium text-slate-800">{u.displayName || u.email || 'Unnamed'}</p>
                                    <p className="text-xs text-slate-400">{u.email}</p>
                                </div>
                                <RoleBadge role={u.role || 'user'} />
                            </div>
                        ))}
                        {allUsers.length === 0 && <p className="text-slate-400 text-sm py-6 text-center">No users yet.</p>}
                    </div>
                )}
                {allUsers.length > 8 && (
                    <button onClick={() => setTab('users')} className="mt-3 text-sm text-indigo-600 hover:underline">
                        View all {allUsers.length} users →
                    </button>
                )}
            </div>
        </div>
    );
}
