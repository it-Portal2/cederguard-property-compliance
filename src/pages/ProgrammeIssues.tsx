import { FileWarning, Download, ArrowLeft, Plus } from 'lucide-react';
import { Link, useSearchParams, useNavigate } from 'react-router';
import { useState, useEffect, useMemo } from 'react';
import { useStore } from '../store/useStore';
import { api } from '../lib/api';
import { isAtLeastClientAdmin } from '../lib/roles';
import { ServiceManagementBar } from '../components/ServiceManagementBar';

export function ProgrammeIssues() {
    const { activeProgrammeId, user } = useStore();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const fromInitiation = searchParams.get('from') === 'initiation';
    const userRole = user?.role || user?.profile?.role;
    const isPM = !isAtLeastClientAdmin(userRole);
    const [projects, setProjects] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        api.clientGetProjectData().then((res: any) => {
            if (res.projects) {
                let list = res.projects;
                if (activeProgrammeId) {
                    list = list.filter((p: any) => p.programmeId === activeProgrammeId);
                }
                setProjects(list);
            }
        }).catch(console.error).finally(() => setLoading(false));
    }, [activeProgrammeId]);

    const totals = useMemo(() => {
        return {
            open: projects.reduce((s, p) => s + (p.issueOpen || 0), 0),
            escalated: projects.reduce((s, p) => s + (p.issueEscalated || 0), 0),
        };
    }, [projects]);

    return (
        <>
        <ServiceManagementBar />
        <div className="max-w-[98%] lg:max-w-7xl mx-auto p-2 sm:p-4 lg:p-6 space-y-5 sm:space-y-6">

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                <div className="bg-white border-t-4 border-t-amber-500 border border-slate-200 rounded-xl p-4 shadow-sm">
                    <div className="text-2xl font-bold text-amber-600 mb-1">{loading ? '—' : totals.open}</div>
                    <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Total Open Issues</div>
                </div>
                <div className="bg-white border-t-4 border-t-red-500 border border-slate-200 rounded-xl p-4 shadow-sm">
                    <div className="text-2xl font-bold text-red-600 mb-1">{loading ? '—' : totals.escalated}</div>
                    <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Escalated Issues</div>
                </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 shadow-xl shadow-slate-200/50 overflow-x-auto scrollbar-thin scrollbar-thumb-slate-200">
                <div className="border-b border-slate-100 p-4 pb-3">
                    <p className="text-sm text-slate-500 font-medium">Issue breakdown by project</p>
                </div>
                {loading ? (
                    <div className="p-8 text-center text-slate-400">Loading issues...</div>
                ) : projects.length === 0 ? (
                    <div className="p-8 text-center text-slate-400 text-sm">No projects found.</div>
                ) : (
                    <table className="w-full text-sm min-w-[500px]">
                        <thead className="bg-slate-50/50 text-slate-500 text-[9px] uppercase tracking-[0.15em] font-black border-b border-slate-200">
                            <tr>
                                <th className="px-4 py-3 text-left">Project Name</th>
                                <th className="px-4 py-3 text-left">Project Manager</th>
                                <th className="px-4 py-3 text-right">Open Issues</th>
                                <th className="px-4 py-3 text-right">Escalated</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {projects.map(p => (
                                <tr key={p.id} className="hover:bg-slate-50/80 transition-all group border-b border-slate-100">
                                    <td className="px-5 py-3 text-[11px] font-black text-slate-800">{p.name || 'Untitled Project'}</td>
                                    <td className="px-4 py-3 text-[11px] text-slate-600 font-medium">{p.pmName}</td>
                                    <td className="px-4 py-3 text-right text-[11px] font-black text-amber-600">{p.issueOpen || 0}</td>
                                    <td className="px-4 py-3 text-right text-[11px] font-black text-rose-600">{p.issueEscalated || 0}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
        </>
    );
}
