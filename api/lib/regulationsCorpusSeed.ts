// Technical Assurance Companion — Regulations Corpus seed.
//
// Hand-curated v1 corpus (Q1=B locked) — ~10 most-cited clauses across
// Approved Documents (Building Regulations), BSA 2022, PAS 2035, Awaab's
// Law, CDM 2015, RSH Consumer Standards. Seeded on first read of the
// corpus collection. Promoted from the existing static
// `src/data/regulationsLibraryData.ts` shape so the AI corpus refreshes
// independently of code deploys (Phase 10 cron extends this).
//
// Every cited regulation in an AI insight MUST resolve back to one of these
// regIds — that's how PRD US-2.2 enforces "no citation, no insight" + "no
// hallucinated regulations".

import type { ApiContext } from "./context.js";

export interface RegulationCorpusEntry {
  regId: string;
  document:
    | "adb-vol1"
    | "adb-vol2"
    | "adk"
    | "bsa-2022"
    | "pas-2035"
    | "awaabs-law"
    | "cdm-2015"
    | "rsh-cs"
    | "gt-guidance";
  documentLabel: string;
  clause: string;
  text: string;
  source: { url: string; documentVersion: string; verifiedAt: string };
  appliesTo?: string[];
  ribaRelevance?: ("S0" | "S1" | "S2" | "S3" | "S4" | "S5" | "S6" | "S7")[];
}

const VERIFIED_AT = "2026-05-06";

export const SEED_CORPUS: RegulationCorpusEntry[] = [
  {
    regId: "adb-vol1-2.25",
    document: "adb-vol1",
    documentLabel: "Approved Document B Vol. 1 (Fire Safety — Dwellings)",
    clause: "2.25",
    text: "A firefighting shaft is required in dwellings whose top storey is more than 18 m above ground level, or whose top storey contains habitable rooms more than 11 m above ground level (in HRBs). The shaft should contain a firefighting lift, a firefighting stair and a firefighting lobby.",
    source: {
      url: "https://www.gov.uk/government/publications/fire-safety-approved-document-b",
      documentVersion: "2019 ed., incorporating 2022 amendments",
      verifiedAt: VERIFIED_AT,
    },
    appliesTo: ["fire", "firefighting-shaft", "stair", "tall-buildings"],
    ribaRelevance: ["S2", "S3", "S4"],
  },
  {
    regId: "adb-vol1-11",
    document: "adb-vol1",
    documentLabel: "Approved Document B Vol. 1 (Fire Safety — Dwellings)",
    clause: "11",
    text: "Internal fire spread (linings) — wall and ceiling linings should adequately resist the spread of flame over their surfaces and have a rate of heat release that is reasonable in the circumstances. Compartmentation of dwellings: every wall and floor common to two dwellings should be a compartment wall or compartment floor with a minimum 60 minutes fire-resistance rating.",
    source: {
      url: "https://www.gov.uk/government/publications/fire-safety-approved-document-b",
      documentVersion: "2019 ed., incorporating 2022 amendments",
      verifiedAt: VERIFIED_AT,
    },
    appliesTo: ["fire", "compartmentation", "linings", "frr"],
    ribaRelevance: ["S3", "S4", "S5"],
  },
  {
    regId: "adb-vol2-b3",
    document: "adb-vol2",
    documentLabel:
      "Approved Document B Vol. 2 (Fire Safety — Buildings other than Dwellings)",
    clause: "B3",
    text: "The building shall be designed and constructed so that, in the event of fire, its stability will be maintained for a reasonable period. Compartment walls and floors shall maintain integrity for the period appropriate to the building's purpose group and height.",
    source: {
      url: "https://www.gov.uk/government/publications/fire-safety-approved-document-b",
      documentVersion: "2019 ed., incorporating 2022 amendments",
      verifiedAt: VERIFIED_AT,
    },
    appliesTo: ["fire", "compartmentation", "structural-stability"],
    ribaRelevance: ["S3", "S4", "S5"],
  },
  {
    regId: "adk-1.2",
    document: "adk",
    documentLabel:
      "Approved Document K (Protection from falling, collision and impact)",
    clause: "1.2",
    text: "Stairs in dwellings should have a minimum tread of 220 mm and maximum rise of 220 mm. The pitch of stairs should not exceed 42°. Headroom over the whole of a stair should be a minimum of 2.0 m measured vertically from the pitch line.",
    source: {
      url: "https://www.gov.uk/government/publications/protection-from-falling-collision-and-impact-approved-document-k",
      documentVersion: "2013 ed., incorporating 2024 amendments",
      verifiedAt: VERIFIED_AT,
    },
    appliesTo: ["stair", "geometry", "headroom"],
    ribaRelevance: ["S3", "S4"],
  },
  {
    regId: "bsa-2022-s27",
    document: "bsa-2022",
    documentLabel: "Building Safety Act 2022",
    clause: "Section 27 (Higher-risk buildings)",
    text: "The Act defines a higher-risk building (HRB) as a building of at least 18 metres in height or with at least 7 storeys, that contains at least 2 residential units. Gateway 2 and Gateway 3 approvals from the Building Safety Regulator are required at design and completion stages respectively. Each HRB must establish and maintain a Golden Thread of building information.",
    source: {
      url: "https://www.legislation.gov.uk/ukpga/2022/30",
      documentVersion: "as enacted, with 2023-2024 commencement orders",
      verifiedAt: VERIFIED_AT,
    },
    appliesTo: ["hrb", "gateway-2", "gateway-3", "golden-thread"],
    ribaRelevance: ["S2", "S3", "S4", "S5", "S6"],
  },
  {
    regId: "bsa-2022-gt",
    document: "gt-guidance",
    documentLabel:
      "Golden Thread — BSR guidance for Higher-Risk Buildings",
    clause: "Golden Thread Principles",
    text: "Information held in the Golden Thread should be accurate, up-to-date, accessible, secure, structured, presented in a usable way, and contain only verified content. The Accountable Person must demonstrate that the information will support residents' safety throughout the building's lifecycle.",
    source: {
      url: "https://www.gov.uk/guidance/the-golden-thread",
      documentVersion: "2024 update",
      verifiedAt: VERIFIED_AT,
    },
    appliesTo: ["golden-thread", "hrb", "information-management"],
    ribaRelevance: ["S2", "S3", "S4", "S5", "S6", "S7"],
  },
  {
    regId: "pas-2035-7.3",
    document: "pas-2035",
    documentLabel: "PAS 2035:2023 — Retrofitting dwellings for improved energy efficiency",
    clause: "7.3 Risk-based assessment",
    text: "A whole-dwelling assessment shall be carried out by a Retrofit Assessor before work begins. The assessment shall identify constraints, condition issues, and risks associated with proposed measures. A Retrofit Coordinator must oversee the project from start to handover.",
    source: {
      url: "https://www.bsigroup.com/en-GB/standards/PAS-2035",
      documentVersion: "2023 edition",
      verifiedAt: VERIFIED_AT,
    },
    appliesTo: ["retrofit", "decarbonisation", "assessment"],
    ribaRelevance: ["S1", "S2", "S3"],
  },
  {
    regId: "awaabs-law-1",
    document: "awaabs-law",
    documentLabel: "Awaab's Law (Social Housing (Regulation) Act 2023, Section 42)",
    clause: "Hazard response timescales",
    text: "Registered providers of social housing must investigate reports of hazards (including damp and mould) within 14 days, begin remedial work within 7 days of identifying a hazard, and complete repairs within a reasonable period given the nature of the hazard.",
    source: {
      url: "https://www.legislation.gov.uk/ukpga/2023/36",
      documentVersion: "as enacted, plus 2024 implementing regulations",
      verifiedAt: VERIFIED_AT,
    },
    appliesTo: ["damp", "mould", "rsh", "social-housing", "hazard"],
    ribaRelevance: ["S6", "S7"],
  },
  {
    regId: "cdm-2015-r4",
    document: "cdm-2015",
    documentLabel: "Construction (Design and Management) Regulations 2015",
    clause: "Regulation 4 — Client duties",
    text: "Clients shall make suitable arrangements for managing a project, including the allocation of sufficient time and resources. The arrangements are suitable if they ensure the construction work can be carried out, so far as is reasonably practicable, without risks to health and safety. The client must appoint a Principal Designer and Principal Contractor where more than one contractor is involved.",
    source: {
      url: "https://www.legislation.gov.uk/uksi/2015/51",
      documentVersion: "2015, current at 2026",
      verifiedAt: VERIFIED_AT,
    },
    appliesTo: ["cdm", "client", "principal-designer", "h&s"],
    ribaRelevance: ["S0", "S1", "S2", "S3", "S4", "S5"],
  },
  {
    regId: "rsh-cs-tsm-1",
    document: "rsh-cs",
    documentLabel: "RSH Consumer Standards — Transparency, Influence and Accountability",
    clause: "TSM 1 — Stock condition and tenant safety",
    text: "Registered providers must have an accurate and up-to-date understanding of the condition of their stock that supports effective and timely decision-making and risk management. Information must be sufficient to assess each property's compliance with applicable regulations including fire, electrical, gas, water, asbestos and lift safety.",
    source: {
      url: "https://www.gov.uk/government/collections/regulator-of-social-housing-consumer-standards",
      documentVersion: "April 2024",
      verifiedAt: VERIFIED_AT,
    },
    appliesTo: ["rsh", "stock-condition", "compliance", "tenant-safety"],
    ribaRelevance: ["S6", "S7"],
  },
];

