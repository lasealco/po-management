import { describe, expect, it } from "vitest";

import { evaluateWmsInventoryPostMutationAccess } from "./wms-inventory-field-acl";

const denySerial = {
  legacyWmsEdit: false,
  inventoryEdit: false,
  inventoryLotEdit: false,
  inventorySerialEdit: false,
} as const;

describe("evaluateWmsInventoryPostMutationAccess (BF-16 + BF-48)", () => {
  it("allows set_wms_lot_batch with inventory.lot edit alone", () => {
    expect(
      evaluateWmsInventoryPostMutationAccess({
        action: "set_wms_lot_batch",
        ...denySerial,
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
      inventorySerialEdit: false,
    });
    expect(d.allowed).toBe(false);
    if (!d.allowed) expect(d.error).toContain("org.wms.inventory → edit");
  });

  it("allows release_inventory_freeze with inventory edit alone", () => {
    expect(
      evaluateWmsInventoryPostMutationAccess({
        action: "release_inventory_freeze",
        legacyWmsEdit: false,
        inventoryEdit: true,
        inventoryLotEdit: false,
        inventorySerialEdit: false,
      }).allowed,
    ).toBe(true);
  });

  it("denies release_inventory_freeze with inventory.lot edit alone", () => {
    const d = evaluateWmsInventoryPostMutationAccess({
      action: "release_inventory_freeze",
      legacyWmsEdit: false,
      inventoryEdit: false,
      inventoryLotEdit: true,
      inventorySerialEdit: false,
    });
    expect(d.allowed).toBe(false);
    if (!d.allowed) expect(d.error).toContain("org.wms.inventory → edit");
  });

  it("denies register_inventory_serial with inventory.lot edit alone", () => {
    const d = evaluateWmsInventoryPostMutationAccess({
      action: "register_inventory_serial",
      legacyWmsEdit: false,
      inventoryEdit: false,
      inventoryLotEdit: true,
      inventorySerialEdit: false,
    });
    expect(d.allowed).toBe(false);
    if (!d.allowed) expect(d.error).toContain("org.wms.inventory.serial");
  });

  it("allows register_inventory_serial with inventory.serial edit alone", () => {
    expect(
      evaluateWmsInventoryPostMutationAccess({
        action: "register_inventory_serial",
        ...denySerial,
        inventorySerialEdit: true,
      }).allowed,
    ).toBe(true);
  });

  it("allows qty-path inventory actions with inventory edit alone", () => {
    expect(
      evaluateWmsInventoryPostMutationAccess({
        action: "clear_balance_hold",
        legacyWmsEdit: false,
        inventoryEdit: true,
        inventoryLotEdit: false,
        inventorySerialEdit: false,
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
        inventorySerialEdit: false,
      }).allowed,
    ).toBe(true);
  });
});
