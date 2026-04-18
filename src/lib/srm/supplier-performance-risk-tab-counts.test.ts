import { describe, expect, it } from "vitest";

import {
  countNonClosedSupplierRiskRecords,
  countScorecardsMissingCoreMetrics,
} from "./supplier-performance-risk-tab-counts";

describe("countNonClosedSupplierRiskRecords", () => {
  it("counts open and mitigating only", () => {
    expect(
      countNonClosedSupplierRiskRecords([
        { status: "open" },
        { status: "mitigating" },
        { status: "closed" },
      ]),
    ).toBe(2);
  });

  it("returns 0 for empty or all closed", () => {
    expect(countNonClosedSupplierRiskRecords([])).toBe(0);
    expect(countNonClosedSupplierRiskRecords([{ status: "closed" }])).toBe(0);
  });
});

describe("countScorecardsMissingCoreMetrics", () => {
  it("counts rows where both on-time and quality are absent", () => {
    expect(
      countScorecardsMissingCoreMetrics([
        { onTimeDeliveryPct: null, qualityRating: null },
        { onTimeDeliveryPct: "90", qualityRating: null },
        { onTimeDeliveryPct: null, qualityRating: 4 },
        { onTimeDeliveryPct: "88", qualityRating: 3 },
      ]),
    ).toBe(1);
  });

  it("returns 0 for empty", () => {
    expect(countScorecardsMissingCoreMetrics([])).toBe(0);
  });
});
