import { describe, expect, it } from "vitest";

import { formatSscc18FromBody17, buildSscc18DemoBody17 } from "@/lib/wms/gs1-sscc";
import { validateOutboundLuHierarchy } from "@/lib/wms/outbound-lu-hierarchy";

describe("outbound-lu-hierarchy (BF-57)", () => {
  it("accepts valid SSCC-18 scan codes", () => {
    const body17 = buildSscc18DemoBody17({
      outboundId: "out-1",
      companyPrefixDigits: "0614141",
    });
    const sscc = formatSscc18FromBody17(body17);
    const r = validateOutboundLuHierarchy([
      { id: "a", parentUnitId: null, scanCode: sscc, outboundOrderLineId: "L1", containedQty: "2" },
    ]);
    expect(r.ok).toBe(true);
    expect(r.errors).toHaveLength(0);
  });

  it("rejects invalid Mod-10 on 18-digit scans", () => {
    const body17 = buildSscc18DemoBody17({
      outboundId: "bad-sscc",
      companyPrefixDigits: "0614141",
    });
    const good = formatSscc18FromBody17(body17);
    const badSscc = `${good.slice(0, -1)}${String((Number.parseInt(good.slice(-1), 10) + 1) % 10)}`;
    const r = validateOutboundLuHierarchy([
      { id: "a", parentUnitId: null, scanCode: badSscc, outboundOrderLineId: null, containedQty: null },
    ]);
    expect(r.ok).toBe(false);
    expect(r.ssccFailures.length).toBeGreaterThan(0);
  });

  it("detects missing parent reference", () => {
    const r = validateOutboundLuHierarchy([
      { id: "child", parentUnitId: "ghost", scanCode: "CASE1", outboundOrderLineId: null, containedQty: null },
    ]);
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => e.includes("parentUnitId"))).toBe(true);
  });

  it("detects parent cycles", () => {
    const r = validateOutboundLuHierarchy([
      { id: "a", parentUnitId: "b", scanCode: "A", outboundOrderLineId: null, containedQty: null },
      { id: "b", parentUnitId: "a", scanCode: "B", outboundOrderLineId: null, containedQty: null },
    ]);
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => e.includes("cycle"))).toBe(true);
  });

  it("warns when line-bound unit has no contained qty", () => {
    const r = validateOutboundLuHierarchy([
      { id: "a", parentUnitId: null, scanCode: "LPNX", outboundOrderLineId: "line-1", containedQty: null },
    ]);
    expect(r.ok).toBe(true);
    expect(r.warnings.length).toBeGreaterThan(0);
  });
});
