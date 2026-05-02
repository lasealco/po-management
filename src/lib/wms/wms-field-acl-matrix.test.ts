import { describe, expect, it } from "vitest";

import { getWmsFieldAclMatrixSnapshot, inventoryAclKindForAction } from "./wms-field-acl-matrix";

describe("wms-field-acl-matrix (BF-48)", () => {
  it("matches stable manifest snapshot", () => {
    expect(getWmsFieldAclMatrixSnapshot()).toMatchInlineSnapshot(`
      {
        "inventory": {
          "lotMetadataOnly": [
            "set_wms_lot_batch",
          ],
          "serialRegistryOnly": [
            "attach_inventory_serial_to_movement",
            "register_inventory_serial",
            "set_inventory_serial_balance",
          ],
        },
        "version": 1,
      }
    `);
  });

  it("classifies inventory-tier POST actions", () => {
    expect(inventoryAclKindForAction("set_wms_lot_batch")).toBe("lot_metadata");
    expect(inventoryAclKindForAction("register_inventory_serial")).toBe("serial_registry");
    expect(inventoryAclKindForAction("set_balance_hold")).toBe("full_inventory");
    expect(inventoryAclKindForAction("apply_inventory_freeze")).toBe("full_inventory");
    expect(inventoryAclKindForAction("release_inventory_freeze")).toBe("full_inventory");
  });
});
