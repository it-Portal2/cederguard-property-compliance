import { describe, it, expect } from "vitest";
import { allRoutes } from "../routes/index.js";
import {
  INTERNAL_ACTIONS,
  documentedActionSet,
} from "../../shared/lib/apiCatalog.js";

// Coverage gate: the public API reference must stay 1:1 with the real route
// registry. A new callable action with no catalog entry fails here (so the docs
// can never silently drift), and a documented action that no longer exists fails
// too (so the docs can't reference a removed endpoint).

describe("API catalog coverage", () => {
  const internal = new Set(INTERNAL_ACTIONS);
  const documented = documentedActionSet();
  const liveActions = Object.keys(allRoutes).filter((a) => !internal.has(a));

  it("documents every callable (non-internal) action", () => {
    const undocumented = liveActions.filter((a) => !documented.has(a)).sort();
    expect(undocumented, `Undocumented actions (${undocumented.length}):\n${undocumented.join("\n")}`).toEqual([]);
  });

  it("has no catalog entry for a non-existent action", () => {
    const phantom = [...documented].filter((a) => !allRoutes[a]).sort();
    expect(phantom, `Documented but not in allRoutes:\n${phantom.join("\n")}`).toEqual([]);
  });

  it("lists every internal exclusion as a real action (no stale exclusions)", () => {
    const staleExclusions = [...internal].filter((a) => !allRoutes[a]).sort();
    expect(staleExclusions, `Excluded but not in allRoutes:\n${staleExclusions.join("\n")}`).toEqual([]);
  });
});
