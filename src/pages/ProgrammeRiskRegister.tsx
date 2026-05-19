import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router';
import toast from 'react-hot-toast';
import { useStore, RiskItem } from '../store/useStore';
import { RISK_STATUSES } from '../data/riskData';
import { STRATEGIC_CATEGORY_NAMES, STRATEGIC_WORKSTREAMS } from '../data/riskTaxonomy';
import { UserRole, isSuperAdmin, isAtLeastPM } from '../lib/roles';
import { clsx } from 'clsx';
import { stripMarkdown, generateId } from '../lib/utils';
import { format, differenceInDays } from 'date-fns';
import {
    Trash2, Edit2, ScanSearch, Plus, ShieldOff, AlertCircle,
    ArrowRight, AlertTriangle, Flag, FlagOff,
    MessageSquare, ShieldCheck, TrendingUp, Clock,
} from 'lucide-react';
import { RiskModal } from '../components/RiskModal';
import { AIInquiryPopup } from '../components/AIInquiryPopup';
import { ServiceManagementBar } from '../components/ServiceManagementBar';
import { motion, AnimatePresence } from 'motion/react';
import DynamicTable from '../components/table/DynamicTable';
import type { ColumnDef, RowAction, BulkAction, FilterDef } from '../components/table/types';
import { StatsCard } from '../components/common/StatsCard';
import { useHistoricalView } from '../hooks/useHistoricalView';
import { MonthPicker } from '../components/historicalReporting/MonthPicker';
import { HistoricalBanner } from '../components/historicalReporting/HistoricalBanner';
import ConfirmDialog from '../components/table/ConfirmDialog';
import {
    BAND_STYLES,
    bandForScore,
    formatRatingDisplay,
    SEVERE_SCORE_THRESHOLD,
} from '../data/riskScoringMatrix';

// 5-band rating scheme:
//   Insignificant 1-3 · Minor 4-6 · Moderate 7-11 · Major 12-18 · Severe 19-25.

function rsScore(score: number) {
    const band = bandForScore(score);
    const base = BAND_STYLES[band].pill;
    return band === 'severe' ? `${base} shadow-sm animate-pulse` : `${base} shadow-sm`;
}

function rLabel(s: number) {
    const band = bandForScore(s);
    return { l: BAND_STYLES[band].label, c: BAND_STYLES[band].pill };
}

function fGBP(v?: number) {
    if (v === null || v === undefined || isNaN(v) || v === 0) return '—';
    return '£' + Number(v).toLocaleString('en-GB', { maximumFractionDigits: 0 });
}

function fDate(d?: string) {
    if (!d) return '—';
    try {
        return format(new Date(d), 'dd MMM yy');
    } catch {
        return d;
    }
}

function ageCalc(dateAdded?: string, status?: string) {
    if (!dateAdded || status === 'Closed') return '—';
    try {
        return differenceInDays(new Date(), new Date(dateAdded)) + 'd';
    } catch {
        return '—';
    }
}

function probDisplay(prob?: number): string {
    if (!prob && prob !== 0) return '—';
    if (prob === 0) return '—';
    const pct = prob > 1 ? prob : prob * 100;
    return Math.round(pct) + '%';
}

function StatusBadge({ status }: { status: string }) {
    const cls =
        status === 'Open'
            ? 'bg-red-50 text-red-600 border-red-200'
            : status === 'Closed'
                ? 'bg-emerald-50 text-emerald-600 border-emerald-200'
                : status === 'Mitigated'
                    ? 'bg-blue-50 text-blue-600 border-blue-200'
                    : status === 'Tolerated'
                        ? 'bg-amber-50 text-amber-600 border-amber-200'
                        : 'bg-slate-100 text-slate-600 border-slate-200';
    return (
        <span className={clsx('px-2 py-0.5 rounded text-[10px] font-bold border', cls)}>
            {status}
        </span>
    );
}

type ProgrammeRisk = RiskItem & { _source: 'project' | 'programme' };

// ── Programme Risk Register ──────────────────────────────────────────────────

