import { describe, expect, it } from "vitest";

import { orderPickSlotsForWave } from "./allocation-strategy";

const slots = [
  { binId: "b2", binCode: "B-02", available: 10 },
  { binId: "b1", binCode: "B-01", available: 5 },
  { binId: "b3", binCode: "B-03", available: 50 },
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

  it("MANUAL_ONLY yields no automated ordering", () => {
    expect(orderPickSlotsForWave("MANUAL_ONLY", slots)).toEqual([]);
  });
});
