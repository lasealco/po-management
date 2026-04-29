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
  /** ISO datetime string or null to clear. */
  expectedReceiveAt?: string | null;
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
  maxPallets?: number | null;
  /** Physical rack / bay grouping for maps (optional). */
  rackCode?: string | null;
  aisle?: string | null;
  bay?: string | null;
  level?: number | null;
  positionIndex?: number | null;
  minPickQty?: number;
  maxPickQty?: number;
  replenishQty?: number;
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
  /** Physical count when completing a cycle-count task. */
  countedQty?: number;
  /** `create_dock_appointment` / `cancel_dock_appointment`. */
  dockAppointmentId?: string;
  dockCode?: string;
  /** ISO datetime strings for dock window. */
  dockWindowStart?: string;
  dockWindowEnd?: string;
  dockDirection?: "INBOUND" | "OUTBOUND";
  /** BF-05 — optional carrier / trailer metadata (`create_dock_appointment`, `set_dock_appointment_transport`). */
  carrierName?: string | null;
  carrierReference?: string | null;
  trailerId?: string | null;
  /** BF-05 — `record_dock_appointment_yard_milestone`. */
  yardMilestone?: "GATE_IN" | "AT_DOCK" | "DEPARTED";
  /** ISO datetime for yard milestone (defaults to now). */
  yardOccurredAt?: string;
  /** Target allocation strategy for `set_warehouse_pick_allocation_strategy`. */
  pickAllocationStrategy?: "MAX_AVAILABLE_FIRST" | "FIFO_BY_BIN_CODE" | "FEFO_BY_LOT_EXPIRY" | "MANUAL_ONLY";
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
  /** BF-09 — whole cents; send `null` to clear when patching estimates. */
  estimatedMaterialsCents?: number | null;
  /** BF-09 — planned minutes; send `null` to clear. */
  estimatedLaborMinutes?: number | null;
};
