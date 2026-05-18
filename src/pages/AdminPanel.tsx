import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import {
    Shield,
    Loader2,
    FolderKanban,
    Layers,
    X,
    Edit2,
    RefreshCw,
    Trash2
} from 'lucide-react';
import { useStore } from '../store/useStore';
import { api } from '../lib/api';
import { clsx } from 'clsx';
import { MappingManager } from '../components/admin/MappingManager';
import { isSuperAdmin, UserRole } from '../lib/roles';
import { RegulationManager } from '../components/admin/RegulationManager';
import { DetailsModal } from '../components/admin/DetailsModal';

import { TABS } from '../components/admin/constants';
import { UsersTab } from '../components/admin/UsersTab';
import { ActivityTab } from '../components/admin/ActivityTab';
import { ProjectsTab } from '../components/admin/ProjectsTab';
import { PricingTab } from '../components/admin/PricingTab';
import { OverviewTab } from '../components/admin/OverviewTab';
import { AIModelsTab } from '../components/admin/AIModelsTab';

export function AdminPanel() {
    const navigate = useNavigate();
    const { 
        user,
        adminDeleteProgramme,
        adminDeleteProject,
        adminTransferProgramme,
        adminTransferProject 
    } = useStore();
    const [tab, setTab] = useState('overview');
    const [stats, setStats] = useState({ users: 0, properties: 0, activities: 0 });
    const [loadingStats, setLoadingStats] = useState(true);
    const [profileLoading, setProfileLoading] = useState(true);
    const [localProfile, setLocalProfile] = useState<any>(null);
    const [statsError, setStatsError] = useState<string | null>(null);
    const [allUsers, setAllUsers] = useState<any[]>([]);
    const [loadingUsers, setLoadingUsers] = useState(false);
    const [allProjects, setAllProjects] = useState<any[]>([]);
    const [loadingProjects, setLoadingProjects] = useState(false);
    const [allProgrammes, setAllProgrammes] = useState<any[]>([]);
    const [loadingProgrammes, setLoadingProgrammes] = useState(false);
    
    // Additional state for details modal
    const [detailsModal, setDetailsModal] = useState<{isOpen: boolean, type: 'programmes' | 'projects' | null}>({ isOpen: false, type: null });
    
    useEffect(() => {
        api.getProfile()
            .then(res => { if (res?.profile) setLocalProfile(res.profile); })
            .catch(() => { })
            .finally(() => setProfileLoading(false));
    }, []);

    const userRole = (user?.role || user?.profile?.role || localProfile?.role) as UserRole | undefined;
    const userIsSuperAdmin = isSuperAdmin(user?.email, userRole);

    useEffect(() => {
        if (!userIsSuperAdmin || profileLoading) return;
        api.adminStats()
            .then(res => {
                if (res.success) setStats(res.stats);
                else setStatsError(res.error || 'Failed to load stats');
            })
            .catch(e => setStatsError(e.message))
            .finally(() => setLoadingStats(false));
    }, [userIsSuperAdmin, profileLoading]);

    // Pre-load users when admin opens the panel
    useEffect(() => {
        if (!userIsSuperAdmin || profileLoading) return;
        setLoadingUsers(true);
        api.adminGetUsers()
            .then(res => { if (res.success) setAllUsers(res.users || []); })
            .catch(() => { })
            .finally(() => setLoadingUsers(false));
    }, [userIsSuperAdmin, profileLoading]);

    useEffect(() => {
        if (!userIsSuperAdmin || profileLoading) return;
        setLoadingProjects(true);
        setLoadingProgrammes(true);
        Promise.all([
            api.adminGetProjects(),
            api.adminGetProgrammes()
        ]).then(([projRes, progRes]) => {
            if (projRes.success) setAllProjects(projRes.projects || []);
            if (progRes.success) setAllProgrammes(progRes.programmes || []);
        }).catch(() => {
        }).finally(() => {
            setLoadingProjects(false);
            setLoadingProgrammes(false);
        });
    }, [userIsSuperAdmin, profileLoading]);

    if (profileLoading) {
        return <div className="flex items-center justify-center h-[60vh]"><Loader2 className="w-8 h-8 animate-spin text-indigo-600" /></div>;
    }

    if (!userIsSuperAdmin) {
        return (
            <div className="flex flex-col items-center justify-center h-[60vh] text-center px-4">
                <Shield className="w-16 h-16 text-red-500 mb-4" />
                <h2 className="text-2xl font-bold text-slate-800">Access Denied</h2>
                <p className="text-slate-500 mt-2 max-w-md">You do not have administrative privileges. Contact the platform administrator.</p>
                <p className="text-xs text-slate-400 mt-4">Signed in as: {user?.email}</p>
            </div>
        );
    }

    return (
        <div className="max-w-7xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-black text-slate-900 flex items-center gap-3">
                        <div className="p-2 bg-indigo-50 rounded-lg">
                            <Shield className="w-7 h-7 text-indigo-600" />
                        </div>
                        Platform Administration
                    </h1>
                    <p className="text-sm text-slate-500 mt-1 font-medium italic opacity-80">Command center for users and platform governance.</p>
                </div>
            </div>

            {/* Tab Navigation */}
            <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit">
                {TABS.map(t => {
                    const Icon = t.icon;
                    return (
                        <button
                            key={t.id}
                            onClick={() => setTab(t.id)}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${tab === t.id ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            <Icon className="w-4 h-4" />
                            {t.label}
                        </button>
                    );
                })}
            </div>

            {/* Tab Panels */}
            {tab === 'overview' && (
                <OverviewTab 
                    statsError={statsError}
                    allUsers={allUsers}
                    loadingUsers={loadingUsers}
                    allProgrammes={allProgrammes}
                    loadingProgrammes={loadingProgrammes}
                    allProjects={allProjects}
                    loadingProjects={loadingProjects}
                    setDetailsModal={setDetailsModal}
                    setTab={setTab}
                />
            )}
            {tab === 'users' && <UsersTab isAdmin={userIsSuperAdmin} />}
            {tab === 'mappings' && <MappingManager />}
            {tab === 'regulations' && <RegulationManager />}
            {tab === 'pricing' && <PricingTab />}
            {tab === 'ai-models' && <AIModelsTab isAdmin={userIsSuperAdmin} />}
            {tab === 'activity' && <ActivityTab isAdmin={userIsSuperAdmin} users={allUsers} />}

            <DetailsModal 
                isOpen={detailsModal.isOpen}
                type={detailsModal.type}
                onClose={() => setDetailsModal({ isOpen: false, type: null })}
                items={detailsModal.type === 'programmes' ? allProgrammes : allProjects}
                allUsers={allUsers}
                onItemDeleted={(id, type) => {
                    if (type === 'programmes') setAllProgrammes(prev => prev.filter(p => p.id !== id));
                    else setAllProjects(prev => prev.filter(p => p.id !== id));
                }}
                onItemTransferred={(id, type, targetUser) => {
                    const updater = (prev: any[]) => prev.map(p => p.id === id ? { 
                        ...p, 
                        userId: targetUser.uid, 
                        pm: targetUser.email,
                        clientId: targetUser.clientId || targetUser.uid 
                    } : p);
                    if (type === 'programmes') setAllProgrammes(updater);
                    else setAllProjects(updater);
                }}
                adminDeleteProgramme={adminDeleteProgramme}
                adminDeleteProject={adminDeleteProject}
                adminTransferProgramme={adminTransferProgramme}
                adminTransferProject={adminTransferProject}
            />
        </div>
    );
}
