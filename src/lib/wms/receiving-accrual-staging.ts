import type { Prisma } from "@prisma/client";

/** BF-32 — versioned JSON snapshot written on `close_wms_receipt` for accounting CSV / ERP handoff. */
export const RECEIVING_ACCRUAL_SNAPSHOT_SCHEMA_VERSION = 1 as const;

export type ReceivingAccrualSnapshotLineV1 = {
  shipmentItemId: string;
  productId: string | null;
  productSku: string | null;
  productCode: string | null;
  productName: string | null;
  quantityShipped: string;
  quantityReceived: string;
  wmsVarianceDisposition: string;
};

export type ReceivingAccrualSnapshotV1 = {
  schemaVersion: typeof RECEIVING_ACCRUAL_SNAPSHOT_SCHEMA_VERSION;
  closedAt: string;
  grnReference: string | null;
  currency: string;
  shipmentRefs: {
    shipmentId: string;
    shipmentNo: string | null;
    asnReference: string | null;
    purchaseOrderId: string;
    purchaseOrderNumber: string;
  };
  lines: ReceivingAccrualSnapshotLineV1[];
};

export type BuildReceivingAccrualSnapshotShipmentInput = {
  id: string;
  shipmentNo: string | null;
  asnReference: string | null;
  order: { id: string; orderNumber: string; currency: string };
  items: Array<{
    id: string;
    quantityShipped: Prisma.Decimal | number | string;
    quantityReceived: Prisma.Decimal | number | string;
    wmsVarianceDisposition: string;
    orderItem: {
      productId: string | null;
      product: {
        id: string;
        sku: string | null;
        productCode: string | null;
        name: string;
      } | null;
    };
  }>;
};

function qtyToFixed3(value: Prisma.Decimal | number | string): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return "0.000";
  return n.toFixed(3);
}

export function buildReceivingAccrualSnapshotV1(params: {
  closedAt: Date;
  grnReference: string | null;
  shipment: BuildReceivingAccrualSnapshotShipmentInput;
}): ReceivingAccrualSnapshotV1 {
  const { closedAt, grnReference, shipment } = params;
  return {
    schemaVersion: RECEIVING_ACCRUAL_SNAPSHOT_SCHEMA_VERSION,
    closedAt: closedAt.toISOString(),
    grnReference,
    currency: shipment.order.currency?.trim() || "USD",
    shipmentRefs: {
      shipmentId: shipment.id,
      shipmentNo: shipment.shipmentNo,
      asnReference: shipment.asnReference,
      purchaseOrderId: shipment.order.id,
      purchaseOrderNumber: shipment.order.orderNumber,
    },
    lines: shipment.items.map((it) => {
      const p = it.orderItem.product;
      return {
        shipmentItemId: it.id,
        productId: it.orderItem.productId ?? p?.id ?? null,
        productSku: p?.sku ?? null,
        productCode: p?.productCode ?? null,
        productName: p?.name ?? null,
        quantityShipped: qtyToFixed3(it.quantityShipped),
        quantityReceived: qtyToFixed3(it.quantityReceived),
        wmsVarianceDisposition: String(it.wmsVarianceDisposition),
      };
    }),
  };
}

export function isReceivingAccrualSnapshotV1(value: unknown): value is ReceivingAccrualSnapshotV1 {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    v.schemaVersion === RECEIVING_ACCRUAL_SNAPSHOT_SCHEMA_VERSION &&
    typeof v.closedAt === "string" &&
    "lines" in v &&
    Array.isArray(v.lines)
  );
}

export type AccrualStagingCsvRow = {
  stagingId: string;
  stagingCreatedAt: string;
  wmsReceiptId: string;
  shipmentId: string;
  crmAccountId: string | null;
  warehouseId: string | null;
  purchaseOrderNumber: string;
  shipmentNo: string;
  asnReference: string;
  grnReference: string;
  currency: string;
  lineShipmentItemId: string;
  productId: string;
  productSku: string;
  productCode: string;
  productName: string;
  quantityShipped: string;
  quantityReceived: string;
  wmsVarianceDisposition: string;
};

/** RFC4180-ish CSV cell escaping for staging export. */
export function escapeCsvCell(raw: string): string {
  const s = raw.replace(/\r\n|\r|\n/g, " ");
  if (/[",]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function flattenReceivingAccrualStagingToCsvRows(staging: {
  id: string;
  createdAt: Date;
  wmsReceiptId: string;
  shipmentId: string;
  crmAccountId: string | null;
  warehouseId: string | null;
  snapshotJson: unknown;
}): AccrualStagingCsvRow[] {
  const snap = staging.snapshotJson;
  if (!isReceivingAccrualSnapshotV1(snap)) return [];

  const base = {
    stagingId: staging.id,
    stagingCreatedAt: staging.createdAt.toISOString(),
    wmsReceiptId: staging.wmsReceiptId,
    shipmentId: staging.shipmentId,
    crmAccountId: staging.crmAccountId,
    warehouseId: staging.warehouseId,
    purchaseOrderNumber: snap.shipmentRefs.purchaseOrderNumber,
    shipmentNo: snap.shipmentRefs.shipmentNo ?? "",
    asnReference: snap.shipmentRefs.asnReference ?? "",
    grnReference: snap.grnReference ?? "",
    currency: snap.currency,
  };

  return snap.lines.map((ln) => ({
    ...base,
    lineShipmentItemId: ln.shipmentItemId,
    productId: ln.productId ?? "",
    productSku: ln.productSku ?? "",
    productCode: ln.productCode ?? "",
    productName: ln.productName ?? "",
    quantityShipped: ln.quantityShipped,
    quantityReceived: ln.quantityReceived,
    wmsVarianceDisposition: ln.wmsVarianceDisposition,
  }));
}

const CSV_HEADER: (keyof AccrualStagingCsvRow)[] = [
  "stagingId",
  "stagingCreatedAt",
  "wmsReceiptId",
  "shipmentId",
  "crmAccountId",
  "warehouseId",
  "purchaseOrderNumber",
  "shipmentNo",
  "asnReference",
  "grnReference",
  "currency",
  "lineShipmentItemId",
  "productId",
  "productSku",
  "productCode",
  "productName",
  "quantityShipped",
  "quantityReceived",
  "wmsVarianceDisposition",
];

export function receivingAccrualStagingCsvFromRows(rows: AccrualStagingCsvRow[]): string {
  const header = CSV_HEADER.join(",");
  const body = rows.map((r) => CSV_HEADER.map((k) => escapeCsvCell(String(r[k] ?? ""))).join(","));
  return [header, ...body].join("\n") + (rows.length ? "\n" : "");
}
