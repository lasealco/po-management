import { describe, expect, it } from "vitest";

import {
  complianceReviewNextDueInputValue,
  complianceReviewOutcomeNeedsFollowUp,
  complianceReviewSummaryFieldKey,
} from "./supplier-compliance-review-workspace";

describe("complianceReviewOutcomeNeedsFollowUp", () => {
  it("is true for action_required and failed only", () => {
    expect(complianceReviewOutcomeNeedsFollowUp("action_required")).toBe(true);
    expect(complianceReviewOutcomeNeedsFollowUp("failed")).toBe(true);
    expect(complianceReviewOutcomeNeedsFollowUp("satisfactory")).toBe(false);
  });
});

describe("complianceReviewNextDueInputValue", () => {
  it("returns empty for null or invalid", () => {
    expect(complianceReviewNextDueInputValue(null)).toBe("");
    expect(complianceReviewNextDueInputValue("")).toBe("");
    expect(complianceReviewNextDueInputValue("not-a-date")).toBe("");
  });

  it("returns YYYY-MM-DD slice for valid ISO", () => {
    expect(complianceReviewNextDueInputValue("2027-06-15T00:00:00.000Z")).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe("complianceReviewSummaryFieldKey", () => {
  it("changes when summary or next due changes", () => {
    const a = complianceReviewSummaryFieldKey("id1", "hello", null);
    const b = complianceReviewSummaryFieldKey("id1", "hallo", null);
    const c = complianceReviewSummaryFieldKey("id1", "hello", "2026-01-01T00:00:00.000Z");
    expect(a).not.toBe(b);
    expect(a).not.toBe(c);
  });

  it("is stable for same inputs", () => {
    expect(complianceReviewSummaryFieldKey("x", "y", "z")).toBe(
      complianceReviewSummaryFieldKey("x", "y", "z"),
    );
  });
});
