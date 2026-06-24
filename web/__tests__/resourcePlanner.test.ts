import { describe, it, expect } from "vitest";
import {
  DEFAULT_RATE_CARD,
  DEFAULT_COMPLEXITY_MAP,
} from "../lib/resourcePlanner/constants";
import {
  dateToFyQuarterIndex,
  quarterIndexToLabel,
  quarterCalendarLabel,
  fyLabel,
  buildQuarterAxis,
} from "../lib/resourcePlanner/quarters";
import {
  normalizeScheme,
  resolveComplexityBand,
  computeDemandMatrix,
  buildResourcePlan,
  computeCost,
  computeHeadcount,
  computePeopleCapacity,
} from "../lib/resourcePlanner/compute";
import type {
  ResourceAssumptions,
  ResourceScheme,
} from "../lib/resourcePlanner/types";

const assumptions = (
  overheadPct = 0,
  leavePct = 0,
): ResourceAssumptions => ({
  rateCard: DEFAULT_RATE_CARD,
  complexityMap: DEFAULT_COMPLEXITY_MAP,
  overheadPct,
  leavePct,
  horizon: { startFy: 2026, endFy: 2027 },
});

const expectArr = (got: number[], exp: number[]) => {
  expect(got.length).toBe(exp.length);
  got.forEach((v, i) => expect(v).toBeCloseTo(exp[i], 5));
};

// A Mid-complexity scheme that runs cleanly through all four stages, one quarter
// of S1/S2 then two of S3 and two of S4 — so each stage's rate-card value is checked.
const fullMid: ResourceScheme = {
  id: "full",
  name: "Full Mid",
  complexity: "Mid",
  planningSubmitted: "2026-04-15", // FY2026-27 Q1 → idx 40
  planningAchieved: "2026-07-15", // Q2 → idx 41
  sosDate: "2026-10-15", // Q3 → idx 42
  handoverDate: "2027-04-15", // FY2027-28 Q1 → idx 44
  eodDate: "2027-07-15", // Q2 → idx 45
};

describe("quarters — April fiscal-year maths", () => {
  it("maps dates to the sheet's absolute quarter index", () => {
    expect(dateToFyQuarterIndex("2016-04-15")).toBe(0);
    expect(dateToFyQuarterIndex("2026-04-15")).toBe(40);
    expect(dateToFyQuarterIndex("2026-07-15")).toBe(41);
    expect(dateToFyQuarterIndex("2026-10-15")).toBe(42);
    expect(dateToFyQuarterIndex("2027-01-15")).toBe(43); // Jan = FY2026-27 Q4
    expect(dateToFyQuarterIndex("2027-04-15")).toBe(44);
  });
  it("labels indices and fiscal years", () => {
    expect(fyLabel(2026)).toBe("2026-27");
    expect(quarterIndexToLabel(40)).toBe("2026-27 Q1");
    expect(quarterIndexToLabel(43)).toBe("2026-27 Q4");
  });
  it("returns null for missing/invalid dates", () => {
    expect(dateToFyQuarterIndex(null)).toBeNull();
    expect(dateToFyQuarterIndex("")).toBeNull();
    expect(dateToFyQuarterIndex("not-a-date")).toBeNull();
  });
  it("renders calendar month-range labels per quarter (Q4 rolls to next year)", () => {
    expect(quarterCalendarLabel(2026, 1)).toBe("Apr–Jun 2026");
    expect(quarterCalendarLabel(2026, 2)).toBe("Jul–Sep 2026");
    expect(quarterCalendarLabel(2026, 3)).toBe("Oct–Dec 2026");
    expect(quarterCalendarLabel(2026, 4)).toBe("Jan–Mar 2027");
  });
});

