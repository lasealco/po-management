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
};

describe("advanced programs", () => {
  it("defines AMP37 through AMP47", () => {
    const configs = listAdvancedProgramConfigs();

    expect(configs).toHaveLength(11);
    expect(configs[0]?.ampNumber).toBe(37);
    expect(configs[10]?.ampNumber).toBe(47);
  });

  it("builds a distinct packet with guardrails for category strategy", () => {
    const packet = buildAdvancedProgramPacket({ programKey: "category-strategy", signals });

    expect(packet.ampNumber).toBe(47);
    expect(packet.riskCount).toBeGreaterThan(0);
    expect(packet.approvalPlan.steps.map((step) => step.owner)).toContain("Procurement");
    expect(packet.rollbackPlan.steps[0]).toContain("supplier panels");
  });

  it("returns null for unknown program keys", () => {
    expect(getAdvancedProgramConfig("missing")).toBeNull();
  });
});
