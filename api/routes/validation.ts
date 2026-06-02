// Fact-Check / Validation route map.
//
// Backs the Mandatory Fact-Check / Validation feature. The engine (B3) runs a
// TWO-CALL fact-check — Call 1 is a web-grounded gather via aiOperationRouter
// (`webSearch:true`), Call 2 structures a strict-JSON verdict — then persists a
// ValidationRecord to the `validations` collection with status
// "awaiting_validation". Final approval on each surface stays blocked until a
// PM+ marks the record "validated" (B5). All write actions audit-log via
// logActivity, awaited BEFORE the response.
//
// Boundary: ALL AI work goes through api/lib/aiOperationRouter.ts — NEVER
// api/routes/ai.ts (out of bounds).
//
// NOTE: actions are stubbed here (B2 — skeleton + registration); B3–B6 fill them in.

import { ApiContext } from "../lib/context.js";

/** Firestore collection holding one ValidationRecord per fact-checked artifact. */
export const VALIDATIONS_COLLECTION = "validations";

type Handler = (req: any, res: any, ctx: ApiContext) => Promise<any>;

const stub =
  (action: string): Handler =>
  async (_req, res, ctx) => {
    if (!ctx.uid) return res.status(401).json({ error: "Unauthorized" });
    return res.status(200).json({ success: true, stub: action });
  };

export const validationRoutes: Record<string, Handler> = {
  // B3 — run the two-call fact-check + persist an "awaiting_validation" record.
  validationRunFactCheck: stub("validationRunFactCheck"),

  // B4 — read a single validation by surface + targetId.
  validationGet: stub("validationGet"),

  // B4 — read all validations for a project/programme context.
  validationGetForContext: stub("validationGetForContext"),

  // B5 — PM+ marks a record validated / rejected (gated).
  validationSetStatus: stub("validationSetStatus"),

  // B6 — attach a source link or uploaded file to a record (Q7=A).
  validationAttachSource: stub("validationAttachSource"),

  // B6 — remove an attached source (and its GCS object if a file).
  validationRemoveAttachment: stub("validationRemoveAttachment"),
};
