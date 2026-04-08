import { useState } from 'react';
import { ShieldAlert, ShieldPlus, Play, CheckCircle2, ScanSearch, Plus, ArrowRight } from 'lucide-react';
import { useStore } from '../store/useStore';
import { analyzeControls, analyzeContextSentence } from '../services/aiService';
import { clsx } from 'clsx';
import { stripMarkdown, parseAISuggestion } from '../lib/utils';

export function AIControlSuggestions() {
    const { risks, updateRisk } = useStore();
    const [loading, setLoading] = useState(false);
    const [suggestedControls, setSuggestedControls] = useState<any[]>([]);
    const [manualSentence, setManualSentence] = useState('');
    const [manualIdeas, setManualIdeas] = useState<string[]>([]);
    const [error, setError] = useState('');

    const highRisks = risks.filter(r => r.status === 'Open' && (r.residualRating || 0) >= 12);

    const runAutomatedAnalysis = async () => {
        if (highRisks.length === 0) {
            setError('No high-rated open risks to analyze.');
            return;
        }
        setError('');
        setLoading(true);
        setManualIdeas([]);

        try {
            const suggestions = await analyzeControls(highRisks);
            setSuggestedControls(suggestions);
        } catch (err: any) {
            setError(err.message || 'Failed to generate AI insights. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const runManualAnalysis = async () => {
        if (!manualSentence.trim()) return;
        setError('');
        setLoading(true);
        setSuggestedControls([]);

        try {
            const ideas = await analyzeContextSentence(manualSentence, 'risk');
            setManualIdeas(ideas);
        } catch (err: any) {
            setError(err.message || 'Failed to generate AI insights. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const addControl = (riskId: string, suggestion: string) => {
        const risk = risks.find(r => r.id === riskId);
        if (risk) {
            const newControls = risk.controls && risk.controls !== 'None' ? `${risk.controls}\n- ${suggestion}` : `- ${suggestion}`;
            updateRisk(riskId, { controls: newControls });

            setSuggestedControls(prev => prev.map(sc =>
                sc.riskId === riskId
                    ? { ...sc, suggestions: sc.suggestions.filter((s: string) => s !== suggestion) }
                    : sc
            ).filter(sc => sc.suggestions.length > 0)); 
        }
    };

    return (
        <div className="max-w-5xl mx-auto space-y-8">
            <div className="flex justify-between items-end">
                <div>
                    <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2">
                        <ShieldAlert className="w-7 h-7 text-indigo-600" /> Mitigation & Control Strategy
                    </h1>
                    <p className="text-sm text-slate-500 mt-1 font-medium">Generate industrial-grade mitigation strategies for your project risk profile.</p>
                </div>
            </div>

            {error && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3 animate-in fade-in">
                    <ShieldAlert className="w-5 h-5 text-red-600 mt-0.5 shrink-0" />
                    <div>
                        <h3 className="text-sm font-bold text-red-900">AI Analysis Error</h3>
                        <p className="text-xs text-red-700 mt-1">{error}</p>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Manual Idea Generator per PDF */}
                <div className="bg-white border-2 border-slate-100 rounded-3xl p-6 shadow-sm hover:shadow-md transition-all">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="bg-indigo-50 p-2.5 rounded-2xl">
                            <ScanSearch className="w-5 h-5 text-indigo-600" />
                        </div>
                        <h2 className="font-black text-slate-800 tracking-tight">AI Idea Generator</h2>
                    </div>
                    <p className="text-xs text-slate-500 mb-4 leading-relaxed font-medium">
                        Describe a specific concern or situation in a sentence to generate targeted mitigation controls.
                    </p>
                    <div className="space-y-3">
                        <textarea
                            value={manualSentence}
                            onChange={(e) => setManualSentence(e.target.value)}
                            placeholder="e.g. We are concerned about potential delays in the S20 consultation process for the Bermondsey Estate..."
                            className="w-full h-24 p-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all resize-none font-medium text-slate-700"
                        />
                        <button
                            onClick={runManualAnalysis}
                            disabled={loading || !manualSentence.trim()}
                            className="w-full py-3 bg-indigo-600 text-white text-sm font-black rounded-xl shadow-lg hover:bg-indigo-700 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
                        >
                            {loading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <ArrowRight className="w-4 h-4" />}
                            Generate Ideas
                        </button>
                    </div>
                </div>

                {/* Automated Programme Analysis per PDF */}
                <div className="bg-slate-900 rounded-3xl p-7 text-white shadow-xl relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-20 transition-opacity">
                        <ShieldAlert className="w-32 h-32" />
                    </div>
                    <div className="relative z-10 flex flex-col h-full">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="bg-white/10 p-2.5 rounded-2xl">
                                <Play className="w-5 h-5 text-white" />
                            </div>
                            <h2 className="font-extrabold text-white tracking-tight">Programme Auto-Analysis</h2>
                        </div>
                        <p className="text-xs text-slate-400 mb-8 leading-relaxed font-medium">
                            The system will automatically evaluate <span className="text-white font-bold">{highRisks.length} high-rated open risks</span> across this portfolio and formulate specific mitigation tactics.
                        </p>
                        <div className="mt-auto">
                            <button
                                onClick={runAutomatedAnalysis}
                                disabled={loading || highRisks.length === 0}
                                className="w-full py-3 bg-white text-slate-900 text-sm font-black rounded-xl shadow-lg hover:bg-slate-50 disabled:opacity-40 transition-all"
                            >
                                {highRisks.length === 0 ? 'No High Risks to Analyse' : 'Run Full Analysis'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {loading && (
                <div className="py-12 flex flex-col items-center justify-center text-center">
                    <div className="w-10 h-10 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin mb-4" />
                    <h3 className="text-lg font-black text-slate-800">Intelligence engine active...</h3>
                    <p className="text-xs text-slate-500 font-bold tracking-widest uppercase mt-1 animate-pulse">Formulating statutory mitigation strategies</p>
                </div>
            )}

            {manualIdeas.length > 0 && (
                <div className="bg-white border border-slate-200 rounded-3xl p-8 shadow-sm">
                    <div className="flex items-center gap-3 mb-6">
                        <CheckCircle2 className="w-6 h-6 text-emerald-500" />
                        <h3 className="font-black text-slate-900 tracking-tight text-lg">AI Mitigation Ideas</h3>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {manualIdeas.map((idea, idx) => (
                            <div key={idx} className="p-4 bg-slate-50 border border-slate-100 rounded-2xl group hover:border-indigo-200 transition-all">
                                <span className="text-[10px] font-black text-indigo-500 uppercase tracking-widest mb-2 block">Strategy {idx + 1}</span>
                                <div className="space-y-3">
                                    {parseAISuggestion(idea).map((part, pIdx) => (
                                        <div key={pIdx} className="space-y-0.5">
                                            {part.label && (
                                                <span className="text-[9px] font-black text-indigo-400 uppercase tracking-widest block">
                                                    {part.label}
                                                </span>
                                            )}
                                            <p className="text-sm font-medium text-slate-700 leading-relaxed">
                                                {stripMarkdown(part.content)}
                                            </p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                    <p className="mt-6 text-[10px] text-slate-400 font-bold uppercase tracking-widest text-center">These ideas can be used to update existing risks in the Register</p>
                </div>
            )}

            {suggestedControls.length > 0 && (
                <div className="space-y-4">
                    <div className="flex items-center gap-2 mb-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-indigo-600" />
                        <h3 className="font-black text-slate-400 uppercase tracking-widest text-[10px]">Automated Results ({suggestedControls.length} Risks)</h3>
                    </div>
                    <div className="grid grid-cols-1 gap-4">
                        {suggestedControls.map((item, i) => {
                            const riskDoc = risks.find(r => r.id === item.riskId);
                            if (!riskDoc) return null;
                            const rating = riskDoc.residualRating || 0;

                            return (
                                <div key={i} className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden group hover:border-indigo-200 transition-all">
                                    <div className="px-6 py-4 bg-slate-50/50 border-b border-slate-100 flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className={clsx("w-2 h-2 rounded-full", rating >= 16 ? "bg-red-600" : "bg-orange-500")} />
                                            <div className="font-black text-slate-800 text-sm tracking-tight">{riskDoc.title}</div>
                                        </div>
                                        <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Residual: {rating}</span>
                                    </div>
                                    <div className="p-6">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                            {item.suggestions.map((s: string, j: number) => (
                                                <div key={j} className="flex flex-col gap-2 p-4 bg-white border border-slate-100 rounded-2xl hover:bg-slate-50 transition-all relative group/item">
                                                    <div className="space-y-3 pr-8">
                                                        {parseAISuggestion(s).map((part, pIdx) => (
                                                            <div key={pIdx} className="space-y-0.5">
                                                                {part.label && (
                                                                    <span className="text-[9px] font-black text-indigo-400 uppercase tracking-widest block">
                                                                        {part.label}
                                                                    </span>
                                                                )}
                                                                <p className="text-xs font-bold text-slate-700 leading-relaxed">
                                                                    {stripMarkdown(part.content)}
                                                                </p>
                                                            </div>
                                                        ))}
                                                    </div>
                                                    <button
                                                        onClick={() => addControl(item.riskId, s)}
                                                        className="absolute top-4 right-4 p-1.5 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-600 hover:text-white transition-all shadow-sm opacity-0 group-hover/item:opacity-100"
                                                        title="Add to risk"
                                                    >
                                                        <Plus className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}

