import { describe, expect, it } from "vitest";

import { buildDemoParcelTrackingNo, requestDemoCarrierLabel } from "@/lib/wms/carrier-label-demo-adapter";

describe("carrier-label-demo-adapter", () => {
  it("builds deterministic demo tracking", () => {
    expect(buildDemoParcelTrackingNo("clseed123456")).toMatch(/^DEMO1Z[0-9A-Z]+$/);
    expect(buildDemoParcelTrackingNo("clseed123456")).toBe(buildDemoParcelTrackingNo("clseed123456"));
  });

  it("embeds tracking in ZPL", () => {
    const r = requestDemoCarrierLabel({
      outboundId: "out1",
      outboundNo: "OB-1",
      warehouseLabel: "WH",
      barcodePayload: "x",
      shipToSummary: "City",
      asnReference: null,
      sscc18: null,
    });
    expect(r.zpl).toContain("^XA");
    expect(r.zpl).toContain(r.trackingNo);
    expect(r.zpl).toContain("DEMO CARRIER");
  });
});
