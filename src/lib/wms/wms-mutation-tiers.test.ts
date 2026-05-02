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

  it("maps BF-14 quote explosion to operations tier", () => {
    expect(wmsMutationTierForPostAction("explode_crm_quote_to_outbound")).toBe("operations");
  });

  it("maps BF-17 TMS dock refs mutation to operations tier", () => {
    expect(wmsMutationTierForPostAction("set_dock_appointment_tms_refs")).toBe("operations");
  });

  it("maps BF-15 carton cap mutation to setup tier", () => {
    expect(wmsMutationTierForPostAction("set_warehouse_pick_wave_carton_units")).toBe("setup");
  });

  it("maps BF-18 work order BOM mutations to operations tier", () => {
    expect(wmsMutationTierForPostAction("replace_work_order_bom_lines")).toBe("operations");
    expect(wmsMutationTierForPostAction("consume_work_order_bom_line")).toBe("operations");
  });

  it("maps BF-26 CRM engineering BOM sync to operations tier", () => {
    expect(wmsMutationTierForPostAction("link_work_order_crm_quote_line")).toBe("operations");
    expect(wmsMutationTierForPostAction("sync_work_order_bom_from_crm_quote_line")).toBe("operations");
  });

  it("maps BF-31 ASN tolerance evaluate POST to operations tier", () => {
    expect(wmsMutationTierForPostAction("evaluate_wms_receipt_asn_tolerance")).toBe("operations");
  });

  it("maps BF-53 labor standard + start task tiers", () => {
    expect(wmsMutationTierForPostAction("set_wms_labor_task_standard")).toBe("setup");
    expect(wmsMutationTierForPostAction("start_wms_task")).toBe("operations");
  });

  it("maps BF-54 dock detention policy to setup tier", () => {
    expect(wmsMutationTierForPostAction("set_wms_dock_detention_policy")).toBe("setup");
  });

  it("maps BF-55 stock transfer actions to operations tier", () => {
    expect(wmsMutationTierForPostAction("create_wms_stock_transfer")).toBe("operations");
    expect(wmsMutationTierForPostAction("release_wms_stock_transfer")).toBe("operations");
    expect(wmsMutationTierForPostAction("cancel_wms_stock_transfer")).toBe("operations");
    expect(wmsMutationTierForPostAction("set_wms_stock_transfer_line")).toBe("operations");
    expect(wmsMutationTierForPostAction("ship_wms_stock_transfer")).toBe("operations");
    expect(wmsMutationTierForPostAction("receive_wms_stock_transfer")).toBe("operations");
  });

  it("maps BF-57 outbound LU hierarchy validate to operations tier", () => {
    expect(wmsMutationTierForPostAction("validate_outbound_lu_hierarchy")).toBe("operations");
  });

  it("maps BF-58 inventory freeze actions to inventory tier", () => {
    expect(wmsMutationTierForPostAction("apply_inventory_freeze")).toBe("inventory");
    expect(wmsMutationTierForPostAction("release_inventory_freeze")).toBe("inventory");
  });
});
