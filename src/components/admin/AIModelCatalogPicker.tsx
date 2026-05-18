// Searchable dropdown over the live OpenRouter catalog.
// Renders inside AIModelEditModal. On select, the parent reads the
// CatalogEntry and autofills the modal's modelString / label / group /
// meta fields.
//
// Resilient by design: if the admin catalog endpoint fails (rare — usually
// OpenRouter being down), we surface a small hardcoded curated list so
// the admin can still add an entry without being blocked. The curated
// fallback is intentionally tiny — the live catalog is the primary path.

import React, { useEffect, useMemo, useState } from 'react';
import { Loader2, RefreshCw, Search } from 'lucide-react';
import { api } from '../../lib/api';

export interface CatalogEntry {
    id: string;
    name: string;
    provider: string;
    contextLength: number;
    promptCostUsdPer1M: number;
    completionCostUsdPer1M: number;
    isFree: boolean;
}

interface Props {
    onSelect: (entry: CatalogEntry) => void;
    selectedModelString?: string | null;
}

// Small offline fallback. Only used when the live catalog endpoint fails.
// These are well-known ids that have existed on OpenRouter for a long time.
const OFFLINE_FALLBACK: CatalogEntry[] = [
    {
        id: 'deepseek/deepseek-v4-flash:free',
        name: 'DeepSeek V4 Flash (free)',
        provider: 'deepseek',
        contextLength: 1_000_000,
        promptCostUsdPer1M: 0,
        completionCostUsdPer1M: 0,
        isFree: true,
    },
    {
        id: 'openai/gpt-oss-20b:free',
        name: 'OpenAI GPT-OSS 20B (free)',
        provider: 'openai',
        contextLength: 131_072,
        promptCostUsdPer1M: 0,
        completionCostUsdPer1M: 0,
        isFree: true,
    },
    {
        id: 'openai/gpt-oss-120b:free',
        name: 'OpenAI GPT-OSS 120B (free)',
        provider: 'openai',
        contextLength: 131_072,
        promptCostUsdPer1M: 0,
        completionCostUsdPer1M: 0,
        isFree: true,
    },
    {
        id: 'minimax/minimax-m2:free',
        name: 'MiniMax M2 (free)',
        provider: 'minimax',
        contextLength: 200_000,
        promptCostUsdPer1M: 0,
        completionCostUsdPer1M: 0,
        isFree: true,
    },
];

function formatContext(n: number): string {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
    if (n >= 1_000) return `${Math.round(n / 1_000)}k`;
    return String(n);
}

function formatPrice(usdPer1M: number): string {
    if (usdPer1M === 0) return '$0';
    if (usdPer1M < 0.01) return `$${usdPer1M.toFixed(4)}`;
    if (usdPer1M < 1) return `$${usdPer1M.toFixed(3)}`;
    return `$${usdPer1M.toFixed(2)}`;
}

export function AIModelCatalogPicker({ onSelect, selectedModelString }: Props) {
    const [entries, setEntries] = useState<CatalogEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [usingFallback, setUsingFallback] = useState(false);
    const [query, setQuery] = useState('');

    const fetchCatalog = async (force: boolean) => {
        setLoading(true);
        setError(null);
        try {
            const res = await api.adminGetOpenRouterCatalog({ force });
            if (Array.isArray(res?.entries) && res.entries.length > 0) {
                setEntries(res.entries);
                setUsingFallback(false);
            } else {
                setEntries(OFFLINE_FALLBACK);
                setUsingFallback(true);
            }
        } catch (e: any) {
            console.warn('[AIModelCatalogPicker] catalog fetch failed, using offline fallback:', e?.message);
            setEntries(OFFLINE_FALLBACK);
            setUsingFallback(true);
            setError(e?.message ?? 'Catalog temporarily unavailable');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchCatalog(false);
        // intentional empty deps — runs once per modal mount
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q) return entries;
        return entries.filter((e) => {
            return (
                e.id.toLowerCase().includes(q) ||
                e.name.toLowerCase().includes(q) ||
                e.provider.toLowerCase().includes(q) ||
                (q === 'free' && e.isFree)
            );
        });
    }, [entries, query]);

    return (
        <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                        type="text"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Search by provider, model, or type 'free'…"
                        className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-slate-200 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none"
                    />
                </div>
                <button
                    type="button"
                    onClick={() => fetchCatalog(true)}
                    disabled={loading}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                    title="Re-fetch the catalog from OpenRouter (bypass 60-min cache)"
                >
                    <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                    Refresh
                </button>
            </div>

            {usingFallback && (
                <div className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                    Live catalog unavailable{error ? ` (${error})` : ''}. Showing a small offline list so you can still add an entry. Press <span className="font-semibold">Refresh</span> to try the live catalog again.
                </div>
            )}

            <div className="rounded-lg border border-slate-200 max-h-[40vh] overflow-y-auto bg-white">
                {loading ? (
                    <div className="flex items-center justify-center py-12 text-slate-400">
                        <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading catalog…
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="py-12 text-center text-sm text-slate-400">
                        No models match "{query}".
                    </div>
                ) : (
                    <ul className="divide-y divide-slate-100">
                        {filtered.map((entry) => {
                            const isSelected = entry.id === selectedModelString;
                            return (
                                <li key={entry.id}>
                                    <button
                                        type="button"
                                        onClick={() => onSelect(entry)}
                                        className={`w-full text-left px-3 py-2.5 flex items-start gap-3 hover:bg-indigo-50/50 transition-colors ${isSelected ? 'bg-indigo-50' : ''}`}
                                    >
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <span className="font-medium text-sm text-slate-800 truncate">{entry.name}</span>
                                                {entry.isFree && (
                                                    <span className="px-1.5 py-[1px] text-[9px] font-semibold rounded-full bg-emerald-50 text-emerald-700">
                                                        FREE
                                                    </span>
                                                )}
                                            </div>
                                            <div className="text-[11px] text-slate-500 mt-0.5 truncate">
                                                <span className="font-mono">{entry.id}</span>
                                            </div>
                                            <div className="text-[11px] text-slate-500 mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
                                                <span>{formatContext(entry.contextLength)} ctx</span>
                                                <span>
                                                    {formatPrice(entry.promptCostUsdPer1M)} / {formatPrice(entry.completionCostUsdPer1M)} per 1M tokens
                                                </span>
                                            </div>
                                        </div>
                                    </button>
                                </li>
                            );
                        })}
                    </ul>
                )}
            </div>
        </div>
    );
}
