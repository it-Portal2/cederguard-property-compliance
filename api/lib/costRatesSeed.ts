// Technical Assurance Companion — Phase 6 cost rates seed.
//
// Q10=A locked: ~50 hand-seeded UK construction line items, council-editable
// after seed. Used by the insight prompt as guidance and by the Cost &
// programme tab UI as a benchmark backdrop. Rates are GBP and reflect
// rough mid-2026 social-housing refurb / Decent-Homes-style figures —
// they are NOT a SPON's licence and the footer copy on the tab makes
// that explicit (cross-check against the council's published schedule
// before issuing).
//
// Storage layout: top-level `costRates/{seed-rateId}` with `clientId: '__shared__'`
// for the seed library, OR `costRates/{clientId_rateId}` for council overrides.
// MVP loads the shared library on every read (one batch). When a council adds
// a custom rate via the admin editor (Phase 6b), it lives under their
// `clientId` and overrides any seed entry with the same rateId.

import type { ApiContext } from "./context.js";

export const COST_RATES_SHARED_CLIENT = "__shared__";

export type CostRateCategory =
  | "preliminaries"
  | "substructure"
  | "frame"
  | "me"
  | "finishes"
  | "external"
  | "fees";

export interface CostRate {
  rateId: string;
  clientId: string;
  category: CostRateCategory;
  description: string;
  unit: "m" | "m2" | "m3" | "no" | "hr" | "item";
  rate: number;
  currency: "GBP";
  source: "seed" | "spons-2026" | "custom";
  lastUpdated: string;
  lastUpdatedBy: string;
}