describe("complexity normalisation (answer 6-A)", () => {
  it("maps raw labels to canonical bands", () => {
    expect(resolveComplexityBand("DA")).toBe("DP");
    expect(resolveComplexityBand("S106")).toBe("S106/GLA");
    expect(resolveComplexityBand("Development Partnership delivery")).toBe("DP");
    expect(resolveComplexityBand("various Small& Mid sites")).toBe("Mid");
    expect(resolveComplexityBand("Complex")).toBe("Complex");
  });
  it("leaves unmapped labels undefined (⇒ 0 FTE)", () => {
    expect(resolveComplexityBand("Nonsense")).toBeUndefined();
    const s = normalizeScheme({ id: "x", name: "x", complexityRaw: "Nonsense" });
    expect(s.complexity).toBeUndefined();
  });
  it("derives total homes when missing", () => {
    const s = normalizeScheme({
      id: "h",
      name: "h",
      councilHomes: 10,
      intermediateHomes: 4,
      privateHomes: 6,
    });
    expect(s.allHomes).toBe(20);
  });
});

describe("demand engine — per-quarter fidelity", () => {
  const axis = buildQuarterAxis(2026, 2027);
  const matrix = computeDemandMatrix(
    [normalizeScheme(fullMid)],
    DEFAULT_RATE_CARD,
    axis,
  );

  it("places each stage's rate-card FTE in the right quarter, by role", () => {
    // PM Mid: S1 0.3, S2 0.3, S3 0.3, S4 0.2
    expectArr(matrix.byRole.PM, [0.3, 0.3, 0.3, 0.3, 0.2, 0.2, 0, 0]);
    // SPM Mid: S1 0.2, S2 0.2, S3 0.1, S4 0.05
    expectArr(matrix.byRole.SPM, [0.2, 0.2, 0.1, 0.1, 0.05, 0.05, 0, 0]);
    // APM Mid: S1 0.1, S2 0.2, S3 0.2, S4 0.2
    expectArr(matrix.byRole.APM, [0.1, 0.2, 0.2, 0.2, 0.2, 0.2, 0, 0]);
    // The two unseeded roles contribute nothing until the PgM fills them in.
    expectArr(matrix.byRole.StrategicLead, new Array(8).fill(0));
    expectArr(matrix.byRole.DefectsPM, new Array(8).fill(0));
  });

  it("totals per quarter and routes complexity correctly", () => {
    expectArr(matrix.totalByQuarter, [0.6, 0.7, 0.6, 0.6, 0.45, 0.45, 0, 0]);
    // single Mid scheme ⇒ the Mid complexity band equals the grand total
    expectArr(matrix.byComplexity.Mid, [0.6, 0.7, 0.6, 0.6, 0.45, 0.45, 0, 0]);
  });
});

describe("missing dates ⇒ 0 FTE for that stage (answer 4-A)", () => {
  it("omits S1/S2 when planning dates are absent, keeps S3/S4", () => {
    const noPlanning: ResourceScheme = {
      id: "np",
      name: "No planning",
      complexity: "Mid",
      sosDate: "2026-10-15",
      handoverDate: "2027-04-15",
      eodDate: "2027-07-15",
    };
    const axis = buildQuarterAxis(2026, 2027);
    const m = computeDemandMatrix(
      [normalizeScheme(noPlanning)],
      DEFAULT_RATE_CARD,
      axis,
    );
    // pos 0,1 (before SoS) carry nothing; S3 from pos 2, S4 from pos 4
    expectArr(m.totalByQuarter, [0, 0, 0.6, 0.6, 0.45, 0.45, 0, 0]);
  });

  it("an unmapped complexity contributes 0 across the board", () => {
    const axis = buildQuarterAxis(2026, 2027);
    const m = computeDemandMatrix(
      [normalizeScheme({ ...fullMid, complexity: undefined, complexityRaw: "???" })],
      DEFAULT_RATE_CARD,
      axis,
    );
    expectArr(m.totalByQuarter, new Array(8).fill(0));
  });
});

