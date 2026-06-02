import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, Loader2, RefreshCw, LineChart } from 'lucide-react';
import { api } from '../../lib/api';
import { ACTIVITY_CATEGORY_BADGES, ACTIVITY_ICONS } from './constants';
import DynamicTable from '../table/DynamicTable';
import type { ColumnDef, FilterDef } from '../table/types';

interface ActivityRow {
    id: string;
    type: string;
    category?: string;
    userName?: string | null;
    email?: string | null;
    uid?: string | null;
    entityType?: string | null;
    entityId?: string | null;
    entityName?: string | null;
    details?: Record<string, any> | null;
    timestamp?: string | null;
    // legacy ad-hoc fields tolerated
    [k: string]: any;
}

// Humanise an action type (e.g. "risks_item_updated" → "Risks item updated",
// "report.approve" → "Report approve"). Falls back to the known ACTIVITY_ICONS
// label when present.
function humaniseType(type: string): string {
    if (!type) return 'Activity';
    if (ACTIVITY_ICONS[type]?.label) return ACTIVITY_ICONS[type].label;
    return type
        .replace(/[._]/g, ' ')
        .replace(/\b\w/g, (c) => c.toUpperCase());
}

function deriveCategory(row: ActivityRow): string {
    if (row.category) return row.category;
    // Best-effort for legacy rows without a category.
    const t = row.type || '';
    if (/deleted|removed|cancelled|reset/.test(t)) return 'delete';
    if (/created|added|invited/.test(t)) return 'create';
    if (/viewed/.test(t)) return 'read';
    if (/approve|seal|sign|submit|flag|feedback|closed/.test(t)) return 'approve';
    if (/escalation|snapshot|purge|chase/.test(t)) return 'system';
    return 'update';
}

function fmtWhen(iso?: string | null): string {
    if (!iso) return '—';
    try {
        return new Date(iso).toLocaleString(undefined, {
            year: 'numeric', month: 'short', day: '2-digit',
            hour: '2-digit', minute: '2-digit', second: '2-digit',
        });
    } catch {
        return String(iso);
    }
}

function detailSummary(details: Record<string, any> | null | undefined): string {
    if (!details || typeof details !== 'object') return '';
    return Object.entries(details)
        .filter(([, v]) => v !== null && v !== undefined && v !== '')
        .map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : String(v)}`)
        .join(' · ');
}

export function ActivityTab({ isAdmin }: { isAdmin: boolean; users?: any[] }) {
    const [logs, setLogs] = useState<ActivityRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await api.adminGetActivity(500);
            if (res.success) setLogs(Array.isArray(res.logs) ? res.logs : []);
            else setError(res.error || 'Failed to load activity');
        } catch (e: any) {
            setError(e?.message || 'Failed to load activity');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { if (isAdmin) load(); }, [isAdmin, load]);

    // Normalise rows so columns/filters have stable fields (esp. category +
    // a single "who" string), tolerating legacy records.
    const rows = useMemo<ActivityRow[]>(
        () => (Array.isArray(logs) ? logs : []).map((l) => ({
            ...l,
            _category: deriveCategory(l),
            _who: l.userName || l.email || l.adminEmail || (l.uid ? `User ${String(l.uid).slice(0, 8)}` : 'System'),
            _what: l.entityName || l.projectName || l.entityId || '—',
            _action: humaniseType(l.type),
        })),
        [logs],
    );

    const columns = useMemo<ColumnDef<ActivityRow>[]>(() => [
        {
            key: 'timestamp',
            label: 'When',
            sortable: true,
            width: '180px',
            render: (v: string) => (
                <span className="font-mono text-[11px] text-slate-600 tabular-nums whitespace-nowrap">{fmtWhen(v)}</span>
            ),
            exportValue: (v: string) => fmtWhen(v),
        },
        {
            key: '_who',
            label: 'Who',
            sortable: true,
            render: (_v, row) => (
                <span className="text-sm text-slate-700">
                    <span className="font-medium text-slate-900">{row._who}</span>
                    {row.email && row.email !== row._who && (
                        <span className="block font-mono text-[10px] text-slate-400">{row.email}</span>
                    )}
                </span>
            ),
            exportValue: (_v, row) => `${row._who}${row.email ? ` <${row.email}>` : ''}`,
        },
        {
            key: '_category',
            label: 'Category',
            sortable: true,
            width: '110px',
            render: (v: string) => {
                const badge = ACTIVITY_CATEGORY_BADGES[v] || ACTIVITY_CATEGORY_BADGES.other;
                return (
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full font-mono uppercase tracking-wide text-[10px] font-medium ${badge.color}`}>
                        {badge.label}
                    </span>
                );
            },
        },
        {
            key: '_action',
            label: 'Action',
            sortable: true,
            render: (v: string) => <span className="text-sm text-slate-700">{v}</span>,
        },
        {
            key: '_what',
            label: 'What',
            sortable: true,
            render: (_v, row) => (
                <span className="text-sm text-slate-700">
                    {row._what}
                    {row.entityType && (
                        <span className="ml-1 font-mono text-[10px] text-slate-400">({row.entityType})</span>
                    )}
                </span>
            ),
            exportValue: (_v, row) => `${row._what}${row.entityType ? ` (${row.entityType})` : ''}`,
        },
        {
            key: 'details',
            label: 'Details',
            truncate: true,
            tooltip: (_v, row) => detailSummary(row.details) || '',
            render: (_v, row) => {
                const s = detailSummary(row.details);
                return s ? <span className="text-[12px] text-slate-500">{s}</span> : <span className="text-slate-400">—</span>;
            },
            exportValue: (_v, row) => detailSummary(row.details),
        },
    ], []);

    const filters = useMemo<FilterDef<ActivityRow>[]>(() => [
        {
            key: '_category',
            label: 'Category',
            type: 'select',
            options: Object.entries(ACTIVITY_CATEGORY_BADGES).map(([value, b]) => ({ value, label: b.label })),
        },
        {
            key: 'entityType',
            label: 'Entity',
            type: 'select',
            options: Array.from(new Set(rows.map((r) => r.entityType).filter(Boolean)))
                .map((t) => ({ value: String(t), label: String(t) })),
        },
    ], [rows]);

    if (loading) {
        return <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-indigo-500" /></div>;
    }
    if (error) {
        return (
            <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-lg flex items-center gap-3">
                <AlertCircle className="w-5 h-5 shrink-0" />{error}
            </div>
        );
    }

    return (
        <DynamicTable<ActivityRow>
            data={rows}
            columns={columns}
            filters={filters}
            searchable
            searchPlaceholder="Search who, action, or what…"
            searchFields={['_who', 'email', '_action', '_what', 'type']}
            pagination={{ enabled: true, pageSize: 25, pageSizeOptions: [25, 50, 100] }}
            export={{ xlsx: true, filename: 'activity-log' }}
            stickyHeader
            getRowId={(row) => row.id}
            emptyState={{
                title: 'No activity recorded yet',
                description: 'User actions, approvals, and system events will appear here as they happen.',
                icon: LineChart,
            }}
            toolbarActions={
                <button
                    onClick={load}
                    className="inline-flex items-center gap-2 px-3 h-9 rounded-lg border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50"
                >
                    <RefreshCw className="w-4 h-4" /> Refresh
                </button>
            }
        />
    );
}
