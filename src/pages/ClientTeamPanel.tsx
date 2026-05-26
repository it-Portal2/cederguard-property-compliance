import React, { useEffect, useState, useCallback } from 'react';
import {
  Users, UserPlus, Trash2, RefreshCw, Search, Loader2,
  AlertCircle, CheckCircle, Mail, Briefcase,
  ChevronDown, Shield, Clock, X
} from 'lucide-react';
import { useStore } from '../store/useStore';
import { api } from '../lib/api';
import { isSuperAdmin, isAtLeastClientAdmin, isAtLeastPM } from '../lib/roles';
import { useNavigate } from 'react-router';
import { clsx } from 'clsx';

/* ─────────────────────── Types ─────────────────────── */
const TEAM_ROLES = [
  { value: 'project_manager', label: 'Project Manager' },
  { value: 'senior_pm', label: 'Senior Project Manager' },
  { value: 'senior_project_manager', label: 'Senior Project Manager (Legacy)' },
  { value: 'assistant_pm', label: 'Assistant Project Manager' },
  { value: 'project_coordinator', label: 'Project Coordinator' },
];

const ROLE_STYLE: Record<string, string> = {
  project_manager: 'bg-teal-100 text-teal-800',
  senior_pm: 'bg-emerald-100 text-emerald-800',
  senior_project_manager: 'bg-emerald-100 text-emerald-800',
  assistant_pm: 'bg-slate-100 text-slate-700',
  project_coordinator: 'bg-blue-50 text-blue-700',
};

function RoleBadge({ role }: { role: string }) {
  const label = TEAM_ROLES.find(r => r.value === role)?.label ?? role;
  const style = ROLE_STYLE[role] ?? 'bg-slate-100 text-slate-600';
  return (
    <span className={clsx('inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold', style)}>
      <Briefcase className="w-3 h-3" /> {label}
    </span>
  );
}

/* ─────────────────────── Invite Form ─────────────────────── */
function InviteForm({ onInvited }: { onInvited: () => void }) {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState('project_manager');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      const roleToPmLevel: Record<string, string> = {
        project_manager: 'standard',
        senior_pm: 'senior',
        senior_project_manager: 'senior',
        assistant_pm: 'assistant',
        project_coordinator: 'coordinator',
      };
      const pmLevel = roleToPmLevel[role] ?? 'standard';
      await api.inviteProjectManager(email.trim().toLowerCase(), name.trim(), pmLevel, []);
      setSuccess(`Invitation sent to ${email.trim()}`);
      setEmail('');
      setName('');
      setRole('project_manager');
      onInvited();
    } catch (err: any) {
      setError(err.message || 'Failed to send invitation');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-6">
      <div className="flex items-center gap-2 mb-5">
        <div className="p-2 bg-indigo-50 rounded-lg">
          <UserPlus className="w-4 h-4 text-indigo-600" />
        </div>
        <div>
          <h2 className="font-bold text-slate-800">Invite a Team Member</h2>
          <p className="text-xs text-slate-500 mt-0.5">They'll receive a magic link to sign in — no password needed.</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Email address *</label>
            <input
              type="email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="pm@example.com"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Full name (optional)</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Jane Smith"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Role *</label>
            <div className="relative">
              <select
                value={role}
                onChange={e => setRole(e.target.value)}
                className="w-full appearance-none pl-3 pr-8 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
              >
                {TEAM_ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={loading || !email.trim()}
            className="inline-flex items-center gap-2 px-5 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
            Send Invitation
          </button>
          {success && (
            <span className="flex items-center gap-1.5 text-sm text-emerald-600 font-medium">
              <CheckCircle className="w-4 h-4" /> {success}
            </span>
          )}
          {error && (
            <span className="flex items-center gap-1.5 text-sm text-red-600 font-medium">
              <AlertCircle className="w-4 h-4" /> {error}
            </span>
          )}
        </div>

        <div className="flex items-start gap-2 text-xs text-slate-400 bg-slate-50 rounded-lg px-3 py-2 border border-slate-100">
          <Shield className="w-3.5 h-3.5 mt-0.5 shrink-0 text-slate-400" />
          You can only invite Project Manager-level roles. Admin accounts are managed by Cedar Guard support.
        </div>
      </form>
    </div>
  );
}