/**
 * Idempotent platform-wide seed. Returns silently if any corpus entry
 * already exists. Cheaper than a transaction (lesson #22). Best-effort —
 * failures are logged but do not abort the caller's response.
 *
 * Note: corpus is platform-wide (NOT scoped per clientId) — the same
 * regulations apply to every council. The Phase 10 quarterly refresh cron
 * extends this same shape.
 */
export async function seedRegulationsCorpusIfMissing(
  ctx: ApiContext,
): Promise<void> {
  try {
    const probe = await ctx.db
      .collection("regulationsCorpus")
      .limit(1)
      .get();
    if (!probe.empty) return;
    const batch = ctx.db.batch();
    for (const entry of SEED_CORPUS) {
      const ref = ctx.db.collection("regulationsCorpus").doc(entry.regId);
      batch.set(ref, entry);
    }
    await batch.commit();
  } catch (e) {
    console.warn("[seedRegulationsCorpusIfMissing] failed (non-fatal):", e);
  }
}

/**
 * Bulk fetch the corpus for prompt-stuffing. Returns an array sorted by
 * regId. Caller is responsible for slicing if the corpus grows beyond what
 * fits in the prompt — for v1 (~10 entries) we ship the whole thing.
 */
export async function loadRegulationsCorpus(
  ctx: ApiContext,
): Promise<RegulationCorpusEntry[]> {
  const snap = await ctx.db.collection("regulationsCorpus").get();
  const list = snap.docs.map((d: any) => d.data() as RegulationCorpusEntry);
  list.sort((a, b) => a.regId.localeCompare(b.regId));
  return list;
}
