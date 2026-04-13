import { useState, useEffect } from 'react';
import { Settings2, Building2, Users, Bell, Save, Plus, Mail, Trash2, Loader2, CheckCircle2, Clock, User2, FolderKanban, Database, AlertTriangle, RefreshCcw, ScanSearch, ShieldCheck, Globe } from 'lucide-react';
import { api } from '../lib/api';
import { useStore } from '../store/useStore';
import { clsx } from 'clsx';

const inputCls = "w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all bg-white/80 backdrop-blur-sm placeholder:text-slate-400 shadow-sm hover:border-slate-300 transition-all";
const labelCls = "block text-[10px] font-black text-slate-500 uppercase tracking-[0.15em] mb-2 ml-1";

export function WorkspaceSettings() {
    const { user, resetAllData, addNotification } = useStore();
    const [activeTab, setActiveTab] = useState<'org' | 'team' | 'data'>('org');
    const [resetting, setResetting] = useState(false);

    // Org settings state
    const [orgName, setOrgName] = useState(user?.profile?.orgName || '');
    const [regNo, setRegNo] = useState(user?.profile?.regNo || '');
    const [address, setAddress] = useState(user?.profile?.address || '');
    const [jurisdiction, setJurisdiction] = useState(user?.profile?.jurisdiction || 'England & Wales');
    const [savingOrg, setSavingOrg] = useState(false);
    const [orgSaved, setOrgSaved] = useState(false);

    // Team management state
    const [pms, setPMs] = useState<any[]>([]);
    const [pending, setPending] = useState<any[]>([]);
    const [newPmEmail, setNewPmEmail] = useState('');
    const [newPmName, setNewPmName] = useState('');
    const [newPmRole, setNewPmRole] = useState<string>('project_manager');
    const [inviting, setInviting] = useState(false);
    const [inviteMsg, setInviteMsg] = useState('');
    const [loadingTeam, setLoadingTeam] = useState(false);

    const [pmProjects, setPmProjects] = useState<Record<string, number>>({});

    const formatRole = (role: string) => {
        if (!role) return 'Project Manager';
        return role.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
    };

    useEffect(() => {
        if (activeTab === 'team') {
            loadTeam();
        }
    }, [activeTab]);

    const loadTeam = async () => {
        setLoadingTeam(true);
        try {
            const [pmsRes, projectsRes] = await Promise.all([
                api.clientGetPMs().catch(() => null),
                api.clientGetProjects().catch(() => null),
            ]);
            if (pmsRes) {
                setPMs(Array.isArray(pmsRes.pms) ? pmsRes.pms : []);
                setPending(Array.isArray(pmsRes.pending) ? pmsRes.pending : []);
            }
            if (Array.isArray(projectsRes?.projects)) {
                const counts: Record<string, number> = {};
                (projectsRes.projects as any[]).forEach((p: any) => {
                    if (p.userId) counts[p.userId] = (counts[p.userId] || 0) + 1;
                });
                setPmProjects(counts);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoadingTeam(false);
        }
    };

    const handleSaveOrg = async () => {
        setSavingOrg(true);
        try {
            await api.saveProfile({ orgName, regNo, address, jurisdiction });
            setOrgSaved(true);
            setTimeout(() => setOrgSaved(false), 3000);
        } catch (err) {
            console.error(err);
        } finally {
            setSavingOrg(false);
        }
    };

    const handleInvitePM = async () => {
        if (!newPmEmail.includes('@')) { setInviteMsg('Please enter a valid email address.'); return; }
        setInviting(true);
        setInviteMsg('');
        try {
            await api.inviteProjectManager(newPmEmail, newPmName, newPmRole);
            setInviteMsg(`✅ Invitation sent to ${newPmEmail}.`);
            setNewPmEmail('');
            setNewPmName('');
            setNewPmRole('project_manager');
            loadTeam();
        } catch (err: any) {
            setInviteMsg(`❌ Error: ${err.message}`);
        } finally {
            setInviting(false);
        }
    };

    const tabs = [
        { key: 'org', label: 'Organisation', icon: Building2 },
        { key: 'team', label: 'Team', icon: Users },
        { key: 'data', label: 'Infrastructure', icon: Database },
    ];

    const handleResetData = async () => {
        if (!window.confirm("CRITICAL WARNING: This will permanently delete ALL data for this workspace. This action cannot be undone. Are you absolutely sure?")) {
            return;
        }

        const secondConfirm = window.prompt("Type 'RESET' to confirm platform wipe:");
        if (secondConfirm !== 'RESET') {
            addNotification({ title: 'Reset Cancelled', body: 'Workspace reset was not confirmed.', type: 'system' });
            return;
        }

        setResetting(true);
        try {
            await resetAllData();
            addNotification({ title: 'Workspace Reset', body: 'Platform has been successfully reset.', type: 'system' });
            setActiveTab('org');
        } catch (err) {
            console.error(err);
            addNotification({ title: 'Reset Failed', body: 'Failed to reset platform data. Please try again.', type: 'system' });
        } finally {
            setResetting(false);
        }
    };

    return (
        <div className="space-y-10 max-w-7xl mx-auto pb-24">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 px-2">
                <div>
                    <h1 className="text-3xl font-black text-slate-900 flex items-center gap-3 tracking-tight">
                        <div className="p-2.5 bg-slate-900 rounded-2xl shadow-lg shadow-slate-200">
                            <Settings2 className="w-7 h-7 text-white" />
                        </div>
                        Workspace Configuration
                    </h1>
                    <p className="text-sm text-slate-500 mt-3 font-medium max-w-lg leading-relaxed">
                        Manage your organisation profile, team access, and data infrastructure from one central dashboard.
                    </p>
                </div>

                <div className="flex gap-1 bg-white/40 backdrop-blur-xl p-1 rounded-2xl border border-white/40 shadow-xl shadow-slate-200/50 overflow-x-auto scrollbar-hide max-w-full">
                    {Array.isArray(tabs) && tabs.map(t => (
                        <button
                            key={t.key}
                            onClick={() => setActiveTab(t.key as 'org' | 'team' | 'data')}
                            className={clsx(
                                "flex items-center gap-2.5 px-6 py-3 rounded-xl text-xs font-black transition-all duration-500 select-none relative group",
                                activeTab === t.key
                                    ? 'bg-slate-900 shadow-2xl shadow-indigo-900/20 text-white scale-[1.02]'
                                    : 'text-slate-500 hover:text-slate-900 hover:bg-white/60'
                            )}
                        >
                            <t.icon className={clsx("w-4 h-4 transition-transform duration-500 group-hover:scale-110", activeTab === t.key ? "text-indigo-400" : "text-slate-400")} />
                            {t.label}
                        </button>
                    ))}
                </div>
            </div>

            <div className="px-2">
                {activeTab === 'org' && (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
                        <div className="lg:col-span-2 bg-white/60 backdrop-blur-xl rounded-[24px] sm:rounded-[40px] border border-white/40 shadow-2xl shadow-indigo-900/5 overflow-hidden transition-all hover:shadow-indigo-900/10 hover:bg-white/80">
                            <div className="px-5 sm:px-10 py-6 sm:py-8 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-white/40 to-transparent">
                                <h2 className="font-black text-slate-900 text-lg tracking-tight flex items-center gap-4">
                                    <div className="p-3 rounded-2xl bg-indigo-50/50 flex items-center justify-center border border-indigo-100 shadow-sm">
                                        <Building2 className="w-5 h-5 text-indigo-600" />
                                    </div>
                                    Organisation Identity
                                </h2>
                                {orgSaved && (
                                    <div className="flex items-center gap-1.5 text-emerald-600 text-xs font-black animate-in fade-in slide-in-from-right-4">
                                        <CheckCircle2 className="w-4 h-4" /> Changes Saved
                                    </div>
                                )}
                            </div>

                            <div className="p-5 sm:p-8 space-y-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div>
                                        <label className={labelCls}>Legal Entity Name</label>
                                        <input className={inputCls} value={orgName} onChange={e => setOrgName(e.target.value)} placeholder="e.g. Local Housing Authority" />
                                    </div>
                                    <div>
                                        <label className={labelCls}>Registration Number</label>
                                        <input className={inputCls} value={regNo} onChange={e => setRegNo(e.target.value)} placeholder="e.g. LA000123" />
                                    </div>
                                </div>
                                <div>
                                    <label className={labelCls}>Registered Head Office</label>
                                    <textarea className={`${inputCls} h-28 resize-none`} value={address} onChange={e => setAddress(e.target.value)} placeholder="Enter full postal address..." />
                                </div>
                                <div className="max-w-xs">
                                    <label className={labelCls}>Operational Jurisdiction</label>
                                    <select className={inputCls} value={jurisdiction} onChange={e => setJurisdiction(e.target.value)}>
                                        <option>England & Wales</option>
                                        <option>Scotland</option>
                                        <option>Northern Ireland</option>
                                    </select>
                                </div>

                                <div className="pt-4 flex justify-end">
                                    <button
                                        onClick={handleSaveOrg}
                                        disabled={savingOrg}
                                        className="flex items-center justify-center gap-3 w-full sm:w-auto px-8 py-4 bg-slate-900 text-white text-xs font-black rounded-2xl hover:bg-slate-800 transition-all hover:scale-[1.02] active:scale-95 shadow-xl shadow-slate-200 disabled:opacity-50"
                                    >
                                        {savingOrg ? <Loader2 className="w-4 h-4 animate-spin text-indigo-400" /> : <Save className="w-4 h-4" />}
                                        Commit Changes
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-6">
                            <div className="bg-indigo-600 rounded-[28px] sm:rounded-[32px] p-6 sm:p-8 text-white shadow-2xl shadow-indigo-200 relative overflow-hidden group">
                                <ScanSearch className="absolute -top-10 -right-10 w-40 h-40 text-white/10 rotate-12 transition-transform group-hover:scale-110" />
                                <h3 className="text-xl font-black mb-2 relative z-10 tracking-tight">Enterprise Tier</h3>
                                <p className="text-indigo-100 text-xs font-medium relative z-10 leading-relaxed max-w-[200px]">
                                    Your workspace is currently operating on the strategic compliance package.
                                </p>
                                <div className="mt-8 pt-6 border-t border-white/10 relative z-10">
                                    <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-indigo-200 mb-4">
                                        Features Included
                                    </div>
                                    <ul className="space-y-3">
                                        <li className="flex items-center gap-2 text-xs font-bold"><CheckCircle2 className="w-3.5 h-3.5 text-indigo-300" /> AI Risk Identification</li>
                                        <li className="flex items-center gap-2 text-xs font-bold"><CheckCircle2 className="w-3.5 h-3.5 text-indigo-300" /> Multi-User Team Access</li>
                                        <li className="flex items-center gap-2 text-xs font-bold"><CheckCircle2 className="w-3.5 h-3.5 text-indigo-300" /> Priority Support</li>
                                    </ul>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'team' && (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
                        <div className="lg:col-span-1 space-y-6">
                            <div className="bg-white/60 backdrop-blur-xl rounded-[24px] sm:rounded-[40px] border border-white/40 shadow-2xl shadow-indigo-900/5 p-5 sm:p-10 transition-all hover:bg-white/80">
                                <h2 className="font-black text-slate-900 text-lg tracking-tight mb-6 sm:mb-8 flex items-center gap-4">
                                    <div className="p-3 rounded-2xl bg-indigo-50/50 flex items-center justify-center border border-indigo-100 shadow-sm">
                                        <Plus className="w-5 h-5 text-indigo-600" />
                                    </div>
                                    Invite Team Member
                                </h2>

                                <div className="space-y-5">
                                    <div>
                                        <label className={labelCls}>Full Name</label>
                                        <input className={inputCls} value={newPmName} onChange={e => setNewPmName(e.target.value)} placeholder="e.g. Robert Wilson" />
                                    </div>
                                    <div>
                                        <label className={labelCls}>Email Address</label>
                                        <input className={inputCls} value={newPmEmail} onChange={e => setNewPmEmail(e.target.value)} placeholder="e.g. r.wilson@org.gov.uk" type="email" />
                                    </div>
                                    <div>
                                        <label className={labelCls}>Assigned Role</label>
                                        <select className={inputCls} value={newPmRole} onChange={e => setNewPmRole(e.target.value)}>
                                            <option value="senior_pm">Senior Project Manager</option>
                                            <option value="project_manager">Project Manager</option>
                                            <option value="assistant_pm">Assistant Project Manager</option>
                                            <option value="project_coordinator">Project Coordinator</option>
                                        </select>
                                    </div>

                                    <button
                                        onClick={handleInvitePM}
                                        disabled={inviting || !newPmEmail}
                                        className="w-full flex items-center justify-center gap-3 px-8 py-4 bg-slate-900 text-white text-xs font-black rounded-2xl hover:bg-slate-800 transition-all hover:scale-[1.02] active:scale-95 shadow-xl shadow-slate-200 disabled:opacity-50"
                                    >
                                        {inviting ? <Loader2 className="w-4 h-4 animate-spin text-indigo-400" /> : <Mail className="w-4 h-4" />}
                                        Execute Invitation
                                    </button>

                                    {inviteMsg && (
                                        <div className={clsx(
                                            "mt-4 p-4 rounded-xl text-[11px] font-bold border flex gap-3 items-center",
                                            inviteMsg.startsWith('✅') ? 'bg-emerald-50 border-emerald-100 text-emerald-700' : 'bg-red-50 border-red-100 text-red-700'
                                        )}>
                                            <div className={clsx("w-2 h-2 rounded-full shrink-0 animate-pulse", inviteMsg.startsWith('✅') ? 'bg-emerald-500' : 'bg-red-500')}></div>
                                            {inviteMsg}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="lg:col-span-2 bg-white/60 backdrop-blur-xl rounded-[24px] sm:rounded-[40px] border border-white/40 shadow-2xl shadow-indigo-900/5 overflow-hidden transition-all hover:bg-white/80">
                            <div className="px-5 sm:px-10 py-6 sm:py-8 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-white/40 to-transparent">
                                <h2 className="font-black text-slate-900 text-lg tracking-tight flex items-center gap-4">
                                    <div className="p-3 rounded-2xl bg-slate-900 flex items-center justify-center shadow-lg shadow-slate-200">
                                        <Users className="w-5 h-5 text-white" />
                                    </div>
                                    Active Team Personnel
                                </h2>
                                <div className="px-4 py-1.5 bg-slate-900/5 rounded-full text-[10px] font-black text-slate-600 uppercase tracking-[0.1em] border border-slate-200">
                                    {pms.length + pending.length} Members
                                </div>
                            </div>

                            {pms.length === 0 && pending.length === 0 ? (
                                <div className="p-20 text-center">
                                    <div className="w-16 h-16 bg-slate-50 rounded-3xl flex items-center justify-center mx-auto mb-4 border border-slate-100">
                                        <Users className="w-8 h-8 text-slate-300" />
                                    </div>
                                    <h3 className="text-slate-900 font-black tracking-tight mb-2">No active members</h3>
                                    <p className="text-sm text-slate-400 font-medium">Your team registry is currently empty.</p>
                                </div>
                            ) : (
                                <div className="divide-y divide-slate-50">
                                    {Array.isArray(pms) && pms.map(pm => (
                                        <div key={pm.uid} className="flex items-center gap-3 sm:gap-6 px-5 sm:px-10 py-4 sm:py-6 hover:bg-indigo-50/20 transition-all group cursor-default">
                                            <div className="relative shrink-0">
                                                <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-indigo-700 text-white flex items-center justify-center text-lg font-black shadow-xl shadow-indigo-100 ring-4 ring-white transition-transform duration-500 group-hover:scale-110">
                                                    {(pm.displayName || pm.email || '?')[0].toUpperCase()}
                                                </div>
                                                <div className="absolute -bottom-1 -right-1 w-4 h-4 sm:w-5 sm:h-5 bg-emerald-500 rounded-full border-4 border-white shadow-sm animate-pulse"></div>
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-3">
                                                    <p className="text-sm font-black text-slate-900 tracking-tight truncate" title={pm.displayName || pm.email}>{pm.displayName || pm.email}</p>
                                                    <span className="text-[10px] font-black text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-lg border border-indigo-100">
                                                        {formatRole(pm.role)}
                                                    </span>
                                                </div>
                                                <p className="text-xs text-slate-500 font-medium mt-0.5 truncate" title={pm.email}>{pm.email}</p>
                                            </div>
                                            <div className="hidden md:flex flex-col items-end gap-1">
                                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.1em]">Registered Since</p>
                                                <p className="text-xs font-bold text-slate-700">
                                                    {pm.createdAt ? new Date(pm.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Alpha Access'}
                                                </p>
                                            </div>
                                        </div>
                                    ))}
                                    {Array.isArray(pending) && pending.map(inv => (
                                        <div key={inv.email} className="flex items-center gap-3 sm:gap-6 px-4 sm:px-8 py-4 sm:py-5 bg-amber-50/20 border-l-4 border-amber-400 group">
                                            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center text-sm font-black ring-4 ring-white shrink-0">
                                                {(inv.name || inv.email || '?')[0].toUpperCase()}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-3">
                                                    <p className="text-sm font-black text-slate-900 tracking-tight truncate" title={inv.name || 'Awaiting Onboarding'}>{inv.name || 'Awaiting Onboarding'}</p>
                                                    <span className="text-[10px] font-black text-amber-600 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-100">
                                                        {formatRole(inv.role)}
                                                    </span>
                                                </div>
                                                <p className="text-xs text-slate-500 font-medium mt-0.5 truncate" title={inv.email}>{inv.email}</p>
                                            </div>
                                            <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-100 rounded-xl text-amber-700 text-[10px] font-black uppercase tracking-widest animate-pulse">
                                                <Clock className="w-3.5 h-3.5" /> Pending
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {activeTab === 'data' && (
                    <div className="space-y-8 max-w-4xl">
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                            {[
                                { label: 'Active Programmes', val: (Array.isArray(useStore.getState().programmes) ? useStore.getState().programmes : []).length, icon: FolderKanban, color: 'text-indigo-600', bg: 'bg-indigo-50/50', border: 'border-indigo-100' },
                                { label: 'Live Projects', val: (Array.isArray(useStore.getState().projects) ? useStore.getState().projects : []).length, icon: Building2, color: 'text-emerald-600', bg: 'bg-emerald-50/50', border: 'border-emerald-100' },
                                { label: 'Integrity Status', val: 'Healthy', icon: ShieldCheck, color: 'text-blue-600', bg: 'bg-blue-50/50', border: 'border-blue-100' }
                            ].map((stat, i) => (
                                <div key={i} className="bg-white/60 backdrop-blur-xl p-6 md:p-10 rounded-3xl md:rounded-[40px] border border-white/40 shadow-2xl shadow-slate-900/5 group hover:scale-[1.05] hover:bg-white/80 transition-all duration-500">
                                    <div className={clsx("w-14 h-14 flex items-center justify-center rounded-2xl mb-8 shadow-sm border transition-transform duration-500 group-hover:rotate-6", stat.bg, stat.border)}>
                                        <stat.icon className={clsx("w-7 h-7", stat.color)} />
                                    </div>
                                    <p className="text-[11px] font-black text-slate-400 uppercase tracking-[0.25em] mb-3">{stat.label}</p>
                                    <p className="text-4xl font-black text-slate-900 tracking-tight">{stat.val}</p>
                                </div>
                            ))}
                        </div>

                        <div className="group relative bg-rose-600 rounded-[24px] md:rounded-[40px] p-6 md:p-10 text-white shadow-2xl shadow-rose-200 overflow-hidden">
                            <div className="absolute inset-0 bg-gradient-to-br from-rose-500 via-rose-600 to-rose-700 opacity-0 group-hover:opacity-100 transition-opacity duration-700"></div>
                            <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-8">
                                <div className="space-y-4">
                                    <div className="inline-flex items-center gap-3 px-4 py-1.5 bg-white/10 rounded-full text-white text-[10px] font-black uppercase tracking-[0.2em] backdrop-blur-sm border border-white/20">
                                        <AlertTriangle className="w-3.5 h-3.5" />
                                        Critical Intervention
                                    </div>
                                    <h3 className="text-2xl sm:text-3xl font-black tracking-tight leading-none">Factory Reset Workspace</h3>
                                    <p className="text-rose-100 text-sm font-medium max-w-lg leading-relaxed opacity-90">
                                        Permanently decommission all projects, strategic programmes, and identified risks. This action wipes the database clean and is strictly irreversible.
                                    </p>
                                </div>
                                <button
                                    onClick={handleResetData}
                                    disabled={resetting}
                                    className="flex items-center justify-center gap-4 px-8 sm:px-10 py-4 sm:py-5 bg-white text-rose-600 text-sm font-black rounded-2xl hover:bg-rose-50 transition-all shadow-xl hover:scale-[1.05] active:scale-95 disabled:opacity-50 group-hover:shadow-rose-900/40"
                                >
                                    {resetting ? <RefreshCcw className="w-5 h-5 animate-spin" /> : <RefreshCcw className="w-5 h-5" />}
                                    Reset Workspace Data
                                </button>
                            </div>
                            <Database className="absolute -bottom-16 -right-16 w-64 h-64 text-white/5 opacity-10 -rotate-12 pointer-events-none group-hover:scale-110 group-hover:rotate-0 transition-transform duration-1000" />
                        </div>

                        <div className="bg-slate-900 rounded-[24px] md:rounded-[40px] p-6 md:p-10 text-white shadow-2xl shadow-slate-400/20 relative overflow-hidden">
                            <h4 className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.3em] mb-6 sm:mb-8 flex items-center gap-3">
                                <div className="w-6 h-6 rounded-lg bg-indigo-500/20 flex items-center justify-center">
                                    <Globe className="w-3.5 h-3.5" />
                                </div>
                                Cloud Infrastructure Topology
                            </h4>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-10">
                                {[
                                    { label: 'Primary Region', val: 'eu-west-2 (London)' },
                                    { label: 'Active Resilience', val: 'Multi-AZ Availability' },
                                    { label: 'Encryption Protocol', val: 'AES-256 / SHA-512' },
                                    { label: 'Compliance Mesh', val: 'GCP Shielded Nodes' }
                                ].map((item, i) => (
                                    <div key={i} className="space-y-2 border-l border-white/10 pl-5">
                                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{item.label}</p>
                                        <p className="text-xs font-bold text-slate-200">{item.val}</p>
                                    </div>
                                ))}
                            </div>
                            <div className="mt-12 pt-8 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between gap-4 opacity-40">
                                <p className="text-[10px] font-bold text-slate-500">Service Level Agreement: 99.99% Guaranteed</p>
                                <p className="text-[10px] font-bold text-slate-500 tracking-tighter">NODE_ID: CEDAR_PRD_UKW_01</p>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

