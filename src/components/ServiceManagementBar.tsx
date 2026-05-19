import React, { useState } from "react";
import { useNavigate, useLocation } from "react-router";
import {
  Settings,
  RefreshCw,
  ChevronDown,
  Info,
  AlertCircle,
  Layout,
  Briefcase,
  FileSpreadsheet,
  Loader2,
  ShieldCheck,
} from "lucide-react";
import * as XLSX from "xlsx";
import { differenceInDays } from "date-fns";
import { useStore } from "../store/useStore";
import { clsx } from "clsx";

export const ServiceManagementBar: React.FC<{ className?: string }> = ({
  className,
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const pathname = location.pathname;
  const {
    activeProject,
    activeProgramme,
    canManageContext,
    projects,
    programmes,
    setActiveProject,
    setActiveProgramme,
    complianceItems,
    risks,
    issues,
  } = useStore();

  const [isOpen, setIsOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const activeProjectId = useStore((state) => state.activeProjectId);
  const activeProgrammeId = useStore((state) => state.activeProgrammeId);

  // Determine context from the URL type param first (most explicit),
  // falling back to store state. This prevents stale activeProjectId
  // from overriding an explicit programme context.
  const urlType = new URLSearchParams(location.search).get("type");
  const isProject = urlType ? urlType === "project" : !!activeProjectId;
  const context = activeProject || activeProgramme;

  if (!context) return null;

  const canManage = canManageContext();
  const name = isProject ? activeProject?.name : activeProgramme?.name;
  const reference = isProject
    ? activeProject?.reference
    : activeProgramme?.reference;
  const type = isProject ? "Project" : "Programme";

  // Task #3 — correct routes for both project and programme
  const handleEditProfile = () => {
    if (isProject) {
      // ProjectInitiation reads activeProjectId from the store — no id param needed
      navigate("/project/initiation");
    } else {
      // ProgrammeInitiation reads id from useParams via /programmes/edit/:id
      navigate(`/programmes/edit/${activeProgramme!.id}`);
    }
  };

  // Task #4 — compliance setup with restart flag
  const handleRerunCompliance = () => {
    navigate(
      `/compliance/setup?type=${isProject ? "project" : "programme"}&restart=true`,
    );
  };

  // Detect which page we're on to make export context-aware
  const isIssuesPage =
    pathname === "/risk/issues" || pathname === "/risk/programme-issues";
  const isProjectIssuesPage = pathname === "/risk/issues";
  const isRiskRegisterPage =
    pathname === "/risk/register" || pathname === "/risk/programme-register";
  const isRiskPage = pathname.startsWith("/risk") && !isIssuesPage;
  const isTrackerPage = pathname === "/compliance/tracker";
  const isCompliancePage = pathname.startsWith("/compliance") && !isTrackerPage;

  const exportLabel = isExporting
    ? "Exporting..."
    : isIssuesPage
      ? "Export Issues Data (Excel)"
      : isRiskPage
        ? "Export Risk Data (Excel)"
        : isTrackerPage
          ? "Export Tracker Data (Excel)"
          : isCompliancePage
            ? "Export Compliance Data (Excel)"
            : "Export Data (Excel)";

  const exportDescription = isIssuesPage
    ? "Download all issues register data as .xlsx."
    : isRiskPage
      ? "Download all risk register data as .xlsx."
      : isTrackerPage
        ? "Download compliance tracker data as .xlsx."
        : isCompliancePage
          ? "Download compliance items as .xlsx."
          : "Download compliance, risk and issue data as .xlsx.";

  // Task #6 — real Excel export, page-aware
  const handleExportExcel = async () => {
    if (isExporting) return;
    setIsExporting(true);
    setIsOpen(false);
    try {
      const contextId = isProject ? activeProject?.id : activeProgramme?.id;
      const wb = XLSX.utils.book_new();

      const ctxCompliance = (
        Array.isArray(complianceItems) ? complianceItems : []
      ).filter((c) =>
        isProject ? c.projectId === contextId : c.programmeId === contextId,
      );
      const ctxRisks = (Array.isArray(risks) ? risks : []).filter((r) =>
        isProject ? r.projectId === contextId : r.programmeId === contextId,
      );
      const ctxIssues = (Array.isArray(issues) ? issues : []).filter((i) =>
        isProject ? i.projectId === contextId : i.programmeId === contextId,
      );

      const safeProjects = Array.isArray(projects) ? projects : [];

      // ── Issues-only export ──────────────────────────────────────────────
      if (isIssuesPage) {
        const scoreLabel = (p: number | string, s: number | string) => {
          const map: Record<string, number> = {
            Low: 1,
            Medium: 3,
            High: 5,
            Critical: 10,
          };
          const pv = typeof p === "number" ? p : map[String(p)] || 1;
          const sv = typeof s === "number" ? s : map[String(s)] || 1;
          const v = pv * sv;
          if (v >= 20) return "Critical";
          if (v >= 12) return "High";
          if (v >= 8) return "Medium";
          return "Low";
        };
        const fDate = (d?: string) => {
          if (!d) return "—";
          try {
            return new Date(d).toLocaleDateString();
          } catch {
            return d;
          }
        };
        const ageCalc = (d?: string, status?: string) => {
          if (!d || status === "4. Resolved") return "—";
          try {
            return differenceInDays(new Date(), new Date(d)) + "d";
          } catch {
            return "—";
          }
        };

        const rows = ctxIssues.map((iss) => ({
          "Issue Ref": iss.id,
          "Risk Ref": iss.linkedRisk || "",
          "Date Added": fDate(iss.dateAdded),
          "Issue Description": iss.desc || "",
          Impact: iss.impact || "",
          "Issue Owner": iss.owner || "",
          Priority: iss.priority ?? "",
          Severity: iss.severity ?? "",
          Score: scoreLabel(iss.priority, iss.severity),
          "Issue Response": iss.response || "",
          "Response Description": (iss as any).responsDesc || "",
          "Control Owner": (iss as any).controlOwner || "",
          "Progress Updates": (iss as any).progress || "",
          "Date Updated": fDate((iss as any).dateUpdated),
          "Control Deadline": fDate(iss.deadline),
          Status: iss.status || "",
          Age: ageCalc(iss.dateAdded, iss.status),
          "Lessons Learnt": (iss as any).lessonsLearnt || "",
          "Source Project":
            safeProjects.find((p) => p.id === iss.projectId)?.name ||
            ((iss as any).isProgrammeLevel ? "Programme Level" : ""),
        }));
        if (rows.length > 0) {
          XLSX.utils.book_append_sheet(
            wb,
            XLSX.utils.json_to_sheet(rows),
            "Issues Register",
          );
        } else {
          XLSX.utils.book_append_sheet(
            wb,
            XLSX.utils.json_to_sheet([
              { Note: "No issues data for this context." },
            ]),
            "Issues Register",
          );
        }

        // ── Risk-only export ────────────────────────────────────────────────
      } else if (isRiskPage) {
        const rows = ctxRisks.map((r) => ({
          Ref: r.id,
          Workstream: r.workstream || "—",
          "Linked KRI": r.kri || "—",
          "Date Added": r.dateAdded
            ? new Date(r.dateAdded).toLocaleDateString()
            : "—",
          "Risk Title": r.title || "",
          "Risk Desc": r.desc || "",
          "Gross L": r.grossL ?? "",
          "Gross I": r.grossI ?? "",
          "Gross Rating": r.grossRating ?? "",
          Response: r.response || "—",
          Controls: r.controls || "—",
          "Residual L": r.residualL ?? "",
          "Residual I": r.residualI ?? "",
          "Residual Rating": r.residualRating ?? "",
          Appetite: r.appetite || "—",
          "Further Action": r.furtherAction || "—",
          Status: r.status || "",
          "Gross Impact (£)": r.grossImpact || 0,
          "Gross ALE (£)": Math.round(r.grossALE || 0),
          "Residual Impact (£)": r.residualImpact || 0,
          "Residual ALE (£)": Math.round(r.residualALE || 0),
          "Reduction (£)": Math.round((r.grossALE || 0) - (r.residualALE || 0)),
          Indicator: r.escalated ? "ESC" : r.convertedToIssue ? "ISSUE" : "—",
          Owner: r.owner || "",
          Escalated: r.escalated ? "Yes" : "No",
        }));
        if (rows.length > 0) {
          XLSX.utils.book_append_sheet(
            wb,
            XLSX.utils.json_to_sheet(rows),
            "Risk Register",
          );
        } else {
          XLSX.utils.book_append_sheet(
            wb,
            XLSX.utils.json_to_sheet([
              { Note: "No risk data for this context." },
            ]),
            "Risk Register",
          );
        }

        // ── Tracker / Compliance-only export ────────────────────────────────
      } else if (isTrackerPage || isCompliancePage) {
        const rows = ctxCompliance.map((c) => ({
          ID: c.id,
          Regulation: c.reg || "",
          Domain: c.domain || "",
          Requirement: c.req || "",
          Stage: (c as any).stage || "Not Started",
          Status: c.status || "applicable",
          "Risk Level": c.risk || "Medium",
          Authority: (c as any).auth || "",
          Trigger: (c as any).trigger || "",
        }));
        if (rows.length > 0) {
          XLSX.utils.book_append_sheet(
            wb,
            XLSX.utils.json_to_sheet(rows),
            isTrackerPage ? "Compliance Tracker" : "Compliance Items",
          );
        } else {
          XLSX.utils.book_append_sheet(
            wb,
            XLSX.utils.json_to_sheet([
              { Note: "No compliance data for this context." },
            ]),
            "Compliance Items",
          );
        }

        // ── Full multi-sheet export (all other pages) ────────────────────────
      } else {
        if (ctxCompliance.length > 0) {
          const rows = ctxCompliance.map((c) => ({
            ID: c.id,
            Regulation: c.reg || "",
            Domain: c.domain || "",
            Requirement: c.req || "",
            Stage: (c as any).stage || "Not Started",
            Status: c.status || "applicable",
            "Risk Level": c.risk || "Medium",
            Authority: (c as any).auth || "",
            Trigger: (c as any).trigger || "",
          }));
          XLSX.utils.book_append_sheet(
            wb,
            XLSX.utils.json_to_sheet(rows),
            "Compliance Items",
          );
        }
        if (ctxRisks.length > 0) {
          const rows = ctxRisks.map((r) => ({
            ID: r.id,
            Title: r.title || "",
            Category: r.category || "",
            Workstream: r.workstream || "",
            Status: r.status || "",
            "Gross Likelihood": r.grossL ?? "",
            "Gross Impact": r.grossI ?? "",
            "Gross Rating":
              r.grossRating ??
              (r.grossL && r.grossI ? r.grossL * r.grossI : ""),
            Owner: r.owner || "",
            "Due Date": r.dueDate || "",
            Escalated: r.escalated ? "Yes" : "No",
          }));
          XLSX.utils.book_append_sheet(
            wb,
            XLSX.utils.json_to_sheet(rows),
            "Risk Register",
          );
        }
        if (ctxIssues.length > 0) {
          const rows = ctxIssues.map((i) => ({
            ID: i.id,
            Title: (i as any).title || i.desc?.substring(0, 60) || "",
            Description: i.desc || "",
            Status: i.status || "",
            Impact: i.impact || "",
            Owner: i.owner || "",
            Priority: i.priority ?? "",
            Deadline: (i as any).deadline || "",
          }));
          XLSX.utils.book_append_sheet(
            wb,
            XLSX.utils.json_to_sheet(rows),
            "Issues",
          );
        }
        if (
          ctxCompliance.length === 0 &&
          ctxRisks.length === 0 &&
          ctxIssues.length === 0
        ) {
          XLSX.utils.book_append_sheet(
            wb,
            XLSX.utils.json_to_sheet([
              { Note: "No data available for this context yet." },
            ]),
            "Summary",
          );
        }
      }

      const fileName = `${(name || "CedarGuard").replace(/\s+/g, "_")}_Export_${new Date().toISOString().slice(0, 10)}.xlsx`;
      XLSX.writeFile(wb, fileName);
    } finally {
      setIsExporting(false);
    }
  };

  const actions = [
    {
      label: isTrackerPage
        ? "Add Requirement"
        : isCompliancePage
          ? "Main Compliance Tracker"
          : isIssuesPage
            ? "Add Issue"
            : "Add Risk",
      icon: isTrackerPage || isCompliancePage ? ShieldCheck : AlertCircle,
      onClick: () => {
        if (isTrackerPage) {
          const params = new URLSearchParams(location.search);
          params.set("action", "add-compliance");
          navigate(`${pathname}?${params.toString()}`);
        } else if (isCompliancePage) {
          navigate("/compliance/tracker");
        } else if (isProjectIssuesPage) {
          // Trigger the Add Issue modal on the issues page via URL param
          const params = new URLSearchParams(location.search);
          params.set("action", "add-issue");
          navigate(`${pathname}?${params.toString()}`);
        } else if (isIssuesPage) {
          // Programme issues page — navigate to project issues where dialog lives
          navigate("/risk/issues");
        } else if (isRiskRegisterPage) {
          // Already on register — trigger Add Risk modal via URL param
          const params = new URLSearchParams(location.search);
          params.set("action", "add-risk");
          navigate(`${pathname}?${params.toString()}`);
        } else {
          // Other risk pages — navigate to the correct register
          const contextParam = isProject
            ? `?projectId=${activeProject?.id}`
            : activeProgramme
              ? `?programmeId=${activeProgramme?.id}`
              : "";
          navigate(
            (isProject ? "/risk/register" : "/risk/programme-register") +
              contextParam,
          );
        }
      },
      description: isTrackerPage
        ? "Add a new compliance requirement to this context."
        : isCompliancePage
          ? "Return to the primary compliance management view."
          : isIssuesPage
            ? "Log a new issue for this context."
            : isRiskRegisterPage
              ? "Open the new risk form for this context."
              : "Go to the risk register to log a new risk.",
      category: "Context Actions",
    },
    {
      label: "Edit Profile",
      icon: Settings,
      onClick: handleEditProfile,
      description: `Modify ${type.toLowerCase()} metadata and parameters.`,
      category: "Context Actions",
    },
    {
      label:
        isTrackerPage || isCompliancePage
          ? isTrackerPage
            ? "View Risk Register"
            : "Compliance Settings"
          : "Re-run AI Analysis",
      icon:
        isTrackerPage || isCompliancePage
          ? isTrackerPage
            ? AlertCircle
            : RefreshCw
          : RefreshCw,
      onClick:
        isTrackerPage || isCompliancePage
          ? isTrackerPage
            ? () => {
                const contextParam = isProject
                  ? `?projectId=${activeProject?.id}`
                  : activeProgramme
                    ? `?programmeId=${activeProgramme?.id}`
                    : "";
                navigate(
                  (isProject ? "/risk/register" : "/risk/programme-register") +
                    contextParam,
                );
              }
            : handleRerunCompliance
          : handleRerunCompliance,
      description:
        isTrackerPage || isCompliancePage
          ? isTrackerPage
            ? "Switch to the risk management module."
            : "Update compliance parameters."
          : "Restart compliance setup and re-run AI analysis.",
      category: "Context Actions",
    },
    {
      label: isExporting ? "Exporting..." : exportLabel,
      icon: isExporting ? Loader2 : FileSpreadsheet,
      onClick: handleExportExcel,
      description: exportDescription,
      category: "Data Tools",
    },
    // Download Templates — available in a future release
    // {
    //   label: 'Download Templates',
    //   icon: FileDown,
    //   onClick: () => {},
    //   description: 'Access standardized management frameworks.',
    //   category: 'Data Tools',
    // },
  ];

  // Group actions by category
  const groupedActions = actions.reduce(
    (acc, action) => {
      if (!acc[action.category]) acc[action.category] = [];
      acc[action.category].push(action);
      return acc;
    },
    {} as Record<string, typeof actions>,
  );

  return (
    <div
      className={clsx(
        "sticky top-0 z-30 w-full px-4 bg-white border-b border-slate-200/60 animate-in fade-in slide-in-from-top-4 duration-500 rounded-lg",
        className,
      )}
    >
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 md:gap-4 py-3">
        {/* Left: Context Identity */}
        <div className="flex items-center gap-3 min-w-0">
          <div
            className={clsx(
              "w-10 h-10 rounded-lg flex items-center justify-center shrink-0",
              isProject
                ? "bg-indigo-50 text-indigo-600"
                : "bg-emerald-50 text-emerald-600",
            )}
          >
            {isProject ? (
              <Briefcase className="w-5 h-5" />
            ) : (
              <Layout className="w-5 h-5" />
            )}
          </div>
          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-2 min-w-0">
              <div className="relative group min-w-0">
                <select
                  value={
                    isProject ? activeProject?.id : activeProgramme?.id || ""
                  }
                  onChange={(e) => {
                    const id = e.target.value;
                    if (isProject) setActiveProject(id);
                    else setActiveProgramme(id);

                    if (
                      location.search.includes("projectId") ||
                      location.search.includes("type")
                    ) {
                      const params = new URLSearchParams(location.search);
                      params.delete("projectId");
                      params.delete("programmeId");
                      params.set("type", isProject ? "project" : "programme");
                      navigate(
                        {
                          pathname: location.pathname,
                          search: params.toString(),
                        },
                        { replace: true },
                      );
                    }
                  }}
                  className="appearance-none bg-transparent border-none text-sm font-semibold text-slate-900 pr-5 py-0 focus:ring-0 cursor-pointer hover:text-indigo-600 transition-colors truncate max-w-[180px] sm:max-w-[260px] md:max-w-xs"
                >
                  <option value={context.id}>{name}</option>
                  {(isProject ? projects : programmes)
                    .filter((i) => i.id !== context.id)
                    .map((i) => (
                      <option key={i.id} value={i.id}>
                        {i.name}
                      </option>
                    ))}
                </select>
                <ChevronDown className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400 group-hover:text-indigo-600 transition-colors pointer-events-none" />
              </div>
              <span
                className={clsx(
                  "px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase shrink-0",
                  isProject
                    ? "bg-indigo-600 text-white"
                    : "bg-emerald-600 text-white",
                )}
              >
                {type}
              </span>
            </div>
            <p className="text-[11px] font-medium text-slate-500 mt-0.5 truncate">
              Ref: {reference || "Not assigned"}
            </p>
          </div>
        </div>

        {/* Right: Primary Actions */}
        <div className="relative w-full md:w-auto">
          {canManage ? (
            <>
              <button
                onClick={() => setIsOpen(!isOpen)}
                className={clsx(
                  "flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors w-full md:w-auto",
                  isOpen
                    ? "bg-slate-900 text-white"
                    : "bg-indigo-600 text-white hover:bg-indigo-700",
                )}
              >
                <span>Actions &amp; options</span>
                <ChevronDown
                  className={clsx(
                    "w-4 h-4 transition-transform duration-200",
                    isOpen && "rotate-180",
                  )}
                />
              </button>

              {/* Dropdown Menu */}
              {isOpen && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setIsOpen(false)}
                  />
                  <div className="absolute top-full left-0 right-0 md:left-auto md:right-0 mt-2 md:w-72 bg-white rounded-lg shadow-2xl border border-slate-100 p-2 z-50 animate-in fade-in zoom-in-95 duration-200 origin-top-right">
                    <div className="max-h-[70vh] overflow-y-auto no-scrollbar">
                      {Object.entries(groupedActions).map(
                        ([category, items], catIdx) => (
                          <div
                            key={category}
                            className={clsx(
                              catIdx !== 0 &&
                                "mt-3 pt-3 border-t border-slate-100",
                            )}
                          >
                            <div className="px-3 mb-1.5">
                              <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">
                                {category}
                              </p>
                            </div>
                            <div className="grid grid-cols-1 gap-1 px-1">
                              {items.map((action, idx) => (
                                <button
                                  key={idx}
                                  disabled={
                                    isExporting &&
                                    action.label.startsWith("Export")
                                  }
                                  onClick={() => {
                                    action.onClick();
                                    if (!action.label.startsWith("Export"))
                                      setIsOpen(false);
                                  }}
                                  className="group flex items-start gap-3 p-2.5 hover:bg-slate-50 rounded-lg transition-colors text-left w-full disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  <div className="mt-0.5 p-1.5 bg-slate-50 rounded-lg group-hover:bg-white group-hover:shadow-sm transition-all border border-transparent group-hover:border-slate-100">
                                    <action.icon
                                      className={clsx(
                                        "w-3.5 h-3.5 text-slate-500 group-hover:text-indigo-600",
                                        isExporting &&
                                          action.label.startsWith("Export") &&
                                          "animate-spin",
                                      )}
                                    />
                                  </div>
                                  <div>
                                    <p className="text-sm font-semibold text-slate-900 group-hover:text-indigo-600 transition-colors">
                                      {action.label}
                                    </p>
                                    <p className="text-xs text-slate-500 font-medium leading-snug mt-0.5">
                                      {action.description}
                                    </p>
                                  </div>
                                </button>
                              ))}
                            </div>
                          </div>
                        ),
                      )}
                    </div>
                    <div className="mt-2 pt-2 border-t border-slate-100 px-3 pb-1">
                      <div className="flex items-center gap-1.5 text-[11px] text-slate-400 font-medium">
                        <Info className="w-3 h-3" />
                        Requires PM/SRO permissions
                      </div>
                    </div>
                  </div>
                </>
              )}
            </>
          ) : (
            <div className="flex items-center justify-center gap-2 px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg w-full md:w-auto">
              <AlertCircle className="w-4 h-4 text-slate-400" />
              <span className="text-sm font-medium text-slate-500">
                Read-only
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
