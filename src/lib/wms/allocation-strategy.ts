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
  /** `WarehouseBin.isPickFace` — used by **GREEDY_RESERVE_PICK_FACE** (BF-23). */
  isPickFace: boolean;
  /**
   * BF-33 — `WarehouseBin.capacityCubeCubicMm` (mm³); null/undefined = unknown / unconstrained for cube tiering.
   */
  binCapacityCubeMm3?: number | null;
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
    case "GREEDY_MIN_BIN_TOUCHES":
    case "GREEDY_RESERVE_PICK_FACE":
    case "GREEDY_MIN_BIN_TOUCHES_CUBE_AWARE":
    case "GREEDY_RESERVE_PICK_FACE_CUBE_AWARE":
    case "SOLVER_PROTOTYPE_MIN_BIN_TOUCHES":
    case "SOLVER_PROTOTYPE_MIN_BIN_TOUCHES_RESERVE_PICK_FACE":
      copy.sort((a, b) => a.binCode.localeCompare(b.binCode) || a.binId.localeCompare(b.binId));
      break;
    case "MANUAL_ONLY":
      return [];
  }
  return copy;
}

/**
 * BF-15 — Per outbound line (given current slot availability), prefer bins that can satisfy the full **remaining**
 * quantity in one pick task; among those, prefer the **smallest sufficient** balance (leave consolidated stock in
 * larger bins). Among partial bins, prefer larger available (fewer follow-on touches).
 */
export function orderPickSlotsMinBinTouches(slots: WavePickSlot[], lineRemainingQty: number): WavePickSlot[] {
  const copy = slots.map((s) => ({ ...s }));
  const R = Math.max(0, lineRemainingQty);
  if (R <= 0) return copy;
  copy.sort((a, b) => {
    const aFull = a.available >= R ? 1 : 0;
    const bFull = b.available >= R ? 1 : 0;
    if (aFull !== bFull) return bFull - aFull;
    if (aFull === 1) {
      return (
        a.available - b.available ||
        a.binCode.localeCompare(b.binCode) ||
        a.binId.localeCompare(b.binId)
      );
    }
    return (
      b.available - a.available ||
      a.binCode.localeCompare(b.binCode) ||
      a.binId.localeCompare(b.binId)
    );
  });
  return copy;
}

function pickFaceRank(isPickFace: boolean): number {
  return isPickFace ? 1 : 0;
}

/**
 * BF-23 — BF-15 min-bin-touch ordering with tie-break: prefer **non–pick-face** bins when scores tie
 * (consume bulk/reserve storage before forward pick faces).
 */
export function orderPickSlotsMinBinTouchesReservePickFace(
  slots: WavePickSlot[],
  lineRemainingQty: number,
): WavePickSlot[] {
  const copy = slots.map((s) => ({ ...s }));
  const R = Math.max(0, lineRemainingQty);
  if (R <= 0) return copy;
  copy.sort((a, b) => {
    const aFull = a.available >= R ? 1 : 0;
    const bFull = b.available >= R ? 1 : 0;
    if (aFull !== bFull) return bFull - aFull;
    if (aFull === 1) {
      const byAvail = a.available - b.available;
      if (byAvail !== 0) return byAvail;
      const face = pickFaceRank(a.isPickFace) - pickFaceRank(b.isPickFace);
      if (face !== 0) return face;
      return a.binCode.localeCompare(b.binCode) || a.binId.localeCompare(b.binId);
    }
    const byAvailDesc = b.available - a.available;
    if (byAvailDesc !== 0) return byAvailDesc;
    const face = pickFaceRank(a.isPickFace) - pickFaceRank(b.isPickFace);
    if (face !== 0) return face;
    return a.binCode.localeCompare(b.binCode) || a.binId.localeCompare(b.binId);
  });
  return copy;
}

/** Slots for tests — fungible bucket only. */
export function fungibleWaveSlot(
  partial: Omit<WavePickSlot, "lotCode" | "expirySortMs" | "isPickFace"> & {
    isPickFace?: boolean;
    binCapacityCubeMm3?: number | null;
  },
): WavePickSlot {
  return {
    ...partial,
    isPickFace: partial.isPickFace ?? false,
    lotCode: FUNGIBLE_LOT_CODE,
    expirySortMs: 0,
  };
}
