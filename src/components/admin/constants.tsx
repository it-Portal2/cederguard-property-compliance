import { Users, Building2, Shield, Briefcase, User, BarChart, History, Settings, Loader2 } from 'lucide-react';
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
    default: { label: 'Activity', color: 'text-slate-600 bg-slate-100' },
};

// ─── Tab Navigation ─────────────────────────────────────────────────────────────

export const TABS = [
    { id: 'overview', label: 'Overview', icon: BarChart },
    { id: 'users', label: 'Users', icon: Users },
    { id: 'mappings', label: 'Mapping Editor', icon: Briefcase },
    { id: 'regulations', label: 'Regulations', icon: Shield },
    { id: 'pricing', label: 'Cost Config', icon: Settings },
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

export function StatCard({ icon: Icon, label, value, color, border, onClick }: { icon: any; label: string; value: number | string; color: string; border: string; onClick?: () => void }) {
    return (
        <div 
            onClick={onClick}
            className={clsx(
                "bg-white rounded-xl border border-slate-200 p-6 shadow-sm flex items-start gap-4 transition-all border-l-4", 
                border,
                onClick ? "cursor-pointer hover:shadow-md" : ""
            )}
        >
            <div className={`p-3 rounded-xl ${color}`}><Icon className="w-5 h-5" /></div>
            <div>
                <p className="text-[10px] text-slate-400 font-black uppercase tracking-[0.2em] mb-1">{label}</p>
                <p className="text-3xl font-black text-slate-900">{value}</p>
            </div>
        </div>
    );
}
