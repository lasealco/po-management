import { describe, expect, it } from "vitest";

import {
  buildOutboundPackScanPlan,
  flattenPackScanExpectations,
  normalizePackScanToken,
  primaryPackScanCode,
  verifyOutboundPackScan,
} from "@/lib/wms/pack-scan-verify";

describe("pack-scan-verify", () => {
  it("normalizes tokens", () => {
    expect(normalizePackScanToken("  abc 123 ")).toBe("ABC 123");
  });

  it("prefers sku over product code", () => {
    expect(
      primaryPackScanCode({
        id: "pid",
        sku: "SKU-A",
        productCode: "PC-A",
      }),
    ).toBe("SKU-A");
  });

  it("falls back to product id", () => {
    expect(
      primaryPackScanCode({
        id: "clxyz",
        sku: null,
        productCode: null,
      }),
    ).toBe("CLXYZ");
  });

  it("verifies multiset scans", () => {
    const plan = buildOutboundPackScanPlan([
      {
        pickedQty: 2,
        product: { id: "p1", sku: "A", productCode: null },
      },
      {
        pickedQty: 1,
        product: { id: "p2", sku: "B", productCode: null },
      },
    ]);
    const flat = flattenPackScanExpectations(plan);
    expect(flat).toEqual(["A", "A", "B"]);

    expect(verifyOutboundPackScan(flat, ["a", "b", "a"]).ok).toBe(true);
    expect(verifyOutboundPackScan(flat, ["a", "a"]).ok).toBe(false);
    expect(verifyOutboundPackScan(flat, ["a", "a", "b", "X"]).ok).toBe(false);
  });
});
