import type { ReplenishmentRule } from "@prisma/client";

/**
 * BF-35 — Order rules for `create_replenishment_tasks`: normal tier first (exceptionQueue = false),
 * then exception tier; within tier **descending priority**, then stable product id.
 */
export function sortReplenishmentRulesForBatch(rules: ReplenishmentRule[]): ReplenishmentRule[] {
  return [...rules].sort((a, b) => {
    const ae = Boolean(a.exceptionQueue);
    const be = Boolean(b.exceptionQueue);
    if (ae !== be) return ae ? 1 : -1;
    if (b.priority !== a.priority) return b.priority - a.priority;
    return a.productId.localeCompare(b.productId);
  });
}
