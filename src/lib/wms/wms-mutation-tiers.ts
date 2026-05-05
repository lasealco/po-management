/** BF-06 — coarse tier per `POST /api/wms` action; BF-16 + BF-48 refine `inventory` tier via `wms-field-acl-matrix.json` + `wms-inventory-field-acl.ts`. */
export type WmsMutationTier = "setup" | "operations" | "inventory";

const WMS_POST_ACTION_TIER: Record<string, WmsMutationTier> = {
  set_warehouse_pick_allocation_strategy: "setup",
  set_warehouse_pick_wave_carton_units: "setup",
  create_zone: "setup",
  set_zone_parent: "setup",
  create_warehouse_aisle: "setup",
  update_warehouse_aisle: "setup",
  /** BF-50 — JSON graph export for twin/sim vendors (same auth as setup mutations). */
  export_warehouse_topology_graph: "setup",
  /** BF-53 — engineered minutes per `WmsTaskType`. */
  set_wms_labor_task_standard: "setup",
  /** BF-54 — yard detention thresholds on `Tenant.wmsDockDetentionPolicyJson`. */
  set_wms_dock_detention_policy: "setup",
  /** BF-77 — labor variance queue thresholds (`Tenant.wmsLaborVariancePolicyJson`). */
  set_wms_labor_variance_policy: "setup",
  create_bin: "setup",
  update_bin_profile: "setup",
  set_product_carton_cube_hints: "setup",
  set_product_catch_weight_bf63: "setup",
  /** BF-69 — optional product g·(kg·km)⁻¹ planning factor for CO₂e narratives. */
  set_product_wms_co2e_factor_bf69: "setup",
  set_replenishment_rule: "setup",
  create_wms_receiving_disposition_template: "setup",
  update_wms_receiving_disposition_template: "setup",
  delete_wms_receiving_disposition_template: "setup",
  create_wms_outbound_webhook_subscription_bf44: "setup",
  update_wms_outbound_webhook_subscription_bf44: "setup",
  delete_wms_outbound_webhook_subscription_bf44: "setup",
  create_wms_partner_api_key_bf45: "setup",
  revoke_wms_partner_api_key_bf45: "setup",

  create_replenishment_tasks: "operations",
  /** BF-61 — weekly demand stub upsert (`WmsDemandForecastStub`). */
  upsert_wms_demand_forecast_stub: "operations",

  /** BF-55 — inter-warehouse stock transfer order (STO). */
  create_wms_stock_transfer: "operations",
  release_wms_stock_transfer: "operations",
  cancel_wms_stock_transfer: "operations",
  set_wms_stock_transfer_line: "operations",
  ship_wms_stock_transfer: "operations",
  receive_wms_stock_transfer: "operations",
  set_wms_stock_transfer_landed_cost_notes_bf78: "operations",

  /** BF-53 — optional floor clock on OPEN tasks before complete. */
  start_wms_task: "operations",

  create_outbound_order: "operations",
  set_outbound_order_asn_fields: "operations",
  set_outbound_crm_account: "operations",
  explode_crm_quote_to_outbound: "operations",
  release_outbound_order: "operations",
  set_outbound_order_cube_hint: "operations",
  /** BF-67 — multi-parcel tracking ids on outbound (`manifestParcelIds` JSON). */
  set_outbound_manifest_parcel_ids_bf67: "operations",

  create_putaway_task: "operations",
  complete_putaway_task: "operations",

  create_pick_task: "operations",
  create_pick_wave: "operations",
  release_wave: "operations",
  complete_wave: "operations",
  complete_pick_task: "operations",

  mark_outbound_packed: "operations",
  mark_outbound_shipped: "operations",
  validate_outbound_lu_hierarchy: "operations",
  validate_outbound_serial_aggregation_bf71: "operations",
  validate_outbound_dangerous_goods_bf72: "operations",
  submit_outbound_dangerous_goods_checklist_bf72: "operations",
  clear_outbound_dangerous_goods_checklist_bf72: "operations",
  validate_outbound_pack_scan: "operations",
  upsert_outbound_logistics_unit_bf43: "operations",
  delete_outbound_logistics_unit_bf43: "operations",
  request_demo_carrier_label: "operations",
  purchase_carrier_label: "operations",

  set_shipment_inbound_fields: "operations",
  set_wms_receiving_status: "operations",
  set_shipment_item_receive_line: "operations",
  set_shipment_item_catch_weight: "operations",
  set_shipment_item_return_disposition: "operations",
  set_shipment_item_qa_sampling_bf42: "operations",
  apply_wms_disposition_template_to_shipment_item: "operations",
  /** BF-65 — damage report + carrier claim export flow. */
  create_wms_damage_report_bf65: "operations",
  create_wms_receipt: "operations",
  close_wms_receipt: "operations",
  evaluate_wms_receipt_asn_tolerance: "operations",
  set_wms_receipt_line: "operations",

  set_wms_lot_batch: "inventory",

  register_inventory_serial: "inventory",
  set_inventory_serial_balance: "inventory",
  attach_inventory_serial_to_movement: "inventory",
  link_outbound_lu_serial_bf71: "inventory",
  unlink_outbound_lu_serial_bf71: "inventory",
  /** BF-64 — cold-chain custody segment on ledger movement. */
  set_inventory_movement_custody_segment_bf64: "inventory",
  set_inventory_movement_co2e_hint_bf69: "inventory",

  create_dock_appointment: "operations",
  cancel_dock_appointment: "operations",
  set_dock_appointment_transport: "operations",
  set_dock_appointment_tms_refs: "operations",
  record_dock_appointment_yard_milestone: "operations",
  /** BF-38 — door assignment + trailer checklist JSON on dock appointments. */
  update_dock_appointment_bf38: "operations",

  record_shipment_milestone: "operations",

  set_balance_hold: "inventory",
  /** BF-58 — structured freeze + optional bulk scope + restricted release grant. */
  apply_inventory_freeze: "inventory",
  clear_balance_hold: "inventory",
  set_inventory_balance_ownership_bf79: "inventory",
  /** BF-58 — same payload as clear_balance_hold; prefer for new integrations. */
  release_inventory_freeze: "inventory",

  /** BF-73 — recall campaign doc + scoped freeze materialization (BF-58). */
  create_recall_campaign_bf73: "inventory",
  materialize_recall_campaign_bf73: "inventory",
  close_recall_campaign_bf73: "inventory",

  create_soft_reservation: "inventory",
  release_soft_reservation: "inventory",

  complete_replenish_task: "operations",

  create_cycle_count_task: "inventory",
  complete_cycle_count_task: "inventory",

  create_cycle_count_session: "inventory",
  add_cycle_count_line: "inventory",
  set_cycle_count_line_count: "inventory",
  submit_cycle_count: "inventory",
  approve_cycle_count_variance: "inventory",

  create_work_order: "operations",
  /** BF-09 — customer-facing intake shell → same warehouse WO row as ops-created tickets. */
  request_customer_vas_work_order: "operations",
  /** BF-09 — manual BOM / labor planning snapshot (cents + minutes). */
  set_work_order_commercial_estimate: "operations",
  create_value_add_task: "operations",
  complete_value_add_task: "operations",
  /** BF-62 — kit assembly task from WO BOM + bin/lot picks. */
  create_kit_build_task: "operations",
  complete_kit_build_task: "operations",
  replace_work_order_bom_lines: "operations",
  consume_work_order_bom_line: "operations",
  /** BF-26 — attach CPQ line whose engineering BOM syncs into WMS. */
  link_work_order_crm_quote_line: "operations",
  /** BF-26 — replace WO BOM from linked `CrmQuoteLine.engineeringBomLines` (SKU → Product). */
  sync_work_order_bom_from_crm_quote_line: "operations",
};

/** Tier for a known handler action, or `undefined` when the keyword is not mapped (legacy `org.wms` edit only). */
export function wmsMutationTierForPostAction(action: string): WmsMutationTier | undefined {
  return WMS_POST_ACTION_TIER[action];
}
