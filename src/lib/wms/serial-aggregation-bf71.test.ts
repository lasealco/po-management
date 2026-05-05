import { describe, expect, it } from "vitest";

import { evaluateBf71SerialAggregation } from "./serial-aggregation-bf71";

describe("serial-aggregation-bf71", () => {
  it("rolls serials up the LU subtree", () => {
    const lus = [
      {
        id: "p",
        scanCode: "PALLET1",
        parentUnitId: null,
        outboundOrderLineId: null,
        containedQty: null,
      },
      {
        id: "c",
        scanCode: "CASE1",
        parentUnitId: "p",
        outboundOrderLineId: "line1",
        containedQty: "2",
      },
    ];
    const links = [
      {
        logisticsUnitId: "c",
        serial: { serialId: "s1", serialNo: "SN1", productId: "prodA" },
      },
    ];
    const lineProductByLineId = new Map([["line1", "prodA"]]);
    const r = evaluateBf71SerialAggregation({ lus, links, lineProductByLineId });
    expect(r.ok).toBe(true);
    const pallet = r.units.find((u) => u.logisticsUnitId === "p");
    const leaf = r.units.find((u) => u.logisticsUnitId === "c");
    expect(leaf?.directSerials).toHaveLength(1);
    expect(pallet?.aggregatedSerials.map((x) => x.serialNo)).toEqual(["SN1"]);
  });

  it("errors when serial product mismatches bound line", () => {
    const lus = [
      {
        id: "c",
        scanCode: "CASE1",
        parentUnitId: null,
        outboundOrderLineId: "line1",
        containedQty: "1",
      },
    ];
    const links = [
      {
        logisticsUnitId: "c",
        serial: { serialId: "s1", serialNo: "SN1", productId: "wrong" },
      },
    ];
    const lineProductByLineId = new Map([["line1", "prodA"]]);
    const r = evaluateBf71SerialAggregation({ lus, links, lineProductByLineId });
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => e.includes("does not match"))).toBe(true);
  });
});
