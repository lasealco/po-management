import { describe, expect, it } from "vitest";

import { buildRevenueOperationsPacket, selectRevenueQuote, type RevenueOperationsInputs } from "./revenue-operations";

const inputs: RevenueOperationsInputs = {
  opportunityCount: 2,
  openOrderCount: 4,
  inventoryCoveragePct: 18,
  planHealthScore: 48,
  transportRiskCount: 6,
  financeRiskScore: 72,
  contractRiskCount: 1,
  quotes: [
    {
      id: "quote-small",
      title: "Small renewal",
      status: "SENT",
      quoteNumber: "Q-1",
      accountName: "Acme",
      opportunityName: "Renewal",
      opportunityStage: "PROPOSAL_SUBMITTED",
      probability: 70,
      subtotal: 12000,
      currency: "USD",
      lineCount: 2,
      validUntil: "2026-05-01",
      daysUntilExpiry: 20,
      strategicAccount: false,
    },
    {
      id: "quote-strategic",
      title: "Strategic expansion",
      status: "DRAFT",
      quoteNumber: "Q-2",
      accountName: "Globex",
      opportunityName: "Expansion",
      opportunityStage: "NEGOTIATION",
      probability: 60,
      subtotal: 90000,
      currency: "USD",
      lineCount: 3,
      validUntil: "2026-04-30",
      daysUntilExpiry: 3,
      strategicAccount: true,
    },
  ],
};

describe("buildRevenueOperationsPacket", () => {
  it("selects the highest-value strategic draft quote", () => {
    expect(selectRevenueQuote(inputs)?.id).toBe("quote-strategic");
  });

  it("builds approval, customer draft, and contract handoff guardrails", () => {
    const packet = buildRevenueOperationsPacket(inputs);

    expect(packet.selectedQuoteId).toBe("quote-strategic");
    expect(packet.feasibilityRiskCount).toBeGreaterThan(0);
    expect(packet.pricingRiskCount).toBeGreaterThan(0);
    expect(packet.approvalStepCount).toBeGreaterThanOrEqual(4);
    expect(packet.customerDraft.guardrail).toContain("not sent automatically");
    expect(packet.contractHandoff.guardrail).toContain("does not create");
    expect(packet.rollbackPlan.steps[0]).toContain("unchanged");
  });

  it("handles missing quotes without throwing", () => {
    const packet = buildRevenueOperationsPacket({ ...inputs, quotes: [], opportunityCount: 0 });

    expect(packet.selectedQuoteId).toBeNull();
    expect(packet.customerDraft.body).toContain("No quote");
    expect(packet.contractHandoff.readyForHandoff).toBe(false);
  });
});
