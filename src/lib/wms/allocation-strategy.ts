import type { WmsPickAllocationStrategy } from "@prisma/client";

import { FUNGIBLE_LOT_CODE } from "./lot-code";

export type WavePickSlot = {
  binId: string;
  binCode: string;
  available: number;
  /** Balance bucket (`InventoryBalance.lotCode`); waves besides FEFO use fungible only. */
  lotCode: string;
  /** Ascending sort key for `FEFO_BY_LOT_EXPIRY` (`Date#getTime`); ignored by other strategies. */
  expirySortMs: number;
};

/** Order bins (and lot buckets) for automated wave splitting (`create_pick_wave`). */
export function orderPickSlotsForWave(
  strategy: WmsPickAllocationStrategy,
  slots: WavePickSlot[],
): WavePickSlot[] {
  const copy = slots.map((s) => ({ ...s }));
  switch (strategy) {
    case "MAX_AVAILABLE_FIRST":
      copy.sort(
        (a, b) =>
          b.available - a.available ||
          a.binCode.localeCompare(b.binCode) ||
          a.binId.localeCompare(b.binId),
      );
      break;
    case "FIFO_BY_BIN_CODE":
      copy.sort(
        (a, b) =>
          a.binCode.localeCompare(b.binCode) || a.binId.localeCompare(b.binId),
      );
      break;
    case "FEFO_BY_LOT_EXPIRY":
      copy.sort(
        (a, b) =>
          a.expirySortMs - b.expirySortMs ||
          a.binCode.localeCompare(b.binCode) ||
          a.lotCode.localeCompare(b.lotCode) ||
          a.binId.localeCompare(b.binId),
      );
      break;
    case "MANUAL_ONLY":
      return [];
  }
  return copy;
}

/** Slots for legacy tests — fungible bucket only. */
export function fungibleWaveSlot(partial: Omit<WavePickSlot, "lotCode" | "expirySortMs">): WavePickSlot {
  return {
    ...partial,
    lotCode: FUNGIBLE_LOT_CODE,
    expirySortMs: 0,
  };
}