export function ProgrammeRiskRegister() {
    const {
        risks, updateRisk, deleteRisk, addRisk,
        projects, activeProgrammeId, setActiveProgramme, user, addNotification,
        getPendingRisks, approveRisk, dismissRisk,
        pendingMutations,
    } = useStore();

    // Row is "busy" when any mutation targeting this risk id is in flight.
    // Action buttons disable and the row dims while true.
    const isRowPending = (id: string) => pendingMutations.has(`risk:${id}`);
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const urlProgrammeId = searchParams.get('programmeId');

    // Sync URL param to store — unchanged
    useEffect(() => {
        if (urlProgrammeId && urlProgrammeId !== activeProgrammeId) {
            setActiveProgramme(urlProgrammeId);
        }
    }, [urlProgrammeId, activeProgrammeId, setActiveProgramme]);

    const userRole = (user?.role || user?.profile?.role) as UserRole | undefined;
    const userIsSuperAdmin = isSuperAdmin(user?.email, userRole);

    //  historical view hook. When the user picks a past month
    // via the MonthPicker, the page swaps live `risks` for the snapshot
    // (LegacyArraySnapshot — one entry per project containing a frozen
    // risk array) and disables every edit affordance.
    const historicalView = useHistoricalView<{
        kind: 'legacyArray';
        projectId: string;
        array: RiskItem[];
    }>({ collection: 'risks' });
    const isHistorical = historicalView.isHistorical;

    const userCanModify = isAtLeastPM(userRole) || userIsSuperAdmin;
    const userCanDelete = isAtLeastPM(userRole) || userIsSuperAdmin;
    const canModify = userCanModify && !isHistorical;
    const canDelete = userCanDelete && !isHistorical;

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingRisk, setEditingRisk] = useState<RiskItem | null>(null);
    const [isAIInquiryOpen, setIsAIInquiryOpen] = useState(false);
    const [aiQuestion, setAiQuestion] = useState<string | undefined>(undefined);
    const [showFullQueue, setShowFullQueue] = useState(false);
    // no native dialogs. Tracks which escalation row is awaiting
    // dismiss confirmation so the ConfirmDialog can render once at the page root.
    const [dismissingRiskId, setDismissingRiskId] = useState<string | null>(null);
    const [dismissPending, setDismissPending] = useState(false);

    const pendingRisks = getPendingRisks();

    // Handle URL-based actions — unchanged
    useEffect(() => {
        const action = searchParams.get('action');
        if (action === 'add-risk') {
            setEditingRisk(null);
            setIsModalOpen(true);
            const newParams = new URLSearchParams(searchParams);
            newParams.delete('action');
            navigate({ search: newParams.toString() }, { replace: true });
        }
    }, [searchParams, navigate]);

    // ── Scoping — byte-for-byte preservation of original derivation ──────────
    //  when historical, replace `safeRisks` with the flattened
    // snapshot data so the existing escalated/programme-level scoping
    // logic below runs unchanged on frozen data.
    const liveRisks = Array.isArray(risks) ? risks : [];
    const historicalRisks: RiskItem[] = isHistorical
        ? historicalView.entries.flatMap((entry) => {
              const arr = (entry?.array ?? []) as RiskItem[];
              return arr.map((r) => ({
                  ...r,
                  projectId: r.projectId ?? entry?.projectId,
              } as RiskItem));
          })
        : [];
    const safeRisks = isHistorical ? historicalRisks : liveRisks;
    const safeProjects = Array.isArray(projects) ? projects : [];
    const progProjectIds = new Set(
        safeProjects.filter(p => p.programmeId === activeProgrammeId).map(p => p.id)
    );
    const escalatedFromProjects: ProgrammeRisk[] = safeRisks
        .filter(r => r.escalated && (progProjectIds.has(r.projectId || '') || (r as any).programmeId === activeProgrammeId))
        .map(r => ({ ...r, _source: 'project' as const }));
    const progRisks: ProgrammeRisk[] = safeRisks
        .filter(r => (r as any).isProgrammeLevel && ((r as any).programmeId === activeProgrammeId))
        .map(r => ({ ...r, _source: 'programme' as const }));
    const allProg: ProgrammeRisk[] = [...escalatedFromProjects, ...progRisks].sort((a, b) => {
        const dateA = a.dateAdded ? new Date(a.dateAdded).getTime() : 0;
        const dateB = b.dateAdded ? new Date(b.dateAdded).getTime() : 0;
        if (dateB !== dateA) return dateB - dateA;
        return (b.id || '').localeCompare(a.id || '');
    });

    const calcALE = (impact?: number, prob?: number) => {
        if (!impact || !prob) return 0;
        const p = prob > 1 ? prob / 100 : prob;
        return impact * p;
    };

    const totalGALE = allProg.reduce((s, r) => s + calcALE(r.grossImpact, r.grossProb), 0);
    const totalRALE = allProg.reduce((s, r) => s + calcALE(r.residualImpact, r.residualProb), 0);
    const pctReduction = totalGALE > 0 ? Math.round((1 - totalRALE / totalGALE) * 100) : 0;

    // Pessimistic action handlers — await the store call so the confirm dialog
    // can keep its spinner visible until the server ACKs, then toast on result.
    const doDeEscalate = async (r: RiskItem) => {
        if (!canModify) return;
        try {
            await updateRisk(r.id, { escalated: false });
            toast.success('Risk de-escalated and returned to project level.');
        } catch (err: any) {
            toast.error(err?.message || 'Failed to de-escalate risk. Please try again.');
            throw err;
        }
    };

    const doConvertToIssue = async (r: RiskItem) => {
        if (!canModify) return;
        try {
            await useStore.getState().convertToIssue(r.id);
            toast.success('Risk converted to live issue.');
        } catch (err: any) {
            toast.error(err?.message || 'Failed to convert risk to issue.');
            throw err;
        }
    };

    const doDelete = async (r: RiskItem) => {
        if (!canDelete) return;
        try {
            await deleteRisk(r.id);
            toast.success('Risk deleted.');
        } catch (err: any) {
            toast.error(err?.message || 'Failed to delete risk.');
            throw err;
        }
    };

    const doBulkDelete = async (rows: RiskItem[]) => {
        if (!canDelete || rows.length === 0) return;
        let succeeded = 0;
        let failed = 0;
        for (const r of rows) {
            try {
                await deleteRisk(r.id);
                succeeded++;
            } catch {
                failed++;
            }
        }
        if (failed === 0 && succeeded > 0) {
            addNotification({
                title: 'Risks Deleted',
                body: `Successfully deleted ${succeeded} risk${succeeded === 1 ? '' : 's'} from the register.`,
                type: 'risk',
            });
        } else if (succeeded === 0 && failed > 0) {
            toast.error('Failed to delete risks. Please try again.');
        } else if (failed > 0) {
            toast.error(`Deleted ${succeeded} of ${rows.length} risks — ${failed} failed.`);
            addNotification({
                title: 'Risks Deleted (partial)',
                body: `Deleted ${succeeded} of ${rows.length} risks — ${failed} failed.`,
                type: 'risk',
            });
        }
    };

    // ── Column definitions ───────────────────────────────────────────────────
    // Same 27 columns as RiskRegister for parity — except the Source Project
    // column, which uses the `_source` annotation (matches the ORIGINAL programme
    // register behaviour: escalated rows show "Escalated" + project name, native
    // programme-level rows show italic "Programme Level"). This prevents the
    // earlier bug where a programme-level risk with a stray projectId would render
    // the project's name instead of "Programme Level".

    const columns: ColumnDef<ProgrammeRisk>[] = [
        {
            key: 'id',
            label: 'Ref',
            sortable: true,
            render: (v, r) => (
                <span
                    className="font-bold text-indigo-600 cursor-pointer hover:underline whitespace-nowrap"
                    onClick={() => {
                        if (canModify) {
                            setEditingRisk(r);
                            setIsModalOpen(true);
                        }
                    }}
                >
                    {v}
                </span>
            ),
        },
        {
            key: 'workstream',
            label: 'Workstream',
            width: '110px',
            align: 'left',
            truncate: true,
            tooltip: true,
            render: (v) => (
                <span className="text-slate-600 text-[10px] font-semibold">
                    {stripMarkdown(v || '—')}
                </span>
            ),
        },
        {
            key: 'kri',
            label: 'Linked KRI',
            render: (v) => (
                <span className="text-slate-500 text-[10px]">{v || '—'}</span>
            ),
        },
        {
            key: 'dateAdded',
            label: 'Date Added',
            sortable: true,
            render: (v) => (
                <span className="text-slate-400 whitespace-nowrap text-[10px]">
                    {fDate(v)}
                </span>
            ),
        },
        {
            // Source Project — driven by `_source` annotation (original programme-register behaviour).
            key: 'projectId',
            label: 'Source Project',
            render: (_v, r) => {
                const isEsc = r._source === 'project';
                if (!isEsc) {
                    return <span className="text-slate-400 italic text-[10px]">Programme Level</span>;
                }
                const projectName = safeProjects.find(p => p.id === r.projectId)?.name;
                return (
                    <span className="flex flex-col">
                        <span className="text-[10px] font-black text-orange-600 uppercase tracking-tighter">Escalated</span>
                        <span className="truncate text-[10px] text-slate-600">{projectName || '—'}</span>
                    </span>
                );
            },
        },
        {
            key: 'title',
            label: 'Risk Title & Desc',
            width: '260px',
            truncate: true,
            tooltip: (_v: any, r: RiskItem) =>
                `${stripMarkdown(r.title)}\n\n${stripMarkdown(r.desc) || 'No description provided.'}`,
            render: (_v, r) => {
                // Severe trigger: rose ESCALATE pill when EITHER gross
                // OR residual Impact = 5. :
                // "Escalate Band 5 risks to senior management immediately".
                const isSevere =
                    (Number(r.grossI) || 0) >= 5 || (Number(r.residualI) || 0) >= 5;
                return (
                    <div className="min-w-0">
                        <div className="flex items-center flex-wrap gap-2">
                            <span className="font-bold text-slate-900 leading-tight text-[11px] line-clamp-1">
                                {stripMarkdown(r.title)}
                            </span>
                            {isSevere && (
                                <span
                                    title="Severe Impact (Band 5) — escalate to senior management immediately"
                                    className="px-1.5 py-0.5 bg-rose-100 text-rose-700 text-[8px] font-black uppercase tracking-wider rounded border border-rose-200"
                                >
                                    Escalate
                                </span>
                            )}
                            {r.isNew !== false &&
                                differenceInDays(new Date(), new Date(r.dateAdded || '')) < 1 && (
                                    <span className="px-1.5 py-0.5 bg-indigo-600 text-white text-[7px] font-black uppercase rounded shadow-sm">
                                        New
                                    </span>
                                )}
                            {!r.owner && (
                                <span title="Missing Owner">
                                    <AlertCircle className="w-3 h-3 text-rose-500" />
                                </span>
                            )}
                        </div>
                        <span className="text-[10px] text-slate-400 font-normal leading-relaxed line-clamp-2">
                            {stripMarkdown(r.desc)}
                        </span>
                    </div>
                );
            },
        },
        // Gross Risk Rating group
        {
            key: 'grossL',
            label: 'L',
            groupHeader: 'Gross Risk Rating',
            groupHeaderClassName: 'bg-rose-50 text-rose-700 border-rose-200',
            align: 'center',
            width: '36px',
            render: (v, r) => (
                <div
                    className={clsx(
                        'inline-flex items-center justify-center w-5 h-5 rounded text-[9px] font-black border',
                        rsScore(r.grossRating || 0),
                    )}
                >
                    {v}
                </div>
            ),
        },
        {
            key: 'grossI',
            label: 'I',
            groupHeader: 'Gross Risk Rating',
            groupHeaderClassName: 'bg-rose-50 text-rose-700 border-rose-200',
            align: 'center',
            width: '36px',
            render: (v, r) => (
                <div
                    className={clsx(
                        'inline-flex items-center justify-center w-5 h-5 rounded text-[9px] font-black border',
                        rsScore(r.grossRating || 0),
                    )}
                >
                    {v}
                </div>
            ),
        },
        {
            key: 'grossRating',
            label: 'Rating',
            groupHeader: 'Gross Risk Rating',
            groupHeaderClassName: 'bg-rose-50 text-rose-700 border-rose-200',
            align: 'center',
            sortable: true,
            width: '50px',
            render: (v) => (
                <div
                    className={clsx(
                        'inline-flex items-center justify-center w-6 h-6 rounded text-[11px] font-black border shadow-sm',
                        rsScore(v || 0),
                    )}
                >
                    {v}
                </div>
            ),
        },
        {
            key: 'response',
            label: 'Response',
            width: '110px',
            truncate: true,
            tooltip: true,
            render: (v) => (
                <span className="text-slate-600 italic text-[10px]">
                    {stripMarkdown(v || '—')}
                </span>
            ),
        },
        {
            key: 'controls',
            label: 'Controls',
            width: '160px',
            truncate: true,
            tooltip: (_v, r) => stripMarkdown(r.controls || ''),
            render: (_v, r) => (
                <div className="flex items-center gap-2">
                    {!r.controls && (
                        <AlertCircle className="w-3 h-3 text-rose-500 shrink-0" />
                    )}
                    <span className="truncate text-[10px] text-slate-600">
                        {stripMarkdown(r.controls || '')?.split('\n')[0] || '—'}
                    </span>
                </div>
            ),
        },
        // Residual Risk Rating group
        {
            key: 'residualL',
            label: 'L',
            groupHeader: 'Residual Risk Rating',
            groupHeaderClassName: 'bg-emerald-50 text-emerald-700 border-emerald-200',
            align: 'center',
            width: '36px',
            render: (v, r) => (
                <div
                    className={clsx(
                        'inline-flex items-center justify-center w-5 h-5 rounded text-[9px] font-black border',
                        rsScore(r.residualRating || 0),
                    )}
                >
                    {v}
                </div>
            ),
        },
        {
            key: 'residualI',
            label: 'I',
            groupHeader: 'Residual Risk Rating',
            groupHeaderClassName: 'bg-emerald-50 text-emerald-700 border-emerald-200',
            align: 'center',
            width: '36px',
            render: (v, r) => (
                <div
                    className={clsx(
                        'inline-flex items-center justify-center w-5 h-5 rounded text-[9px] font-black border',
                        rsScore(r.residualRating || 0),
                    )}
                >
                    {v}
                </div>
            ),
        },
        {
            key: 'residualRating',
            label: 'Rating',
            groupHeader: 'Residual Risk Rating',
            groupHeaderClassName: 'bg-emerald-50 text-emerald-700 border-emerald-200',
            align: 'center',
            sortable: true,
            width: '50px',
            render: (v) => (
                <div
                    className={clsx(
                        'inline-flex items-center justify-center w-6 h-6 rounded text-[11px] font-black border shadow-sm',
                        rsScore(v || 0),
                    )}
                >
                    {v}
                </div>
            ),
        },
        {
            key: '_label' as any,
            label: 'Rating Label',
            // show "Severe · 24" format (text label + numeric score)
            render: (_v, r) => {
                const c = rLabel(r.residualRating || 0);
                return (
                    <span
                        className={clsx(
                            'px-1.5 py-0.5 rounded text-[10px] font-bold border whitespace-nowrap',
                            c.c,
                        )}
                    >
                        {formatRatingDisplay(r.residualRating || 0)}
                    </span>
                );
            },
        },
        {
            key: 'appetite',
            label: 'Appetite',
            render: (v) => (
                <span className="text-slate-600 whitespace-nowrap font-medium text-[10px] uppercase tracking-tighter">
                    {stripMarkdown(v || '—')}
                </span>
            ),
        },
        {
            key: 'furtherAction',
            label: 'Further Action',
            width: '160px',
            truncate: true,
            tooltip: (_v, r) => {
                const action = stripMarkdown(r.furtherAction || '');
                if (action) return action;
                if (r.workstream?.includes('Financial')) return 'Review financial controls & overspend measures';
                if (r.workstream?.includes('Compliance')) return 'Audit regulatory adherence protocol';
                if (r.workstream?.includes('Operational')) return 'Update operational risk mitigation plan';
                return 'Define immediate mitigation steps';
            },
            render: (_v, r) => {
                const action = stripMarkdown(r.furtherAction || '');
                const display = action ||
                    (r.workstream?.includes('Financial') ? 'Review financial controls & overspend measures' :
                        r.workstream?.includes('Compliance') ? 'Audit regulatory adherence protocol' :
                            r.workstream?.includes('Operational') ? 'Update operational risk mitigation plan' :
                                'Define immediate mitigation steps');
                return (
                    <span className="text-slate-500 text-[10px] leading-relaxed">
                        {display}
                    </span>
                );
            },
        },
        {
            key: 'status',
            label: 'Status',
            render: (v) => <StatusBadge status={v} />,
        },
        // Gross ALE group
        {
            key: 'grossImpact',
            label: 'Impact',
            groupHeader: 'Gross ALE',
            groupHeaderClassName: 'bg-violet-50 text-violet-700 border-violet-200',
            align: 'right',
            render: (v) => (
                <span className="text-slate-600 whitespace-nowrap font-medium text-[10px]">
                    {fGBP(v)}
                </span>
            ),
        },
        {
            key: 'grossProb',
            label: 'Prob%',
            groupHeader: 'Gross ALE',
            groupHeaderClassName: 'bg-violet-50 text-violet-700 border-violet-200',
            align: 'center',
            render: (v) => (
                <span className="text-slate-600 whitespace-nowrap font-medium text-[10px]">
                    {probDisplay(v)}
                </span>
            ),
        },
        {
            key: 'grossALE',
            label: 'ALE',
            groupHeader: 'Gross ALE',
            groupHeaderClassName: 'bg-violet-50 text-violet-700 border-violet-200',
            align: 'right',
            sortable: true,
            render: (v) => (
                <span className="font-bold text-slate-900 whitespace-nowrap text-[11px]">
                    {fGBP(Math.round(v || 0))}
                </span>
            ),
        },
        // Residual ALE group
        {
            key: 'residualImpact',
            label: 'Impact',
            groupHeader: 'Residual ALE',
            groupHeaderClassName: 'bg-violet-50 text-violet-700 border-violet-200',
            align: 'right',
            render: (v) => (
                <span className="text-slate-600 whitespace-nowrap font-medium text-[10px]">
                    {fGBP(v)}
                </span>
            ),
        },
        {
            key: 'residualProb',
            label: 'Prob%',
            groupHeader: 'Residual ALE',
            groupHeaderClassName: 'bg-violet-50 text-violet-700 border-violet-200',
            align: 'center',
            render: (v) => (
                <span className="text-slate-600 whitespace-nowrap font-medium text-[10px]">
                    {probDisplay(v)}
                </span>
            ),
        },
        {
            key: 'residualALE',
            label: 'ALE',
            groupHeader: 'Residual ALE',
            groupHeaderClassName: 'bg-violet-50 text-violet-700 border-violet-200',
            align: 'right',
            sortable: true,
            render: (v) => (
                <span className="font-bold text-indigo-600 whitespace-nowrap text-[11px]">
                    {fGBP(Math.round(v || 0))}
                </span>
            ),
        },
        {
            key: '_reduction' as any,
            label: 'Reduction',
            align: 'right',
            render: (_v, r) => {
                const reduction = (r.grossALE || 0) - (r.residualALE || 0);
                return (
                    <span className="font-bold text-emerald-600 whitespace-nowrap text-[11px]">
                        {reduction > 0 ? fGBP(Math.round(reduction)) : '—'}
                    </span>
                );
            },
        },
        {
            key: '_indicators' as any,
            label: 'Ind',
            align: 'center',
            render: (_v, r) => (
                <div className="flex flex-col gap-1.5 items-center">
                    {r.escalated && (
                        <span className="px-2 py-0.5 bg-rose-100 text-rose-700 border border-rose-200 rounded text-[9px] font-bold flex items-center gap-1 shadow-sm shadow-rose-200/50 uppercase tracking-wider">
                            <Flag className="w-2.5 h-2.5 fill-current" /> ESC
                        </span>
                    )}
                    {r.convertedToIssue && (
                        <span className="px-2 py-0.5 bg-amber-100 text-amber-700 border border-amber-200 rounded text-[9px] font-bold flex items-center gap-1 shadow-sm shadow-amber-200/50 uppercase tracking-wider">
                            <AlertTriangle className="w-2.5 h-2.5 fill-current" /> ISSUE
                        </span>
                    )}
                    {!r.escalated && !r.convertedToIssue && (
                        <span className="text-slate-300">—</span>
                    )}
                </div>
            ),
        },
        {
            key: '_age' as any,
            label: 'Age',
            render: (_v, r) => (
                <span className="text-slate-400 whitespace-nowrap font-medium">
                    {ageCalc(r.dateAdded, r.status)}
                </span>
            ),
        },
    ];

    // ── Filter definitions — replaces the old programme/status/category page filters
    //   programme filter dropped: the page is already scoped to activeProgrammeId,
    //   so the legacy filter.programme dropdown (which defaulted to activeProgrammeId)
    //   was effectively a no-op. Status + category move into the DynamicTable toolbar.

    const filterDefs: FilterDef<ProgrammeRisk>[] = [
        {
            key: 'status',
            label: 'Status',
            type: 'select',
            options: RISK_STATUSES.map((s) => ({ value: s, label: s })),
        },
        {
            key: 'category',
            label: 'Category',
            type: 'select',
            options: STRATEGIC_CATEGORY_NAMES.map((c) => ({ value: c, label: c })),
        },
        {
            key: 'workstream',
            label: 'Workstream',
            type: 'select',
            options: STRATEGIC_WORKSTREAMS.map((w) => ({ value: w, label: w })),
        },
    ];

    // ── Row actions — same icons as RiskRegister, shared ConfirmDialog ───────

    const rowActions: RowAction<ProgrammeRisk>[] = [
        ...(canModify
            ? [
                {
                    key: 'edit',
                    label: 'Edit',
                    icon: Edit2,
                    isDisabled: (r: ProgrammeRisk) => isRowPending(r.id),
                    onClick: (r: ProgrammeRisk) => {
                        setEditingRisk(r);
                        setIsModalOpen(true);
                    },
                },
                {
                    key: 'de-escalate',
                    label: 'De-escalate',
                    icon: FlagOff,
                    isVisible: (r: ProgrammeRisk) => r._source === 'project',
                    isDisabled: (r: ProgrammeRisk) => isRowPending(r.id),
                    requireConfirm: {
                        icon: FlagOff,
                        variant: 'warning' as const,
                        title: 'De-escalate Risk',
                        message: (r: ProgrammeRisk) =>
                            `"${r.title}" will be removed from the Programme Risk Register and returned to the originating project register.`,
                        confirmLabel: 'Confirm De-escalate',
                    },
                    onClick: (r: ProgrammeRisk) => doDeEscalate(r),
                },
                {
                    key: 'convert',
                    label: 'Move to Issue',
                    icon: AlertTriangle,
                    isVisible: (r: ProgrammeRisk) => !r.convertedToIssue && r.status !== 'Closed',
                    isDisabled: (r: ProgrammeRisk) => isRowPending(r.id),
                    requireConfirm: {
                        icon: AlertTriangle,
                        variant: 'warning' as const,
                        title: 'Convert risk to issue',
                        message: (r: ProgrammeRisk) =>
                            `Convert risk ${r.id} to an issue? This will close the risk.`,
                        confirmLabel: 'Convert',
                    },
                    onClick: (r: ProgrammeRisk) => doConvertToIssue(r),
                },
            ]
            : []),
        ...(canDelete
            ? [
                {
                    key: 'delete',
                    label: 'Delete',
                    icon: Trash2,
                    isDanger: true,
                    isDisabled: (r: ProgrammeRisk) => isRowPending(r.id),
                    requireConfirm: {
                        icon: Trash2,
                        variant: 'danger' as const,
                        title: 'Delete risk',
                        message: 'Delete this risk?',
                        confirmLabel: 'Delete',
                        isDanger: true,
                    },
                    onClick: (r: ProgrammeRisk) => doDelete(r),
                },
            ]
            : []),
    ];

    // ── Bulk actions — style: 'bar' is the documented programme-level difference

    const bulkActions: BulkAction<ProgrammeRisk>[] = canDelete
        ? [
            {
                key: 'bulk-delete',
                label: 'Delete Selected',
                icon: Trash2,
                isDanger: true,
                style: 'bar',
                requireConfirm: {
                    icon: Trash2,
                    variant: 'danger' as const,
                    title: (rows: ProgrammeRisk[]) =>
                        `Delete ${rows.length} selected risk${rows.length === 1 ? '' : 's'}?`,
                    message: 'Are you sure you want to delete the selected risks?',
                    confirmLabel: 'Delete',
                    isDanger: true,
                },
                onClick: (rows: ProgrammeRisk[]) => doBulkDelete(rows),
            },
        ]
        : [];

    // ── Render ──────────────────────────────────────────────────────────────

    return (
        <>
            <ServiceManagementBar />
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="max-w-[98%] mx-auto p-2 sm:p-4 lg:p-6 space-y-6 sm:space-y-8"
            >

                {/* month picker + read-only banner. The chip
 sits at the top of the page so it's the first thing
 the user sees; the amber banner below appears once
 a past month is selected.*/}
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="text-[11px] font-bold uppercase tracking-widest text-slate-400">
                        Risk Register · Programme Level
                    </div>
                    <MonthPicker
                        monthEnd={historicalView.monthEnd}
                        availableMonths={historicalView.availableMonths}
                        onChange={historicalView.setMonthEnd}
                        loading={historicalView.loading}
                    />
                </div>
                {isHistorical && historicalView.monthEnd && (
                    <HistoricalBanner
                        monthEnd={historicalView.monthEnd}
                        meta={historicalView.meta}
                        onExit={() => historicalView.setMonthEnd(null)}
                        defaultCorrectionCollection="risks"
                        emptyReason={historicalView.emptyReason}
                        activatedYearMonth={historicalView.activatedYearMonth}
                        surfaceLabel="programme risk register"
                    />
                )}

                {/* AI Risk Advisor Banner — unchanged*/}
                <div className="bg-linear-to-br from-indigo-700 via-indigo-800 to-slate-900 rounded-lg p-8 text-white shadow-2xl shadow-indigo-200/50 relative overflow-hidden group border border-white/10">
                    <div className="absolute right-0 top-0 w-96 h-96 bg-white/5 rounded-full -mr-32 -mt-32 blur-3xl group-hover:bg-white/10 transition-all duration-1000"></div>
                    <div className="absolute left-0 bottom-0 w-64 h-64 bg-indigo-500/20 rounded-full -ml-24 -mb-24 blur-2xl"></div>

                    <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-8">
                        <div className="max-w-2xl space-y-4">
                            <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/20 backdrop-blur-md rounded-full text-[10px] font-black uppercase tracking-[0.2em] border border-white/20 shadow-sm">
                                <ScanSearch className="w-3.5 h-3.5 fill-white animate-pulse" />
                                CedarGuard AI Risk Advisor
                            </div>
                            <h2 className="text-3xl font-black tracking-tight leading-tight">
                                Predictive Risk Intelligence
                            </h2>
                            <p className="text-indigo-100/90 text-sm font-medium leading-relaxed max-w-lg">
                                Empower your decision-making with AI-driven risk insights. Analyze programme dependencies,
                                identify hidden correlations, and generate automated mitigation strategies instantly.
                            </p>
                        </div>

                        <button
                            onClick={() => {
                                setAiQuestion("Analyze the current programme risk profile and suggest top 3 mitigation strategies.");
                                setIsAIInquiryOpen(true);
                            }}
                            className="shrink-0 px-8 py-4 bg-white text-indigo-700 rounded-lg font-black text-xs uppercase tracking-[0.2em] shadow-xl hover:bg-slate-900 hover:text-white transition-all hover:scale-105 active:scale-95 flex items-center gap-3 group/btn"
                        >
                            <MessageSquare className="w-4 h-4 group-hover/btn:rotate-12 transition-transform" />
                            Consult AI Advisor
                        </button>
                    </div>
                </div>

                {/* Interactive Review Queue — unchanged*/}
                <AnimatePresence>
                    {pendingRisks.length > 0 && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="overflow-hidden"
                        >
                            <div className="bg-indigo-900 rounded-lg p-8 mb-8 text-white relative shadow-2xl shadow-indigo-900/50 overflow-hidden border border-indigo-700">
                                <div className="absolute right-0 top-0 w-64 h-64 bg-white/5 rounded-full -mr-20 -mt-20 blur-3xl"></div>

                                <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-8">
                                    <div className="max-w-xl space-y-3">
                                        <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/10 rounded-full text-[10px] font-black uppercase tracking-widest border border-white/10">
                                            <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                                            Pending Escalations
                                        </div>
                                        <h2 className="text-3xl font-black tracking-tight leading-tight">
                                            Review {pendingRisks.length} Project Escalations
                                        </h2>
                                        <p className="text-indigo-100/80 text-sm font-medium">
                                            Project Managers have escalated these risks to the programme level. Review and approve them to include in the primary register.
                                        </p>
                                    </div>

                                    <div className="bg-white/5 backdrop-blur-md rounded-lg border border-white/10 p-6 flex flex-col items-center justify-center text-center min-w-[200px]">
                                        <div className="text-4xl font-black mb-1">{pendingRisks.length}</div>
                                        <div className="text-[10px] font-black uppercase tracking-widest text-indigo-300">Awaiting Action</div>
                                    </div>
                                </div>

                                <div className="mt-8 space-y-3 relative z-10">
                                    {(showFullQueue ? pendingRisks : pendingRisks.slice(0, 2)).map((risk) => (
                                        <motion.div
                                            layout
                                            key={risk.id}
                                            className="bg-white/5 backdrop-blur-md border border-white/10 p-5 rounded-lg flex items-center justify-between gap-4 group hover:bg-white/10 transition-all"
                                        >
                                            <div className="flex items-center gap-4 flex-1">
                                                <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center shrink-0 border border-white/10">
                                                    <TrendingUp className="w-5 h-5 text-indigo-300" />
                                                </div>
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 bg-indigo-500/30 text-indigo-200 rounded-md border border-indigo-500/20">{risk.project || 'Project'}</span>
                                                        <span className="text-[10px] font-black text-white/50">{risk.id}</span>
                                                    </div>
                                                    <p className="font-bold text-sm mt-0.5 text-white">{risk.title}</p>
                                                    <div className="flex items-center gap-3 mt-1">
                                                        {/*rating shown as "Severe · 24" format.*/}
                                                        <span className={clsx("px-2 py-0.5 rounded text-[8px] font-black uppercase border", rLabel(risk.residualRating || 0).c)}>
                                                            {formatRatingDisplay(risk.residualRating || 0)}
                                                        </span>
                                                        <span className="text-[10px] text-indigo-300 font-medium italic">Escalated by {risk.owner}</span>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2.5">
                                                <button
                                                    disabled={isRowPending(risk.id)}
                                                    onClick={() => setDismissingRiskId(risk.id)}
                                                    className="px-4 py-2 bg-white/5 hover:bg-rose-500/20 hover:text-rose-300 border border-white/10 rounded-lg font-black text-[10px] uppercase tracking-widest transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                                                >
                                                    {isRowPending(risk.id) ? 'Working…' : 'Dismiss'}
                                                </button>
                                                <button
                                                    disabled={isRowPending(risk.id)}
                                                    onClick={async () => {
                                                        try {
                                                            await approveRisk(risk.id);
                                                            toast.success('Escalation approved.');
                                                        } catch (err: any) {
                                                            toast.error(err?.message || 'Failed to approve escalation.');
                                                        }
                                                    }}
                                                    className="px-6 py-2 bg-indigo-500 hover:bg-indigo-400 text-white rounded-lg font-black text-[10px] uppercase tracking-widest transition-all shadow-lg shadow-indigo-900/20 disabled:opacity-40 disabled:cursor-not-allowed"
                                                >
                                                    {isRowPending(risk.id) ? 'Working…' : 'Approve'}
                                                </button>
                                            </div>
                                        </motion.div>
                                    ))}

                                    {pendingRisks.length > 2 && (
                                        <button
                                            onClick={() => setShowFullQueue(!showFullQueue)}
                                            className="w-full py-3 bg-white/5 border border-white/10 rounded-lg text-[10px] font-black uppercase tracking-[0.2em] text-indigo-300 hover:bg-white/10 transition-all flex items-center justify-center gap-2"
                                        >
                                            {showFullQueue ? 'Show Less' : `View ${pendingRisks.length - 2} More Escalations`}
                                            <ArrowRight className={clsx("w-3 h-3 transition-transform", showFullQueue && "-rotate-90")} />
                                        </button>
                                    )}
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Summary Tiles — 4 stats cards, no progress bar*/}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <StatsCard
                        title="Total Programme Risks"
                        value={allProg.length}
                        unit="risks"
                        icon={ShieldCheck}
                        iconBgClassName="bg-indigo-50 dark:bg-indigo-900/30"
                        iconClassName="text-indigo-600 dark:text-indigo-400"
                        valueClassName="text-indigo-600 dark:text-indigo-400"
                    />
                    <StatsCard
                        title="Active Escalations"
                        value={allProg.filter(r => r._source === 'project').length}
                        unit="escalated"
                        icon={AlertTriangle}
                        iconBgClassName="bg-orange-50 dark:bg-orange-900/30"
                        iconClassName="text-orange-600 dark:text-orange-400"
                        valueClassName="text-orange-600 dark:text-orange-400"
                    />
                    <StatsCard
                        title="Severe"
                        value={allProg.filter(r => (r.residualRating || 0) >= SEVERE_SCORE_THRESHOLD).length}
                        unit="risks"
                        icon={AlertCircle}
                        iconBgClassName="bg-rose-50 dark:bg-rose-900/30"
                        iconClassName="text-rose-600 dark:text-rose-400"
                        valueClassName="text-rose-600 dark:text-rose-400"
                    />
                    <StatsCard
                        title="Open Actions"
                        value={allProg.filter(r => r.status === 'Open').length}
                        unit="open"
                        icon={Clock}
                        iconBgClassName="bg-amber-50 dark:bg-amber-900/30"
                        iconClassName="text-amber-600 dark:text-amber-400"
                        valueClassName="text-amber-600 dark:text-amber-400"
                    />
                </div>

                {/* DynamicTable — replaces hand-rolled table + filter row + toolbar*/}
                <DynamicTable<ProgrammeRisk>
                    data={allProg}
                    columns={columns}
                    filters={filterDefs}
                    rowActions={rowActions}
                    bulkActions={bulkActions}
                    searchable
                    searchPlaceholder="Search across programme risk register (Title, ID, etc)..."
                    searchFields={['title', 'id', 'workstream', 'desc']}
                    selectable
                    stickyHeader
                    loading={historicalView.loading}
                    pagination={{ enabled: true, pageSize: 20 }}
                    getRowId={(r) => r.id}
                    rowClassName={(r) => {
                        const base = r._source === 'project'
                            ? 'bg-orange-50/30 hover:bg-orange-50/50'
                            : '';
                        const pending = isRowPending(r.id)
                            ? ' opacity-60 pointer-events-none'
                            : '';
                        return base + pending;
                    }}
                    export={{ xlsx: true, filename: `Programme_Risk_Register_${format(new Date(), 'yyyy-MM-dd')}` }}
                    emptyState={{
                        title: 'No programme risks found.',
                        description: 'Escalated project risks will appear here automatically.',
                        icon: ShieldOff,
                    }}
                    toolbarActions={
                        canModify ? (
                            <button
                                onClick={() => { setEditingRisk(null); setIsModalOpen(true); }}
                                className="inline-flex items-center gap-2 h-10 px-4 bg-indigo-600 text-white rounded-lg text-[13px] font-semibold hover:bg-indigo-700 transition-all shadow-sm active:scale-95 whitespace-nowrap"
                            >
                                <Plus className="w-4 h-4" />
                                Add Programme Risk
                            </button>
                        ) : null
                    }
                />

                <RiskModal
                    isOpen={isModalOpen}
                    onClose={() => setIsModalOpen(false)}
                    onSave={async (d) => {
                        try {
                            if (editingRisk) {
                                await updateRisk(editingRisk.id, d);
                                toast.success('Risk updated.');
                            } else {
                                const newRisk: RiskItem = {
                                    ...d,
                                    id: generateId('R-PROG'),
                                    dateAdded: new Date().toISOString().split('T')[0],
                                } as RiskItem;
                                await addRisk(newRisk);
                                toast.success('Risk added to register.');
                            }
                        } catch (err: any) {
                            toast.error(err?.message || 'Failed to save risk.');
                            throw err;
                        }
                    }}
                    initialData={editingRisk}
                />

                <AIInquiryPopup
                    isOpen={isAIInquiryOpen}
                    onClose={() => {
                        setIsAIInquiryOpen(false);
                        setAiQuestion(undefined);
                    }}
                    initialQuestion={aiQuestion}
                    context={JSON.stringify({
                        type: 'programme_risks',
                        risks: allProg.map(r => ({ ...r, desc: stripMarkdown(r.desc || '') })),
                        totalGALE,
                        totalRALE,
                        pctReduction,
                        pendingEscalations: pendingRisks.length,
                    })}
                />

                {/* Dismiss-escalation confirmation.*/}
                <ConfirmDialog
                    open={dismissingRiskId !== null}
                    title="Dismiss this escalation?"
                    message="The risk will be returned to the project-level register and removed from the programme pending queue. The project manager can re-escalate later if needed."
                    confirmLabel="Dismiss escalation"
                    variant="danger"
                    loading={dismissPending}
                    onCancel={() => {
                        if (dismissPending) return;
                        setDismissingRiskId(null);
                    }}
                    onConfirm={async () => {
                        if (!dismissingRiskId || dismissPending) return;
                        setDismissPending(true);
                        try {
                            await dismissRisk(dismissingRiskId);
                            toast.success('Escalation dismissed.');
                            setDismissingRiskId(null);
                        } catch (err: any) {
                            toast.error(err?.message || 'Failed to dismiss escalation.');
                        } finally {
                            setDismissPending(false);
                        }
                    }}
                />
            </motion.div>
        </>
    );
}
