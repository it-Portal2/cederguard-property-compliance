// Technical Assurance Companion — seed enquiries for visual verification.
//
// Two sample enquiries span the visible status pills (Draft + Open) so the
// table chrome, StatsCards, RIBA pills, and attachment count column are all
// visible immediately on a fresh workspace. Seed runs on first list-call —
// same pattern as meetings + forward plan +
// reports.
//
// ALL data is stub / illustrative — the URL fields point to `about:blank`
// because no real binaries exist in storage. The `avScanStatus` values are
// varied to show the chip pills (clean / pending) on the workspace UI when
// it lands in 7.

import type { ApiContext } from "./context.js";
import type {
  Enquiry,
  EnquiryAttachment,
  EnquiryStatus,
  RibaStage,
} from "../../src/types/technicalAssurance.js";

const SEED_PREFIX = "tac-seed-";

export interface SeedEnquiry {
  id: string;
  title: string;
  query: string;
  ribaStage: RibaStage;
  status: EnquiryStatus;
  attachments: Array<Omit<EnquiryAttachment, "uploadedAt" | "uploadedBy">>;
  softDeleted: boolean;
}

export const SEED_ENQUIRIES: SeedEnquiry[] = [
  {
    id: `${SEED_PREFIX}draft-bulkhead-clash`,
    title: "Bulkhead clash with MVHR duct — Aspen Court Block C",
    query:
      "On Stage 4 detailed design, the riser bulkhead at level 3 conflicts with the new MVHR duct routing. Need clarification on whether the framing can be deepened by 60mm without compromising the 60-min fire-resistance rating. Cross-reference Approved Doc B Vol 1 §11 + Building Safety Act 2022 §27.",
    ribaStage: "S4",
    status: "Draft",
    attachments: [],
    softDeleted: false,
  },
  {
    id: `${SEED_PREFIX}open-firefighting-shaft`,
    title:
      "Confirm Approved Doc B Vol 1 §2.25 application — firefighting shaft",
    query:
      "Confirm whether the firefighting shaft on the new accommodation block requires a fire-fighter's lift given the building height of 28m above ground level. Reference PAS 9999 alongside Approved Doc B Vol 1 §2.25.",
    ribaStage: "S3",
    status: "Open",
    attachments: [
      {
        id: "att-seed-001",
        storagePath: "tac/_seed/firefighting-shaft/floor-plan.pdf",
        fileName: "aspen-court-block-c-floor-plan.pdf",
        fileSize: 2_400_000,
        mimeType: "application/pdf",
        avScanStatus: "clean",
      } as Omit<EnquiryAttachment, "uploadedAt" | "uploadedBy">,
      {
        id: "att-seed-002",
        storagePath: "tac/_seed/firefighting-shaft/elevation.dwg",
        fileName: "block-c-elevation.dwg",
        fileSize: 4_100_000,
        mimeType: "application/octet-stream",
        avScanStatus: "pending",
      } as Omit<EnquiryAttachment, "uploadedAt" | "uploadedBy">,
    ],
    softDeleted: false,
  },
];

/**
 * Idempotent seed. Returns silently if any enquiry already exists for this
 * client (so re-seed never duplicates). Best-effort — failures are logged
 * but do not abort the caller's response.
 */
export async function seedTacEnquiriesIfMissing(
  ctx: ApiContext,
): Promise<void> {
  try {
    // Probe — if any enquiry exists for this client, skip seeding entirely.
    // Cheaper than a transactional "exists?" check.
    const probe = await ctx.db
      .collection("enquiries")
      .where("clientId", "==", ctx.primaryUid)
      .limit(1)
      .get();
    if (!probe.empty) return;

    // Pick the first project owned by this client to use as the seed
    // enquiries' projectId. If the client has no projects yet, fall back
    // to a placeholder string — the row simply renders "—" in the project
    // column.
    let defaultProjectId = "";
    try {
      const projSnap = await ctx.db
        .collection("projects")
        .where("clientId", "==", ctx.primaryUid)
        .limit(1)
        .get();
      if (!projSnap.empty) defaultProjectId = projSnap.docs[0].id;
    } catch {
      // ignore — defaultProjectId stays empty.
    }

    const now = new Date().toISOString();
    const batch = ctx.db.batch();
    for (const seed of SEED_ENQUIRIES) {
      const docId = `${ctx.primaryUid}_${seed.id}`;
      const ref = ctx.db.collection("enquiries").doc(docId);
      const doc: Enquiry = {
        id: seed.id,
        clientId: ctx.primaryUid,
        projectId: defaultProjectId,
        ribaStage: seed.ribaStage,
        title: seed.title,
        query: seed.query,
        attachments: seed.attachments.map((a) => ({
          ...a,
          uploadedAt: now,
          uploadedBy: ctx.uid,
        })) as EnquiryAttachment[],
        status: seed.status,
        ownerUid: ctx.uid,
        createdAt: now,
        updatedAt: now,
        softDeleted: seed.softDeleted,
      };
      batch.set(ref, doc);
    }
    await batch.commit();
  } catch (e) {
    // Non-fatal — list call still returns whatever's in the collection.
    console.warn("[seedTacEnquiriesIfMissing] failed (non-fatal):", e);
  }
}
