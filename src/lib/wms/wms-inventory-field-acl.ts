/**
 * BF-16 — Inventory mutation manifest beyond BF-06 coarse `inventory` tier.
 * Extend {@link WMS_POST_ACTIONS_LOT_METADATA_SCOPED} when adding new lot-metadata-only POST handlers.
 */
export const WMS_POST_ACTIONS_LOT_METADATA_SCOPED = new Set<string>(["set_wms_lot_batch"]);

export type WmsInventoryPostMutationDecision =
  | { allowed: true }
  | { allowed: false; error: string };

/**
 * Pure evaluator (Vitest) — mirrors `gateWmsPostMutation` inventory-tier branch for known POST actions.
 */
export function evaluateWmsInventoryPostMutationAccess(opts: {
  action: string;
  legacyWmsEdit: boolean;
  inventoryEdit: boolean;
  inventoryLotEdit: boolean;
}): WmsInventoryPostMutationDecision {
  const { action, legacyWmsEdit, inventoryEdit, inventoryLotEdit } = opts;
  if (WMS_POST_ACTIONS_LOT_METADATA_SCOPED.has(action)) {
    if (legacyWmsEdit || inventoryEdit || inventoryLotEdit) return { allowed: true };
    return {
      allowed: false,
      error: `Forbidden: requires org.wms → edit, org.wms.inventory → edit, or org.wms.inventory.lot → edit for action "${action}".`,
    };
  }
  if (legacyWmsEdit || inventoryEdit) return { allowed: true };
  return {
    allowed: false,
    error: `Forbidden: requires org.wms → edit or org.wms.inventory → edit for action "${action}".`,
  };
}
