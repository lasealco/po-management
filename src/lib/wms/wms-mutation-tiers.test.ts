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

  it("returns undefined for unknown actions", () => {
    expect(wmsMutationTierForPostAction("not_a_real_action")).toBeUndefined();
  });
});
