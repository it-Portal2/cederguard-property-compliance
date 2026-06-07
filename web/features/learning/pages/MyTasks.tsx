import React, { useState, useMemo } from "react";
import {
  Plus,
  Clock,
  CheckCircle2,
  AlertCircle,
  Calendar,
  CheckSquare,
  Pencil,
  Trash2,
  X,
  Info,
  ShieldCheck,
  ExternalLink,
} from "lucide-react";
import { useNavigate } from "react-router";
import { useStore, TaskItem } from "../../../store/useStore";
import { clsx } from "clsx";
import toast from "react-hot-toast";
import { StatsCard } from "../../../components/common/StatsCard";
import DynamicTable from "../../../components/table/DynamicTable";
import type {
  ColumnDef,
  RowAction,
  BulkAction,
  FilterDef,
} from "../../../components/table/types";
import PageHeader from "../../../components/PageHeader";

type TaskType = "task" | "compliance" | "risk_review" | "issue_deadline";

interface TaskRow {
  id: string;
  title: string;
  description?: string;
  status: TaskItem["status"];
  priority: TaskItem["priority"];
  dueDate: string;
  completedAt?: string;
  projectName?: string;
  projectId?: string;
  isProgrammeLevel?: boolean;
  programmeId?: string;
  type: TaskType;
  original?: any;
  // Derived for DynamicTable filters — the filter `match` callback only
  // receives one field value, so we flatten the cross-field bucket logic.
  _contextId: string;
  _timeline: "overdue" | "today" | "week" | "upcoming" | "completed";
  _isOverdue: boolean;
}

