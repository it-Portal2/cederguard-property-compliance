// AI Models admin tab. Super-admin only.
//
// Two tables — chat dropdown lineup + priority-ordered operation models —
// editable inline (enable/disable, default toggle, reorder, delete) and via
// a shared add/edit modal that pulls live entries from OpenRouter's
// catalog. Save flows the whole config through the validator, then writes
// to Firestore.

import React, { useEffect, useMemo, useState } from 'react';
import {
    Loader2,
    Plus,
    Pencil,
    Trash2,
    ArrowUp,
    ArrowDown,
    Save,
    RotateCcw,
    Lock,
    AlertCircle,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '../../lib/api';
import { AIModelEditModal, type EditableEntry, type ModalKind } from './AIModelEditModal';

// Local type mirror — keeps the tab self-contained without a deep import
// into api/lib types from the frontend bundle.
interface ChatModelEntry {
    id: string;
    label: string;
    group: 'premium' | 'default' | 'free';
    backend: 'openrouter';
    modelString: string;
    enabled: boolean;
    isDefault: boolean;
    meta?: {
        contextLength: number;
        promptCostUsdPer1M: number;
        completionCostUsdPer1M: number;
        isFree: boolean;
    };
}

interface OperationModelEntry {
    id: string;
    label: string;
    backend: 'openrouter';
    modelString: string;
    enabled: boolean;
    meta?: ChatModelEntry['meta'];
}

interface AIModelConfig {
    chatModels: ChatModelEntry[];
    operationModels: OperationModelEntry[];
    updatedAt?: any;
    updatedBy?: string;        // raw uid — internal identifier
    updatedByEmail?: string;   // human label, preferred for display
}

interface Props {
    isAdmin: boolean;
}

// Mirrors api/lib/aiModelConfig.ts validateAIModelConfig. Frontend pre-check
// so admin sees errors inline before submitting; server is still the source
// of truth and will reject anything the client lets through.
const MODEL_STRING_PATTERN = /^[a-z0-9-]+\/[a-z0-9.\-_:]+$/;
function clientValidate(cfg: AIModelConfig): string[] {
    const errors: string[] = [];
    if (cfg.chatModels.length > 20) errors.push('Chat models list capped at 20 entries.');
    if (cfg.operationModels.length > 20) errors.push('Operation models list capped at 20 entries.');
    const seenChat = new Set<string>();
    let defaultCount = 0;
    for (const e of cfg.chatModels) {
        if (seenChat.has(e.id)) errors.push(`Duplicate chat id "${e.id}".`);
        seenChat.add(e.id);
        if (!MODEL_STRING_PATTERN.test(e.modelString)) errors.push(`Chat "${e.label}": invalid model string.`);
        if (e.backend !== 'openrouter') errors.push(`Chat "${e.label}": backend must be openrouter.`);
        if (e.isDefault && e.enabled) defaultCount++;
    }
    if (defaultCount !== 1) errors.push(`Exactly one chat row must be enabled + default (found ${defaultCount}).`);
    const seenOp = new Set<string>();
    for (const e of cfg.operationModels) {
        if (seenOp.has(e.id)) errors.push(`Duplicate operation id "${e.id}".`);
        seenOp.add(e.id);
        if (!MODEL_STRING_PATTERN.test(e.modelString)) errors.push(`Operation "${e.label}": invalid model string.`);
        if (e.backend !== 'openrouter') errors.push(`Operation "${e.label}": backend must be openrouter.`);
    }
    return errors;
}

const GROUP_BADGE: Record<ChatModelEntry['group'], string> = {
    premium: 'bg-violet-50 text-violet-700',
    default: 'bg-slate-100 text-slate-700',
    free: 'bg-emerald-50 text-emerald-700',
};

// Firestore serialises Timestamp as either a real Timestamp or { _seconds,
// _nanoseconds } depending on which SDK serialised it (Admin vs Web). Accept
// both. Returns "" when the input isn't recognisable so the footer renders
// the "Last updated by X" line without a trailing " · " marker.
function formatUpdatedAt(raw: any): string {
    if (!raw) return '';
    let ms: number | null = null;
    if (typeof raw === 'string') {
        const d = new Date(raw);
        if (!isNaN(d.getTime())) ms = d.getTime();
    } else if (typeof raw?.toMillis === 'function') {
        ms = raw.toMillis();
    } else if (typeof raw?._seconds === 'number') {
        ms = raw._seconds * 1000 + Math.floor((raw._nanoseconds ?? 0) / 1e6);
    } else if (typeof raw?.seconds === 'number') {
        ms = raw.seconds * 1000 + Math.floor((raw.nanoseconds ?? 0) / 1e6);
    } else if (typeof raw === 'number') {
        ms = raw;
    }
    if (ms === null) return '';
    const d = new Date(ms);
    return d.toLocaleString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}

export function AIModelsTab({ isAdmin }: Props) {
    const [config, setConfig] = useState<AIModelConfig | null>(null);
    const [seedReturned, setSeedReturned] = useState(false);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [dirty, setDirty] = useState(false);
    const [confirmReset, setConfirmReset] = useState(false);

    const [modal, setModal] = useState<{
        open: boolean;
        kind: ModalKind;
        index: number | null; // null = adding
    }>({ open: false, kind: 'chat', index: null });

    // Delete-confirmation modal state. We use the same backdrop/modal
    // pattern as confirmReset (no window.confirm anywhere — matches the
    // audit hard-rule from earlier work).
    const [confirmDelete, setConfirmDelete] = useState<{
        kind: 'chat' | 'operation';
        index: number;
        label: string;
    } | null>(null);

    // `silent` mode skips the full-tab loading spinner so a post-save
    // refresh (which already shows the inline "Saving…" pip on the button)
    // doesn't blank the whole tables. Only the initial mount load needs
    // the splash, because there's nothing to render yet.
    // Returns `true` on success so callers can chain follow-up toasts
    // only when the load actually completed.
    const loadConfig = async (silent = false): Promise<boolean> => {
        if (!silent) setLoading(true);
        setError(null);
        try {
            const res = await api.adminGetAIModelConfig();
            setConfig(res.config as AIModelConfig);
            setSeedReturned(!!res.seedReturned);
            setDirty(false);
            return true;
        } catch (e: any) {
            const msg = e?.message ?? 'Failed to load AI model config';
            setError(msg);
            if (silent) toast.error(msg); // initial load shows inline error; silent reload surfaces via toast
            return false;
        } finally {
            if (!silent) setLoading(false);
        }
    };

    useEffect(() => {
        if (isAdmin) loadConfig();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isAdmin]);

    const errors = useMemo(() => (config ? clientValidate(config) : []), [config]);

    if (!isAdmin) {
        return (
            <div className="bg-white rounded-lg border border-slate-200 p-8 text-center">
                <Lock className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-500 text-sm">
                    AI Models configuration is restricted to platform super-admins.
                </p>
            </div>
        );
    }

    if (loading || !config) {
        return (
            <div className="flex items-center justify-center py-16 text-slate-400">
                <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading AI model config…
            </div>
        );
    }

    // ── Mutators ─────────────────────────────────────────────────────
    const mutate = (next: AIModelConfig) => {
        setConfig(next);
        setDirty(true);
    };

    const toggleChatEnabled = (i: number) => {
        const next = { ...config, chatModels: [...config.chatModels] };
        next.chatModels[i] = { ...next.chatModels[i], enabled: !next.chatModels[i].enabled };
        mutate(next);
    };
    const setChatDefault = (i: number) => {
        const next = {
            ...config,
            chatModels: config.chatModels.map((m, idx) => ({ ...m, isDefault: idx === i })),
        };
        mutate(next);
    };
    const requestDeleteChat = (i: number) => {
        if (config.chatModels[i].isDefault) return; // blocked inline by row UI
        setConfirmDelete({ kind: 'chat', index: i, label: config.chatModels[i].label });
    };
    const requestDeleteOp = (i: number) => {
        setConfirmDelete({ kind: 'operation', index: i, label: config.operationModels[i].label });
    };
    const commitDelete = () => {
        if (!confirmDelete) return;
        const { kind, index, label } = confirmDelete;
        if (kind === 'chat') {
            mutate({ ...config, chatModels: config.chatModels.filter((_, idx) => idx !== index) });
        } else {
            mutate({ ...config, operationModels: config.operationModels.filter((_, idx) => idx !== index) });
        }
        setConfirmDelete(null);
        toast.success(`${label} removed — click Save changes to persist`);
    };

    const toggleOpEnabled = (i: number) => {
        const next = { ...config, operationModels: [...config.operationModels] };
        next.operationModels[i] = { ...next.operationModels[i], enabled: !next.operationModels[i].enabled };
        mutate(next);
    };
    const moveOp = (i: number, dir: -1 | 1) => {
        const j = i + dir;
        if (j < 0 || j >= config.operationModels.length) return;
        const arr = [...config.operationModels];
        [arr[i], arr[j]] = [arr[j], arr[i]];
        mutate({ ...config, operationModels: arr });
    };

    const openAdd = (kind: ModalKind) => setModal({ open: true, kind, index: null });
    const openEdit = (kind: ModalKind, index: number) => setModal({ open: true, kind, index });
    const handleSaveEntry = (entry: EditableEntry) => {
        const isAdding = modal.index === null;
        if (modal.kind === 'chat') {
            const chatEntry: ChatModelEntry = {
                id: entry.id,
                label: entry.label,
                group: (entry.group as ChatModelEntry['group']) ?? 'free',
                backend: 'openrouter',
                modelString: entry.modelString,
                enabled: entry.enabled,
                isDefault: !!entry.isDefault,
                meta: entry.meta,
            };
            const arr = [...config.chatModels];
            if (isAdding) arr.push(chatEntry);
            else arr[modal.index!] = chatEntry;
            // If this entry is the new default, demote every other.
            const next = chatEntry.isDefault
                ? arr.map((m) => (m.id === chatEntry.id ? m : { ...m, isDefault: false }))
                : arr;
            mutate({ ...config, chatModels: next });
        } else {
            const opEntry: OperationModelEntry = {
                id: entry.id,
                label: entry.label,
                backend: 'openrouter',
                modelString: entry.modelString,
                enabled: entry.enabled,
                meta: entry.meta,
            };
            const arr = [...config.operationModels];
            if (isAdding) arr.push(opEntry);
            else arr[modal.index!] = opEntry;
            mutate({ ...config, operationModels: arr });
        }
        setModal({ open: false, kind: 'chat', index: null });
        toast.success(
            `${entry.label} ${isAdding ? 'added' : 'updated'} — click Save changes to persist`,
        );
    };

    // ── Save / reset ─────────────────────────────────────────────────
    const handleSave = async () => {
        if (errors.length > 0) return;
        setSaving(true);
        setError(null);
        try {
            await api.adminUpdateAIModelConfig(config);
            // Silent refresh: keeps the existing tables on screen while we
            // pull back the version stamped with server updatedAt/updatedBy.
            await loadConfig(true);
            toast.success('AI Models configuration saved');
        } catch (e: any) {
            const msg = e?.message ?? 'Failed to save AI model config';
            setError(msg);
            toast.error(msg);
        } finally {
            setSaving(false);
        }
    };

    const handleReset = async () => {
        setConfirmReset(false);
        const ok = await loadConfig(true);
        if (ok) toast.success('Unsaved changes discarded');
    };

    // ── Render ───────────────────────────────────────────────────────
    const existingIdsForModal: string[] =
        modal.kind === 'chat'
            ? config.chatModels.map((m) => m.id)
            : config.operationModels.map((m) => m.id);
    const initialForModal: EditableEntry | null =
        modal.index === null
            ? null
            : modal.kind === 'chat'
                ? (config.chatModels[modal.index] as any)
                : (config.operationModels[modal.index] as any);

    return (
        <div className="flex flex-col gap-6">
            {seedReturned && (
                <div className="bg-indigo-50 border border-indigo-200 rounded-lg px-4 py-3 text-sm text-indigo-700 flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    <span>
                        No saved config yet — showing the built-in seed. Make any edit and Save to persist your curated lists to Firestore.
                    </span>
                </div>
            )}
            {error && (
                <div className="bg-rose-50 border border-rose-200 rounded-lg px-4 py-3 text-sm text-rose-700 flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" /> {error}
                </div>
            )}
            {/* Save success now surfaces via toast — no inline banner. */}

            {/* ── Chat models table ──────────────────────────────── */}
            <section className="bg-white rounded-lg border border-slate-200 shadow-sm">
                <div className="flex items-center justify-between p-4 border-b border-slate-100">
                    <div>
                        <h3 className="font-bold text-slate-800">Chat dropdown models</h3>
                        <p className="text-xs text-slate-500 mt-0.5">
                            Drives the /chat composer. Exactly one row must be enabled and marked Default.
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={() => openAdd('chat')}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-indigo-600 text-white hover:bg-indigo-700"
                    >
                        <Plus className="w-3.5 h-3.5" /> Add model
                    </button>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead>
                            <tr className="font-mono text-[10px] font-bold text-slate-400 uppercase tracking-wide border-b border-slate-100">
                                <th className="p-3">Label</th>
                                <th className="p-3">Group</th>
                                <th className="p-3">Model string</th>
                                <th className="p-3">Enabled</th>
                                <th className="p-3">Default</th>
                                <th className="p-3 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {config.chatModels.length === 0 && (
                                <tr><td colSpan={6} className="p-6 text-center text-slate-400 text-sm">No chat models. Add at least one and mark it Default.</td></tr>
                            )}
                            {config.chatModels.map((m, i) => (
                                <tr key={m.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                                    <td className="p-3 font-medium text-slate-800">
                                        {m.label}
                                        {m.meta && (
                                            <div className="text-[10px] text-slate-400 mt-0.5">
                                                {m.meta.contextLength.toLocaleString()} ctx · ${m.meta.promptCostUsdPer1M.toFixed(2)}/${m.meta.completionCostUsdPer1M.toFixed(2)}/1M
                                            </div>
                                        )}
                                    </td>
                                    <td className="p-3">
                                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${GROUP_BADGE[m.group]}`}>{m.group}</span>
                                    </td>
                                    <td className="p-3 font-mono text-[11px] text-slate-600">{m.modelString}</td>
                                    <td className="p-3">
                                        <input
                                            type="checkbox"
                                            checked={m.enabled}
                                            onChange={() => toggleChatEnabled(i)}
                                            className="w-4 h-4"
                                        />
                                    </td>
                                    <td className="p-3">
                                        <input
                                            type="radio"
                                            name="chatDefault"
                                            checked={m.isDefault}
                                            onChange={() => setChatDefault(i)}
                                            disabled={!m.enabled}
                                            title={!m.enabled ? 'Enable first to mark as default' : ''}
                                            className="w-4 h-4"
                                        />
                                    </td>
                                    <td className="p-3 text-right">
                                        <div className="inline-flex items-center gap-1">
                                            <button type="button" onClick={() => openEdit('chat', i)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500" title="Edit"><Pencil className="w-3.5 h-3.5" /></button>
                                            <button
                                                type="button"
                                                onClick={() => requestDeleteChat(i)}
                                                disabled={m.isDefault}
                                                className="p-1.5 rounded-lg hover:bg-rose-50 text-rose-500 disabled:opacity-30 disabled:cursor-not-allowed"
                                                title={m.isDefault ? 'Pick another default before deleting this row' : 'Delete'}
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </section>

            {/* ── Operation models table ─────────────────────────── */}
            <section className="bg-white rounded-lg border border-slate-200 shadow-sm">
                <div className="flex items-center justify-between p-4 border-b border-slate-100">
                    <div>
                        <h3 className="font-bold text-slate-800">Operation models (priority order)</h3>
                        <p className="text-xs text-slate-500 mt-0.5">
                            Tried top-to-bottom by the legacy AI router. After this list is exhausted, the hardcoded safety net runs (free auto-router → Gemini direct).
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={() => openAdd('operation')}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-indigo-600 text-white hover:bg-indigo-700"
                    >
                        <Plus className="w-3.5 h-3.5" /> Add model
                    </button>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead>
                            <tr className="font-mono text-[10px] font-bold text-slate-400 uppercase tracking-wide border-b border-slate-100">
                                <th className="p-3">#</th>
                                <th className="p-3">Label</th>
                                <th className="p-3">Model string</th>
                                <th className="p-3">Enabled</th>
                                <th className="p-3 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {config.operationModels.length === 0 && (
                                <tr><td colSpan={5} className="p-6 text-center text-slate-400 text-sm">No operation models. The router will fall straight through to the hardcoded safety net.</td></tr>
                            )}
                            {config.operationModels.map((m, i) => (
                                <tr key={m.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                                    <td className="p-3 text-slate-400 font-mono">{i + 1}</td>
                                    <td className="p-3 font-medium text-slate-800">
                                        {m.label}
                                        {m.meta && (
                                            <div className="text-[10px] text-slate-400 mt-0.5">
                                                {m.meta.contextLength.toLocaleString()} ctx · ${m.meta.promptCostUsdPer1M.toFixed(2)}/${m.meta.completionCostUsdPer1M.toFixed(2)}/1M
                                            </div>
                                        )}
                                    </td>
                                    <td className="p-3 font-mono text-[11px] text-slate-600">{m.modelString}</td>
                                    <td className="p-3">
                                        <input
                                            type="checkbox"
                                            checked={m.enabled}
                                            onChange={() => toggleOpEnabled(i)}
                                            className="w-4 h-4"
                                        />
                                    </td>
                                    <td className="p-3 text-right">
                                        <div className="inline-flex items-center gap-1">
                                            <button type="button" onClick={() => moveOp(i, -1)} disabled={i === 0} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 disabled:opacity-30" title="Move up"><ArrowUp className="w-3.5 h-3.5" /></button>
                                            <button type="button" onClick={() => moveOp(i, 1)} disabled={i === config.operationModels.length - 1} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 disabled:opacity-30" title="Move down"><ArrowDown className="w-3.5 h-3.5" /></button>
                                            <button type="button" onClick={() => openEdit('operation', i)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500" title="Edit"><Pencil className="w-3.5 h-3.5" /></button>
                                            <button type="button" onClick={() => requestDeleteOp(i)} className="p-1.5 rounded-lg hover:bg-rose-50 text-rose-500" title="Delete"><Trash2 className="w-3.5 h-3.5" /></button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </section>

            {/* ── Footer ────────────────────────────────────────── */}
            <div className="bg-white rounded-lg border border-slate-200 p-4 flex items-center justify-between gap-3">
                <div className="text-xs text-slate-500">
                    {config.updatedBy && config.updatedAt
                        ? <>Last updated by <span className="font-medium text-slate-700">{config.updatedByEmail ?? config.updatedBy}</span>{formatUpdatedAt(config.updatedAt) && <> · {formatUpdatedAt(config.updatedAt)}</>}</>
                        : 'Not yet saved to Firestore — showing the seed.'}
                    {errors.length > 0 && (
                        <div className="text-rose-600 mt-1">
                            {errors.map((e, i) => <div key={i}>• {e}</div>)}
                        </div>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={() => setConfirmReset(true)}
                        disabled={!dirty}
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                        title="Reload the saved Firestore config, discarding unsaved changes"
                    >
                        <RotateCcw className="w-3.5 h-3.5" /> Discard changes
                    </button>
                    <button
                        type="button"
                        onClick={handleSave}
                        disabled={saving || !dirty || errors.length > 0}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                        Save changes
                    </button>
                </div>
            </div>

            <AIModelEditModal
                isOpen={modal.open}
                kind={modal.kind}
                initial={initialForModal}
                existingIds={existingIdsForModal}
                onClose={() => setModal({ open: false, kind: 'chat', index: null })}
                onSave={handleSaveEntry}
            />

            {confirmReset && (
                <div
                    className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
                    onClick={(e) => e.target === e.currentTarget && setConfirmReset(false)}
                >
                    <div className="bg-white rounded-lg w-full max-w-md p-6 shadow-2xl">
                        <h3 className="font-bold text-slate-800 mb-2">Discard unsaved changes?</h3>
                        <p className="text-sm text-slate-600 mb-5">
                            This reloads the saved Firestore config. Any edits you've made in this tab since the last Save will be lost.
                        </p>
                        <div className="flex justify-end gap-2">
                            <button onClick={() => setConfirmReset(false)} className="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50">Cancel</button>
                            <button onClick={handleReset} className="px-4 py-2 rounded-lg text-sm font-medium bg-rose-600 text-white hover:bg-rose-700">Discard</button>
                        </div>
                    </div>
                </div>
            )}

            {confirmDelete && (
                <div
                    className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
                    onClick={(e) => e.target === e.currentTarget && setConfirmDelete(null)}
                >
                    <div className="bg-white rounded-lg w-full max-w-md p-6 shadow-2xl">
                        <h3 className="font-bold text-slate-800 mb-2">
                            Remove "{confirmDelete.label}"?
                        </h3>
                        <p className="text-sm text-slate-600 mb-5">
                            This removes the entry from the {confirmDelete.kind === 'chat' ? 'chat dropdown' : 'operation router'} lineup. The change is local until you click <span className="font-medium">Save changes</span> — you can still discard before saving.
                        </p>
                        <div className="flex justify-end gap-2">
                            <button onClick={() => setConfirmDelete(null)} className="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50">Cancel</button>
                            <button onClick={commitDelete} className="px-4 py-2 rounded-lg text-sm font-medium bg-rose-600 text-white hover:bg-rose-700">Remove</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
