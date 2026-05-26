import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  BookOpen, Search, Filter, Plus, FileBarChart, 
  ChevronRight, Tag, Calendar, ExternalLink, Lightbulb,
  X, AlertCircle, CheckCircle2, MessageSquare
} from 'lucide-react';
import { useStore } from '../store/useStore';
import { clsx } from 'clsx';
import { AIWriter } from '../components/AIWriter';
import { generateId } from '../lib/utils';

export function LessonsLearned() {
  const { lessonsLearned, addLessonLearned, projects, programmes, risks } = useStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const [isAddingLesson, setIsAddingLesson] = useState(false);
  const [selectedLesson, setSelectedLesson] = useState<any>(null);

  const categories = ['All', 'Safety', 'Contractual', 'Technical', 'Compliance', 'Budget'];
  
  const filteredLessons = (lessonsLearned || []).filter(l => {
    const matchesSearch = l.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                         l.problem.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         l.resolution.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = activeCategory === 'All' || l.category === activeCategory;
    return matchesSearch && matchesCategory;
  });

  const safeProjects = Array.isArray(projects) ? projects : [];
  const safeProgrammes = Array.isArray(programmes) ? programmes : [];

  // Computed stats from real data
  const costAvoidance = (Array.isArray(risks) ? risks : []).reduce((sum, r) => sum + (r.riskReduction || 0), 0);
  const formatCostAvoidance = (val: number) => {
    if (val >= 1_000_000) return `£${(val / 1_000_000).toFixed(1)}M`;
    if (val >= 1_000) return `£${(val / 1_000).toFixed(1)}K`;
    return `£${Math.round(val).toLocaleString()}`;
  };
  const currentMonth = new Date().toISOString().slice(0, 7);
  const thisMonthCount = (lessonsLearned || []).filter(l => l.date?.startsWith(currentMonth)).length;

  const [newLesson, setNewLesson] = useState({
    title: '',
    category: 'Safety',
    project: '',
    problem: '',
    impact: '',
    resolution: '',
    prevention: '',
    tags: [] as string[]
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const lesson = {
      ...newLesson,
      id: generateId('LL'),
      date: new Date().toISOString().split('T')[0]
    };
    addLessonLearned(lesson);
    setIsAddingLesson(false);
    setNewLesson({
      title: '',
      category: 'Safety',
      project: '',
      problem: '',
      impact: '',
      resolution: '',
      prevention: '',
      tags: []
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 flex items-center gap-2">
            <Lightbulb className="w-8 h-8 text-amber-500" />
            Lessons Learned Repository
          </h1>
          <p className="text-slate-500 font-medium">Shared knowledge base for project risk mitigation and process improvement.</p>
        </div>
        
        <button
          onClick={() => setIsAddingLesson(true)}
          className="flex items-center gap-2 px-6 py-3 bg-slate-900 text-white font-semibold rounded-lg hover:bg-slate-800 transition-all shadow-lg active:scale-95"
        >
          <Plus className="w-5 h-5" />
          Capture Lesson
        </button>
      </div>

      {/* Stats/Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-lg border border-indigo-100 shadow-sm flex flex-col">
          <span className="text-[10px] font-mono font-medium text-indigo-400 uppercase tracking-wide mb-1">Total Insights</span>
          <span className="text-3xl font-medium text-slate-900 leading-none tabular-nums">{lessonsLearned.length}</span>
          <div className="mt-3 text-[11px] font-bold text-emerald-600 bg-emerald-50 self-start px-2 py-0.5 rounded-full">
            {thisMonthCount > 0 ? `+${thisMonthCount} this month` : 'None this month'}
          </div>
        </div>
        <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm flex flex-col">
          <span className="text-[10px] font-mono font-medium text-slate-400 uppercase tracking-wide mb-1">Safety Wins</span>
          <span className="text-3xl font-medium text-slate-900 leading-none tabular-nums">
            {lessonsLearned.filter(l => l.category === 'Safety').length}
          </span>
          <div className="mt-3 text-[11px] font-bold text-slate-400">Critical preventing measures</div>
        </div>
        <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm flex flex-col">
          <span className="text-[10px] font-mono font-medium text-slate-400 uppercase tracking-wide mb-1">Cost Avoidance</span>
          <span className="text-3xl font-medium text-slate-900 leading-none tabular-nums">
            {costAvoidance > 0 ? formatCostAvoidance(costAvoidance) : '—'}
          </span>
          <div className="mt-3 text-[11px] font-bold text-emerald-600">Documented savings</div>
        </div>
        <div className="bg-white/50 p-5 rounded-lg border-2 border-dashed border-slate-200 flex flex-col items-center justify-center text-center">
          <span className="text-[11px] font-bold text-slate-400">Export Knowledge Hub</span>
          <button className="text-[11px] font-semibold text-indigo-600 hover:underline">Download PDF Report</button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="flex p-1 bg-slate-100 rounded-lg w-full md:w-auto overflow-x-auto">
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={clsx(
                "px-4 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap",
                activeCategory === cat 
                  ? "bg-white text-indigo-600 shadow-sm" 
                  : "text-slate-500 hover:text-slate-900"
              )}
            >
              {cat}
            </button>
          ))}
        </div>
        
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search knowledge base..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-lg text-sm font-medium focus:ring-2 focus:ring-indigo-500 transition-all shadow-sm"
          />
        </div>
      </div>

      {/* Lessons List */}
      <div className="space-y-4">
        {filteredLessons.map((lesson) => (
          <motion.div
            layout
            key={lesson.id}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            className="bg-white rounded-lg border border-slate-200 shadow-sm hover:shadow-md transition-all overflow-hidden cursor-pointer group"
            onClick={() => setSelectedLesson(lesson)}
          >
            <div className="flex items-stretch">
              <div className={clsx(
                "w-2 flex-shrink-0 transition-opacity",
                lesson.category === 'Safety' ? 'bg-red-500' :
                lesson.category === 'Technical' ? 'bg-indigo-500' :
                lesson.category === 'Contractual' ? 'bg-amber-500' :
                'bg-slate-400'
              )} />
              
              <div className="p-5 flex-1 flex flex-col md:flex-row md:items-center gap-6">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-[10px] font-mono font-medium text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded uppercase tracking-wide">
                      {lesson.category}
                    </span>
                    <span className="text-xs font-bold text-slate-400 flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5" />
                      {lesson.date}
                    </span>
                  </div>
                  <h3 className="text-lg font-semibold text-slate-900 group-hover:text-indigo-600 transition-colors">
                    {lesson.title}
                  </h3>
                  <p className="text-slate-500 text-[13px] font-medium line-clamp-1 mt-1 ">
                    Problem: {lesson.problem}
                  </p>
                </div>
                
                <div className="flex flex-wrap gap-2 md:w-64">
                  {lesson.tags.map((tag: string) => (
                    <span key={tag} className="text-[10px] font-bold text-slate-400 bg-slate-50 px-2 py-1 rounded-lg">
                      #{tag}
                    </span>
                  ))}
                </div>

                <div className="flex items-center gap-1.5 text-indigo-600 font-bold text-[13px] whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity">
                  View Insight <ChevronRight className="w-4 h-4" />
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

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
                  <button onClick={() => setIsAddingLesson(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
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
                        onChange={e => setNewLesson({...newLesson, title: e.target.value})}
                        className="w-full px-4 py-2 border border-slate-200 rounded-lg text-sm font-medium focus:ring-2 focus:ring-indigo-500"
                        placeholder="e.g., Structural Steel Sourcing Delays"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-slate-500">Project / Programme Context</label>
                    <select
                        required
                        value={newLesson.project}
                        onChange={e => setNewLesson({...newLesson, project: e.target.value})}
                        className="w-full px-4 py-2 border border-slate-200 rounded-lg text-sm font-medium focus:ring-2 focus:ring-indigo-500"
                      >
                        <option value="">— Select project or programme —</option>
                        {safeProgrammes.length > 0 && (
                          <optgroup label="Programmes">
                            {safeProgrammes.map(p => (
                              <option key={p.id} value={p.name}>{p.name}</option>
                            ))}
                          </optgroup>
                        )}
                        {safeProjects.length > 0 && (
                          <optgroup label="Projects">
                            {safeProjects.map(p => (
                              <option key={p.id} value={p.name}>{p.name}</option>
                            ))}
                          </optgroup>
                        )}
                      </select>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-medium text-slate-500">What happened? (The Problem)</label>
                      <AIWriter
                        context={`Briefly describe a project problem or risk event for the project: ${newLesson.project}. Title: ${newLesson.title}`}
                        onSuggest={(val) => setNewLesson({...newLesson, problem: val})}
                        placeholder="e.g. root cause, circumstances that led to this, when it was first noticed"
                        className="scale-90"
                      />
                    </div>
                    <textarea
                      required
                      value={newLesson.problem}
                      onChange={e => setNewLesson({...newLesson, problem: e.target.value})}
                      className="w-full px-4 py-2 border border-slate-200 rounded-lg text-sm font-medium h-20 focus:ring-2 focus:ring-indigo-500"
                      placeholder="Describe the situation or error encountered..."
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-xs font-medium text-slate-500">How was it resolved?</label>
                        <AIWriter
                          context={`Suggest an effective resolution for the problem: ${newLesson.problem}. Project: ${newLesson.project}`}
                          onSuggest={(val) => setNewLesson({...newLesson, resolution: val})}
                          placeholder="e.g. steps taken, who resolved it, what was agreed"
                          className="scale-90"
                        />
                      </div>
                      <textarea
                        required
                        value={newLesson.resolution}
                        onChange={e => setNewLesson({...newLesson, resolution: e.target.value})}
                        className="w-full px-4 py-2 border border-slate-200 rounded-lg text-sm font-medium h-20 focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-xs font-medium text-slate-500">Future Prevention</label>
                        <AIWriter
                          context={`Based on the problem: ${newLesson.problem} and resolution: ${newLesson.resolution}, what should be done to prevent this from happening again?`}
                          onSuggest={(val) => setNewLesson({...newLesson, prevention: val})}
                          placeholder="e.g. process change, new check, or training to prevent recurrence"
                          className="scale-90"
                        />
                      </div>
                      <textarea
                        required
                        value={newLesson.prevention}
                        onChange={e => setNewLesson({...newLesson, prevention: e.target.value})}
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
                      <span className="text-[10px] font-mono font-medium text-indigo-600 bg-indigo-50 px-2 py-1 rounded uppercase tracking-wide">
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
                  <button onClick={() => setSelectedLesson(null)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
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
                        <h4 className="text-[10px] font-mono font-medium text-slate-400 uppercase tracking-wide mb-1">The Problem</h4>
                        <p className="text-sm font-bold text-slate-700 leading-relaxed">{selectedLesson.problem}</p>
                      </div>
                    </div>
                    <div className="flex gap-4">
                      <div className="p-3 bg-indigo-50 text-indigo-600 rounded-lg flex-shrink-0 h-fit">
                        <CheckCircle2 className="w-6 h-6" />
                      </div>
                      <div>
                        <h4 className="text-[10px] font-mono font-medium text-slate-400 uppercase tracking-wide mb-1">Resolution Applied</h4>
                        <p className="text-sm font-bold text-slate-700 leading-relaxed">{selectedLesson.resolution}</p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="space-y-6">
                    <div className="flex gap-4">
                      <div className="p-3 bg-amber-50 text-amber-500 rounded-lg flex-shrink-0 h-fit">
                        <Lightbulb className="w-6 h-6" />
                      </div>
                      <div>
                        <h4 className="text-[10px] font-mono font-medium text-slate-400 uppercase tracking-wide mb-1">Prevention & Strategy</h4>
                        <p className="text-sm font-bold text-slate-700 leading-relaxed">{selectedLesson.prevention}</p>
                      </div>
                    </div>
                    <div className="p-6 bg-slate-50 rounded-lg border border-slate-100">
                      <h4 className="text-[10px] font-mono font-medium text-slate-400 uppercase tracking-wide mb-3">Linked Context</h4>
                      <div className="flex flex-wrap gap-2">
                        {selectedLesson.tags.map((tag: any) => (
                          <span key={tag} className="px-3 py-1.5 bg-white text-[11px] font-semibold text-slate-600 rounded-lg border border-slate-200">
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
