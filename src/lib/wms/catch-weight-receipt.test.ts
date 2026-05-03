import { describe, expect, it } from "vitest";

import { evaluateCatchWeightAgainstTolerance } from "./catch-weight-receipt";

describe("evaluateCatchWeightAgainstTolerance", () => {
  it("skips non-catch-weight lines", () => {
    const r = evaluateCatchWeightAgainstTolerance(
      [
        {
          shipmentItemId: "a",
          isCatchWeightProduct: false,
          declaredKg: 10,
          receivedKg: 9,
        },
      ],
      5,
    );
    expect(r.policyApplied).toBe(true);
    expect(r.withinTolerance).toBe(true);
    expect(r.lines[0].skipped).toBe(true);
  });

  it("requires received kg when policy applies and declared > 0", () => {
    const r = evaluateCatchWeightAgainstTolerance(
      [
        {
          shipmentItemId: "a",
          isCatchWeightProduct: true,
          declaredKg: 10,
          receivedKg: null,
        },
      ],
      5,
    );
    expect(r.withinTolerance).toBe(false);
    expect(r.lines[0].ok).toBe(false);
  });

  it("passes when delta within pct", () => {
    const r = evaluateCatchWeightAgainstTolerance(
      [
        {
          shipmentItemId: "a",
          isCatchWeightProduct: true,
          declaredKg: 100,
          receivedKg: 97,
        },
      ],
      5,
    );
    expect(r.withinTolerance).toBe(true);
    expect(r.lines[0].deltaPctOfDeclared).toBeCloseTo(3, 5);
  });

  it("fails when delta exceeds pct", () => {
    const r = evaluateCatchWeightAgainstTolerance(
      [
        {
          shipmentItemId: "a",
          isCatchWeightProduct: true,
          declaredKg: 100,
          receivedKg: 90,
        },
      ],
      5,
    );
    expect(r.withinTolerance).toBe(false);
  });
});
