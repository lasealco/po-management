import { describe, expect, it } from "vitest";

import { buildExecutiveNarratives, computeHoldRatePercent } from "./wms-home-kpis";

describe("computeHoldRatePercent", () => {
  it("returns 0 when no balance rows", () => {
    expect(computeHoldRatePercent(3, 0)).toBe(0);
  });

  it("rounds to one decimal", () => {
    expect(computeHoldRatePercent(1, 3)).toBeCloseTo(33.3, 5);
    expect(computeHoldRatePercent(2, 7)).toBeCloseTo(28.6, 5);
  });
});

describe("buildExecutiveNarratives", () => {
  it("states calm OTIF phrasing when no orders are past due", () => {
    const n = buildExecutiveNarratives({
      outboundPastDueCount: 0,
      openPickTasks: 10,
      openReplenishmentTasks: 2,
    });
    expect(n.otif).toContain("No outbound orders");
    expect(n.labor).toContain("Pick workload");
    expect(n.slotting).toContain("Replenishment backlog");
  });

  it("signals OTIF pressure when past due count > 0", () => {
    const n = buildExecutiveNarratives({
      outboundPastDueCount: 3,
      openPickTasks: 0,
      openReplenishmentTasks: 0,
    });
    expect(n.otif).toContain("OTIF pressure");
    expect(n.otif).toContain("3");
  });

  it("labels heavy pick backlog above threshold", () => {
    const n = buildExecutiveNarratives({
      outboundPastDueCount: 0,
      openPickTasks: 81,
      openReplenishmentTasks: 0,
    });
    expect(n.labor).toContain("Heavy");
  });

  it("uses clear replenishment copy when queue is empty", () => {
    const n = buildExecutiveNarratives({
      outboundPastDueCount: 0,
      openPickTasks: 0,
      openReplenishmentTasks: 0,
    });
    expect(n.slotting).toContain("clear");
  });
});
