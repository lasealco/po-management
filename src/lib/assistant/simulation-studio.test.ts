import { describe, expect, it } from "vitest";

import { buildAssumptionLedger, buildSimulationStudioPacket, runSimulationScenarios, type SimulationStudioInputs } from "./simulation-studio";

const inputs: SimulationStudioInputs = {
  networkRecommendationKey: "rebalance_constrained_facilities",
  signals: [
    { id: "demand", domain: "DEMAND", label: "Open demand", currentValue: 1200, unit: "units", confidence: "HIGH", detail: "Open orders", stale: false },
    { id: "supply", domain: "SUPPLY", label: "Inbound supply", currentValue: 700, unit: "units", confidence: "HIGH", detail: "Open POs", stale: false },
    { id: "inventory", domain: "INVENTORY", label: "Available inventory", currentValue: 400, unit: "units", confidence: "MEDIUM", detail: "Inventory proxy", stale: false },
    { id: "transport", domain: "TRANSPORT", label: "Transport exceptions", currentValue: 6, unit: "exceptions", confidence: "MEDIUM", detail: "Open CT exceptions", stale: false },
    { id: "finance", domain: "FINANCE", label: "Finance exposure", currentValue: 2000, unit: "USD", confidence: "LOW", detail: "Finance packet risk", stale: true },
    { id: "risk", domain: "RISK", label: "Risk exposure", currentValue: 12, unit: "score", confidence: "MEDIUM", detail: "Risk war room", stale: false },
  ],
};

describe("buildSimulationStudioPacket", () => {
  it("creates replayable scenarios with a recommendation and guardrails", () => {
    const packet = buildSimulationStudioPacket(inputs);

    expect(packet.scenarioCount).toBe(5);
    expect(packet.assumptionCount).toBe(4);
    expect(packet.recommendedScenarioKey).toBeTruthy();
    expect(packet.replayPlan.steps[0]).toContain("Freeze");
    expect(packet.approvalPlan.guardrail).toContain("queues simulation review only");
    expect(packet.rollbackPlan.steps[0]).toContain("unchanged");
  });

  it("tracks stale signals in the assumption ledger", () => {
    const ledger = buildAssumptionLedger(inputs);

    expect(ledger.dataFreshnessRiskCount).toBe(1);
    expect(ledger.guardrail).toContain("do not update forecasts");
  });

  it("runs deterministic stress scenarios", () => {
    const runs = runSimulationScenarios(inputs);
    const demandSpike = runs.runs.find((run) => run.key === "demand_spike_15pct");
    const baseline = runs.runs.find((run) => run.key === "baseline_current_plan");

    expect(demandSpike?.simulatedDemand).toBe(1380);
    expect(baseline?.simulatedSupply).toBe(1100);
    expect(demandSpike?.gapUnits).toBeGreaterThan(baseline?.gapUnits ?? 0);
  });
});
