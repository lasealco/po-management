import { describe, expect, it } from "vitest";

import { buildNetworkDesignPacket, buildNetworkRiskExposure, type NetworkDesignInputs } from "./network-design";

const baseInputs: NetworkDesignInputs = {
  facilities: [
    {
      id: "wh-1",
      code: "FRA-DC",
      name: "Frankfurt DC",
      city: "Frankfurt",
      countryCode: "DE",
      isActive: true,
      onHandQty: 100,
      allocatedQty: 92,
      openTaskCount: 34,
    },
    {
      id: "wh-2",
      code: "CHI-DC",
      name: "Chicago DC",
      city: "Chicago",
      countryCode: "US",
      isActive: true,
      onHandQty: 140,
      allocatedQty: 40,
      openTaskCount: 4,
    },
  ],
  lanes: [
    { id: "lane-1", originCode: "FRA", destinationCode: "CHI", mode: "OCEAN", shipmentCount: 6, totalWeightKg: 8000, totalVolumeCbm: 32, exceptionCount: 2 },
    { id: "lane-2", originCode: "HAM", destinationCode: "NYC", mode: "OCEAN", shipmentCount: 1, totalWeightKg: 1200, totalVolumeCbm: 8, exceptionCount: 0 },
    { id: "lane-3", originCode: "DUS", destinationCode: "ATL", mode: "AIR", shipmentCount: 1, totalWeightKg: 200, totalVolumeCbm: 1, exceptionCount: 0 },
  ],
  suppliers: [
    { id: "sup-1", name: "North Supplier", countryCode: "DE", category: "product", openPoCount: 4 },
    { id: "sup-2", name: "South Supplier", countryCode: "DE", category: "product", openPoCount: 2 },
  ],
  customers: [
    { id: "cust-1", name: "Acme", segment: "Enterprise", strategicFlag: true, openOrderCount: 8 },
    { id: "cust-2", name: "Beta", segment: "Growth", strategicFlag: false, openOrderCount: 2 },
  ],
};

describe("buildNetworkDesignPacket", () => {
  it("recommends facility rebalancing when constrained nodes create service risk", () => {
    const packet = buildNetworkDesignPacket(baseInputs);

    expect(packet.recommendedScenarioKey).toBe("rebalance_constrained_facilities");
    expect(packet.facilityCount).toBe(2);
    expect(packet.scenarioCount).toBe(4);
    expect(packet.serviceRiskCount).toBeGreaterThan(0);
    expect(packet.approvalPlan.guardrail).toContain("does not mutate network master data");
    expect(packet.rollbackPlan.steps[0]).toContain("unchanged");
  });

  it("surfaces supplier concentration as a cost and resilience risk", () => {
    const risk = buildNetworkRiskExposure(baseInputs);

    expect(risk.supplierConcentration.countryCode).toBe("DE");
    expect(risk.supplierConcentration.pct).toBe(100);
    expect(risk.costRisks.some((item) => item.type === "SUPPLIER_REGION_CONCENTRATION")).toBe(true);
  });

  it("keeps a stable no-change recommendation when risk is low", () => {
    const packet = buildNetworkDesignPacket({
      facilities: [
        { id: "wh-1", code: "A", name: "A", city: "A", countryCode: "US", isActive: true, onHandQty: 100, allocatedQty: 20, openTaskCount: 2 },
      ],
      lanes: [{ id: "lane-1", originCode: "A", destinationCode: "B", mode: "ROAD", shipmentCount: 10, totalWeightKg: 1000, totalVolumeCbm: 10, exceptionCount: 0 }],
      suppliers: [{ id: "sup-1", name: "Supplier", countryCode: "US", category: "product", openPoCount: 1 }],
      customers: [{ id: "cust-1", name: "Customer", segment: null, strategicFlag: false, openOrderCount: 1 }],
    });

    expect(packet.recommendedScenarioKey).toBe("baseline_no_change");
    expect(packet.serviceRiskCount).toBe(0);
    expect(packet.costRiskCount).toBe(0);
  });
});
