import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router';
import { useStore } from '../store/useStore';
import {
  format, addMonths, subMonths, startOfMonth, endOfMonth,
  startOfWeek, endOfWeek, isSameMonth, isSameDay, addDays,
  parseISO, isWithinInterval, isValid
} from 'date-fns';
import {
  ChevronLeft, ChevronRight, Calendar as CalendarIcon,
  Plus, Search, Filter, Building2, Rocket, Clock, ChevronDown, X, Layers, Check, Loader2
} from 'lucide-react';
import toast from 'react-hot-toast';
import { clsx } from 'clsx';
import { getRIBALabelFull } from '../data/complianceData';
import { isAtLeastPM } from '../lib/roles';

export function Calendar() {
  const {
    projects,
    programmes,
    complianceItems,
    risks,
    tasks,
    addTask,
    updateTask,
    deleteTask,
    issues,
    activeProjectId,
    activeProgrammeId,
    setActiveProject,
    setActiveProgramme,
    user
  } = useStore();
  const canAddEvents = isAtLeastPM(user?.role);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<'month' | 'week' | 'day'>('month');
  const [filters, setFilters] = useState({
    compliance: true,
    risk: true,
    milestone: true,
    task: true,
    issue: true
  });
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const compareParam = queryParams.get('compare') === 'true';

  const [compareMode, setCompareMode] = useState(compareParam);
  const [splitView, setSplitView] = useState(false);

  useEffect(() => {
    if (compareParam) {
      setCompareMode(true);
    }
  }, [compareParam]);
  const [compareIdA, setCompareIdA] = useState<string | null>(null);
  const [compareIdB, setCompareIdB] = useState<string | null>(null);
  const [mergedCompareIds, setMergedCompareIds] = useState<string[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<any>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // Add Event form (controlled state)
  const [newEventForm, setNewEventForm] = useState({ title: '', description: '', date: '' });
  const [titleError, setTitleError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Edit / Delete state for task events
  const [isEditMode, setIsEditMode] = useState(false);
  const [editForm, setEditForm] = useState({ title: '', description: '', date: '', projectId: '' });
  const [editTitleError, setEditTitleError] = useState('');
  const [isEditSaving, setIsEditSaving] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Reset and pre-populate Add Event form whenever modal opens
  useEffect(() => {
    if (isAddModalOpen) {
      setNewEventForm({ title: '', description: '', date: format(selectedDate, 'yyyy-MM-dd') });
      setTitleError('');
    }
  }, [isAddModalOpen]);

  // Pre-populate edit form and reset edit/delete UI whenever the selected event changes
  useEffect(() => {
    if (selectedEvent?.type === 'task' && selectedEvent.originalItem) {
      setEditForm({
        title: selectedEvent.originalItem.title || '',
        description: selectedEvent.originalItem.description || '',
        date: selectedEvent.originalItem.dueDate || '',
        projectId: selectedEvent.originalItem.projectId || '',
      });
    }
    setIsEditMode(false);
    setShowDeleteConfirm(false);
    setEditTitleError('');
  }, [selectedEvent]);

  // --- Event modal handlers ---
  const handleCloseEventModal = () => {
    setSelectedEvent(null);
    setIsEditMode(false);
    setShowDeleteConfirm(false);
    setEditTitleError('');
  };

  const handleAddEvent = async () => {
    if (!newEventForm.title.trim()) {
      setTitleError('Event name is required');
      return;
    }
    setIsSaving(true);
    try {
      // Always scope the task to the currently active context.
      // This mirrors how risks, compliance items, and issues work in this app —
      // one context at a time, no cross-context writes.
      const contextProjectId = activeProjectId || undefined;
      const contextProgrammeId = !activeProjectId ? (activeProgrammeId || undefined) : undefined;
      const activeProject = safeProjects.find(p => p.id === activeProjectId);
      const activeProgramme = safeProgrammes.find(p => p.id === activeProgrammeId);
      const contextName = activeProject?.name ?? activeProgramme?.name ?? 'General';

      await (addTask as any)({
        id: crypto.randomUUID(),
        title: newEventForm.title.trim(),
        description: newEventForm.description,
        dueDate: newEventForm.date || format(selectedDate, 'yyyy-MM-dd'),
        status: 'Pending',
        priority: 'Medium',
        projectId: contextProjectId,
        programmeId: contextProgrammeId,
        projectName: contextName,
      });
      toast.success('Event added to calendar');
      setIsAddModalOpen(false);
    } catch {
      toast.error('Failed to save event. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleEditEvent = async () => {
    if (!editForm.title.trim()) {
      setEditTitleError('Event name is required');
      return;
    }
    if (!selectedEvent?.originalItem?.id) return;
    setIsEditSaving(true);
    try {
      await (updateTask as any)(selectedEvent.originalItem.id, {
        title: editForm.title.trim(),
        description: editForm.description,
        dueDate: editForm.date,
        projectId: editForm.projectId || undefined,
        projectName: editForm.projectId
          ? safeProjects.find(p => p.id === editForm.projectId)?.name ?? 'General'
          : 'General',
      });
      toast.success('Event updated');
      handleCloseEventModal();
    } catch {
      toast.error('Failed to update event. Please try again.');
    } finally {
      setIsEditSaving(false);
    }
  };

  const handleDeleteEvent = async () => {
    if (!selectedEvent?.originalItem?.id) return;
    setIsDeleting(true);
    try {
      await (deleteTask as any)(selectedEvent.originalItem.id);
      toast.success('Event deleted');
      handleCloseEventModal();
    } catch {
      toast.error('Failed to delete event. Please try again.');
    } finally {
      setIsDeleting(false);
    }
  };

  // Safety Guards for Store Collections
  const safeProjects = Array.isArray(projects) ? projects : [];
  const safeProgrammes = Array.isArray(programmes) ? programmes : [];
  const safeCompliance = Array.isArray(complianceItems) ? complianceItems : [];
  const safeRisks = Array.isArray(risks) ? risks : [];
  const safeTasks = Array.isArray(tasks) ? tasks : [];
  const safeIssues = Array.isArray(issues) ? issues : [];

  // Filter out archived items by default
  const activeProjects = safeProjects.filter(p => !p.isArchived);
  const activeProgrammes = safeProgrammes.filter(p => !p.isArchived);

  // Aggregate all events
  // Component-level helper to get events for a specific context
  const getContextEvents = (type: 'all' | 'project' | 'programme', id?: string | null) => {
    const allEvents: any[] = [];

    let filteredProjects = activeProjects;
    let filteredProgrammes = activeProgrammes;

    if (type === 'project' && id) {
      filteredProjects = activeProjects.filter(p => p.id === id);
      filteredProgrammes = activeProgrammes.filter(p => p.id === activeProjects.find(proj => proj.id === id)?.programmeId);
    } else if (type === 'programme' && id) {
      filteredProjects = activeProjects.filter(p => p.programmeId === id);
      filteredProgrammes = activeProgrammes.filter(p => p.id === id);
    } else if (type === 'all' && mergedCompareIds.length > 0 && compareMode) {
      filteredProjects = activeProjects.filter(p =>
        mergedCompareIds.includes(`project:${p.id}`) ||
        mergedCompareIds.includes(`programme:${p.programmeId}`)
      );
      filteredProgrammes = activeProgrammes.filter(p =>
        mergedCompareIds.includes(`programme:${p.id}`)
      );
    } else if (activeProjectId && type === 'all') {
      filteredProjects = activeProjects.filter(p => p.id === activeProjectId);
      filteredProgrammes = activeProgrammes.filter(p => p.id === activeProjects.find(proj => proj.id === activeProjectId)?.programmeId);
    } else if (activeProgrammeId && type === 'all') {
      filteredProjects = activeProjects.filter(p => p.programmeId === activeProgrammeId);
      filteredProgrammes = activeProgrammes.filter(p => p.id === activeProgrammeId);
    }

    const projectIds = filteredProjects.map(p => p.id);
    const programmeIds = filteredProgrammes.map(p => p.id);

    // Project Events (Milestones -> Emerald)
    filteredProjects.forEach(p => {
      if (p.startOnSite) {
        const d = parseISO(p.startOnSite);
        if (isValid(d)) allEvents.push({ id: `p-start-${p.id}`, title: `[Start] ${p.name}: Construction Mobilisation`, date: d, type: 'milestone', projectName: p.name, color: 'bg-emerald-500', originalItem: p });
      }
      if (p.targetPC) {
        const d = parseISO(p.targetPC);
        if (isValid(d)) allEvents.push({ id: `p-pc-${p.id}`, title: `[PC] ${p.name}: Target Completion Date`, date: d, type: 'milestone', projectName: p.name, color: 'bg-emerald-500', originalItem: p });
      }
      if (p.milestones && p.milestones.length > 0) {
        p.milestones.forEach(m => {
          if (m.date) {
            const d = parseISO(m.date);
            if (isValid(d)) {
              const ribaLabel = m.stage ? `(Stage ${m.stage})` : '';
              allEvents.push({ id: `p-mile-${p.id}-${m.id}`, title: `[Milestone] ${p.name}: ${m.name} ${ribaLabel}`, date: d, type: 'milestone', projectName: p.name, color: m.isKey ? 'bg-amber-500' : 'bg-emerald-500', isKey: m.isKey, originalItem: { ...p, milestoneDetails: m } });
            }
          }
        });
      }
    });

    // Programme Events (Milestones -> Emerald)
    filteredProgrammes.forEach(prog => {
      if (prog.programmeStartDate) {
        const d = parseISO(prog.programmeStartDate);
        if (isValid(d)) allEvents.push({ id: `prog-start-${prog.id}`, title: `[Start] ${prog.name}: Programme Inception`, date: d, type: 'milestone', projectName: prog.name, color: 'bg-emerald-500', originalItem: prog });
      }
      if (prog.programmeEndDate) {
        const d = parseISO(prog.programmeEndDate);
        if (isValid(d)) allEvents.push({ id: `prog-end-${prog.id}`, title: `[End] ${prog.name}: Programme Closeout`, date: d, type: 'milestone', projectName: prog.name, color: 'bg-emerald-500', originalItem: prog });
      }
      if (prog.milestones && prog.milestones.length > 0) {
        prog.milestones.forEach(m => {
          if (m.date) {
            const d = parseISO(m.date);
            if (isValid(d)) {
              const ribaLabel = m.stage ? `(Stage ${m.stage})` : '';
              allEvents.push({ id: `prog-mile-${prog.id}-${m.id}`, title: `[Milestone] ${prog.name}: ${m.name} ${ribaLabel}`, date: d, type: 'milestone', projectName: prog.name, color: m.isKey ? 'bg-amber-500' : 'bg-emerald-500', isKey: m.isKey, originalItem: { ...prog, milestoneDetails: m } });
            }
          }
        });
      }
    });

    const filteredCompliance = safeCompliance.filter(c =>
      c.projectId ? projectIds.includes(c.projectId) : (c.programmeId && programmeIds.includes(c.programmeId))
    );
    const filteredRisks = safeRisks.filter(r =>
      r.projectId ? projectIds.includes(r.projectId) : (r.programmeId && programmeIds.includes(r.programmeId))
    );
    // Tasks are context-scoped: show tasks belonging to the active project(s) or programme(s).
    // Tasks with no projectId but a programmeId belong to a programme context.
    // Tasks with neither belong to the general/global context and always show.
    const filteredTasks = safeTasks.filter(t => {
      if (t.projectId) return projectIds.includes(t.projectId);
      if (t.programmeId) return programmeIds.includes(t.programmeId);
      return true; // general tasks (no context) always visible
    });
    const filteredIssues = safeIssues.filter(i =>
      i.projectId ? projectIds.includes(i.projectId) : (i.programmeId && programmeIds.includes(i.programmeId))
    );

    // Compliance Events (Blue)
    filteredCompliance.forEach(item => {
      if (item.dueDate) {
        const d = parseISO(item.dueDate);
        if (isValid(d)) allEvents.push({ id: `comp-${item.id}`, title: `[Compliance: ${item.reg}] ${item.req} - ${item.projectName || 'General'}`, date: d, type: 'compliance', projectName: item.projectName || 'General', color: 'bg-blue-500', originalItem: item });
      }
    });

    // Risk Events (Red)
    filteredRisks.forEach(risk => {
      if (risk.dueDate) {
        const d = parseISO(risk.dueDate);
        if (isValid(d)) allEvents.push({ id: `risk-due-${risk.id}`, title: `[Risk Action] ${risk.title} - ${risk.project || risk.programme || 'General'}`, date: d, type: 'risk', projectName: risk.project || risk.programme || 'General', color: 'bg-red-500', originalItem: risk });
      }
      if (risk.nextReviewDate) {
        const d = parseISO(risk.nextReviewDate);
        if (isValid(d)) allEvents.push({ id: `risk-rev-${risk.id}`, title: `[Risk Review] ${risk.title} - ${risk.project || risk.programme || 'General'}`, date: d, type: 'risk', projectName: risk.project || risk.programme || 'General', color: 'bg-red-500', originalItem: risk });
      }
    });

    // Task Events (Slate)
    filteredTasks.forEach(task => {
      if (task.dueDate) {
        const d = parseISO(task.dueDate);
        if (isValid(d)) allEvents.push({ id: `task-${task.id}`, title: `[Task] ${task.title} - ${task.projectName || 'General'}`, date: d, type: 'task', projectName: task.projectName || 'General', color: 'bg-slate-500', originalItem: task });
      }
    });

    // Issue Events (Orange)
    filteredIssues.forEach(issue => {
      if (issue.deadline) {
        const d = parseISO(issue.deadline);
        if (isValid(d)) allEvents.push({ id: `issue-${issue.id}`, title: `[Issue] ${issue.id}: ${issue.desc}`, date: d, type: 'issue', projectName: issue.project || 'General', color: 'bg-orange-500', originalItem: issue });
      }
    });

    return allEvents.filter(e => {
      if (e.type === 'compliance' && !filters.compliance) return false;
      if (e.type === 'risk' && !filters.risk) return false;
      if (e.type === 'milestone' && !filters.milestone) return false;
      if (e.type === 'task' && !filters.task) return false;
      if (e.type === 'issue' && !filters.issue) return false;
      return true;
    });
  };

  const events = useMemo(() => getContextEvents('all'), [activeProjects, activeProgrammes, safeCompliance, safeRisks, safeTasks, safeIssues, activeProjectId, activeProgrammeId, filters, compareMode, mergedCompareIds]);
  const eventsA = useMemo(() => {
    if (!compareIdA) return [];
    const [type, id] = compareIdA.split(':');
    return getContextEvents(type as any, id);
  }, [compareIdA, activeProjects, activeProgrammes, safeCompliance, safeRisks, safeTasks, safeIssues, filters, compareMode]);

  const eventsB = useMemo(() => {
    if (!compareIdB) return [];
    const [type, id] = compareIdB.split(':');
    return getContextEvents(type as any, id);
  }, [compareIdB, activeProjects, activeProgrammes, safeCompliance, safeRisks, safeTasks, safeIssues, filters, compareMode]);

  const conflicts = useMemo(() => {
    const dayMap = new Map<string, Set<string>>();
    events.forEach(event => {
      const dateStr = format(event.date, 'yyyy-MM-dd');
      if (!dayMap.has(dateStr)) dayMap.set(dateStr, new Set());
      dayMap.get(dateStr)?.add(event.projectName || 'General');
    });

    const conflictDays: string[] = [];
    dayMap.forEach((projects, date) => {
      if (projects.size > 1) conflictDays.push(date);
    });
    return conflictDays;
  }, [events]);



  const renderHeader = () => {
    return (
      <div className="space-y-6 mb-10">
        {/* Top Row: Title & Action Summary */}
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-5">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2.5 md:p-3 bg-indigo-600 rounded-lg shadow-lg shadow-indigo-200/50 shrink-0">
                <CalendarIcon className="w-6 h-6 md:w-8 md:h-8 text-white" />
              </div>
              <h1 className="text-xl sm:text-2xl lg:text-4xl font-black text-slate-900 tracking-tight">
                Project Calendar
              </h1>
            </div>
            <div className="flex items-center gap-3 ml-1">
              <div className="hidden sm:block h-1 w-12 bg-indigo-600 rounded-full shrink-0" />
              <p className="text-[9px] sm:text-[11px] text-slate-500 font-bold uppercase tracking-[0.15em] sm:tracking-[0.2em] opacity-70">
                {compareMode ? 'High-Level Timeline Comparison Mode' : `Tracking ${events.length} milestones across ${activeProjects.length} active projects`}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 xl:flex items-stretch xl:items-center gap-3 w-full xl:w-auto">
              <button
                onClick={() => {
                  setCompareMode(!compareMode);
                  if (!compareMode) setSplitView(false);
                }}
                className={clsx(
                  "px-4 py-3 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-all shrink-0",
                  compareMode 
                    ? "bg-amber-100 text-amber-700 border-2 border-amber-200 shadow-lg shadow-amber-100" 
                    : "bg-white border-2 border-slate-100 text-slate-600 hover:bg-slate-50 shadow-sm"
                )}
              >
                <Layers className="w-4 h-4" />
                {compareMode ? 'Exit Comparison' : 'Diary Comparison'}
              </button>
              {compareMode && (
                <button
                  onClick={() => setSplitView(!splitView)}
                  className={clsx(
                    "px-4 py-3 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-all shrink-0",
                    splitView 
                      ? "bg-indigo-100 text-indigo-700 border-2 border-indigo-200" 
                      : "bg-white border-2 border-slate-100 text-slate-600"
                  )}
                >
                  {splitView ? 'Merge Views' : 'Split View'}
                </button>
              )}
             {canAddEvents && (
               <button
                 onClick={() => setIsAddModalOpen(true)}
                 className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-3 rounded-lg text-sm font-bold shadow-lg shadow-indigo-200 flex items-center justify-center gap-2 transition-all shrink-0"
               >
                 <Plus className="w-4 h-4" />
                 Add Event
               </button>
             )}
             {/* Dynamic Context Selector - Move here for priority */}
             <div className="relative group col-span-2 xl:min-w-[280px]">
              <select
                value={activeProjectId ? `project-${activeProjectId}` : activeProgrammeId ? `programme-${activeProgrammeId}` : 'all'}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === 'all') {
                    setActiveProject(null);
                    setActiveProgramme(null);
                  } else if (val.startsWith('programme-')) {
                    setActiveProgramme(val.replace('programme-', ''));
                  } else if (val.startsWith('project-')) {
                    setActiveProject(val.replace('project-', ''));
                  }
                }}
                className="appearance-none w-full bg-white border-2 border-slate-100 text-slate-900 text-sm font-bold rounded-lg focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 block pl-11 pr-10 py-3.5 shadow-sm transition-all hover:bg-slate-50 hover:border-slate-200"
              >
                <option value="all">All Programmes (Aggregate View)</option>
                {safeProgrammes.length > 0 && (
                  <optgroup label="Programmes">
                    {safeProgrammes.map(p => (
                      <option key={p.id} value={`programme-${p.id}`}>{p.name}</option>
                    ))}
                  </optgroup>
                )}
                <optgroup label="Projects">
                  {safeProjects.map(p => (
                    <option key={p.id} value={`project-${p.id}`}>{p.name}</option>
                  ))}
                </optgroup>
              </select>
              <div className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none text-indigo-500">
                <Filter className="w-4 h-4" />
              </div>
               <div className="absolute inset-y-0 right-0 flex items-center pr-4 pointer-events-none text-slate-400 group-hover:text-indigo-500 transition-colors">
                <ChevronDown className="w-4 h-4" />
              </div>
            </div>
          </div>
        </div>

        {/* Context Selector UI */}
        {(() => {
          const ContextDropdown = ({ value, onChange, label, icon: Icon }: any) => (
            <div className="relative group flex-1">
              <select
                value={value || ''}
                onChange={(e) => onChange(e.target.value)}
                className="appearance-none w-full bg-white border-2 border-slate-100 text-slate-900 text-sm font-bold rounded-lg focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 block pl-11 pr-10 py-3.5 shadow-sm transition-all hover:bg-slate-50 hover:border-slate-200"
              >
                <option value="">Select {label}</option>
                <optgroup label="Programmes">
                  {safeProgrammes.map(p => (
                    <option key={p.id} value={`programme:${p.id}`}>{p.name}</option>
                  ))}
                </optgroup>
                <optgroup label="Projects">
                  {safeProjects.map(p => (
                    <option key={p.id} value={`project:${p.id}`}>{p.name}</option>
                  ))}
                </optgroup>
              </select>
              <div className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none text-indigo-500">
                <Icon className="w-4 h-4" />
              </div>
               <div className="absolute inset-y-0 right-0 flex items-center pr-4 pointer-events-none text-slate-400 group-hover:text-indigo-500 transition-colors">
                <ChevronDown className="w-4 h-4" />
              </div>
            </div>
          );

          if (!compareMode) return null;

          if (splitView) {
            return (
              <div className="p-6 bg-slate-900 rounded-lg border border-slate-800 shadow-2xl animate-in fade-in slide-in-from-top-4 mb-2">
                <div className="flex items-center gap-4 text-white mb-6">
                  <div className="p-2 bg-indigo-500/20 rounded-lg border border-indigo-500/20">
                    <Layers className="w-5 h-5 text-indigo-400" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-bold tracking-tight">Split-View Configuration</h3>
                      <span className="px-2 py-0.5 bg-indigo-500 text-[10px] font-black uppercase rounded-full tracking-widest">Active</span>
                    </div>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Select projects to compare side-by-side</p>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 relative">
                   <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 bg-indigo-600 rounded-full flex items-center justify-center text-white text-[10px] font-black z-10 border-4 border-slate-900 hidden md:flex">
                    VS
                   </div>
                   <ContextDropdown 
                     label="Project A" 
                     value={compareIdA} 
                     onChange={setCompareIdA} 
                     icon={Building2} 
                   />
                   <ContextDropdown 
                     label="Project B" 
                     value={compareIdB} 
                     onChange={setCompareIdB} 
                     icon={Rocket} 
                   />
                </div>
              </div>
            );
          }

          return (
            <div className="p-6 bg-indigo-50/50 border-2 border-dashed border-indigo-200 rounded-lg animate-in fade-in slide-in-from-top-4 mb-2">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-6">
                <div className="flex items-center gap-4">
                  <div className="p-2 bg-indigo-100 rounded-lg">
                    <Layers className="w-5 h-5 text-indigo-600" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-indigo-900 uppercase tracking-widest">Merged Comparison Mode</h3>
                    <p className="text-[10px] text-indigo-600/60 font-bold uppercase tracking-widest">Toggle multiple calendars to overlay them</p>
                  </div>
                </div>
                <button 
                  onClick={() => setMergedCompareIds([])}
                  className="px-4 py-2 bg-white border border-indigo-200 text-[10px] font-black text-indigo-600 uppercase tracking-widest rounded-lg hover:bg-indigo-50 transition-colors shadow-sm"
                >
                  Clear All Selections
                </button>
              </div>
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div>
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3 ml-2">Programmes</h4>
                  <div className="flex flex-wrap gap-2">
                    {activeProgrammes.map(prog => (
                      <button
                        key={prog.id}
                        onClick={() => {
                          const id = `programme:${prog.id}`;
                          setMergedCompareIds(prev => 
                            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
                          );
                        }}
                        className={clsx(
                          "px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 border-2",
                          mergedCompareIds.includes(`programme:${prog.id}`)
                            ? "bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-100"
                            : "bg-white border-slate-100 text-slate-600 hover:border-indigo-200 hover:bg-indigo-50/30"
                        )}
                      >
                        <Building2 className="w-3.5 h-3.5" />
                        {prog.name}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3 ml-2">Projects</h4>
                  <div className="flex flex-wrap gap-2">
                    {activeProjects.map(proj => (
                      <button
                        key={proj.id}
                        onClick={() => {
                          const id = `project:${proj.id}`;
                          setMergedCompareIds(prev => 
                            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
                          );
                        }}
                        className={clsx(
                          "px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 border-2",
                          mergedCompareIds.includes(`project:${proj.id}`)
                            ? "bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-100"
                            : "bg-white border-slate-100 text-slate-600 hover:border-indigo-200 hover:bg-indigo-100/30"
                        )}
                      >
                        <Rocket className="w-3.5 h-3.5" />
                        {proj.name}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          );
        })()}

        {/* Global Controls & Filtering Bar */}
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4 p-3 sm:p-2 bg-white/50 backdrop-blur-md border border-slate-100 rounded-lg sm:rounded-lg shadow-xl shadow-slate-200/40">
          <div className="flex flex-nowrap sm:flex-wrap items-center gap-2 px-2 overflow-x-auto sm:overflow-visible scrollbar-none">
             <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mr-2 ml-2">Quick Filter:</span>
             <button
               onClick={() => setFilters(f => ({ ...f, milestone: !f.milestone }))}
               className={clsx(
                 "flex items-center gap-2 px-4 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all duration-300",
                 filters.milestone ? "bg-emerald-500 text-white shadow-lg shadow-emerald-200" : "bg-slate-50 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
               )}
             >
               <div className={clsx("w-1.5 h-1.5 rounded-full", filters.milestone ? "bg-white" : "bg-emerald-500")} />
               Milestones
             </button>
             <button
               onClick={() => setFilters(f => ({ ...f, compliance: !f.compliance }))}
               className={clsx(
                 "flex items-center gap-2 px-4 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all duration-300",
                 filters.compliance ? "bg-blue-500 text-white shadow-lg shadow-blue-200" : "bg-slate-50 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
               )}
             >
               <div className={clsx("w-1.5 h-1.5 rounded-full", filters.compliance ? "bg-white" : "bg-blue-500")} />
               Compliance
             </button>
             <button
               onClick={() => setFilters(f => ({ ...f, risk: !f.risk }))}
               className={clsx(
                 "flex items-center gap-2 px-4 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all duration-300",
                 filters.risk ? "bg-red-500 text-white shadow-lg shadow-red-200" : "bg-slate-50 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
               )}
             >
               <div className={clsx("w-1.5 h-1.5 rounded-full", filters.risk ? "bg-white" : "bg-red-500")} />
               Risks
             </button>
              <button
                onClick={() => setFilters(f => ({ ...f, task: !f.task }))}
                className={clsx(
                  "flex items-center gap-2 px-4 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all duration-300",
                  filters.task ? "bg-slate-500 text-white shadow-lg shadow-slate-200" : "bg-slate-50 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                )}
              >
                <div className={clsx("w-1.5 h-1.5 rounded-full", filters.task ? "bg-white" : "bg-slate-500")} />
                Tasks
              </button>
              <button
                onClick={() => setFilters(f => ({ ...f, issue: !f.issue }))}
                className={clsx(
                  "flex items-center gap-2 px-4 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all duration-300",
                  filters.issue ? "bg-orange-500 text-white shadow-lg shadow-orange-200" : "bg-slate-50 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                )}
              >
                <div className={clsx("w-1.5 h-1.5 rounded-full", filters.issue ? "bg-white" : "bg-orange-500")} />
                Issues
              </button>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-2 bg-slate-100 p-1.5 rounded-lg w-full lg:w-auto">
            <div className="flex gap-1 mr-0 sm:mr-4">
              <button 
                onClick={() => setViewMode('month')}
                className={clsx(
                  "px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all",
                  viewMode === 'month' ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-700 hover:bg-white/50"
                )}
              >
                Month
              </button>
              <button 
                onClick={() => setViewMode('week')}
                className={clsx(
                  "px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all",
                  viewMode === 'week' ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-700 hover:bg-white/50"
                )}
              >
                Week
              </button>
              <button 
                onClick={() => setViewMode('day')}
                className={clsx(
                  "px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all",
                  viewMode === 'day' ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-700 hover:bg-white/50"
                )}
              >
                Day
              </button>
            </div>
            
            <div className="flex items-center gap-2">
              <button 
                onClick={() => {
                  if (viewMode === 'month') setCurrentMonth(subMonths(currentMonth, 1));
                  else if (viewMode === 'week') setCurrentMonth(addDays(currentMonth, -7));
                  else setCurrentMonth(addDays(currentMonth, -1));
                }}
                className="p-2.5 bg-white hover:bg-indigo-50 rounded-lg shadow-sm transition-all text-slate-400 hover:text-indigo-600 border border-slate-200/50"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              
              <div className="bg-white px-3 sm:px-6 py-2 rounded-lg border border-slate-200/50 shadow-sm min-w-[120px] sm:min-w-[180px] text-center">
                <span className="text-[11px] font-black text-slate-900 uppercase tracking-widest whitespace-nowrap">
                  {viewMode === 'month' 
                    ? format(currentMonth, 'MMMM yyyy') 
                    : viewMode === 'week'
                      ? `W/C ${format(startOfWeek(currentMonth, { weekStartsOn: 1 }), 'do MMM')}`
                      : format(currentMonth, 'EEEE, do MMM')
                  }
                </span>
              </div>

              <button 
                onClick={() => {
                  if (viewMode === 'month') setCurrentMonth(addMonths(currentMonth, 1));
                  else if (viewMode === 'week') setCurrentMonth(addDays(currentMonth, 7));
                  else setCurrentMonth(addDays(currentMonth, 1));
                }}
                className="p-2.5 bg-white hover:bg-indigo-50 rounded-lg shadow-sm transition-all text-slate-400 hover:text-indigo-600 border border-slate-200/50"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderDays = () => {
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const shortDays = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
    return (
      <div className="grid grid-cols-7 mb-2">
        {days.map((day, idx) => (
          <div key={day} className="text-center text-[10px] font-black text-slate-400 uppercase tracking-widest py-2">
            <span className="hidden sm:inline">{day}</span>
            <span className="sm:hidden">{shortDays[idx]}</span>
          </div>
        ))}
      </div>
    );
  };

  const renderCells = (targetEvents: any[] = events) => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(monthStart);
    const startDate = startOfWeek(monthStart, { weekStartsOn: 1 });
    const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 });

    const rows = [];
    let days = [];
    let day = startDate;
    let formattedDate = "";

    if (viewMode === 'month') {
      while (day <= endDate) {
        for (let i = 0; i < 7; i++) {
          formattedDate = format(day, 'd');
          const cloneDay = day;
          const dayEvents = targetEvents.filter(e => isSameDay(e.date, cloneDay));
          
          days.push(
            <div
              key={day.toString()}
              className={clsx(
                "min-h-[140px] p-2 bg-white border border-slate-100 transition-all cursor-pointer group hover:bg-slate-50/50",
                !isSameMonth(day, monthStart) ? "opacity-30" : "opacity-100",
                isSameDay(day, new Date()) ? "bg-indigo-50/30" : ""
              )}
              onClick={() => setSelectedDate(cloneDay)}
            >
              <div className="flex justify-between items-start mb-2">
                <span className={clsx(
                  "text-xs font-black w-6 h-6 flex items-center justify-center rounded-lg transition-colors",
                  isSameDay(day, new Date())
                    ? "bg-indigo-600 text-white shadow-lg shadow-indigo-200"
                    : isSameDay(day, selectedDate)
                      ? "ring-2 ring-indigo-400 bg-indigo-50 text-indigo-700"
                      : "text-slate-400 group-hover:text-slate-900"
                )}>
                  {formattedDate}
                </span>
                {conflicts.includes(format(day, 'yyyy-MM-dd')) && (
                  <div className="px-1.5 py-0.5 bg-red-100 text-[8px] font-black text-red-600 rounded uppercase tracking-tighter animate-pulse">
                    Conflict
                  </div>
                )}
                {canAddEvents && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedDate(cloneDay);
                      setIsAddModalOpen(true);
                    }}
                    className="opacity-0 group-hover:opacity-100 p-1 hover:bg-slate-200 rounded text-slate-400 hover:text-indigo-600 transition-all"
                    title="Add Event"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                )}
              </div>
              <div className="space-y-1">
                {dayEvents.slice(0, 3).map(event => (
                  <div 
                    key={event.id}
                    onClick={(e) => { e.stopPropagation(); setSelectedEvent(event); }}
                    className={clsx(
                      "text-[10px] font-bold px-2 py-1 rounded-md text-white truncate shadow-sm cursor-pointer hover:opacity-90 flex items-center gap-1",
                      event.color
                    )}
                    title={event.title}
                  >
                    {event.isKey && <Rocket className="w-2.5 h-2.5 shrink-0" />}
                    <span className="truncate">{event.title}</span>
                  </div>
                ))}
                {dayEvents.length > 3 && (
                  <div className="text-[9px] font-black text-slate-400 pl-1">+{dayEvents.length - 3} more</div>
                )}
              </div>
            </div>
          );
          day = addDays(day, 1);
        }
        rows.push(
          <div className="grid grid-cols-7" key={day.toString()}>
            {days}
          </div>
        );
        days = [];
      }
    } else if (viewMode === 'week') {
      // Weekly view
      const weekStart = startOfWeek(currentMonth, { weekStartsOn: 1 });
      for (let i = 0; i < 7; i++) {
        const currentDay = addDays(weekStart, i);
        const dayEvents = targetEvents.filter(e => isSameDay(e.date, currentDay));
        days.push(
          <div
            key={currentDay.toString()}
            className={clsx(
              "min-h-[140px] p-4 bg-white border border-slate-100 transition-all cursor-pointer group hover:bg-slate-50/50",
              isSameDay(currentDay, new Date()) ? "bg-indigo-50/30" : ""
            )}
            onClick={() => setSelectedDate(currentDay)}
          >
            <div className="flex justify-between items-start mb-4">
              <span className={clsx(
                "text-sm font-black w-8 h-8 flex items-center justify-center rounded-lg transition-colors",
                isSameDay(currentDay, new Date())
                  ? "bg-indigo-600 text-white shadow-lg shadow-indigo-200"
                  : isSameDay(currentDay, selectedDate)
                    ? "ring-2 ring-indigo-400 bg-indigo-50 text-indigo-700"
                    : "text-slate-400 group-hover:text-slate-900"
              )}>
                {format(currentDay, 'd')}
              </span>
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{format(currentDay, 'EEE')}</span>
            </div>
            <div className="space-y-2">
              {dayEvents.map(event => (
                  <div
                    key={event.id}
                    onClick={(e) => { e.stopPropagation(); setSelectedEvent(event); }}
                    title={event.title}
                    className={clsx(
                      "text-[11px] font-black px-3 py-2 rounded-lg text-white shadow-sm flex items-center gap-2 cursor-pointer hover:opacity-90",
                      event.color
                    )}
                  >
                    {event.isKey ? <Rocket className="w-3 h-3 shrink-0" /> : <div className="w-1 h-1 bg-white rounded-full shrink-0" />}
                    <span className="truncate">{event.title}</span>
                  </div>
              ))}
            </div>
          </div>
        );
      }
      rows.push(
        <div className="grid grid-cols-7" key="week-row">
          {days}
        </div>
      );
    } else {
      // Day view
      const dayEvents = targetEvents.filter(e => isSameDay(e.date, currentMonth));
      rows.push(
        <div 
          key="day-row"
          className="min-h-[400px] p-8 bg-white border border-slate-100 flex flex-col gap-6"
        >
          <div className="flex justify-between items-center border-b border-slate-100 pb-6">
            <div className="flex items-center gap-4">
              <span className="text-4xl font-black text-indigo-600">{format(currentMonth, 'd')}</span>
              <div>
                <span className="text-sm font-black text-slate-900 uppercase tracking-widest block">{format(currentMonth, 'EEEE')}</span>
                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">{format(currentMonth, 'MMMM yyyy')}</span>
              </div>
            </div>
            <div className="bg-indigo-50 px-4 py-2 rounded-lg">
              <span className="text-xs font-black text-indigo-600 uppercase tracking-widest">
                {dayEvents.length} Events Scheduled
              </span>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {dayEvents.map(event => (
              <div 
                key={event.id}
                className={clsx(
                  "p-6 rounded-lg text-white shadow-xl shadow-slate-200/50 flex flex-col gap-3 group hover:scale-[1.02] transition-all",
                  event.color
                )}
              >
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] opacity-80">{event.type}</span>
                    {event.isKey && <span className="px-2 py-0.5 bg-white/20 rounded-full text-[8px] font-black uppercase tracking-widest">Key</span>}
                  </div>
                  <div className="w-2 h-2 bg-white rounded-full opacity-50" />
                </div>
                <h4 className="text-lg font-black leading-tight flex items-center gap-2">
                  {event.isKey && <Rocket className="w-5 h-5 text-amber-200 shrink-0" />}
                  {event.projectName}
                </h4>
                <p className="text-sm font-medium opacity-90">{event.title}</p>
                <div className="mt-2 pt-4 border-t border-white/20">
                  <button 
                    onClick={(e) => { e.stopPropagation(); setSelectedEvent(event); }}
                    className="text-[10px] font-black uppercase tracking-widest flex items-center gap-2 hover:underline"
                  >
                    View Details
                    <ChevronRight className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))}
            {dayEvents.length === 0 && (
              <div className="col-span-full py-20 flex flex-col items-center justify-center text-center">
                <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-6">
                  <Clock className="w-10 h-10 text-slate-200" />
                </div>
                <h4 className="text-lg font-black text-slate-900">Clear Schedule</h4>
                <p className="text-sm text-slate-400 mt-2 font-medium">There are no events scheduled for this day.</p>
              </div>
            )}
          </div>
        </div>
      );
    }
    return <div className="bg-white rounded-lg overflow-hidden border border-slate-200 shadow-xl shadow-slate-200/50">{rows}</div>;
  };

  return (
    <div>
      {renderHeader()}
      
      <div className="flex flex-col lg:flex-row gap-8">
        <div className="flex-1">
          {splitView ? (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
              <div className="space-y-4">
                <div className="flex items-center justify-between px-4 mb-2">
                  <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest">Focus View (A)</h3>
                  <div className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded">
                    {compareIdA ? (activeProjects.find(p => `project:${p.id}` === compareIdA)?.name || activeProgrammes.find(p => `programme:${p.id}` === compareIdA)?.name || 'Select Context') : 'Select Context'}
                  </div>
                </div>
                {renderDays()}
                {renderCells(eventsA)}
              </div>
              <div className="space-y-4">
                <div className="flex items-center justify-between px-4 mb-2">
                  <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest">Comparison View (B)</h3>
                  <div className="text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-1 rounded">
                    {compareIdB ? (activeProjects.find(p => `project:${p.id}` === compareIdB)?.name || activeProgrammes.find(p => `programme:${p.id}` === compareIdB)?.name || 'Select Context') : 'Select Context'}
                  </div>
                </div>
                {renderDays()}
                {renderCells(eventsB)}
              </div>
            </div>
          ) : (
            <>
              {renderDays()}
              {renderCells()}
            </>
          )}
        </div>

        {/* Side Panel - Selected Day Details */}
        <div className="w-full lg:w-80 shrink-0">
          <div className="bg-white rounded-lg border border-slate-200 shadow-lg p-6 sticky top-6">
            <div className="mb-6">
              <p className="text-[10px] font-black text-indigo-600 uppercase tracking-[0.2em] mb-1">Schedule for</p>
              <h2 className="text-xl font-black text-slate-900">{format(selectedDate, 'EEEE, do MMMM')}</h2>
            </div>

            <div className="space-y-4">
              {events.filter(e => isSameDay(e.date, selectedDate)).length > 0 ? (
                events.filter(e => isSameDay(e.date, selectedDate)).map(event => (
                  <div 
                    key={event.id} 
                    onClick={() => setSelectedEvent(event)}
                    className="cursor-pointer p-4 bg-slate-50/50 rounded-lg border border-slate-100 group hover:border-indigo-200 transition-all"
                  >
                    <div className="flex items-center justify-between mb-2">
                       <div className="flex items-center gap-2">
                        <div className={clsx("w-2 h-2 rounded-full", event.color)} />
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{event.type.replace('-', ' ')}</span>
                       </div>
                       {event.isKey && <Rocket className="w-3.5 h-3.5 text-amber-500" />}
                    </div>
                    <p className="text-sm font-bold text-slate-900 group-hover:text-indigo-600 transition-colors uppercase tracking-tight">{event.projectName}</p>
                    <p className="text-xs text-slate-500 mt-1 font-medium">{event.title}</p>
                  </div>
                ))
              ) : (
                <div className="py-12 flex flex-col items-center text-center">
                  <Clock className="w-10 h-10 text-slate-200 mb-3" />
                  <p className="text-sm font-bold text-slate-400">No events on this date</p>
                  <p className="text-[11px] text-slate-300 mt-1">Select another date to view upcoming events</p>
                </div>
              )}
            </div>

            <div className="mt-8 pt-8 border-t border-slate-100">
               <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Legend</h3>
                <div className="grid grid-cols-1 gap-y-3">
                  {[
                    { label: 'Milestones (Start/PC)', color: 'bg-emerald-500' },
                    { label: 'Compliance Due', color: 'bg-blue-500' },
                    { label: 'Risk Review/Action', color: 'bg-red-500' },
                    { label: 'General Task', color: 'bg-slate-500' },
                  ].map(l => (
                    <div key={l.label} className="flex items-center gap-2">
                       <div className={clsx("w-2 h-2 rounded-full", l.color)} />
                       <span className="text-[10px] font-bold text-slate-500">{l.label}</span>
                    </div>
                  ))}
                </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modals */}
      {selectedEvent && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={handleCloseEventModal}>
          <div className="bg-white rounded-lg w-full max-w-md shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className={`p-6 flex justify-between items-start text-white ${selectedEvent.color}`}>
              <div>
                <div className="text-[10px] font-black uppercase tracking-widest opacity-80 mb-1">{selectedEvent.type.replace('-', ' ')}</div>
                <h2 className="text-xl font-bold">{isEditMode ? (editForm.title || 'Editing…') : selectedEvent.title}</h2>
              </div>
              <button onClick={handleCloseEventModal} className="p-2 hover:bg-white/20 rounded-full transition-colors">
                <X className="w-5 h-5 text-white" />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
              {isEditMode && selectedEvent.type === 'task' ? (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Event Name</label>
                    <input
                      type="text"
                      value={editForm.title}
                      onChange={e => { setEditForm(f => ({ ...f, title: e.target.value })); setEditTitleError(''); }}
                      className={clsx("w-full px-4 py-3 rounded-lg border focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none", editTitleError ? "border-red-400" : "border-slate-200")}
                    />
                    {editTitleError && <p className="text-xs text-red-500 mt-1 font-medium">{editTitleError}</p>}
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Description</label>
                    <textarea rows={3} value={editForm.description} onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))} className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Date</label>
                    <input type="date" value={editForm.date} onChange={e => setEditForm(f => ({ ...f, date: e.target.value }))} className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Project</label>
                    <select value={editForm.projectId} onChange={e => setEditForm(f => ({ ...f, projectId: e.target.value }))} className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none">
                      <option value="">No Project (General)</option>
                      {safeProjects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  </div>
                </div>
              ) : showDeleteConfirm ? (
                <div className="text-center py-6">
                  <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
                    <X className="w-8 h-8 text-red-500" />
                  </div>
                  <h3 className="text-lg font-black text-slate-900 mb-2">Delete this event?</h3>
                  <p className="text-sm text-slate-500">This action cannot be undone.</p>
                </div>
              ) : (
                <>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Date</label>
                    <div className="text-sm font-medium text-slate-900">{format(selectedEvent.date, 'EEEE, do MMMM yyyy')}</div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Project</label>
                    <div className="text-sm font-medium text-slate-900">{selectedEvent.projectName || 'General'}</div>
                  </div>
                  {selectedEvent.originalItem && (
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Details</label>
                      <div className="text-sm text-slate-700 bg-slate-50 p-4 rounded-lg border border-slate-100 shadow-inner space-y-3">
                        {selectedEvent.type === 'milestone' && (
                          <div className="space-y-4">
                            {selectedEvent.originalItem.milestoneDetails?.stage && (
                              <div className="flex items-center gap-2 p-3 bg-indigo-50 rounded-lg border border-indigo-100">
                                <Layers className="w-4 h-4 text-indigo-600" />
                                <div>
                                  <p className="text-[10px] font-black text-indigo-600 uppercase tracking-widest mb-0.5">RIBA Stage</p>
                                  <p className="text-xs font-bold text-indigo-900">{getRIBALabelFull(selectedEvent.originalItem.milestoneDetails.stage)}</p>
                                </div>
                              </div>
                            )}
                            {(selectedEvent.originalItem.description || selectedEvent.originalItem.milestoneDetails?.notes) && (
                              <div>
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Description & Notes</p>
                                <p className="text-xs font-medium text-slate-700 leading-relaxed">
                                  {selectedEvent.originalItem.milestoneDetails?.notes || selectedEvent.originalItem.description}
                                </p>
                              </div>
                            )}
                            {selectedEvent.originalItem.milestoneDetails?.history && selectedEvent.originalItem.milestoneDetails.history.length > 0 && (
                              <div className="pt-4 border-t border-slate-200">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                                  <Clock className="w-3 h-3" />
                                  Date Revision History
                                </p>
                                <div className="space-y-3">
                                  {selectedEvent.originalItem.milestoneDetails.history.map((h: any, i: number) => (
                                    <div key={i} className="pl-4 border-l-2 border-slate-200 py-1">
                                      <div className="flex items-center justify-between mb-1">
                                        <span className="text-[10px] font-bold text-slate-900">{h.updatedBy || 'System'}</span>
                                        <span className="text-[10px] font-medium text-slate-400">
                                          {h.updatedAt && isValid(parseISO(h.updatedAt)) ? format(parseISO(h.updatedAt), 'dd MMM yyyy') : 'Unknown date'}
                                        </span>
                                      </div>
                                      <p className="text-[10px] text-slate-600 italic mb-1">"{h.comment}"</p>
                                      <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-tighter">
                                        <ChevronRight className="w-2 h-2 text-indigo-500" />
                                        <span className="text-indigo-600">Moved to {h.date}</span>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                        {selectedEvent.type === 'compliance' && (
                          <div className="space-y-2">
                            {selectedEvent.originalItem.reg && <p><strong>Regulation:</strong> {selectedEvent.originalItem.reg}</p>}
                            {selectedEvent.originalItem.requirements && <p><strong>Requirements:</strong> {selectedEvent.originalItem.requirements}</p>}
                            {selectedEvent.originalItem.category && <p><strong>Category:</strong> {selectedEvent.originalItem.category}</p>}
                            {selectedEvent.originalItem.stage && <p><strong>Status:</strong> {selectedEvent.originalItem.stage}</p>}
                          </div>
                        )}
                        {selectedEvent.type === 'risk' && (
                          <div className="space-y-2">
                            {selectedEvent.originalItem.title && <p><strong>Risk:</strong> {selectedEvent.originalItem.title}</p>}
                            {selectedEvent.originalItem.description && <p><strong>Description:</strong> {selectedEvent.originalItem.description}</p>}
                            {selectedEvent.originalItem.status && <p><strong>Status:</strong> {selectedEvent.originalItem.status}</p>}
                            {selectedEvent.originalItem.owner && <p><strong>Owner:</strong> {selectedEvent.originalItem.owner}</p>}
                          </div>
                        )}
                        {selectedEvent.type === 'issue' && (
                          <div className="space-y-2">
                            {selectedEvent.originalItem.description && <p><strong>Description:</strong> {selectedEvent.originalItem.description}</p>}
                            {selectedEvent.originalItem.status && <p><strong>Status:</strong> {selectedEvent.originalItem.status}</p>}
                            {selectedEvent.originalItem.priority && <p><strong>Priority:</strong> {selectedEvent.originalItem.priority}</p>}
                          </div>
                        )}
                        {selectedEvent.type === 'task' && (
                          <div className="space-y-2">
                            {selectedEvent.originalItem.description && <p><strong>Description:</strong> {selectedEvent.originalItem.description}</p>}
                            {selectedEvent.originalItem.status && <p><strong>Status:</strong> {selectedEvent.originalItem.status}</p>}
                            {selectedEvent.originalItem.priority && <p><strong>Priority:</strong> {selectedEvent.originalItem.priority}</p>}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-between items-center gap-3">
              {isEditMode ? (
                <>
                  <button onClick={() => { setIsEditMode(false); setEditTitleError(''); }} className="px-5 py-2.5 rounded-lg font-bold text-slate-600 hover:bg-slate-200 transition-colors">
                    Cancel
                  </button>
                  <button onClick={handleEditEvent} disabled={isEditSaving} className="px-5 py-2.5 rounded-lg font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-200 transition-all flex items-center gap-2 disabled:opacity-60">
                    {isEditSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                    {isEditSaving ? 'Saving…' : 'Save Changes'}
                  </button>
                </>
              ) : showDeleteConfirm ? (
                <>
                  <button onClick={() => setShowDeleteConfirm(false)} className="px-5 py-2.5 rounded-lg font-bold text-slate-600 hover:bg-slate-200 transition-colors">
                    Cancel
                  </button>
                  <button onClick={handleDeleteEvent} disabled={isDeleting} className="px-5 py-2.5 rounded-lg font-bold bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-200 transition-all flex items-center gap-2 disabled:opacity-60">
                    {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4" />}
                    {isDeleting ? 'Deleting…' : 'Yes, Delete'}
                  </button>
                </>
              ) : (
                <>
                  <div className="flex items-center gap-2">
                    {selectedEvent.type === 'task' && (
                      <>
                        <button onClick={() => setIsEditMode(true)} className="px-4 py-2.5 rounded-lg font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 transition-colors text-sm">
                          Edit
                        </button>
                        <button onClick={() => setShowDeleteConfirm(true)} className="px-4 py-2.5 rounded-lg font-bold text-red-600 bg-red-50 hover:bg-red-100 transition-colors text-sm">
                          Delete
                        </button>
                      </>
                    )}
                  </div>
                  <button onClick={handleCloseEventModal} className="px-5 py-2.5 rounded-lg font-bold text-slate-600 hover:bg-slate-200 transition-colors">Close</button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {isAddModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setIsAddModalOpen(false)}>
          <div className="bg-white rounded-lg w-full max-w-md shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b border-slate-100 flex justify-between items-center">
              <h2 className="text-xl font-bold text-slate-900">Add Calendar Event</h2>
              <button onClick={() => setIsAddModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors"><X className="w-5 h-5 text-slate-500" /></button>
            </div>
            <div className="p-6 space-y-4">
              {/* Context label — tells user exactly where this event will be saved */}
              <div className="flex items-center gap-2 px-3 py-2 bg-indigo-50 border border-indigo-100 rounded-lg">
                <Building2 className="w-4 h-4 text-indigo-500 shrink-0" />
                <p className="text-xs font-semibold text-indigo-700">
                  Saving to:{' '}
                  <span className="font-black">
                    {activeProjectId
                      ? (safeProjects.find(p => p.id === activeProjectId)?.name ?? 'Selected Project')
                      : activeProgrammeId
                        ? (safeProgrammes.find(p => p.id === activeProgrammeId)?.name ?? 'Selected Programme')
                        : 'General (no context selected)'}
                  </span>
                </p>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-2">Event Name</label>
                <input
                  type="text"
                  value={newEventForm.title}
                  onChange={e => { setNewEventForm(f => ({ ...f, title: e.target.value })); setTitleError(''); }}
                  className={clsx("w-full px-4 py-3 rounded-lg border focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none", titleError ? "border-red-400" : "border-slate-200")}
                  placeholder="Event title..."
                  autoFocus
                />
                {titleError && <p className="text-xs text-red-500 mt-1 font-medium">{titleError}</p>}
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-2">Description / Notes</label>
                <textarea
                  rows={3}
                  value={newEventForm.description}
                  onChange={e => setNewEventForm(f => ({ ...f, description: e.target.value }))}
                  className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                  placeholder="Details..."
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-2">Date</label>
                <input
                  type="date"
                  value={newEventForm.date}
                  onChange={e => setNewEventForm(f => ({ ...f, date: e.target.value }))}
                  className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                />
              </div>
            </div>
            <div className="p-6 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
              <button onClick={() => setIsAddModalOpen(false)} className="px-6 py-3 rounded-lg font-bold text-slate-600 hover:bg-slate-200 transition-colors">Cancel</button>
              <button
                onClick={handleAddEvent}
                disabled={isSaving}
                className="px-6 py-3 rounded-lg font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-200 transition-all flex items-center gap-2 disabled:opacity-60"
              >
                {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                {isSaving ? 'Adding…' : 'Add Event'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
