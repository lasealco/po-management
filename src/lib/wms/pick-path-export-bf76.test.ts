import { describe, expect, it } from "vitest";

import {
  BF76_SCHEMA_VERSION,
  compareBinsTopology,
  pickPathExportToCsv,
  type Bf76PickPathExport,
  type TopologyBinSortInput,
} from "./pick-path-export-bf76";

function tb(p: Partial<TopologyBinSortInput> & Pick<TopologyBinSortInput, "binId" | "binCode">): TopologyBinSortInput {
  return {
    zoneCode: null,
    aisleCode: null,
    rackCode: null,
    bay: null,
    level: null,
    positionIndex: null,
    isCrossDockStaging: false,
    isPickFace: false,
    ...p,
  };
}

describe("pick-path-export-bf76", () => {
  it("compareBinsTopology sorts cross-dock staging before same-zone bins", () => {
    const a = tb({
      binId: "b1",
      binCode: "A-01",
      zoneCode: "Z1",
      isCrossDockStaging: false,
    });
    const b = tb({
      binId: "b2",
      binCode: "Z-99",
      zoneCode: "Z1",
      isCrossDockStaging: true,
    });
    expect(compareBinsTopology(a, b)).toBeGreaterThan(0);
    expect(compareBinsTopology(b, a)).toBeLessThan(0);
  });

  it("compareBinsTopology orders rack geometry deterministically", () => {
    const rows = [
      tb({
        binId: "x",
        binCode: "B02",
        zoneCode: "Z",
        aisleCode: "A1",
        rackCode: "R2",
        bay: "02",
        level: 2,
        positionIndex: 1,
      }),
      tb({
        binId: "y",
        binCode: "B01",
        zoneCode: "Z",
        aisleCode: "A1",
        rackCode: "R2",
        bay: "01",
        level: 2,
        positionIndex: 1,
      }),
      tb({
        binId: "z",
        binCode: "A01",
        zoneCode: "Z",
        aisleCode: "A1",
        rackCode: "R1",
        bay: "01",
        level: 1,
        positionIndex: 1,
      }),
    ];
    const sorted = [...rows].sort(compareBinsTopology);
    expect(sorted.map((r) => r.binId)).toEqual(["z", "y", "x"]);
  });

  it("pickPathExportToCsv emits header and escapes commas", () => {
    const doc: Bf76PickPathExport = {
      schemaVersion: BF76_SCHEMA_VERSION,
      generatedAt: "2026-04-29T12:00:00.000Z",
      waveId: "wave1",
      waveNo: "W-1",
      waveStatus: "OPEN",
      pickMode: "BATCH",
      warehouseId: "wh1",
      warehouseCode: "DC1",
      openPickTaskCount: 1,
      visitCount: 1,
      visits: [
        {
          visitSeq: 1,
          binId: "bin1",
          binCode: "A-01",
          zoneCode: "Z",
          aisleCode: "A1",
          rackCode: null,
          bay: null,
          level: null,
          positionIndex: null,
          batchGroupKey: null,
          lines: [
            {
              taskId: "t1",
              outboundOrderId: "o1",
              outboundNo: "SO,001",
              lineNo: 1,
              productSku: "SKU",
              quantity: "2.000",
              lotCode: "",
              batchGroupKey: null,
            },
          ],
        },
      ],
    };
    const csv = pickPathExportToCsv(doc);
    expect(csv.startsWith("visitSeq,")).toBe(true);
    expect(csv).toContain('"SO,001"');
  });
});