describe("buildResourcePlan — rollups & uplift (answers 21-A, 5-A)", () => {
  it("aggregates by FY, peak quarter and total FTE (no uplift)", () => {
    const plan = buildResourcePlan([fullMid], assumptions(0, 0));
    expect(plan.totalFte).toBeCloseTo(3.4, 5);
    expect(plan.peak.label).toBe("2026-27 Q2");
    expect(plan.peak.fte).toBeCloseTo(0.7, 5);
    const fy2026 = plan.byFinancialYear.find((f) => f.fy === 2026)!;
    const fy2027 = plan.byFinancialYear.find((f) => f.fy === 2027)!;
    expect(fy2026.total).toBeCloseTo(2.5, 5);
    expect(fy2027.total).toBeCloseTo(0.9, 5);
  });

  it("applies overhead + leave as a flat % uplift on demand", () => {
    const plan = buildResourcePlan([fullMid], assumptions(0.2, 0.15)); // ×1.35
    expect(plan.totalFte).toBeCloseTo(4.59, 5);
    expect(plan.matrix.byRole.PM[2]).toBeCloseTo(0.405, 5);
    // raw matrix stays un-uplifted for reference
    expect(plan.rawMatrix.byRole.PM[2]).toBeCloseTo(0.3, 5);
  });

  it("derives the horizon from data when none is configured", () => {
    const plan = buildResourcePlan([fullMid], {
      ...assumptions(),
      horizon: { startFy: 0, endFy: -1 }, // invalid ⇒ derive
    });
    // earliest boundary FY2026-27, latest EOD FY2027-28
    expect(plan.axis[0].fyLabel).toBe("2026-27");
    expect(plan.axis[plan.axis.length - 1].fyLabel).toBe("2027-28");
  });
});

describe("cost + headcount (Point 2: quantify)", () => {
  const axis = buildQuarterAxis(2026, 2027);
  const matrix = computeDemandMatrix([normalizeScheme(fullMid)], DEFAULT_RATE_CARD, axis);

  it("cost = FTE × working-days × day-rate (flat rate for all roles), totalled and by FY", () => {
    const cost = computeCost(matrix, { SPM: 250, PM: 250, APM: 250 }, 65);
    // total FTE (no uplift) = 3.4 ⇒ 3.4 × 65 × 250 = 55,250
    expect(cost.total).toBeCloseTo(3.4 * 65 * 250, 2);
    // peak quarter (0.7 FTE) ⇒ 0.7 × 65 × 250
    expect(cost.totalByQuarter[1]).toBeCloseTo(0.7 * 65 * 250, 2);
    const fy2026 = cost.byFinancialYear.find((f) => f.fy === 2026)!;
    expect(fy2026.cost).toBeCloseTo(2.5 * 65 * 250, 2);
  });

  it("applies PER-ROLE day rates (PM costed higher than the rest)", () => {
    const cost = computeCost(matrix, { SPM: 250, PM: 300, APM: 250 }, 65);
    // PM FTE curve [0.3,0.3,0.3,0.3,0.2,0.2,0,0] @ 300/day; SPM/APM @ 250.
    expect(cost.byRole.PM[0]).toBeCloseTo(0.3 * 65 * 300, 2);
    expect(cost.byRole.SPM[0]).toBeCloseTo(0.2 * 65 * 250, 2);
    // total quarter 0 = SPM 0.2 + APM 0.1 @250 + PM 0.3 @300
    expect(cost.totalByQuarter[0]).toBeCloseTo((0.2 + 0.1) * 65 * 250 + 0.3 * 65 * 300, 2);
    // single Mid scheme ⇒ Mid complexity £ equals the grand total per quarter
    expect(cost.byComplexity.Mid[0]).toBeCloseTo(cost.totalByQuarter[0], 2);
  });

  it("falls back to the legacy single dayRate for unset roles", () => {
    // no per-role map ⇒ every role uses fallbackRate (legacy dayRate) = 200
    const cost = computeCost(matrix, undefined, 65, 200);
    expect(cost.total).toBeCloseTo(3.4 * 65 * 200, 2);
  });

  it("headcount rounds the peak quarter up to whole people", () => {
    const hc = computeHeadcount(matrix);
    expect(hc.peakFte).toBeCloseTo(0.7, 5);
    expect(hc.peakPeople).toBe(1); // ceil(0.7)
    expect(hc.peakLabel).toBe("2026-27 Q2");
  });

  it("buildResourcePlan exposes cost (uplifted) + headcount", () => {
    const plan = buildResourcePlan([fullMid], { ...assumptions(0.2, 0.15), dayRate: 250, workingDaysPerQuarter: 65 });
    // uplifted total FTE 4.59 ⇒ cost on the uplifted figure
    expect(plan.cost.total).toBeCloseTo(4.59 * 65 * 250, 1);
    expect(plan.headcount.peakPeople).toBe(1); // peak 0.945 ⇒ ceil = 1
  });
});

