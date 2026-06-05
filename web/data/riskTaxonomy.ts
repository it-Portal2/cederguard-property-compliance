/**
 * ID-Based Risk Taxonomy
 *
 * Production-grade taxonomy system for risk categories and workstreams.
 * Principles:
 * - IDs are immutable once assigned
 * - Names can change without data migration
 * - New entries are append-only
 * - IDs include type prefix for clarity
 */

// ==========================================
// CATEGORY TAXONOMY
// ==========================================

export const CATEGORY_TAXONOMY = {
  // === STRATEGIC PROGRAMME CATEGORIES (AI-Generated) ===
  "cat-gov-001": {
    name: "Governance & Decision-Making Risk",
    type: "strategic",
  },
  "cat-scale-001": {
    name: "Programme Scale & Complexity Risk",
    type: "strategic",
  },
  "cat-cap-001": { name: "Delivery Capacity Risk", type: "strategic" },
  "cat-supply-001": { name: "Supply Chain & Market Risk", type: "strategic" },
  "cat-land-001": { name: "Land & Site Risk", type: "strategic" },
  "cat-plan-001": { name: "Planning & Regulatory Risk", type: "strategic" },
  "cat-env-001": {
    name: "Environmental & Sustainability Risk",
    type: "strategic",
  },
  "cat-res-001": {
    name: "Resident & Stakeholder Impact Risk",
    type: "strategic",
  },
  "cat-fund-001": { name: "Funding & Financial Risk", type: "strategic" },
  "cat-dep-001": { name: "Dependent Project Risk", type: "strategic" },
  "cat-sched-001": {
    name: "Schedule & Delivery Pressure Risk",
    type: "strategic",
  },
  "cat-hand-001": {
    name: "Operational Readiness & Handover Risk",
    type: "strategic",
  },

  // === OPERATIONAL CATEGORIES (Manual/User-Created) ===
  "cat-fin-001": { name: "Finance / Financial", type: "operational" },
  "cat-build-001": { name: "Building Safety", type: "operational" },
  "cat-hse-001": { name: "Health & Safety", type: "operational" },
  "cat-proc-001": { name: "Procurement", type: "operational" },
  "cat-plan-op-001": { name: "Planning", type: "operational" }, // Distinct from strategic
  "cat-env-op-001": { name: "Environmental", type: "operational" },
  "cat-legal-001": { name: "Legal / Regulatory", type: "operational" },
  "cat-rep-001": { name: "Reputational", type: "operational" },
  "cat-tech-001": { name: "Technical", type: "operational" },
  "cat-ops-001": { name: "Operational", type: "operational" },
  "cat-strat-001": { name: "Strategic", type: "operational" },
  "cat-shr-001": { name: "Social Housing Regulation", type: "operational" },
} as const;

export type CategoryId = keyof typeof CATEGORY_TAXONOMY;

// ==========================================
// WORKSTREAM TAXONOMY
// ==========================================

export const WORKSTREAM_TAXONOMY = {
  // Strategic (AI Programme Risks)
  "ws-prog-strat": { name: "Programme Strategic", type: "strategic" },

  // Operational (Manual/All Contexts)
  "ws-res": { name: "Resourcing", type: "operational" },
  "ws-fin": { name: "Finance", type: "operational" },
  "ws-delivery": { name: "Programme Delivery", type: "operational" },
  "ws-build": { name: "Building Safety", type: "operational" },
  "ws-fire": { name: "Fire Safety", type: "operational" },
  "ws-plan": { name: "Planning", type: "operational" },
  "ws-proc": { name: "Procurement", type: "operational" },
  "ws-env": { name: "Environmental", type: "operational" },
  "ws-stake": { name: "Stakeholder", type: "operational" },
  "ws-tech": { name: "Technical", type: "operational" },
  "ws-qual": { name: "Quality", type: "operational" },
  "ws-legal": { name: "Legal", type: "operational" },
  "ws-corp": { name: "Corporate Risk", type: "operational" },
  "ws-rep": { name: "Reputational", type: "operational" },
} as const;

export type WorkstreamId = keyof typeof WORKSTREAM_TAXONOMY;

