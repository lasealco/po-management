import { describe, expect, it } from "vitest";

import {
  buildCarrierClaimExportV1,
  parseDamageExtraDetailJson,
  parseDamagePhotoUrlsForCreate,
} from "./damage-report-bf65";

describe("damage-report-bf65", () => {
  it("parses photo URLs from array or string", () => {
    expect(parseDamagePhotoUrlsForCreate(undefined)).toEqual({ ok: true, urls: [] });
    expect(parseDamagePhotoUrlsForCreate(["https://a/b.png", "/uploads/x.jpg"])).toEqual({
      ok: true,
      urls: ["https://a/b.png", "/uploads/x.jpg"],
    });
    const r = parseDamagePhotoUrlsForCreate("https://a/a.png\nhttps://b/b.png");
    expect(r.ok && r.urls).toEqual(["https://a/a.png", "https://b/b.png"]);
  });

  it("rejects bad photo URL schemes", () => {
    const r = parseDamagePhotoUrlsForCreate(["ftp://x"]);
    expect(r.ok).toBe(false);
  });

  it("parses extra detail object or null", () => {
    const bad = parseDamageExtraDetailJson([]);
    expect(bad.ok).toBe(false);
    const ok = parseDamageExtraDetailJson({ cartonId: "C1" });
    expect(ok.ok).toBe(true);
  });

  it("builds claim export envelope", () => {
    const at = new Date("2026-04-30T12:00:00.000Z");
    const exp = buildCarrierClaimExportV1({
      generatedAt: at,
      report: {
        id: "dr1",
        context: "RECEIVING",
        status: "DRAFT",
        damageCategory: "CRUSHED",
        description: "Seal torn",
        photoUrls: ["https://ph/1.jpg"],
        extraDetail: { pallet: "A" },
        carrierClaimReference: null,
        shipmentItemId: "li1",
        createdAt: at,
        scrapValuePerUnitCentsBf95: 125,
      },
      inboundShipment: {
        id: "sh1",
        shipmentNo: "SH-1",
        asnReference: "ASN1",
        carrier: "CAR",
        trackingNo: "1Z",
        purchaseOrder: { id: "po1", orderNumber: "PO-9" },
        lineCount: 3,
      },
      outboundOrder: null,
    });
    expect(exp.schemaVersion).toBe("bf65.v1");
    expect(exp.claimNarrative).toContain("BF-95");
    expect(exp.damageReport).toMatchObject({ id: "dr1" });
    expect(exp.damageReport).toMatchObject({ scrapValuePerUnitCentsBf95: 125 });
    expect(exp.valuationHintsBf95).toMatchObject({
      damageReportScrapValuePerUnitCents: 125,
      inboundLineScrapValuePerUnitCents: null,
    });
  });
});
