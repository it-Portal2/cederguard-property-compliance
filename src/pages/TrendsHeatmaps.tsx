import { TrendingUp } from 'lucide-react';
import { useMemo } from 'react';
import { useStore } from '../store/useStore';

const WORKSTREAMS = ['Building Safety', 'Finance', 'Procurement', 'Planning', 'Health & Safety', 'Technical', 'Legal'];

function cellColor(score: number) {
    if (score >= 16) return 'bg-red-900 text-white';
    if (score >= 12) return 'bg-red-200 text-red-900';
    if (score >= 9) return 'bg-orange-200 text-orange-900';
    if (score >= 6) return 'bg-yellow-100 text-yellow-800';
    return 'bg-emerald-100 text-emerald-800';
}

export function TrendsHeatmaps() {
    const { risks } = useStore();
    const safeRisks = Array.isArray(risks) ? risks : [];

    // Build workstream → max risk score map from real risk data
    const heatmapData = useMemo(() => {
        return WORKSTREAMS.map(ws => {
            const wsRisks = safeRisks.filter(r =>
                r.workstream && r.workstream.toLowerCase().includes(ws.toLowerCase())
            );
            const score = wsRisks.length > 0
                ? Math.max(...wsRisks.map(r => r.grossRating || 0))
                : 0;
            return { ws, score, count: wsRisks.length };
        });
    }, [safeRisks]);

    // Risk category breakdown from real data
    const categoryBreakdown = useMemo(() => {
        const counts: Record<string, number> = {};
        safeRisks.forEach(r => {
            const cat = r.category || 'Uncategorised';
            counts[cat] = (counts[cat] || 0) + 1;
        });
        return Object.entries(counts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 6);
    }, [safeRisks]);

    const highRisks = safeRisks.filter(r => r.grossRating >= 16).length;
    const openRisks = safeRisks.filter(r => r.status === 'Open').length;
    const totalRisks = safeRisks.length;

    return (
        <div className="space-y-6">
            <div className="bg-white p-6 md:p-8 rounded-[1.5rem] md:rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden relative group">
                {/* Decoration */}
                <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-50 rounded-full blur-3xl -mr-32 -mt-32 opacity-50 group-hover:scale-110 transition-transform duration-1000" />
                
                <div className="relative">
                    <h1 className="text-2xl md:text-3xl font-black text-slate-900 flex items-center gap-3 tracking-tight">
                        <div className="p-2 bg-indigo-600 rounded-xl shadow-lg shadow-indigo-200">
                            <TrendingUp className="w-5 h-5 md:w-6 md:h-6 text-white" />
                        </div>
                        Trends & Heatmaps
                    </h1>
                    <p className="text-sm text-slate-500 mt-2 font-medium leading-relaxed max-w-2xl italic">
                        Enterprise risk intelligence overview across strategic workstreams. Aggregate heatmaps driven by live field data.
                    </p>
                </div>
            </div>

            {/* Summary tiles */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 md:gap-6">
                <div className="bg-white border-b-4 md:border-t-4 md:border-b-0 border-red-500 border border-slate-200 rounded-[1.5rem] p-5 md:p-6 shadow-sm hover:shadow-md transition-shadow">
                    <div className="text-3xl md:text-4xl font-black text-red-600 tabular-nums tracking-tighter">{highRisks}</div>
                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-2">Severe Risks (≥16)</div>
                </div>
                <div className="bg-white border-b-4 md:border-t-4 md:border-b-0 border-amber-500 border border-slate-200 rounded-[1.5rem] p-5 md:p-6 shadow-sm hover:shadow-md transition-shadow">
                    <div className="text-3xl md:text-4xl font-black text-amber-600 tabular-nums tracking-tighter">{openRisks}</div>
                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-2">Open Risks</div>
                </div>
                <div className="bg-white border-b-4 md:border-t-4 md:border-b-0 border-indigo-500 border border-slate-200 rounded-[1.5rem] p-5 md:p-6 shadow-sm hover:shadow-md transition-shadow">
                    <div className="text-3xl md:text-4xl font-black text-indigo-600 tabular-nums tracking-tighter">{totalRisks}</div>
                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-2">Total Risks</div>
                </div>
            </div>

            {/* Workstream Heatmap */}
            <div className="bg-white rounded-[1.5rem] md:rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden">
                <div className="px-6 md:px-8 py-4 md:py-5 border-b border-slate-100 flex items-center justify-between">
                    <span className="font-black text-slate-900 text-xs md:text-sm uppercase tracking-widest">Risk Heatmap — By Workstream</span>
                    <span className="hidden md:inline text-[10px] font-bold text-indigo-500 uppercase tracking-tighter bg-indigo-50 px-3 py-1 rounded-full">Live Analytics Layer</span>
                </div>
                <div className="p-6 md:p-10">
                    {totalRisks === 0 ? (
                        <p className="text-slate-400 text-sm text-center py-6">No risk data yet. Add risks in the Risk Register to populate this heatmap.</p>
                    ) : (
                        <div className="space-y-4">
                            {heatmapData.map(row => (
                                <div key={row.ws} className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-6 group">
                                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.15em] sm:w-40 flex-shrink-0 group-hover:text-slate-900 transition-colors truncate" title={row.ws}>{row.ws}</span>
                                    <div className="flex-1 flex items-center gap-3">
                                        <div className="flex-1 bg-slate-50 rounded-lg overflow-hidden h-8 ring-1 ring-slate-100 group-hover:ring-indigo-100 transition-all">
                                            <div
                                                className={`h-full flex items-center justify-center text-[10px] font-black transition-all ${cellColor(row.score)}`}
                                                style={{ width: row.score > 0 ? `${(row.score / 25) * 100}%` : '4%', minWidth: '1.5rem' }}
                                            >
                                                {row.score > 0 ? row.score : ''}
                                            </div>
                                        </div>
                                        <span className="text-[10px] font-bold text-slate-400 tabular-nums w-12 text-right">{row.count} risk{row.count !== 1 ? 's' : ''}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    <div className="flex flex-wrap items-center gap-3 mt-10 p-5 bg-slate-50 rounded-2xl border border-slate-100">
                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest mr-2">Score Legend:</span>
                        {[
                            ['bg-emerald-100 text-emerald-800 border-emerald-200', '1-5 Low'],
                            ['bg-yellow-100 text-yellow-800 border-yellow-200', '6-8 Minor'],
                            ['bg-orange-200 text-orange-900 border-orange-300', '9-11 Moderate'],
                            ['bg-red-200 text-red-900 border-red-300', '12-15 Major'],
                            ['bg-red-900 text-white border-red-950', '16-25 Severe']
                        ].map(([cls, label]) => (
                            <span key={label} className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest border transition-transform hover:scale-105 ${cls}`}>{label}</span>
                        ))}
                    </div>
                </div>
            </div>

            {/* Category breakdown */}
            {categoryBreakdown.length > 0 && (
                <div className="bg-white rounded-[1.5rem] md:rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden">
                    <div className="px-6 md:px-8 py-4 md:py-5 border-b border-slate-100">
                        <span className="font-black text-slate-900 text-xs md:text-sm uppercase tracking-widest">Risk Category Density</span>
                    </div>
                    <div className="p-6 md:p-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {categoryBreakdown.map(([cat, count]) => (
                            <div key={cat} className="group flex items-center justify-between bg-slate-50 hover:bg-white hover:ring-2 hover:ring-indigo-500/10 rounded-2xl px-5 py-4 transition-all duration-300 border border-transparent hover:border-slate-100 shadow-sm hover:shadow-indigo-500/5">
                                <span className="text-[11px] font-black text-slate-600 uppercase tracking-widest group-hover:text-slate-900 truncate mr-4" title={cat}>{cat}</span>
                                <div className="flex items-center gap-3">
                                    <div className="h-1 w-8 bg-indigo-100 rounded-full overflow-hidden">
                                        <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${Math.min(100, (count / totalRisks) * 100)}%` }} />
                                    </div>
                                    <span className="text-lg font-black text-indigo-600 tabular-nums">{count}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
