// Add / edit modal for a single AI model entry. Used by AIModelsTab for
// both Chat and Operation rows — the `kind` prop toggles the group +
// isDefault fields.
//
// Flow: catalog picker on the left → autofills modelString/label/group/meta
// when an entry is clicked. Admin can override the label (rename to e.g.
// "Cedar's smartest pick"); modelString / backend are locked once chosen.

import React, { useEffect, useMemo, useState } from 'react';
import { X, Check } from 'lucide-react';
import { AIModelCatalogPicker, type CatalogEntry } from './AIModelCatalogPicker';

export type ModalKind = 'chat' | 'operation';

export interface EditableEntry {
    id: string;
    label: string;
    group?: 'premium' | 'default' | 'free';
    backend: 'openrouter';
    modelString: string;
    enabled: boolean;
    isDefault?: boolean;
    meta?: {
        contextLength: number;
        promptCostUsdPer1M: number;
        completionCostUsdPer1M: number;
        isFree: boolean;
    };
}

interface Props {
    isOpen: boolean;
    kind: ModalKind;
    initial?: EditableEntry | null; // null on add, populated on edit
    existingIds: string[]; // for unique-id validation
    onClose: () => void;
    onSave: (entry: EditableEntry) => void;
}

const GROUP_OPTIONS: Array<{ value: 'premium' | 'default' | 'free'; label: string; help: string }> = [
    { value: 'free', label: 'Free', help: 'Surface in the Free section. Use for $0 models.' },
    { value: 'default', label: 'Default', help: 'Surface in the Default section. Use for the workspace baseline.' },
    { value: 'premium', label: 'Premium', help: 'Surface in the Premium section. Use for paid models.' },
];

