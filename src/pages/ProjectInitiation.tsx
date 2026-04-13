import React, { useState, useEffect, useCallback } from "react";
import { useNavigate, useParams, useLocation, Link } from "react-router";
import { api } from "../lib/api";
import { useStore, TeamMember } from "../store/useStore";
import { isAtLeastPM, isSuperAdmin, isAtLeastClientAdmin } from "../lib/roles";
import { Save, CheckCircle2, Info, LayoutTemplate, UserCircle, Rocket, ChevronRight, AlertCircle, Shield, Trash2, ScanSearch, AlertTriangle, Plus } from 'lucide-react';
import { clsx } from "clsx";
import { stripMarkdown } from "../lib/utils";
import { RIBA_STAGES } from "../constants/ribaStages";
import { calculateProjectProgress } from "../lib/progress";
import { ProgrammeMilestone } from "../store/useStore";
import { toast } from "react-hot-toast";

import { PublicationChecklist } from "../components/PublicationChecklist";
import { DeliveryTeamCRUD } from "../components/DeliveryTeamCRUD";

// ─── Main Page ────────────────────────────────────────────────────────────────
export function ProjectInitiation() {
  const navigate = useNavigate();
  const { id: urlProjectId } = useParams();
  const {
    setActiveProject,
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
      projectManagerId: user?.email || "",
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
    projectManagerId: user?.email || "",
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
    milestones: [...defaultMilestones],
    deliveryTeam: [],
    deliveryTeamDone: false,
  });

  const { pathname } = useLocation();

  // Effect to handle URL parameters for editing or new mode
  useEffect(() => {
    const isNewRoute =
      pathname.includes("/projects/new") || pathname === "/initiate";

    if (urlProjectId) {
      setActiveProject(urlProjectId);
      loadProjectData(urlProjectId);

      const p = (Array.isArray(projects) ? projects : []).find(
        (proj) => proj.id === urlProjectId,
      );
      if (p) {
        setFormData({
          name: p.name || "",
          type: p.type || p.schemeType || "",
          loc: p.loc || "",
          description: p.scope || p.description || "",
          status: p.status || "Active",
          programmeId: p.programmeId || "",
          projectManagerId: p.projectManagerId || p.pmId || user?.email || "",
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
          milestones: p.milestones || [],
          deliveryTeam: Array.isArray(p.deliveryTeam) ? p.deliveryTeam : [],
          deliveryTeamDone: !!p.deliveryTeamDone,
        });
        setIsDirty(false);
      }
    } else if (isNewRoute) {
      setActiveProject(null);
      resetForm();
    } else if (activeProjectId && !urlProjectId) {
      loadProjectData(activeProjectId);
      const p = (Array.isArray(projects) ? projects : []).find(
        (proj) => proj.id === activeProjectId,
      );
      if (p) {
        setFormData({
          name: p.name || "",
          type: p.type || p.schemeType || "",
          loc: p.loc || "",
          description: p.scope || p.description || "",
          status: p.status || "Active",
          programmeId: p.programmeId || "",
          projectManagerId: p.projectManagerId || p.pmId || user?.email || "",
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
          milestones: p.milestones || [],
          deliveryTeam: Array.isArray(p.deliveryTeam) ? p.deliveryTeam : [],
          deliveryTeamDone: !!p.deliveryTeamDone,
        });
        setIsDirty(false);
      }
      // Don't reset form if project not found - it might be loading
    } else if (!activeProjectId) {
      resetForm();
    }
  }, [urlProjectId, activeProjectId, projects, pathname]);

  // Fetch projects on mount if empty
  useEffect(() => {
    const fetchProjectsIfEmpty = async () => {
      if (!Array.isArray(projects) || projects.length === 0) {
        try {
          const fetchFn = [
            "admin",
            "pro",
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
  const [loadingPMs, setLoadingPMs] = useState(false);
  const userRole = (user as any)?.role;

  useEffect(() => {
    if (user && !isAtLeastPM(userRole)) navigate("/projects");
  }, [user, userRole, navigate]);

  // Ensure PM receives a non-empty PM id on blank initiation
  useEffect(() => {
    if (user?.email && !formData.projectManagerId && !activeProjectId) {
      setFormData(prev => ({ ...prev, projectManagerId: user.email! }));
    }
  }, [user?.email, formData.projectManagerId, activeProjectId]);

  useEffect(() => {
    const fetchPMs = async () => {
      setLoadingPMs(true);
      try {
        const res = await api.getAssignablePMs();
        if (res.success) setAssignablePMs(res.users || []);
      } catch (err: any) {
        // Silently ignore 403 - user doesn't have permission (expected for regular PMs)
        // This allows backend permission changes to work automatically
        if (err.status !== 403) {
          console.error("Failed to fetch PMs:", err);
        }
        setAssignablePMs([]);
      } finally {
        setLoadingPMs(false);
      }
    };
    fetchPMs();
  }, []);

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

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!requiredDone) {
      toast.error("Please fill all required fields.");
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
            "pro",
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
        setupProgress: 100,
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
        {/* Reference Tools */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          <Link
            to="/tools/compliance-profiler"
            className="flex items-center gap-4 p-4 bg-white border border-slate-200 rounded-2xl hover:border-indigo-300 hover:shadow-lg transition-all group"
          >
            <div className="w-12 h-12 rounded-xl bg-indigo-50 flex items-center justify-center group-hover:bg-indigo-600 transition-colors">
              <Shield className="w-6 h-6 text-indigo-600 group-hover:text-white" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 leading-tight">
                Compliance Profiler
              </h3>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Interactive guide to determine required compliance domains.
              </p>
            </div>
          </Link>
          <Link
            to="/tools/risk-identifier"
            className="flex items-center gap-4 p-4 bg-white border border-slate-200 rounded-2xl hover:border-amber-300 hover:shadow-lg transition-all group"
          >
            <div className="w-12 h-12 rounded-xl bg-amber-50 flex items-center justify-center group-hover:bg-amber-500 transition-colors">
              <AlertTriangle className="w-6 h-6 text-amber-500 group-hover:text-white" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 leading-tight">
                Risk Identifier
              </h3>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Industry-standard risk library and mitigation reference.
              </p>
            </div>
          </Link>
        </div>

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
                                milestones: p.milestones || [],
                                deliveryTeam: Array.isArray(p.deliveryTeam)
                                  ? p.deliveryTeam
                                  : [],
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
                          <option>
                            New Build – Higher-Risk Building (HRB)
                          </option>
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
                      <label className={labelCls}>
                        Assigned Project Manager{" "}
                        <span className="text-rose-500 ml-0.5">*</span>
                      </label>
                      <select
                        className={inputCls}
                        value={formData.projectManagerId}
                        onChange={(e) => set("projectManagerId", e.target.value)}
                        disabled={!isAtLeastClientAdmin(userRole) && assignablePMs.length === 0}
                        required
                      >
                        <option value="">— Select PM —</option>
                        {assignablePMs.map((pm) => (
                          <option key={pm.uid || pm.email} value={pm.email}>
                            {pm.displayName || pm.email}
                          </option>
                        ))}
                        {/* Fallback if user is not in the assignable list but is set */}
                        {formData.projectManagerId && !assignablePMs.find(pm => pm.email === formData.projectManagerId) && (
                          <option value={formData.projectManagerId}>{user?.displayName || formData.projectManagerId}</option>
                        )}
                      </select>
                    </div>

                    <div>
                      <label className={labelCls}>Associated Programme</label>
                      <select
                        className={inputCls}
                        value={formData.programmeId}
                        onChange={(e) => set("programmeId", e.target.value)}
                      >
                        <option value="">— Independent Project —</option>
                        {(Array.isArray(programmes) ? programmes : []).map(
                          (p) => (
                            <option key={p.id} value={p.id}>
                              {p.name}
                            </option>
                          ),
                        )}
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
