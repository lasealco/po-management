import { describe, expect, it } from "vitest";

import {
  inventoryOwnershipBf79FilterToWhere,
  parseInventoryOwnershipBf79BalanceFilter,
} from "./inventory-ownership-bf79";

describe("BF-79 inventory ownership filter", () => {
  it("returns null when no params", () => {
    expect(parseInventoryOwnershipBf79BalanceFilter(new URLSearchParams())).toBeNull();
  });

  it("parses company filter", () => {
    const f = parseInventoryOwnershipBf79BalanceFilter(new URLSearchParams("balanceOwnership=company"));
    expect(f?.mode).toBe("company");
    expect(f?.supplierId).toBeNull();
    expect(inventoryOwnershipBf79FilterToWhere(f!)).toEqual({
      inventoryOwnershipSupplierIdBf79: null,
    });
  });

  it("parses vendor filter", () => {
    const f = parseInventoryOwnershipBf79BalanceFilter(new URLSearchParams("balanceOwnership=vendor"));
    expect(f?.mode).toBe("vendor");
    expect(inventoryOwnershipBf79FilterToWhere(f!)).toEqual({
      inventoryOwnershipSupplierIdBf79: { not: null },
    });
  });

  it("supplier id narrows regardless of mode", () => {
    const f = parseInventoryOwnershipBf79BalanceFilter(
      new URLSearchParams("balanceOwnership=company&balanceOwnershipSupplierId=s1"),
    );
    expect(f?.supplierId).toBe("s1");
    expect(inventoryOwnershipBf79FilterToWhere(f!)).toEqual({
      inventoryOwnershipSupplierIdBf79: "s1",
    });
  });
});
