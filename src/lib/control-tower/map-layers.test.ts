import { describe, expect, it } from "vitest";

import { buildWarehouseBinMapPins, warehouseBinScatterCoordinate } from "./map-layers";

describe("warehouseBinScatterCoordinate", () => {
  it("is deterministic for the same inputs", () => {
    const a = warehouseBinScatterCoordinate(41.9, -87.7, "wh1", "binA");
    const b = warehouseBinScatterCoordinate(41.9, -87.7, "wh1", "binA");
    expect(a.lat).toBe(b.lat);
    expect(a.lng).toBe(b.lng);
  });

  it("stays near the warehouse site coordinate", () => {
    const baseLat = 41.8781;
    const baseLng = -87.6298;
    const p = warehouseBinScatterCoordinate(baseLat, baseLng, "wh1", "binZ");
    expect(Math.abs(p.lat - baseLat)).toBeLessThan(0.05);
    expect(Math.abs(p.lng - baseLng)).toBeLessThan(0.05);
  });

  it("separates different bins", () => {
    const p1 = warehouseBinScatterCoordinate(41.9, -87.7, "wh1", "b1");
    const p2 = warehouseBinScatterCoordinate(41.9, -87.7, "wh1", "b2");
    expect(p1.lat !== p2.lat || p1.lng !== p2.lng).toBe(true);
  });
});

describe("buildWarehouseBinMapPins", () => {
  it("skips bins whose warehouse has no site coord", () => {
    const pins = buildWarehouseBinMapPins(
      [{ id: "x", warehouseId: "missing", code: "A-1", rackCode: null, aisle: null, bay: null, level: null, positionIndex: null }],
      new Map([["wh2", { lat: 40, lng: -74 }]]),
    );
    expect(pins).toHaveLength(0);
  });

  it("emits a pin when warehouse maps", () => {
    const pins = buildWarehouseBinMapPins(
      [
        {
          id: "bin1",
          warehouseId: "wh2",
          code: "Z-01",
          rackCode: "R1",
          aisle: "A",
          bay: "3",
          level: 2,
          positionIndex: 4,
        },
      ],
      new Map([["wh2", { lat: 40.7128, lng: -74.006 }]]),
    );
    expect(pins).toHaveLength(1);
    expect(pins[0]?.title).toContain("Z-01");
    expect(pins[0]?.subtitle).toContain("rack R1");
    expect(pins[0]?.href).toBe("/wms/setup");
  });
});
