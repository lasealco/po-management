import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";

import type { ReplenishmentRule } from "@prisma/client";

import { sortReplenishmentRulesForBatch } from "./replenishment-batch";

function mockRule(partial: Partial<ReplenishmentRule> & { id: string; productId: string }): ReplenishmentRule {
  return {
    id: partial.id,
    tenantId: "t1",
    warehouseId: "w1",
    productId: partial.productId,
    sourceZoneId: null,
    targetZoneId: null,
    minPickQty: new Prisma.Decimal(1),
    maxPickQty: new Prisma.Decimal(10),
    replenishQty: new Prisma.Decimal(5),
    isActive: true,
    priority: partial.priority ?? 0,
    maxTasksPerRun: partial.maxTasksPerRun ?? null,
    exceptionQueue: partial.exceptionQueue ?? false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

describe("sortReplenishmentRulesForBatch", () => {
  it("puts exception queue after normal tier", () => {
    const rules = [
      mockRule({ id: "e", productId: "p-e", exceptionQueue: true, priority: 99 }),
      mockRule({ id: "n", productId: "p-n", exceptionQueue: false, priority: 0 }),
    ];
    expect(sortReplenishmentRulesForBatch(rules).map((r) => r.id)).toEqual(["n", "e"]);
  });

  it("sorts by descending priority within tier", () => {
    const rules = [
      mockRule({ id: "a", productId: "p-a", priority: 1 }),
      mockRule({ id: "b", productId: "p-b", priority: 10 }),
      mockRule({ id: "c", productId: "p-c", priority: 5 }),
    ];
    expect(sortReplenishmentRulesForBatch(rules).map((r) => r.id)).toEqual(["b", "c", "a"]);
  });

  it("BF-61 — applies forecast priority boost within tier", () => {
    const rules = [
      mockRule({ id: "low", productId: "p-low", priority: 100 }),
      mockRule({ id: "high", productId: "p-high", priority: 50 }),
    ];
    const boost = new Map<string, number>([["high", 60]]);
    expect(sortReplenishmentRulesForBatch(rules, boost).map((r) => r.id)).toEqual(["high", "low"]);
  });
});
