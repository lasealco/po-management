import type { InventoryBalance, ReplenishmentRule } from "@prisma/client";

import { FUNGIBLE_LOT_CODE, normalizeLotCode } from "./lot-code";

/**
 * UTC calendar date of the Monday for the week containing `from` (used for `WmsDemandForecastStub.weekStart`).
 */
export function utcIsoWeekMonday(from = new Date()): Date {
  const d = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()));
  const day = d.getUTCDay();
  const diff = (day + 6) % 7;
  d.setUTCDate(d.getUTCDate() - diff);
  return d;
}

/**
 * Parse `YYYY-MM-DD`, normalize to UTC Monday of that week (so any day in the week is accepted).
 */
export function parseWeekStartDateInput(raw: string): { ok: true; date: Date } | { ok: false; error: string } {
  const s = raw.trim();
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return { ok: false, error: "weekStart must be YYYY-MM-DD." };
  const y = Number(m[1]);
  const mo = Number(m[2]) - 1;
  const day = Number(m[3]);
  const dt = new Date(Date.UTC(y, mo, day));
  if (Number.isNaN(dt.getTime())) return { ok: false, error: "Invalid weekStart date." };
  return { ok: true, date: utcIsoWeekMonday(dt) };
}

/** Units of forecast not covered by effective pick-face availability (drives priority boost). */
export function forecastGapQty(forecastQty: number, pickFaceEffective: number): number {
  return Math.max(0, forecastQty - pickFaceEffective);
}

/**
 * Tiered integer boost applied on top of BF-35 `ReplenishmentRule.priority` for batch ordering only.
 */
export function forecastPriorityBoostFromGap(gapQty: number): number {
  if (gapQty <= 0) return 0;
  if (gapQty <= 25) return 5;
  if (gapQty <= 100) return 15;
  if (gapQty <= 500) return 30;
  return 50;
}

type BalanceLike = Pick<InventoryBalance, "id" | "productId" | "lotCode" | "onHold" | "onHandQty" | "allocatedQty"> & {
  bin: { zoneId: string | null; isPickFace: boolean };
};

/**
 * Same effective pick-face quantity as `create_replenishment_tasks` (fungible, not on hold, zone / pick-face filter).
 */
export function pickFaceEffectiveOnHandForReplenRule(
  balances: BalanceLike[],
  rule: Pick<ReplenishmentRule, "productId" | "targetZoneId">,
  softByBalanceId: Map<string, number>,
): number {
  const pickBins = balances.filter(
    (b) =>
      normalizeLotCode(b.lotCode) === FUNGIBLE_LOT_CODE &&
      !b.onHold &&
      b.productId === rule.productId &&
      (rule.targetZoneId ? b.bin.zoneId === rule.targetZoneId : b.bin.isPickFace),
  );
  return pickBins.reduce((s, b) => {
    const eff =
      Number(b.onHandQty) - Number(b.allocatedQty) - (softByBalanceId.get(b.id) ?? 0);
    return s + Math.max(0, eff);
  }, 0);
}

/**
 * Per-rule forecast priority boost for `create_replenishment_tasks` (BF-61 × BF-35).
 */
export function buildForecastPriorityBoostByRuleId(
  rules: Pick<ReplenishmentRule, "id" | "warehouseId" | "productId" | "targetZoneId">[],
  balances: BalanceLike[],
  softByBalanceId: Map<string, number>,
  forecastQtyByWarehouseProduct: Map<string, number>,
): Map<string, number> {
  const out = new Map<string, number>();
  for (const rule of rules) {
    const f =
      forecastQtyByWarehouseProduct.get(`${rule.warehouseId}\t${rule.productId}`) ?? 0;
    const pick = pickFaceEffectiveOnHandForReplenRule(balances, rule, softByBalanceId);
    const gap = forecastGapQty(f, pick);
    const boost = forecastPriorityBoostFromGap(gap);
    if (boost > 0) out.set(rule.id, boost);
  }
  return out;
}
