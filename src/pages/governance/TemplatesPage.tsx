import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { FileText, Search, Plus } from 'lucide-react';
import { clsx } from 'clsx';
import toast from 'react-hot-toast';
import { api } from '../../lib/api';
import { TemplateCard } from '../../components/governance/templates/TemplateCard';
import { TemplateEditorModal } from '../../components/governance/templates/TemplateEditorModal';
import { AiRecommendationCard } from '../../components/governance/templates/AiRecommendationCard';
import { TextInputDialog } from '../../components/governance/TextInputDialog';
import {
  type ReportTemplate,
  type TemplateCategory,
  CATEGORY_FILTERS,
} from '../../components/governance/templates/types';
import { useStore } from '../../store/useStore';
import { isAtLeastClientAdmin, isSuperAdmin } from '../../lib/roles';
import { useHistoricalView } from '../../hooks/useHistoricalView';
import { MonthPicker } from '../../components/historicalReporting/MonthPicker';
import { HistoricalBanner } from '../../components/historicalReporting/HistoricalBanner';

// Replaces the Phase-0 placeholder. Library grid + AI recommendation +
// filter chips + editor modal. Accessible to PMs in read mode (open the
// template to see sections) and PgMs in edit mode.
export function GovernanceTemplatesPage() {
  const user = useStore((s) => s.user);
  const isSuperAdminUser = isSuperAdmin(user?.email, user?.role);
  const canEditLive = isAtLeastClientAdmin(user?.role) || isSuperAdminUser;

  //  historical view hook. When the user picks a past month,
  // the page swaps live templates for the snapshot's frozen state and
  // disables every edit affordance.
  const historicalView = useHistoricalView<{
    kind: 'governanceDoc';
    doc: ReportTemplate;
  }>({ collection: 'templates' });
  const isHistorical = historicalView.isHistorical;
  const canEdit = canEditLive && !isHistorical;

  const [templates, setTemplates] = useState<ReportTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<TemplateCategory | 'all'>('all');
  const [search, setSearch] = useState('');
  const [opened, setOpened] = useState<ReportTemplate | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [duplicating, setDuplicating] = useState(false);
  const [duplicateTarget, setDuplicateTarget] = useState<ReportTemplate | null>(
    null,
  );

  const refresh = useCallback(async () => {
    try {
      const res = await api.governanceListTemplates();
      const list = ((res.templates ?? []) as ReportTemplate[]).sort((a, b) =>
        (a.title ?? '').localeCompare(b.title ?? ''),
      );
      setTemplates(list);
    } catch (e: any) {
      console.error('[TemplatesPage] load failed', e);
      toast.error(e?.message ?? 'Failed to load templates.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  //  effective list source. Snapshot-derived list when historical.
  const historicalTemplates = useMemo<ReportTemplate[]>(() => {
    if (!isHistorical) return [];
    return historicalView.entries
      .map((e) => (e?.doc as ReportTemplate | undefined))
      .filter((d): d is ReportTemplate => !!d);
  }, [isHistorical, historicalView.entries]);
  const effectiveTemplates = isHistorical ? historicalTemplates : templates;

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return effectiveTemplates.filter((t) => {
      if (filter !== 'all' && t.category !== filter) return false;
      if (needle) {
        const hay = `${t.code} ${t.title} ${t.description} ${t.defaultRoute}`.toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
  }, [effectiveTemplates, filter, search]);

  const handleOpen = async (template: ReportTemplate) => {
    // Reload fresh — list call may return shallow / stale section content.
    setOpeningId(template.id);
    try {
      const res = await api.governanceGetTemplate(template.id);
      setOpened(res.template as ReportTemplate);
      setModalOpen(true);
    } catch (e: any) {
      console.error('[TemplatesPage] open failed', e);
      toast.error(e?.message ?? 'Failed to open template.');
    } finally {
      setOpeningId(null);
    }
  };

  const handleDuplicate = (template: ReportTemplate) => {
    if (!canEdit) return;
    setDuplicateTarget(template);
  };

  const confirmDuplicate = async (newId: string) => {
    if (!duplicateTarget) return;
    setDuplicating(true);
    try {
      const res = await api.governanceDuplicateTemplate(duplicateTarget.id, newId);
      const copy = res.template as ReportTemplate;
      setTemplates((prev) =>
        [...prev, copy].sort((a, b) =>
          (a.title ?? '').localeCompare(b.title ?? ''),
        ),
      );
      toast.success('Template duplicated');
      setDuplicateTarget(null);
      setOpened(copy);
      setModalOpen(true);
    } catch (e: any) {
      console.error('[TemplatesPage] duplicate failed', e);
      toast.error(e?.message ?? 'Duplicate failed.');
    } finally {
      setDuplicating(false);
    }
  };

  const handleSaved = (template: ReportTemplate) => {
    setTemplates((prev) => {
      const idx = prev.findIndex((t) => t.id === template.id);
      const next = [...prev];
      if (idx >= 0) next[idx] = template;
      else next.push(template);
      return next.sort((a, b) => (a.title ?? '').localeCompare(b.title ?? ''));
    });
    setOpened(template);
  };

  const handleDuplicatedFromModal = (template: ReportTemplate) => {
    setTemplates((prev) =>
      [...prev, template].sort((a, b) => (a.title ?? '').localeCompare(b.title ?? '')),
    );
    setOpened(template);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className="mx-auto space-y-6"
    >
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
            <FileText className="h-5 w-5" strokeWidth={2.25} />
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">
              Programme Governance
            </p>
            <h1 className="text-xl font-bold tracking-tight text-slate-900 md:text-2xl">
              Reports &amp; templates
            </h1>
            <p className="mt-1 max-w-2xl text-sm text-slate-500">
              Library of statutory report templates. Customise sections, set authoring
              defaults, and publish new versions for your council.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* month picker for historical view.*/}
          <MonthPicker
            monthEnd={historicalView.monthEnd}
            availableMonths={historicalView.availableMonths}
            onChange={historicalView.setMonthEnd}
            loading={historicalView.loading}
          />
          {canEdit && (
            <button
              type="button"
              onClick={() => {
                setOpened(null);
                setModalOpen(true);
              }}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-indigo-600 px-3 text-xs font-semibold text-white transition-colors hover:bg-indigo-700"
            >
              <Plus className="h-3.5 w-3.5" />
              New template
            </button>
          )}
        </div>
      </header>

      {isHistorical && historicalView.monthEnd && (
        <HistoricalBanner
          monthEnd={historicalView.monthEnd}
          meta={historicalView.meta}
          onExit={() => historicalView.setMonthEnd(null)}
        />
      )}

      {!isHistorical && (
        <AiRecommendationCard onSelect={handleOpen} openingId={openingId} />
      )}

      {/* Filters + search*/}
      <section className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap gap-1.5">
          {CATEGORY_FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              className={clsx(
                'inline-flex h-8 items-center rounded-full border px-3 text-xs font-semibold transition-colors',
                filter === f.key
                  ? 'border-indigo-600 bg-indigo-600 text-white'
                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50',
              )}
            >
              {f.label}
              <span
                className={clsx(
                  'ml-1.5 rounded-full px-1.5 text-[10px] font-semibold',
                  filter === f.key
                    ? 'bg-white/20 text-white'
                    : 'bg-slate-100 text-slate-600',
                )}
              >
                {f.key === 'all'
                  ? effectiveTemplates.length
                  : effectiveTemplates.filter((t) => t.category === f.key).length}
              </span>
            </button>
          ))}
        </div>
        <div className="relative w-full md:w-64">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search title or code…"
            className="h-9 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-xs text-slate-800 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
          />
        </div>
      </section>

      {/* Grid*/}
      {loading || historicalView.loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
            <div key={i} className="h-48 animate-pulse rounded-xl bg-slate-100" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/60 p-10 text-center">
          <FileText className="mx-auto h-8 w-8 text-slate-300" />
          <p className="mt-3 text-sm font-semibold text-slate-700">No templates match</p>
          <p className="mt-1 text-xs text-slate-500">Try another filter or clear the search.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((t) => (
            <TemplateCard
              key={t._id}
              template={t}
              canEdit={canEdit}
              onOpen={handleOpen}
              onDuplicate={handleDuplicate}
              isOpening={openingId === t.id}
              anyOpening={openingId !== null}
            />
          ))}
        </div>
      )}

      <TemplateEditorModal
        isOpen={modalOpen}
        template={opened}
        existingTemplates={templates}
        canEdit={canEdit}
        isSuperAdmin={isSuperAdminUser}
        onClose={() => setModalOpen(false)}
        onSaved={handleSaved}
        onDuplicated={handleDuplicatedFromModal}
      />

      <TextInputDialog
        open={duplicateTarget !== null}
        title="Duplicate template"
        message="Pick a new ID for the copy. Letters, digits, underscores and hyphens only."
        inputLabel="New template ID"
        placeholder="e.g. gw1-housing-variant"
        defaultValue={duplicateTarget ? `${duplicateTarget.id}-copy` : ''}
        validate={(v) =>
          /^[a-z0-9_-]{2,80}$/i.test(v)
            ? null
            : 'Use 2–80 letters, digits, underscores or hyphens.'
        }
        confirmLabel="Duplicate"
        loading={duplicating}
        onConfirm={confirmDuplicate}
        onCancel={() => (duplicating ? null : setDuplicateTarget(null))}
      />
    </motion.div>
  );
}
