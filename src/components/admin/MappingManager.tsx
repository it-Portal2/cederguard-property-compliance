import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Edit2, Save, X, Briefcase, AlertCircle, CheckCircle2, Loader2, Play, ScanSearch } from 'lucide-react';
import { api } from '../../lib/api';

interface Mapping {
    id?: string;
    description: string;
    directive: string;
    createdAt?: string;
    updatedAt?: string;
}

export function MappingManager() {
    const [mappings, setMappings] = useState<Mapping[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState<string | null>(null);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [newMapping, setNewMapping] = useState<Partial<Mapping> | null>(null);
    const [error, setError] = useState<string | null>(null);

    // Sandbox state
    const [testPrompt, setTestPrompt] = useState('Suggest compliance items for a Social Housing New Build project with 20 storeys and Social Rent tenure.');
    const [testResult, setTestResult] = useState<string | null>(null);
    const [testing, setTesting] = useState(false);

    const load = async () => {
        setLoading(true);
        try {
            const res = await api.adminGetMappings();
            if (res.success) setMappings(res.mappings || []);
            else setError(res.error);
        } catch (e: any) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); }, []);

    const handleSave = async (m: Partial<Mapping>) => {
        setSaving(m.id || 'new');
        try {
            const res = await api.adminSaveMapping(m);
            if (res.success) {
                await load();
                setEditingId(null);
                setNewMapping(null);
            } else {
                setError(res.error || 'Failed to save mapping.');
            }
        } catch (e: any) {
            setError(e.message);
        } finally {
            setSaving(null);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this mapping?')) return;
        try {
            const res = await api.adminDeleteMapping(id);
            if (res.success) setMappings(prev => prev.filter(m => m.id !== id));
        } catch (e: any) {
            setError('Failed to delete mapping: ' + e.message);
        }
    };

    const runTest = async () => {
        setTesting(true);
        setTestResult(null);
        try {
            // Updated to use the actual analyzeCompliance simulation or just a generic prompt that mentions the directives
            const directives = mappings.map(m => m.directive).join('\n\n');
            const fullPrompt = `DIRECTIVES:\n${directives}\n\nUSER PROMPT:\n${testPrompt}\n\nPlease follow the directives and respond as the system would.`;
            const res = await api.testGemini(fullPrompt);
            if (res.success) setTestResult(res.result);
            else setTestResult('Error: ' + res.error);
        } catch (e: any) {
            setTestResult('Error: ' + e.message);
        } finally {
            setTesting(false);
        }
    };

    if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-indigo-500" /></div>;

    return (
        <div className="space-y-8">
            <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl flex items-start gap-3">
                <Briefcase className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div>
                    <h3 className="text-sm font-bold text-amber-900">Expert Instruction Mappings</h3>
                    <p className="text-xs text-amber-700 mt-1 leading-relaxed">
                        Define global directives that the AI engine must follow when analyzing projects.
                        Use these to enforce specific regulations based on project properties (tenure, height, location, etc.).
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Mappings List */}
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <h3 className="font-bold text-slate-800 flex items-center gap-2">
                            <Plus className="w-4 h-4" /> Active Directives
                        </h3>
                        <button
                            onClick={() => setNewMapping({ description: '', directive: '' })}
                            className="text-xs bg-indigo-600 text-white px-3 py-1.5 rounded-lg font-bold hover:bg-indigo-700 transition-colors"
                        >
                            Add New Directive
                        </button>
                    </div>

                    <div className="space-y-3">
                        {newMapping && (
                            <div className="bg-white border-2 border-indigo-200 p-4 rounded-xl shadow-md space-y-3">
                                <input
                                    className="w-full text-sm font-bold border-b border-indigo-100 pb-2 focus:outline-none"
                                    placeholder="Brief Description (e.g. Social Rent Directive)"
                                    value={newMapping.description}
                                    onChange={e => setNewMapping({ ...newMapping, description: e.target.value })}
                                />
                                <textarea
                                    className="w-full text-xs text-slate-600 bg-slate-50 p-3 rounded-lg min-h-[100px] focus:outline-none focus:ring-1 focus:ring-indigo-300"
                                    placeholder="Instruction for the AI... (e.g. If project.tenure === 'Social Rent', ensure you include Item XYZ)"
                                    value={newMapping.directive}
                                    onChange={e => setNewMapping({ ...newMapping, directive: e.target.value })}
                                />
                                <div className="flex justify-end gap-2 pt-2">
                                    <button onClick={() => setNewMapping(null)} className="p-1.5 text-slate-400 hover:text-slate-600"><X className="w-4 h-4" /></button>
                                    <button
                                        onClick={() => handleSave(newMapping)}
                                        disabled={saving === 'new'}
                                        className="bg-indigo-600 text-white px-4 py-1.5 rounded-lg text-xs font-bold flex items-center gap-2"
                                    >
                                        {saving === 'new' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                                        Save Directive
                                    </button>
                                </div>
                            </div>
                        )}

                        {mappings.map(m => (
                            <div key={m.id} className="bg-white border border-slate-200 p-4 rounded-xl shadow-sm group hover:border-indigo-300 transition-colors">
                                {editingId === m.id ? (
                                    <div className="space-y-3">
                                        <input
                                            className="w-full text-sm font-bold border-b border-indigo-100 pb-2 focus:outline-none"
                                            value={m.description}
                                            onChange={e => setMappings(prev => prev.map(item => item.id === m.id ? { ...item, description: e.target.value } : item))}
                                        />
                                        <textarea
                                            className="w-full text-xs text-slate-600 bg-slate-50 p-3 rounded-lg min-h-[100px] focus:outline-none focus:ring-1 focus:ring-indigo-300"
                                            value={m.directive}
                                            onChange={e => setMappings(prev => prev.map(item => item.id === m.id ? { ...item, directive: e.target.value } : item))}
                                        />
                                        <div className="flex justify-end gap-2 pt-2">
                                            <button onClick={() => setEditingId(null)} className="p-1.5 text-slate-400 hover:text-slate-600"><X className="w-4 h-4" /></button>
                                            <button
                                                onClick={() => handleSave(m)}
                                                disabled={saving === m.id}
                                                className="bg-indigo-600 text-white px-4 py-1.5 rounded-lg text-xs font-bold flex items-center gap-2"
                                            >
                                                {saving === m.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                                                Save Updates
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="relative">
                                        <div className="flex items-start justify-between">
                                            <div>
                                                <h4 className="text-sm font-bold text-slate-800">{m.description}</h4>
                                                <p className="text-xs text-slate-500 mt-0.5 italic">Updated {m.updatedAt ? new Date(m.updatedAt).toLocaleDateString() : 'recently'}</p>
                                            </div>
                                            <div className="flex items-center gap-1 opacity-10 group-hover:opacity-100 transition-opacity">
                                                <button onClick={() => setEditingId(m.id!)} className="p-2 hover:bg-slate-100 rounded-lg text-slate-500"><Edit2 className="w-3.5 h-3.5" /></button>
                                                <button onClick={() => handleDelete(m.id!)} className="p-2 hover:bg-red-50 rounded-lg text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>
                                            </div>
                                        </div>
                                        <p className="text-xs text-slate-600 mt-3 line-clamp-3 bg-slate-50 p-2 rounded-lg border border-slate-100 whitespace-pre-wrap">
                                            {m.directive}
                                        </p>
                                    </div>
                                )}
                            </div>
                        ))}

                        {mappings.length === 0 && !newMapping && (
                            <div className="text-center py-12 border-2 border-dashed border-slate-200 rounded-2xl">
                                <ScanSearch className="w-5 h-5 text-indigo-400 mx-auto mb-2" />
                                <p className="text-sm text-slate-400">No directives defined yet.</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* AI Sandbox */}
                <div className="space-y-4">
                    <h3 className="font-bold text-slate-800 flex items-center gap-2">
                        <ScanSearch className="w-4 h-4" /> AI Mapping Sandbox
                    </h3>
                    <div className="bg-slate-900 rounded-2xl p-6 text-white space-y-4 shadow-xl">
                        <div className="space-y-2">
                            <label className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Simulation Prompt</label>
                            <textarea
                                className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 min-h-[80px]"
                                value={testPrompt}
                                onChange={e => setTestPrompt(e.target.value)}
                            />
                        </div>
                        <button
                            onClick={runTest}
                            disabled={testing || mappings.length === 0}
                            className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-lg shadow-indigo-900/40"
                        >
                            {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4 fill-current" />}
                            Run Simulation with Directives
                        </button>

                        <div className="space-y-2">
                            <label className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">AI Response</label>
                            <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 min-h-[150px] text-xs font-mono whitespace-pre-wrap text-slate-300 leading-relaxed overflow-y-auto max-h-[300px]">
                                {testing ? 'Analyzing...' : (testResult || 'Results will appear here. The AI will consider your mapping directives during this generation.')}
                            </div>
                        </div>
                    </div>
                    <div className="flex items-start gap-2 text-xs text-slate-500 p-2">
                        <AlertCircle className="w-4 h-4 shrink-0 text-slate-400" />
                        <p>This sandbox simulates the Project Setup AI analysis. Directives are automatically appended to the system prompt.</p>
                    </div>
                </div>
            </div>
        </div>
    );
}