const SEED_RATES: Array<Omit<CostRate, "clientId" | "lastUpdated" | "lastUpdatedBy">> = [
  // Preliminaries
  { rateId: "prelim-site-setup", category: "preliminaries", description: "Site setup + welfare (1-bed flat refurb)", unit: "item", rate: 1200, currency: "GBP", source: "seed" },
  { rateId: "prelim-skip-6yard", category: "preliminaries", description: "Skip hire — 6yd³ mixed waste", unit: "item", rate: 320, currency: "GBP", source: "seed" },
  { rateId: "prelim-protection", category: "preliminaries", description: "Floor / fixture protection sheeting", unit: "m2", rate: 6, currency: "GBP", source: "seed" },
  { rateId: "prelim-scaffold-1lift", category: "preliminaries", description: "Independent scaffold — 1 lift, 4 weeks", unit: "m2", rate: 38, currency: "GBP", source: "seed" },
  { rateId: "prelim-asbestos-survey", category: "preliminaries", description: "R&D asbestos survey (per dwelling)", unit: "item", rate: 480, currency: "GBP", source: "seed" },

  // Substructure
  { rateId: "sub-strip-found", category: "substructure", description: "Strip foundation (600×300 conc)", unit: "m", rate: 145, currency: "GBP", source: "seed" },
  { rateId: "sub-dpc-injection", category: "substructure", description: "Chemical DPC injection (per linear metre)", unit: "m", rate: 65, currency: "GBP", source: "seed" },
  { rateId: "sub-concrete-slab", category: "substructure", description: "Ground-bearing concrete slab (150mm + insulation + DPM)", unit: "m2", rate: 95, currency: "GBP", source: "seed" },

  // Frame
  { rateId: "frame-sw-stud", category: "frame", description: "Softwood stud partition (75×50mm @ 600 c/c)", unit: "m2", rate: 42, currency: "GBP", source: "seed" },
  { rateId: "frame-mf-ceiling", category: "frame", description: "MF ceiling framing 60×27 metal section", unit: "m2", rate: 26, currency: "GBP", source: "seed" },
  { rateId: "frame-bulkhead", category: "frame", description: "Bulkhead framing + 2×12.5mm board boxing", unit: "m", rate: 78, currency: "GBP", source: "seed" },
  { rateId: "frame-steel-rsj", category: "frame", description: "RSJ install (ground-floor opening, ≤3m span)", unit: "no", rate: 1850, currency: "GBP", source: "seed" },

  // Mechanical & electrical
  { rateId: "me-mvhr-install", category: "me", description: "MVHR system — install per dwelling (PAS 2035)", unit: "item", rate: 4500, currency: "GBP", source: "seed" },
  { rateId: "me-mvhr-duct", category: "me", description: "MVHR rigid ducting (per linear metre, insulated)", unit: "m", rate: 38, currency: "GBP", source: "seed" },
  { rateId: "me-mvhr-commission", category: "me", description: "MVHR commissioning + balancing (PAS 2035)", unit: "item", rate: 380, currency: "GBP", source: "seed" },
  { rateId: "me-cwall-rewire-1bed", category: "me", description: "Full rewire — 1-bed flat (BS 7671)", unit: "item", rate: 3800, currency: "GBP", source: "seed" },
  { rateId: "me-cwall-rewire-3bed", category: "me", description: "Full rewire — 3-bed house (BS 7671)", unit: "item", rate: 5800, currency: "GBP", source: "seed" },
  { rateId: "me-consumer-unit", category: "me", description: "RCD consumer unit replacement (18th edition)", unit: "no", rate: 720, currency: "GBP", source: "seed" },
  { rateId: "me-smoke-alarm-grade-d", category: "me", description: "Smoke alarm — Grade D BS 5839-6 (mains + battery)", unit: "no", rate: 145, currency: "GBP", source: "seed" },
  { rateId: "me-co-alarm", category: "me", description: "CO alarm (mains-linked, sealed battery)", unit: "no", rate: 95, currency: "GBP", source: "seed" },
  { rateId: "me-boiler-combi-30kw", category: "me", description: "Combi boiler replacement — 30 kW", unit: "no", rate: 2850, currency: "GBP", source: "seed" },
  { rateId: "me-radiator-double", category: "me", description: "Type 22 double radiator (1200×600) + valves", unit: "no", rate: 240, currency: "GBP", source: "seed" },

  // Fire-stopping (criticality high — Awaab's Law / BSA 2022 / ADB)
  { rateId: "fire-stop-penetration", category: "me", description: "Fire-stopping — service penetration (≤100mm dia)", unit: "no", rate: 45, currency: "GBP", source: "seed" },
  { rateId: "fire-stop-linear-gap", category: "me", description: "Fire-stopping — linear gap seal (60 min)", unit: "m", rate: 28, currency: "GBP", source: "seed" },
  { rateId: "fire-door-fd30", category: "me", description: "FD30s fire door + frame (cert + ironmongery)", unit: "no", rate: 580, currency: "GBP", source: "seed" },
  { rateId: "fire-door-fd60", category: "me", description: "FD60s fire door + frame (HRB compartment)", unit: "no", rate: 920, currency: "GBP", source: "seed" },
  { rateId: "fire-intumescent-strip", category: "me", description: "Intumescent strip + cold smoke seal retrofit", unit: "no", rate: 65, currency: "GBP", source: "seed" },

  // Finishes
  { rateId: "finishes-pb-12mm", category: "finishes", description: "Plasterboard 12.5mm + 2-coat skim", unit: "m2", rate: 32, currency: "GBP", source: "seed" },
  { rateId: "finishes-pb-fireline-15mm", category: "finishes", description: "Plasterboard 15mm Fireline + 2-coat skim", unit: "m2", rate: 42, currency: "GBP", source: "seed" },
  { rateId: "finishes-tape-fill", category: "finishes", description: "Tape + fill joints (no skim, painted finish)", unit: "m2", rate: 12, currency: "GBP", source: "seed" },
  { rateId: "finishes-paint-2coat", category: "finishes", description: "Emulsion paint — mist + 2 coats (walls)", unit: "m2", rate: 14, currency: "GBP", source: "seed" },
  { rateId: "finishes-skirting-mdf", category: "finishes", description: "MDF skirting 18×95mm — supply + fix + paint", unit: "m", rate: 18, currency: "GBP", source: "seed" },
  { rateId: "finishes-architrave", category: "finishes", description: "MDF architrave to door — supply + fix + paint", unit: "no", rate: 95, currency: "GBP", source: "seed" },
  { rateId: "finishes-internal-door", category: "finishes", description: "Internal door + frame + ironmongery (non-fire)", unit: "no", rate: 350, currency: "GBP", source: "seed" },
  { rateId: "finishes-laminate-floor", category: "finishes", description: "Laminate flooring 8mm + underlay", unit: "m2", rate: 38, currency: "GBP", source: "seed" },
  { rateId: "finishes-vinyl-floor", category: "finishes", description: "Cushioned vinyl flooring (commercial-grade)", unit: "m2", rate: 32, currency: "GBP", source: "seed" },
  { rateId: "finishes-tiles-wall", category: "finishes", description: "Wall tiling — std ceramic 200×250 incl adhesive + grout", unit: "m2", rate: 78, currency: "GBP", source: "seed" },
  { rateId: "finishes-kitchen-mid", category: "finishes", description: "Kitchen replacement — mid-range (incl plinths, worktop, splash)", unit: "item", rate: 6800, currency: "GBP", source: "seed" },
  { rateId: "finishes-bathroom-full", category: "finishes", description: "Full bathroom replacement (white suite, tiles, extract)", unit: "item", rate: 5400, currency: "GBP", source: "seed" },

  // External works
  { rateId: "ext-window-double", category: "external", description: "uPVC casement window (double-glazed, A-rated)", unit: "m2", rate: 425, currency: "GBP", source: "seed" },
  { rateId: "ext-front-door", category: "external", description: "Composite front door (PAS 24) — supply + fit", unit: "no", rate: 1400, currency: "GBP", source: "seed" },
  { rateId: "ext-roof-recover", category: "external", description: "Pitched roof recover — concrete tiles + felt + battens", unit: "m2", rate: 145, currency: "GBP", source: "seed" },
  { rateId: "ext-loft-insulation", category: "external", description: "Loft insulation 270mm (PAS 2035 compliant)", unit: "m2", rate: 18, currency: "GBP", source: "seed" },
  { rateId: "ext-cwi", category: "external", description: "Cavity wall insulation (PAS 2035, retrofit)", unit: "m2", rate: 22, currency: "GBP", source: "seed" },
  { rateId: "ext-ewi", category: "external", description: "External wall insulation system (90mm + render, PAS 2035)", unit: "m2", rate: 165, currency: "GBP", source: "seed" },

  // Fees + soft costs
  { rateId: "fee-architect-stage4", category: "fees", description: "Architect — Stage 4 fee (% of construction cost)", unit: "item", rate: 4500, currency: "GBP", source: "seed" },
  { rateId: "fee-structural-eng", category: "fees", description: "Structural engineer — small-works calc package", unit: "item", rate: 1200, currency: "GBP", source: "seed" },
  { rateId: "fee-bsr-gateway2", category: "fees", description: "BSR Gateway 2 application fee + duty-holder pack", unit: "item", rate: 6500, currency: "GBP", source: "seed" },
  { rateId: "fee-cdm-pd", category: "fees", description: "CDM Principal Designer fee (small-works package)", unit: "item", rate: 1800, currency: "GBP", source: "seed" },
  { rateId: "fee-clerk-of-works", category: "fees", description: "Clerk of Works — visit (per day, incl report)", unit: "hr", rate: 480, currency: "GBP", source: "seed" },
  { rateId: "fee-air-test", category: "fees", description: "Air permeability test (per dwelling)", unit: "item", rate: 280, currency: "GBP", source: "seed" },
];

