import { describe, expect, it } from "vitest";

import {
  canRecordFinanceReview,
  financeReviewBlockedExplanation,
} from "@/lib/invoice-audit/finance-review-eligibility";

describe("finance review eligibility (aligns with setInvoiceIntakeReview)", () => {
  it("allows only AUDITED without disabledReason", () => {
    expect(canRecordFinanceReview({ status: "AUDITED" })).toBe(true);
    expect(financeReviewBlockedExplanation({ status: "AUDITED" })).toBeNull();
  });

  it("blocks PARSED with default audit message", () => {
    expect(canRecordFinanceReview({ status: "PARSED" })).toBe(false);
    expect(financeReviewBlockedExplanation({ status: "PARSED" })).toBe(
      "Run a successful audit before recording approval or override.",
    );
  });

  it("blocks FAILED like other non-AUDITED statuses", () => {
    expect(canRecordFinanceReview({ status: "FAILED" })).toBe(false);
    expect(financeReviewBlockedExplanation({ status: "FAILED" })).toContain("successful audit");
  });

  it("prefers disabledReason when present (audit engine errors)", () => {
    expect(
      canRecordFinanceReview({
        status: "FAILED",
        disabledReason: "Fix audit errors and re-run audit before recording a review decision.",
      }),
    ).toBe(false);
    expect(
      financeReviewBlockedExplanation({
        status: "FAILED",
        disabledReason: "Fix audit errors and re-run audit before recording a review decision.",
      }),
    ).toBe("Fix audit errors and re-run audit before recording a review decision.");
  });

  it("blocks AUDITED when disabledReason is set (defensive)", () => {
    expect(canRecordFinanceReview({ status: "AUDITED", disabledReason: "Maintenance mode." })).toBe(false);
    expect(financeReviewBlockedExplanation({ status: "AUDITED", disabledReason: "Maintenance mode." })).toBe(
      "Maintenance mode.",
    );
  });
});
