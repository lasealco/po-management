import { describe, expect, it } from "vitest";

import {
  expandOutboundPackScanCandidatesBf81,
  parseRfidEncodingTableBf81Json,
  parseSsccDigitsFromEpcUrn,
  RFID_ENCODING_TABLE_SCHEMA_VERSION,
} from "./rfid-scan-bridge-bf81";

describe("parseSsccDigitsFromEpcUrn", () => {
  it("extracts 18-digit SSCC from GS1 tag URI", () => {
    expect(parseSsccDigitsFromEpcUrn("urn:epc:id:sscc:123456789012345678")).toBe("123456789012345678");
  });

  it("returns null for invalid URIs", () => {
    expect(parseSsccDigitsFromEpcUrn("urn:epc:id:sgtin:0037000.06542.773346563716")).toBe(null);
    expect(parseSsccDigitsFromEpcUrn("SKU-A")).toBe(null);
  });
});

describe("parseRfidEncodingTableBf81Json", () => {
  it("returns null table when disabled", () => {
    const p = parseRfidEncodingTableBf81Json({
      schemaVersion: RFID_ENCODING_TABLE_SCHEMA_VERSION,
      enabled: false,
      tidHexToPackToken: { ABC: "SKU-X" },
    });
    expect(p.table).toBe(null);
  });

  it("returns enabled table with normalized maps", () => {
    const p = parseRfidEncodingTableBf81Json({
      schemaVersion: RFID_ENCODING_TABLE_SCHEMA_VERSION,
      enabled: true,
      tidHexPrefixStrip: ["e280"],
      tidHexToPackToken: { AABBCC: "sku-one" },
      tidSuffixHexToPackToken: { CC: "SKU-TWO" },
    });
    expect(p.table?.enabled).toBe(true);
    expect(p.table?.tidHexPrefixStrip).toContain("E280");
    expect(p.table?.tidHexToPackToken.AABBCC).toBe("SKU-ONE");
    expect(p.table?.tidSuffixHexToPackToken.CC).toBe("SKU-TWO");
  });
});

describe("expandOutboundPackScanCandidatesBf81", () => {
  const products = [
    { id: "p1", sku: "WIDGET", productCode: null, ean: "00012345678905" },
  ];

  const tableEnabled = parseRfidEncodingTableBf81Json({
    schemaVersion: RFID_ENCODING_TABLE_SCHEMA_VERSION,
    enabled: true,
    tidHexPrefixStrip: ["E280"],
    tidHexToPackToken: { DEADBEEF: "WIDGET" },
    tidSuffixHexToPackToken: {},
  }).table!;

  it("maps TID hex via tenant table to SKU", () => {
    const c = expandOutboundPackScanCandidatesBf81("E280DEADBEEF", tableEnabled, products);
    expect(c).toContain("WIDGET");
  });

  it("matches GTIN digits to line product EAN", () => {
    const c = expandOutboundPackScanCandidatesBf81("012345678905", null, products);
    expect(c).toContain("WIDGET");
  });

  it("keeps plain SKU normalization without table", () => {
    const c = expandOutboundPackScanCandidatesBf81("  widget ", null, products);
    expect(c).toContain("WIDGET");
  });
});
