import { describe, expect, it } from "vitest";

import { batchPickVisitBinOrder, cloneWavePickSlotPools } from "./pick-wave-batch";
import type { WavePickSlot } from "./allocation-strategy";

function slot(partial: Partial<WavePickSlot> & Pick<WavePickSlot, "binId" | "binCode">): WavePickSlot {
  return {
    available: 0,
    lotCode: "",
    expirySortMs: 0,
    isPickFace: false,
    isCrossDockStaging: false,
    binCapacityCubeMm3: null,
    ...partial,
  };
}

describe("pick-wave-batch", () => {
  it("cloneWavePickSlotPools deep-copies available", () => {
    const a: WavePickSlot = slot({ binId: "b1", binCode: "A", available: 5 });
    const src = new Map<string, WavePickSlot[]>([["p1", [a]]]);
    const cloned = cloneWavePickSlotPools(src);
    cloned.get("p1")![0].available = 1;
    expect(src.get("p1")![0].available).toBe(5);
  });

  it("batchPickVisitBinOrder sorts cross-dock staging before regular bins", () => {
    const pools = new Map<string, WavePickSlot[]>([
      [
        "p1",
        [
          slot({ binId: "b2", binCode: "Z", isCrossDockStaging: false, available: 1 }),
          slot({ binId: "b1", binCode: "A", isCrossDockStaging: true, available: 1 }),
        ],
      ],
    ]);
    expect(batchPickVisitBinOrder(pools)).toEqual(["b1", "b2"]);
  });
});