// ==========================================
// LOOKUP FUNCTIONS
// ==========================================

/** Get display name for category ID */
export const getCategoryName = (id: CategoryId | string): string => {
  return CATEGORY_TAXONOMY[id as CategoryId]?.name || id;
};

/** Get display name for workstream ID */
export const getWorkstreamName = (id: WorkstreamId | string): string => {
  return WORKSTREAM_TAXONOMY[id as WorkstreamId]?.name || id;
};

/** Get category ID from name (reverse lookup with legacy support) */
export const getCategoryId = (name: string): CategoryId | string => {
  // First check legacy mappings
  if (LEGACY_CATEGORY_MAP[name]) {
    return LEGACY_CATEGORY_MAP[name];
  }
  // Then check exact match in taxonomy
  const entry = Object.entries(CATEGORY_TAXONOMY).find(
    ([, data]) => data.name === name,
  );
  return entry?.[0] || name;
};

/** Get workstream ID from name (reverse lookup with legacy support) */
export const getWorkstreamId = (name: string): WorkstreamId | string => {
  // First check legacy mappings
  if (LEGACY_WORKSTREAM_MAP[name]) {
    return LEGACY_WORKSTREAM_MAP[name];
  }
  // Then check exact match in taxonomy
  const entry = Object.entries(WORKSTREAM_TAXONOMY).find(
    ([, data]) => data.name === name,
  );
  return entry?.[0] || name;
};

// ==========================================
// LEGACY NAME MAPPINGS (for data migration)
// ==========================================

/** Maps legacy/short category names to proper IDs */
const LEGACY_CATEGORY_MAP: Record<string, CategoryId> = {
  // Direct mappings
  Safety: "cat-hse-001", // Health & Safety
  Financial: "cat-fin-001", // Finance / Financial
  Regulatory: "cat-legal-001", // Legal / Regulatory
  Environmental: "cat-env-op-001", // Environmental
  Procurement: "cat-proc-001", // Procurement
  Planning: "cat-plan-op-001", // Planning
  Technical: "cat-tech-001", // Technical
  Reputational: "cat-rep-001", // Reputational
  Strategic: "cat-strat-001", // Strategic
  Operational: "cat-ops-001", // Operational
  "Building Safety": "cat-build-001", // Building Safety
  "Social Housing Regulation": "cat-shr-001", // Social Housing Regulation
  // Additional variations
  Finance: "cat-fin-001",
  "H&S": "cat-hse-001",
  "Health and Safety": "cat-hse-001",
  Legal: "cat-legal-001",
  Compliance: "cat-legal-001",
  Resident: "cat-res-001", // Map to strategic Resident & Stakeholder
  Stakeholder: "cat-res-001",
  Resource: "cat-cap-001", // Map to strategic Delivery Capacity
  Capacity: "cat-cap-001",
  Programme: "cat-strat-001", // Generic programme-related
  Schedule: "cat-sched-001", // Schedule & Delivery Pressure
  Timeline: "cat-sched-001",
  Governance: "cat-gov-001", // Governance & Decision-Making
  Scale: "cat-scale-001", // Programme Scale & Complexity
  Complexity: "cat-scale-001",
  Supply: "cat-supply-001", // Supply Chain & Market
  "Supply Chain": "cat-supply-001",
  Land: "cat-land-001", // Land & Site
  Site: "cat-land-001",
  "Planning & Regulatory": "cat-plan-001", // Strategic planning
  Sustainability: "cat-env-001", // Environmental & Sustainability (strategic)
  Funding: "cat-fund-001", // Funding & Financial
  Dependencies: "cat-dep-001", // Dependent Project
  Handover: "cat-hand-001", // Operational Readiness & Handover
};

