import { describe, expect, it } from "vitest";

import { buildShipStationZpl, sanitizeZplFdLine } from "./ship-station-zpl";

describe("sanitizeZplFdLine", () => {
  it("collapses whitespace and truncates long strings", () => {
    expect(sanitizeZplFdLine("  a\tb  ", 100)).toBe("a b");
    expect(sanitizeZplFdLine("x".repeat(50), 10).length).toBeLessThanOrEqual(11);
  });
});

describe("buildShipStationZpl", () => {
  it("emits ZPL frame with barcode block", () => {
    const zpl = buildShipStationZpl({
      outboundNo: "OUT-001",
      warehouseLabel: "WH-DEMO",
      barcodePayload: "OUT-001",
      shipToSummary: "Acme · NYC · US",
      asnReference: "ASN-9",
      sscc18: "006141411234567890",
    });
    expect(zpl).toContain("^XA");
    expect(zpl).toContain("^XZ");
    expect(zpl).toContain("^BCN");
    expect(zpl).toContain("OUT-001");
    expect(zpl).toContain("SSCC");
  });
});
