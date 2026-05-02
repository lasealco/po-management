import { describe, expect, it } from "vitest";

import {
  buildWarehouseTopologyGraph,
  computeAdjacentSlotEdges,
  normalizeTopologyBayKey,
} from "./warehouse-topology-graph";

describe("warehouse-topology-graph", () => {
  it("normalizeTopologyBayKey trims", () => {
    expect(normalizeTopologyBayKey("  A1 ")).toBe("A1");
    expect(normalizeTopologyBayKey(null)).toBe("");
  });

  it("computeAdjacentSlotEdges links consecutive positions", () => {
    const edges = computeAdjacentSlotEdges([
      {
        id: "bin:a",
        warehouseAisleId: "aisle1",
        rackCode: "R1",
        bay: "B1",
        level: 1,
        positionIndex: 1,
        isActive: true,
      },
      {
        id: "bin:b",
        warehouseAisleId: "aisle1",
        rackCode: "R1",
        bay: "B1",
        level: 1,
        positionIndex: 2,
        isActive: true,
      },
      {
        id: "bin:c",
        warehouseAisleId: "aisle1",
        rackCode: "R1",
        bay: "B1",
        level: 1,
        positionIndex: 4,
        isActive: true,
      },
    ]);
    expect(edges).toHaveLength(1);
    expect(edges[0]!.kind).toBe("ADJACENT_SLOT");
    expect(edges[0]!.source).toBe("bin:a");
    expect(edges[0]!.target).toBe("bin:b");
  });

  it("buildWarehouseTopologyGraph emits BIN_IN_AISLE and prefixed node ids", () => {
    const g = buildWarehouseTopologyGraph({
      warehouse: { id: "wh1", code: "DC", name: "Demo DC" },
      aisles: [
        {
          id: "al1",
          code: "A01",
          name: "Aisle A01",
          zoneId: null,
          isActive: true,
          lengthMm: 1000,
          widthMm: 300,
          originXMm: 0,
          originYMm: 0,
          originZMm: null,
        },
      ],
      bins: [
        {
          id: "b1",
          code: "BIN-1",
          name: "One",
          zoneId: null,
          warehouseAisleId: "al1",
          rackCode: "R1",
          aisle: "A01",
          bay: "1",
          level: 1,
          positionIndex: 1,
          capacityCubeCubicMm: null,
          isPickFace: false,
          isCrossDockStaging: false,
          isActive: true,
          storageType: "PALLET",
        },
        {
          id: "b2",
          code: "BIN-2",
          name: "Two",
          zoneId: null,
          warehouseAisleId: "al1",
          rackCode: "R1",
          aisle: "A01",
          bay: "1",
          level: 1,
          positionIndex: 2,
          capacityCubeCubicMm: null,
          isPickFace: false,
          isCrossDockStaging: false,
          isActive: true,
          storageType: "PALLET",
        },
      ],
      generatedAt: new Date("2026-05-01T00:00:00.000Z"),
    });

    expect(g.schemaVersion).toBe("bf50.v1");
    expect(g.stats.binNodes).toBe(2);
    expect(g.stats.aisleNodes).toBe(1);
    expect(g.stats.binInAisleEdges).toBe(2);
    expect(g.stats.adjacentSlotEdges).toBe(1);
    expect(g.edges.some((e) => e.kind === "BIN_IN_AISLE" && e.target === "aisle:al1")).toBe(true);
  });
});
