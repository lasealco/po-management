import { describe, expect, it } from "vitest";

import { fungibleWaveSlot, orderPickSlotsForWave } from "./allocation-strategy";

const slots = [
  fungibleWaveSlot({ binId: "b2", binCode: "B-02", available: 10 }),
  fungibleWaveSlot({ binId: "b1", binCode: "B-01", available: 5 }),
  fungibleWaveSlot({ binId: "b3", binCode: "B-03", available: 50 }),
];

describe("orderPickSlotsForWave", () => {
  it("MAX_AVAILABLE_FIRST prefers highest available, then bin code", () => {
    const ordered = orderPickSlotsForWave("MAX_AVAILABLE_FIRST", slots);
    expect(ordered.map((s) => s.binCode)).toEqual(["B-03", "B-02", "B-01"]);
  });

  it("FIFO_BY_BIN_CODE follows bin code order", () => {
    const ordered = orderPickSlotsForWave("FIFO_BY_BIN_CODE", slots);
    expect(ordered.map((s) => s.binCode)).toEqual(["B-01", "B-02", "B-03"]);
  });

  it("FEFO_BY_LOT_EXPIRY orders by expirySortMs, then bin code", () => {
    const d1 = new Date("2026-06-01").getTime();
    const d2 = new Date("2026-09-01").getTime();
    const fefoSlots = [
      {
        binId: "b2",
        binCode: "B-02",
        available: 10,
        lotCode: "LOT-B",
        expirySortMs: d2,
      },
      {
        binId: "b1",
        binCode: "B-01",
        available: 5,
        lotCode: "LOT-A",
        expirySortMs: d1,
      },
    ];
    const ordered = orderPickSlotsForWave("FEFO_BY_LOT_EXPIRY", fefoSlots);
    expect(ordered.map((s) => s.lotCode)).toEqual(["LOT-A", "LOT-B"]);
  });

  it("MANUAL_ONLY yields no automated ordering", () => {
    expect(orderPickSlotsForWave("MANUAL_ONLY", slots)).toEqual([]);
  });
});
