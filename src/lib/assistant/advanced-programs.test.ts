import { describe, expect, it } from "vitest";

import { buildAdvancedProgramPacket, getAdvancedProgramConfig, listAdvancedProgramConfigs, type AdvancedProgramSignals } from "./advanced-programs";

const signals: AdvancedProgramSignals = {
  products: 10,
  activeSuppliers: 1,
  supplierDocs: 1,
  expiringSupplierDocs: 2,
  productDocs: 0,
  inventoryRows: 5,
  onHandUnits: 20,
  allocatedUnits: 18,
  heldInventoryRows: 2,
  openWmsTasks: 40,
  openPurchaseOrders: 7,
  openSalesOrders: 8,
  shipments: 12,
  shipmentExceptions: 3,
  crmQuotes: 4,
  tariffContracts: 0,
  financeRiskScore: 80,
  contractRiskCount: 2,
  planningHealthScore: 48,
  simulationRiskCount: 2,
  networkRiskCount: 1,
  invoiceIntakes: 0,
  openActionItems: 8,
  evidenceRecords: 1,
  staleEvidenceRecords: 2,
  reviewExamples: 0,
  activePlaybooks: 0,
  activePlaybookRuns: 3,
  auditEvents: 12,
};

describe("advanced programs", () => {
  it("defines AMP37 through AMP100 with requested AMP64-100 programs", () => {
    const configs = listAdvancedProgramConfigs();

    expect(configs).toHaveLength(63);
    expect(configs[0]?.ampNumber).toBe(37);
    expect(configs[25]?.ampNumber).toBe(62);
    expect(configs[26]?.ampNumber).toBe(64);
    expect(configs[62]?.ampNumber).toBe(100);
  });

  it("builds a distinct packet with guardrails for category strategy", () => {
    const packet = buildAdvancedProgramPacket({ programKey: "category-strategy", signals });

    expect(packet.ampNumber).toBe(47);
    expect(packet.riskCount).toBeGreaterThan(0);
    expect(packet.approvalPlan.steps.map((step) => step.owner)).toContain("Procurement");
    expect(packet.rollbackPlan.steps[0]).toContain("supplier panels");
  });

  it("builds governed metric packets with lineage guardrails", () => {
    const packet = buildAdvancedProgramPacket({ programKey: "semantic-metrics", signals });

    expect(packet.ampNumber).toBe(55);
    expect(packet.riskCount).toBeGreaterThan(0);
    expect(packet.recommendation.primaryRecommendation).toContain("metric owner");
    expect(packet.leadershipSummary).toContain("does not mutate metric definitions");
  });

  it("builds executive cockpit packets with autonomy guardrails", () => {
    const packet = buildAdvancedProgramPacket({ programKey: "executive-cockpit", signals });

    expect(packet.ampNumber).toBe(62);
    expect(packet.riskCount).toBeGreaterThan(0);
    expect(packet.approvalPlan.steps.map((step) => step.owner)).toContain("Executive sponsor");
    expect(packet.rollbackPlan.steps[0]).toContain("autonomy policies");
  });

  it("builds human review operations packets with queue guardrails", () => {
    const packet = buildAdvancedProgramPacket({ programKey: "human-review-ops", signals });

    expect(packet.ampNumber).toBe(100);
    expect(packet.riskCount).toBeGreaterThan(0);
    expect(packet.approvalPlan.steps.map((step) => step.owner)).toContain("Operations manager");
    expect(packet.rollbackPlan.steps[0]).toContain("review queues");
  });

  it("returns null for unknown program keys", () => {
    expect(getAdvancedProgramConfig("missing")).toBeNull();
  });
});
