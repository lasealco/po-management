import { describe, expect, it } from "vitest";

import { deriveVarianceDisposition, RECEIVE_LINE_QTY_EPSILON, resolveVarianceDisposition } from "./receive-line-variance";

describe("deriveVarianceDisposition", () => {
  it("matches within epsilon", () => {
    expect(deriveVarianceDisposition(10, 10 + RECEIVE_LINE_QTY_EPSILON / 2)).toBe("MATCH");
  });

  it("short when received lower", () => {
    expect(deriveVarianceDisposition(10, 9)).toBe("SHORT");
  });

  it("over when received higher", () => {
    expect(deriveVarianceDisposition(10, 10.01)).toBe("OVER");
  });
});

describe("resolveVarianceDisposition", () => {
  it("respects explicit DAMAGED", () => {
    expect(resolveVarianceDisposition(10, 9, "damaged")).toBe("DAMAGED");
  });

  it("falls back to derive when unset", () => {
    expect(resolveVarianceDisposition(5, 5, "")).toBe("MATCH");
  });
});
