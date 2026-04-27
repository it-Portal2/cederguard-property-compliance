import React, { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate, useParams, useLocation } from "react-router";
import { api } from "../lib/api";
import { useStore, TeamMember } from "../store/useStore";
import { isAtLeastPM, isSuperAdmin, isAtLeastClientAdmin, pmLevelLabel } from "../lib/roles";
import { Save, CheckCircle2, Info, LayoutTemplate, UserCircle, Rocket, ChevronRight, AlertCircle, Shield, Trash2, ScanSearch, AlertTriangle, Plus, DollarSign } from 'lucide-react';
import { clsx } from "clsx";
import { stripMarkdown } from "../lib/utils";
import { RIBA_STAGES } from "../constants/ribaStages";
import { calculateProjectProgress } from "../lib/progress";
import { ProgrammeMilestone } from "../store/useStore";
import { toast } from "react-hot-toast";

import { PublicationChecklist } from "../components/PublicationChecklist";
import { DeliveryTeamCRUD } from "../components/DeliveryTeamCRUD";

// ─── Main Page 
export function ProjectInitiation() {
  const navigate = useNavigate();
  const { id: urlProjectId } = useParams();
  const {
    setActiveProject,
    setActiveProgramme,
    setProjects,
    projects,
    user,
    programmes,
    activeProgrammeId,
    loadProjectData,
    updateProject,
    activeProjectId,
  } = useStore();

  const [loading, setLoading] = useState(false);
  const [publishLoading, setPublishLoading] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [teamSaving, setTeamSaving] = useState(false);
  const [teamSaved, setTeamSaved] = useState(false);
  const [draftToDelete, setDraftToDelete] = useState<string | null>(null);
  const [deletingDraft, setDeletingDraft] = useState(false);
  const [showNoProgrammeWarning, setShowNoProgrammeWarning] = useState(false);
  // Tracks which project ID the form was last populated for — prevents
  // background store updates (from loadProjectData resolving) from resetting
  // isDirty and overwriting in-flight user edits (Fix 4).
  const lastPopulatedForRef = useRef<string | null>(null);

  const defaultMilestones: ProgrammeMilestone[] = RIBA_STAGES.map((stage, idx) => ({
    id: `ms_${Date.now()}_${idx}`,
    name: stage.label,
    updatedBy: "System",
    status: "Pending",
    category: "RIBA Stage",
    historicalUpdates: [],
    stage: stage.id,
  }));

  const resetForm = useCallback(() => {
    setIsDirty(false);
    setFormData({
      name: "",
      type: "",
      loc: "",
      description: "",
      status: "Active",
      programmeId: activeProgrammeId || "",
      programmeManagerId: "",
      projectManagerId: "",
      riba: "",
      employersAgent: "",
      architect: "",
      mainContractor: "",
      startOnSite: "",
      targetPC: "",
      costCentreCode: "",
      fundingStreams: [] as string[],
      numberOfUnits: "",
      numberOfStoreys: "",
      typeOfUnits: "",
      bedroomsPerProperty: "",
      // Project Cost — slim variant of Programme's Scale & Portfolio
      // Financials. Default contingency to 5% (matches Programme default).
      totalValue: "",
      totalGrant: "",
      contingencyPct: "5",
      milestones: [...defaultMilestones],
      deliveryTeam: [],
      deliveryTeamDone: false,
    });
  }, [activeProgrammeId, user?.email]);

  const [formData, setFormData] = useState({
    name: "",
    type: "",
    loc: "",
    description: "",
    status: "Active",
    programmeId: activeProgrammeId || "",
    projectManagerId: "",
    programmeManagerId: "",
    riba: "",
    employersAgent: "",
    architect: "",
    mainContractor: "",
    startOnSite: "",
    targetPC: "",
    costCentreCode: "",
    fundingStreams: [] as string[],
    numberOfUnits: "",
    numberOfStoreys: "",
    typeOfUnits: "",
    bedroomsPerProperty: "",
    // Project Cost (slim mirror of Programme's portfolio financials).
    totalValue: "",
    totalGrant: "",
    contingencyPct: "5",
    milestones: [...defaultMilestones],
    deliveryTeam: [] as TeamMember[],
    deliveryTeamDone: false,
  });

  const { pathname } = useLocation();

  // Effect to handle URL parameters for editing or new mode.
  // Fix 4: lastPopulatedForRef gates form population so that background
  // store updates (loadProjectData resolving) never overwrite in-flight user
  // edits or reset isDirty after the form has already been populated.
  useEffect(() => {
    const isNewRoute =
      pathname.includes("/projects/new") ||
      pathname === "/initiate" ||
      pathname === "/project/initiation";

    const populateForm = (p: any) => {
      setFormData({
        name: p.name || "",
        type: p.type || p.schemeType || "",
        loc: p.loc || "",
        description: p.scope || p.description || "",
        status: p.status || "Active",
        programmeId: p.programmeId || "",
        projectManagerId: p.projectManagerId || p.pmId || user?.email || "",
        programmeManagerId: (p as any).programmeManagerId || "",
        riba: p.riba || "",
        employersAgent: p.employersAgent || "",
        architect: p.architect || "",
        mainContractor: p.mainContractor || "",
        startOnSite: p.startOnSite || "",
        targetPC: p.targetPC || "",
        costCentreCode: p.costCentreCode || "",
        fundingStreams: p.fundingStreams || [],
        numberOfUnits: p.numberOfUnits?.toString() || "",
        numberOfStoreys: p.numberOfStoreys || "",
        typeOfUnits: p.typeOfUnits || "",
        bedroomsPerProperty: p.bedroomsPerProperty || "",
        // Project Cost (slim mirror of Programme's portfolio financials).
        totalValue: p.totalValue?.toString() || "",
        totalGrant: p.totalGrant?.toString() || "",
        contingencyPct: p.contingencyPct?.toString() || "5",
        milestones: p.milestones || [],
        deliveryTeam: Array.isArray(p.deliveryTeam) ? (p.deliveryTeam as TeamMember[]) : [] as TeamMember[],
        deliveryTeamDone: !!p.deliveryTeamDone,
      });
      setIsDirty(false);
    };

    if (urlProjectId) {
      // Only populate when switching to a new project ID.
      // Once populated (ref matches), skip — so store updates don't overwrite edits.
      if (lastPopulatedForRef.current !== urlProjectId) {
        setActiveProject(urlProjectId);
        loadProjectData(urlProjectId);
        const p = (Array.isArray(projects) ? projects : []).find(
          (proj) => proj.id === urlProjectId,
        );
        if (p) {
          populateForm(p);
          lastPopulatedForRef.current = urlProjectId;
        }
        // If p not found yet (projects still loading), don't set the ref —
        // the effect will retry when projects updates with the loaded data.
      }
    } else if (isNewRoute) {
      if (lastPopulatedForRef.current !== "new") {
        setActiveProject(null);
        setActiveProgramme(null);
        resetForm();
        lastPopulatedForRef.current = "new";
      }
    } else if (activeProjectId && !urlProjectId) {
      if (lastPopulatedForRef.current !== activeProjectId) {
        loadProjectData(activeProjectId);
        const p = (Array.isArray(projects) ? projects : []).find(
          (proj) => proj.id === activeProjectId,
        );
        if (p) {
          populateForm(p);
          lastPopulatedForRef.current = activeProjectId;
        }
      }
    } else if (!activeProjectId) {
      if (lastPopulatedForRef.current !== null) {
        // No project being edited — clear stale programme context so the
        // PublicationChecklist sidebar doesn't leak previously selected data.
        setActiveProgramme(null);
        resetForm();
        lastPopulatedForRef.current = null;
      }
    }
  }, [urlProjectId, activeProjectId, projects, pathname]);

  // Fetch projects on mount if empty
  useEffect(() => {
    const fetchProjectsIfEmpty = async () => {
      if (!Array.isArray(projects) || projects.length === 0) {
        try {
          const fetchFn = [
            "admin",
            "enterprise",
            "client_admin",
          ].includes(userRole)
            ? api.clientGetProjects
            : api.getProjects;
          const res = await fetchFn();
          const projectsList = (res as any)?.projects || [];
          if (Array.isArray(projectsList) && projectsList.length > 0) {
            setProjects(projectsList as any);
          }
        } catch (err) {
          console.error("Failed to fetch projects:", err);
        }
      }
    };
    fetchProjectsIfEmpty();
  }, []);

  const [assignablePMs, setAssignablePMs] = useState<any[]>([]);
  const [programmeManagers, setProgrammeManagers] = useState<any[]>([]);
  const [filteredProgrammes, setFilteredProgrammes] = useState<any[]>([]);
  const [loadingPMs, setLoadingPMs] = useState(false);
  const [loadingProgrammes, setLoadingProgrammes] = useState(false);
  const [loadingAssignablePMs, setLoadingAssignablePMs] = useState(false);
  const userRole = (user as any)?.role;

  // Fetch cascade Step 1 supervisors on mount. Step 2/3 fetch only after their parent is set.
  useEffect(() => {
    const fetchDropdownData = async () => {
      setLoadingPMs(true);
      try {
        const supervisorsRes = await api.clientGetMySupervisors();
        if (supervisorsRes.success) setProgrammeManagers(supervisorsRes.users || []);
      } catch (err: any) {
        if (err?.status !== 403) console.error('Failed to fetch supervisors:', err);
      } finally {
        setLoadingPMs(false);
      }
    };
    fetchDropdownData();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Step 2 — re-fetch programmes when supervisor changes; clear when supervisor cleared.
  useEffect(() => {
    if (!formData.programmeManagerId) {
      setFilteredProgrammes([]);
      setLoadingProgrammes(false);
      return;
    }
    const syncProgrammes = async () => {
      setLoadingProgrammes(true);
      try {
        const res = await api.clientGetProgrammesByManager(formData.programmeManagerId);
        if (res.success) setFilteredProgrammes(res.programmes || []);
      } catch (err) {
        console.error("Failed to fetch filtered programmes:", err);
        setFilteredProgrammes([]);
      } finally {
        setLoadingProgrammes(false);
      }
    };
    syncProgrammes();
  }, [formData.programmeManagerId]);

  // Step 3 — re-fetch PMs assigned to the chosen programme; clear when programme cleared.
  useEffect(() => {
    if (!formData.programmeId) {
      setAssignablePMs([]);
      setLoadingAssignablePMs(false);
      return;
    }
    const syncPMs = async () => {
      setLoadingAssignablePMs(true);
      try {
        const res = await api.getPMsAssignedToProgramme(formData.programmeId);
        if (res.success) setAssignablePMs(res.users || []);
      } catch (err: any) {
        if (err?.status !== 403) console.error("Failed to fetch programme PMs:", err);
        setAssignablePMs([]);
      } finally {
        setLoadingAssignablePMs(false);
      }
    };
    syncPMs();
  }, [formData.programmeId]);

  // Cascade reset — clearing a parent clears its children.
  useEffect(() => {
    if (!formData.programmeManagerId && (formData.programmeId || formData.projectManagerId)) {
      setFormData((prev) => ({ ...prev, programmeId: "", projectManagerId: "" }));
    }
  }, [formData.programmeManagerId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!formData.programmeId && formData.projectManagerId) {
      setFormData((prev) => ({ ...prev, projectManagerId: "" }));
    }
  }, [formData.programmeId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (user && !isAtLeastPM(userRole)) navigate("/projects");
  }, [user, userRole, navigate]);

  const set = (key: string, val: any) => {
    setFormData((prev) => ({ ...prev, [key]: val }));
    setIsDirty(true);
  };

  const requiredDone = ["name", "type", "loc", "projectManagerId"].every(
    (k) => String(formData[k as keyof typeof formData] ?? "").trim() !== "",
  );

  const loadDummy = () => {
    setFormData((prev) => ({
      ...prev,
      name: "Demo Project — Tower A Retrofit",
      type: "Retrofit / Decarbonisation",
      loc: "London",
      description:
        "Full external wall insulation and window replacement for Tower A to meet EPC C standard.",
      riba: "Stage 4 — Technical Design",
      employersAgent: "Capita Property Services",
      architect: "Arup Associates",
      mainContractor: "Durkan Ltd",
      startOnSite: "2026-08-15",
      targetPC: "2029-03-20",
      costCentreCode: "CC-0909",
      fundingStreams: ["Grant", "Other"],
      numberOfUnits: "150",
      numberOfStoreys: "9+",
      typeOfUnits: "Flat",
      bedroomsPerProperty: "2B2P",
    }));
    setIsDirty(true);
  };

  const handleSubmit = async (e?: React.FormEvent, skipProgrammeWarning = false) => {
    if (e) e.preventDefault();
    if (!requiredDone) {
      toast.error("Please fill all required fields.");
      return;
    }
    // UX 3: soft warning when creating a new project with no programme linked.
    // Not shown when updating (the user has already consciously set the field).
    if (!skipProgrammeWarning && !formData.programmeId && !activeProjectId) {
      setShowNoProgrammeWarning(true);
      return;
    }
    setLoading(true);
    try {
      if (activeProjectId) {
        const res = await api.updateProject(activeProjectId, formData);
        if (res.success) {
          updateProject(activeProjectId, formData);
          setIsDirty(false);
          toast.success("Project updated successfully");
        }
      } else {
        const res = await api.createProject({
          name: formData.name,
          type: formData.type,
          loc: formData.loc,
          scope: formData.description,
          status: formData.status,
          programmeId: formData.programmeId,
          programmeManagerId: formData.programmeManagerId || null,
          projectManagerId: formData.projectManagerId,
          riba: formData.riba,
          employersAgent: formData.employersAgent,
          architect: formData.architect,
          mainContractor: formData.mainContractor,
          startOnSite: formData.startOnSite,
          targetPC: formData.targetPC,
          costCentreCode: formData.costCentreCode,
          fundingStreams: formData.fundingStreams,
          numberOfUnits: formData.numberOfUnits
            ? Number(formData.numberOfUnits)
            : undefined,
          numberOfStoreys: formData.numberOfStoreys,
          typeOfUnits: formData.typeOfUnits,
          bedroomsPerProperty: formData.bedroomsPerProperty,
          // Project Cost (slim mirror of Programme's portfolio financials).
          totalValue: formData.totalValue,
          totalGrant: formData.totalGrant,
          contingencyPct: formData.contingencyPct,
          milestones: formData.milestones,
          deliveryTeam: formData.deliveryTeam,
          createdBy: user?.email || "",
          pm: formData.projectManagerId || user?.email || "",
        } as any);

        if (res?.id) {
          await updateProject(res.id, {
            complianceSetupDone: false,
            riskSetupDone: false,
            isPublished: false,
            setupProgress: 25,
          });
          // Parallelize independent data loading operations
          const fetchFn = [
            "admin",
            "enterprise",
            "client_admin",
          ].includes(userRole)
            ? api.clientGetProjects
            : api.getProjects;
          const [_, listRes] = await Promise.all([
            loadProjectData(res.id),
            fetchFn(),
          ]);
          const projectsList = (listRes as any)?.projects || [];
          if (Array.isArray(projectsList)) {
            let finalProjects = [...projectsList];
            if (!finalProjects.find((p) => p.id === res.id)) {
              finalProjects.push({ ...formData, id: res.id });
            }
            const unique = Array.from(
              new Map(
                finalProjects.map((item: any) => [item.id, item]),
              ).values(),
            );
            setProjects(unique as any);
          }
          setActiveProject(res.id);
          setIsDirty(false);
          toast.success("Project created successfully");
          setTimeout(() => {
            navigate(
              `/compliance/setup?type=project&id=${res.id}&from=initiation`,
            );
          }, 300);
        } else {
          toast.error("Failed to create project — no ID returned.");
        }
      }
    } catch (err: any) {
      toast.error(err.message || "Operation failed");
    } finally {
      setLoading(false);
    }
  };

  const handlePublish = async () => {
    if (!activeProjectId) return;

    const safeProjects = Array.isArray(projects) ? projects : [];
    const existing = safeProjects.find((p) => p.id === activeProjectId);
    if (existing?.isPublished) {
      setActiveProject(null);
      navigate("/dashboard");
      return;
    }

    setPublishLoading(true);
    try {
      await updateProject(activeProjectId, {
        isPublished: true,
        setupProgress: formData.programmeId ? 100 : 90,
        status: "Active",
      });
      toast.success("Project published successfully.");
      setTimeout(() => {
        const isAdmin = isSuperAdmin(user?.email, userRole);
        const isClientAdmin = isAtLeastClientAdmin(userRole) || isAdmin;
        // Auto-select the newly published project
        setActiveProject(activeProjectId);
        navigate("/dashboard");
      }, 1500);
    } catch (err: any) {
      toast.error(err.message || "Failed to publish project.");
    } finally {
      setPublishLoading(false);
    }
  };

  const inputCls =
    "w-full px-3 py-2.5 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors";
  const labelCls =
    "block text-[11px] font-black text-slate-500 uppercase tracking-widest mb-2 ml-1";

  return (
    <div className="min-h-screen bg-slate-50/50 pb-24 md:pb-12 pt-safe">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-10">
        {/* ── HEADER SECTION ─────────── */}
        <div className="mb-8 md:mb-12">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-50 border border-indigo-100/50 text-indigo-600">
                <Rocket className="w-3.5 h-3.5" />
                <span className="text-[10px] font-black uppercase tracking-widest">
                  Setup Phase
                </span>
              </div>
              <h1 className="text-3xl md:text-4xl font-black text-slate-900 tracking-tight">
                Project <span className="text-indigo-600">Initiation</span>
              </h1>
              <p className="text-slate-500 font-medium max-w-2xl text-sm md:text-base leading-relaxed">
                Establish the core foundations, delivery team, and key
                milestones for your project.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {isAtLeastPM(userRole) && activeProjectId && (
                <button
                  type="button"
                  onClick={() => {
                    setActiveProject(null);
                    resetForm();
                  }}
                  className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 text-slate-600 font-bold rounded-xl hover:bg-slate-50 hover:border-indigo-200 hover:text-indigo-600 transition-all text-xs shadow-sm active:scale-95"
                >
                  <Plus className="w-4 h-4" />
                  New Project
                </button>
              )}
              <button
                type="button"
                onClick={loadDummy}
                className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 text-slate-600 font-bold rounded-xl hover:bg-slate-50 hover:border-indigo-200 hover:text-indigo-600 transition-all text-xs shadow-sm active:scale-95"
              >
                <LayoutTemplate className="w-4 h-4" />
                Load Demo
              </button>
              <button
                onClick={() => handleSubmit()}
                disabled={
                  loading || !requiredDone || (!!activeProjectId && !isDirty)
                }
                className={clsx(
                  "flex items-center gap-2 px-6 py-2.5 font-black rounded-xl text-xs uppercase tracking-widest transition-all shadow-lg active:scale-95",
                  requiredDone && (!activeProjectId || isDirty)
                    ? "bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-100 hover:shadow-indigo-200"
                    : "bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200 shadow-none",
                )}
              >
                {loading ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />{" "}
                    Working…
                  </>
                ) : activeProjectId ? (
                  <>
                    <Save className="w-4 h-4 text-indigo-200" /> Save Details
                  </>
                ) : (
                  <>
                    <Rocket className="w-4 h-4 text-indigo-200" /> Create
                    Project
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* ── MAIN CONTENT GRID ─────────── */}
        <div className="relative grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {loading && (
            <div className="absolute inset-0 z-50 bg-white/60 backdrop-blur-[2px] rounded-3xl flex items-center justify-center">
              <div className="flex flex-col items-center gap-3">
                <div className="w-10 h-10 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin shadow-md" />
                <span className="text-sm font-black text-indigo-900 tracking-widest uppercase">Processing</span>
              </div>
            </div>
          )}
          {/* LEFT: FORM SECTION (Column Span 8) */}
          <div className="lg:col-span-8 order-2 lg:order-1 space-y-8">
            <form
              onSubmit={handleSubmit}
              className="bg-white border border-slate-200 rounded-3xl p-6 md:p-10 shadow-xl shadow-slate-200/50 space-y-10"
            >
              {/* Continuing Drafts Overlay-style section */}
              {(Array.isArray(projects) ? projects : []).filter(
                (p) => !p.isPublished,
              ).length > 0 && (
                <div className="bg-indigo-50/50 p-6 rounded-2xl border border-indigo-100/50 mb-8 overflow-hidden relative group">
                  <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform duration-500">
                    <Save className="w-20 h-20 text-indigo-600 rotate-12" />
                  </div>
                  <div className="relative z-10">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <p className="text-[11px] font-black text-indigo-600 uppercase tracking-widest leading-none">
                          In-Progress Drafts
                        </p>
                        <p className="text-[10px] text-slate-500 font-bold mt-1">
                          Pick up where you left off or start fresh.
                        </p>
                      </div>
                      {activeProjectId && (
                        <button
                          type="button"
                          onClick={() => {
                            setActiveProject(null);
                            resetForm();
                          }}
                          className="text-[10px] font-black text-indigo-600 hover:text-indigo-700 uppercase tracking-widest px-3 py-1.5 bg-white rounded-lg border border-indigo-100 shadow-sm active:scale-95 transition-all"
                        >
                          New Project
                        </button>
                      )}
                    </div>
                    <div className="flex flex-col sm:flex-row gap-3">
                      <select
                        className="flex-1 px-4 py-3 bg-white border border-slate-200 rounded-xl text-[13px] font-black text-slate-700 focus:outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all shadow-sm"
                        value={activeProjectId || ""}
                        onChange={(e) => {
                          const id = e.target.value;
                          if (id) {
                            setActiveProject(id);
                            loadProjectData(id);
                            const safeProjects = Array.isArray(projects)
                              ? projects
                              : [];
                            const p = safeProjects.find(
                              (proj) => proj.id === id,
                            );
                            if (p) {
                              setFormData({
                                name: p.name || "",
                                type: p.type || p.schemeType || "",
                                loc: p.loc || "",
                                description: p.scope || p.description || "",
                                status: p.status || "Active",
                                programmeId: p.programmeId || "",
                                projectManagerId:
                                  p.projectManagerId ||
                                  p.pmId ||
                                  user?.email ||
                                  "",
                                programmeManagerId: (p as any).programmeManagerId || "",
                                riba: p.riba || "",
                                employersAgent: p.employersAgent || "",
                                architect: p.architect || "",
                                mainContractor: p.mainContractor || "",
                                startOnSite: p.startOnSite || "",
                                targetPC: p.targetPC || "",
                                costCentreCode: p.costCentreCode || "",
                                fundingStreams: p.fundingStreams || [],
                                numberOfUnits:
                                  p.numberOfUnits?.toString() || "",
                                numberOfStoreys: p.numberOfStoreys || "",
                                typeOfUnits: p.typeOfUnits || "",
                                bedroomsPerProperty:
                                  p.bedroomsPerProperty || "",
                                // Project Cost (slim mirror of Programme financials).
                                totalValue: p.totalValue?.toString() || "",
                                totalGrant: p.totalGrant?.toString() || "",
                                contingencyPct:
                                  p.contingencyPct?.toString() || "5",
                                milestones: p.milestones || [],
                                deliveryTeam: Array.isArray(p.deliveryTeam)
                                  ? (p.deliveryTeam as TeamMember[])
                                  : [] as TeamMember[],
                                deliveryTeamDone: !!p.deliveryTeamDone,
                              });
                            }
                          } else {
                            setActiveProject(null);
                            resetForm();
                          }
                        }}
                      >
                        <option value="">— Select a saved draft —</option>
                        {(Array.isArray(projects) ? projects : [])
                          .filter((p) => !p.isPublished)
                          .map((p) => (
                            <option key={p.id} value={p.id}>
                              {stripMarkdown(p.name)} (
                              {calculateProjectProgress(p).percentage}%
                              Complete)
                            </option>
                          ))}
                      </select>
                      {activeProjectId &&
                        !(Array.isArray(projects) ? projects : []).find(
                          (p) => p.id === activeProjectId,
                        )?.isPublished && (
                          <button
                            type="button"
                            onClick={() => setDraftToDelete(activeProjectId)}
                            className="px-4 py-3 text-rose-600 hover:bg-rose-50 rounded-xl border border-rose-100 transition-all shadow-sm flex items-center justify-center bg-white"
                            title="Discard Draft"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        )}
                    </div>
                  </div>
                </div>
              )}

              {/* ── SECTION: CORE DETAILS ── */}
              <div className="space-y-6">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white shadow-lg shadow-indigo-100">
                    <Info className="w-4 h-4" />
                  </div>
                  <h2 className="text-sm font-black text-slate-900 uppercase tracking-widest">
                    Metadata & Identity
                  </h2>
                </div>

                <div className="space-y-5">
                  {/* Project Name */}
                  <div>
                    <label className={labelCls}>
                      Project Name{" "}
                      <span className="text-rose-500 ml-0.5">*</span>
                    </label>
                    <input
                      type="text"
                      className={inputCls}
                      placeholder="e.g. Bermondsey Estate Transformation"
                      value={formData.name}
                      onChange={(e) => set("name", e.target.value)}
                      required
                    />
                  </div>

                  {/* ── UX 1: Programme fields elevated to top — high-level classification ── */}
                  <div className="p-4 bg-indigo-50/60 border border-indigo-100 rounded-xl space-y-4">
                    <p className="text-[10px] font-black text-indigo-600 uppercase tracking-widest leading-none">
                      Programme Classification
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      <div>
                        <label className={clsx(labelCls, "text-indigo-700 flex items-center gap-1.5")}>
                          Associated Programme
                          {isAtLeastClientAdmin(userRole) && (
                            <span className="text-rose-500 ml-0.5">*</span>
                          )}
                          {loadingProgrammes && (
                            <span className="flex items-center gap-1 text-indigo-500 font-semibold normal-case tracking-normal text-[10px]">
                              <div className="w-2.5 h-2.5 border-2 border-indigo-200 border-t-indigo-500 rounded-full animate-spin" />
                              Loading…
                            </span>
                          )}
                        </label>
                        <select
                          className={clsx(inputCls, "border-indigo-200 focus:border-indigo-500")}
                          value={formData.programmeId}
                          onChange={(e) => set("programmeId", e.target.value)}
                          disabled={loadingPMs || loadingProgrammes}
                        >
                          {loadingPMs || loadingProgrammes
                            ? <option value="">Loading programmes…</option>
                            : <>
                                {/* UX 4: explicit "independent" option — not a blank placeholder */}
                                <option value="">— Independent (no programme link) —</option>
                                {filteredProgrammes.map((p) => (
                                  <option key={p.id} value={p.id}>
                                    {p.name}
                                  </option>
                                ))}
                              </>
                          }
                        </select>
                        {/* UX 5: guidance for client admins */}
                        {isAtLeastClientAdmin(userRole) && !formData.programmeId && !loadingProgrammes && (
                          <p className="text-[10px] text-amber-600 font-semibold mt-1.5 ml-1">
                            Recommended: link to a programme or confirm as independent.
                          </p>
                        )}
                        {formData.programmeManagerId && !loadingProgrammes && filteredProgrammes.length === 0 && (
                          <p className="text-[10px] text-slate-500 font-semibold mt-1.5 ml-1">
                            This supervisor hasn't created any programmes yet. You can continue as independent and link one later.
                          </p>
                        )}
                      </div>

                      <div>
                        <label className={labelCls}>Programme Supervisor / Director</label>
                        <select
                          className={inputCls}
                          value={formData.programmeManagerId}
                          onChange={(e) => set("programmeManagerId", e.target.value)}
                          disabled={loadingPMs}
                        >
                          {loadingPMs
                            ? <option value="">Loading supervisors…</option>
                            : <>
                                <option value="">— Select Supervisor —</option>
                                {programmeManagers.map((m) => (
                                  <option key={m.uid || m.email} value={m.uid}>
                                    {m.displayName || m.email?.split('@')[0] || '(No name)'}{' '}
                                    ({m.role?.replace(/_/g, ' ')})
                                  </option>
                                ))}
                              </>
                          }
                        </select>
                      </div>
                    </div>

                    {/* UX 2: confirmation banner when a programme is selected */}
                    {formData.programmeId && (() => {
                      const linked = filteredProgrammes.find(p => p.id === formData.programmeId);
                      return linked ? (
                        <div className="flex items-center gap-2 text-xs text-indigo-700 font-semibold bg-indigo-100/60 px-3 py-2 rounded-lg border border-indigo-200/60">
                          <CheckCircle2 className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                          This project will be added to{' '}
                          <span className="font-black">{linked.name}</span>
                        </div>
                      ) : null;
                    })()}
                  </div>

                  {/* ── Rest of metadata grid ── */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div>
                      <label className={labelCls}>
                        Project Type{" "}
                        <span className="text-rose-500 ml-0.5">*</span>
                      </label>
                      <select
                        className={inputCls}
                        value={formData.type}
                        onChange={(e) => set("type", e.target.value)}
                        required
                      >
                        <option value="">— Select Type —</option>
                        <optgroup label="New Build">
                          <option>New Build – General Needs</option>
                          <option>New Build – Higher-Risk Building (HRB)</option>
                          <option>New Build – Supported Housing</option>
                        </optgroup>
                        <optgroup label="Existing Stock">
                          <option>Refurbishment</option>
                          <option>Retrofit / Decarbonisation</option>
                          <option>Maintenance</option>
                          <option>Damp &amp; Mould Remediation</option>
                        </optgroup>
                      </select>
                    </div>

                    <div>
                      <label className={labelCls}>
                        Location / Ward{" "}
                        <span className="text-rose-500 ml-0.5">*</span>
                      </label>
                      <input
                        type="text"
                        className={inputCls}
                        placeholder="e.g. London"
                        value={formData.loc}
                        onChange={(e) => set("loc", e.target.value)}
                        required
                      />
                    </div>

                    <div>
                      <label className={clsx(labelCls, "flex items-center gap-1.5")}>
                        Assigned Project Manager{" "}
                        <span className="text-rose-500 ml-0.5">*</span>
                        {loadingAssignablePMs && (
                          <span className="flex items-center gap-1 text-indigo-500 font-semibold normal-case tracking-normal text-[10px]">
                            <div className="w-2.5 h-2.5 border-2 border-indigo-200 border-t-indigo-500 rounded-full animate-spin" />
                            Loading…
                          </span>
                        )}
                      </label>
                      <select
                        className={inputCls}
                        value={formData.projectManagerId}
                        onChange={(e) => set("projectManagerId", e.target.value)}
                        disabled={loadingPMs || loadingAssignablePMs || (!isAtLeastClientAdmin(userRole) && assignablePMs.length === 0 && !formData.programmeId)}
                        required
                      >
                        {loadingPMs || loadingAssignablePMs
                          ? <option value="">Loading project managers…</option>
                          : !formData.programmeId
                            ? <option value="">— Select a programme first —</option>
                            : <>
                                <option value="">— Select PM —</option>
                                {/* Deduplicate by email, drop no-email entries (avoids blank gaps).
                                    Filter out account-tier roles (pro, enterprise) — these are billing
                                    tiers not job roles and should not appear in the PM assignment list.
                                    If displayName contains '@' the backend used email as fallback — show
                                    (No name) label instead. Label uses pmLevel (Senior/Standard/Assistant/Coordinator)
                                    which describes seniority; falls back to role string when pmLevel missing. */}
                                {[...new Map(
                                  assignablePMs
                                    .filter(pm => pm.email && !['pro', 'enterprise', 'admin', 'super_admin'].includes(pm.role))
                                    .map(pm => [pm.email, pm])
                                ).values()].map((pm) => {
                                  const raw = pm.displayName?.trim() ?? '';
                                  const hasRealName = raw && !raw.includes('@');
                                  const name = hasRealName ? raw : `(No name) — ${pm.email}`;
                                  const designation = pm.pmLevel
                                    ? pmLevelLabel(pm.pmLevel)
                                    : (pm.role?.replace(/_/g, ' ') || '');
                                  return (
                                    <option key={pm.uid || pm.email} value={pm.email}>
                                      {name}{designation ? ` — ${designation}` : ''}
                                    </option>
                                  );
                                })}
                                {/* Fallback: current PM not in assignable list (e.g. different org) */}
                                {formData.projectManagerId && !assignablePMs.find(pm => pm.email === formData.projectManagerId) && (
                                  <option value={formData.projectManagerId}>
                                    {(() => {
                                      const raw = user?.displayName?.trim() ?? '';
                                      const hasRealName = raw && !raw.includes('@');
                                      return hasRealName ? raw : `(No name) — ${formData.projectManagerId}`;
                                    })()}
                                  </option>
                                )}
                              </>
                        }
                      </select>
                    </div>

                    <div>
                      <label className={labelCls}>RIBA Stage</label>
                      <select
                        className={inputCls}
                        value={formData.riba}
                        onChange={(e) => set("riba", e.target.value)}
                      >
                        <option value="">— Select RIBA Stage —</option>
                        {RIBA_STAGES.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className={labelCls}>Cost Centre Code</label>
                      <input
                        type="text"
                        className={inputCls}
                        placeholder="e.g. CC-1234"
                        value={formData.costCentreCode}
                        onChange={(e) => set("costCentreCode", e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <hr className="border-slate-100" />

              {/* ── SECTION: PROPERTY & FINANCIAL ── */}
              <div className="space-y-6">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center text-white shadow-lg shadow-emerald-100">
                    <Shield className="w-4 h-4" />
                  </div>
                  <h2 className="text-sm font-black text-slate-900 uppercase tracking-widest">
                    Scope & Assets
                  </h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="md:col-span-2">
                    <label className={labelCls}>Scope of Works</label>
                    <textarea
                      rows={3}
                      className={inputCls}
                      placeholder="Main project objectives and deliverables…"
                      value={formData.description}
                      onChange={(e) => set("description", e.target.value)}
                    />
                  </div>

                  <div>
                    <label className={labelCls}>Funding Streams</label>
                    <select
                      multiple
                      className={clsx(inputCls, "min-h-[120px] scrollbar-hide")}
                      value={formData.fundingStreams}
                      onChange={(e) =>
                        set(
                          "fundingStreams",
                          Array.from(
                            e.target.selectedOptions,
                            (o) => (o as HTMLOptionElement).value,
                          ),
                        )
                      }
                    >
                      <option value="Grant">Government Grant</option>
                      <option value="RTB receipts">
                        Right to Buy Receipts
                      </option>
                      <option value="S106 income">Section 106 Income</option>
                      <option value="Sales income">Private Sales Income</option>
                      <option value="Private finance">
                        Private Finance / Loans
                      </option>
                      <option value="Other">Other Internal Funds</option>
                    </select>
                    <p className="text-[10px] text-slate-400 font-bold mt-2 uppercase tracking-tight italic">
                      Hold Ctrl / Cmd to multi-pick
                    </p>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className={labelCls}>Storeys</label>
                      <select
                        className={inputCls}
                        value={formData.numberOfStoreys}
                        onChange={(e) => set("numberOfStoreys", e.target.value)}
                      >
                        <option value="">— Select Height —</option>
                        <option value="0-4">Low Rise (0-4 floors)</option>
                        <option value="5-9">Mid Rise (5-9 floors)</option>
                        <option value="9+">High Rise (10+ floors)</option>
                      </select>
                    </div>
                    <div>
                      <label className={labelCls}>Total Units</label>
                      <input
                        type="number"
                        className={inputCls}
                        placeholder="e.g. 150"
                        value={formData.numberOfUnits}
                        onChange={(e) => set("numberOfUnits", e.target.value)}
                      />
                    </div>

                    <div>
                      <label className={labelCls}>Type of Units</label>
                      <select
                        className={inputCls}
                        value={formData.typeOfUnits}
                        onChange={(e) => set("typeOfUnits", e.target.value)}
                      >
                        <option value="">— Select Type —</option>
                        <option>Flat</option>
                        <option>House</option>
                        <option>Bungalow</option>
                        <option>Hostel</option>
                        <option>Other</option>
                      </select>
                    </div>

                    <div>
                      <label className={labelCls}>Bedrooms per Property</label>
                      <input
                        type="text"
                        className={inputCls}
                        placeholder="e.g. 2B4P, 1B2P"
                        value={formData.bedroomsPerProperty}
                        onChange={(e) =>
                          set("bedroomsPerProperty", e.target.value)
                        }
                      />
                    </div>
                  </div>
                </div>
              </div>

              <hr className="border-slate-100" />

              {/* ── SECTION: PROJECT COST ── */}
              {/* Slim mirror of Programme's "Scale & Portfolio Financials"
                  section — only the per-project fields (no Volume Targets
                  / Project Count, which are aggregate/portfolio concepts). */}
              <div id="project-cost" className="space-y-6 scroll-mt-24">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center text-white shadow-lg shadow-emerald-100">
                    <DollarSign className="w-4 h-4" />
                  </div>
                  <h2 className="text-sm font-black text-slate-900 uppercase tracking-widest">
                    Project Cost
                  </h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                  <div>
                    <label className={labelCls}>Total Value (£)</label>
                    <input
                      type="number"
                      min="0"
                      className={inputCls}
                      placeholder="e.g. 2500000"
                      value={formData.totalValue}
                      onChange={(e) => set("totalValue", e.target.value)}
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Grant Funding (£)</label>
                    <input
                      type="number"
                      min="0"
                      className={inputCls}
                      placeholder="e.g. 750000"
                      value={formData.totalGrant}
                      onChange={(e) => set("totalGrant", e.target.value)}
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Contingency (%)</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      className={inputCls}
                      placeholder="5"
                      value={formData.contingencyPct}
                      onChange={(e) => set("contingencyPct", e.target.value)}
                    />
                  </div>
                </div>
              </div>

              <hr className="border-slate-100" />

              {/* ── SECTION: DELIVERY TEAM ── */}
              <div id="project-delivery" className="scroll-mt-24">
                <DeliveryTeamCRUD
                  members={formData.deliveryTeam}
                  isDone={formData.deliveryTeamDone}
                  saving={teamSaving}
                  saved={teamSaved}
                  onUpdate={async (updatedMembers: TeamMember[], updatedIsDone: boolean) => {
                    setFormData((prev) => ({
                      ...prev,
                      deliveryTeam: updatedMembers,
                      deliveryTeamDone: updatedIsDone,
                    }));
                    const projectId = urlProjectId || activeProjectId;
                    if (projectId) {
                      setTeamSaving(true);
                      setTeamSaved(false);
                      try {
                        await updateProject(projectId, { deliveryTeam: updatedMembers });
                        setTeamSaved(true);
                        setTimeout(() => setTeamSaved(false), 2500);
                      } catch {
                        toast.error("Failed to save team changes. Please try again.");
                      } finally {
                        setTeamSaving(false);
                      }
                    } else {
                      setIsDirty(true);
                    }
                  }}
                />
              </div>

              <hr className="border-slate-100" />

              {/* ── SECTION: MILESTONES ── */}
              <div className="space-y-6 pb-2">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-8 h-8 rounded-lg bg-amber-500 flex items-center justify-center text-white shadow-lg shadow-amber-100">
                    <LayoutTemplate className="w-4 h-4" />
                  </div>
                  <h2 className="text-sm font-black text-slate-900 uppercase tracking-widest">
                    Key Timeline
                  </h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <label className={labelCls}>Start on Site</label>
                    <input
                      type="date"
                      className={inputCls}
                      value={formData.startOnSite}
                      onChange={(e) => set("startOnSite", e.target.value)}
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Expected PC Date</label>
                    <input
                      type="date"
                      className={inputCls}
                      value={formData.targetPC}
                      onChange={(e) => set("targetPC", e.target.value)}
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-8 mt-8 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={(e) => handleSubmit(e as any)}
                    disabled={loading || !requiredDone || (!!activeProjectId && !isDirty)}
                    className={clsx(
                      "flex items-center gap-2 px-8 py-3.5 font-black rounded-xl text-sm uppercase tracking-widest transition-all shadow-lg active:scale-95",
                      requiredDone && (!activeProjectId || isDirty)
                        ? "bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-200 hover:shadow-indigo-300 transform hover:-translate-y-0.5"
                        : "bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200 shadow-none"
                    )}
                  >
                    {loading ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Working…
                      </>
                    ) : activeProjectId ? (
                      <>
                        <Save className="w-5 h-5 text-indigo-200" /> Save Details
                      </>
                    ) : (
                      <>
                        <Rocket className="w-5 h-5 text-indigo-200" /> Create Project
                      </>
                    )}
                  </button>
                </div>
              </div>
            </form>
          </div>

          {/* RIGHT: TRACKER SECTION (Column Span 4) */}
          <div className="lg:col-span-4 order-1 lg:order-2 sticky top-6">
            <PublicationChecklist onPublish={handlePublish} loading={publishLoading} />
          </div>
        </div>
      </div>

      {/* No-Programme Warning Modal (UX 3) */}
      {showNoProgrammeWarning && (
        <div className="fixed inset-0 z-100 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 animate-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3 mb-4 text-amber-600">
              <div className="p-2 bg-amber-50 rounded-xl">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-black tracking-tight text-slate-900">Independent Project?</h3>
            </div>
            <p className="text-slate-500 mb-1 text-sm leading-relaxed">
              This project is not linked to any programme. It will be saved as an <span className="font-bold text-slate-700">independent project</span>.
            </p>
            <p className="text-slate-400 mb-6 text-xs leading-relaxed">
              You can link it to a programme later from this page. If this is intentional, continue below.
            </p>
            <div className="flex items-center gap-3 justify-end">
              <button
                type="button"
                onClick={() => setShowNoProgrammeWarning(false)}
                className="px-4 py-2 font-black text-xs uppercase tracking-widest text-slate-500 hover:bg-slate-50 border border-slate-200 rounded-xl transition-all"
              >
                Cancel — Add Programme
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowNoProgrammeWarning(false);
                  handleSubmit(undefined, true);
                }}
                className="flex items-center gap-2 px-4 py-2 font-black text-xs uppercase tracking-widest text-white bg-amber-500 hover:bg-amber-600 shadow-lg shadow-amber-100 rounded-xl transition-all"
              >
                Continue as Independent
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Draft Modal */}
      {draftToDelete && (
        <div className="fixed inset-0 z-100 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 animate-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3 mb-4 text-rose-600">
              <div className="p-2 bg-rose-50 rounded-xl">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-black tracking-tight">Delete Draft Project</h3>
            </div>
            <p className="text-slate-500 mb-6 text-sm leading-relaxed">
              Are you sure you want to completely remove this draft? This will permanently delete the project from the database and cannot be undone.
            </p>
            <div className="flex items-center gap-3 justify-end">
              <button
                type="button"
                disabled={deletingDraft}
                onClick={() => setDraftToDelete(null)}
                className="px-4 py-2 font-black text-xs uppercase tracking-widest text-slate-500 hover:bg-slate-50 border border-slate-200 rounded-xl transition-all"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deletingDraft}
                onClick={async () => {
                  setDeletingDraft(true);
                  try {
                    const { deleteProject } = useStore.getState();
                    await deleteProject(draftToDelete);
                    setActiveProject(null);
                    resetForm();
                    toast.success("Draft permanently deleted.");
                    setDraftToDelete(null);
                  } catch (err: any) {
                    toast.error(err.message || "Failed to delete project.");
                  } finally {
                    setDeletingDraft(false);
                  }
                }}
                className="flex items-center justify-center gap-2 px-4 py-2 font-black text-xs uppercase tracking-widest text-white bg-rose-600 hover:bg-rose-700 shadow-lg shadow-rose-200/50 rounded-xl transition-all min-w-[100px]"
              >
                {deletingDraft ? <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
