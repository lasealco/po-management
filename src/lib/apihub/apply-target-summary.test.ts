import { describe, expect, it } from "vitest";

import { resolveApplyTargetSummary, resolveDryRunTargetSummary } from "./apply-target-summary";

describe("resolveApplyTargetSummary", () => {
  it("defaults to one logical update when resultSummary is empty", () => {
    expect(resolveApplyTargetSummary({ resultSummary: null })).toEqual({
      created: 0,
      updated: 1,
      skipped: 0,
    });
  });

  it("reads top-level counts from resultSummary JSON", () => {
    expect(
      resolveApplyTargetSummary({
        resultSummary: JSON.stringify({ created: 2, updated: 3, skipped: 1 }),
      }),
    ).toEqual({ created: 2, updated: 3, skipped: 1 });
  });

  it("reads nested targetSummary", () => {
    expect(
      resolveApplyTargetSummary({
        resultSummary: JSON.stringify({ targetSummary: { created: 1, updated: 0, skipped: 4 } }),
      }),
    ).toEqual({ created: 1, updated: 0, skipped: 4 });
  });

  it("defaults missing keys to zero when any count is present", () => {
    expect(resolveApplyTargetSummary({ resultSummary: JSON.stringify({ created: 5 }) })).toEqual({
      created: 5,
      updated: 0,
      skipped: 0,
    });
  });

  it("ignores invalid JSON and falls back to defaults", () => {
    expect(resolveApplyTargetSummary({ resultSummary: "not-json" })).toEqual({
      created: 0,
      updated: 1,
      skipped: 0,
    });
  });

  it("ignores non-numeric counts", () => {
    expect(resolveApplyTargetSummary({ resultSummary: JSON.stringify({ created: "x" }) })).toEqual({
      created: 0,
      updated: 1,
      skipped: 0,
    });
  });
});

describe("resolveDryRunTargetSummary", () => {
  it("returns zeros when apply would not run", () => {
    expect(resolveDryRunTargetSummary(false, { resultSummary: null })).toEqual({
      created: 0,
      updated: 0,
      skipped: 0,
    });
  });

  it("mirrors live summary when would apply", () => {
    expect(resolveDryRunTargetSummary(true, { resultSummary: JSON.stringify({ updated: 2 }) })).toEqual({
      created: 0,
      updated: 2,
      skipped: 0,
    });
  });
});