export function MyTasks() {
  const navigate = useNavigate();
  const {
    user,
    tasks,
    complianceItems,
    addTask,
    updateTask,
    deleteTask,
    updateComplianceItem,
    projects,
    programmes,
    activeProjectId,
    activeProgrammeId,
  } = useStore();
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState<"add" | "edit">("add");
  const [currentTask, setCurrentTask] = useState<Partial<TaskItem>>({});

  // Merge manual tasks, actionable compliance items, risk reviews, and issue deadlines.
  const allItems: TaskRow[] = useMemo(() => {
    const userId = user?.id || user?.uid || user?.email;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const bucketFor = (
      status: TaskItem["status"],
      dueDate: string,
    ): TaskRow["_timeline"] => {
      if (status === "Completed") return "completed";
      if (!dueDate || dueDate === "No date set") return "upcoming";
      const due = new Date(dueDate);
      const diffDays = Math.ceil(
        (due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
      );
      if (diffDays < 0) return "overdue";
      if (diffDays === 0) return "today";
      if (diffDays <= 7) return "week";
      return "upcoming";
    };

    // 1. Manual tasks — strict owner filter.
    const manualTasks = (Array.isArray(tasks) ? tasks : [])
      .filter((t) => {
        const isOwner =
          userId &&
          (t.owner === userId ||
            t.owner === user?.email ||
            t.owner === user?.uid);
        return !!isOwner;
      })
      .map<TaskRow>((t) => ({
        ...t,
        type: "task",
        _contextId: (t as any).projectId || (t as any).programmeId || "",
        _timeline: bucketFor(t.status, t.dueDate),
        _isOverdue:
          t.status !== "Completed" &&
          !!t.dueDate &&
          t.dueDate !== "No date set" &&
          new Date(t.dueDate) < today,
      }));

    // 2. Compliance Tracker items — only actionable, owned by user.
    const compActions = (Array.isArray(complianceItems) ? complianceItems : [])
      .filter((c) => {
        const isOwner =
          !userId ||
          c.owners?.includes(userId) ||
          c.pmId === userId ||
          c.userId === userId;
        if (!isOwner) return false;
        return (
          (c.dueDate || c.stage === "In Progress") &&
          c.stage !== "Live" &&
          c.stage !== "Archived"
        );
      })
      .map<TaskRow>((c) => {
        const status: TaskItem["status"] = (c.stage === "In Progress"
          ? "In Progress"
          : c.status === "applicable"
            ? "Pending"
            : c.status === "closed" || c.stage === "Live"
              ? "Completed"
              : c.status) as TaskItem["status"];
        const dueDate = c.dueDate || "No date set";
        return {
          id: c.id,
          title: c.req || c.name || "Compliance Action",
          description: `${c.reg || "General Regulation"} - ${c.auth || "Authority"}`,
          status,
          priority: (c.risk === "Critical" || c.risk === "High"
            ? "High"
            : c.risk === "Low"
              ? "Low"
              : "Medium") as TaskItem["priority"],
          dueDate,
          completedAt: c.completedAt,
          projectName: c.projectName,
          projectId: c.projectId,
          isProgrammeLevel: c.isProgrammeLevel,
          programmeId: c.programmeId,
          type: "compliance",
          original: c,
          _contextId: c.projectId || c.programmeId || "",
          _timeline: bucketFor(status, dueDate),
          _isOverdue:
            status !== "Completed" &&
            dueDate !== "No date set" &&
            new Date(dueDate) < today,
        };
      });

    // 3. Risk Reviews due.
    const { risks, issues } = useStore.getState();
    const riskReviews = (Array.isArray(risks) ? risks : [])
      .filter((r) => {
        const isOwner =
          !userId || r.owner === userId || r.owner === user?.email;
        return isOwner && r.nextReview && r.status !== "Closed";
      })
      .map<TaskRow>((r) => {
        const dueDate = r.nextReview!;
        const status: TaskItem["status"] = "Pending";
        return {
          id: `REV-${r.id}`,
          title: `Risk Review needed: ${r.title || r.desc}`,
          description: `ID: ${r.id} - ${r.category}`,
          status,
          priority: (r.priority === "High" || r.impact === "Critical"
            ? "High"
            : "Medium") as TaskItem["priority"],
          dueDate,
          projectName: r.projectName,
          projectId: r.projectId,
          isProgrammeLevel: r.isProgrammeLevel,
          programmeId: r.programmeId,
          type: "risk_review",
          original: r,
          _contextId: r.projectId || r.programmeId || "",
          _timeline: bucketFor(status, dueDate),
          _isOverdue: !!dueDate && new Date(dueDate) < today,
        };
      });

    // 4. Issue deadlines.
    const issueDeadlines = (Array.isArray(issues) ? issues : [])
      .filter((i) => {
        const isOwner =
          !userId ||
          i.owner === userId ||
          i.owner === user?.email ||
          i.controlOwner === userId;
        return isOwner && i.deadline && i.status !== "4. Resolved";
      })
      .map<TaskRow>((i) => {
        const status: TaskItem["status"] = (i.status === "Resolved" ||
        i.status === "4. Resolved"
          ? "Completed"
          : i.status === "2. Escalated"
            ? "In Progress"
            : "Pending") as TaskItem["status"];
        const dueDate = i.deadline!;
        return {
          id: `DL-${i.id}`,
          title: `Issue Deadline: ${i.title || i.desc}`,
          description: `ID: ${i.id} - ${i.category || "General"}`,
          status,
          priority: (i.severity === "Critical" ||
          i.severity === "High" ||
          i.priority >= 4
            ? "High"
            : "Medium") as TaskItem["priority"],
          dueDate,
          completedAt: i.completedAt,
          projectName: i.projectName,
          projectId: i.projectId,
          isProgrammeLevel: i.isProgrammeLevel,
          programmeId: (i as any).programmeId,
          type: "issue_deadline",
          original: i,
          _contextId: i.projectId || (i as any).programmeId || "",
          _timeline: bucketFor(status, dueDate),
          _isOverdue:
            status !== "Completed" && !!dueDate && new Date(dueDate) < today,
        };
      });

    return [...manualTasks, ...compActions, ...riskReviews, ...issueDeadlines].sort(
      (a, b) => {
        // Completed at the bottom.
        if (a.status === "Completed" && b.status !== "Completed") return 1;
        if (a.status !== "Completed" && b.status === "Completed") return -1;
        if (a.dueDate === "No date set") return 1;
        if (b.dueDate === "No date set") return -1;
        return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
      },
    );
  }, [tasks, complianceItems, user, projects, programmes]);

  const kpis = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const lastWeek = new Date();
    lastWeek.setDate(today.getDate() - 7);

    const active = allItems.filter((i) => i.status !== "Completed");
    const overdue = active.filter(
      (i) => i.dueDate !== "No date set" && new Date(i.dueDate) < today,
    );
    const dueToday = active.filter(
      (i) =>
        i.dueDate !== "No date set" &&
        new Date(i.dueDate).toDateString() === today.toDateString(),
    );
    const completedThisWeek = allItems.filter((i) => {
      if (i.status !== "Completed") return false;
      if (!i.completedAt) return true;
      const date = new Date(i.completedAt);
      return date >= lastWeek;
    });
    return {
      overdue: overdue.length,
      dueToday: dueToday.length,
      completed: completedThisWeek.length,
    };
  }, [allItems]);

  const openAddModal = () => {
    setModalMode("add");
    setCurrentTask({
      title: "",
      priority: "Medium",
      dueDate: new Date().toISOString().split("T")[0],
      description: "",
      status: "Pending",
    });
    setShowModal(true);
  };

  const openEditModal = (task: TaskRow) => {
    if (task.type !== "task") return; // Compliance / reviews / issues edit elsewhere.
    setModalMode("edit");
    setCurrentTask(task as Partial<TaskItem>);
    setShowModal(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentTask.title?.trim()) return;

    if (modalMode === "add") {
      // Stamp the active context onto the task exactly like the Calendar's
      // create flow (Calendar.tsx) so it is correctly associated + labelled:
      //  - projectId / programmeId drive the context-scoped reload + filters,
      //  - projectName feeds the Source column (project ?? programme ?? General),
      //  - owner MUST be set, else the table's manual-task owner filter excludes
      //    it (it would only surface in the Calendar, which has no owner filter).
      const contextProjectId = activeProjectId || undefined;
      const contextProgrammeId = !activeProjectId
        ? activeProgrammeId || undefined
        : undefined;
      const activeProj = projects.find((p) => p.id === activeProjectId);
      const activeProg = programmes.find((p) => p.id === activeProgrammeId);
      const contextName =
        activeProj?.name ?? activeProg?.name ?? "General";
      const task: TaskItem = {
        id: `T-${Date.now()}`,
        title: currentTask.title,
        description: currentTask.description || "",
        status: "Pending",
        priority: (currentTask.priority as any) || "Medium",
        dueDate: currentTask.dueDate || new Date().toISOString().split("T")[0],
        owner: user?.id || user?.uid || user?.email,
        projectId: contextProjectId,
        programmeId: contextProgrammeId,
        projectName: contextName,
        isProgrammeLevel: !!contextProgrammeId,
      };
      addTask(task);
      toast.success("Task created successfully");
    } else if (modalMode === "edit" && currentTask.id) {
      updateTask(currentTask.id, currentTask);
      toast.success("Task updated successfully");
    }

    setShowModal(false);
    setCurrentTask({});
  };

  const toggleComplete = (item: TaskRow) => {
    const isCompleting = item.status !== "Completed";
    if (item.type === "compliance") {
      updateComplianceItem(item.id, {
        stage: isCompleting ? "Live" : "In Progress",
      });
      toast.success(
        isCompleting
          ? `"${item.title}" marked as complete`
          : `"${item.title}" re-opened for review`,
      );
    } else {
      updateTask(item.id, {
        status: isCompleting ? "Completed" : "Pending",
        completedAt: isCompleting ? new Date().toISOString() : undefined,
      });
      toast.success(
        isCompleting
          ? `Task "${item.title}" completed`
          : `Task "${item.title}" marked as pending`,
      );
    }
  };

  // Resolve a human label for the Source column. Prefer the row's own
  // projectName; otherwise look the context up by id (loaded tasks carry only
  // projectId/programmeId, not a name); fall back to "General".
  const contextLabelFor = (r: TaskRow): string => {
    if (r.projectName) return r.projectName;
    if (r.projectId) {
      const p = projects.find((x) => x.id === r.projectId);
      if (p?.name) return p.name;
    }
    if (r.programmeId) {
      const pg = programmes.find((x) => x.id === r.programmeId);
      if (pg?.name) return pg.name;
    }
    return "General";
  };

  // ── Columns ────────────────────────────────────────────────────────────────
  const columns: ColumnDef<TaskRow>[] = [
    {
      key: "type",
      label: "Source",
      width: "160px",
      render: (_v, r) => (
        <div className="flex items-center gap-2">
          {r.type === "compliance" ? (
            <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
          ) : (
            <CheckSquare className="w-4 h-4 text-indigo-500 shrink-0" />
          )}
          <span className="font-mono text-[11px] font-medium text-slate-500 uppercase tracking-wide truncate">
            {contextLabelFor(r)}
          </span>
        </div>
      ),
    },
    {
      key: "title",
      label: "Action Item",
      sortable: true,
      render: (_v, r) => (
        <div>
          <div
            className={clsx(
              "font-semibold text-slate-800 text-[12px]",
              r.status === "Completed" && "line-through opacity-50",
            )}
          >
            {r.title}
          </div>
          {r.description && (
            <div
              className="text-[11px] text-slate-400 mt-0.5 line-clamp-1"
              title={r.description}
            >
              {r.description}
            </div>
          )}
        </div>
      ),
    },
    {
      key: "dueDate",
      label: "Due Date",
      width: "140px",
      sortable: true,
      render: (v) => (
        <div className="flex items-center gap-1.5 text-slate-600 text-[11px] font-medium whitespace-nowrap">
          <Calendar className="w-3.5 h-3.5 text-indigo-400" />
          {v}
        </div>
      ),
    },
    {
      key: "priority",
      label: "Priority",
      width: "100px",
      render: (v) => (
        <span
          className={clsx(
            "font-mono px-2 py-0.5 rounded-full text-[10px] font-medium uppercase tracking-wide border",
            v === "High"
              ? "bg-rose-50 text-rose-700 border-rose-200"
              : v === "Medium"
                ? "bg-amber-50 text-amber-700 border-amber-200"
                : "bg-slate-50 text-slate-600 border-slate-200",
          )}
        >
          {v}
        </span>
      ),
    },
    {
      key: "status",
      label: "Status",
      width: "120px",
      render: (_v, r) => (
        <span
          className={clsx(
            "font-mono px-2 py-0.5 rounded-full text-[10px] font-medium uppercase tracking-wide border whitespace-nowrap",
            r.status === "In Progress"
              ? "bg-blue-50 text-blue-700 border-blue-200"
              : r.status === "Completed"
                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                : r._isOverdue
                  ? "bg-rose-50 text-rose-700 border-rose-200"
                  : "bg-slate-50 text-slate-400 border-slate-200",
          )}
        >
          {r._isOverdue ? "Overdue" : r.status}
        </span>
      ),
    },
  ];

  // ── Filters ────────────────────────────────────────────────────────────────
  const filters: FilterDef<TaskRow>[] = [
    {
      key: "_timeline",
      label: "Timeline",
      type: "select",
      placeholder: "All timelines",
      options: [
        { value: "overdue", label: "Overdue" },
        { value: "today", label: "Due today" },
        { value: "week", label: "Due this week" },
        { value: "upcoming", label: "Upcoming" },
        { value: "completed", label: "Completed" },
      ],
    },
    {
      key: "type",
      label: "Source",
      type: "select",
      placeholder: "All sources",
      options: [
        { value: "task", label: "Manual tasks" },
        { value: "compliance", label: "Compliance" },
        { value: "risk_review", label: "Risk reviews" },
        { value: "issue_deadline", label: "Issue deadlines" },
      ],
    },
    {
      key: "_contextId",
      label: "Project / Programme",
      type: "select",
      placeholder: "All contexts",
      options: [
        ...programmes.map((p) => ({ value: p.id, label: p.name })),
        ...projects.map((p) => ({ value: p.id, label: p.name })),
      ],
    },
  ];

  // ── Row actions ────────────────────────────────────────────────────────────
  const rowActions: RowAction<TaskRow>[] = [
    {
      key: "toggle-complete",
      label: (r) => (r.status === "Completed" ? "Re-open" : "Complete"),
      icon: CheckCircle2,
      isActive: (r) => r.status === "Completed",
      onClick: (r) => toggleComplete(r),
    },
    {
      key: "edit",
      label: "Edit",
      icon: Pencil,
      isVisible: (r) => r.type === "task",
      onClick: (r) => openEditModal(r),
    },
    {
      key: "open-tracker",
      label: "Go to Compliance Tracker",
      icon: ExternalLink,
      isVisible: (r) => r.type === "compliance",
      onClick: () => navigate("/compliance"),
    },
    {
      key: "delete",
      label: "Delete",
      icon: Trash2,
      isDanger: true,
      isVisible: (r) => r.type === "task",
      requireConfirm: {
        icon: Trash2,
        variant: "danger" as const,
        title: "Delete task",
        message: (r: TaskRow) =>
          `Permanently delete "${r.title}"? This cannot be undone.`,
        confirmLabel: "Delete",
        isDanger: true,
      },
      onClick: (r) => {
        deleteTask(r.id);
        toast.success(`Task "${r.title}" deleted`);
      },
    },
  ];

  // ── Bulk actions ───────────────────────────────────────────────────────────
  const bulkActions: BulkAction<TaskRow>[] = [
    {
      key: "bulk-delete",
      label: "Delete selected",
      icon: Trash2,
      isDanger: true,
      style: "bar",
      requireConfirm: {
        icon: Trash2,
        variant: "danger" as const,
        title: (rows: TaskRow[]) => {
          const deletable = rows.filter((r) => r.type === "task").length;
          return `Delete ${deletable} task${deletable === 1 ? "" : "s"}`;
        },
        message: (rows: TaskRow[]) => {
          const deletable = rows.filter((r) => r.type === "task").length;
          const skipped = rows.length - deletable;
          const skippedNote = skipped
            ? ` ${skipped} non-task row${skipped === 1 ? "" : "s"} will be skipped.`
            : "";
          return `Permanently delete ${deletable} selected task${deletable === 1 ? "" : "s"}?${skippedNote} This cannot be undone.`;
        },
        confirmLabel: "Delete all",
        isDanger: true,
      },
      onClick: (rows) => {
        const deletable = rows.filter((r) => r.type === "task");
        deletable.forEach((r) => deleteTask(r.id));
        toast.success(
          `${deletable.length} task${deletable.length === 1 ? "" : "s"} deleted`,
        );
      },
    },
  ];

  return (
    <div className="space-y-6 sm:space-y-8">
      <PageHeader
        title="My Tasks"
        subtitle="All your open actions: manual tasks, compliance items, risk reviews, and issue deadlines in one feed."
        breadcrumbs={[{label:"Overview"},{label:"My Tasks"}]}
      />
      {/* KPI Header */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatsCard
          icon={AlertCircle}
          title="Overdue Actions"
          value={kpis.overdue}
          size="sm"
          iconBgClassName="bg-rose-50 dark:bg-rose-500/10"
          iconClassName="text-rose-600 dark:text-rose-400"
        />
        <StatsCard
          icon={Clock}
          title="Due Today"
          value={kpis.dueToday}
          size="sm"
          iconBgClassName="bg-amber-50 dark:bg-amber-500/10"
          iconClassName="text-amber-600 dark:text-amber-400"
        />
        <StatsCard
          icon={CheckCircle2}
          title="Closed (Last 7d)"
          value={kpis.completed}
          size="sm"
          iconBgClassName="bg-emerald-50 dark:bg-emerald-500/10"
          iconClassName="text-emerald-600 dark:text-emerald-400"
        />
      </div>

      <DynamicTable<TaskRow>
        data={allItems}
        columns={columns}
        filters={filters}
        rowActions={rowActions}
        bulkActions={bulkActions}
        searchable
        searchPlaceholder="Search workspace..."
        searchFields={["title", "description", "projectName"]}
        selectable
        getRowId={(r) => r.id}
        onRowClick={(r) => openEditModal(r)}
        pagination={{
          enabled: true,
          pageSize: 25,
          pageSizeOptions: [10, 25, 50],
        }}
        headerVariant="light"
        stickyHeader
        emptyState={{
          icon: Info,
          title: "No active items in your workspace",
          description:
            "Add a new task or review compliance requirements to get started.",
          action: (
            <button
              onClick={openAddModal}
              className="mt-4 flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-xs font-bold hover:bg-indigo-700 transition shadow-lg shadow-indigo-100 mx-auto"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Your First Task
            </button>
          ),
        }}
        toolbarActions={
          <button
            onClick={openAddModal}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-xs font-bold hover:bg-indigo-700 shadow-md shadow-indigo-200 transition-all flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Add Task
          </button>
        }
      />

      {/* Add/Edit Task Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-300">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <h3 className="font-semibold text-slate-800 tracking-tight text-lg">
                {modalMode === "add" ? "Create Workspace Task" : "Edit Task"}
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-5">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1.5">
                  Task Title
                </label>
                <input
                  type="text"
                  autoFocus
                  required
                  value={currentTask.title || ""}
                  onChange={(e) =>
                    setCurrentTask({ ...currentTask, title: e.target.value })
                  }
                  placeholder="What needs to be done?"
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all shadow-inner"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1.5">
                  Description / Notes
                </label>
                <textarea
                  value={currentTask.description || ""}
                  onChange={(e) =>
                    setCurrentTask({
                      ...currentTask,
                      description: e.target.value,
                    })
                  }
                  placeholder="Add context, links, or reminders..."
                  rows={3}
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none transition-all shadow-inner"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1.5">
                    Priority Level
                  </label>
                  <select
                    value={currentTask.priority || "Medium"}
                    onChange={(e) =>
                      setCurrentTask({
                        ...currentTask,
                        priority: e.target.value as any,
                      })
                    }
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 appearance-none cursor-pointer"
                  >
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High Priority</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1.5">
                    Due Date
                  </label>
                  <input
                    type="date"
                    required
                    value={currentTask.dueDate || ""}
                    onChange={(e) =>
                      setCurrentTask({
                        ...currentTask,
                        dueDate: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                  />
                </div>
              </div>
              <div className="pt-4 flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 px-4 py-2.5 border border-slate-200 text-slate-600 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200"
                >
                  {modalMode === "add" ? "Add To Workspace" : "Update Task"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