/** Maps legacy/short workstream names to proper IDs */
const LEGACY_WORKSTREAM_MAP: Record<string, WorkstreamId> = {
  // Direct mappings
  Resourcing: "ws-res",
  Finance: "ws-fin",
  "Programme Delivery": "ws-delivery",
  "Building Safety": "ws-build",
  "Fire Safety": "ws-fire",
  Planning: "ws-plan",
  Procurement: "ws-proc",
  Environmental: "ws-env",
  Stakeholder: "ws-stake",
  Technical: "ws-tech",
  Quality: "ws-qual",
  Legal: "ws-legal",
  "Corporate Risk": "ws-corp",
  Reputational: "ws-rep",
  "Programme Strategic": "ws-prog-strat",
  // Additional variations
  Programme: "ws-delivery",
  Delivery: "ws-delivery",
  Safety: "ws-build", // Default to Building Safety
  "H&S": "ws-fire", // Health & Safety → Fire Safety as closest match
  "Health & Safety": "ws-fire",
  Compliance: "ws-legal",
  Contract: "ws-proc",
  "Supply Chain": "ws-proc",
  Community: "ws-stake",
  Resident: "ws-stake",
  Engineering: "ws-tech",
  Construction: "ws-tech",
  // Legacy project-level workstreams from seed data
  "Building Safety Compliance": "ws-build",
  "Project Planning & Delivery": "ws-delivery",
  "Resident Engagement": "ws-stake",
  "Procurement & Supply Chain": "ws-proc",
  "Financial Management": "ws-fin",
  "Health & Safety Management": "ws-fire",
  "Statutory Approvals": "ws-plan",
  "Environmental Management": "ws-env",
  "Fire Safety Management": "ws-fire",
  "Project Governance": "ws-delivery",
  "Regulatory Compliance": "ws-legal",
};

// ==========================================
// BACKWARD COMPATIBILITY
// ==========================================

/** All category names for dropdowns (existing code compatible) */
export const CATEGORIES = Object.values(CATEGORY_TAXONOMY).map((d) => d.name);

/** All workstream names for dropdowns (existing code compatible) */
export const WORKSTREAMS = Object.values(WORKSTREAM_TAXONOMY).map(
  (d) => d.name,
);

/** Strategic categories only (for AI context) */
export const STRATEGIC_CATEGORIES = Object.entries(CATEGORY_TAXONOMY)
  .filter(([, data]) => data.type === "strategic")
  .map(([id, data]) => ({ id, name: data.name }));

/** Operational categories only (for manual context) */
export const OPERATIONAL_CATEGORIES = Object.entries(CATEGORY_TAXONOMY)
  .filter(([, data]) => data.type === "operational")
  .map(([id, data]) => ({ id, name: data.name }));

/** Strategic category names only (for programme dropdowns) */
export const STRATEGIC_CATEGORY_NAMES = Object.entries(CATEGORY_TAXONOMY)
  .filter(([, data]) => data.type === "strategic")
  .map(([, data]) => data.name);

/** Operational category names only (for project dropdowns) */
export const OPERATIONAL_CATEGORY_NAMES = Object.entries(CATEGORY_TAXONOMY)
  .filter(([, data]) => data.type === "operational")
  .map(([, data]) => data.name);

/** Strategic workstreams only (for programme dropdowns) */
export const STRATEGIC_WORKSTREAMS = Object.entries(WORKSTREAM_TAXONOMY)
  .filter(([, data]) => data.type === "strategic")
  .map(([, data]) => data.name);

/** Operational workstreams only (for project dropdowns) */
export const OPERATIONAL_WORKSTREAMS = Object.entries(WORKSTREAM_TAXONOMY)
  .filter(([, data]) => data.type === "operational")
  .map(([, data]) => data.name);

// ==========================================
// VALIDATION
// ==========================================

/** Check if category ID is valid */
export const isValidCategoryId = (id: string): id is CategoryId => {
  return id in CATEGORY_TAXONOMY;
};

/** Check if workstream ID is valid */
export const isValidWorkstreamId = (id: string): id is WorkstreamId => {
  return id in WORKSTREAM_TAXONOMY;
};

/** Check if category is strategic */
export const isStrategicCategory = (id: CategoryId | string): boolean => {
  return CATEGORY_TAXONOMY[id as CategoryId]?.type === "strategic";
};

/** Check if workstream is strategic */
export const isStrategicWorkstream = (id: WorkstreamId | string): boolean => {
  return WORKSTREAM_TAXONOMY[id as WorkstreamId]?.type === "strategic";
};
