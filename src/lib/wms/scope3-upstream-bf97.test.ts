import { describe, expect, it } from "vitest";
import { Prisma } from "@prisma/client";

import {
  multiplyQtyByUpstreamGramsPerKgBf97,
  parseMovementScope3UpstreamHintGramsBf97ForPatch,
  parseScope3UpstreamGramsPerKgBf97ForPatch,
  resolveScope3UpstreamGramsPerKgBf97,
} from "./scope3-upstream-bf97";

describe("parseScope3UpstreamGramsPerKgBf97ForPatch", () => {
  it("parses non-negative decimals", () => {
    const r = parseScope3UpstreamGramsPerKgBf97ForPatch("12.5");
    expect(r.ok).toBe(true);
    if (r.ok && r.mode === "set") expect(r.value.toString()).toBe("12.5");
  });

  it("rejects negative", () => {
    expect(parseScope3UpstreamGramsPerKgBf97ForPatch(-1).ok).toBe(false);
  });
});

describe("parseMovementScope3UpstreamHintGramsBf97ForPatch", () => {
  it("accepts clear via null", () => {
    expect(parseMovementScope3UpstreamHintGramsBf97ForPatch(null).ok).toBe(true);
  });
});

describe("resolveScope3UpstreamGramsPerKgBf97", () => {
  it("prefers product override", () => {
    const r = resolveScope3UpstreamGramsPerKgBf97({
      productGramsPerKg: new Prisma.Decimal("8"),
      supplierGramsPerKgViaOffice: new Prisma.Decimal("99"),
    });
    expect(r?.toString()).toBe("8");
  });

  it("falls back to supplier chain factor", () => {
    const r = resolveScope3UpstreamGramsPerKgBf97({
      productGramsPerKg: null,
      supplierGramsPerKgViaOffice: new Prisma.Decimal("3"),
    });
    expect(r?.toString()).toBe("3");
  });
});

describe("multiplyQtyByUpstreamGramsPerKgBf97", () => {
  it("multiplies qty × grams/kg", () => {
    const g = multiplyQtyByUpstreamGramsPerKgBf97(new Prisma.Decimal("10"), new Prisma.Decimal("50"));
    expect(g?.toString()).toBe("500");
  });
});
