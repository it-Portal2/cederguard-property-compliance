import { useState, useEffect, useMemo } from "react";
import { Link, useSearchParams } from "react-router";
import { useStore, IssueItem } from "../store/useStore";
import {
  isAtLeastPM,
  isAtLeastClientAdmin,
  isSuperAdmin,
  UserRole,
} from "../lib/roles";
import { ISSUE_STATUSES } from "../data/riskData";
import { clsx } from "clsx";
import { generateId } from "../lib/utils";
import { format, differenceInDays } from "date-fns";
import {
  Trash2,
  Edit2,
  Lightbulb,
  TrendingUp,
  AlertCircle,
  ShieldOff,
  CheckCircle2,
  ArrowLeft,
  Plus,
} from "lucide-react";
import { IssueModal } from "../components/IssueModal";
import { ServiceManagementBar } from "../components/ServiceManagementBar";
import { StatsCard } from "../components/common/StatsCard";
import toast from "react-hot-toast";
import DynamicTable from "../components/table/DynamicTable";
import type {
  ColumnDef,
  RowAction,
  BulkAction,
  FilterDef,
} from "../components/table/types";
import { useHistoricalView } from "../hooks/useHistoricalView";
import { MonthPicker } from "../components/historicalReporting/MonthPicker";
import { HistoricalBanner } from "../components/historicalReporting/HistoricalBanner";
import type { LegacyArraySnapshot } from "../types/historicalReporting";

// ── Helper functions (unchanged) ───────────────────────────────────────────────

function iScore(p: number | string, s: number | string) {
  const map: Record<string, number> = {
    Low: 1,
    Medium: 3,
    High: 5,
    Critical: 10,
  };
  const pv = typeof p === "number" ? p : map[p] || 1;
  const sv = typeof s === "number" ? s : map[s] || 1;
  const v = pv * sv;
  if (v >= 20)
    return { l: "Critical", c: "bg-red-900 text-white border-red-900" };
  if (v >= 12)
    return { l: "High", c: "bg-red-100 text-red-800 border-red-200" };
  if (v >= 8)
    return { l: "Medium", c: "bg-amber-50 text-amber-700 border-amber-200" };
  return { l: "Low", c: "bg-emerald-50 text-emerald-700 border-emerald-200" };
}

function fDate(d?: string) {
  if (!d) return "—";
  try {
    return format(new Date(d), "dd MMM yy");
  } catch {
    return d;
  }
}

function ageCalc(d?: string, status?: string) {
  if (!d || status === "4. Resolved") return "—";
  try {
    return differenceInDays(new Date(), new Date(d)) + "d";
  } catch {
    return "—";
  }
}

function StatusBadge({ status }: { status: string }) {
  const cls =
    status === "4. Resolved"
      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
      : status === "2. Escalated"
        ? "bg-red-100 text-red-700 border-red-200"
        : status === "3. Implementing Fix"
          ? "bg-blue-50 text-blue-700 border-blue-200"
          : status === "1. Investigating"
            ? "bg-amber-50 text-amber-700 border-amber-200"
            : "bg-slate-100 text-slate-600 border-slate-200";
  return (
    <span
      className={clsx(
        "px-2 py-0.5 rounded text-[10px] font-bold border whitespace-nowrap",
        cls,
      )}
    >
      {status}
    </span>
  );
}

// ── RiskIssues ─────────────────────────────────────────────────────────────────

