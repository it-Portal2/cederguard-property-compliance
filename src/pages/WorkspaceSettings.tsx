import { useState, useEffect, useMemo } from 'react';
import {
    Settings2,
    Building2,
    Users,
    Save,
    Plus,
    Mail,
    Loader2,
    CheckCircle2,
    FolderKanban,
    Database,
    AlertTriangle,
    RefreshCcw,
    ScanSearch,
    ShieldCheck,
    Globe,
    UserCog,
    UserMinus,
    Pencil,
    PoundSterling,
    Image as ImageIcon,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '../lib/api';
import { useStore } from '../store/useStore';
import { clsx } from 'clsx';
import DynamicTable from '../components/table/DynamicTable';
import type { ColumnDef, RowAction, FilterDef } from '../components/table/types';
import TableTooltip from '../components/table/TableTooltip';
import { PM_LEVELS } from '../lib/roleConstants';
import type { PmLevel } from '../lib/roleConstants';
import { canonicalRole, pmLevelLabel } from '../lib/roles';
import type { CanonicalRole } from '../lib/roles';
import { StatsCard } from '../components/common/StatsCard';
import ConfirmDialog from '../components/table/ConfirmDialog';
import { BrandingTab } from '../components/governance/branding/BrandingTab';
import { TacCostRatesTab } from '../components/technicalAssurance/TacCostRatesTab';
import PageHeader from '../components/PageHeader';

const inputCls = "w-full border border-slate-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all bg-white/80 backdrop-blur-sm placeholder:text-slate-400 shadow-sm hover:border-slate-300";
const labelCls = "block text-[10px] font-semibold text-slate-500 uppercase tracking-[0.15em] mb-2 ml-1";

interface TeamMember {
    uid: string;
    email: string;
    displayName?: string;
    role?: string;
    pmLevel?: PmLevel | null;
    supervisorUid?: string | null;
    createdAt?: string;
    clientId?: string;
    status: 'active' | 'pending';
    inviteEmail?: string;
    inviteId?: string;
    inviteProgrammeIds?: string[];
}

const CANONICAL_ROLE_BADGE: Record<CanonicalRole, { label: string; cls: string }> = {
    super_admin: { label: 'Super Admin', cls: 'bg-violet-50 text-violet-700 border-violet-100' },
    client_admin: { label: 'Client Admin', cls: 'bg-indigo-50 text-indigo-700 border-indigo-100' },
    project_manager: { label: 'Project Manager', cls: 'bg-emerald-50 text-emerald-700 border-emerald-100' },
    strategic_director: { label: 'Strategic Director', cls: 'bg-amber-50 text-amber-700 border-amber-100' },
    viewer: { label: 'Viewer', cls: 'bg-slate-50 text-slate-700 border-slate-200' },
    enterprise: { label: 'Enterprise', cls: 'bg-sky-50 text-sky-700 border-sky-100' },
};

const PM_LEVEL_OPTIONS: { value: PmLevel; label: string }[] = PM_LEVELS.map(v => ({
    value: v,
    label: pmLevelLabel(v),
}));

const CANONICAL_ROLE_PROMOTE_OPTIONS: { value: CanonicalRole; label: string }[] = [
    { value: 'project_manager', label: 'Project Manager' },
    { value: 'client_admin', label: 'Client Admin' },
];

export function WorkspaceSettings() {
    const { user, resetAllData, addNotification, programmes, fetchProgrammes } = useStore();
    const [activeTab, setActiveTab] = useState<'org' | 'branding' | 'team' | 'tacRates' | 'data'>('org');
    const [resetting, setResetting] = useState(false);
    const [resetStep, setResetStep] = useState<'idle' | 'confirm1' | 'confirm2'>('idle');

    // Org settings state — user fields are flattened at the root of `user`
    // (see useStore.initStore: `set({ user: { ...firestoreProfile, ... } })`).
    const [orgName, setOrgName] = useState((user as any)?.orgName || '');
    const [regNo, setRegNo] = useState((user as any)?.regNo || '');
    const [address, setAddress] = useState((user as any)?.address || '');
    const [jurisdiction, setJurisdiction] = useState((user as any)?.jurisdiction || 'England & Wales');
    const [savingOrg, setSavingOrg] = useState(false);
    const [orgSaved, setOrgSaved] = useState(false);

    // Team management state
    const [pms, setPMs] = useState<any[]>([]);
    const [pending, setPending] = useState<any[]>([]);
    const [inviteOpen, setInviteOpen] = useState(false);
    const [inviteEditTarget, setInviteEditTarget] = useState<TeamMember | null>(null);
    const [loadingTeam, setLoadingTeam] = useState(false);

    // Row-action modal state
    const [editingMember, setEditingMember] = useState<TeamMember | null>(null);
    const [changingRoleFor, setChangingRoleFor] = useState<TeamMember | null>(null);

    // Programmes available for binding/rostering. Backend already scopes the
    // `programmes` store to the caller's org via clientId; no further frontend
    // filter is needed (and the backend re-validates ownership on every
    // invite / addPMToProgramme call).
    const ownedProgrammes = useMemo(
        () => (Array.isArray(programmes) ? programmes : []),
        [programmes],
    );

    const callerCanonical = canonicalRole(user?.role);
    const canChangeRole = callerCanonical === 'super_admin' || callerCanonical === 'client_admin';

    useEffect(() => {
        fetchProgrammes();
    }, []);

    // Rehydrate org form fields when the user object resolves/changes.
    // Without this, opening the page before `initStore` finishes leaves the
    // inputs empty even though the profile has data.
    useEffect(() => {
        if (!user) return;
        const u = user as any;
        if (u.orgName !== undefined) setOrgName(u.orgName || '');
        if (u.regNo !== undefined) setRegNo(u.regNo || '');
        if (u.address !== undefined) setAddress(u.address || '');
        if (u.jurisdiction !== undefined) setJurisdiction(u.jurisdiction || 'England & Wales');
    }, [user]);

    useEffect(() => {
        if (activeTab === 'team') {
            loadTeam();
        }
    }, [activeTab]);

    const loadTeam = async () => {
        setLoadingTeam(true);
        try {
            const pmsRes = await api.clientGetPMs().catch(() => null);
            if (pmsRes) {
                setPMs(Array.isArray(pmsRes.pms) ? pmsRes.pms : []);
                setPending(Array.isArray(pmsRes.pending) ? pmsRes.pending : []);
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
            // Reflect saved values into the store so in-memory reads stay fresh
            // without requiring a full page refresh / initStore re-run.
            useStore.setState((s: any) => ({
                user: { ...(s.user || {}), orgName, regNo, address, jurisdiction },
            }));
            setOrgSaved(true);
            toast.success('Organisation details saved.');
            setTimeout(() => setOrgSaved(false), 3000);
        } catch (err: any) {
            toast.error(err?.message || 'Failed to save organisation details.');
            console.error(err);
        } finally {
            setSavingOrg(false);
        }
    };

    const tabs = [
        { key: 'org', label: 'Organisation', icon: Building2 },
        { key: 'branding', label: 'Branding', icon: ImageIcon },
        { key: 'team', label: 'Team', icon: Users },
        { key: 'tacRates', label: 'Cost rates', icon: PoundSterling },
        { key: 'data', label: 'Infrastructure', icon: Database },
    ];

    const handleResetConfirmed = async () => {
        setResetting(true);
        try {
            await resetAllData();
            setResetStep('idle');
            addNotification({ title: 'Workspace Reset', body: 'Platform has been successfully reset.', type: 'system' });
            setActiveTab('org');
        } catch (err) {
            console.error(err);
            setResetStep('idle');
            addNotification({ title: 'Reset Failed', body: 'Failed to reset platform data. Please try again.', type: 'system' });
        } finally {
            setResetting(false);
        }
    };

    // ── Team table data pipeline ─────────────────────────────────────────────
    const teamRows: TeamMember[] = useMemo(() => {
        const activeRows: TeamMember[] = (Array.isArray(pms) ? pms : []).map((pm: any) => ({
            uid: pm.uid,
            email: pm.email,
            displayName: pm.displayName,
            role: pm.role,
            pmLevel: pm.pmLevel ?? null,
            supervisorUid: pm.supervisorUid ?? null,
            createdAt: pm.createdAt,
            clientId: pm.clientId,
            status: 'active' as const,
        }));
        const pendingRows: TeamMember[] = (Array.isArray(pending) ? pending : []).map((inv: any, idx: number) => ({
            uid: `pending:${inv.email || idx}`,
            email: inv.email,
            displayName: inv.name,
            role: 'project_manager',
            pmLevel: inv.pmLevel ?? 'standard',
            createdAt: inv.createdAt,
            status: 'pending' as const,
            inviteEmail: inv.email,
            inviteId: inv.id,
            inviteProgrammeIds: Array.isArray(inv.programmeIds) ? inv.programmeIds : [],
        }));
        return [...activeRows, ...pendingRows];
    }, [pms, pending]);

    const programmesByMember = useMemo(() => {
        const map: Record<string, any[]> = {};
        (Array.isArray(programmes) ? programmes : []).forEach((p: any) => {
            const ids: string[] = Array.isArray(p.assignedPMIds) ? p.assignedPMIds : [];
            ids.forEach(uid => {
                if (!map[uid]) map[uid] = [];
                map[uid].push(p);
            });
        });
        return map;
    }, [programmes]);

    const columns: ColumnDef<TeamMember>[] = [
        {
            key: 'displayName',
            label: 'Member',
            sortable: true,
            render: (_v, row) => (
                <div className="flex items-center gap-3 min-w-0">
                    <div className={clsx(
                        'w-9 h-9 rounded-lg flex items-center justify-center text-xs font-semibold ring-2 ring-white shrink-0',
                        row.status === 'pending'
                            ? 'bg-amber-100 text-amber-700'
                            : 'bg-gradient-to-br from-indigo-500 to-indigo-700 text-white',
                    )}>
                        {(row.displayName || row.email || '?')[0].toUpperCase()}
                    </div>
                    <div className="min-w-0">
                        <p className="text-xs font-semibold text-slate-900 truncate" title={row.displayName || row.email}>
                            {row.displayName || row.email || 'Awaiting Onboarding'}
                        </p>
                        <p className="text-[11px] text-slate-500 truncate" title={row.email}>{row.email}</p>
                    </div>
                </div>
            ),
            exportValue: (_v, row) => row.displayName || row.email || '',
        },
        {
            key: 'role',
            label: 'Role',
            sortable: true,
            render: (_v, row) => {
                const c = canonicalRole(row.role);
                const cfg = CANONICAL_ROLE_BADGE[c];
                return (
                    <span className={clsx('inline-flex px-2 py-0.5 rounded-md text-[10px] font-bold border', cfg.cls)}>
                        {cfg.label}
                    </span>
                );
            },
            exportValue: (_v, row) => CANONICAL_ROLE_BADGE[canonicalRole(row.role)].label,
        },
        {
            key: 'pmLevel',
            label: 'PM Level',
            sortable: true,
            render: (_v, row) => {
                if (canonicalRole(row.role) !== 'project_manager') {
                    return <span className="text-slate-300 text-[11px]">—</span>;
                }
                return <span className="text-[11px] text-slate-700">{pmLevelLabel(row.pmLevel)}</span>;
            },
            exportValue: (_v, row) =>
                canonicalRole(row.role) === 'project_manager' ? pmLevelLabel(row.pmLevel) : '',
        },
        {
            key: 'programmes',
            label: 'Programmes',
            render: (_v, row) => {
                const allProgrammes = Array.isArray(programmes) ? programmes : [];
                const memberProgrammes = row.status === 'pending'
                    ? (row.inviteProgrammeIds || [])
                        .map(id => allProgrammes.find((p: any) => p.id === id))
                        .filter(Boolean)
                    : programmesByMember[row.uid] || [];
                if (memberProgrammes.length === 0) {
                    return <span className="text-slate-300 text-[11px]">None</span>;
                }
                const visible = memberProgrammes.slice(0, 2);
                const overflow = memberProgrammes.slice(2);
                return (
                    <div className="flex items-center gap-1 flex-wrap">
                        {visible.map((p: any) => (
                            <span key={p.id} className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold bg-slate-100 text-slate-700 border border-slate-200 max-w-[140px] truncate">
                                {p.name || p.reference}
                            </span>
                        ))}
                        {overflow.length > 0 && (
                            <TableTooltip content={
                                <div className="flex flex-col gap-1">
                                    {overflow.map((p: any) => <span key={p.id}>{p.name || p.reference}</span>)}
                                </div>
                            }>
                                <span tabIndex={0} className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold bg-slate-200 text-slate-800 border border-slate-300 cursor-default">
                                    +{overflow.length}
                                </span>
                            </TableTooltip>
                        )}
                    </div>
                );
            },
            exportValue: (_v, row) => {
                const allProgrammes = Array.isArray(programmes) ? programmes : [];
                const list = row.status === 'pending'
                    ? (row.inviteProgrammeIds || [])
                        .map(id => allProgrammes.find((p: any) => p.id === id))
                        .filter(Boolean)
                    : programmesByMember[row.uid] || [];
                return list.map((p: any) => p.name || p.reference).join('; ');
            },
        },
        {
            key: 'status',
            label: 'Status',
            sortable: true,
            render: (_v, row) => (
                <span className={clsx(
                    'inline-flex px-2 py-0.5 rounded-md text-[10px] font-bold border',
                    row.status === 'active'
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                        : 'bg-amber-50 text-amber-700 border-amber-100',
                )}>
                    {row.status === 'active' ? 'Active' : 'Pending'}
                </span>
            ),
            exportValue: (_v, row) => (row.status === 'active' ? 'Active' : 'Pending'),
        },
        {
            key: 'createdAt',
            label: 'Joined',
            sortable: true,
            render: (_v, row) => (
                <span className="text-[11px] text-slate-600">
                    {row.status === 'pending'
                        ? (row.createdAt
                            ? <span className="text-amber-600">Invited {new Date(row.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                            : '—')
                        : (row.createdAt
                            ? new Date(row.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
                            : '—')}
                </span>
            ),
            exportValue: (_v, row) =>
                row.createdAt ? new Date(row.createdAt).toLocaleDateString('en-GB') : '',
        },
    ];

    const filterDefs: FilterDef<TeamMember>[] = [
        {
            key: 'role',
            label: 'Role',
            type: 'select',
            options: [
                { value: 'super_admin', label: 'Super Admin' },
                { value: 'client_admin', label: 'Client Admin' },
                { value: 'project_manager', label: 'Project Manager' },
                { value: 'viewer', label: 'Viewer' },
            ],
            match: (rowValue, filterValue) => canonicalRole(rowValue) === filterValue,
        },
        {
            key: 'pmLevel',
            label: 'PM Level',
            type: 'select',
            options: PM_LEVEL_OPTIONS.map(o => ({ value: o.value, label: o.label })),
        },
        {
            key: 'status',
            label: 'Status',
            type: 'select',
            options: [
                { value: 'active', label: 'Active' },
                { value: 'pending', label: 'Pending' },
            ],
        },
    ];

    const rowActions: RowAction<TeamMember>[] = [
        {
            key: 'edit',
            label: 'Edit member',
            icon: Pencil,
            isVisible: (r) => r.status === 'active',
            onClick: (r) => setEditingMember(r),
        },
        {
            key: 'change-role',
            label: 'Change role',
            icon: UserCog,
            isVisible: (r) => canChangeRole && r.status === 'active' && r.uid !== user?.uid,
            isDisabled: (r) =>
                callerCanonical === 'client_admin' && canonicalRole(r.role) === 'super_admin',
            onClick: (r) => setChangingRoleFor(r),
        },
        {
            key: 'edit-invite',
            label: 'Edit invite',
            icon: Pencil,
            isVisible: (r) => r.status === 'pending',
            onClick: (r) => { setInviteEditTarget(r); setInviteOpen(true); },
        },
        {
            key: 'cancel-invite',
            label: 'Cancel invite',
            icon: UserMinus,
            isDanger: true,
            isVisible: (r) => r.status === 'pending',
            requireConfirm: {
                icon: UserMinus,
                variant: 'danger' as const,
                title: 'Cancel invitation',
                message: (r: TeamMember) =>
                    `Cancel the invitation sent to ${r.email}? They will no longer be able to use this invite link.`,
                confirmLabel: 'Cancel invite',
                isDanger: true,
            },
            onClick: async (r) => {
                try {
                    await api.cancelInvite(r.inviteId!);
                    toast.success('Invitation cancelled.');
                    loadTeam();
                } catch (err: any) {
                    toast.error(err?.message || 'Failed to cancel invitation.');
                    throw err;
                }
            },
        },
        {
            key: 'remove',
            label: 'Remove from team',
            icon: UserMinus,
            isDanger: true,
            isVisible: (r) => r.status === 'active' && r.uid !== user?.uid && canonicalRole(r.role) !== 'super_admin',
            requireConfirm: {
                icon: UserMinus,
                variant: 'danger' as const,
                title: 'Remove from team',
                message: (r: TeamMember) =>
                    `Remove ${r.displayName || r.email} from your team? They will lose access to this workspace.`,
                confirmLabel: 'Remove',
                isDanger: true,
            },
            onClick: async (r) => {
                try {
                    await api.clientRemoveUser(r.uid);
                    toast.success('Team member removed.');
                    loadTeam();
                } catch (err: any) {
                    toast.error(err?.message || 'Failed to remove member.');
                    throw err;
                }
            },
        },
    ];

    const activeTabMeta = tabs.find(t => t.key === activeTab);

    return (
        <div className="space-y-6 sm:space-y-8">
            <PageHeader
                title="Workspace Settings"
                subtitle="Manage your organisation profile, branding, team access, and data infrastructure from one central dashboard."
                breadcrumbs={[{label:"Account"},{label:"Workspace"}]}
            />

            {/* Segmented control — Linear / Vercel / Notion pattern with raised active pill */}
            <div className="w-full overflow-x-auto scrollbar-hide">
                <nav
                    className="flex w-max items-center gap-1 p-1 bg-slate-100/90 border border-slate-200/80 rounded-lg shadow-[inset_0_1px_2px_rgba(15,23,42,0.04)]"
                    aria-label="Workspace sections"
                    role="tablist"
                >
                    {Array.isArray(tabs) && tabs.map(t => {
                        const isActive = activeTab === t.key;
                        return (
                            <button
                                key={t.key}
                                onClick={() => setActiveTab(t.key as 'org' | 'branding' | 'team' | 'data')}
                                role="tab"
                                aria-selected={isActive}
                                className={clsx(
                                    "group relative inline-flex items-center gap-2 px-3.5 sm:px-4 py-2 rounded-lg text-[13px] font-semibold whitespace-nowrap",
                                    "transition-all duration-150 ease-out focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40 focus-visible:ring-offset-1",
                                    isActive
                                        ? "bg-white text-slate-900 shadow-[0_1px_2px_rgba(15,23,42,0.06),0_1px_3px_rgba(15,23,42,0.08)] ring-1 ring-slate-900/5"
                                        : "text-slate-500 hover:text-slate-900 hover:bg-white/50"
                                )}
                            >
                                <t.icon
                                    className={clsx(
                                        "w-4 h-4 transition-colors",
                                        isActive ? "text-indigo-600" : "text-slate-400 group-hover:text-slate-600"
                                    )}
                                    strokeWidth={2}
                                />
                                {t.label}
                            </button>
                        );
                    })}
                </nav>
            </div>

            <div>
                {activeTab === 'org' && (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
                        <div className="lg:col-span-2 bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
                            <div className="px-5 sm:px-8 py-5 sm:py-6 border-b border-slate-100 flex items-center justify-between">
                                <h2 className="font-semibold text-slate-900 text-base sm:text-lg tracking-tight flex items-center gap-3">
                                    <div className="p-2.5 rounded-lg bg-indigo-50 flex items-center justify-center border border-indigo-100">
                                        <Building2 className="w-5 h-5 text-indigo-600" />
                                    </div>
                                    Organisation Identity
                                </h2>
                                {orgSaved && (
                                    <div className="flex items-center gap-1.5 text-emerald-600 text-xs font-semibold">
                                        <CheckCircle2 className="w-4 h-4" /> Saved
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
                                        className="flex items-center justify-center gap-2 w-full sm:w-auto px-6 py-3 bg-slate-900 text-white text-xs font-semibold rounded-lg hover:bg-slate-800 transition-all active:scale-95 shadow-sm disabled:opacity-50"
                                    >
                                        {savingOrg ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                        Save Changes
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-6">
                            <div className="bg-indigo-600 rounded-lg p-6 sm:p-8 text-white shadow-sm relative overflow-hidden">
                                <ScanSearch className="absolute -top-10 -right-10 w-40 h-40 text-white/10 rotate-12" />
                                <h3 className="text-lg sm:text-xl font-semibold mb-2 relative z-10 tracking-tight">Enterprise Tier</h3>
                                <p className="text-indigo-100 text-xs font-medium relative z-10 leading-relaxed">
                                    Your workspace is currently operating on the strategic compliance package.
                                </p>
                                <div className="mt-6 pt-5 border-t border-white/10 relative z-10">
                                    <div className="text-[10px] font-mono font-medium uppercase tracking-wide text-indigo-200 mb-3">
                                        Features Included
                                    </div>
                                    <ul className="space-y-2.5">
                                        <li className="flex items-center gap-2 text-xs font-bold"><CheckCircle2 className="w-3.5 h-3.5 text-indigo-300" /> AI Risk Identification</li>
                                        <li className="flex items-center gap-2 text-xs font-bold"><CheckCircle2 className="w-3.5 h-3.5 text-indigo-300" /> Multi-User Team Access</li>
                                        <li className="flex items-center gap-2 text-xs font-bold"><CheckCircle2 className="w-3.5 h-3.5 text-indigo-300" /> Priority Support</li>
                                    </ul>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'branding' && <BrandingTab />}

                {activeTab === 'team' && (
                    <div className="space-y-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-slate-900 flex items-center justify-center">
                                <Users className="w-4 h-4 text-white" />
                            </div>
                            <div>
                                <h2 className="text-base font-semibold text-slate-900 tracking-tight">Team Members</h2>
                                <p className="text-[11px] text-slate-500">
                                    {teamRows.filter(r => r.status === 'active').length} active
                                    {teamRows.filter(r => r.status === 'pending').length > 0 && ` · ${teamRows.filter(r => r.status === 'pending').length} pending`}
                                </p>
                            </div>
                        </div>
                        <DynamicTable<TeamMember>
                            data={teamRows}
                            columns={columns}
                            rowActions={rowActions}
                            filters={filterDefs}
                            searchable
                            searchPlaceholder="Search by name or email…"
                            searchFields={["displayName", "email"]}
                            getRowId={(r) => r.uid}
                            loading={loadingTeam}
                            export={{ xlsx: true, filename: 'team-members' }}
                            emptyState={{
                                icon: Users,
                                title: 'No team members yet',
                                description: 'Send your first invitation using the Invite Team Member button.',
                            }}
                            headerVariant="light"
                            toolbarActions={
                                <button
                                    onClick={() => setInviteOpen(true)}
                                    className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg transition-all active:scale-95 shadow-sm whitespace-nowrap"
                                >
                                    <Plus className="w-3.5 h-3.5" />
                                    Invite Team Member
                                </button>
                            }
                        />
                    </div>
                )}

                {activeTab === 'tacRates' && <TacCostRatesTab />}

                {activeTab === 'data' && (
                    <div className="space-y-6">
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            <StatsCard
                                title="Active Programmes"
                                value={(Array.isArray(useStore.getState().programmes) ? useStore.getState().programmes : []).length}
                                icon={FolderKanban}
                                rounded="lg"
                                size="md"
                                iconBgClassName="bg-indigo-50 border border-indigo-100"
                                iconClassName="text-indigo-600"
                            />
                            <StatsCard
                                title="Live Projects"
                                value={(Array.isArray(useStore.getState().projects) ? useStore.getState().projects : []).length}
                                icon={Building2}
                                rounded="lg"
                                size="md"
                                iconBgClassName="bg-emerald-50 border border-emerald-100"
                                iconClassName="text-emerald-600"
                            />
                            <StatsCard
                                title="Integrity Status"
                                value="Healthy"
                                icon={ShieldCheck}
                                rounded="lg"
                                size="md"
                                iconBgClassName="bg-blue-50 border border-blue-100"
                                iconClassName="text-blue-600"
                            />
                        </div>

                        <div className="relative bg-rose-600 rounded-lg p-6 sm:p-8 text-white shadow-sm overflow-hidden">
                            <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                                <div className="space-y-3 min-w-0">
                                    <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/15 rounded-lg text-white text-[10px] font-mono font-bold uppercase tracking-wide border border-white/25">
                                        <AlertTriangle className="w-3.5 h-3.5" />
                                        Critical Intervention
                                    </div>
                                    <h3 className="text-xl sm:text-2xl font-semibold tracking-tight">Factory Reset Workspace</h3>
                                    <p className="text-rose-100 text-xs sm:text-sm font-medium leading-relaxed w-full">
                                        Permanently decommission all projects, strategic programmes, and identified risks. This action wipes the database clean and is strictly irreversible.
                                    </p>
                                </div>
                                <button
                                    onClick={() => setResetStep('confirm1')}
                                    disabled={resetting}
                                    className="shrink-0 flex items-center justify-center gap-2 px-6 py-3 bg-white text-rose-600 text-xs sm:text-sm font-semibold rounded-lg hover:bg-rose-50 transition-all active:scale-95 shadow-sm disabled:opacity-50"
                                >
                                    <RefreshCcw className={clsx("w-4 h-4", resetting && "animate-spin")} />
                                    Reset Workspace Data
                                </button>
                            </div>
                            <Database className="absolute -bottom-16 -right-16 w-64 h-64 text-white/5 -rotate-12 pointer-events-none" />
                        </div>

                        <div className="bg-slate-900 rounded-lg p-6 sm:p-8 text-white shadow-sm relative overflow-hidden">
                            <h4 className="text-[10px] font-mono font-medium text-indigo-400 uppercase tracking-wide mb-6 flex items-center gap-3">
                                <div className="w-6 h-6 rounded-lg bg-indigo-500/20 flex items-center justify-center">
                                    <Globe className="w-3.5 h-3.5" />
                                </div>
                                Cloud Infrastructure Topology
                            </h4>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                                {[
                                    { label: 'Primary Region', val: 'eu-west-2 (London)' },
                                    { label: 'Active Resilience', val: 'Multi-AZ Availability' },
                                    { label: 'Encryption Protocol', val: 'AES-256 / SHA-512' },
                                    { label: 'Compliance Mesh', val: 'GCP Shielded Nodes' }
                                ].map((item, i) => (
                                    <div key={i} className="space-y-2 border-l border-white/10 pl-4">
                                        <p className="text-[10px] font-mono font-medium text-slate-500 uppercase tracking-wide">{item.label}</p>
                                        <p className="text-xs font-bold text-slate-200">{item.val}</p>
                                    </div>
                                ))}
                            </div>
                            <div className="mt-8 pt-6 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between gap-2 opacity-40">
                                <p className="text-[10px] font-bold text-slate-500">Service Level Agreement: 99.99% Guaranteed</p>
                                <p className="text-[10px] font-bold text-slate-500 tracking-tighter">NODE_ID: CEDAR_PRD_UKW_01</p>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {inviteOpen && (
                <InviteTeamMemberModal
                    editTarget={inviteEditTarget}
                    programmes={ownedProgrammes}
                    onClose={() => { setInviteOpen(false); setInviteEditTarget(null); }}
                    onSaved={() => { setInviteOpen(false); setInviteEditTarget(null); loadTeam(); }}
                />
            )}

            {editingMember && (
                <EditMemberModal
                    member={editingMember}
                    programmes={ownedProgrammes}
                    currentAssignments={programmesByMember[editingMember.uid] || []}
                    onClose={() => setEditingMember(null)}
                    onSaved={() => { setEditingMember(null); loadTeam(); }}
                />
            )}

            {changingRoleFor && (
                <ChangeRoleModal
                    member={changingRoleFor}
                    callerCanonical={callerCanonical}
                    onClose={() => setChangingRoleFor(null)}
                    onSaved={() => {
                        setChangingRoleFor(null);
                        loadTeam();
                    }}
                />
            )}

            <ConfirmDialog
                open={resetStep === 'confirm1'}
                variant="danger"
                title="Reset workspace data?"
                message="This will permanently delete all projects, programmes, risks, issues, and pending invitations for this workspace. This cannot be undone."
                confirmLabel="Yes, continue"
                onCancel={() => setResetStep('idle')}
                onConfirm={() => setResetStep('confirm2')}
            />

            <ConfirmDialog
                open={resetStep === 'confirm2'}
                variant="danger"
                title="Are you absolutely sure?"
                message="Final confirmation — all workspace data will be wiped from the database immediately and permanently."
                confirmLabel="Delete everything"
                loading={resetting}
                onCancel={() => setResetStep('idle')}
                onConfirm={handleResetConfirmed}
            />

        </div>
    );
}

// ── Edit Member Modal (PM Level + Programmes) ─────────────────────────────────

function EditMemberModal({
    member,
    programmes,
    currentAssignments,
    onClose,
    onSaved,
}: {
    member: TeamMember;
    programmes: any[];
    currentAssignments: any[];
    onClose: () => void;
    onSaved: () => void;
}) {
    const initialIds = useMemo(() => new Set(currentAssignments.map(p => p.id)), [currentAssignments]);
    const [displayName, setDisplayName] = useState(member.displayName || '');
    const [selected, setSelected] = useState<Set<string>>(new Set(initialIds));
    const [pmLevel, setPmLevel] = useState<PmLevel>(member.pmLevel || 'standard');
    const [saving, setSaving] = useState(false);

    const handleSave = async () => {
        setSaving(true);
        try {
            const toAdd: string[] = [];
            const toRemove: string[] = [];
            programmes.forEach(p => {
                const was = initialIds.has(p.id);
                const is = selected.has(p.id);
                if (!was && is) toAdd.push(p.id);
                if (was && !is) toRemove.push(p.id);
            });
            await Promise.all([
                ...(displayName.trim() !== (member.displayName || '')
                    ? [api.clientUpdateMemberProfile(member.uid, displayName.trim())] : []),
                ...(pmLevel !== member.pmLevel && canonicalRole(member.role) === 'project_manager'
                    ? [api.setPmLevel(member.uid, pmLevel)] : []),
                ...toAdd.map(pid => api.addPMToProgramme(pid, member.uid)),
                ...toRemove.map(pid => api.removePMFromProgramme(pid, member.uid)),
            ]);
            toast.success('Member updated.');
            onSaved();
        } catch (err: any) {
            toast.error(err?.message || 'Failed to update member.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4" onClick={(e) => e.target === e.currentTarget && onClose()}>
            <div className="bg-white rounded-lg shadow-2xl max-w-lg w-full max-h-[85vh] flex flex-col">
                <fieldset disabled={saving} className="contents">
                    <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
                        <div>
                            <h3 className="text-base font-semibold text-slate-900 flex items-center gap-2">
                                <Pencil className="w-5 h-5 text-indigo-600" />
                                Edit {member.displayName || member.email}
                            </h3>
                            <p className="text-xs text-slate-500 mt-0.5">{member.email}</p>
                        </div>
                        <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100">
                            <span className="text-lg leading-none">×</span>
                        </button>
                    </div>
                    <div className="px-6 py-5 space-y-6 overflow-y-auto flex-1">
                        <div>
                            <p className={labelCls}>Display Name</p>
                            <input className={inputCls} value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder="e.g. Robert Wilson" />
                        </div>
                        {canonicalRole(member.role) === 'project_manager' && (
                            <div>
                                <p className={labelCls}>PM Level</p>
                                <select className={inputCls} value={pmLevel} onChange={e => setPmLevel(e.target.value as PmLevel)}>
                                    {PM_LEVEL_OPTIONS.map(o => (
                                        <option key={o.value} value={o.value}>{o.label}</option>
                                    ))}
                                </select>
                            </div>
                        )}
                        <div>
                            <p className={labelCls}>Programmes</p>
                            {programmes.length === 0 ? (
                                <p className="text-[11px] text-slate-400 px-1">You have no programmes to assign.</p>
                            ) : (
                                <div className="space-y-1.5 border border-slate-200 rounded-lg p-2.5 max-h-52 overflow-y-auto">
                                    {programmes.map(p => (
                                        <label key={p.id} className="flex items-start gap-3 px-2 py-2 rounded-lg hover:bg-slate-50 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                className="w-4 h-4 mt-0.5 accent-indigo-600"
                                                checked={selected.has(p.id)}
                                                onChange={e => setSelected(prev => {
                                                    const next = new Set(prev);
                                                    if (e.target.checked) next.add(p.id); else next.delete(p.id);
                                                    return next;
                                                })}
                                            />
                                            <div className="min-w-0">
                                                <p className="text-sm font-semibold text-slate-800 truncate">{p.name || p.reference}</p>
                                                {p.reference && p.name && <p className="text-[11px] text-slate-500 truncate">{p.reference}</p>}
                                            </div>
                                        </label>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                    <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-2">
                        <button onClick={onClose} className="px-4 py-2 text-xs font-bold text-slate-600 rounded-lg hover:bg-slate-100">
                            Cancel
                        </button>
                        <button
                            onClick={handleSave}
                            className="flex items-center gap-2 px-5 py-2 text-xs font-bold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 shadow-sm"
                        >
                            {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                            Save Changes
                        </button>
                    </div>
                </fieldset>
            </div>
        </div>
    );
}

// ── Change Role Modal ──────────────────────────────────────────────────────────

function ChangeRoleModal({
    member,
    callerCanonical,
    onClose,
    onSaved,
}: {
    member: TeamMember;
    callerCanonical: CanonicalRole;
    onClose: () => void;
    onSaved: () => void;
}) {
    const [newRole, setNewRole] = useState<CanonicalRole>(canonicalRole(member.role));
    const [saving, setSaving] = useState(false);

    const options = callerCanonical === 'super_admin'
        ? [...CANONICAL_ROLE_PROMOTE_OPTIONS, { value: 'super_admin' as CanonicalRole, label: 'Super Admin' }, { value: 'viewer' as CanonicalRole, label: 'Viewer' }]
        : CANONICAL_ROLE_PROMOTE_OPTIONS;

    const handleSave = async () => {
        setSaving(true);
        try {
            await api.adminPromoteUser(member.uid, newRole);
            toast.success('Role updated.');
            onSaved();
        } catch (err: any) {
            toast.error(err?.message || 'Failed to update role.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4" onClick={(e) => e.target === e.currentTarget && onClose()}>
            <div className="bg-white rounded-lg shadow-2xl max-w-md w-full">
                <fieldset disabled={saving} className="contents">
                    <div className="px-6 py-5 border-b border-slate-100">
                        <h3 className="text-base font-semibold text-slate-900 flex items-center gap-2">
                            <UserCog className="w-5 h-5 text-indigo-600" />
                            Change role for {member.displayName || member.email}
                        </h3>
                    </div>
                    <div className="px-6 py-5 space-y-4">
                        <div>
                            <label className={labelCls}>Canonical Role</label>
                            <select className={inputCls} value={newRole} onChange={e => setNewRole(e.target.value as CanonicalRole)}>
                                {options.map(o => (
                                    <option key={o.value} value={o.value}>{o.label}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                    <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-2">
                        <button onClick={onClose} className="px-4 py-2 text-xs font-bold text-slate-600 rounded-lg hover:bg-slate-100">
                            Cancel
                        </button>
                        <button
                            onClick={handleSave}
                            className="px-4 py-2 text-xs font-bold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2"
                        >
                            {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                            Save
                        </button>
                    </div>
                </fieldset>
            </div>
        </div>
    );
}

// ── Invite / Edit Team Member Modal (unified) ─────────────────────────────────
// editTarget=null → create mode; editTarget=TeamMember → edit pending invite mode

function InviteTeamMemberModal({
    editTarget = null,
    programmes,
    onClose,
    onSaved,
}: {
    editTarget?: TeamMember | null;
    programmes: any[];
    onClose: () => void;
    onSaved: () => void;
}) {
    const isEdit = editTarget !== null;
    const [email, setEmail] = useState('');
    const [name, setName] = useState(editTarget?.displayName || '');
    const [pmLevel, setPmLevel] = useState<PmLevel>((editTarget?.pmLevel as PmLevel) || 'standard');
    const [programmeIds, setProgrammeIds] = useState<string[]>(editTarget?.inviteProgrammeIds || []);
    const [saving, setSaving] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');

    const handleSubmit = async () => {
        setErrorMsg('');
        if (!isEdit && !email.includes('@')) { setErrorMsg('Please enter a valid email address.'); return; }
        setSaving(true);
        try {
            if (isEdit) {
                await api.updateInvite(editTarget!.inviteId!, { name, pmLevel, programmeIds });
                toast.success('Invitation updated.');
            } else {
                await api.inviteProjectManager(email, name, pmLevel, programmeIds);
                toast.success(`Invitation sent to ${email}.`);
            }
            onSaved();
        } catch (err: any) {
            setErrorMsg(err?.message || 'Something went wrong.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4" onClick={(e) => e.target === e.currentTarget && onClose()}>
            <div className="bg-white rounded-lg shadow-2xl max-w-lg w-full max-h-[90vh] flex flex-col">
                <fieldset disabled={saving} className="contents">
                    <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
                        <div>
                            <h3 className="text-base font-semibold text-slate-900 flex items-center gap-2">
                                {isEdit
                                    ? <><Pencil className="w-5 h-5 text-indigo-600" /> Edit Invitation</>
                                    : <><Mail className="w-5 h-5 text-indigo-600" /> Invite Team Member</>
                                }
                            </h3>
                            <p className="text-xs text-slate-500 mt-0.5">
                                {isEdit
                                    ? `Editing invite for ${editTarget!.email}`
                                    : 'All invited users join as Project Managers. Role promotions happen after they sign in.'}
                            </p>
                        </div>
                        <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100">
                            <span className="text-lg leading-none">×</span>
                        </button>
                    </div>
                    <div className="px-6 py-5 space-y-5 overflow-y-auto flex-1">
                        <div>
                            <label className={labelCls}>Full Name</label>
                            <input className={inputCls} value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Robert Wilson" />
                        </div>
                        {!isEdit && (
                            <div>
                                <label className={labelCls}>Email Address</label>
                                <input className={inputCls} value={email} onChange={e => setEmail(e.target.value)} placeholder="e.g. r.wilson@org.gov.uk" type="email" />
                            </div>
                        )}
                        <div>
                            <label className={labelCls}>PM Level</label>
                            <select className={inputCls} value={pmLevel} onChange={e => setPmLevel(e.target.value as PmLevel)}>
                                {PM_LEVEL_OPTIONS.map(o => (
                                    <option key={o.value} value={o.value}>{o.label}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className={labelCls}>Bind to programmes{!isEdit && ' (optional)'}</label>
                            {programmes.length === 0 ? (
                                <p className="text-[11px] text-slate-400 px-1">You have no programmes yet. Invite first, bind later.</p>
                            ) : (
                                <div className="max-h-44 overflow-y-auto space-y-1.5 border border-slate-200 rounded-lg p-2.5 bg-white/70">
                                    {programmes.map((p: any) => (
                                        <label key={p.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-slate-50 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                className="w-4 h-4 accent-indigo-600"
                                                checked={programmeIds.includes(p.id)}
                                                onChange={e => setProgrammeIds(prev =>
                                                    e.target.checked ? [...prev, p.id] : prev.filter(id => id !== p.id)
                                                )}
                                            />
                                            <span className="text-xs text-slate-700 truncate">{p.name || p.reference}</span>
                                        </label>
                                    ))}
                                </div>
                            )}
                        </div>
                        {errorMsg && (
                            <div className="p-3 rounded-lg text-[11px] font-bold border bg-red-50 border-red-100 text-red-700 flex gap-2 items-center">
                                <div className="w-2 h-2 rounded-full shrink-0 bg-red-500" />
                                {errorMsg}
                            </div>
                        )}
                    </div>
                    <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-2">
                        <button onClick={onClose} className="px-4 py-2 text-xs font-bold text-slate-600 rounded-lg hover:bg-slate-100">
                            Cancel
                        </button>
                        <button
                            onClick={handleSubmit}
                            disabled={saving || (!isEdit && !email)}
                            className="flex items-center gap-2 px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg transition-all disabled:opacity-50 shadow-sm"
                        >
                            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : isEdit ? <Pencil className="w-3.5 h-3.5" /> : <Mail className="w-3.5 h-3.5" />}
                            {isEdit ? 'Save Changes' : 'Send Invitation'}
                        </button>
                    </div>
                </fieldset>
            </div>
        </div>
    );
}

