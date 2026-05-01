import { describe, expect, it } from "vitest";

import { buildFinanceCashControlPacket, type FinanceCashControlInputs } from "./finance-cash-controls";

const inputs: FinanceCashControlInputs = {
  financePackets: [{ id: "finance-1", title: "Finance control", status: "DRAFT", riskScore: 72, currency: "USD", totalVariance: -2400, disputeAmount: 1800, accrualAmount: 3200 }],
  revenuePackets: [{ id: "rev-1", title: "Revenue ops", status: "DRAFT", revenueScore: 68, quoteCount: 2, pricingRiskCount: 1, feasibilityRiskCount: 1 }],
  commercialPackets: [{ id: "commercial-1", title: "Commercial control", status: "DRAFT", commercialScore: 70, marginLeakageCount: 2, invoiceRiskCount: 1, quoteRiskCount: 1, contractRiskCount: 1 }],
  invoiceIntakes: [
    { id: "intake-1", externalInvoiceNo: "INV-1", vendorLabel: "Carrier A", status: "PARSED", currency: "USD", rollupOutcome: "FAIL", redLineCount: 1, amberLineCount: 2, approvedForAccounting: false, financeHandoffStatus: "DRAFT", accountingApprovedAt: null },
    { id: "intake-2", externalInvoiceNo: "INV-2", vendorLabel: "Carrier B", status: "PARSED", currency: "USD", rollupOutcome: "PASS", redLineCount: 0, amberLineCount: 0, approvedForAccounting: true, financeHandoffStatus: "APPROVED", accountingApprovedAt: "2026-04-29T00:00:00.000Z" },
  ],
  financialSnapshots: [
    { id: "snap-1", shipmentId: "ship-1", shipmentNo: "S-1", currency: "USD", internalRevenue: 10000, internalCost: 12500, internalNet: -2500, internalMarginPct: -0.25, asOf: "2026-04-29T00:00:00.000Z" },
  ],
  shipmentCostLines: [{ id: "cost-1", shipmentId: "ship-1", shipmentNo: "S-1", vendorName: "Carrier A", currency: "USD", amount: 2500, status: "RECORDED", occurredAt: "2026-04-29T00:00:00.000Z" }],
  wmsInvoiceRuns: [{ id: "wms-1", runNo: "WMS-1", status: "DRAFT", totalAmount: 1200, currency: "USD", periodFrom: "2026-04-01T00:00:00.000Z", periodTo: "2026-04-29T00:00:00.000Z", lineCount: 0 }],
  quotes: [{ id: "quote-1", title: "Quote 1", status: "DRAFT", accountName: "ACME", subtotal: 5000, currency: "USD", validUntil: "2026-05-05T00:00:00.000Z", daysUntilExpiry: 6 }],
  salesOrders: [{ id: "so-1", soNumber: "SO-1", status: "OPEN", customerName: "ACME", currency: "USD", totalValue: 9000, lineCount: 1 }],
  actionQueue: [{ id: "action-1", actionKind: "finance_cash_controller_review", status: "PENDING", priority: "HIGH", objectType: "assistant_finance_cash_control_packet" }],
};

describe("buildFinanceCashControlPacket", () => {
  it("builds finance, cash, accounting, billing, and close-control evidence", () => {
    const packet = buildFinanceCashControlPacket(inputs);

    expect(packet.title).toContain("Sprint 12 Finance Cash Control");
    expect(packet.cashPosture.cashExposureAmount).toBeGreaterThan(0);
    expect(packet.receivables.receivableRiskAmount).toBeGreaterThan(0);
    expect(packet.payables.riskyInvoiceCount).toBe(1);
    expect(packet.accountingHandoff.accountingBlockerCount).toBeGreaterThan(0);
    expect(packet.marginLeakage.negativeMarginCount).toBe(1);
    expect(packet.warehouseBilling.billingExceptionCount).toBeGreaterThan(0);
    expect(packet.closeControl.closeControlGapCount).toBeGreaterThan(0);
    expect(packet.leadershipSummary).toContain("Sprint 12 Finance, Cash & Accounting Controls score");
  });

  it("excludes POST_DISPUTED WMS runs from pending billing cash exposure", () => {
    const withPostedDisputed: FinanceCashControlInputs = {
      ...inputs,
      wmsInvoiceRuns: [
        { id: "wms-draft", runNo: "WMS-D", status: "DRAFT", totalAmount: 500, currency: "USD", periodFrom: "2026-04-01T00:00:00.000Z", periodTo: "2026-04-15T00:00:00.000Z", lineCount: 1 },
        { id: "wms-disputed", runNo: "WMS-P", status: "POST_DISPUTED", totalAmount: 900, currency: "USD", periodFrom: "2026-04-01T00:00:00.000Z", periodTo: "2026-04-15T00:00:00.000Z", lineCount: 1 },
      ],
    };
    const packet = buildFinanceCashControlPacket(withPostedDisputed);
    expect(packet.cashPosture.pendingBilling).toBe(500);
    expect(packet.warehouseBilling.pendingBillingAmount).toBe(500);
  });

  it("keeps financial execution review-gated", () => {
    const packet = buildFinanceCashControlPacket(inputs);

    expect(packet.cashPosture.guardrail).toContain("does not post invoices");
    expect(packet.receivables.guardrail).toContain("does not invoice customers");
    expect(packet.payables.guardrail).toContain("does not approve invoices");
    expect(packet.accountingHandoff.guardrail).toContain("does not mark approvals");
    expect(packet.marginLeakage.guardrail).toContain("does not change shipment costs");
    expect(packet.warehouseBilling.guardrail).toContain("does not post invoice runs");
    expect(packet.closeControl.guardrail).toContain("do not close accounting periods");
    expect(packet.responsePlan.guardrail).toContain("review-only");
    expect(packet.rollbackPlan.guardrail).toContain("does not reverse accounting entries");
  });
});
