/**
 * BF-16 + BF-48 — Inventory mutation matrix beyond BF-06 coarse `inventory` tier.
 * Lot-metadata and serial-registry slices are driven by `wms-field-acl-matrix.json`.
 */

import { inventoryAclKindForAction, loadWmsFieldAclMatrix } from "./wms-field-acl-matrix";

/** @deprecated Prefer `loadWmsFieldAclMatrix().inventory.lotMetadataOnly` — snapshot for doc parity / grep. */
export const WMS_POST_ACTIONS_LOT_METADATA_SCOPED = new Set(loadWmsFieldAclMatrix().inventory.lotMetadataOnly);

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
  inventorySerialEdit: boolean;
}): WmsInventoryPostMutationDecision {
  const { action, legacyWmsEdit, inventoryEdit, inventoryLotEdit, inventorySerialEdit } = opts;
  const kind = inventoryAclKindForAction(action);

  if (kind === "lot_metadata") {
    if (legacyWmsEdit || inventoryEdit || inventoryLotEdit) return { allowed: true };
    return {
      allowed: false,
      error: `Forbidden: requires org.wms → edit, org.wms.inventory → edit, or org.wms.inventory.lot → edit for action "${action}".`,
    };
  }

  if (kind === "serial_registry") {
    if (legacyWmsEdit || inventoryEdit || inventorySerialEdit) return { allowed: true };
    return {
      allowed: false,
      error: `Forbidden: requires org.wms → edit, org.wms.inventory → edit, or org.wms.inventory.serial → edit for action "${action}".`,
    };
  }

  if (legacyWmsEdit || inventoryEdit) return { allowed: true };
  return {
    allowed: false,
    error: `Forbidden: requires org.wms → edit or org.wms.inventory → edit for action "${action}".`,
  };
}
