import { describe, expect, it } from "vitest";

import {
  buildDangerousGoodsManifestBf72,
  buildDgChecklistStateBf72V1,
  checklistStateSatisfiesTemplate,
  evaluateDangerousGoodsReadinessBf72,
  parseDgChecklistJsonFromDb,
  validateDangerousGoodsChecklistSubmission,
} from "./dangerous-goods-bf72";

describe("dangerous-goods-bf72", () => {
  it("validateDangerousGoodsChecklistSubmission accepts exact template keys all true", () => {
    const items = {
      SDS_REVIEWED: true,
      LABELS_MATCH_MASTER_DATA: true,
      PACKAGING_CLOSURE_OK: true,
      LIMITS_SEGREGATION_REVIEWED: true,
    };
    expect(validateDangerousGoodsChecklistSubmission(items)).toEqual({ ok: true });
  });

  it("validateDangerousGoodsChecklistSubmission rejects partial maps", () => {
    const r = validateDangerousGoodsChecklistSubmission({ SDS_REVIEWED: true });
    expect(r.ok).toBe(false);
  });

  it("parseDgChecklistJsonFromDb round-trips buildDgChecklistStateBf72V1", () => {
    const built = buildDgChecklistStateBf72V1("actor1");
    const parsed = parseDgChecklistJsonFromDb(built);
    expect(parsed).not.toBeNull();
    expect(checklistStateSatisfiesTemplate(parsed)).toBe(true);
  });

  it("evaluateDangerousGoodsReadinessBf72 warns on missing UN for DG SKU", () => {
    const r = evaluateDangerousGoodsReadinessBf72({
      lines: [
        {
          product: {
            id: "p1",
            sku: null,
            productCode: null,
            name: "Fuel",
            isDangerousGoods: true,
            dangerousGoodsClass: "3",
            unNumber: "",
            properShippingName: null,
            packingGroup: null,
            msdsUrl: null,
          },
        },
      ],
      wmsDangerousGoodsChecklistJson: null,
    });
    expect(r.checklistRequired).toBe(true);
    expect(r.checklistComplete).toBe(false);
    expect(r.warnings.some((w) => w.includes("UN number"))).toBe(true);
  });

  it("buildDangerousGoodsManifestBf72 lists DG lines subset", () => {
    const snap = buildDangerousGoodsManifestBf72({
      outboundOrderId: "o1",
      outboundNo: "OB-1",
      status: "PACKED",
      carrierTrackingNo: null,
      shipToName: null,
      shipToCity: null,
      shipToCountryCode: null,
      wmsDangerousGoodsChecklistJson: buildDgChecklistStateBf72V1("u"),
      lines: [
        {
          lineNo: 1,
          quantity: { toString: () => "2" },
          packedQty: { toString: () => "2" },
          shippedQty: { toString: () => "0" },
          product: {
            id: "p1",
            sku: "DG",
            productCode: null,
            name: "Fuel",
            isDangerousGoods: true,
            dangerousGoodsClass: "3",
            unNumber: "1203",
            properShippingName: "Gasoline",
            packingGroup: "II",
            msdsUrl: "https://example/msds",
          },
        },
        {
          lineNo: 2,
          quantity: { toString: () => "1" },
          packedQty: { toString: () => "1" },
          shippedQty: { toString: () => "0" },
          product: {
            id: "p2",
            sku: "SAFE",
            productCode: null,
            name: "Tape",
            isDangerousGoods: false,
            dangerousGoodsClass: null,
            unNumber: null,
            properShippingName: null,
            packingGroup: null,
            msdsUrl: null,
          },
        },
      ],
      generatedAt: new Date("2026-05-01T12:00:00.000Z"),
    });
    expect(snap.schemaVersion).toBe("bf72.v1");
    expect(snap.lines).toHaveLength(2);
    expect(snap.dangerousGoodsLines).toHaveLength(1);
    expect(snap.dangerousGoodsLines[0]?.unNumber).toBe("1203");
  });
});
