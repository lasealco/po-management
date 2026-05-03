import { describe, expect, it } from "vitest";
import { Prisma } from "@prisma/client";

import {
  BF67_MAX_MANIFEST_PARCELS,
  buildOutboundManifestExportV1,
  manifestParcelIdsFromDbJson,
  parseManifestParcelIdsInput,
  type OutboundManifestPrismaRow,
} from "./outbound-manifest-bf67";

describe("outbound-manifest-bf67", () => {
  it("parseManifestParcelIdsInput trims, rejects dupes and max len", () => {
    expect(parseManifestParcelIdsInput(undefined).ok).toBe(false);
    expect(parseManifestParcelIdsInput("x" as unknown as string).ok).toBe(false);
    const ok = parseManifestParcelIdsInput([" 1Z1 ", "1z1 "]);
    expect(ok.ok).toBe(false);
    if (ok.ok) throw new Error("expected dup");
    const long = "x".repeat(129);
    const badLen = parseManifestParcelIdsInput([long]);
    expect(badLen.ok).toBe(false);
    const many = parseManifestParcelIdsInput(
      Array.from({ length: BF67_MAX_MANIFEST_PARCELS + 1 }, (_, i) => `T${i}`),
    );
    expect(many.ok).toBe(false);
    const good = parseManifestParcelIdsInput(["A", " B "]);
    expect(good).toEqual({ ok: true, ids: ["A", "B"] });
  });

  it("manifestParcelIdsFromDbJson tolerates bad json", () => {
    expect(manifestParcelIdsFromDbJson(null)).toEqual([]);
    expect(manifestParcelIdsFromDbJson({} as unknown as Prisma.JsonValue)).toEqual([]);
    expect(manifestParcelIdsFromDbJson(["a", 1, " b "])).toEqual(["a", "b"]);
  });

  it("buildOutboundManifestExportV1 merges primary + manifest", () => {
    const row: OutboundManifestPrismaRow = {
      id: "o1",
      outboundNo: "OB-1",
      status: "PACKED",
      customerRef: null,
      asnReference: null,
      shipToName: "Acme",
      shipToLine1: null,
      shipToCity: "NYC",
      shipToCountryCode: "US",
      carrierTrackingNo: "MASTER",
      carrierLabelAdapterId: "DEMO",
      carrierLabelPurchasedAt: new Date("2026-01-01T00:00:00.000Z"),
      manifestParcelIds: ["p1", "p2"],
      warehouse: { code: "WH1", name: "DC" },
      logisticsUnits: [
        {
          id: "lu1",
          scanCode: "123",
          kind: "CASE",
          parentUnitId: null,
          outboundOrderLineId: "ln1",
        },
      ],
    };
    const snap = buildOutboundManifestExportV1(row, new Date("2026-06-01T12:00:00.000Z"));
    expect(snap.schemaVersion).toBe("bf67.v1");
    expect(snap.outbound.manifestParcelIds).toEqual(["p1", "p2"]);
    expect(snap.outbound.allTrackingNumbers).toEqual(["MASTER", "p1", "p2"]);
    expect(snap.logisticsUnits).toHaveLength(1);
  });

  it("buildOutboundManifestExportV1 does not duplicate primary when it appears in manifest", () => {
    const row: OutboundManifestPrismaRow = {
      id: "o1",
      outboundNo: "OB-1",
      status: "SHIPPED",
      customerRef: null,
      asnReference: null,
      shipToName: null,
      shipToLine1: null,
      shipToCity: null,
      shipToCountryCode: null,
      carrierTrackingNo: "1ZDUPE",
      carrierLabelAdapterId: null,
      carrierLabelPurchasedAt: null,
      manifestParcelIds: ["p1", "1zdupe"],
      warehouse: { code: "WH1", name: "DC" },
      logisticsUnits: [],
    };
    const snap = buildOutboundManifestExportV1(row, new Date("2026-06-01T12:00:00.000Z"));
    expect(snap.outbound.allTrackingNumbers).toEqual(["1ZDUPE", "p1"]);
  });
});
