import React, { useState, useMemo } from 'react';
import { Search, ChevronRight, AlertTriangle, FileText, List, Shield, Users, Clock, CheckCircle2, Info, AlertCircle, Filter, X, ScanSearch, ShieldCheck, MessageSquare, Plus, Loader2, ExternalLink } from 'lucide-react';
import { clsx } from 'clsx';
import { REGULATIONS } from '../../../data/regulationsLibraryData';
import { motion, AnimatePresence } from 'motion/react';
import { format } from 'date-fns';
import { useStore, type RegulationItem } from '../../../store/useStore';
import { isAtLeastPM } from '../../../lib/roles';
import { AIInquiryPopup } from '../../../components/AIInquiryPopup';
import { AIWriter } from '../../../components/AIWriter';
import { generateId } from '../../../lib/utils';
import toast from 'react-hot-toast';
import PageHeader from '../../../components/PageHeader';

// These will be recalculated inside the component to include custom items
const STATIC_CATS = [...new Set(REGULATIONS.map(r => r.cat))].sort();

const StatBox = ({ value, label, valueColor, sublabel }: { value: number | string, label: string, valueColor: string, sublabel?: string }) => (
  <div className="bg-white border border-slate-200 rounded-lg p-3">
    <div className={clsx("text-[22px] font-medium leading-none mb-1", valueColor)}>{value}</div>
    <div className="text-[10px] text-slate-400 uppercase tracking-[0.07em] mb-0.5">{label}</div>
    {sublabel && <div className="text-[9px] text-slate-300 font-medium">{sublabel}</div>}
  </div>
);

