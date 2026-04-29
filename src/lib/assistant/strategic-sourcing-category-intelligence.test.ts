import { describe, expect, it } from "vitest";

import { buildStrategicSourcingPacket, type StrategicSourcingInputs } from "./strategic-sourcing-category-intelligence";

function sampleInputs(): StrategicSourcingInputs {
  const soon = new Date(Date.now() + 30 * 86_400_000);
  return {
    purchaseOrders: [
      { supplierId: "s1", totalAmount: 500_000 },
      { supplierId: "s1", totalAmount: 400_000 },
      { supplierId: "s2", totalAmount: 50_000 },
    ],
    suppliers: [
      { id: "s1", name: "Acme Logistics", srmCategory: "logistics", approvalStatus: "approved" },
      { id: "s2", name: "Beta Materials", srmCategory: "product", approvalStatus: "pending_approval" },
    ],
    quoteRequests: [
      {
        id: "qr-1",
        title: "Asia outbound lane",
        status: "OPEN",
        quotesDueAt: new Date(Date.now() - 86_400_000),
        responseStatuses: [],
      },
      {
        id: "qr-2",
        title: "EU consolidation",
        status: "OPEN",
        quotesDueAt: new Date(Date.now() - 2 * 86_400_000),
        responseStatuses: ["SUBMITTED"],
      },
    ],
    tariffVersions: [
      {
        id: "tv-1",
        versionNo: 2,
        validTo: soon,
        approvalStatus: "PENDING",
        status: "DRAFT",
        contractTitle: "Ocean FAK 2026",
      },
    ],
    onboardingTasksOpen: [
      { id: "ob-1", supplierId: "s2", supplierName: "Beta Materials", title: "Insurance certificate" },
    ],
    compliancePackets: [{ id: "ccp-1", renewalRiskCount: 2, complianceGapCount: 3 }],
    procurementPackets: [{ id: "tcp-1", tenderRiskCount: 2 }],
  };
}

describe("strategic sourcing category intelligence", () => {
  it("builds Sprint 19 packet with sourcing signals", () => {
    const packet = buildStrategicSourcingPacket(sampleInputs());

    expect(packet.title).toContain("Sprint 19 Strategic Sourcing");
    expect(packet.sourcingScore).toBeLessThan(100);
    expect(packet.concentrationRiskCount).toBeGreaterThan(0);
    expect(packet.rfqPipelineRiskCount).toBeGreaterThan(0);
    expect(packet.tariffCoverageRiskCount).toBeGreaterThan(0);
    expect(packet.supplierPanelRiskCount).toBeGreaterThan(0);
    expect(packet.compliancePortfolioRiskCount).toBeGreaterThan(0);
    expect(packet.savingsPipelineRiskCount).toBeGreaterThan(0);
    expect(packet.responsePlan.status).toContain("REVIEW");
  });

  it("keeps sourcing awards, tariff publishes, and supplier approvals workflow-owned", () => {
    const packet = buildStrategicSourcingPacket(sampleInputs());

    expect(packet.sourceSummary.guardrail).toContain("before launching events");
    expect(packet.spendCategory.guardrail).toContain("do not reallocate");
    expect(packet.rfqPipeline.guardrail).toContain("do not invite carriers");
    expect(packet.tariffCoverage.guardrail).toContain("do not publish tariff");
    expect(packet.supplierPanel.guardrail).toContain("do not approve suppliers");
    expect(packet.rollbackPlan.guardrail).toContain("never auto-reverted");
  });
});
