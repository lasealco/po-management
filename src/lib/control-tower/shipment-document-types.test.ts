import { describe, expect, it } from "vitest";

import {
  CT_SHIPMENT_DOCUMENT_TYPES,
  labelForCtDocType,
  normalizeUploadDocType,
  parseIntegrationDocType,
} from "./shipment-document-types";

describe("normalizeUploadDocType", () => {
  it("accepts canonical codes with spacing variants", () => {
    expect(normalizeUploadDocType("  bill of lading  ")).toBe("BILL_OF_LADING");
    expect(normalizeUploadDocType("AIR_WAYBILL")).toBe("AIR_WAYBILL");
  });

  it("falls back to OTHER for unknown codes", () => {
    expect(normalizeUploadDocType("VENDOR_XYZ")).toBe("OTHER");
  });
});

describe("labelForCtDocType", () => {
  it("returns label for known codes and raw for unknown", () => {
    expect(labelForCtDocType("CMR")).toBe("CMR (road)");
    expect(labelForCtDocType("CUSTOM")).toBe("CUSTOM");
  });
});

describe("parseIntegrationDocType", () => {
  it("accepts printable trimmed strings within length", () => {
    expect(parseIntegrationDocType("  CW-DOCTYPE-1  ")).toBe("CW-DOCTYPE-1");
  });

  it("rejects non-strings, empty, too long, and control chars", () => {
    expect(parseIntegrationDocType(null)).toBe("invalid");
    expect(parseIntegrationDocType("")).toBe("invalid");
    expect(parseIntegrationDocType("x".repeat(81))).toBe("invalid");
    expect(parseIntegrationDocType("a\nb")).toBe("invalid");
  });
});

describe("CT_SHIPMENT_DOCUMENT_TYPES", () => {
  it("has unique codes", () => {
    const codes = CT_SHIPMENT_DOCUMENT_TYPES.map((t) => t.code);
    expect(new Set(codes).size).toBe(codes.length);
  });
});
