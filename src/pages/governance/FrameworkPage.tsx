import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import {
  Gavel,
  Pencil,
  Eye,
  Loader2,
  UploadCloud,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import { clsx } from 'clsx';
import toast from 'react-hot-toast';
import { api } from '../../lib/api';
import { FrameworkCanvas } from '../../components/governance/framework/FrameworkCanvas';
import { FrameworkBodyModal } from '../../components/governance/framework/FrameworkBodyModal';
import { AuthorityThresholdsEditor } from '../../components/governance/framework/AuthorityThresholdsEditor';
import { FrameworkExportMenu } from '../../components/governance/framework/FrameworkExportMenu';
import type {
  BodyTier,
  Framework,
  FrameworkBody,
  FrameworkSnapshot,
  FrameworkThreshold,
  TermsOfReference,
} from '../../components/governance/framework/types';
import { useHistoricalView } from '../../hooks/useHistoricalView';
import { MonthPicker } from '../../components/historicalReporting/MonthPicker';
import { HistoricalBanner } from '../../components/historicalReporting/HistoricalBanner';

// Replaces the Phase-0 placeholder. Authenticated PgMs land here, see the
// full 4-tier canvas, can toggle to edit mode, open per-body modals, edit
// thresholds + ToRs, and publish a new framework version.
export function GovernanceFrameworkPage() {
  //  historical view hook. Framework is multi-source (bodies +
  // thresholds + ToRs) so historical mode here is read-only-safe: we
  // force off edit mode + disable Publish, but the detail surfaces still
  // read from the live snapshot. Full per-collection swap lands in.
  const historicalView = useHistoricalView<{
    kind: 'governanceDoc';
    doc: any;
  }>({ collection: 'framework' });
  const isHistorical = historicalView.isHistorical;

  const [snapshot, setSnapshot] = useState<FrameworkSnapshot>({
    framework: null,
    bodies: [],
    thresholds: [],
    tors: {},
    publishedTors: {},
  });
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [openBody, setOpenBody] = useState<FrameworkBody | null>(null);
  const [draftTier, setDraftTier] = useState<BodyTier | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const res = await api.governanceGetFramework();
      setSnapshot({
        framework: (res.framework ?? null) as Framework | null,
        bodies: (res.bodies ?? []) as FrameworkBody[],
        thresholds: (res.thresholds ?? []) as FrameworkThreshold[],
        tors: (res.tors ?? {}) as Record<string, TermsOfReference>,
        publishedTors: (res.publishedTors ?? {}) as Record<string, TermsOfReference>,
      });
    } catch (e: any) {
      console.error('[FrameworkPage] load failed', e);
      toast.error(e?.message ?? 'Failed to load framework.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const handleOpenBody = (body: FrameworkBody) => {
    setOpenBody(body);
    setDraftTier(null);
    setModalOpen(true);
  };

  const handleAddBody = (tier: BodyTier) => {
    setOpenBody(null);
    setDraftTier(tier);
    setModalOpen(true);
  };

  const handleSaved = (body: FrameworkBody) => {
    setSnapshot((prev) => {
      const idx = prev.bodies.findIndex((b) => b._id === body._id);
      const next = [...prev.bodies];
      if (idx >= 0) next[idx] = body;
      else next.push(body);
      return { ...prev, bodies: next, framework: prev.framework ? { ...prev.framework, status: 'draft' } : prev.framework };
    });
  };

  const handleDeleted = (bodyId: string) => {
    setSnapshot((prev) => ({
      ...prev,
      bodies: prev.bodies.filter((b) => b.id !== bodyId),
      framework: prev.framework ? { ...prev.framework, status: 'draft' } : prev.framework,
    }));
  };

  const handleTorSaved = (tor: TermsOfReference) => {
    setSnapshot((prev) => {
      // Saved doc is always the "active" (draft or newly-published).
      const nextTors = { ...prev.tors, [tor.ownerBodyId]: tor };
      // Published saves also update the "last published" map so the status
      // badge reflects reality next time we render.
      const nextPublishedTors =
        tor.status === 'published'
          ? { ...prev.publishedTors, [tor.ownerBodyId]: tor }
          : prev.publishedTors;
      return { ...prev, tors: nextTors, publishedTors: nextPublishedTors };
    });
  };

  const handleThresholdsChange = (next: FrameworkThreshold[]) => {
    setSnapshot((prev) => ({
      ...prev,
      thresholds: next,
      framework: prev.framework ? { ...prev.framework, status: 'draft' } : prev.framework,
    }));
  };

  const handlePublish = async () => {
    setPublishing(true);
    try {
      const res = await api.governancePublishFramework();
      toast.success(`Framework v${res.version} published`);
      setSnapshot((prev) => ({
        ...prev,
        framework: prev.framework
          ? { ...prev.framework, version: res.version, status: 'published', publishedAt: new Date().toISOString() }
          : prev.framework,
      }));
      setEditMode(false);
    } catch (e: any) {
      console.error('[FrameworkPage] publish failed', e);
      toast.error(e?.message ?? 'Publish failed.');
    } finally {
      setPublishing(false);
    }
  };

  const statusBadge = useMemo(() => {
    const fw = snapshot.framework;
    if (!fw) return null;
    if (fw.status === 'published') {
      return {
        icon: CheckCircle2,
        label: `v${fw.version} · Published`,
        cls: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      };
    }
    if (fw.status === 'draft') {
      return {
        icon: AlertTriangle,
        label: `v${fw.version} · Draft · unpublished changes`,
        cls: 'bg-amber-50 text-amber-700 border-amber-200',
      };
    }
    return null;
  }, [snapshot.framework]);

  const currentTor = openBody ? snapshot.tors[openBody.id] ?? null : null;
  const lastPublishedTor = openBody
    ? snapshot.publishedTors[openBody.id] ?? null
    : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
    >
      <header className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
            <Gavel className="h-5 w-5" strokeWidth={2.25} />
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">
              Programme Governance
            </p>
            <h1 className="text-xl font-bold tracking-tight text-slate-900 md:text-2xl">
              Framework
            </h1>
            <p className="mt-1 max-w-2xl text-sm text-slate-500">
              Four-tier governance model for your council. Edit bodies, set authority thresholds
              and publish a new version for Cabinet / Council Constitution alignment.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* month picker for historical view.*/}
          <MonthPicker
            monthEnd={historicalView.monthEnd}
            availableMonths={historicalView.availableMonths}
            onChange={historicalView.setMonthEnd}
            loading={historicalView.loading}
          />
          {statusBadge && (
            <span
              className={clsx(
                'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-semibold',
                statusBadge.cls,
              )}
            >
              <statusBadge.icon className="h-3.5 w-3.5" />
              {statusBadge.label}
            </span>
          )}
          {!isHistorical && <FrameworkExportMenu />}
          {!isHistorical && (
            <button
              type="button"
              onClick={() => setEditMode((v) => !v)}
              className={clsx(
                'inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-xs font-semibold transition-colors',
                editMode
                  ? 'border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100'
                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50',
              )}
            >
              {editMode ? <Eye className="h-3.5 w-3.5" /> : <Pencil className="h-3.5 w-3.5" />}
              {editMode ? 'View mode' : 'Edit framework'}
            </button>
          )}
          {!isHistorical && (
            <button
              type="button"
              onClick={handlePublish}
              disabled={
                publishing || loading || snapshot.framework?.status !== 'draft'
              }
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-indigo-600 px-3 text-xs font-semibold text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {publishing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UploadCloud className="h-3.5 w-3.5" />}
              Publish new version
            </button>
          )}
        </div>
      </header>

      {isHistorical && historicalView.monthEnd && (
        <div className="mb-6">
          <HistoricalBanner
            monthEnd={historicalView.monthEnd}
            meta={historicalView.meta}
            onExit={() => historicalView.setMonthEnd(null)}
            defaultCorrectionCollection="framework"
            emptyReason={historicalView.emptyReason}
            activatedYearMonth={historicalView.activatedYearMonth}
            surfaceLabel="framework"
          />
        </div>
      )}

      {loading || historicalView.loading ? (
        <div className="space-y-4">
          <div className="h-40 animate-pulse rounded-lg bg-slate-100" />
          <div className="h-40 animate-pulse rounded-lg bg-slate-100" />
          <div className="h-40 animate-pulse rounded-lg bg-slate-100" />
        </div>
      ) : (
        <div className="space-y-6">
          <FrameworkCanvas
            bodies={snapshot.bodies}
            editMode={editMode}
            onOpenBody={handleOpenBody}
            onAddBody={handleAddBody}
          />
          <AuthorityThresholdsEditor
            thresholds={snapshot.thresholds}
            editMode={editMode}
            onChange={handleThresholdsChange}
          />
        </div>
      )}

      <FrameworkBodyModal
        isOpen={modalOpen}
        body={openBody}
        draftTier={draftTier}
        tor={currentTor}
        lastPublishedTor={lastPublishedTor}
        onClose={() => setModalOpen(false)}
        onSaved={handleSaved}
        onDeleted={handleDeleted}
        onTorSaved={handleTorSaved}
      />
    </motion.div>
  );
}
