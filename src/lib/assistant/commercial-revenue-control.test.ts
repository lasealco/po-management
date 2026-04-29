import { describe, expect, it } from "vitest";

import { buildCommercialRevenueControlPacket, type CommercialRevenueControlInputs } from "./commercial-revenue-control";

const inputs: CommercialRevenueControlInputs = {
  revenuePackets: [
    { id: "rev-1", title: "Revenue ops review", status: "DRAFT", revenueScore: 58, quoteCount: 2, opportunityCount: 1, feasibilityRiskCount: 2, pricingRiskCount: 2, approvalStepCount: 3, selectedQuoteId: "quote-1" },
  ],
  financePackets: [
    { id: "fin-1", title: "Finance leakage packet", status: "FINANCE_REVIEW", riskScore: 72, currency: "USD", totalVariance: -1250, disputeAmount: 4300, accrualAmount: 9000 },
  ],
  contractPackets: [
    { id: "contract-1", title: "Contract compliance packet", status: "DRAFT", complianceScore: 68, obligationCount: 8, complianceGapCount: 2, renewalRiskCount: 1 },
  ],
  customerBriefs: [{ id: "brief-1", title: "Strategic customer brief", status: "DRAFT", serviceScore: 62 }],
  quotes: [
    { id: "quote-1", title: "Large proposal", status: "DRAFT", quoteNumber: "Q-100", accountName: "ABC Corp", subtotal: 50000, currency: "USD", lineCount: 0, validUntil: "2026-05-05T00:00:00.000Z", daysUntilExpiry: 3 },
  ],
  salesOrders: [
    { id: "so-1", soNumber: "SO-1", status: "OPEN", customerName: "ABC Corp", currency: "USD", lineCount: 1, totalValue: 12000, assistantReviewStatus: "NEEDS_REVIEW" },
  ],
  pricingSnapshots: [
    { id: "snapshot-1", sourceType: "CONTRACT_VERSION", sourceSummary: null, currency: "USD", totalEstimatedCost: 0, frozenAt: "2026-04-29T00:00:00.000Z", basisSide: null, incoterm: null },
  ],
  invoiceIntakes: [
    { id: "invoice-1", externalInvoiceNo: "INV-1", vendorLabel: "Carrier A", status: "AUDITED", currency: "USD", rollupOutcome: "FAIL", redLineCount: 2, amberLineCount: 1, approvedForAccounting: false },
  ],
  actionQueue: [
    { id: "action-1", actionKind: "customer_reply_review", status: "PENDING", priority: "HIGH", objectType: "customer_brief" },
    { id: "action-2", actionKind: "commercial_quote_review", status: "PENDING", priority: "HIGH", objectType: "quote" },
  ],
};

describe("buildCommercialRevenueControlPacket", () => {
  it("aggregates quote-to-cash, pricing, invoice, margin, contract, and customer risks", () => {
    const packet = buildCommercialRevenueControlPacket(inputs);

    expect(packet.commercialScore).toBeLessThan(75);
    expect(packet.quoteToCash.quoteRiskCount).toBeGreaterThanOrEqual(4);
    expect(packet.pricingDiscipline.pricingRiskCount).toBeGreaterThanOrEqual(5);
    expect(packet.invoiceAudit.invoiceRiskCount).toBe(1);
    expect(packet.marginLeakage.marginLeakageCount).toBe(1);
    expect(packet.contractHandoff.contractRiskCount).toBe(4);
    expect(packet.customerCommercial.customerRiskCount).toBe(2);
    expect(packet.responsePlan.status).toBe("COMMERCIAL_CONTROL_REVIEW_REQUIRED");
    expect(packet.leadershipSummary).toContain("Sprint 6 Commercial & Revenue Control score");
  });

  it("keeps commercial execution review-gated", () => {
    const packet = buildCommercialRevenueControlPacket(inputs);

    expect(packet.quoteToCash.guardrail).toContain("does not change quotes");
    expect(packet.pricingDiscipline.guardrail).toContain("does not update quote amounts");
    expect(packet.invoiceAudit.guardrail).toContain("does not approve invoices");
    expect(packet.customerCommercial.guardrail).toContain("is sent automatically");
    expect(packet.contractHandoff.guardrail).toContain("does not create, amend, send, approve, or sign contracts");
    expect(packet.rollbackPlan.steps.join(" ")).toContain("customer communications unchanged");
  });
});
