import { describe, expect, it } from "vitest";

import { assignAbcByPickVolume, slottingRecommendationsToCsv } from "./slotting-recommendations";

describe("assignAbcByPickVolume", () => {
  it("returns empty map when no positive quantities", () => {
    expect(assignAbcByPickVolume(new Map()).size).toBe(0);
    expect(assignAbcByPickVolume(new Map([["a", 0]])).size).toBe(0);
  });

  it("classifies single high-share SKU as A", () => {
    const m = new Map([["p1", 100]]);
    const abc = assignAbcByPickVolume(m);
    expect(abc.get("p1")).toBe("A");
  });

  it("uses cumulative share with 80/95 thresholds", () => {
    const m = new Map<string, number>([
      ["a", 50],
      ["b", 40],
      ["c", 10],
    ]);
    const abc = assignAbcByPickVolume(m);
    expect(abc.get("a")).toBe("A");
    expect(abc.get("b")).toBe("A");
    expect(abc.get("c")).toBe("B");
  });

  it("sorts by volume before assigning", () => {
    const m = new Map<string, number>([
      ["slow", 6],
      ["fast", 94],
    ]);
    const abc = assignAbcByPickVolume(m);
    expect(abc.get("fast")).toBe("A");
    expect(abc.get("slow")).toBe("B");
  });
});

describe("slottingRecommendationsToCsv", () => {
  it("includes header and escapes commas", () => {
    const csv = slottingRecommendationsToCsv([
      {
        priorityScore: 100,
        reasonCode: "A_SKU_OFF_PICK_FACE",
        abcClass: "A",
        productPickVolume: 12,
        inventoryBalanceId: "bal1",
        lotCode: "",
        onHandQty: "3",
        product: {
          id: "p1",
          productCode: "X,1",
          sku: null,
          name: 'Name "quoted"',
        },
        currentBin: {
          id: "b1",
          code: "BIN-1",
          isPickFace: false,
          storageType: "PALLET",
        },
        suggestedBin: {
          id: "b2",
          code: "PF-01",
          isPickFace: true,
          storageType: "SHELF",
        },
      },
    ]);
    expect(csv.split("\n")[0]).toContain("priorityScore");
    expect(csv).toContain('"X,1"');
    expect(csv).toContain('""quoted""');
  });
});