function RegulationCard({ item, catIdx, regIdx }: { item: any; catIdx: number; regIdx: number }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'process' | 'evidence' | 'owners'>('overview');
  const [isAddingUpdate, setIsAddingUpdate] = useState(false);
  const [updateContent, setUpdateContent] = useState('');
  const [isAIInquiryOpen, setIsAIInquiryOpen] = useState(false);
  const [isSavingUpdate, setIsSavingUpdate] = useState(false);
  
  const { updateRegulationItem, addCustomRegulation, customRegulations, user, activeProject, activeProgramme, activeProjectId, activeProgrammeId } = useStore();

  const riskStyles = {
    Critical: "bg-red-50 text-red-600 border-red-200",
    High: "bg-amber-50 text-amber-600 border-amber-200",
    Medium: "bg-blue-50 text-blue-600 border-blue-200",
    Low: "bg-slate-50 text-slate-500 border-slate-200"
  };

  const handleAddUpdate = async () => {
    if (!updateContent.trim()) return;
    if (!activeProjectId && !activeProgrammeId) {
      toast.error('Please select a project or programme before saving.');
      return;
    }
    setIsSavingUpdate(true);
    try {
      const newUpdate = {
        id: Math.random().toString(36).substr(2, 9),
        date: new Date().toISOString(),
        content: updateContent,
        author: user?.profile?.name || 'User'
      };

      const updatedItem = {
        ...item,
        lastUpdated: new Date().toISOString(),
        updates: [newUpdate, ...(item.updates || [])]
      };

      // If this is a static regulation (no id or not in customRegulations), clone it into customRegulations
      const isCustom = item.id && customRegulations.some((r: any) => r.id === item.id);
      if (isCustom) {
        await updateRegulationItem(updatedItem);
      } else {
        // Clone static regulation into custom with a generated ID
        const cloned = { ...updatedItem, id: item.id || generateId('REG'), tag: item.tag || 'Original' };
        await addCustomRegulation(cloned);
      }
      setUpdateContent('');
      setIsAddingUpdate(false);
      toast.success('Update saved successfully');
    } catch (err) {
      toast.error('Failed to save update. Please try again.');
    } finally {
      setIsSavingUpdate(false);
    }
  };

  return (
    <div className={clsx(
      "bg-white border rounded-lg overflow-hidden transition-all",
      isExpanded ? "border-indigo-500 md:ring-4 md:ring-indigo-500/10 shadow-lg" : "border-slate-200 hover:bg-slate-50/50 shadow-sm"
    )}>
      <div 
        className="p-3 md:p-4 flex items-center gap-3 md:gap-4 cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="text-[9px] md:text-[10px] font-semibold text-indigo-600 bg-indigo-50 border border-indigo-200 rounded text-center px-2 py-1 whitespace-nowrap shrink-0">
          {catIdx}.{regIdx}
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="text-xs md:text-sm font-bold mb-0.5 md:mb-1 leading-snug truncate text-slate-900" title={item.name}>{item.name}</div>
          <div className="text-[10px] md:text-[11px] text-slate-400 flex gap-2 items-center flex-wrap">
            <span className="font-semibold text-indigo-500/80">{item.cat}</span>
            <span className="opacity-30">·</span>
            <span className="font-medium">{item.reg}</span>
            <span className="opacity-30">·</span>
            <span className="truncate max-w-[150px] md:max-w-[300px]" title={item.when}>{item.when}</span>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span className={clsx("text-[9px] md:text-[11px] font-mono font-medium px-1.5 md:px-2 py-0.5 rounded border uppercase tracking-wide", riskStyles[item.risk as keyof typeof riskStyles])}>
            {item.risk}
          </span>
          <ChevronRight className={clsx("w-4 h-4 md:w-5 md:h-5 text-slate-300 transition-transform", isExpanded && "rotate-90 text-indigo-500")} />
        </div>
      </div>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-t border-slate-100 bg-slate-50/50"
          >
            <div className="flex border-b border-slate-200 bg-slate-50 overflow-x-auto no-scrollbar">
              {[
                { id: 'overview', label: 'Overview' },
                { id: 'process', label: 'Process' },
                { id: 'evidence', label: 'Evidence' },
                { id: 'owners', label: 'Owners' }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={clsx(
                    "px-3 md:px-4 py-2.5 text-[10px] md:text-xs font-medium transition-colors border-b-2 whitespace-nowrap shrink-0",
                    activeTab === tab.id ? "border-indigo-500 text-indigo-600" : "border-transparent text-slate-500 hover:text-slate-800"
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="p-5">
              {activeTab === 'overview' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <div className="text-[10px] font-mono font-medium text-slate-400 uppercase tracking-wide mb-1.5">Requirement</div>
                      <div className="text-[13px] text-slate-800 leading-relaxed">{item.req}</div>
                    </div>
                    <div>
                      <div className="bg-red-50/50 border border-red-200 rounded-lg p-3">
                        <div className="text-[10px] font-mono font-medium text-red-700 uppercase tracking-wide mb-1.5 flex items-center gap-1.5">
                          <AlertTriangle className="w-3.5 h-3.5" /> Penalty for Breach
                        </div>
                        <div className="text-[13px] text-red-900 leading-relaxed">{item.penalty}</div>
                      </div>
                    </div>
                  </div>
                  {item.sourceUrl && (
                    <div>
                      <div className="text-[10px] font-mono font-medium text-slate-400 uppercase tracking-wide mb-1.5">Official Source</div>
                      <a
                        href={item.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-[13px] text-indigo-600 hover:text-indigo-800 hover:underline break-all"
                      >
                        <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                        {item.sourceUrl}
                      </a>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'process' && (
                <div className="space-y-2.5">
                  {item.process.split('|').map((step: string, idx: number) => (
                    <div key={idx} className="flex gap-3 items-start">
                      <div className="bg-blue-50 text-blue-600 flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5 px-1.5 py-0.5 rounded">
                        {catIdx}.{regIdx}.{idx + 1}
                      </div>
                      <div className="text-[13px] text-slate-700 leading-relaxed pt-0.5">{step}</div>
                    </div>
                  ))}
                </div>
              )}

              {activeTab === 'evidence' && (
                <div className="space-y-0">
                  {item.evidence.split('|').map((ev: string, idx: number) => (
                    <div key={idx} className="flex gap-2 items-start py-2 border-b border-slate-100 last:border-0">
                      <div className="flex flex-col gap-1 flex-1">
                        <div className="flex items-start gap-2">
                          <div className="text-[9px] font-bold text-green-600 bg-green-50 px-1.5 py-0.5 rounded shrink-0">
                            {catIdx}.{regIdx}.{idx + 1}
                          </div>
                          <div className="text-[13px] text-slate-800">{ev}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {activeTab === 'owners' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <div className="text-[10px] font-mono font-medium text-slate-400 uppercase tracking-wide mb-2">Key Owners</div>
                    <div className="flex flex-wrap gap-1.5">
                      {item.owners.split(', ').map((owner: string, idx: number) => (
                        <div key={idx} className="text-[11px] bg-white border border-slate-200 text-slate-600 px-2 py-0.5 rounded shadow-sm">
                          {owner}
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="bg-slate-100/50 rounded-lg p-4 border border-slate-200/50">
                    <div className="flex items-center gap-2 mb-2">
                       <ShieldCheck className="w-3.5 h-3.5 text-indigo-500" />
                       <div className="text-[10px] font-mono font-medium text-slate-400 uppercase tracking-wide">Contextual AI Insight</div>
                    </div>
                    <p className="text-[11px] text-slate-600 leading-relaxed ">
                      "This regulation significantly impacts {item.cat} activities. Use the AI inquiry tool to explore specific implementation strategies for your current project scope."
                    </p>
                  </div>
                </div>
              )}

              {/* Updates History Section */}
              <div className="mt-8 pt-6 border-t border-slate-200">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-indigo-500" />
                    <h4 className="text-[11px] font-mono font-medium uppercase tracking-wide text-slate-900">Regulatory Update History</h4>
                  </div>
                  <button 
                    onClick={() => setIsAddingUpdate(!isAddingUpdate)}
                    className="text-[10px] font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
                  >
                    {isAddingUpdate ? 'Cancel' : (
                      <><Plus className="w-3 h-3" /> Add Update</>
                    )}
                  </button>
                </div>

                {isAddingUpdate && (
                  <div className="mb-6 bg-white border border-indigo-200 rounded-lg p-4 shadow-sm">
                    <textarea
                      placeholder="Describe the regulatory update or change..."
                      className="w-full h-24 p-3 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all resize-none mb-3"
                      value={updateContent}
                      onChange={(e) => setUpdateContent(e.target.value)}
                    />
                    <div className="flex justify-end gap-2">
                      <button 
                        onClick={() => setIsAddingUpdate(false)}
                        className="px-3 py-1.5 text-[10px] font-bold text-slate-500 hover:bg-slate-50 rounded-lg transition-all"
                      >
                        Cancel
                      </button>
                      <button 
                        onClick={handleAddUpdate}
                        disabled={!updateContent.trim() || isSavingUpdate}
                        className="font-mono px-4 py-1.5 bg-indigo-600 text-white text-[10px] font-semibold uppercase tracking-wider rounded-lg hover:bg-indigo-700 transition-all shadow-sm disabled:opacity-50 flex items-center gap-1.5"
                      >
                        {isSavingUpdate && <Loader2 className="w-3 h-3 animate-spin" />}
                        {isSavingUpdate ? 'Saving...' : 'Save Update'}
                      </button>
                    </div>
                  </div>
                )}

                <div className="space-y-3">
                  {item.updates && item.updates.length > 0 ? (
                    item.updates.map((update: any) => (
                      <div key={update.id} className="bg-white border border-slate-200 rounded-lg p-3 relative overflow-hidden group">
                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-indigo-100 group-hover:bg-indigo-500 transition-colors" />
                        <div className="flex justify-between items-start mb-1">
                          <span className="text-[10px] font-mono font-medium text-slate-400 uppercase tracking-wide tabular-nums">{format(new Date(update.date), 'dd MMM yyyy')}</span>
                          <span className="text-[10px] font-medium text-slate-500 ">By {update.author}</span>
                        </div>
                        <p className="text-[12px] text-slate-700 leading-relaxed font-medium">{update.content}</p>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-4 bg-slate-100/50 rounded-lg border border-dashed border-slate-200">
                      <p className="text-[10px] text-slate-400 font-medium ">No recent updates recorded for this regulation.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
            
            <div className="px-3 md:px-5 py-3 border-t border-slate-200 bg-slate-50 flex flex-col sm:flex-row gap-2 sm:justify-between sm:items-center">
              <div className="flex items-center gap-2 md:gap-4 flex-wrap">
                <div className="text-[10px] md:text-[11px] text-slate-400 flex items-center gap-1 truncate">
                  <Info className="w-3 md:w-3.5 h-3 md:h-3.5 shrink-0" /> <span className="truncate">Active for {activeProject?.name || (activeProgramme as any)?.name || 'current context'}</span>
                </div>
                {item.lastUpdated && (
                  <div className="text-[10px] md:text-[11px] text-indigo-500 flex items-center gap-1 font-semibold shrink-0">
                    <Clock className="w-3 md:w-3.5 h-3 md:h-3.5" /> {format(new Date(item.lastUpdated), 'dd/MM/yy')}
                  </div>
                )}
              </div>
              
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  setIsAIInquiryOpen(true);
                }}
                className="font-mono flex items-center gap-2 px-3 py-1.5 bg-white border border-indigo-200 text-indigo-600 text-[10px] font-semibold uppercase tracking-wide rounded-lg hover:bg-indigo-50 transition-all shadow-sm active:scale-95 shrink-0 self-end sm:self-auto"
              >
                <MessageSquare className="w-3 h-3" />
                Ask AI
              </button>
            </div>

            <AIInquiryPopup 
              isOpen={isAIInquiryOpen} 
              onClose={() => setIsAIInquiryOpen(false)} 
              context={[
                `Regulation: ${item.name} (${item.reg}).`,
                `Category: ${item.cat}. Risk Level: ${item.risk}.`,
                `Requirement: ${item.req}`,
                `Penalty for Breach: ${item.penalty}`,
                `Process Steps: ${item.process?.replace(/\|/g, ', ')}`,
                activeProject ? `Current Project: ${activeProject.name} (Type: ${(activeProject as any).type || 'N/A'}, Location: ${(activeProject as any).loc || 'N/A'}).` : '',
                activeProgramme ? `Current Programme: ${(activeProgramme as any).name}.` : '',
                `Provide project-specific implementation guidance for this regulation, not generic regulatory information.`
              ].filter(Boolean).join(' ')}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function RegulationLibrary() {
  const { user, customRegulations, addCustomRegulation, activeProject, activeProgramme, activeProjectId, activeProgrammeId } = useStore();
  const allCats = useMemo(() => {
    const cats = new Set(REGULATIONS.map(r => r.cat));
    customRegulations.forEach((r: any) => { if (r.cat) cats.add(r.cat); });
    return [...cats].sort();
  }, [customRegulations]);

  const [activeView, setActiveView] = useState<'all' | 'new'>('all');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isAIInquiryOpen, setIsAIInquiryOpen] = useState(false);
  const [isSavingEntry, setIsSavingEntry] = useState(false);
  const [newReg, setNewReg] = useState<Partial<RegulationItem>>({
    cat: allCats[0] || 'General',
    risk: 'Medium',
    status: 'Not Started',
    tag: 'Manual'
  });

  const userRole = user?.role || (user as any)?.profile?.role;
  const isPM = isAtLeastPM(userRole);

  const [search, setSearch] = useState('');
  const [activeCat, setActiveCat] = useState('All');
  const [activeRisks, setActiveRisks] = useState<Set<string>>(new Set());
  const [showFilters, setShowFilters] = useState(false);

  // Merge static + custom regulations, preserving original order
  // Custom overrides replace static items in-place; truly new custom entries go at end
  const allItems = useMemo(() => {
    const customByKey = new Map(customRegulations.map((r: any) => [`${r.cat}::${r.name}`, r]));
    const usedKeys = new Set<string>();
    // Walk static list — swap in custom override if one exists
    const merged = REGULATIONS.map(r => {
      const key = `${r.cat}::${r.name}`;
      if (customByKey.has(key)) {
        usedKeys.add(key);
        return customByKey.get(key)!;
      }
      return r;
    });
    // Append truly new custom regulations (not overrides of static ones)
    const newCustom = customRegulations.filter((r: any) => !usedKeys.has(`${r.cat}::${r.name}`));
    return [...merged, ...newCustom];
  }, [customRegulations]);

  // Filter Items
  const filteredItems = useMemo(() => {
    return allItems.filter(item => {
      const matchSearch = item.name.toLowerCase().includes(search.toLowerCase()) || 
                          item.req.toLowerCase().includes(search.toLowerCase()) ||
                          item.reg.toLowerCase().includes(search.toLowerCase());
      const matchCat = activeCat === 'All' || item.cat === activeCat;
      const matchRisk = activeRisks.size === 0 || activeRisks.has(item.risk);
      const matchView = activeView === 'all' || item.tag === 'NEW' || item.tag === 'Manual';
      return matchSearch && matchCat && matchRisk && matchView;
    });
  }, [search, activeCat, activeRisks, activeView, allItems]);

  // Stats
  const stats = useMemo(() => {
    const lastUpdateDate = filteredItems.reduce((latest, item) => {
      if (!(item as any).lastUpdated) return latest;
      const itemDate = new Date((item as any).lastUpdated);
      return itemDate > latest ? itemDate : latest;
    }, new Date(0));

    return {
      total: filteredItems.length,
      critical: filteredItems.filter(r => r.risk === 'Critical').length,
      high: filteredItems.filter(r => r.risk === 'High').length,
      medium: filteredItems.filter(r => r.risk === 'Medium').length,
      lastUpdate: lastUpdateDate.getTime() === 0 ? null : lastUpdateDate
    };
  }, [filteredItems]);

  const toggleRisk = (r: string) => {
    const next = new Set(activeRisks);
    if (next.has(r)) next.delete(r);
    else next.add(r);
    setActiveRisks(next);
  };

  const riskFilters = [
    { id: 'Critical', color: "text-red-600" },
    { id: 'High', color: "text-amber-600" },
    { id: 'Medium', color: "text-blue-600" },
    { id: 'Low', color: "text-slate-500" },
  ];

  function renderSidebarContent() {
    return (
      <div className="space-y-8">
        {/* AI Quick Inquiry */}
        <button 
          onClick={() => setIsAIInquiryOpen(true)}
          className="w-full group relative overflow-hidden bg-gradient-to-br from-indigo-600 to-violet-700 p-[1px] rounded-lg transition-all hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-indigo-500/20"
        >
          <div className="bg-white/10 backdrop-blur-xl px-4 py-4 rounded-lg flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center shadow-inner">
                <ShieldCheck className="w-5 h-5 text-white animate-pulse" />
              </div>
              <div className="text-left">
                <p className="text-[10px] font-mono font-medium text-indigo-100 uppercase tracking-wide leading-none mb-1">Knowledge AI</p>
                <p className="text-xs font-bold text-white">Ask about Regs</p>
              </div>
            </div>
            <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center group-hover:bg-white/20 transition-colors">
              <MessageSquare className="w-4 h-4 text-white" />
            </div>
          </div>
        </button>

        {/* Search */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input 
            type="search" 
            placeholder="Search regulations..." 
            className="w-full pl-8 pr-3 py-2.5 bg-white border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all shadow-sm"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        {/* Categories */}
        <div className="space-y-4">
          <p className="text-[10px] font-mono font-medium uppercase tracking-wide text-slate-400">Categories</p>
          <div className="space-y-1">
            <button 
              className={clsx(
                "w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold transition-all duration-300",
                activeCat === 'All' 
                  ? "bg-white text-indigo-700 shadow-sm border border-indigo-100 ring-1 ring-indigo-50 active:scale-[0.98]" 
                  : "text-slate-500 hover:bg-slate-50 hover:text-slate-900 active:scale-95"
              )}
              onClick={() => setActiveCat('All')}
            >
              <span>All Categories</span>
              <span className={clsx("text-[10px] px-2 py-0.5 rounded-full font-bold", activeCat === 'All' ? "bg-indigo-50 text-indigo-700" : "bg-slate-100 text-slate-500")}>
                {allItems.length}
              </span>
            </button>
            
            {allCats.map(cat => {
              const count = allItems.filter(r => r.cat === cat).length;
              const isActive = activeCat === cat;
              return (
                <button 
                  key={cat}
                  className={clsx(
                    "w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-all duration-300 border-l-2",
                    isActive 
                      ? "bg-indigo-50/20 text-indigo-700 font-bold border-indigo-600 shadow-sm scale-[1.01]" 
                      : "text-slate-500 hover:bg-slate-50 border-transparent hover:border-slate-200 active:scale-95"
                  )}
                  onClick={() => setActiveCat(cat)}
                >
                  <span className="truncate pr-2 text-left">{cat}</span>
                  <span className={clsx("text-[10px] px-1.5 py-0.5 rounded-full font-bold", isActive ? "bg-indigo-100 text-indigo-700" : "bg-slate-50 text-slate-400")}>
                    {count}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Legend / Info Block */}
        <div className="bg-slate-50 rounded-lg p-4 border border-slate-100">
          <p className="text-[10px] font-mono font-medium uppercase tracking-wide text-slate-400 mb-3">Compliance Key</p>
          <div className="space-y-2.5">
            {[
              { label: 'Critical', color: 'bg-red-500', desc: 'Immediate legal risk' },
              { label: 'High', color: 'bg-amber-500', desc: 'Sanctions likely' },
              { label: 'Medium', color: 'bg-blue-500', desc: 'Best practice risk' },
            ].map(item => (
              <div key={item.label} className="flex items-start gap-2.5">
                <div className={clsx("w-2 h-2 rounded-full mt-1 shrink-0", item.color)} />
                <div>
                  <p className="text-[10px] font-semibold text-slate-700 leading-none">{item.label}</p>
                  <p className="text-[9px] text-slate-400 mt-0.5">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Regulation Library"
        subtitle="Searchable reference library of UK built-environment regulations, standards, and compliance frameworks."
        breadcrumbs={[{label:"Regulations Library"},{label:"Library"}]}
      />
      <div className="flex flex-col lg:flex-row gap-8">
        
        {/* MOBILE STICKY HEADER */}
        <div className="lg:hidden sticky top-[3.5rem] z-30 bg-slate-50/80 backdrop-blur-md -mx-4 px-4 py-3 border-b border-slate-200 space-y-3 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-lg font-semibold text-slate-900 tracking-tight leading-none mb-1">Library</h1>
              <div className="flex items-center gap-2">
                <div className="text-[9px] font-mono font-medium text-indigo-600 uppercase tracking-wide bg-indigo-50 px-1.5 py-0.5 rounded">
                  {filteredItems.length} REGS
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {isPM && (
                <button
                  onClick={() => setIsAddModalOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-2.5 bg-indigo-600 text-white rounded-lg text-xs font-semibold shadow-sm transition-transform active:scale-95"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add
                </button>
              )}
              <button
                onClick={() => setShowFilters(true)}
                className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 shadow-sm transition-transform active:scale-95"
              >
                <Filter className="w-3.5 h-3.5 text-indigo-500" />
                Filters
                {(activeCat !== 'All' || activeRisks.size > 0 || search) && (
                  <span className="w-1.5 h-1.5 bg-indigo-600 rounded-full" />
                )}
              </button>
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-[10px] font-mono font-medium text-slate-400 uppercase tracking-wide mt-2 px-1">
            <Clock className="w-3 h-3" />
            Last Updated: {stats.lastUpdate ? format(stats.lastUpdate, 'dd/MM/yy') : format(new Date(), 'dd/MM/yy')}
          </div>
        </div>

        {/* MOBILE FILTERS DRAWER */}
        <AnimatePresence>
          {showFilters && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setShowFilters(false)}
                className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[60] lg:hidden"
              />
              <motion.aside
                initial={{ x: '-100%' }}
                animate={{ x: 0 }}
                exit={{ x: '-100%' }}
                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                className="fixed inset-y-0 left-0 w-[280px] bg-white z-[70] lg:hidden shadow-2xl flex flex-col"
              >
                <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                  <h3 className="font-semibold text-slate-900 uppercase tracking-tight text-sm">Filters</h3>
                  <button
                    onClick={() => setShowFilters(false)}
                    className="p-2 hover:bg-slate-50 rounded-lg transition-colors"
                  >
                    <X className="w-5 h-5 text-slate-400" />
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto p-4 custom-scrollbar pb-24">
                  {renderSidebarContent()}
                </div>
                <div className="p-4 border-t border-slate-100 bg-slate-50">
                  <button
                    onClick={() => setShowFilters(false)}
                    className="w-full py-3 bg-slate-900 text-white font-bold rounded-lg shadow-lg shadow-slate-200 text-sm active:scale-95 transition-transform"
                  >
                    Show {filteredItems.length} Regulations
                  </button>
                </div>
              </motion.aside>
            </>
          )}
        </AnimatePresence>

        {/* DESKTOP SIDEBAR */}
        <aside className="hidden lg:block w-64 shrink-0 space-y-6">
          {renderSidebarContent()}
        </aside>

        {/* MAIN CONTENT */}
        <div className="flex-1 min-w-0">
          <div className="mt-4 md:mt-8 mb-6 border-b border-slate-200">
            <div className="flex gap-4 md:gap-8">
              <button 
                onClick={() => setActiveView('all')}
                className={clsx(
                  "pb-3 md:pb-4 px-1 text-xs md:text-sm font-semibold transition-all whitespace-nowrap",
                  activeView === 'all' ? "text-indigo-600 border-b-2 border-indigo-600" : "text-slate-400 hover:text-slate-600"
                )}
              >
                Regulation Library
              </button>
              <button 
                onClick={() => setActiveView('new')}
                className={clsx(
                  "pb-3 md:pb-4 px-1 text-xs md:text-sm font-semibold transition-all flex items-center gap-2 whitespace-nowrap",
                  activeView === 'new' ? "text-indigo-600 border-b-2 border-indigo-600" : "text-slate-400 hover:text-slate-600"
                )}
              >
                New Updates
                <span className="bg-indigo-600 text-white text-[9px] px-1.5 py-0.5 rounded-full">
                  {allItems.filter((r: any) => r.tag === 'NEW').length}
                </span>
              </button>
            </div>
          </div>

          <div className="hidden lg:flex mb-8 items-start justify-between">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <h1 className="text-xl font-semibold text-slate-900 tracking-tight">Regulatory Reference</h1>
                <div className="px-3 py-1 bg-indigo-50 text-indigo-600 rounded-full text-xs font-mono font-medium uppercase tracking-wide shadow-sm">
                  {filteredItems.length} REGS
                </div>
              </div>
              <p className="text-xs text-slate-400 mt-1">UK social housing and construction regulatory framework</p>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 text-[11px] font-mono font-medium text-slate-400 uppercase tracking-wide bg-slate-50 px-3 py-2 rounded-lg border border-slate-100">
                <Clock className="w-3.5 h-3.5" />
                Last Updated: {stats.lastUpdate ? format(stats.lastUpdate, 'dd/MM/yy') : format(new Date(), 'dd/MM/yy')}
              </div>
              {isPM && (
                 <button 
                   onClick={() => setIsAddModalOpen(true)}
                   className="font-mono flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-[11px] font-semibold uppercase tracking-wide rounded-lg hover:bg-indigo-700 transition-all shadow-md active:scale-95"
                 >
                   <Plus className="w-3.5 h-3.5" />
                   Manual Entry
                 </button>
              )}
            </div>
          </div>

          {/* Risk Filters Row */}
          <div className="flex items-center gap-2 py-4 border-b border-slate-100 mb-6 flex-wrap overflow-x-auto no-scrollbar">
            <span className="text-[11px] font-mono font-medium text-slate-400 uppercase tracking-wide shrink-0 mr-2">Risk level:</span>
            {riskFilters.map(r => (
              <button 
                key={r.id}
                onClick={() => toggleRisk(r.id)}
                className={clsx(
                  "px-4 py-1.5 rounded-full text-[11px] font-bold border transition-all shrink-0 active:scale-95",
                  activeRisks.has(r.id) 
                    ? "bg-slate-900 border-slate-900 text-white shadow-md shadow-slate-200" 
                    : "bg-white border-slate-200 text-slate-500 hover:border-slate-300 hover:bg-slate-50"
                )}
              >
                {r.id}
              </button>
            ))}
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
            <StatBox value={stats.total} label="Total" valueColor="text-slate-900" sublabel="Live Regulations" />
            <StatBox value={stats.critical} label="Critical" valueColor="text-red-600" sublabel="Legal Risk" />
            <StatBox value={stats.high} label="High" valueColor="text-amber-500" sublabel="Sanctions Risk" />
            <StatBox 
              value={stats.lastUpdate ? format(stats.lastUpdate, 'dd/MM') : '--/--'} 
              label="Last Refresh" 
              valueColor="text-indigo-600" 
              sublabel="Regulatory Update" 
            />
          </div>

          {/* List */}
          <div className="space-y-3">
            {filteredItems.length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-lg p-16 flex flex-col items-center text-center">
                <div className="w-14 h-14 bg-slate-50 rounded-lg flex items-center justify-center mb-4">
                  <AlertCircle className="w-7 h-7 text-slate-300" />
                </div>
                <h3 className="text-base font-bold text-slate-800">No regulations found</h3>
                <p className="text-sm text-slate-400 mt-1 max-w-xs">Adjust your filters to see more results.</p>
              </div>
            ) : (
              filteredItems.map((item, index) => {
                const catIdx = allCats.indexOf(item.cat) + 1;
                // Find index within the group of same category items in the current filtered list
                const itemsInSameCat = filteredItems.filter(r => r.cat === item.cat);
                const regIdx = itemsInSameCat.indexOf(item) + 1;
                
                return (
                  <RegulationCard 
                    key={`${item.cat}-${item.name}-${index}`} 
                    item={item} 
                    catIdx={catIdx}
                    regIdx={regIdx}
                  />
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Manual Entry Modal */}
      <AnimatePresence>
        {isAddModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAddModalOpen(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-xl bg-white rounded-lg shadow-2xl flex flex-col overflow-hidden max-h-[90vh] mx-2 md:mx-0"
            >
              <div className="px-4 md:px-6 py-3 md:py-4 border-b border-slate-100 flex items-center justify-between bg-white sticky top-0 z-10">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900 tracking-tight">Manual Regulation Entry</h3>
                  <p className="text-[10px] text-slate-400 font-mono font-medium uppercase tracking-wide mt-0.5">Add custom compliance requirement</p>
                </div>
                <button onClick={() => setIsAddModalOpen(false)} className="p-2 hover:bg-slate-50 rounded-lg transition-colors">
                  <X className="w-5 h-5 text-slate-400" />
                </button>
              </div>

              <div className="p-4 md:p-6 overflow-y-auto space-y-4 md:space-y-5">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-medium text-slate-500 ml-1">Category</label>
                    <select 
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all"
                      value={newReg.cat}
                      onChange={e => setNewReg({ ...newReg, cat: e.target.value })}
                    >
                      {allCats.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                      <option value="Custom">Custom / Other</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-medium text-slate-500 ml-1">Risk Level</label>
                    <select 
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all"
                      value={newReg.risk}
                      onChange={e => setNewReg({ ...newReg, risk: e.target.value })}
                    >
                      <option value="Critical">Critical</option>
                      <option value="High">High</option>
                      <option value="Medium">Medium</option>
                      <option value="Low">Low</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="font-mono text-[10px] font-semibold text-slate-400 uppercase tracking-wide ml-1">Regulation Name</label>
                  <input 
                    type="text"
                    placeholder="e.g. Building Safety Act 2022 Section 1"
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all"
                    value={newReg.name}
                    onChange={e => setNewReg({ ...newReg, name: e.target.value })}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="font-mono text-[10px] font-semibold text-slate-400 uppercase tracking-wide ml-1">Abbreviation / Tag</label>
                  <input 
                    type="text"
                    placeholder="e.g. BSA2022"
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all"
                    value={newReg.reg}
                    onChange={e => setNewReg({ ...newReg, reg: e.target.value })}
                  />
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between px-1">
                    <label className="text-[10px] font-medium text-slate-500">Requirement Details</label>
                    <AIWriter
                      onSuggest={(text) => setNewReg({ ...newReg, req: text })}
                      context={[
                        `Write a specific UK compliance requirement for a ${newReg.cat} regulation.`,
                        `Regulation Name: ${newReg.name || 'Not specified'}.`,
                        `Abbreviation/Tag: ${newReg.reg || 'Not specified'}.`,
                        `Risk Level: ${newReg.risk}.`,
                        activeProject ? `Project: ${activeProject.name}, Type: ${(activeProject as any).type || 'N/A'}, Location: ${(activeProject as any).loc || 'N/A'}.` : '',
                        activeProgramme ? `Programme: ${(activeProgramme as any).name}.` : '',
                        `Provide a specific, actionable compliance requirement statement — not a generic summary. Plain text only, no markdown.`
                      ].filter(Boolean).join(' ')}
                      label="AI Assist"
                      placeholder="e.g. focus on residential conversions, or Grade II listed buildings in conservation areas"
                    />
                  </div>
                  <textarea 
                    placeholder="Detail exactly what is required for compliance..."
                    className="w-full h-24 px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all resize-none"
                    value={newReg.req}
                    onChange={e => setNewReg({ ...newReg, req: e.target.value })}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="font-mono text-[10px] font-semibold text-slate-400 uppercase tracking-wide ml-1">Penalty for Breach</label>
                  <input 
                    type="text"
                    placeholder="e.g. Fines up to £10m, stop notices"
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all"
                    value={newReg.penalty}
                    onChange={e => setNewReg({ ...newReg, penalty: e.target.value })}
                  />
                </div>
              </div>

              <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3 px-6 sticky bottom-0">
                <button 
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-5 py-2.5 text-xs font-bold text-slate-500 hover:bg-white rounded-lg transition-all"
                >
                  Cancel
                </button>
                <button 
                  onClick={async () => {
                    if (!newReg.name || !newReg.req) {
                      toast.error('Please provide at least a name and requirement description.');
                      return;
                    }
                    if (!activeProjectId && !activeProgrammeId) {
                      toast.error('Please select a project or programme before saving.');
                      return;
                    }
                    setIsSavingEntry(true);
                    try {
                      await addCustomRegulation({
                        ...newReg as RegulationItem,
                        id: generateId('REG'),
                        process: "Identify Requirement|Evidence Collection|Review|Verification",
                        evidence: "Document Evidence|Third Party Audit",
                        owners: user?.profile?.name || "System Admin",
                        when: "Immediate",
                        alerts: "Default Alert",
                        lastUpdated: new Date().toISOString(),
                        updates: []
                      });
                      toast.success('Regulation added successfully');
                      setIsAddModalOpen(false);
                      setNewReg({ cat: allCats[0] || 'General', risk: 'Medium', status: 'Not Started', tag: 'Manual' });
                    } catch (err) {
                      toast.error('Failed to add regulation. Please try again.');
                    } finally {
                      setIsSavingEntry(false);
                    }
                  }}
                  disabled={isSavingEntry || !newReg.name || !newReg.req}
                  className="font-mono px-6 py-2.5 bg-indigo-600 text-white text-xs font-semibold uppercase tracking-wide rounded-lg hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {isSavingEntry && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  {isSavingEntry ? 'Saving...' : 'Confirm Entry'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* AI Inquiry Popup */}
      <AIInquiryPopup 
        isOpen={isAIInquiryOpen} 
        onClose={() => setIsAIInquiryOpen(false)}
        context={[
          `You are CedarGuard AI assisting with the Regulation Library.`,
          activeProject ? `Active Project: ${activeProject.name} (Type: ${(activeProject as any).type || 'N/A'}, Location: ${(activeProject as any).loc || 'N/A'}).` : '',
          activeProgramme ? `Active Programme: ${(activeProgramme as any).name}.` : '',
          `The library contains ${allItems.length} regulations across categories: ${allCats.join(', ')}.`,
          `Provide specific, project-relevant regulatory guidance based on the active project context.`
        ].filter(Boolean).join(' ')}
      />

      {/* Floating Action Button for AI Inquiry */}
      <motion.button
        whileHover={{ scale: 1.05, y: -2 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setIsAIInquiryOpen(true)}
        className="font-mono fixed bottom-8 right-8 w-14 h-14 bg-indigo-600 text-white rounded-full shadow-2xl flex items-center justify-center z-50 group hover:bg-slate-900 transition-all font-semibold text-xs uppercase tracking-wide"
        title="Ask CedarGuard AI"
      >
        <div className="absolute inset-0 rounded-full bg-indigo-400 animate-ping opacity-20 group-hover:hidden"></div>
        <MessageSquare className="w-6 h-6 group-hover:rotate-12 transition-transform" />
      </motion.button>
    </div>
  );
}
