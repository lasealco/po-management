import { describe, expect, it } from "vitest";

import {
  buildWarehouseCapacitySummary,
  buildWarehouseRecoveryPlan,
  scoreWarehouseCapacity,
  summarizeTaskBottlenecks,
} from "./warehouse-capacity";

const openTasks = [
  { id: "1", taskType: "PICK", quantity: 4, ageHours: 30, productName: "A", orderNumber: "PO1" },
  { id: "2", taskType: "PICK", quantity: 2, ageHours: 2, productName: "B", orderNumber: "PO2" },
  { id: "3", taskType: "PUTAWAY", quantity: 3, ageHours: 4, productName: "C", orderNumber: null },
];

describe("warehouse capacity helpers", () => {
  it("penalizes open and aged work", () => {
    const overloaded = scoreWarehouseCapacity({ openTasks, heldBalanceCount: 2, releasedOutboundCount: 3 });
    const empty = scoreWarehouseCapacity({ openTasks: [], heldBalanceCount: 0, releasedOutboundCount: 0 });
    expect(empty).toBeGreaterThan(overloaded);
  });

  it("summarizes task bottlenecks by type", () => {
    const rows = summarizeTaskBottlenecks(openTasks);
    expect(rows[0]?.taskType).toBe("PICK");
    expect(rows[0]?.count).toBe(2);
    expect(rows[0]?.aged).toBe(1);
  });

  it("builds recovery plan with no silent mutation guardrail", () => {
    const plan = buildWarehouseRecoveryPlan({
      warehouseName: "Demo DC",
      openTasks,
      heldBalanceCount: 1,
      releasedOutboundCount: 2,
    });
    expect(plan.actions.join(" ")).toContain("Do not complete WMS tasks");
    expect(plan.status).not.toBe("CAPACITY_READY");
  });

  it("builds a supervisor-friendly summary", () => {
    const plan = buildWarehouseRecoveryPlan({ warehouseName: "Demo DC", openTasks, heldBalanceCount: 0, releasedOutboundCount: 0 });
    const summary = buildWarehouseCapacitySummary(plan);
    expect(summary).toContain("Demo DC capacity score");
    expect(summary).toContain("human approval");
  });
});
