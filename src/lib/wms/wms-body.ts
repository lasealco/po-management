/** JSON body for `POST /api/wms` (action discriminator). */
export type WmsBody = {
  action?: string;
  warehouseId?: string;
  code?: string;
  name?: string;
  zoneType?: "RECEIVING" | "PICKING" | "RESERVE" | "QUARANTINE" | "STAGING" | "SHIPPING";
  shipmentItemId?: string;
  orderItemId?: string;
  shipmentId?: string;
  /**
   * Inbound: ASN / notice on `set_shipment_inbound_fields`. Outbound: ship notice / ASN on
   * `create_outbound_order` and `set_outbound_order_asn_fields`.
   */
  asnReference?: string | null;
  /**
   * BF-31 — optional 0–100; permitted %-delta vs shipped qty per inbound line (`ShipmentItem`)
   * when evaluating ASN tolerance (`evaluate_wms_receipt_asn_tolerance`, `close_wms_receipt` guards).
   */
  asnQtyTolerancePct?: number | string | null;
  /** ISO datetime string or null to clear. */
  expectedReceiveAt?: string | null;
  /** BF-37 — inbound shipment cross-dock tag (`set_shipment_inbound_fields`). */
  wmsCrossDock?: boolean;
  /** BF-37 — flow-through tag (`set_shipment_inbound_fields`). */
  wmsFlowThrough?: boolean;
  /** BF-41 — inbound subtype (`set_shipment_inbound_fields`). */
  wmsInboundSubtype?: "STANDARD" | "CUSTOMER_RETURN";
  /** BF-41 — RMA reference (`set_shipment_inbound_fields`). */
  wmsRmaReference?: string | null;
  /** BF-41 — optional outbound lineage (`set_shipment_inbound_fields`). */
  returnSourceOutboundOrderId?: string | null;
  /** BF-41 — line disposition for customer returns (`set_shipment_item_return_disposition`). */
  wmsReturnDisposition?: "RESTOCK" | "SCRAP" | "QUARANTINE";
  /** `ShipmentMilestoneCode` value for `record_shipment_milestone`. */
  milestoneCode?: string;
  outboundOrderId?: string;
  outboundLineId?: string;
  productId?: string;
  taskId?: string;
  waveId?: string;
  binId?: string | null;
  sourceBinId?: string;
  targetBinId?: string;
  sourceZoneId?: string | null;
  targetZoneId?: string | null;
  /** CRM account to attach (requires org.crm → view); omit or null to leave unset / clear. */
  crmAccountId?: string | null;
  customerRef?: string;
  /** ISO datetime for outbound requested ship (parallels inbound `expectedReceiveAt`). */
  requestedShipDate?: string | null;
  shipToName?: string;
  shipToLine1?: string;
  shipToCity?: string;
  shipToCountryCode?: string;
  storageType?: "PALLET" | "FLOOR" | "SHELF" | "QUARANTINE" | "STAGING";
  isPickFace?: boolean;
  /** BF-37 — cross-dock staging bin (`create_bin` / `update_bin_profile`). */
  isCrossDockStaging?: boolean;
  maxPallets?: number | null;
  /** BF-33 — optional bin cube capacity hint (`WarehouseBin.capacityCubeCubicMm`), cubic mm. */
  capacityCubeCubicMm?: number | null;
  /** Physical rack / bay grouping for maps (optional). */
  rackCode?: string | null;
  aisle?: string | null;
  bay?: string | null;
  level?: number | null;
  positionIndex?: number | null;
  minPickQty?: number;
  maxPickQty?: number;
  replenishQty?: number;
  /** BF-35 — `set_replenishment_rule`; higher runs first within tier. */
  priority?: number;
  /** BF-35 — max automated REPLENISH tasks per `create_replenishment_tasks` call; `null` clears cap (unlimited). */
  maxTasksPerRun?: number | null;
  /** BF-35 — exception tier (processed after normal rules). */
  exceptionQueue?: boolean;
  lines?: Array<{ productId: string; quantity: number }>;
  quantity?: number;
  note?: string | null;
  balanceId?: string;
  /** Target `WmsReceiveStatus` for `set_wms_receiving_status`. */
  toStatus?: string;
  holdReason?: string | null;
  /** `set_zone_parent` — target zone id (BF-04). */
  zoneId?: string;
  /** `set_zone_parent` — parent zone id or `null` to clear (same warehouse). */
  parentZoneId?: string | null;
  /** BF-24 — optional functional zone hint on aisle rows (`create_warehouse_aisle` / `update_warehouse_aisle`). */
  primaryZoneId?: string | null;
  /** BF-24 — link bin to `WarehouseAisle` (`create_bin` / `update_bin_profile`) or target aisle row (`update_warehouse_aisle`). */
  warehouseAisleId?: string | null;
  /** BF-24 — optional aisle geometry (millimetres). */
  lengthMm?: number | null;
  widthMm?: number | null;
  originXMm?: number | null;
  originYMm?: number | null;
  originZMm?: number | null;
  /** BF-24 — `update_warehouse_aisle` toggles `WarehouseAisle.isActive`. */
  isActive?: boolean;
  /** Physical count when completing a cycle-count task. */
  countedQty?: number;
  /** `create_dock_appointment` / `cancel_dock_appointment`. */
  dockAppointmentId?: string;
  dockCode?: string;
  /** BF-38 — optional physical door assignment (`create_dock_appointment`, `update_dock_appointment_bf38`). */
  doorCode?: string | null;
  /** BF-38 — trailer checklist JSON (`create_dock_appointment`, `update_dock_appointment_bf38`); null clears. */
  trailerChecklistJson?: unknown | null;
  /** ISO datetime strings for dock window. */
  dockWindowStart?: string;
  dockWindowEnd?: string;
  dockDirection?: "INBOUND" | "OUTBOUND";
  /** BF-05 — optional carrier / trailer metadata (`create_dock_appointment`, `set_dock_appointment_transport`). */
  carrierName?: string | null;
  carrierReference?: string | null;
  trailerId?: string | null;
  /** BF-17 — `set_dock_appointment_tms_refs` */
  tmsLoadId?: string | null;
  tmsCarrierBookingRef?: string | null;
  /** BF-05 — `record_dock_appointment_yard_milestone`. */
  yardMilestone?: "GATE_IN" | "AT_DOCK" | "DEPARTED";
  /** ISO datetime for yard milestone (defaults to now). */
  yardOccurredAt?: string;
  /** Target allocation strategy for `set_warehouse_pick_allocation_strategy`. */
  pickAllocationStrategy?:
    | "MAX_AVAILABLE_FIRST"
    | "FIFO_BY_BIN_CODE"
    | "FEFO_BY_LOT_EXPIRY"
    | "GREEDY_MIN_BIN_TOUCHES"
    | "GREEDY_RESERVE_PICK_FACE"
    | "GREEDY_MIN_BIN_TOUCHES_CUBE_AWARE"
    | "GREEDY_RESERVE_PICK_FACE_CUBE_AWARE"
    | "SOLVER_PROTOTYPE_MIN_BIN_TOUCHES"
    | "SOLVER_PROTOTYPE_MIN_BIN_TOUCHES_RESERVE_PICK_FACE"
    | "MANUAL_ONLY";
  /** BF-15 — max units per automated wave pick line (`set_warehouse_pick_wave_carton_units`); positive number or null clears. */
  pickWaveCartonUnits?: number | string | null;
  /** Optional batch/lot for putaway completion and manual picks (`InventoryBalance.lotCode`). */
  lotCode?: string | null;
  /** `create_value_add_task` — `WmsWorkOrder.id`; BF-09 `set_work_order_commercial_estimate` — target WO. */
  workOrderId?: string;
  /** `create_work_order` — title for value-add / labor ticket header. */
  workOrderTitle?: string;
  workOrderDescription?: string | null;
  /** `set_shipment_item_receive_line` — counted qty vs ASN line (`quantityShipped`). */
  receivedQty?: number;
  /** Optional override; omitted → derive MATCH/SHORT/OVER vs shipped qty. */
  varianceDisposition?: string | null;
  /** Optional operator note (max 1000); omit to leave unchanged; null clears. */
  varianceNote?: string | null;
  /** `set_wms_lot_batch` — optional expiry (ISO date); omit field to leave unchanged; null or "" clears. */
  batchExpiryDate?: string | null;
  /** `set_wms_lot_batch` — ISO country / region text; omit unchanged; null clears. */
  batchCountryOfOrigin?: string | null;
  /** `set_wms_lot_batch` — operator notes; omit unchanged; null clears. */
  batchNotes?: string | null;
  /** BF-09 — optional CRM counterparty on ops-created work orders. */
  workOrderCrmAccountId?: string | null;
  /** BF-26 — optional CPQ line for engineering BOM sync (`sync_work_order_bom_from_crm_quote_line`). */
  crmQuoteLineId?: string | null;
  /** BF-09 — whole cents; send `null` to clear when patching estimates. */
  estimatedMaterialsCents?: number | null;
  /** BF-09 — planned minutes; send `null` to clear. */
  estimatedLaborMinutes?: number | null;
  /** BF-10 — optional `CrmQuote.id`; must belong to same `crmAccountId`. */
  sourceCrmQuoteId?: string | null;

  /** BF-14 — `explode_crm_quote_to_outbound`: when true, creates outbound lines from CRM quote lines. */
  quoteExplosionConfirm?: boolean;

  /** BF-12 — `WmsReceipt.id` for `close_wms_receipt` / `set_wms_receipt_line`. */
  receiptId?: string;
  /** BF-12 — optional operator note on `create_wms_receipt` (max 2000). */
  receiptDockNote?: string | null;
  /** BF-12 — optional dock/unload timestamp on `create_wms_receipt` (ISO string). */
  receiptDockReceivedAt?: string | null;
  /**
   * BF-21 — when closing an OPEN dock receipt, optionally advance `Shipment.wmsReceiveStatus` to
   * `RECEIPT_COMPLETE` if the state machine allows it (typically from `RECEIVING`).
   */
  receiptCompleteOnClose?: boolean;
  /** BF-31 — optional GRN persisted on closing OPEN dock receipt (max 128). Ignored when generateGrn is true. */
  grnReference?: string | null;
  /** BF-31 — assign `GRN-YYYYMMDD-*` when closing OPEN dock receipt. */
  generateGrn?: boolean;
  /** BF-31 — only advance `receiptCompleteOnClose` receiving step when qty tolerance passes (if tolerance configured). */
  requireWithinAsnToleranceForAdvance?: boolean;
  /** BF-31 — refuse receipt close when tolerance configured but qty deltas violate band. */
  blockCloseIfOutsideTolerance?: boolean;

  /** BF-13 — `WmsInventorySerial.id` (alternative to `productId` + `inventorySerialNo`). */
  inventorySerialId?: string;
  /** BF-13 — raw serial token with `productId` when `inventorySerialId` omitted. */
  inventorySerialNo?: string;
  /** BF-13 — `InventoryMovement.id` for `attach_inventory_serial_to_movement`. */
  inventoryMovementId?: string;
  /** BF-13 — `InventoryBalance.id` for `set_inventory_serial_balance`; `null` clears pointer. */
  serialBalanceId?: string | null;
  /** BF-13 — optional operator note on `register_inventory_serial` (max 500); null clears. */
  inventorySerialNote?: string | null;

  /** BF-18 — `WmsWorkOrderBomLine.id` for `consume_work_order_bom_line`. */
  bomLineId?: string;
  /** BF-18 — full replace snapshot on `replace_work_order_bom_lines` (work order must be OPEN/IN_PROGRESS and no line consumed yet). */
  bomLines?: Array<{
    lineNo?: number;
    componentProductId: string;
    plannedQty: number;
    lineNote?: string | null;
  }>;

  /** BF-33 — master carton dimensions / units for cube-aware greedy waves (`set_product_carton_cube_hints`). */
  cartonLengthMm?: number | null;
  cartonWidthMm?: number | null;
  cartonHeightMm?: number | null;
  cartonUnitsPerMasterCarton?: number | string | null;
  /** BF-33 — planner hint on outbound (`set_outbound_order_cube_hint`), cubic metres. */
  estimatedCubeCbm?: number | string | null;

  /** BF-29 — scan tokens (SKU / product code / product id per unit) for pack or ship verification. */
  packScanTokens?: string[];
  shipScanTokens?: string[];

  /** BF-36 — `release_soft_reservation`. */
  softReservationId?: string;
  /** BF-36 — TTL seconds when `softReservationExpiresAt` omitted (server default 3600). */
  softReservationTtlSeconds?: number;
  /** BF-36 — absolute expiry ISO datetime (future); overrides TTL when set. */
  softReservationExpiresAt?: string | null;
  softReservationRefType?: string | null;
  softReservationRefId?: string | null;
  softReservationNote?: string | null;
};
