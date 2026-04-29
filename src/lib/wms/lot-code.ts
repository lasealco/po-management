/** Empty lot code = fungible / legacy bucket (waves + replenishment automation use this only). */
export const FUNGIBLE_LOT_CODE = "";

/** Normalize inbound lot/batch text for `InventoryBalance.lotCode` / `WmsTask.lotCode`. */
export function normalizeLotCode(raw: string | null | undefined): string {
  if (raw === null || raw === undefined) return FUNGIBLE_LOT_CODE;
  return String(raw).trim().slice(0, 120);
}