export function RiskIssues() {
  const {
    issues,
    deleteIssue,
    addIssue,
    updateIssue,
    activeProjectId,
    activeProgrammeId,
    programmes,
    projects,
    user,
    isInitialized,
  } = useStore();

  const [searchParams] = useSearchParams();
  const fromInitiation = searchParams.get("from") === "initiation";
  const userRole = (user?.role || user?.profile?.role) as UserRole | undefined;
  const userIsSuperAdmin = isSuperAdmin(user?.email, userRole);
  const isPM = !isAtLeastClientAdmin(userRole) && !userIsSuperAdmin;

  //  historical view hook. When the user picks a past month,
  // the page swaps live `issues` for the snapshot's frozen state and
  // disables every edit affordance (add / edit / delete / bulk delete).
  const historicalView = useHistoricalView<LegacyArraySnapshot<IssueItem>>({
    collection: "issues",
  });
  const isHistorical = historicalView.isHistorical;
  const historicalIssues = useMemo<IssueItem[]>(() => {
    if (!isHistorical) return [];
    const out: IssueItem[] = [];
    for (const entry of historicalView.entries) {
      if (entry?.kind === "legacyArray" && Array.isArray(entry.array)) {
        out.push(...entry.array);
      }
    }
    return out;
  }, [isHistorical, historicalView.entries]);

  const canModify = (isAtLeastPM(userRole) || userIsSuperAdmin) && !isHistorical;
  const canDelete = (isAtLeastPM(userRole) || userIsSuperAdmin) && !isHistorical;
  const progLevelLabel = isPM ? "Shared Portfolio" : "Programme Level";

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingIssue, setEditingIssue] = useState<IssueItem | null>(null);

  const liveIssues = Array.isArray(issues) ? issues : [];
  const safeIssues = isHistorical ? historicalIssues : liveIssues;
  const safeProjects = Array.isArray(projects) ? projects : [];
  const safeProgs = Array.isArray(programmes) ? programmes : [];

  const activeProjName = safeProjects.find(
    (p) => p.id === activeProjectId,
  )?.name;
  const activeProgName = safeProgs.find(
    (p) => p.id === activeProgrammeId,
  )?.name;
  const contextLabel = activeProjName || activeProgName || "All Issues";

  // Reset on context switch — unchanged
  useEffect(() => {}, [activeProjectId, activeProgrammeId]);

  // Handle URL-based actions from ServiceManagementBar — unchanged logic
  useEffect(() => {
    const action = searchParams.get("action");
    const clearAction = () => {
      window.history.replaceState(
        {},
        "",
        `${window.location.pathname}${(() => {
          const p = new URLSearchParams(searchParams);
          p.delete("action");
          return p.toString() ? `?${p.toString()}` : "";
        })()}`,
      );
    };
    if (action === "add-issue") {
      setEditingIssue(null);
      setIsModalOpen(true);
      clearAction();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // Context-scoped data — same scope logic as before, DynamicTable handles status/priority/search
  const contextScoped = useMemo(() => {
    return safeIssues
      .filter((i) => {
        if (activeProjectId && i.projectId !== activeProjectId) return false;
        if (
          !activeProjectId &&
          activeProgrammeId &&
          i.programmeId !== activeProgrammeId
        ) {
          const issProject = safeProjects.find((p) => p.id === i.projectId);
          if (!issProject || issProject.programmeId !== activeProgrammeId)
            return false;
        }
        return true;
      })
      .sort((a, b) => {
        const dateA = new Date(a.dateAdded || 0).getTime();
        const dateB = new Date(b.dateAdded || 0).getTime();
        if (dateA !== dateB) return dateB - dateA;
        return b.id.localeCompare(a.id);
      });
  }, [safeIssues, activeProjectId, activeProgrammeId, safeProjects]);

  // Advisory panel — derived from context-scoped (unchanged logic)
  const openIssues = contextScoped.filter((i) => i.status !== "4. Resolved");
  const escalatedIssues = contextScoped.filter(
    (i) => i.status === "2. Escalated",
  );
  const avgAge = openIssues.length
    ? Math.round(
        openIssues.reduce(
          (acc, i) => acc + differenceInDays(new Date(), new Date(i.dateAdded)),
          0,
        ) / openIssues.length,
      )
    : 0;

  // ── Column definitions ────────────────────────────────────────────────────────

  const columns: ColumnDef<IssueItem>[] = [
    {
      key: "id",
      label: "Issue Ref",
      sortable: true,
      render: (v, r) => (
        <div
          className="cursor-pointer"
          onClick={() => {
            if (canModify) {
              setEditingIssue(r);
              setIsModalOpen(true);
            }
          }}
        >
          <div className="font-bold text-indigo-600 hover:underline whitespace-nowrap">
            {v}
          </div>
          <div className="text-[9px] text-slate-400 mt-0.5 whitespace-nowrap">
            {!r.projectId
              ? progLevelLabel
              : safeProjects.find((p) => p.id === r.projectId)?.name ||
                "Project Issue"}
          </div>
        </div>
      ),
    },
    {
      key: "linkedRisk",
      label: "Risk Ref",
      render: (v) => (
        <span className="text-indigo-400 font-medium">{v || "—"}</span>
      ),
    },
    {
      key: "dateAdded",
      label: "Date Added",
      sortable: true,
      render: (v) => (
        <span className="text-slate-400 whitespace-nowrap text-[10px]">
          {fDate(v)}
        </span>
      ),
    },
    {
      key: "desc",
      label: "Description & Impact",
      width: "200px",
      truncate: true,
      tooltip: true,
      render: (v) => (
        <span className="font-medium text-slate-800 text-[11px]">
          {v || "—"}
        </span>
      ),
    },
    {
      key: "owner",
      label: "Issue Owner",
      render: (v) => (
        <span className="text-slate-600 text-[11px]">{v || "—"}</span>
      ),
    },
    {
      key: "priority",
      label: "P",
      align: "center",
      width: "50px",
      sortable: true,
      render: (v) => <span className="font-bold text-slate-700">{v}</span>,
    },
    {
      key: "severity",
      label: "S",
      align: "center",
      width: "50px",
      sortable: true,
      render: (v) => <span className="font-bold text-slate-700">{v}</span>,
    },
    {
      key: "_score" as any,
      label: "Score",
      render: (_v, r) => {
        const sc = iScore(r.priority, r.severity);
        return (
          <span
            className={clsx(
              "px-2 py-0.5 rounded text-[10px] font-bold border",
              sc.c,
            )}
          >
            {sc.l}
          </span>
        );
      },
    },
    {
      key: "response",
      label: "Issue Response",
      render: (v) => (
        <span className="text-slate-500 text-[11px]">{v || "—"}</span>
      ),
    },
    {
      key: "responsDesc",
      label: "Response Desc",
      width: "130px",
      truncate: true,
      tooltip: true,
      render: (v) => (
        <span className="text-slate-500 text-[11px]">
          {v?.split("\n")[0] || "—"}
        </span>
      ),
    },
    {
      key: "controlOwner",
      label: "Control Owner",
      render: (v) => (
        <span className="text-slate-500 text-[11px]">{v || "—"}</span>
      ),
    },
    {
      key: "progress",
      label: "Progress Updates",
      width: "140px",
      truncate: true,
      tooltip: true,
      render: (v) => (
        <span className="text-slate-500 text-[11px]">
          {v?.split("\n")[0] || "—"}
        </span>
      ),
    },
    {
      key: "dateUpdated",
      label: "Date Updated",
      render: (v) => (
        <span className="text-slate-400 whitespace-nowrap text-[10px]">
          {fDate(v)}
        </span>
      ),
    },
    {
      key: "deadline",
      label: "Control Deadline",
      render: (v) => (
        <span className="text-slate-500 whitespace-nowrap text-[10px]">
          {fDate(v)}
        </span>
      ),
    },
    {
      key: "status",
      label: "Status",
      render: (v) => <StatusBadge status={v} />,
    },
    {
      key: "_age" as any,
      label: "Age",
      align: "center",
      render: (_v, r) => (
        <span className="text-slate-400 whitespace-nowrap font-medium">
          {ageCalc(r.dateAdded, r.status)}
        </span>
      ),
    },
    {
      key: "lessonsLearnt",
      label: "Lessons Learnt",
      align: "center",
      render: (v) =>
        v ? (
          <span className="flex items-center justify-center text-emerald-600">
            <CheckCircle2 className="w-4 h-4" />
          </span>
        ) : (
          <span className="text-slate-300">—</span>
        ),
    },
  ];

  // ── Filter definitions ────────────────────────────────────────────────────────

  const filterDefs: FilterDef<IssueItem>[] = [
    {
      key: "status",
      label: "Status",
      type: "select",
      options: ISSUE_STATUSES.map((s) => ({ value: s, label: s })),
    },
    {
      key: "priority",
      label: "Priority",
      type: "select",
      options: [1, 2, 3, 4, 5].map((p) => ({
        value: String(p),
        label: `Priority ${p}`,
      })),
      match: (rowValue, filterValue) =>
        String(rowValue) === String(filterValue),
    },
  ];

  // ── Row actions ───────────────────────────────────────────────────────────────

  const rowActions: RowAction<IssueItem>[] = [
    ...(canModify
      ? [
          {
            key: "edit",
            label: "Edit",
            icon: Edit2,
            onClick: (r: IssueItem) => {
              setEditingIssue(r);
              setIsModalOpen(true);
            },
          },
        ]
      : []),
    ...(canDelete
      ? [
          {
            key: "delete",
            label: "Delete",
            icon: Trash2,
            isDanger: true,
            requireConfirm: {
              title: "Delete Issue",
              message: (r: IssueItem) =>
                `Permanently delete "${r.desc || r.id}"? This cannot be undone.`,
              confirmLabel: "Delete",
              isDanger: true,
            },
            onClick: async (r: IssueItem) => {
              try {
                await deleteIssue(r.id);
                toast.success("Issue deleted.");
              } catch (err: any) {
                console.error("[RiskIssues] delete error", err);
                toast.error(err?.message || "Failed to delete issue.");
              }
            },
          },
        ]
      : []),
  ];

  // ── Bulk actions ──────────────────────────────────────────────────────────────

  const bulkActions: BulkAction<IssueItem>[] = canDelete
    ? [
        {
          key: "bulk-delete",
          label: "Delete",
          icon: Trash2,
          isDanger: true,
          style: "inline",
          requireConfirm: {
            title: (rows: IssueItem[]) =>
              `Delete ${rows.length} Issue${rows.length === 1 ? "" : "s"}?`,
            message: "This action cannot be undone.",
            confirmLabel: "Delete All",
            isDanger: true,
          },
          onClick: async (rows: IssueItem[]) => {
            const count = rows.length;
            try {
              await Promise.all(rows.map((r) => deleteIssue(r.id)));
              toast.success(`Deleted ${count} issue${count > 1 ? "s" : ""}.`);
            } catch (err: any) {
              console.error("[RiskIssues] bulk delete error", err);
              toast.error(err?.message || "Failed to delete issues.");
            }
          },
        },
      ]
    : [];

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <>
      <ServiceManagementBar />
      <div className="max-w-[98%] mx-auto space-y-6 sm:space-y-8 p-2 sm:p-4 lg:p-6">
        {/* Page Header*/}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            {fromInitiation && (
              <Link
                to={`/project/initiation${activeProjectId ? `?projectId=${activeProjectId}` : ""}`}
                className="flex items-center gap-1 text-xs text-indigo-600 font-medium mb-2 hover:underline"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> Back to Project Initiation
              </Link>
            )}
            <h1 className="text-2xl font-semibold text-slate-900 uppercase tracking-tight">
              Issues Register
            </h1>
            <p className="text-sm text-slate-500 mt-0.5">{contextLabel}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {/* month picker for historical view.*/}
            <MonthPicker
              monthEnd={historicalView.monthEnd}
              availableMonths={historicalView.availableMonths}
              onChange={historicalView.setMonthEnd}
              loading={historicalView.loading}
            />
            {canModify && (
              <button
                onClick={() => {
                  setEditingIssue(null);
                  setIsModalOpen(true);
                }}
                className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors shadow-sm"
              >
                <Plus className="w-4 h-4" />
                Add Issue
              </button>
            )}
          </div>
        </div>

        {/* read-only banner appears when MonthPicker is set
 to a past month.*/}
        {isHistorical && historicalView.monthEnd && (
          <HistoricalBanner
            monthEnd={historicalView.monthEnd}
            meta={historicalView.meta}
            onExit={() => historicalView.setMonthEnd(null)}
            defaultCorrectionCollection="issues"
            emptyReason={historicalView.emptyReason}
            activatedYearMonth={historicalView.activatedYearMonth}
            surfaceLabel="issues"
          />
        )}

        {/* Summary Tiles*/}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <StatsCard
            title="Total"
            value={contextScoped.length}
            icon={ShieldOff}
            iconBgClassName="bg-indigo-50"
            iconClassName="text-indigo-600"
            valueClassName="text-indigo-600"
          />
          <StatsCard
            title="Open"
            value={
              contextScoped.filter((i) => i.status !== "4. Resolved").length
            }
            icon={AlertCircle}
            iconBgClassName="bg-red-50"
            iconClassName="text-red-500"
            valueClassName="text-red-600"
          />
          <StatsCard
            title="Implementing Fix"
            value={
              contextScoped.filter((i) => i.status === "3. Implementing Fix")
                .length
            }
            icon={Edit2}
            iconBgClassName="bg-blue-50"
            iconClassName="text-blue-600"
            valueClassName="text-blue-600"
          />
          <StatsCard
            title="Resolved"
            value={
              contextScoped.filter((i) => i.status === "4. Resolved").length
            }
            icon={CheckCircle2}
            iconBgClassName="bg-emerald-50"
            iconClassName="text-emerald-600"
            valueClassName="text-emerald-600"
          />
        </div>

        {/* AI Advisory Panel — unchanged*/}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="md:col-span-2 bg-indigo-900 rounded-lg p-5 text-white shadow-xl relative overflow-hidden">
            <div className="relative z-10">
              <div className="flex items-center gap-2 mb-3">
                <div className="p-1.5 bg-indigo-500/30 rounded-lg">
                  <Lightbulb className="w-5 h-5 text-indigo-200" />
                </div>
                <h2 className="font-mono text-[11px] font-medium uppercase tracking-wide text-indigo-200">
                  Issue Advisory
                </h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-xl font-bold">
                    {escalatedIssues.length > 0
                      ? `${escalatedIssues.length} Escalated Issues`
                      : "No Critical Escalations"}
                  </p>
                  <p className="text-xs text-indigo-200 leading-relaxed">
                    {escalatedIssues.length > 0
                      ? "Immediate management attention required for escalated items to prevent project delays."
                      : "Issue management is currently within normal operating parameters."}
                  </p>
                </div>
                <div className="space-y-1 sm:border-l sm:border-indigo-800 sm:pl-4">
                  <p className="text-xl font-bold">{avgAge}d Average Age</p>
                  <p className="text-xs text-indigo-200 leading-relaxed">
                    {avgAge > 14
                      ? "Resolution cycle time is exceeding 14 days. Review bottleneck in 'Implementing Fix' stage."
                      : "Resolution cycle is healthy. Continue proactive monitoring of investigations."}
                  </p>
                </div>
              </div>
            </div>
            <div className="absolute top-0 right-0 p-8 opacity-10">
              <TrendingUp className="w-32 h-32" />
            </div>
          </div>
          <div className="bg-white rounded-lg border border-slate-200 p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <AlertCircle className="w-4 h-4 text-amber-500" />
              <h3 className="font-mono text-[11px] font-medium text-slate-500 uppercase tracking-wide">
                Attention Required
              </h3>
            </div>
            <div className="space-y-3">
              {openIssues.slice(0, 2).map((iss) => (
                <div
                  key={iss.id}
                  className="border-l-2 border-amber-500 pl-3 py-1"
                >
                  <p
                    className="text-xs font-bold text-slate-800 truncate"
                    title={iss.id}
                  >
                    {iss.id}
                  </p>
                  <p
                    className="text-[10px] text-slate-500 line-clamp-1"
                    title={iss.desc}
                  >
                    {iss.desc}
                  </p>
                </div>
              ))}
              {openIssues.length === 0 && (
                <p className="text-xs text-slate-400">
                  No open issues requiring immediate action.
                </p>
              )}
            </div>
          </div>
        </div>

        {/* DynamicTable*/}
        <DynamicTable<IssueItem>
          data={contextScoped}
          columns={columns}
          rowActions={rowActions}
          bulkActions={bulkActions}
          filters={filterDefs}
          searchable
          searchPlaceholder="Search issues..."
          searchFields={["desc", "id"]}
          selectable
          getRowId={(r) => r.id}
          rowClassName={(r) =>
            r.status === "2. Escalated" ? "bg-red-50/30 hover:bg-red-50/50" : ""
          }
          loading={!isInitialized || historicalView.loading}
          emptyState={{
            title: "No issues found matching your filters.",
            icon: ShieldOff,
          }}
          headerVariant="light"
          stickyHeader
        />

        {/* IssueModal — unchanged*/}
        <IssueModal
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false);
            setEditingIssue(null);
          }}
          onSave={async (issueData) => {
            const today = new Date().toISOString().split("T")[0];
            if (editingIssue) {
              await updateIssue(editingIssue.id, {
                ...issueData,
                dateUpdated: today,
              });
              toast.success("Issue updated.");
            } else {
              const newIssue: IssueItem = {
                ...issueData,
                id: generateId("ISS"),
                dateAdded: today,
                projectId: issueData.projectId || activeProjectId || "",
                programmeId: issueData.programmeId || activeProgrammeId || "",
              } as IssueItem;
              await addIssue(newIssue);
              toast.success("Issue added to register.");
            }
          }}
          initialData={editingIssue}
        />
      </div>
    </>
  );
}
