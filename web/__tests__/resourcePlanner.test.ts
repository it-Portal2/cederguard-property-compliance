import { describe, it, expect } from "vitest";
import {
  DEFAULT_RATE_CARD,
  DEFAULT_COMPLEXITY_MAP,
} from "../lib/resourcePlanner/constants";
import {
  dateToFyQuarterIndex,
  quarterIndexToLabel,
  fyLabel,
  buildQuarterAxis,
} from "../lib/resourcePlanner/quarters";
import {
  normalizeScheme,
  resolveComplexityBand,
  computeDemandMatrix,
  buildResourcePlan,
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
});
