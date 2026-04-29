import { describe, expect, it } from "vitest";

import { computeHoldRatePercent } from "./wms-home-kpis";

describe("computeHoldRatePercent", () => {
  it("returns 0 when no balance rows", () => {
    expect(computeHoldRatePercent(3, 0)).toBe(0);
  });

  it("rounds to one decimal", () => {
    expect(computeHoldRatePercent(1, 3)).toBeCloseTo(33.3, 5);
    expect(computeHoldRatePercent(2, 7)).toBeCloseTo(28.6, 5);
  });
});
