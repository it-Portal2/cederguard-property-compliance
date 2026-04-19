import React from 'react';
import { useStore } from '../store/useStore';
import { DOMAINS } from '../data/complianceData';
import { ShieldAlert, AlertTriangle, Clock, ListChecks, Info, CheckCircle2, ScanSearch } from 'lucide-react';
import { clsx } from 'clsx';
import { stripMarkdown } from '../lib/utils';
import { Link } from 'react-router';

export function ComplianceAlerts() {
    const { complianceItems, complianceAnalysis, activeProjectId, activeProgrammeId } = useStore();

    if (!activeProjectId && !activeProgrammeId) {
        return (
            <div className="flex flex-col items-center justify-center py-24 text-center">
                <ShieldAlert className="w-16 h-16 text-indigo-200 mb-4" />
                <h2 className="text-xl font-bold text-slate-800 mb-2">No Programme or Project Selected</h2>
                <p className="text-sm text-slate-500 max-w-sm mb-6">
                    Please select a programme or project to view its compliance alerts.
                </p>
            </div>
        );
    }

    if (!complianceAnalysis) {
        return (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 text-center max-w-2xl mx-auto mt-12">
                <AlertTriangle className="w-12 h-12 text-amber-400 mx-auto mb-3" />
                <h3 className="text-lg font-bold text-amber-800 mb-2">Setup Required</h3>
                <p className="text-sm text-amber-700 mb-4">
                    Run the AI compliance analysis in Setup to generate and filter compliance alerts for your specific context.
                </p>
                <Link to="/compliance/setup" className="inline-block px-5 py-2.5 bg-amber-600 text-white font-semibold rounded-lg hover:bg-amber-700 transition-colors">
                    Go to Setup
                </Link>
            </div>
        );
    }

    // Filter items based on active context
    const contextCompliance = complianceItems.filter(c => {
        if (activeProjectId) return c.projectId === activeProjectId;
        if (activeProgrammeId) return c.programmeId === activeProgrammeId;
        return true;
    });

    const groups = [
        {
            id: 'critical',
            label: 'Critical — High Risk, Not Started',
            items: contextCompliance.filter(i => i.risk === 'High' && i.stage === 'Not Started'),
            color: 'red',
            icon: <ShieldAlert className="w-5 h-5" />
        },
        {
            id: 'active',
            label: 'Active — In Progress',
            items: contextCompliance.filter(i => i.stage === 'In Progress'),
            color: 'amber',
            icon: <Clock className="w-5 h-5" />
        },
        {
            id: 'handover',
            label: 'Handover Actions Pending',
            items: contextCompliance.filter(i => i.trigger?.toLowerCase().includes('handover') && i.stage !== 'Complete'),
            color: 'purple',
            icon: <ListChecks className="w-5 h-5" />
        },
        {
            id: 'statutory',
            label: 'Statutory Timescale Actions',
            items: contextCompliance.filter(i => ['dm', 'lc', 'lr'].includes(i.domain) && i.stage !== 'Complete'),
            color: 'rose',
            icon: <AlertTriangle className="w-5 h-5" />
        },
        ...(complianceAnalysis.isHRB ? [{
            id: 'bsa',
            label: 'BSA 2022 — Gateway & HRB Items',
            items: contextCompliance.filter(i => i.domain === 'bs'),
            color: 'orange',
            icon: <Info className="w-5 h-5" />
        }] : []),
        {
            id: 'funding',
            label: 'Funding Compliance — Milestone Driven',
            items: contextCompliance.filter(i => ['fc', 'ah'].includes(i.domain) && i.stage !== 'Complete'),
            color: 'cyan',
            icon: <CheckCircle2 className="w-5 h-5" />
        }
    ].filter(g => g.items.length > 0);

    const colors = {
        red: 'text-red-600 border-red-200 bg-red-50',
        amber: 'text-amber-600 border-amber-200 bg-amber-50',
        purple: 'text-purple-600 border-purple-200 bg-purple-50',
        rose: 'text-rose-600 border-rose-200 bg-rose-50',
        orange: 'text-orange-600 border-orange-200 bg-orange-50',
        cyan: 'text-cyan-600 border-cyan-200 bg-cyan-50'
    };

    const badgeColors = {
        red: 'shadow-[0_0_8px_rgba(220,38,38,0.4)] bg-red-500',
        amber: 'shadow-[0_0_8px_rgba(217,119,6,0.4)] bg-amber-500',
        purple: 'shadow-[0_0_8px_rgba(147,51,234,0.4)] bg-purple-500',
        rose: 'shadow-[0_0_8px_rgba(225,29,72,0.4)] bg-rose-500',
        orange: 'shadow-[0_0_8px_rgba(234,88,12,0.4)] bg-orange-500',
        cyan: 'shadow-[0_0_8px_rgba(8,145,178,0.4)] bg-cyan-500'
    };

    return (
        <div className="space-y-6 max-w-[1200px] mx-auto pb-12">
            <div>
                <h1 className="text-2xl font-bold text-slate-900">Compliance Alerts & Breaches</h1>
                <p className="text-sm text-slate-500 mt-1">Smart categorization of open compliance tasks requiring attention.</p>
            </div>

            {groups.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-16 bg-white border border-slate-200 rounded-2xl shadow-sm">
                    <CheckCircle2 className="w-16 h-16 text-emerald-400 mb-4" />
                    <h2 className="text-xl font-bold text-slate-800">All Clear!</h2>
                    <p className="text-slate-500 mt-2">No active compliance alerts found.</p>
                </div>
            ) : (
                <div className="space-y-8">
                    {groups.map(group => (
                        <div key={group.id} className="bg-white border text-sm rounded-2xl shadow-sm overflow-hidden">
                            <div className={clsx("px-5 py-4 border-b flex items-center justify-between", colors[group.color as keyof typeof colors])}>
                                <div className="flex items-center gap-3">
                                    <span className={clsx("w-2 h-2 rounded-full", badgeColors[group.color as keyof typeof badgeColors])} />
                                    <h3 className="font-bold flex items-center gap-2">
                                        {group.icon} {group.label}
                                    </h3>
                                </div>
                                <span className="font-bold bg-white/50 px-3 py-1 rounded-full text-xs">
                                    {group.items.length} item{group.items.length !== 1 && 's'}
                                </span>
                            </div>

                            <div className="divide-y divide-slate-100 p-2">
                                {group.items.map(item => {
                                    const dom = DOMAINS.find(d => d.id === item.domain);
                                    return (
                                        <div key={item.id} className="p-4 hover:bg-slate-50 transition-colors flex flex-col md:flex-row gap-4 border border-transparent hover:border-slate-100 rounded-xl m-1">
                                            <div className="flex-1 space-y-3">
                                                <div className="flex items-center gap-3">
                                                    <span className="px-2 py-0.5 rounded text-[10px] font-bold tracking-widest uppercase" style={{ backgroundColor: `${dom?.color}15`, color: dom?.color, border: `1px solid ${dom?.color}30` }}>
                                                        {dom?.abbr}
                                                    </span>
                                                    <span className={clsx("px-2 py-0.5 rounded text-[10px] font-bold uppercase",
                                                        item.stage === 'Complete' ? "bg-emerald-50 text-emerald-700" :
                                                            item.stage === 'In Progress' ? "bg-amber-50 text-amber-700" :
                                                                "bg-slate-100 text-slate-600"
                                                    )}>
                                                        {item.stage}
                                                    </span>
                                                </div>
                                                <p className="text-sm font-medium text-slate-800 leading-relaxed mb-1">
                                                    {stripMarkdown(item.req)}
                                                </p>
                                                <div className="flex items-center gap-2 text-xs font-semibold text-indigo-700 bg-indigo-50 px-3 py-1.5 rounded-lg border border-indigo-100 inline-flex">
                                                    <ScanSearch className="w-3.5 h-3.5 text-indigo-500 shrink-0" /> Auto-Alert: {stripMarkdown(item.auto)}
                                                </div>
                                            </div>

                                            <div className="md:w-64 shrink-0 mt-2 md:mt-0 flex flex-col justify-between">
                                                <div>
                                                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Trigger</p>
                                                    <p className="text-xs text-slate-700 mb-3">{stripMarkdown(item.trigger)}</p>
                                                </div>
                                                <Link to="/compliance/tracker" className="text-center w-full block text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 hover:text-slate-900 border border-slate-200 px-3 py-2 rounded-lg transition-colors">
                                                    View in Tracker →
                                                </Link>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
