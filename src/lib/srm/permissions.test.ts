import { describe, expect, it } from "vitest";

import { resolveSrmPermissions } from "./permissions";

describe("resolveSrmPermissions", () => {
  it("returns all SRM permissions as false by default", () => {
    expect(resolveSrmPermissions(new Set())).toEqual({
      canViewSuppliers: false,
      canEditSuppliers: false,
      canApproveSuppliers: false,
      canViewOrders: false,
    });
  });

  it("allows order metrics only when supplier view is present", () => {
    expect(resolveSrmPermissions(new Set(["org.orders\u0000view"]))).toEqual({
      canViewSuppliers: false,
      canEditSuppliers: false,
      canApproveSuppliers: false,
      canViewOrders: false,
    });
  });

  it("maps supplier and order grants for SRM pages", () => {
    expect(
      resolveSrmPermissions(
        new Set([
          "org.suppliers\u0000view",
          "org.suppliers\u0000edit",
          "org.suppliers\u0000approve",
          "org.orders\u0000view",
        ]),
      ),
    ).toEqual({
      canViewSuppliers: true,
      canEditSuppliers: true,
      canApproveSuppliers: true,
      canViewOrders: true,
    });
  });
});