/**
 * Idempotently seeds the shared cost rates library on first call. Subsequent
 * calls are cheap probes — same pattern as `seedRegulationsCorpusIfMissing`.
 */
export async function seedCostRatesIfMissing(ctx: ApiContext): Promise<void> {
  // Probe — if any seed-source row exists for the shared client, skip.
  const probe = await ctx.db
    .collection("costRates")
    .where("clientId", "==", COST_RATES_SHARED_CLIENT)
    .limit(1)
    .get();
  if (!probe.empty) return;

  const now = new Date().toISOString();
  let batch = ctx.db.batch();
  let opsInBatch = 0;
  for (const r of SEED_RATES) {
    const docId = `${COST_RATES_SHARED_CLIENT}_${r.rateId}`;
    const ref = ctx.db.collection("costRates").doc(docId);
    batch.set(ref, {
      ...r,
      clientId: COST_RATES_SHARED_CLIENT,
      lastUpdated: now,
      lastUpdatedBy: "system",
    });
    opsInBatch++;
    if (opsInBatch >= 400) {
      await batch.commit();
      batch = ctx.db.batch();
      opsInBatch = 0;
    }
  }
  if (opsInBatch > 0) {
    await batch.commit();
  }
}

/**
 * Loads the merged cost-rates library for a tenant: shared seed set unioned
 * with the council's own custom rates. Custom rates with the same rateId
 * shadow seeds. Returns sorted by category then description for stable UI.
 */
export async function loadCostRates(ctx: ApiContext): Promise<CostRate[]> {
  const [sharedSnap, ownSnap] = await Promise.all([
    ctx.db
      .collection("costRates")
      .where("clientId", "==", COST_RATES_SHARED_CLIENT)
      .get(),
    ctx.db
      .collection("costRates")
      .where("clientId", "==", ctx.primaryUid)
      .get(),
  ]);
  const merged = new Map<string, CostRate>();
  for (const d of sharedSnap.docs) {
    const data = d.data() as CostRate;
    merged.set(data.rateId, data);
  }
  for (const d of ownSnap.docs) {
    const data = d.data() as CostRate;
    merged.set(data.rateId, data);
  }
  return Array.from(merged.values()).sort((a, b) => {
    if (a.category !== b.category) return a.category.localeCompare(b.category);
    return a.description.localeCompare(b.description);
  });
}
