import { useState } from 'react';
import { ClipboardCheck, ScanSearch, CheckCircle2, AlertCircle, Play, Loader2 } from 'lucide-react';
import { useStore } from '../../../store/useStore';
import { DOMAINS } from '../../../data/complianceData';
import { analyzeComplianceProgress } from '../../../services/aiService';
import { stripMarkdown } from '../../../lib/utils';
import { resolveAiScope } from '../../../lib/aiScope';

export function AIComplianceSummary() {
    const { complianceItems, complianceAnalysis, activeProjectId, activeProgrammeId, projects, programmes } = useStore();
    const safeItems = Array.isArray(complianceItems) ? complianceItems : [];
    const aiScope = resolveAiScope({
        activeProjectId,
        activeProgrammeId,
        activeProject: (Array.isArray(projects) ? projects : []).find((p: any) => p.id === activeProjectId),
        activeProgramme: (Array.isArray(programmes) ? programmes : []).find((p: any) => p.id === activeProgrammeId),
    });
    const [generating, setGenerating] = useState(false);
    const [aiDomainSummaries, setAiDomainSummaries] = useState<any[]>([]);
    const [aiError, setAiError] = useState<string | null>(null);

    const activeDoms = DOMAINS.filter(d => safeItems.some(i => i.domain === d.id));

    const domainStats = activeDoms.map(dom => {
        const itemsInDomain = safeItems.filter(i => i.domain === dom.id);
        const completed = itemsInDomain.filter(i => i.stage === 'Complete').length;
        const isHighRisk = itemsInDomain.some(i => i.risk === 'High' && i.stage !== 'Complete');
        const isMedRisk = itemsInDomain.some(i => i.risk === 'Medium' && i.stage !== 'Complete');

        const riskLabel = isHighRisk ? 'High' : (isMedRisk ? 'Medium' : 'Low');

        let status = 'Compliant';
        const pct = itemsInDomain.length > 0 ? Math.round((completed / itemsInDomain.length) * 100) : 100;
        if (pct < 100) status = 'Action Required';
        if (isHighRisk && pct < 50) status = 'At Risk';

        return {
            domain: dom.label,
            status,
            items: itemsInDomain.length,
            completed,
            risk: riskLabel,
            pct
        };
    });

    const handleGenerate = async () => {
        if (domainStats.length === 0) return;
        setGenerating(true);
        setAiError(null);
        try {
            const result = await analyzeComplianceProgress(domainStats, aiScope);
            setAiDomainSummaries(result);
        } catch (e: any) {
            console.error("Failed to generate", e);
            setAiError(e.message || 'Failed to generate AI insights. Please try again.');
        } finally {
            setGenerating(false);
        }
    };

    const summaryText = complianceAnalysis?.summary || `Based on your compliance tracker data, your programme shows overall compliance progress across ${activeDoms.length} regulatory domains. Completing open requirements will improve your compliance posture.`;

    const fullyCompliant = domainStats.filter(i => i.status === 'Compliant').length;
    const actionRequired = domainStats.filter(i => i.status !== 'Compliant').length;

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                    <ClipboardCheck className="w-6 h-6 text-indigo-600" /> Compliance Posture Outlook
                </h1>
                <p className="text-sm text-slate-500 mt-1">Algorithmic overview of regulatory compliance posture across active statutory domains</p>
            </div>

            <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4 flex justify-between items-center gap-3">
                <div className="flex items-start gap-3">
                <ScanSearch className="w-5 h-5 text-indigo-600 flex-shrink-0 mt-0.5" />
                    <div>
                        <p className="text-indigo-900 font-medium text-sm">
                            {stripMarkdown(summaryText)}
                        </p>
                        <p className="text-indigo-700 mt-1 text-xs">
                            Run AI analysis to generate a specific, single-sentence strategic insight for each regulatory domain.
                        </p>
                    </div>
                </div>
                <button
                    onClick={handleGenerate}
                    disabled={generating || domainStats.length === 0}
                    className="shrink-0 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-colors"
                >
                    {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                    Analyze Domains
                </button>
            </div>

            {aiError && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3 animate-in fade-in">
                    <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 shrink-0" />
                    <div>
                        <h3 className="text-sm font-bold text-red-900">AI Analysis Error</h3>
                        <p className="text-xs text-red-700 mt-1">{aiError}</p>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-3 gap-4">
                {[
                    { label: 'Regulatory Domains', value: domainStats.length, color: 'text-indigo-600', border: 'border-l-indigo-500' },
                    { label: 'Fully Compliant', value: fullyCompliant, color: 'text-emerald-600', border: 'border-l-emerald-500' },
                    { label: 'Action Required', value: actionRequired, color: 'text-red-600', border: 'border-l-red-500' },
                ].map(s => (
                    <div key={s.label} className={`bg-white rounded-lg border border-slate-200 border-l-4 ${s.border} p-4 shadow-sm`}>
                        <div className={`text-3xl font-extrabold ${s.color}`}>{s.value}</div>
                        <div className="font-mono text-xs text-slate-500 font-semibold uppercase tracking-wider mt-1">{s.label}</div>
                    </div>
                ))}
            </div>

            <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
                <div className="px-5 py-3 border-b border-slate-100">
                    <span className="font-semibold text-slate-700 text-sm">Compliance Summary by Regulatory Domain</span>
                </div>
                <div className="divide-y divide-slate-100">
                    {domainStats.length === 0 && (
                        <div className="p-8 text-center text-slate-500">
                            No compliance data available. Please set up your project first.
                        </div>
                    )}
                    {domainStats.map(item => {
                        const pct = item.pct;
                        const aiSummary = aiDomainSummaries.find(s => s.domain === item.domain)?.summary;
                        return (
                            <div key={item.domain} className="px-5 py-4">
                                <div className="flex items-center justify-between mb-2">
                                    <div>
                                        <span className="font-semibold text-slate-800 text-sm">{item.domain}</span>
                                        <span className="ml-2 text-slate-400 text-xs">{item.completed}/{item.items} items</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className={`flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold border ${item.status === 'Compliant' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                                            item.status === 'At Risk' ? 'bg-orange-50 text-orange-700 border-orange-200' :
                                                'bg-red-50 text-red-700 border-red-200'}`}>
                                            {item.status === 'Compliant' ? <CheckCircle2 className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
                                            {item.status}
                                        </span>
                                        <span className={`px-2 py-0.5 rounded text-xs font-bold border ${item.risk === 'Low' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                                            item.risk === 'Medium' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                                                'bg-red-50 text-red-700 border-red-200'}`}>{item.risk} Risk</span>
                                    </div>
                                </div>
                                <div className="h-2 bg-slate-100 rounded-full overflow-hidden mt-1 mb-2">
                                    <div className={`h-full rounded-full transition-all ${pct >= 90 ? 'bg-emerald-500' : pct >= 70 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${pct}%` }} />
                                </div>
                                <div className="flex justify-between items-start">
                                    <div className="text-xs text-slate-400">{pct}% complete</div>
                                    {aiSummary && (
                                        <div className="text-xs text-indigo-700 font-medium bg-indigo-50 px-2 py-1 rounded max-w-xl text-right">
                                            {stripMarkdown(aiSummary)}
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
