import { describe, expect, it } from "vitest";

import { complianceReviewDueState } from "./compliance-review-due";

describe("complianceReviewDueState", () => {
  const now = Date.UTC(2026, 6, 1);

  it("returns null without date", () => {
    expect(complianceReviewDueState(null, now)).toBeNull();
  });

  it("returns overdue when past", () => {
    expect(complianceReviewDueState("2026-06-01T00:00:00.000Z", now)).toBe("overdue");
  });

  it("returns due_soon within 14 days", () => {
    const in7d = new Date(now + 7 * 86400000).toISOString();
    expect(complianceReviewDueState(in7d, now)).toBe("due_soon");
  });

  it("returns null when beyond window", () => {
    const in30d = new Date(now + 30 * 86400000).toISOString();
    expect(complianceReviewDueState(in30d, now)).toBeNull();
  });
});
