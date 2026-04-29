import type { WmsPickAllocationStrategy } from "@prisma/client";

export type WavePickSlot = {
  binId: string;
  binCode: string;
  available: number;
};

/** Order bins for automated wave splitting (`create_pick_wave`). */
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
    case "MANUAL_ONLY":
      return [];
  }
  return copy;
}
