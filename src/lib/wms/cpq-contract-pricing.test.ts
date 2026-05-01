import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";

import { resolveQuoteLineCommercialPricing } from "./cpq-contract-pricing";

describe("resolveQuoteLineCommercialPricing", () => {
  it("omits list delta when listUnitPrice unset", () => {
    const r = resolveQuoteLineCommercialPricing({
      quantity: new Prisma.Decimal("2"),
      unitPrice: new Prisma.Decimal("10"),
      listUnitPrice: null,
      priceTierLabel: null,
    });
    expect(r.contractUnitPrice).toBe("10");
    expect(r.listUnitPrice).toBeNull();
    expect(r.unitDelta).toBeNull();
    expect(r.extendedContract).toBe("20.00");
    expect(r.extendedList).toBeNull();
    expect(r.tierLabel).toBeNull();
  });

  it("computes delta and extended list when list is set", () => {
    const r = resolveQuoteLineCommercialPricing({
      quantity: new Prisma.Decimal("3"),
      unitPrice: new Prisma.Decimal("80"),
      listUnitPrice: new Prisma.Decimal("100"),
      priceTierLabel: "VOL_TIER_A",
    });
    expect(r.listUnitPrice).toBe("100");
    expect(r.unitDelta).toBe("20.0000");
    expect(r.extendedContract).toBe("240.00");
    expect(r.extendedList).toBe("300.00");
    expect(r.tierLabel).toBe("VOL_TIER_A");
  });

  it("treats zero list as absent", () => {
    const r = resolveQuoteLineCommercialPricing({
      quantity: new Prisma.Decimal("1"),
      unitPrice: new Prisma.Decimal("5"),
      listUnitPrice: new Prisma.Decimal("0"),
      priceTierLabel: undefined,
    });
    expect(r.listUnitPrice).toBeNull();
    expect(r.unitDelta).toBeNull();
  });

  it("treats negative list as absent", () => {
    const r = resolveQuoteLineCommercialPricing({
      quantity: new Prisma.Decimal("1"),
      unitPrice: new Prisma.Decimal("5"),
      listUnitPrice: new Prisma.Decimal("-1"),
      priceTierLabel: undefined,
    });
    expect(r.listUnitPrice).toBeNull();
    expect(r.unitDelta).toBeNull();
  });
});
