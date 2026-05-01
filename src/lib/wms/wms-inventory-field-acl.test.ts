import { describe, expect, it } from "vitest";

import { evaluateWmsInventoryPostMutationAccess } from "./wms-inventory-field-acl";

describe("evaluateWmsInventoryPostMutationAccess (BF-16)", () => {
  it("allows set_wms_lot_batch with inventory.lot edit alone", () => {
    expect(
      evaluateWmsInventoryPostMutationAccess({
        action: "set_wms_lot_batch",
        legacyWmsEdit: false,
        inventoryEdit: false,
        inventoryLotEdit: true,
      }).allowed,
    ).toBe(true);
  });

  it("denies set_balance_hold with inventory.lot edit alone", () => {
    const d = evaluateWmsInventoryPostMutationAccess({
      action: "set_balance_hold",
      legacyWmsEdit: false,
      inventoryEdit: false,
      inventoryLotEdit: true,
    });
    expect(d.allowed).toBe(false);
    if (!d.allowed) expect(d.error).toContain("org.wms.inventory → edit");
  });

  it("allows qty-path inventory actions with inventory edit alone", () => {
    expect(
      evaluateWmsInventoryPostMutationAccess({
        action: "clear_balance_hold",
        legacyWmsEdit: false,
        inventoryEdit: true,
        inventoryLotEdit: false,
      }).allowed,
    ).toBe(true);
  });

  it("allows lot batch with full inventory edit (backward compatible)", () => {
    expect(
      evaluateWmsInventoryPostMutationAccess({
        action: "set_wms_lot_batch",
        legacyWmsEdit: false,
        inventoryEdit: true,
        inventoryLotEdit: false,
      }).allowed,
    ).toBe(true);
  });
});