describe("people capacity (3B: who can take on more)", () => {
  it("derives a person's committed load from scheme assignments", () => {
    const scheme: ResourceScheme = { ...fullMid, id: "s1", projectManager: "Jane Doe", seniorPM: "Sam Lee" };
    const plan = buildResourcePlan([scheme], assumptions(0, 0));
    const people = computePeopleCapacity(plan, [scheme], {});
    const jane = people.find((p) => p.key === "jane doe")!;
    expect(jane.name).toBe("Jane Doe");
    expect(jane.roles).toContain("PM");
    // PM Mid curve, no uplift
    expectArr(jane.committedByQuarter, [0.3, 0.3, 0.3, 0.3, 0.2, 0.2, 0, 0]);
    expect(jane.availability).toBe(1.0);
    expect(jane.headroomByQuarter[0]).toBeCloseTo(0.7, 5);
    expect(jane.hasHeadroom).toBe(true);
  });

  it("applies an availability override and flags over-allocation", () => {
    const scheme: ResourceScheme = { ...fullMid, id: "s1", projectManager: "Jane Doe" };
    const plan = buildResourcePlan([scheme], assumptions(0, 0));
    const people = computePeopleCapacity(plan, [scheme], { "jane doe": 0.2 });
    const jane = people.find((p) => p.key === "jane doe")!;
    expect(jane.availability).toBe(0.2);
    // PM peaks at 0.3 > 0.2 ⇒ worst headroom negative
    expect(jane.minHeadroom).toBeCloseTo(0.2 - 0.3, 5);
  });

  it("sums commitment across multiple schemes", () => {
    const s1: ResourceScheme = { ...fullMid, id: "s1", projectManager: "Jane Doe" };
    const s2: ResourceScheme = { ...fullMid, id: "s2", projectManager: "Jane Doe" };
    const plan = buildResourcePlan([s1, s2], assumptions(0, 0));
    const people = computePeopleCapacity(plan, [s1, s2], {});
    const jane = people.find((p) => p.key === "jane doe")!;
    expect(jane.schemeCount).toBe(2);
    expect(jane.committedByQuarter[0]).toBeCloseTo(0.6, 5); // 0.3 + 0.3
  });
});

describe("capacity — supply vs demand by role (answer 19-A)", () => {
  it("flags shortfall when supply is below peak demand", () => {
    const plan = buildResourcePlan([fullMid], {
      ...assumptions(0, 0),
      supplyByRole: { PM: 0.25 },
    });
    // PM peaks at 0.3 > 0.25 supply ⇒ worst balance negative
    expect(plan.capacity.worstByRole.PM).toBeCloseTo(-0.05, 5);
    // SPM has no supply set ⇒ negative wherever there is demand
    expect(plan.capacity.worstByRole.SPM).toBeLessThan(0);
  });

  it("uses per-quarter resources-in-post when provided (overrides flat supply)", () => {
    // PM demand (no uplift): [0.3,0.3,0.3,0.3,0.2,0.2,0,0] across FY2026-27 Q1..FY2027-28 Q4.
    // idx 40 = FY2026-27 Q1. Put 1.0 PM in post at idx 40 ⇒ surplus there.
    const plan = buildResourcePlan([fullMid], {
      ...assumptions(0, 0),
      supplyByRole: { PM: 0 },
      inPostByRoleQuarter: { PM: { 40: 1.0 } },
    });
    const q40 = plan.capacity.byQuarter.find(
      (c) => c.role === "PM" && c.quarter === 40,
    )!;
    expect(q40.supply).toBeCloseTo(1.0, 5);
    expect(q40.balance).toBeCloseTo(1.0 - 0.3, 5); // surplus
    // a quarter with no in-post entry falls back to the flat supply (0)
    const q41 = plan.capacity.byQuarter.find(
      (c) => c.role === "PM" && c.quarter === 41,
    )!;
    expect(q41.supply).toBeCloseTo(0, 5);
  });
});
