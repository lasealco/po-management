import { describe, expect, it } from "vitest";

import { controlTowerShipmentScopeWhere } from "./viewer";

describe("controlTowerShipmentScopeWhere", () => {
  it("scopes to tenant via purchase order for default viewer", () => {
    const w = controlTowerShipmentScopeWhere("tenant-1", {
      isRestrictedView: false,
      isSupplierPortal: false,
      customerCrmAccountId: null,
    });
    expect(w).toEqual({ order: { tenantId: "tenant-1" } });
  });

  it("requires supplier-portal PO workflow when viewer is supplier portal", () => {
    const w = controlTowerShipmentScopeWhere("t1", {
      isRestrictedView: true,
      isSupplierPortal: true,
      customerCrmAccountId: null,
    });
    expect(w).toEqual({
      order: { tenantId: "t1", workflow: { supplierPortalOn: true } },
    });
  });

  it("filters shipments by CRM account when customer portal context is set", () => {
    const w = controlTowerShipmentScopeWhere("t1", {
      isRestrictedView: true,
      isSupplierPortal: false,
      customerCrmAccountId: "crm-acc-1",
    });
    expect(w).toEqual({
      customerCrmAccountId: "crm-acc-1",
      order: { tenantId: "t1" },
    });
  });

  it("combines supplier portal order gate with CRM account filter", () => {
    const w = controlTowerShipmentScopeWhere("t1", {
      isRestrictedView: true,
      isSupplierPortal: true,
      customerCrmAccountId: "crm-2",
    });
    expect(w).toEqual({
      customerCrmAccountId: "crm-2",
      order: { tenantId: "t1", workflow: { supplierPortalOn: true } },
    });
  });
});
