import { describe, expect, it } from "vitest";

import {
  normalizeOutboundLogisticsUnitScanCode,
  verifyOutboundPackScanWithLogisticsUnits,
} from "./outbound-logistics-unit-scan";
import { buildOutboundPackScanPlan, flattenPackScanExpectations } from "./pack-scan-verify";

const product = { id: "p1", sku: "SKU-A", productCode: null as string | null };

describe("BF-43 outbound logistics unit pack scan", () => {
  it("normalizes GS1 numeric payloads to 18-digit SSCC core", () => {
    expect(normalizeOutboundLogisticsUnitScanCode("(00)123456789012345678")).toBe("123456789012345678");
    expect(normalizeOutboundLogisticsUnitScanCode("000012345678901234567890")).toBe(
      "345678901234567890",
    );
    expect(normalizeOutboundLogisticsUnitScanCode("123456789012345678")).toBe("123456789012345678");
  });

  it("consumes N primary scan slots when LU maps to a line", () => {
    const plan = buildOutboundPackScanPlan([{ pickedQty: 5, product }]);
    const flat = flattenPackScanExpectations(plan);
    const lu = [
      {
        scanCode: normalizeOutboundLogisticsUnitScanCode("123456789012345678"),
        outboundOrderLineId: "L1",
        containedQty: 2,
        product,
      },
    ];
    const scanned = ["123456789012345678", "SKU-A", "SKU-A", "SKU-A"];
    const r = verifyOutboundPackScanWithLogisticsUnits(flat, scanned, lu);
    expect(r.ok).toBe(true);
  });

  it("treats structural-only LU scans as unexpected vs pick multiset", () => {
    const plan = buildOutboundPackScanPlan([{ pickedQty: 1, product }]);
    const flat = flattenPackScanExpectations(plan);
    const lu = [
      {
        scanCode: "PALLET-01",
        outboundOrderLineId: null,
        containedQty: null,
        product: null,
      },
    ];
    const r = verifyOutboundPackScanWithLogisticsUnits(flat, ["PALLET-01"], lu);
    expect(r.ok).toBe(false);
    expect(r.unexpected).toContain("PALLET-01");
  });

  it("delegates to BF-29 verify when no logistics units", () => {
    const plan = buildOutboundPackScanPlan([{ pickedQty: 2, product }]);
    const flat = flattenPackScanExpectations(plan);
    const r = verifyOutboundPackScanWithLogisticsUnits(flat, ["SKU-A", "SKU-A"], []);
    expect(r.ok).toBe(true);
  });
});
