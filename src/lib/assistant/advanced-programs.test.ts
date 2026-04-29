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
  it("defines AMP37 through AMP462 with requested AMP401-462 programs", () => {
    const configs = listAdvancedProgramConfigs();

    expect(configs).toHaveLength(425);
    expect(configs[0]?.ampNumber).toBe(37);
    expect(configs[25]?.ampNumber).toBe(62);
    expect(configs[26]?.ampNumber).toBe(64);
    expect(configs[62]?.ampNumber).toBe(100);
    expect(configs[63]?.ampNumber).toBe(101);
    expect(configs[124]?.ampNumber).toBe(162);
    expect(configs[125]?.ampNumber).toBe(163);
    expect(configs[127]?.ampNumber).toBe(165);
    expect(configs[128]?.ampNumber).toBe(166);
    expect(configs[162]?.ampNumber).toBe(200);
    expect(configs[163]?.ampNumber).toBe(201);
    expect(configs[224]?.ampNumber).toBe(262);
    expect(configs[225]?.ampNumber).toBe(263);
    expect(configs[227]?.ampNumber).toBe(265);
    expect(configs[228]?.ampNumber).toBe(266);
    expect(configs[262]?.ampNumber).toBe(300);
    expect(configs[263]?.ampNumber).toBe(301);
    expect(configs[324]?.ampNumber).toBe(362);
    expect(configs[325]?.ampNumber).toBe(363);
    expect(configs[362]?.ampNumber).toBe(400);
    expect(configs[363]?.ampNumber).toBe(401);
    expect(configs[424]?.ampNumber).toBe(462);
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

  it("builds enterprise learning packets with no self-modifying guardrails", () => {
    const packet = buildAdvancedProgramPacket({ programKey: "enterprise-learning", signals });

    expect(packet.ampNumber).toBe(162);
    expect(packet.riskCount).toBeGreaterThan(0);
    expect(packet.approvalPlan.steps.map((step) => step.owner)).toContain("AI quality");
    expect(packet.rollbackPlan.steps[0]).toContain("autonomous behavior");
  });

  it("builds FinOps packets with budget guardrails", () => {
    const packet = buildAdvancedProgramPacket({ programKey: "cloud-finops", signals });

    expect(packet.ampNumber).toBe(165);
    expect(packet.riskCount).toBeGreaterThan(0);
    expect(packet.approvalPlan.steps.map((step) => step.owner)).toContain("FinOps");
    expect(packet.rollbackPlan.steps[0]).toContain("cloud budgets");
  });

  it("builds EDR packets with endpoint containment guardrails", () => {
    const packet = buildAdvancedProgramPacket({ programKey: "edr-workflow", signals });

    expect(packet.ampNumber).toBe(200);
    expect(packet.riskCount).toBeGreaterThan(0);
    expect(packet.approvalPlan.steps.map((step) => step.owner)).toContain("Security operations");
    expect(packet.rollbackPlan.steps[0]).toContain("device containment");
  });

  it("builds industry network packets with cross-industry autonomy guardrails", () => {
    const packet = buildAdvancedProgramPacket({ programKey: "industry-operating-network", signals });

    expect(packet.ampNumber).toBe(262);
    expect(packet.riskCount).toBeGreaterThan(0);
    expect(packet.approvalPlan.steps.map((step) => step.owner)).toContain("Executive sponsor");
    expect(packet.rollbackPlan.steps[0]).toContain("autonomous learning behavior");
  });

  it("builds strategic scenario portfolio packets with scenario promotion guardrails", () => {
    const packet = buildAdvancedProgramPacket({ programKey: "strategic-scenario-portfolio", signals });

    expect(packet.ampNumber).toBe(265);
    expect(packet.riskCount).toBeGreaterThan(0);
    expect(packet.approvalPlan.steps.map((step) => step.owner)).toContain("Strategy");
    expect(packet.rollbackPlan.steps[0]).toContain("scenario libraries");
    expect(packet.leadershipSummary).toContain("does not mutate scenario libraries");
  });

  it("builds value stream command packets with improvement guardrails", () => {
    const packet = buildAdvancedProgramPacket({ programKey: "value-stream-command", signals });

    expect(packet.ampNumber).toBe(300);
    expect(packet.riskCount).toBeGreaterThan(0);
    expect(packet.approvalPlan.steps.map((step) => step.owner)).toContain("Operations excellence");
    expect(packet.rollbackPlan.steps[0]).toContain("value-stream maps");
    expect(packet.leadershipSummary).toContain("does not mutate value-stream maps");
  });

  it("builds autonomous enterprise operating system v2 packets with self-expansion guardrails", () => {
    const packet = buildAdvancedProgramPacket({ programKey: "enterprise-operating-system-v2", signals });

    expect(packet.ampNumber).toBe(362);
    expect(packet.riskCount).toBeGreaterThan(0);
    expect(packet.approvalPlan.steps.map((step) => step.owner)).toContain("Executive sponsor");
    expect(packet.rollbackPlan.steps[0]).toContain("enterprise goals");
    expect(packet.leadershipSummary).toContain("does not mutate enterprise goals");
  });

  it("builds physical security operations packets with site response guardrails", () => {
    const packet = buildAdvancedProgramPacket({ programKey: "physical-security-operations", signals });

    expect(packet.ampNumber).toBe(400);
    expect(packet.riskCount).toBeGreaterThan(0);
    expect(packet.approvalPlan.steps.map((step) => step.owner)).toContain("Security");
    expect(packet.rollbackPlan.steps[0]).toContain("site incidents");
    expect(packet.leadershipSummary).toContain("does not mutate site incidents");
  });

  it("builds autonomous enterprise operating system v3 packets with adaptive governance guardrails", () => {
    const packet = buildAdvancedProgramPacket({ programKey: "enterprise-operating-system-v3", signals });

    expect(packet.ampNumber).toBe(462);
    expect(packet.riskCount).toBeGreaterThan(0);
    expect(packet.approvalPlan.steps.map((step) => step.owner)).toContain("Executive sponsor");
    expect(packet.rollbackPlan.steps[0]).toContain("enterprise goals");
    expect(packet.leadershipSummary).toContain("does not mutate enterprise goals");
  });

  it("returns null for unknown program keys", () => {
    expect(getAdvancedProgramConfig("missing")).toBeNull();
  });
});
