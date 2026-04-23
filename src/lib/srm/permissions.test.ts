import { describe, expect, it } from "vitest";

import { canViewSupplierSensitiveFieldsForGrantSet, resolveSrmPermissions } from "./permissions";

describe("canViewSupplierSensitiveFieldsForGrantSet", () => {
  it("is true only for edit or approve on org.suppliers", () => {
    expect(canViewSupplierSensitiveFieldsForGrantSet(new Set(["org.suppliers\u0000view"]))).toBe(false);
    expect(
      canViewSupplierSensitiveFieldsForGrantSet(
        new Set(["org.suppliers\u0000view", "org.suppliers\u0000edit"]),
      ),
    ).toBe(true);
    expect(
      canViewSupplierSensitiveFieldsForGrantSet(new Set(["org.suppliers\u0000approve"])),
    ).toBe(true);
  });
});

describe("resolveSrmPermissions", () => {
  it("returns all SRM permissions as false by default", () => {
    expect(resolveSrmPermissions(new Set())).toEqual({
      canViewSuppliers: false,
      canEditSuppliers: false,
      canApproveSuppliers: false,
      canViewOrders: false,
      canViewSupplierSensitiveFields: false,
    });
  });

  it("allows order metrics only when supplier view is present", () => {
    expect(resolveSrmPermissions(new Set(["org.orders\u0000view"]))).toEqual({
      canViewSuppliers: false,
      canEditSuppliers: false,
      canApproveSuppliers: false,
      canViewOrders: false,
      canViewSupplierSensitiveFields: false,
    });
  });

  it("view-only suppliers do not get sensitive field access", () => {
    expect(resolveSrmPermissions(new Set(["org.suppliers\u0000view"]))).toEqual({
      canViewSuppliers: true,
      canEditSuppliers: false,
      canApproveSuppliers: false,
      canViewOrders: false,
      canViewSupplierSensitiveFields: false,
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
      canViewSupplierSensitiveFields: true,
    });
  });
});
