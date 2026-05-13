// Technical Assurance Companion — Regulations Corpus seed.
//
// Hand-curated v1 corpus — ~10 most-cited clauses across
// Approved Documents (Building Regulations), BSA 2022, PAS 2035, Awaab's
// Law, CDM 2015, RSH Consumer Standards. Seeded on first read of the
// corpus collection. Promoted from the existing static
// `src/data/regulationsLibraryData.ts` shape so the AI corpus refreshes
// independently of code deploys (cron extends this).
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

  // Approved Document K · stair detail clauses ----------------------
  // Common cite-magnets when users upload AD K. Without these, the AI
  // sees the document's full clause set + drops everything except adk-1.2.
  {
    regId: "adk-1.5",
    document: "adk",
    documentLabel: "Approved Document K (Protection from falling, collision and impact)",
    clause: "1.5 Stair tread and rise — private dwellings",
    text: "Steps in private stairs (within a single dwelling) should have a minimum tread (going) of 220 mm and a maximum rise of 220 mm. The pitch should not exceed 42°. Open risers should not allow a 100 mm sphere to pass through.",
    source: {
      url: "https://www.gov.uk/government/publications/protection-from-falling-collision-and-impact-approved-document-k",
      documentVersion: "2013 ed., incorporating 2024 amendments",
      verifiedAt: VERIFIED_AT,
    },
    appliesTo: ["stair", "tread", "rise", "private-stair", "geometry"],
    ribaRelevance: ["S3", "S4"],
  },
  {
    regId: "adk-1.10",
    document: "adk",
    documentLabel: "Approved Document K (Protection from falling, collision and impact)",
    clause: "1.10 Handrails on stairs",
    text: "Stairs should have a continuous handrail on at least one side if they are less than 1m wide; on both sides if 1m or wider. Handrail height should be 900-1000 mm above the pitch line for stairs in dwellings, 900-1100 mm for non-dwelling stairs.",
    source: {
      url: "https://www.gov.uk/government/publications/protection-from-falling-collision-and-impact-approved-document-k",
      documentVersion: "2013 ed., incorporating 2024 amendments",
      verifiedAt: VERIFIED_AT,
    },
    appliesTo: ["stair", "handrail", "geometry"],
    ribaRelevance: ["S3", "S4"],
  },
  {
    regId: "adk-3.2",
    document: "adk",
    documentLabel: "Approved Document K (Protection from falling, collision and impact)",
    clause: "3.2 Guarding heights",
    text: "Guarding to landings, balconies, edges of internal floors and external balconies in dwellings must be a minimum of 900 mm above the pitch line of stairs and 1100 mm elsewhere. Non-dwelling buildings require 1100 mm at all points where the drop exceeds 600 mm.",
    source: {
      url: "https://www.gov.uk/government/publications/protection-from-falling-collision-and-impact-approved-document-k",
      documentVersion: "2013 ed., incorporating 2024 amendments",
      verifiedAt: VERIFIED_AT,
    },
    appliesTo: ["guarding", "balcony", "landing", "fall-protection"],
    ribaRelevance: ["S3", "S4"],
  },

  // Approved Document B · fire safety supplementary -----------------
  {
    regId: "adb-vol1-3.2",
    document: "adb-vol1",
    documentLabel: "Approved Document B Vol. 1 (Fire Safety — Dwellings)",
    clause: "3 Means of escape from upper storeys",
    text: "Every habitable room in a dwelling more than 4.5 m above ground level must have access to a protected stair (a stair enclosed in fire-resisting construction with self-closing fire doors). Direct escape to outside is acceptable from rooms below 4.5 m. Travel distance within the dwelling to the protected stair should not exceed 9 m.",
    source: {
      url: "https://www.gov.uk/government/publications/fire-safety-approved-document-b",
      documentVersion: "2019 ed., incorporating 2022 amendments",
      verifiedAt: VERIFIED_AT,
    },
    appliesTo: ["fire", "escape", "protected-stair", "travel-distance"],
    ribaRelevance: ["S2", "S3", "S4"],
  },
  {
    regId: "adb-vol1-5.2",
    document: "adb-vol1",
    documentLabel: "Approved Document B Vol. 1 (Fire Safety — Dwellings)",
    clause: "5 Internal fire spread (structure) — compartment walls",
    text: "Compartment walls between flats must achieve a minimum 60 minutes fire resistance. Compartment walls in HRBs, between flats and a common stair, or between adjoining buildings must achieve 90 minutes. Penetrations through compartment walls must be fire-stopped to maintain the rating.",
    source: {
      url: "https://www.gov.uk/government/publications/fire-safety-approved-document-b",
      documentVersion: "2019 ed., incorporating 2022 amendments",
      verifiedAt: VERIFIED_AT,
    },
    appliesTo: ["fire", "compartmentation", "fire-stopping", "frr", "hrb"],
    ribaRelevance: ["S3", "S4", "S5"],
  },
  {
    regId: "adb-vol1-12",
    document: "adb-vol1",
    documentLabel: "Approved Document B Vol. 1 (Fire Safety — Dwellings)",
    clause: "12 Means of warning and escape — fire detection and alarm systems",
    text: "Dwellings must have a smoke alarm system to BS 5839-6 Grade D Category LD2 minimum (a Grade D system with mains-powered alarms and a battery backup, providing detection in circulation spaces and the principal habitable room). Multi-storey HMOs and HRBs require a Grade A system.",
    source: {
      url: "https://www.gov.uk/government/publications/fire-safety-approved-document-b",
      documentVersion: "2019 ed., incorporating 2022 amendments",
      verifiedAt: VERIFIED_AT,
    },
    appliesTo: ["fire", "alarm", "detection", "smoke-alarm"],
    ribaRelevance: ["S3", "S4", "S5"],
  },

  // Building Safety Act 2022 · Gateways + Accountable Person --------
  {
    regId: "bsa-2022-gw2",
    document: "bsa-2022",
    documentLabel: "Building Safety Act 2022 — Gateway 2 (BSR design approval)",
    clause: "Gateway 2 — Pre-construction design submission",
    text: "Before construction starts on a higher-risk building, the principal designer must submit a Gateway 2 application to the Building Safety Regulator (BSR) for approval. The submission must include detailed designs, a competence declaration, a construction control plan, and a Golden Thread information specification. BSR has 12 weeks to respond. Construction may not begin without approval.",
    source: {
      url: "https://www.legislation.gov.uk/ukpga/2022/30",
      documentVersion: "as enacted, with 2023 commencement",
      verifiedAt: VERIFIED_AT,
    },
    appliesTo: ["hrb", "gateway-2", "bsr", "design", "principal-designer"],
    ribaRelevance: ["S3", "S4"],
  },
  {
    regId: "bsa-2022-gw3",
    document: "bsa-2022",
    documentLabel: "Building Safety Act 2022 — Gateway 3 (BSR completion approval)",
    clause: "Gateway 3 — Completion certificate submission",
    text: "On completion of construction of a higher-risk building, the principal contractor must submit a Gateway 3 completion certificate application to the BSR. The application must include the as-built Golden Thread, a final declaration of compliance, and a Building Safety Case identifying the Accountable Person. The building cannot be occupied until BSR issues the completion certificate.",
    source: {
      url: "https://www.legislation.gov.uk/ukpga/2022/30",
      documentVersion: "as enacted, with 2023 commencement",
      verifiedAt: VERIFIED_AT,
    },
    appliesTo: ["hrb", "gateway-3", "bsr", "completion", "accountable-person"],
    ribaRelevance: ["S5", "S6"],
  },
  {
    regId: "bsa-2022-ap",
    document: "bsa-2022",
    documentLabel: "Building Safety Act 2022 — Accountable Person duties",
    clause: "Section 72 — Accountable Person",
    text: "Every higher-risk building must have an Accountable Person registered with the BSR. The Accountable Person is responsible for assessing and managing building safety risks throughout the building's occupation, maintaining the Golden Thread, and ensuring the residents' engagement strategy is in place. Multiple Accountable Persons are permitted; one must be designated as the Principal Accountable Person.",
    source: {
      url: "https://www.legislation.gov.uk/ukpga/2022/30",
      documentVersion: "as enacted, with 2023 commencement",
      verifiedAt: VERIFIED_AT,
    },
    appliesTo: ["hrb", "accountable-person", "occupation", "safety-case"],
    ribaRelevance: ["S6", "S7"],
  },

  // PAS 2035 supplementary -------------------------------------------
  {
    regId: "pas-2035-9",
    document: "pas-2035",
    documentLabel: "PAS 2035:2023 — Retrofitting dwellings for improved energy efficiency",
    clause: "9 Moisture risk assessment",
    text: "A moisture risk assessment must accompany every PAS 2035 retrofit project. The assessment must consider interstitial condensation (using BS 5250 / BS EN ISO 13788), surface condensation, and rainwater penetration. Risk Path A (low) requires baseline measures; Risk Path B (medium) requires a designed ventilation strategy; Risk Path C (high) requires a specialist Retrofit Designer.",
    source: {
      url: "https://www.bsigroup.com/en-GB/standards/PAS-2035",
      documentVersion: "2023 edition",
      verifiedAt: VERIFIED_AT,
    },
    appliesTo: ["retrofit", "moisture", "condensation", "ventilation"],
    ribaRelevance: ["S2", "S3", "S4"],
  },

  // RSH Consumer Standards supplementary -----------------------------
  {
    regId: "rsh-cs-tsm-2",
    document: "rsh-cs",
    documentLabel: "RSH Consumer Standards — Safety and Quality Standard",
    clause: "Safety and Quality — required actions",
    text: "Registered providers must comply with health and safety law and approved guidance for residential premises. They must take all reasonable steps to ensure the safety of tenants in occupied premises, including identifying, monitoring and resolving hazards under the Housing Health and Safety Rating System (HHSRS) and the Decent Homes Standard.",
    source: {
      url: "https://www.gov.uk/government/collections/regulator-of-social-housing-consumer-standards",
      documentVersion: "April 2024",
      verifiedAt: VERIFIED_AT,
    },
    appliesTo: ["rsh", "hhsrs", "decent-homes", "tenant-safety"],
    ribaRelevance: ["S6", "S7"],
  },

  // CDM 2015 supplementary -------------------------------------------
  {
    regId: "cdm-2015-r9",
    document: "cdm-2015",
    documentLabel: "Construction (Design and Management) Regulations 2015",
    clause: "Regulation 9 — Designer duties",
    text: "Designers must eliminate, reduce or control foreseeable risks that may arise during construction or future maintenance and use of the building. They must provide design information to the Principal Designer and Principal Contractor for the pre-construction information pack, construction phase plan and health and safety file.",
    source: {
      url: "https://www.legislation.gov.uk/uksi/2015/51",
      documentVersion: "2015, current at 2026",
      verifiedAt: VERIFIED_AT,
    },
    appliesTo: ["cdm", "designer", "risk-elimination", "h&s-file"],
    ribaRelevance: ["S2", "S3", "S4"],
  },
  {
    regId: "cdm-2015-r13",
    document: "cdm-2015",
    documentLabel: "Construction (Design and Management) Regulations 2015",
    clause: "Regulation 13 — Principal Contractor duties",
    text: "The Principal Contractor must plan, manage, monitor and coordinate the construction phase. They must prepare and update the construction phase plan, ensure suitable site induction, and consult and engage with workers on health, safety and welfare matters.",
    source: {
      url: "https://www.legislation.gov.uk/uksi/2015/51",
      documentVersion: "2015, current at 2026",
      verifiedAt: VERIFIED_AT,
    },
    appliesTo: ["cdm", "principal-contractor", "construction-phase-plan"],
    ribaRelevance: ["S5"],
  },
];

/**
 * Idempotent platform-wide seed. Returns silently if any corpus entry
 * already exists. Cheaper than a transaction. Best-effort —
 * failures are logged but do not abort the caller's response.
 * Note: corpus is platform-wide (NOT scoped per clientId) — the same
 * regulations apply to every council. The quarterly refresh cron
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
