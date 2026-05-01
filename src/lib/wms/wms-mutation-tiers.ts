/** BF-06 — coarse tier per `POST /api/wms` action; BF-16 refines the `inventory` tier for some actions — see `wms-inventory-field-acl.ts`. */
export type WmsMutationTier = "setup" | "operations" | "inventory";

const WMS_POST_ACTION_TIER: Record<string, WmsMutationTier> = {
  set_warehouse_pick_allocation_strategy: "setup",
  set_warehouse_pick_wave_carton_units: "setup",
  create_zone: "setup",
  set_zone_parent: "setup",
  create_bin: "setup",
  update_bin_profile: "setup",
  set_replenishment_rule: "setup",

  create_replenishment_tasks: "operations",

  create_outbound_order: "operations",
  set_outbound_order_asn_fields: "operations",
  set_outbound_crm_account: "operations",
  explode_crm_quote_to_outbound: "operations",
  release_outbound_order: "operations",

  create_putaway_task: "operations",
  complete_putaway_task: "operations",

  create_pick_task: "operations",
  create_pick_wave: "operations",
  release_wave: "operations",
  complete_wave: "operations",
  complete_pick_task: "operations",

  mark_outbound_packed: "operations",
  mark_outbound_shipped: "operations",

  set_shipment_inbound_fields: "operations",
  set_wms_receiving_status: "operations",
  set_shipment_item_receive_line: "operations",
  create_wms_receipt: "operations",
  close_wms_receipt: "operations",
  set_wms_receipt_line: "operations",

  set_wms_lot_batch: "inventory",

  register_inventory_serial: "inventory",
  set_inventory_serial_balance: "inventory",
  attach_inventory_serial_to_movement: "inventory",

  create_dock_appointment: "operations",
  cancel_dock_appointment: "operations",
  set_dock_appointment_transport: "operations",
  record_dock_appointment_yard_milestone: "operations",

  record_shipment_milestone: "operations",

  set_balance_hold: "inventory",
  clear_balance_hold: "inventory",

  complete_replenish_task: "operations",

  create_cycle_count_task: "inventory",
  complete_cycle_count_task: "inventory",

  create_work_order: "operations",
  /** BF-09 — customer-facing intake shell → same warehouse WO row as ops-created tickets. */
  request_customer_vas_work_order: "operations",
  /** BF-09 — manual BOM / labor planning snapshot (cents + minutes). */
  set_work_order_commercial_estimate: "operations",
  create_value_add_task: "operations",
  complete_value_add_task: "operations",
};

/** Tier for a known handler action, or `undefined` when the keyword is not mapped (legacy `org.wms` edit only). */
export function wmsMutationTierForPostAction(action: string): WmsMutationTier | undefined {
  return WMS_POST_ACTION_TIER[action];
}
