import { crossDockStagingFirstCmp, type WavePickSlot } from "./allocation-strategy";

/** Deep-clone slot pools so `available` can be decremented independently. */
export function cloneWavePickSlotPools(byProduct: Map<string, WavePickSlot[]>): Map<string, WavePickSlot[]> {
  const next = new Map<string, WavePickSlot[]>();
  for (const [productId, slots] of byProduct) {
    next.set(
      productId,
      slots.map((s) => ({ ...s })),
    );
  }
  return next;
}

/** Stable bin visit order for BF-56 batch/cluster picks (cross-dock staging first, then bin code). */
export function batchPickVisitBinOrder(mutablePools: Map<string, WavePickSlot[]>): string[] {
  const metaByBin = new Map<string, WavePickSlot>();
  for (const slots of mutablePools.values()) {
    for (const s of slots) {
      if (!metaByBin.has(s.binId)) metaByBin.set(s.binId, s);
    }
  }
  return [...metaByBin.values()]
    .sort(
      (a, b) =>
        crossDockStagingFirstCmp(a, b) || a.binCode.localeCompare(b.binCode) || a.binId.localeCompare(b.binId),
    )
    .map((s) => s.binId);
}
