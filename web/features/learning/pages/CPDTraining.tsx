import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  BookOpen, Play, CheckCircle2, Clock, Award, 
  ChevronRight, Search, Filter, PlayCircle, X, Rocket 
} from 'lucide-react';
import { useStore } from '../../../store/useStore';
import { clsx } from 'clsx';
import { MicrolearningSlideshow } from '../../../components/MicrolearningSlideshow';
import PageHeader from '../../../components/PageHeader';

export function CPDTraining() {
  const { cpdModules, updateCPDModule, activeProjectId, projects } = useStore();
  const [selectedModule, setSelectedModule] = useState<any>(null);
  const [hasCompletedSlideshow, setHasCompletedSlideshow] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');

  const handleSelectModule = (module: any) => {
    setSelectedModule(module);
    setHasCompletedSlideshow(false);
  };

  const activeProject = projects.find(p => p.id === activeProjectId);
  const categories = ['All', 'Safety', 'Compliance', 'Management', 'Technical'];
  
  const suggestedModules = useMemo(() => {
    if (!activeProject) return [];
    // Suggested logic based on storeys or HRB status
    const isTall = activeProject.storeys && parseInt(activeProject.storeys) > 5;
    const isHRB = activeProject.isHRB;
    
    return cpdModules.filter(m => {
      if (isHRB && m.category === 'Compliance') return true;
      if (isTall && m.category === 'Safety') return true;
      return false;
    }).slice(0, 2);
  }, [activeProject, cpdModules]);

  const filteredModules = (cpdModules || []).filter(m => {
    const matchesSearch = m.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                         m.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = activeCategory === 'All' || m.category === activeCategory;
    return matchesSearch && matchesCategory;
  });

  const completedCount = (cpdModules || []).filter(m => m.status === 'Completed').length;
  const totalPoints = (cpdModules || []).filter(m => m.status === 'Completed').reduce((sum, m) => sum + m.points, 0);
  const totalProgress = cpdModules.length > 0 ? (completedCount / cpdModules.length) * 100 : 0;

  const handleComplete = (id: string) => {
    updateCPDModule(id, { status: 'Completed' });
    setSelectedModule(null);
  };

  return (
    <div className="space-y-6">
      {/* Header & Stats */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <PageHeader
          title="CPD Training & Microlearning"
          subtitle="Professional development and regulatory compliance sessions."
          breadcrumbs={[{label:"Regulations Library"},{label:"CPD Training"}]}
        />
        
        <div className="flex gap-4">
          <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm flex items-center gap-4">
            <div className="p-3 bg-indigo-50 rounded-lg text-indigo-600">
              <Award className="w-6 h-6" />
            </div>
            <div>
              <div className="text-2xl font-medium text-slate-900 tabular-nums">{totalPoints}</div>
              <div className="text-[10px] font-mono font-medium text-slate-400 uppercase tracking-wide">CPD Points</div>
            </div>
          </div>
          <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm flex items-center gap-4">
            <div className="p-3 bg-emerald-50 rounded-lg text-emerald-600">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <div className="text-2xl font-medium text-slate-900 tabular-nums">{completedCount}/{cpdModules.length || 0}</div>
              <div className="font-mono text-[10px] font-bold text-slate-400 uppercase tracking-wider">Modules Done</div>
            </div>
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white p-6 rounded-lg border border-slate-200 shadow-sm">
          <div className="flex justify-between items-end mb-2">
            <div className="text-[11px] font-mono font-medium text-slate-400 uppercase tracking-wide">Your Learning Progress</div>
            <div className="text-[13px] font-bold text-indigo-600">{Math.round(totalProgress)}%</div>
          </div>
          <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: `${totalProgress}%` }}
              className="h-full bg-indigo-600 rounded-full shadow-[0_0_12px_rgba(79,70,229,0.3)]"
            />
          </div>
        </div>

        {suggestedModules.length > 0 && (
          <div className="bg-indigo-600 p-6 rounded-lg shadow-xl shadow-indigo-200 relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform">
              <Rocket className="w-24 h-24 text-white" />
            </div>
            <div className="relative z-10">
              <h3 className="text-white font-semibold text-sm mb-1">Recommended for {activeProject?.name}</h3>
              <p className="text-indigo-100 text-[11px] font-bold mb-3">Based on project risk profile</p>
              <div className="space-y-2">
                {suggestedModules.map(m => (
                  <div 
                    key={m.id} 
                    onClick={() => handleSelectModule(m)}
                    className="flex items-center gap-2 bg-white/10 hover:bg-white/20 p-2 rounded-lg cursor-pointer transition-colors"
                  >
                    <PlayCircle className="w-4 h-4 text-white" />
                    <span className="text-[11px] font-bold text-white truncate">{m.title}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
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
        
        <div className="relative w-full md:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search modules..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all shadow-sm"
          />
        </div>
      </div>

      {/* Modules Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <AnimatePresence mode="popLayout">
          {filteredModules.map((module) => (
            <motion.div
              layout
              key={module.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-lg border border-slate-200 shadow-sm hover:shadow-xl hover:border-indigo-100 transition-all group cursor-pointer overflow-hidden flex flex-col"
              onClick={() => handleSelectModule(module)}
            >
              <div className="aspect-video bg-slate-100 relative overflow-hidden">
                {module.thumbnail ? (
                  <img src={module.thumbnail} alt={module.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-slate-300">
                    <PlayCircle className="w-12 h-12" />
                  </div>
                )}
                <div className="absolute top-3 left-3 px-2.5 py-1 bg-white/90 backdrop-blur-sm rounded-lg text-[10px] font-mono font-medium text-indigo-600 uppercase tracking-wide shadow-sm">
                  {module.category}
                </div>
                {module.status === 'Completed' && (
                  <div className="absolute top-3 right-3 p-1.5 bg-emerald-500 text-white rounded-full shadow-lg">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                )}
              </div>
              
              <div className="p-5 flex-1 flex flex-col">
                <h3 className="text-base font-semibold text-slate-900 mb-2 group-hover:text-indigo-600 transition-colors line-clamp-2">
                  {module.title}
                </h3>
                <p className="text-slate-500 text-sm font-medium line-clamp-2 mb-4 flex-1">
                  {module.description}
                </p>
                
                <div className="flex items-center justify-between text-[11px] font-bold text-slate-400 mt-auto pt-4 border-t border-slate-50">
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5" />
                    {module.duration}
                  </div>
                  <div className="flex items-center gap-1.5 text-indigo-600">
                    <Award className="w-3.5 h-3.5" />
                    {module.points} Points
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Video Modal */}
      <AnimatePresence>
        {selectedModule && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-8">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-900/95 backdrop-blur-md"
              onClick={() => setSelectedModule(null)}
            />
            
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-5xl bg-white rounded-lg overflow-hidden shadow-2xl flex flex-col md:flex-row"
            >
              <div className="flex-1 bg-black aspect-[4/3] md:aspect-video flex items-center justify-center relative group overflow-hidden">
                {selectedModule.videoUrl ? (
                  <iframe
                    className="w-full h-full"
                    src={`${selectedModule.videoUrl}?autoplay=1`}
                    title={selectedModule.title}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    onLoad={() => setHasCompletedSlideshow(true)} // unlock immediately for videos for now
                  />
                ) : (
                  <MicrolearningSlideshow 
                    moduleId={selectedModule.id} 
                    onComplete={() => setHasCompletedSlideshow(true)} 
                  />
                )}
                <button 
                  onClick={() => setSelectedModule(null)}
                  className="absolute top-4 right-4 p-2 bg-black/50 text-white rounded-full hover:bg-black/70 transition-colors md:hidden z-50"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="w-full md:w-[350px] p-6 md:p-8 flex flex-col bg-slate-50 border-l border-slate-100">
                <div className="mb-6">
                  <div className="px-2.5 py-1 bg-indigo-50 text-[10px] font-mono font-medium text-indigo-600 uppercase tracking-wide rounded-lg inline-block mb-3">
                    {selectedModule.category}
                  </div>
                  <h2 className="text-xl font-semibold text-slate-900 leading-tight mb-3">
                    {selectedModule.title}
                  </h2>
                  <p className="text-slate-500 text-sm font-medium leading-relaxed">
                    {selectedModule.description}
                  </p>
                </div>

                <div className="space-y-4 mb-8">
                  <div className="flex items-center justify-between p-3 bg-white rounded-lg border border-slate-200">
                    <span className="text-xs font-mono font-medium text-slate-400 uppercase tracking-wide">Duration</span>
                    <span className="text-sm font-semibold text-slate-900">{selectedModule.duration}</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-white rounded-lg border border-slate-200">
                    <span className="text-xs font-mono font-medium text-slate-400 uppercase tracking-wide">CPD Points</span>
                    <span className="text-sm font-semibold text-indigo-600">{selectedModule.points}</span>
                  </div>
                </div>

                <div className="mt-auto space-y-3">
                  {selectedModule.status !== 'Completed' && (
                    <button
                      onClick={() => handleComplete(selectedModule.id)}
                      disabled={!hasCompletedSlideshow && !selectedModule.videoUrl}
                      className={clsx(
                        "w-full py-4 text-white font-semibold rounded-lg transition-all flex items-center justify-center gap-2",
                        hasCompletedSlideshow || selectedModule.videoUrl
                          ? "bg-emerald-600 shadow-lg shadow-emerald-200 hover:bg-emerald-700 hover:scale-[1.02] active:scale-95"
                          : "bg-slate-300 shadow-none cursor-not-allowed"
                      )}
                    >
                      <CheckCircle2 className="w-5 h-5" />
                      {(hasCompletedSlideshow || selectedModule.videoUrl) ? 'Mark as Completed' : 'Finish Slides to Unlock'}
                    </button>
                  )}
                  <button
                    onClick={() => setSelectedModule(null)}
                    className="w-full py-4 bg-white text-slate-600 font-semibold rounded-lg border-2 border-slate-200 hover:bg-slate-50 transition-all"
                  >
                    Close & Return
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
