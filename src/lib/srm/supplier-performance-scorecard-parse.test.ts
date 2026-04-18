import { describe, expect, it } from "vitest";

import {
  parsePerformanceScorecardCreateBody,
  parsePerformanceScorecardPatchBody,
} from "./supplier-performance-scorecard-parse";

describe("parsePerformanceScorecardCreateBody", () => {
  it("requires periodKey", () => {
    expect(parsePerformanceScorecardCreateBody({}).ok).toBe(false);
  });

  it("accepts periodKey only", () => {
    const r = parsePerformanceScorecardCreateBody({ periodKey: "2026-Q2" });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data.periodKey).toBe("2026-Q2");
      expect(r.data.onTimeDeliveryPct).toBeNull();
    }
  });
});

describe("parsePerformanceScorecardPatchBody", () => {
  it("rejects empty", () => {
    expect(parsePerformanceScorecardPatchBody({}).ok).toBe(false);
  });

  it("accepts notes", () => {
    const r = parsePerformanceScorecardPatchBody({ notes: "ok" });
    expect(r.ok).toBe(true);
  });
});
