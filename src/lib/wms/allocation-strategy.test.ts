import { describe, expect, it } from "vitest";

import {
  fungibleWaveSlot,
  orderPickSlotsForWave,
  orderPickSlotsMinBinTouches,
  orderPickSlotsMinBinTouchesReservePickFace,
} from "./allocation-strategy";

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
        isPickFace: false,
      },
      {
        binId: "b1",
        binCode: "B-01",
        available: 5,
        lotCode: "LOT-A",
        expirySortMs: d1,
        isPickFace: false,
      },
    ];
    const ordered = orderPickSlotsForWave("FEFO_BY_LOT_EXPIRY", fefoSlots);
    expect(ordered.map((s) => s.lotCode)).toEqual(["LOT-A", "LOT-B"]);
  });

  it("MANUAL_ONLY yields no automated ordering", () => {
    expect(orderPickSlotsForWave("MANUAL_ONLY", slots)).toEqual([]);
  });

  it("GREEDY_MIN_BIN_TOUCHES stable sort uses bin code", () => {
    const ordered = orderPickSlotsForWave("GREEDY_MIN_BIN_TOUCHES", slots);
    expect(ordered.map((s) => s.binCode)).toEqual(["B-01", "B-02", "B-03"]);
  });

  it("GREEDY_RESERVE_PICK_FACE stable sort uses bin code", () => {
    const ordered = orderPickSlotsForWave("GREEDY_RESERVE_PICK_FACE", slots);
    expect(ordered.map((s) => s.binCode)).toEqual(["B-01", "B-02", "B-03"]);
  });

  it("GREEDY_MIN_BIN_TOUCHES_CUBE_AWARE stable sort uses bin code", () => {
    const ordered = orderPickSlotsForWave("GREEDY_MIN_BIN_TOUCHES_CUBE_AWARE", slots);
    expect(ordered.map((s) => s.binCode)).toEqual(["B-01", "B-02", "B-03"]);
  });

  it("GREEDY_RESERVE_PICK_FACE_CUBE_AWARE stable sort uses bin code", () => {
    const ordered = orderPickSlotsForWave("GREEDY_RESERVE_PICK_FACE_CUBE_AWARE", slots);
    expect(ordered.map((s) => s.binCode)).toEqual(["B-01", "B-02", "B-03"]);
  });

  it("SOLVER_PROTOTYPE_MIN_BIN_TOUCHES stable sort uses bin code", () => {
    const ordered = orderPickSlotsForWave("SOLVER_PROTOTYPE_MIN_BIN_TOUCHES", slots);
    expect(ordered.map((s) => s.binCode)).toEqual(["B-01", "B-02", "B-03"]);
  });

  it("SOLVER_PROTOTYPE_MIN_BIN_TOUCHES_RESERVE_PICK_FACE stable sort uses bin code", () => {
    const ordered = orderPickSlotsForWave("SOLVER_PROTOTYPE_MIN_BIN_TOUCHES_RESERVE_PICK_FACE", slots);
    expect(ordered.map((s) => s.binCode)).toEqual(["B-01", "B-02", "B-03"]);
  });
});

describe("orderPickSlotsMinBinTouches", () => {
  it("prefers bins that cover full remainder, then higher available", () => {
    const bins = [
      fungibleWaveSlot({ binId: "partial", binCode: "P", available: 8 }),
      fungibleWaveSlot({ binId: "cover", binCode: "C", available: 15 }),
      fungibleWaveSlot({ binId: "big", binCode: "B", available: 50 }),
    ];
    const R = 12;
    const ordered = orderPickSlotsMinBinTouches(bins, R);
    expect(ordered[0]?.binId).toBe("cover");
    expect(ordered[1]?.binId).toBe("big");
    expect(ordered[2]?.binId).toBe("partial");
  });
});

describe("orderPickSlotsMinBinTouchesReservePickFace", () => {
  it("prefers non-pick-face when smallest-sufficient ties", () => {
    const bins = [
      fungibleWaveSlot({ binId: "face", binCode: "FACE", available: 12, isPickFace: true }),
      fungibleWaveSlot({ binId: "bulk", binCode: "BULK", available: 12, isPickFace: false }),
    ];
    const ordered = orderPickSlotsMinBinTouchesReservePickFace(bins, 10);
    expect(ordered[0]?.binId).toBe("bulk");
    expect(ordered[1]?.binId).toBe("face");
  });

  it("still prefers smallest sufficient cover over pick-face tie-break", () => {
    const bins = [
      fungibleWaveSlot({ binId: "faceTight", binCode: "F1", available: 11, isPickFace: true }),
      fungibleWaveSlot({ binId: "bulkLoose", binCode: "B1", available: 20, isPickFace: false }),
    ];
    const ordered = orderPickSlotsMinBinTouchesReservePickFace(bins, 10);
    expect(ordered[0]?.binId).toBe("faceTight");
  });
});
