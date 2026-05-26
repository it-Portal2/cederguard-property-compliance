import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus,
  Calendar,
  ExternalLink,
  Lightbulb,
  X,
  AlertCircle,
  CheckCircle2,
  MessageSquare,
  Trash2,
  BookOpen,
} from 'lucide-react';
import { useStore } from '../store/useStore';
import { clsx } from 'clsx';
import { AIWriter } from '../components/AIWriter';
import { generateId } from '../lib/utils';
import toast from 'react-hot-toast';
import DynamicTable from '../components/table/DynamicTable';
import type {
  ColumnDef,
  RowAction,
  FilterDef,
} from '../components/table/types';

interface LessonRow {
  id: string;
  title: string;
  category: string;
  project: string;
  problem: string;
  impact?: string;
  resolution: string;
  prevention: string;
  tags: string[];
  date: string;
}

const CATEGORIES = ['Safety', 'Contractual', 'Technical', 'Compliance', 'Budget'];

const CATEGORY_BAR: Record<string, string> = {
  Safety: 'bg-red-500',
  Technical: 'bg-indigo-500',
  Contractual: 'bg-amber-500',
  Compliance: 'bg-emerald-500',
  Budget: 'bg-violet-500',
};

export function LessonsLearned() {
  const { lessonsLearned, addLessonLearned, deleteLessonLearned, projects, programmes, risks } = useStore();
  const [isAddingLesson, setIsAddingLesson] = useState(false);
  const [selectedLesson, setSelectedLesson] = useState<LessonRow | null>(null);

  const safeProjects = Array.isArray(projects) ? projects : [];
  const safeProgrammes = Array.isArray(programmes) ? programmes : [];
  const safeLessons: LessonRow[] = Array.isArray(lessonsLearned) ? lessonsLearned : [];

  // Computed stats from real data
  const costAvoidance = (Array.isArray(risks) ? risks : []).reduce(
    (sum, r) => sum + (r.riskReduction || 0),
    0,
  );
  const formatCostAvoidance = (val: number) => {
    if (val >= 1_000_000) return `£${(val / 1_000_000).toFixed(1)}M`;
    if (val >= 1_000) return `£${(val / 1_000).toFixed(1)}K`;
    return `£${Math.round(val).toLocaleString()}`;
  };
  const currentMonth = new Date().toISOString().slice(0, 7);
  const thisMonthCount = safeLessons.filter((l) => l.date?.startsWith(currentMonth)).length;

  const [newLesson, setNewLesson] = useState({
    title: '',
    category: 'Safety',
    project: '',
    problem: '',
    impact: '',
    resolution: '',
    prevention: '',
    tags: [] as string[],
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const lesson: LessonRow = {
      ...newLesson,
      id: generateId('LL'),
      date: new Date().toISOString().split('T')[0],
    };
    addLessonLearned(lesson);
    toast.success('Lesson captured to repository');
    setIsAddingLesson(false);
    setNewLesson({
      title: '',
      category: 'Safety',
      project: '',
      problem: '',
      impact: '',
      resolution: '',
      prevention: '',
      tags: [],
    });
  };

  // ── Columns ────────────────────────────────────────────────────────────────
  const columns: ColumnDef<LessonRow>[] = [
    {
      key: 'category',
      label: 'Category',
      width: '8px',
      render: (v) => (
        <span
          className={clsx(
            'inline-block w-1.5 h-6 rounded-sm align-middle',
            CATEGORY_BAR[v as string] || 'bg-slate-400',
          )}
          title={v as string}
          aria-label={v as string}
        />
      ),
    },
    {
      key: 'title',
      label: 'Lesson',
      sortable: true,
      render: (_v, r) => (
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="font-mono text-[10px] font-medium text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded uppercase tracking-wide">
              {r.category}
            </span>
          </div>
          <div className="text-[13px] font-semibold text-slate-900">{r.title}</div>
          <div className="text-[11px] text-slate-500 mt-0.5 line-clamp-1" title={r.problem}>
            Problem: {r.problem}
          </div>
        </div>
      ),
    },
    {
      key: 'project',
      label: 'Project / Programme',
      width: '180px',
      render: (v) => (
        <span className="text-[11px] text-slate-600 font-medium truncate">
          {v || '—'}
        </span>
      ),
    },
    {
      key: 'date',
      label: 'Date Logged',
      width: '120px',
      sortable: true,
      render: (v) => (
        <div className="flex items-center gap-1.5 text-slate-600 text-[11px] font-medium whitespace-nowrap">
          <Calendar className="w-3.5 h-3.5 text-indigo-400" />
          {v}
        </div>
      ),
    },
    {
      key: 'tags',
      label: 'Tags',
      width: '200px',
      render: (v) => {
        const tags = (v as string[]) || [];
        if (tags.length === 0)
          return <span className="text-[11px] text-slate-300">—</span>;
        return (
          <div className="flex flex-wrap gap-1">
            {tags.slice(0, 3).map((tag) => (
              <span
                key={tag}
                className="font-mono text-[10px] font-medium text-slate-500 bg-slate-50 border border-slate-200 px-1.5 py-0.5 rounded"
              >
                #{tag}
              </span>
            ))}
            {tags.length > 3 && (
              <span className="text-[10px] text-slate-400">+{tags.length - 3}</span>
            )}
          </div>
        );
      },
    },
  ];

  // ── Filters ────────────────────────────────────────────────────────────────
  const filters: FilterDef<LessonRow>[] = [
    {
      key: 'category',
      label: 'Category',
      type: 'select',
      placeholder: 'All categories',
      options: CATEGORIES.map((c) => ({ value: c, label: c })),
    },
  ];

  // ── Row actions ────────────────────────────────────────────────────────────
  const rowActions: RowAction<LessonRow>[] = [
    {
      key: 'view',
      label: 'View insight',
      icon: ExternalLink,
      onClick: (r) => setSelectedLesson(r),
    },
    {
      key: 'delete',
      label: 'Delete',
      icon: Trash2,
      isDanger: true,
      requireConfirm: {
        icon: Trash2,
        variant: 'danger' as const,
        title: 'Delete lesson',
        message: (r: LessonRow) =>
          `Permanently delete "${r.title}" from the repository? This cannot be undone.`,
        confirmLabel: 'Delete',
        isDanger: true,
      },
      onClick: async (r) => {
        await deleteLessonLearned(r.id);
        toast.success(`"${r.title}" removed from repository`);
      },
    },
  ];

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 flex items-center gap-2">
            <Lightbulb className="w-8 h-8 text-amber-500" />
            Lessons Learned Repository
          </h1>
          <p className="text-slate-500 font-medium">
            Shared knowledge base for project risk mitigation and process improvement.
          </p>
        </div>
      </div>

      {/* Stats/Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-lg border border-indigo-100 shadow-sm flex flex-col">
          <span className="font-mono text-[10px] font-medium text-indigo-400 uppercase tracking-wide mb-1">
            Total Insights
          </span>
          <span className="text-3xl font-medium text-slate-900 leading-none tabular-nums">
            {safeLessons.length}
          </span>
          <div className="mt-3 text-[11px] font-bold text-emerald-600 bg-emerald-50 self-start px-2 py-0.5 rounded-full">
            {thisMonthCount > 0 ? `+${thisMonthCount} this month` : 'None this month'}
          </div>
        </div>
        <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm flex flex-col">
          <span className="font-mono text-[10px] font-medium text-slate-400 uppercase tracking-wide mb-1">
            Safety Wins
          </span>
          <span className="text-3xl font-medium text-slate-900 leading-none tabular-nums">
            {safeLessons.filter((l) => l.category === 'Safety').length}
          </span>
          <div className="mt-3 text-[11px] font-bold text-slate-400">
            Critical preventing measures
          </div>
        </div>
        <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm flex flex-col">
          <span className="font-mono text-[10px] font-medium text-slate-400 uppercase tracking-wide mb-1">
            Cost Avoidance
          </span>
          <span className="text-3xl font-medium text-slate-900 leading-none tabular-nums">
            {costAvoidance > 0 ? formatCostAvoidance(costAvoidance) : '—'}
          </span>
          <div className="mt-3 text-[11px] font-bold text-emerald-600">Documented savings</div>
        </div>
        <div className="bg-white/50 p-5 rounded-lg border-2 border-dashed border-slate-200 flex flex-col items-center justify-center text-center">
          <span className="text-[11px] font-bold text-slate-400">Export Knowledge Hub</span>
          <button className="text-[11px] font-semibold text-indigo-600 hover:underline">
            Download PDF Report
          </button>
        </div>
      </div>

      <DynamicTable<LessonRow>
        data={safeLessons}
        columns={columns}
        filters={filters}
        rowActions={rowActions}
        searchable
        searchPlaceholder="Search knowledge base..."
        searchFields={['title', 'problem', 'resolution']}
        getRowId={(r) => r.id}
        onRowClick={(r) => setSelectedLesson(r)}
        pagination={{
          enabled: true,
          pageSize: 25,
          pageSizeOptions: [10, 25, 50],
        }}
        headerVariant="light"
        stickyHeader
        emptyState={{
          icon: BookOpen,
          title: 'No lessons captured yet',
          description: 'Capture a lesson from a recent project event to start the repository.',
        }}
        toolbarActions={
          <button
            onClick={() => setIsAddingLesson(true)}
            className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white font-semibold rounded-lg hover:bg-slate-800 transition-all shadow-md active:scale-95 text-xs"
          >
            <Plus className="w-4 h-4" />
            Capture Lesson
          </button>
        }
      />

      {/* Capture Modal */}
      <AnimatePresence>
        {isAddingLesson && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
              onClick={() => setIsAddingLesson(false)}
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-2xl bg-white rounded-lg shadow-2xl overflow-hidden"
            >
              <div className="p-8">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-2xl font-semibold text-slate-900">Capture New Lesson</h2>
                  <button
                    onClick={() => setIsAddingLesson(false)}
                    className="text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-slate-500">Lesson Title</label>
                      <input
                        required
                        type="text"
                        value={newLesson.title}
                        onChange={(e) => setNewLesson({ ...newLesson, title: e.target.value })}
                        className="w-full px-4 py-2 border border-slate-200 rounded-lg text-sm font-medium focus:ring-2 focus:ring-indigo-500"
                        placeholder="e.g., Structural Steel Sourcing Delays"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-slate-500">
                        Project / Programme Context
                      </label>
                      <select
                        required
                        value={newLesson.project}
                        onChange={(e) => setNewLesson({ ...newLesson, project: e.target.value })}
                        className="w-full px-4 py-2 border border-slate-200 rounded-lg text-sm font-medium focus:ring-2 focus:ring-indigo-500"
                      >
                        <option value="">— Select project or programme —</option>
                        {safeProgrammes.length > 0 && (
                          <optgroup label="Programmes">
                            {safeProgrammes.map((p) => (
                              <option key={p.id} value={p.name}>
                                {p.name}
                              </option>
                            ))}
                          </optgroup>
                        )}
                        {safeProjects.length > 0 && (
                          <optgroup label="Projects">
                            {safeProjects.map((p) => (
                              <option key={p.id} value={p.name}>
                                {p.name}
                              </option>
                            ))}
                          </optgroup>
                        )}
                      </select>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-medium text-slate-500">
                        What happened? (The Problem)
                      </label>
                      <AIWriter
                        context={`Briefly describe a project problem or risk event for the project: ${newLesson.project}. Title: ${newLesson.title}`}
                        onSuggest={(val) => setNewLesson({ ...newLesson, problem: val })}
                        placeholder="e.g. root cause, circumstances that led to this, when it was first noticed"
                        className="scale-90"
                      />
                    </div>
                    <textarea
                      required
                      value={newLesson.problem}
                      onChange={(e) => setNewLesson({ ...newLesson, problem: e.target.value })}
                      className="w-full px-4 py-2 border border-slate-200 rounded-lg text-sm font-medium h-20 focus:ring-2 focus:ring-indigo-500"
                      placeholder="Describe the situation or error encountered..."
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-xs font-medium text-slate-500">
                          How was it resolved?
                        </label>
                        <AIWriter
                          context={`Suggest an effective resolution for the problem: ${newLesson.problem}. Project: ${newLesson.project}`}
                          onSuggest={(val) => setNewLesson({ ...newLesson, resolution: val })}
                          placeholder="e.g. steps taken, who resolved it, what was agreed"
                          className="scale-90"
                        />
                      </div>
                      <textarea
                        required
                        value={newLesson.resolution}
                        onChange={(e) =>
                          setNewLesson({ ...newLesson, resolution: e.target.value })
                        }
                        className="w-full px-4 py-2 border border-slate-200 rounded-lg text-sm font-medium h-20 focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-xs font-medium text-slate-500">Future Prevention</label>
                        <AIWriter
                          context={`Based on the problem: ${newLesson.problem} and resolution: ${newLesson.resolution}, what should be done to prevent this from happening again?`}
                          onSuggest={(val) => setNewLesson({ ...newLesson, prevention: val })}
                          placeholder="e.g. process change, new check, or training to prevent recurrence"
                          className="scale-90"
                        />
                      </div>
                      <textarea
                        required
                        value={newLesson.prevention}
                        onChange={(e) =>
                          setNewLesson({ ...newLesson, prevention: e.target.value })
                        }
                        className="w-full px-4 py-2 border border-slate-200 rounded-lg text-sm font-medium h-20 focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="w-full py-4 bg-slate-900 text-white font-semibold rounded-lg hover:bg-slate-800 transition-all shadow-xl active:scale-95"
                  >
                    Save to Repository
                  </button>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* View Modal */}
      <AnimatePresence>
        {selectedLesson && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
              onClick={() => setSelectedLesson(null)}
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="relative w-full max-w-3xl bg-white rounded-lg shadow-2xl overflow-hidden"
            >
              <div className="p-8">
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <div className="flex items-center gap-3 mb-2">
                      <span className="font-mono text-[10px] font-medium text-indigo-600 bg-indigo-50 px-2 py-1 rounded uppercase tracking-wide">
                        {selectedLesson.category}
                      </span>
                      <span className="text-xs font-bold text-slate-400 flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5" />
                        {selectedLesson.date}
                      </span>
                    </div>
                    <h2 className="text-3xl font-semibold text-slate-900 leading-tight">
                      {selectedLesson.title}
                    </h2>
                  </div>
                  <button
                    onClick={() => setSelectedLesson(null)}
                    className="p-2 hover:bg-slate-100 rounded-full transition-colors"
                  >
                    <X className="w-6 h-6 text-slate-400" />
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-6">
                    <div className="flex gap-4">
                      <div className="p-3 bg-red-50 text-red-500 rounded-lg flex-shrink-0 h-fit">
                        <AlertCircle className="w-6 h-6" />
                      </div>
                      <div>
                        <h4 className="font-mono text-[10px] font-medium text-slate-400 uppercase tracking-wide mb-1">
                          The Problem
                        </h4>
                        <p className="text-sm font-bold text-slate-700 leading-relaxed">
                          {selectedLesson.problem}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-4">
                      <div className="p-3 bg-indigo-50 text-indigo-600 rounded-lg flex-shrink-0 h-fit">
                        <CheckCircle2 className="w-6 h-6" />
                      </div>
                      <div>
                        <h4 className="font-mono text-[10px] font-medium text-slate-400 uppercase tracking-wide mb-1">
                          Resolution Applied
                        </h4>
                        <p className="text-sm font-bold text-slate-700 leading-relaxed">
                          {selectedLesson.resolution}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-6">
                    <div className="flex gap-4">
                      <div className="p-3 bg-amber-50 text-amber-500 rounded-lg flex-shrink-0 h-fit">
                        <Lightbulb className="w-6 h-6" />
                      </div>
                      <div>
                        <h4 className="font-mono text-[10px] font-medium text-slate-400 uppercase tracking-wide mb-1">
                          Prevention & Strategy
                        </h4>
                        <p className="text-sm font-bold text-slate-700 leading-relaxed">
                          {selectedLesson.prevention}
                        </p>
                      </div>
                    </div>
                    <div className="p-6 bg-slate-50 rounded-lg border border-slate-100">
                      <h4 className="font-mono text-[10px] font-medium text-slate-400 uppercase tracking-wide mb-3">
                        Linked Context
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        {(selectedLesson.tags || []).map((tag: string) => (
                          <span
                            key={tag}
                            className="px-3 py-1.5 bg-white text-[11px] font-semibold text-slate-600 rounded-lg border border-slate-200"
                          >
                            #{tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-10 pt-6 border-t border-slate-100 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2 text-slate-400">
                    <MessageSquare className="w-4 h-4" />
                    <span className="text-[11px] font-bold">4 comments from PM team</span>
                  </div>
                  <button className="flex items-center gap-2 text-indigo-600 font-semibold text-sm hover:underline">
                    View in Risk Register <ExternalLink className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