// Slugify a model string into a stable id. Lowercase, slash→dash, strip
// non-[a-z0-9-_]. Admin can override before save.
function deriveId(modelString: string): string {
    return modelString
        .toLowerCase()
        .replace(/\//g, '-')
        .replace(/:/g, '-')
        .replace(/[^a-z0-9-_]/g, '')
        .slice(0, 80) || 'entry';
}

export function AIModelEditModal({ isOpen, kind, initial, existingIds, onClose, onSave }: Props) {
    const isEdit = !!initial;
    const [modelString, setModelString] = useState(initial?.modelString ?? '');
    const [label, setLabel] = useState(initial?.label ?? '');
    const [id, setId] = useState(initial?.id ?? '');
    const [group, setGroup] = useState<'premium' | 'default' | 'free'>(
        (initial?.group as any) ?? 'free',
    );
    const [enabled, setEnabled] = useState(initial?.enabled ?? true);
    const [isDefault, setIsDefault] = useState(initial?.isDefault ?? false);
    const [meta, setMeta] = useState(initial?.meta ?? null);
    const [idTouched, setIdTouched] = useState(false);

    // Reset when modal opens for a new add or different edit target.
    useEffect(() => {
        if (!isOpen) return;
        setModelString(initial?.modelString ?? '');
        setLabel(initial?.label ?? '');
        setId(initial?.id ?? '');
        setGroup((initial?.group as any) ?? 'free');
        setEnabled(initial?.enabled ?? true);
        setIsDefault(initial?.isDefault ?? false);
        setMeta(initial?.meta ?? null);
        setIdTouched(!!initial?.id);
    }, [isOpen, initial]);

    const handleCatalogSelect = (entry: CatalogEntry) => {
        setModelString(entry.id);
        if (!label || !idTouched) setLabel(entry.name);
        if (!idTouched) setId(deriveId(entry.id));
        // Auto-suggest group based on isFree but only when admin hasn't
        // already chosen something specific (initial group === 'free' is
        // the default; if they've toggled it we leave it alone).
        if (kind === 'chat' && group === 'free') {
            setGroup(entry.isFree ? 'free' : 'premium');
        }
        setMeta({
            contextLength: entry.contextLength,
            promptCostUsdPer1M: entry.promptCostUsdPer1M,
            completionCostUsdPer1M: entry.completionCostUsdPer1M,
            isFree: entry.isFree,
        });
    };

    const idCollision = useMemo(() => {
        const trimmed = id.trim();
        if (!trimmed) return false;
        // When editing, the entry's own id is allowed.
        return existingIds.includes(trimmed) && trimmed !== initial?.id;
    }, [id, existingIds, initial?.id]);

    const validationError: string | null = useMemo(() => {
        if (!modelString.trim()) return 'Pick a model from the catalog.';
        if (!label.trim()) return 'Label is required.';
        if (label.length > 80) return 'Label must be 80 characters or fewer.';
        if (!id.trim()) return 'Id is required.';
        if (id.length > 80) return 'Id must be 80 characters or fewer.';
        if (idCollision) return 'That id is already in use by another row.';
        return null;
    }, [modelString, label, id, idCollision]);

    if (!isOpen) return null;

    const submit = () => {
        if (validationError) return;
        const entry: EditableEntry = {
            id: id.trim(),
            label: label.trim(),
            backend: 'openrouter',
            modelString: modelString.trim(),
            enabled,
            ...(kind === 'chat' ? { group, isDefault } : {}),
            ...(meta ? { meta } : {}),
        };
        onSave(entry);
    };

    return (
        <div
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={(e) => e.target === e.currentTarget && onClose()}
        >
            <div className="bg-white rounded-lg w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
                <div className="p-5 border-b border-slate-100 flex items-center justify-between">
                    <h3 className="text-lg font-bold text-slate-800">
                        {isEdit ? 'Edit' : 'Add'} {kind === 'chat' ? 'Chat' : 'Operation'} Model
                    </h3>
                    <button
                        type="button"
                        onClick={onClose}
                        className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-50"
                        aria-label="Close"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="overflow-y-auto p-5 flex-1 flex flex-col gap-5">
                    <section>
                        <div className="text-[10px] uppercase tracking-widest font-bold text-slate-400 mb-2">
                            1. Pick a model from the live catalog
                        </div>
                        <AIModelCatalogPicker
                            onSelect={handleCatalogSelect}
                            selectedModelString={modelString || null}
                        />
                    </section>

                    {modelString && (
                        <section className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="sm:col-span-2 text-[10px] uppercase tracking-widest font-bold text-slate-400">
                                2. Confirm details
                            </div>
                            <label className="flex flex-col gap-1">
                                <span className="text-xs font-medium text-slate-600">Model string</span>
                                <input
                                    type="text"
                                    value={modelString}
                                    readOnly
                                    className="px-3 py-2 text-sm font-mono rounded-lg border border-slate-200 bg-slate-50 text-slate-700"
                                />
                            </label>
                            <label className="flex flex-col gap-1">
                                <span className="text-xs font-medium text-slate-600">Backend</span>
                                <input
                                    type="text"
                                    value="openrouter"
                                    readOnly
                                    className="px-3 py-2 text-sm font-mono rounded-lg border border-slate-200 bg-slate-50 text-slate-700"
                                />
                            </label>
                            <label className="flex flex-col gap-1">
                                <span className="text-xs font-medium text-slate-600">Label (shown to users)</span>
                                <input
                                    type="text"
                                    value={label}
                                    onChange={(e) => setLabel(e.target.value)}
                                    maxLength={80}
                                    className="px-3 py-2 text-sm rounded-lg border border-slate-200 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none"
                                />
                            </label>
                            <label className="flex flex-col gap-1">
                                <span className="text-xs font-medium text-slate-600">Id (stable slug)</span>
                                <input
                                    type="text"
                                    value={id}
                                    onChange={(e) => {
                                        setId(e.target.value);
                                        setIdTouched(true);
                                    }}
                                    maxLength={80}
                                    className="px-3 py-2 text-sm font-mono rounded-lg border border-slate-200 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none"
                                />
                            </label>

                            {kind === 'chat' && (
                                <>
                                    <fieldset className="sm:col-span-2 flex flex-col gap-1">
                                        <legend className="text-xs font-medium text-slate-600 mb-1">Group</legend>
                                        <div className="flex flex-wrap gap-2">
                                            {GROUP_OPTIONS.map((opt) => (
                                                <button
                                                    key={opt.value}
                                                    type="button"
                                                    onClick={() => setGroup(opt.value)}
                                                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                                                        group === opt.value
                                                            ? 'border-indigo-300 bg-indigo-50 text-indigo-700'
                                                            : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                                                    }`}
                                                    title={opt.help}
                                                >
                                                    {opt.label}
                                                </button>
                                            ))}
                                        </div>
                                    </fieldset>
                                    <label className="flex items-center gap-2 text-sm text-slate-700">
                                        <input
                                            type="checkbox"
                                            checked={isDefault}
                                            onChange={(e) => setIsDefault(e.target.checked)}
                                            className="w-4 h-4"
                                        />
                                        Mark as default (exactly one chat entry must be default + enabled)
                                    </label>
                                </>
                            )}

                            <label className="flex items-center gap-2 text-sm text-slate-700">
                                <input
                                    type="checkbox"
                                    checked={enabled}
                                    onChange={(e) => setEnabled(e.target.checked)}
                                    className="w-4 h-4"
                                />
                                Enabled (visible to users / used by the router)
                            </label>

                            {meta && (
                                <div className="sm:col-span-2 text-[11px] text-slate-500 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
                                    <span className="font-medium text-slate-600">Catalog metadata:</span>{' '}
                                    {meta.contextLength.toLocaleString()} ctx · ${meta.promptCostUsdPer1M.toFixed(4)} / ${meta.completionCostUsdPer1M.toFixed(4)} per 1M tokens · {meta.isFree ? 'FREE' : 'PAID'}
                                </div>
                            )}
                        </section>
                    )}
                </div>

                <div className="border-t border-slate-100 p-4 flex items-center justify-between gap-3">
                    <div className="text-xs text-rose-600 min-h-[1.25rem]">
                        {validationError ?? ''}
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50"
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            onClick={submit}
                            disabled={!!validationError}
                            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <Check className="w-4 h-4" />
                            {isEdit ? 'Update entry' : 'Add entry'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
