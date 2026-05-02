import type { ReplenishmentRule } from "@prisma/client";

/**
 * BF-35 — Order rules for `create_replenishment_tasks`: normal tier first (exceptionQueue = false),
 * then exception tier; within tier **descending effective priority** (`priority` + optional BF-61 boost),
 * then stable product id.
 */
export function sortReplenishmentRulesForBatch(
  rules: ReplenishmentRule[],
  forecastPriorityBoostByRuleId?: ReadonlyMap<string, number>,
): ReplenishmentRule[] {
  const eff = (r: ReplenishmentRule) => r.priority + (forecastPriorityBoostByRuleId?.get(r.id) ?? 0);
  return [...rules].sort((a, b) => {
    const ae = Boolean(a.exceptionQueue);
    const be = Boolean(b.exceptionQueue);
    if (ae !== be) return ae ? 1 : -1;
    const ed = eff(b) - eff(a);
    if (ed !== 0) return ed;
    return a.productId.localeCompare(b.productId);
  });
}
