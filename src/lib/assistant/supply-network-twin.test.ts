import { describe, expect, it } from "vitest";

import { buildSupplyNetworkTwinPacket, type SupplyNetworkTwinInputs } from "./supply-network-twin";

const inputs: SupplyNetworkTwinInputs = {
  twinEntities: [
    { id: "entity-1", entityKind: "supplier", entityKey: "SUP-1", updatedAt: "2026-04-29T00:00:00.000Z" },
    { id: "entity-2", entityKind: "site", entityKey: "WH-1", updatedAt: "2026-04-29T00:00:00.000Z" },
  ],
  twinEdges: [{ id: "edge-1", relation: "ships_to", fromKind: "supplier", toKind: "site" }],
  twinRisks: [
    { id: "risk-1", code: "PORT-DELAY", severity: "HIGH", title: "Port delay risk", acknowledged: false },
    { id: "risk-2", code: "INFO", severity: "LOW", title: "Informational", acknowledged: true },
  ],
  scenarioDrafts: [{ id: "scenario-1", title: "Port delay scenario", status: "draft", updatedAt: "2026-04-29T00:00:00.000Z" }],
  twinInsights: [{ id: "insight-1", status: "OPEN", graphConfidenceScore: 55, summary: "Coverage is incomplete for shipments and customers." }],
  networkPackets: [{ id: "network-1", title: "Network design", status: "DRAFT", networkScore: 62, facilityCount: 1, laneCount: 2, customerNodeCount: 1, supplierNodeCount: 1, scenarioCount: 4, serviceRiskCount: 2, costRiskCount: 1, recommendedScenarioKey: "rebalance_constrained_facilities" }],
  simulationPackets: [{ id: "sim-1", title: "Simulation studio", status: "DRAFT", simulationScore: 58, scenarioCount: 5, dataFreshnessRiskCount: 2, recommendedScenarioKey: "transport_disruption" }],
  planningPackets: [{ id: "plan-1", title: "Planning control", status: "DRAFT", planHealthScore: 60, replanningTriggerCount: 2, demandVariancePct: 18, supplyCoveragePct: 65, inventoryCoveragePct: 20, transportRiskCount: 3, recoveryActionCount: 2 }],
  resiliencePackets: [{ id: "resilience-1", title: "Resilience packet", status: "DRAFT", resilienceScore: 64, partnerGapCount: 1, promiseRiskCount: 2, climateRiskCount: 1, workforceRiskCount: 1, safetySignalCount: 0 }],
  orders: [{ id: "order-1", status: "OPEN", customerName: "ABC Corp", lineCount: 1, totalValue: 12000 }],
  shipments: [{ id: "shipment-1", shipmentNo: "SHP-1", status: "IN_TRANSIT", transportMode: "OCEAN", expectedReceiveAt: "2020-01-01T00:00:00.000Z", receivedAt: null, exceptionCount: 2 }],
  inventory: [{ id: "inventory-1", warehouseCode: "WH1", warehouseName: "Main warehouse", onHandQty: 100, allocatedQty: 95 }],
  suppliers: [{ id: "supplier-1", name: "Supplier A", countryCode: "CN", openPoCount: 3 }],
  customers: [{ id: "customer-1", name: "ABC Corp", segment: "Strategic", strategicFlag: true, openOrderCount: 2 }],
  actionQueue: [{ id: "action-1", actionKind: "network_recovery_review", status: "PENDING", priority: "HIGH", objectType: "shipment" }],
};

describe("buildSupplyNetworkTwinPacket", () => {
  it("aggregates graph, scenario, bottleneck, disruption, and recovery signals", () => {
    const packet = buildSupplyNetworkTwinPacket(inputs);

    expect(packet.graphCoverage.graphNodeCount).toBe(2);
    expect(packet.graphCoverage.graphEdgeCount).toBe(1);
    expect(packet.scenarioCommand.recommendedScenarioKey).toBe("transport_disruption");
    expect(packet.bottleneck.bottleneckCount).toBeGreaterThanOrEqual(3);
    expect(packet.disruption.disruptionRiskCount).toBeGreaterThanOrEqual(3);
    expect(packet.recoveryPlaybook.recoveryActionCount).toBeGreaterThanOrEqual(4);
    expect(packet.confidence.confidenceScore).toBeLessThan(90);
    expect(packet.leadershipSummary).toContain("Sprint 7 Supply Network Twin score");
  });

  it("keeps network and scenario execution review-gated", () => {
    const packet = buildSupplyNetworkTwinPacket(inputs);

    expect(packet.graphCoverage.guardrail).toContain("does not create or mutate twin entities");
    expect(packet.scenarioCommand.guardrail).toContain("does not promote scenarios");
    expect(packet.bottleneck.guardrail).toContain("does not move inventory");
    expect(packet.disruption.guardrail).toContain("does not acknowledge risk signals");
    expect(packet.recoveryPlaybook.guardrail).toContain("do not mutate orders");
    expect(packet.rollbackPlan.steps.join(" ")).toContain("customer promises unchanged");
  });
});
