import { Users, Building2, Shield, Briefcase, User, BarChart, History, Settings, Loader2, Cpu, UserCheck } from 'lucide-react';
import { clsx } from 'clsx';

// ─── Role Configuration ────────────────────────────────────────────────────────

export const ROLE_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
    admin: { label: 'Admin', color: 'bg-purple-100 text-purple-800', icon: Shield },
    client_admin: { label: 'Client Admin', color: 'bg-indigo-100 text-indigo-800', icon: Building2 },
    project_manager: { label: 'Project Manager', color: 'bg-teal-100 text-teal-800', icon: Briefcase },
    senior_project_manager: { label: 'Senior Project Manager', color: 'bg-emerald-100 text-emerald-800', icon: Shield },
    assistant_project_manager: { label: 'Assistant Project Manager', color: 'bg-slate-100 text-slate-800', icon: Briefcase },
    project_coordinator: { label: 'Project Coordinator', color: 'bg-blue-50 text-blue-700', icon: User },
};

export const PLAN_OPTIONS = ['project_manager', 'senior_project_manager', 'assistant_project_manager', 'project_coordinator', 'client_admin', 'admin'];

// ─── Activity Icons ─────────────────────────────────────────────────────────────

export const ACTIVITY_ICONS: Record<string, { label: string; color: string }> = {
    admin_user_update: { label: 'User Updated', color: 'text-purple-600 bg-purple-50' },
    project_created: { label: 'Project Created', color: 'text-emerald-600 bg-emerald-50' },
    project_updated: { label: 'Project Updated', color: 'text-blue-600 bg-blue-50' },
    project_deleted: { label: 'Project Deleted', color: 'text-red-600 bg-red-50' },
    risk_assessed: { label: 'Risk Assessed', color: 'text-orange-600 bg-orange-50' },
    compliance_checked: { label: 'Compliance Checked', color: 'text-teal-600 bg-teal-50' },
    programme_created: { label: 'Programme Created', color: 'text-emerald-600 bg-emerald-50' },
    programme_deleted: { label: 'Programme Deleted', color: 'text-red-600 bg-red-50' },
    admin_transfer_project: { label: 'Project Transferred', color: 'text-amber-600 bg-amber-50' },
    admin_transfer_programme: { label: 'Programme Transferred', color: 'text-purple-600 bg-purple-50' },
    admin_supervisor_assigned: { label: 'Supervisor Assigned', color: 'text-indigo-600 bg-indigo-50' },
    supervisor_assigned: { label: 'Supervisor Linked', color: 'text-sky-600 bg-sky-50' },
    pm_added_to_programme: { label: 'PM Added to Programme', color: 'text-emerald-600 bg-emerald-50' },
    pm_removed_from_programme: { label: 'PM Removed from Programme', color: 'text-amber-600 bg-amber-50' },
    admin_user_promoted: { label: 'Role Changed', color: 'text-violet-600 bg-violet-50' },
    pm_level_updated: { label: 'PM Level Changed', color: 'text-slate-600 bg-slate-50' },
    default: { label: 'Activity', color: 'text-slate-600 bg-slate-100' },
};

// ─── Activity category badges (Activity Log table) ──────────────────────────────
// Colour by coarse category; the specific action `type` is humanised in the UI.

export const ACTIVITY_CATEGORY_BADGES: Record<string, { label: string; color: string }> = {
    create: { label: 'Create', color: 'text-emerald-600 bg-emerald-50' },
    read: { label: 'View', color: 'text-slate-600 bg-slate-100' },
    update: { label: 'Update', color: 'text-blue-600 bg-blue-50' },
    delete: { label: 'Delete', color: 'text-red-600 bg-red-50' },
    approve: { label: 'Approval', color: 'text-violet-600 bg-violet-50' },
    auth: { label: 'Auth', color: 'text-amber-600 bg-amber-50' },
    export: { label: 'Export', color: 'text-cyan-600 bg-cyan-50' },
    system: { label: 'System', color: 'text-indigo-600 bg-indigo-50' },
    other: { label: 'Activity', color: 'text-slate-600 bg-slate-100' },
};

// ─── Tab Navigation ─────────────────────────────────────────────────────────────

export const TABS = [
    { id: 'overview', label: 'Overview', icon: BarChart },
    { id: 'users', label: 'Users', icon: Users },
    { id: 'access-requests', label: 'Access Requests', icon: UserCheck },
    { id: 'mappings', label: 'Mapping Editor', icon: Briefcase },
    { id: 'regulations', label: 'Regulations', icon: Shield },
    { id: 'pricing', label: 'Cost Config', icon: Settings },
    { id: 'ai-models', label: 'AI Models', icon: Cpu },
    { id: 'activity', label: 'Activity Log', icon: History },
];

// ─── Reusable UI Atoms ──────────────────────────────────────────────────────────

export function RoleBadge({ role }: { role: string }) {
    const cfg = ROLE_CONFIG[role] || ROLE_CONFIG.project_manager;
    const Icon = cfg.icon;
    return (
        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${cfg.color}`}>
            <Icon className="w-3 h-3" /> {cfg.label}
        </span>
    );
}

// Legacy StatCard removed — all consumers now use the richer shared
// component at src/components/common/StatsCard.tsx, which carries the
// same data shape plus icon-tint backgrounds, trend, progress, and the
// new info tooltip prop.
