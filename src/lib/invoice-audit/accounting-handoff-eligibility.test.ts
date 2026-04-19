import { describe, expect, it } from "vitest";

import {
  accountingHandoffBlockedExplanation,
  canRecordAccountingHandoff,
} from "@/lib/invoice-audit/accounting-handoff-eligibility";

describe("accounting handoff eligibility (aligns with setInvoiceIntakeAccountingHandoff)", () => {
  it("allows only AUDITED with finance review saved and without disabledReason", () => {
    expect(
      canRecordAccountingHandoff({
        status: "AUDITED",
        reviewDecision: "APPROVED",
      }),
    ).toBe(true);
    expect(
      accountingHandoffBlockedExplanation({
        status: "AUDITED",
        reviewDecision: "APPROVED",
      }),
    ).toBeNull();
    expect(
      canRecordAccountingHandoff({
        status: "AUDITED",
        reviewDecision: "OVERRIDDEN",
      }),
    ).toBe(true);
  });

  it("blocks when finance review is still NONE", () => {
    expect(
      canRecordAccountingHandoff({
        status: "AUDITED",
        reviewDecision: "NONE",
      }),
    ).toBe(false);
    expect(
      accountingHandoffBlockedExplanation({
        status: "AUDITED",
        reviewDecision: "NONE",
      }),
    ).toBe(
      "Save Step 2 — Finance review as Approve or Override before marking ready for accounting.",
    );
  });

  it("blocks non-AUDITED with audit message when review is already saved", () => {
    expect(
      canRecordAccountingHandoff({
        status: "PARSED",
        reviewDecision: "APPROVED",
      }),
    ).toBe(false);
    expect(
      accountingHandoffBlockedExplanation({
        status: "PARSED",
        reviewDecision: "APPROVED",
      }),
    ).toBe("Run a successful audit before accounting handoff.");
  });

  it("prefers Step 2 guidance when audit has not run even if review is NONE", () => {
    expect(
      canRecordAccountingHandoff({
        status: "PARSED",
        reviewDecision: "NONE",
      }),
    ).toBe(false);
    expect(
      accountingHandoffBlockedExplanation({
        status: "PARSED",
        reviewDecision: "NONE",
      }),
    ).toBe(
      "Save Step 2 — Finance review as Approve or Override before marking ready for accounting.",
    );
  });

  it("prefers disabledReason when present (FAILED audit)", () => {
    const msg = "Resolve audit errors before recording accounting handoff.";
    expect(
      canRecordAccountingHandoff({
        status: "FAILED",
        reviewDecision: "APPROVED",
        disabledReason: msg,
      }),
    ).toBe(false);
    expect(
      accountingHandoffBlockedExplanation({
        status: "FAILED",
        reviewDecision: "APPROVED",
        disabledReason: msg,
      }),
    ).toBe(msg);
  });

  it("blocks AUDITED when disabledReason is set (defensive)", () => {
    expect(
      canRecordAccountingHandoff({
        status: "AUDITED",
        reviewDecision: "APPROVED",
        disabledReason: "Read only.",
      }),
    ).toBe(false);
    expect(
      accountingHandoffBlockedExplanation({
        status: "AUDITED",
        reviewDecision: "APPROVED",
        disabledReason: "Read only.",
      }),
    ).toBe("Read only.");
  });
});
