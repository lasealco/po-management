/** BF-58 — structured freeze reason + optional restricted release grant (see `permission-catalog.ts`). */

export const WMS_INVENTORY_FREEZE_REASON_CODES = [
  "QC_HOLD",
  "RECALL",
  "REGULATORY",
  "DAMAGED",
  "INVESTIGATION",
  "CUSTOMER_RETURN",
  "OTHER",
] as const;

export type WmsInventoryFreezeReasonCode = (typeof WMS_INVENTORY_FREEZE_REASON_CODES)[number];

export const WMS_INVENTORY_HOLD_RELEASE_GRANTS = [
  "org.wms.inventory.hold.release_quality",
  "org.wms.inventory.hold.release_compliance",
] as const;

const REASON_SET = new Set<string>(WMS_INVENTORY_FREEZE_REASON_CODES);
const GRANT_SET = new Set<string>(WMS_INVENTORY_HOLD_RELEASE_GRANTS);

export function normalizeInventoryFreezeReasonCode(
  raw: string | undefined | null,
):
  | { ok: true; code: WmsInventoryFreezeReasonCode }
  | { ok: false; error: string } {
  const s = raw?.trim().toUpperCase() ?? "";
  if (!s) return { ok: false, error: "holdReasonCode is required for apply_inventory_freeze." };
  if (!REASON_SET.has(s)) {
    return {
      ok: false,
      error: `Invalid holdReasonCode. Use one of: ${WMS_INVENTORY_FREEZE_REASON_CODES.join(", ")}.`,
    };
  }
  return { ok: true, code: s as WmsInventoryFreezeReasonCode };
}

export function normalizeHoldReleaseGrantInput(
  raw: string | undefined | null,
): { ok: true; grant: string | null } | { ok: false; error: string } {
  if (raw === undefined || raw === null || String(raw).trim() === "") {
    return { ok: true, grant: null };
  }
  const s = String(raw).trim();
  if (!GRANT_SET.has(s)) {
    return {
      ok: false,
      error: `Invalid holdReleaseGrant. Omit or use one of: ${WMS_INVENTORY_HOLD_RELEASE_GRANTS.join(", ")}.`,
    };
  }
  return { ok: true, grant: s };
}
