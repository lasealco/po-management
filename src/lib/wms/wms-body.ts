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
  /** ASN / notice reference or scheduled receive window (inbound). */
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
  holdReason?: string | null;
  /** Physical count when completing a cycle-count task. */
  countedQty?: number;
};
