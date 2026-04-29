import { describe, expect, it } from "vitest";

import { buildCustomerSuccessPacket, type CustomerSuccessInputs } from "./customer-success-account-intelligence";

function sampleInputs(): CustomerSuccessInputs {
  const past = new Date(Date.now() - 5 * 86_400_000);
  const soon = new Date(Date.now() + 3 * 86_400_000);
  return {
    customerBriefs: [
      {
        id: "brief-1",
        title: "Enterprise renewal watch",
        status: "DRAFT",
        serviceScore: 42,
        replyDraft: "Thanks for your patience — we owe you a concrete shipment ETA.",
        approvedReply: null,
      },
    ],
    quotes: [{ id: "q-1", title: "FY renewal bundle", status: "SENT", validUntil: soon }],
    opportunities: [{ id: "opp-1", name: "Northwind rollout", stage: "NEGOTIATION", closeDate: past }],
    salesOrders: [{ id: "so-1", soNumber: "SO-900", status: "OPEN", requestedDeliveryDate: past }],
    shipments: [
      {
        id: "sh-1",
        shipmentNo: "SH-700",
        status: "IN_TRANSIT",
        customerCrmAccountId: "crm-acc",
        expectedReceiveAt: past,
        shippedAt: past,
        receivedAt: null,
      },
    ],
    customerCtExceptions: [
      {
        id: "ct-1",
        severity: "WARN",
        shipmentId: "sh-1",
        shipmentNo: "SH-700",
        customerAccountLabel: "Northwind Trading",
      },
    ],
    invoiceIntakes: [{ id: "inv-1", rollupOutcome: "FAIL" }],
    financePackets: [{ id: "fin-1", title: "March variance sweep", disputeAmount: 12500 }],
  };
}

describe("customer success account intelligence", () => {
  it("builds Sprint 18 packet with dimensional risk counts", () => {
    const packet = buildCustomerSuccessPacket(sampleInputs());

    expect(packet.title).toContain("Sprint 18 Customer Success");
    expect(packet.accountScore).toBeLessThan(100);
    expect(packet.briefRiskCount).toBeGreaterThan(0);
    expect(packet.promiseRiskCount).toBeGreaterThan(0);
    expect(packet.pipelineRiskCount).toBeGreaterThan(0);
    expect(packet.exceptionExposureCount).toBeGreaterThan(0);
    expect(packet.disputeFinanceRiskCount).toBeGreaterThan(0);
    expect(packet.governanceGapCount).toBeGreaterThan(0);
    expect(packet.responsePlan.status).toContain("REVIEW");
  });

  it("states CRM and communications guardrails without implying automation", () => {
    const packet = buildCustomerSuccessPacket(sampleInputs());

    expect(packet.sourceSummary.guardrail).toContain("without posting CRM");
    expect(packet.briefSignals.guardrail).toContain("do not change CRM");
    expect(packet.promiseExecution.guardrail).toContain("do not reschedule");
    expect(packet.replyGovernance.guardrail).toContain("never send");
    expect(packet.rollbackPlan.guardrail).toContain("never auto-reverted");
  });
});