/* ─────────────────────── Main Page ─────────────────────── */
export function ClientTeamPanel() {
  const { user } = useStore();
  const navigate = useNavigate();
  const userRole = user?.role || user?.profile?.role;
  const isAdmin = isSuperAdmin(user?.email, userRole);
  const isClientAdminUser = isAtLeastClientAdmin(userRole) || isAdmin;
  const isAtLeastPMUser = isAtLeastPM(userRole);


  const [team, setTeam] = useState<any[]>([]);
  const [pending, setPending] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.clientGetTeam();
      if (res.success) {
        setTeam(res.team || []);
        setPending(res.pending || []);
      } else {
        setError(res.error || 'Failed to load team');
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAtLeastPMUser) load();
  }, [isAtLeastPMUser, load]);

  const handleRoleChange = async (targetUid: string, newRole: string) => {
    if (!isClientAdminUser) return;
    setUpdatingId(targetUid);
    try {
      await api.clientUpdateUserRole(targetUid, newRole);
      setTeam(prev => prev.map(m => m.uid === targetUid ? { ...m, role: newRole } : m));
    } catch (e: any) {
      setError('Failed to update role: ' + e.message);
    } finally {
      setUpdatingId(null);
    }
  };

  const handleRemove = async (targetUid: string, memberEmail: string) => {
    if (!isClientAdminUser) return;
    if (!confirm(`Remove ${memberEmail} from your team? They will lose access to all your projects.`)) return;
    setUpdatingId(targetUid);
    try {
      await api.clientRemoveUser(targetUid);
      setTeam(prev => prev.filter(m => m.uid !== targetUid));
    } catch (e: any) {
      setError('Failed to remove team member: ' + e.message);
    } finally {
      setUpdatingId(null);
    }
  };

  const filtered = team.filter(m =>
    !search ||
    (m.email || '').toLowerCase().includes(search.toLowerCase()) ||
    (m.displayName || '').toLowerCase().includes(search.toLowerCase())
  );

  if (!isAtLeastPMUser) return null;

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <div className="p-2 bg-indigo-50 rounded-lg">
            <Users className="w-5 h-5 text-indigo-600" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Team Management</h1>
        </div>
        <p className="text-slate-500 text-sm ml-11">
          Invite and manage your Project Managers, Senior PMs, and Coordinators.
          Roles are scoped to your organisation — your team cannot access other clients' data.
        </p>
      </div>

      {/* Invite Form — Only for Client Admins */}
      {isClientAdminUser && <InviteForm onInvited={load} />}

      {/* Active Team */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-slate-400" />
            <h2 className="font-semibold text-slate-800">Active Team Members</h2>
            <span className="bg-slate-100 text-slate-600 text-xs font-semibold px-2 py-0.5 rounded-full">
              {team.length}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search..."
                className="pl-8 pr-3 py-1.5 border border-slate-200 rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-300 w-44"
              />
            </div>
            <button onClick={load} className="p-1.5 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
              <RefreshCw className="w-3.5 h-3.5 text-slate-500" />
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-7 h-7 animate-spin text-indigo-400" />
          </div>
        ) : error ? (
          <div className="flex items-center gap-3 text-red-600 bg-red-50 border-t border-red-100 px-5 py-4">
            <AlertCircle className="w-5 h-5 shrink-0" /> {error}
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center">
            <Users className="w-10 h-10 text-slate-200 mx-auto mb-3" />
            <p className="text-slate-500 font-medium text-sm">
              {search ? 'No members match your search.' : 'No team members yet — invite someone above.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>
                  <th className="text-left px-5 py-3 font-mono font-medium text-slate-500 text-[11px] uppercase tracking-wide">Member</th>
                  <th className="text-left px-5 py-3 font-mono font-medium text-slate-500 text-[11px] uppercase tracking-wide">Role</th>
                  <th className="text-left px-5 py-3 font-mono font-medium text-slate-500 text-[11px] uppercase tracking-wide">Joined</th>
                  {isClientAdminUser && <th className="text-left px-5 py-3 font-mono font-medium text-slate-500 text-[11px] uppercase tracking-wide">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filtered.map(member => (
                  <tr key={member.uid} className="hover:bg-slate-50 transition-colors">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-sm uppercase shrink-0">
                          {(member.displayName || member.email || '?')[0]}
                        </div>
                        <div>
                          <p className="font-semibold text-slate-800">{member.displayName || 'Guest User'}</p>
                          <p className="text-xs text-slate-400">{member.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      {isClientAdminUser ? (
                        updatingId === member.uid ? (
                          <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />
                        ) : (
                          <div className="relative inline-block">
                            <select
                              value={member.role || 'project_manager'}
                              onChange={e => handleRoleChange(member.uid, e.target.value)}
                              className="appearance-none pl-3 pr-7 py-1.5 border border-slate-200 rounded-lg text-xs bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400 cursor-pointer"
                            >
                              {TEAM_ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                            </select>
                            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400 pointer-events-none" />
                          </div>
                        )
                      ) : (
                        <RoleBadge role={member.role} />
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-xs text-slate-400">
                      {member.createdAt ? new Date(member.createdAt).toLocaleDateString('en-GB') : '—'}
                    </td>
                    {isClientAdminUser && (
                      <td className="px-5 py-3.5">
                        <button
                          onClick={() => handleRemove(member.uid, member.email)}
                          disabled={updatingId === member.uid}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 border border-red-100 rounded-lg transition-colors disabled:opacity-40"
                        >
                          <Trash2 className="w-3.5 h-3.5" /> Remove
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pending Invitations */}
      {pending.length > 0 && (
        <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-4 border-b border-slate-100">
            <Clock className="w-4 h-4 text-amber-500" />
            <h2 className="font-semibold text-slate-800">Pending Invitations</h2>
            <span className="bg-amber-100 text-amber-700 text-xs font-semibold px-2 py-0.5 rounded-full">
              {pending.length}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>
                  <th className="text-left px-5 py-3 font-mono font-medium text-slate-500 text-[11px] uppercase tracking-wide">Email</th>
                  <th className="text-left px-5 py-3 font-mono font-medium text-slate-500 text-[11px] uppercase tracking-wide">Name</th>
                  <th className="text-left px-5 py-3 font-mono font-medium text-slate-500 text-[11px] uppercase tracking-wide">Role</th>
                  <th className="text-left px-5 py-3 font-mono font-medium text-slate-500 text-[11px] uppercase tracking-wide">Sent</th>
                  <th className="text-left px-5 py-3 font-mono font-medium text-slate-500 text-[11px] uppercase tracking-wide">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {pending.map(inv => (
                  <tr key={inv.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-5 py-3.5 font-medium text-slate-700">{inv.email}</td>
                    <td className="px-5 py-3.5 text-slate-500">{inv.name || '—'}</td>
                    <td className="px-5 py-3.5"><RoleBadge role={inv.role} /></td>
                    <td className="px-5 py-3.5 text-xs text-slate-400">
                      {inv.createdAt ? new Date(inv.createdAt).toLocaleDateString('en-GB') : '—'}
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-50 text-amber-700 text-xs font-semibold rounded-full border border-amber-100">
                        <Clock className="w-3 h-3" /> Awaiting sign-in
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-5 py-3 bg-amber-50/40 border-t border-amber-100">
            <p className="text-xs text-amber-700">
              <strong>Note:</strong> Invitations are activated automatically when the user first signs in using their invited email address via the login page.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
