import { describe, expect, it } from "vitest";

import { buildContinuousPlanningPacket, buildPlanControlSnapshot, buildReplanningTriggers, type PlanningInputs } from "./continuous-planning";

const stressedInputs: PlanningInputs = {
  demandUnits: 1300,
  plannedDemandUnits: 1000,
  openSalesOrders: 13,
  supplyUnits: 650,
  plannedSupplyUnits: 950,
  inboundPurchaseOrders: 7,
  inventoryUnits: 400,
  allocatedUnits: 250,
  openWmsTasks: 35,
  transportExceptions: 4,
  lateShipments: 2,
  supplierCommitmentGaps: 3,
  financeRiskScore: 45,
  simulationRecommendationKey: "supply_delay_10_days",
};

describe("buildContinuousPlanningPacket", () => {
  it("creates replanning triggers and recovery actions when plan health is stressed", () => {
    const packet = buildContinuousPlanningPacket(stressedInputs);

    expect(packet.replanningTriggerCount).toBeGreaterThanOrEqual(4);
    expect(packet.recoveryActionCount).toBeGreaterThan(0);
    expect(packet.planHealthScore).toBeLessThan(70);
    expect(packet.recoveryPlan.guardrail).toContain("do not mutate forecasts");
    expect(packet.rollbackPlan.steps[0]).toContain("unchanged");
  });

  it("keeps monitor mode when variances are within thresholds", () => {
    const packet = buildContinuousPlanningPacket({
      demandUnits: 1000,
      plannedDemandUnits: 1000,
      openSalesOrders: 4,
      supplyUnits: 900,
      plannedSupplyUnits: 900,
      inboundPurchaseOrders: 5,
      inventoryUnits: 500,
      allocatedUnits: 100,
      openWmsTasks: 2,
      transportExceptions: 0,
      lateShipments: 0,
      supplierCommitmentGaps: 0,
      financeRiskScore: 5,
      simulationRecommendationKey: "baseline_current_plan",
    });

    expect(packet.replanningTriggerCount).toBe(0);
    expect(packet.recoveryPlan.recommendation).toContain("monitor mode");
    expect(packet.planHealthScore).toBeGreaterThan(80);
  });

  it("adds a simulation-promotion trigger when AMP34 recommends a stress case", () => {
    const snapshot = buildPlanControlSnapshot(stressedInputs);
    const triggers = buildReplanningTriggers(snapshot);

    expect(triggers.triggers.some((trigger) => trigger.key === "simulation_promotion_review")).toBe(true);
  });
});
