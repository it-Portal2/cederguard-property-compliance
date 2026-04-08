import { useState } from 'react';
import { Briefcase, ScanSearch, ArrowRight, CheckCircle2, ShieldCheck, AlertCircle } from 'lucide-react';
import { analyzeContextSentence } from '../services/aiService';
import { stripMarkdown } from '../lib/utils';
import { clsx } from 'clsx';

export function AIComplianceOutlook() {
    const [loading, setLoading] = useState(false);
    const [sentence, setSentence] = useState('');
    const [suggestions, setSuggestions] = useState<string[]>([]);
    const [error, setError] = useState('');

    const runAnalysis = async () => {
        if (!sentence.trim()) return;
        setError('');
        setLoading(true);
        setSuggestions([]);

        try {
            const ideas = await analyzeContextSentence(sentence, 'compliance');
            setSuggestions(ideas.map(stripMarkdown));
        } catch (err: any) {
            setError(err.message || 'Failed to generate AI insights. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-4xl mx-auto space-y-6 sm:space-y-8 px-4 sm:px-0">
            <div className="flex justify-between items-end">
                <div>
                    <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2">
                        <Briefcase className="w-7 h-7 text-indigo-600" /> Compliance Posture Outlook
                    </h1>
                    <p className="text-sm text-slate-500 mt-1 font-medium">Generate statutory compliance requirements and strategic outlooks from simple descriptions.</p>
                </div>
            </div>

            <div className="bg-white border-2 border-slate-100 rounded-3xl sm:rounded-[2.5rem] p-6 sm:p-10 shadow-sm relative overflow-hidden">
                <div className="absolute top-0 right-0 p-8 sm:p-12 opacity-5">
                    <ShieldCheck className="w-32 h-32 sm:w-48 sm:h-48 text-indigo-600" />
                </div>
                
                <div className="relative z-10 max-w-2xl">
                    <h2 className="text-xl font-black text-slate-900 mb-2">Automated Compliance Identifier</h2>
                    <p className="text-sm text-slate-500 mb-8 leading-relaxed font-medium">
                        Write a short sentence about a project or programme to understand the applicable regulation or compliance ideas.
                    </p>

                    <div className="space-y-4">
                        <div className="relative">
                            <textarea
                                value={sentence}
                                onChange={(e) => setSentence(e.target.value)}
                                placeholder="e.g. We are planning a major building safety retrofit for Bermondsey Estate including fire door replacements..."
                                className="w-full h-32 p-4 sm:p-6 bg-slate-50 border-2 border-slate-100 rounded-2xl sm:rounded-3xl text-sm focus:ring-8 focus:ring-indigo-500/5 focus:border-indigo-500 transition-all resize-none font-medium text-slate-700 placeholder:text-slate-400"
                            />
                            <div className="absolute bottom-4 right-4 text-[10px] font-bold text-slate-300 uppercase tracking-widest">Natural Language Processing</div>
                        </div>

                        <button
                            onClick={runAnalysis}
                            disabled={loading || !sentence.trim()}
                            className="w-full py-4 bg-slate-900 text-white font-black rounded-2xl shadow-xl hover:bg-black disabled:opacity-50 transition-all flex items-center justify-center gap-3 transform active:scale-95"
                        >
                            {loading ? (
                                <div className="w-5 h-5 border-3 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                                <ScanSearch className="w-5 h-5 text-indigo-400" />
                            )}
                            {loading ? 'Analyzing Regulatory Frameworks...' : 'Generate Compliance Outlook'}
                        </button>
                    </div>
                </div>
            </div>

            {error && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3 animate-in fade-in">
                    <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 shrink-0" />
                    <div>
                        <h3 className="text-sm font-bold text-red-900">AI Analysis Error</h3>
                        <p className="text-xs text-red-700 mt-1">{error}</p>
                    </div>
                </div>
            )}

            {loading && (
                <div className="py-20 flex flex-col items-center justify-center text-center">
                    <div className="w-12 h-12 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin mb-6" />
                    <h3 className="text-xl font-black text-slate-900 tracking-tight">AI Compliance Identifier Engine</h3>
                    <p className="text-xs text-slate-400 font-bold tracking-[0.2em] uppercase mt-2 animate-pulse">Mapping statutory instruments to project scope</p>
                </div>
            )}

            {suggestions.length > 0 && (
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
                    <div className="flex items-center gap-2 mb-4 px-2">
                        <div className="w-2 h-2 rounded-full bg-emerald-500" />
                        <h3 className="font-black text-slate-400 uppercase tracking-widest text-[10px]">Identified Compliance Requirments</h3>
                    </div>
                    
                    <div className="grid grid-cols-1 gap-4">
                        {suggestions.map((suggestion, idx) => (
                            <div key={idx} className="group bg-white border border-slate-200 p-4 sm:p-6 rounded-2xl sm:rounded-3xl hover:border-emerald-300 hover:shadow-lg transition-all flex flex-col sm:flex-row gap-3 sm:gap-4">
                                <div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center shrink-0 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                                    <CheckCircle2 className="w-5 h-5" />
                                </div>
                                <div className="space-y-1">
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Statutory Item {idx + 1}</span>
                                    <div className="text-base font-bold text-slate-800 leading-snug space-y-2">
                                        {suggestion.includes('WHAT:') || suggestion.includes('WHO:') ? (
                                            suggestion.split(/\b(WHAT:|WHO:|WHEN:|HOW:|WHERE:|WHY:)\b/).map((part, i, arr) => {
                                                const labels = ['WHAT:', 'WHO:', 'WHEN:', 'HOW:', 'WHERE:', 'WHY:'];
                                                if (labels.includes(part)) {
                                                    return <span key={i} className="text-[10px] font-black text-indigo-500 uppercase tracking-widest block mt-3 first:mt-0">{part}</span>;
                                                }
                                                return <p key={i} className="text-sm font-bold text-slate-700 leading-relaxed inline-block">{part.trim()}</p>;
                                            })
                                        ) : (
                                            <p>{stripMarkdown(suggestion)}</p>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="mt-8 p-5 sm:p-6 bg-slate-950 rounded-2xl sm:rounded-3xl text-white flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 sm:gap-0">
                        <div>
                            <h4 className="font-black text-sm">Integrate with Compliance Tracker?</h4>
                            <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">Add these items to your formal project compliance profile</p>
                        </div>
                        <button className="w-full sm:w-auto px-5 py-3 sm:py-2.5 bg-white text-slate-900 text-xs font-black rounded-xl hover:bg-slate-100 transition-colors uppercase tracking-widest text-center">
                            Add to Tracker
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
