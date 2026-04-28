import { describe, expect, it } from "vitest";

import {
  buildAccountingPacket,
  buildDisputeDraft,
  buildFinanceHandoffSummary,
  parseInvoiceFinanceHandoffStatus,
  type InvoiceFinanceHandoffLine,
} from "./finance-handoff";

const lines: InvoiceFinanceHandoffLine[] = [
  {
    lineNo: 1,
    description: "Ocean freight",
    currency: "USD",
    amount: "1200",
    outcome: "RED",
    expectedAmount: "1000",
    amountVariance: "200",
    explanation: "Invoice exceeds frozen snapshot.",
  },
  {
    lineNo: 2,
    description: "Docs",
    currency: "USD",
    amount: "50",
    outcome: "GREEN",
    expectedAmount: "50",
    amountVariance: "0",
    explanation: "Matched.",
  },
];

describe("parseInvoiceFinanceHandoffStatus", () => {
  it("normalizes valid statuses", () => {
    expect(parseInvoiceFinanceHandoffStatus("accounting_ready")).toBe("ACCOUNTING_READY");
  });

  it("rejects invalid statuses", () => {
    expect(parseInvoiceFinanceHandoffStatus("POSTED")).toBeNull();
  });
});

describe("finance handoff drafts", () => {
  it("builds summary, dispute draft, and accounting packet", () => {
    const summary = buildFinanceHandoffSummary({
      vendorLabel: "Carrier",
      externalInvoiceNo: "INV-1",
      rollupOutcome: "FAIL",
      currency: "USD",
      snapshotTotal: "1050",
      snapshotSourceSummary: "RFQ quote",
      lines,
    });
    expect(summary).toContain("audited as FAIL");
    expect(summary).toContain("1 attention line");

    expect(buildDisputeDraft({ vendorLabel: "Carrier", externalInvoiceNo: "INV-1", lines })).toContain("Ocean freight");
    expect(
      buildAccountingPacket({
        intakeId: "i1",
        snapshotId: "s1",
        rollupOutcome: "FAIL",
        reviewDecision: "OVERRIDDEN",
        approvedForAccounting: true,
        summary,
        lines,
      }).attentionLines,
    ).toHaveLength(1);
  });
});
