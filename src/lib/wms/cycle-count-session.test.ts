import { describe, expect, it } from "vitest";

import {
  cycleCountQtyVariance,
  isWmsCycleCountVarianceReasonCode,
  normalizeCycleCountVarianceReasonCode,
  parseCycleCountQty,
  varianceRequiresReason,
} from "./cycle-count-session";

describe("cycle-count-session", () => {
  it("parses non-negative qty", () => {
    expect(parseCycleCountQty(12)).toBe(12);
    expect(parseCycleCountQty("12.5")).toBe(12.5);
    expect(parseCycleCountQty(-1)).toBeNull();
    expect(parseCycleCountQty("x")).toBeNull();
    expect(parseCycleCountQty(null)).toBeNull();
  });

  it("detects variance reason requirement", () => {
    expect(varianceRequiresReason(10, 10)).toBe(false);
    expect(varianceRequiresReason(10, 11)).toBe(true);
  });

  it("computes variance delta", () => {
    expect(cycleCountQtyVariance(10, 8)).toBe(-2);
    expect(cycleCountQtyVariance(3, 7)).toBe(4);
  });

  it("normalizes reason codes", () => {
    expect(normalizeCycleCountVarianceReasonCode(" shrink ")).toBe("SHRINK");
    expect(normalizeCycleCountVarianceReasonCode("")).toBeNull();
    expect(isWmsCycleCountVarianceReasonCode("SHRINK")).toBe(true);
    expect(isWmsCycleCountVarianceReasonCode("BOGUS")).toBe(false);
  });
});
