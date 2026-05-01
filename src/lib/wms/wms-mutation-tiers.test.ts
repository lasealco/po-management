import { describe, expect, it } from "vitest";

import { wmsMutationTierForPostAction } from "./wms-mutation-tiers";

describe("wmsMutationTierForPostAction", () => {
  it("maps layout actions to setup", () => {
    expect(wmsMutationTierForPostAction("create_zone")).toBe("setup");
    expect(wmsMutationTierForPostAction("set_warehouse_pick_allocation_strategy")).toBe("setup");
  });

  it("maps execution actions to operations", () => {
    expect(wmsMutationTierForPostAction("complete_pick_task")).toBe("operations");
    expect(wmsMutationTierForPostAction("create_dock_appointment")).toBe("operations");
  });

  it("maps inventory controls to inventory", () => {
    expect(wmsMutationTierForPostAction("set_balance_hold")).toBe("inventory");
    expect(wmsMutationTierForPostAction("set_wms_lot_batch")).toBe("inventory");
  });

  it("maps receiving mutations including BF-12 receipts", () => {
    expect(wmsMutationTierForPostAction("create_wms_receipt")).toBe("operations");
    expect(wmsMutationTierForPostAction("set_wms_receipt_line")).toBe("operations");
  });

  it("maps BF-13 serial mutations to inventory tier", () => {
    expect(wmsMutationTierForPostAction("register_inventory_serial")).toBe("inventory");
    expect(wmsMutationTierForPostAction("attach_inventory_serial_to_movement")).toBe("inventory");
  });
});
