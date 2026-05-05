/**
 * BF-91 — FIFO-ish inventory aging buckets from earliest inbound ledger heuristic (not cost layers).
 */

import { Prisma, type InventoryMovementType, type PrismaClient } from "@prisma/client";

import {
  echoInventoryOwnershipBf79Filter,
  inventoryOwnershipBf79FilterToWhere,
  type ParsedInventoryOwnershipBf79BalanceFilter,
} from "@/lib/wms/inventory-ownership-bf79";
import { loadWmsViewReadScope, type WmsViewReadScope } from "@/lib/wms/wms-read-scope";

export const BF91_SCHEMA_VERSION = "bf91.v1" as const;

/** Positive-qty ledger types treated as “first receipt” candidates for aging anchor. */
export const BF91_INBOUND_MOVEMENT_TYPES: readonly InventoryMovementType[] = [
  "RECEIPT",
  "PUTAWAY",
  "STO_RECEIVE",
  "ADJUSTMENT",
];

export function ageDaysBetween(firstInboundAt: Date, now: Date): number {
  const ms = now.getTime() - firstInboundAt.getTime();
  return Math.floor(ms / 86_400_000);
}

export function agingBucketForAgeDays(days: number | null): string {
  if (days === null) return "UNKNOWN";
  if (days <= 30) return "0-30d";
  if (days <= 90) return "31-90d";
  if (days <= 180) return "91-180d";
  if (days <= 365) return "181-365d";
  return "366d+";
}

export type Bf91Row = {
  balanceId: string;
  warehouseId: string;
  warehouseCode: string;
  binId: string;
  binCode: string;
  productId: string;
  sku: string | null;
  productCode: string | null;
  productName: string;
  lotCode: string;
  onHandQty: string;
  allocatedQty: string;
  onHold: boolean;
  inventoryOwnershipSupplierIdBf79: string | null;
  /** Earliest qualifying inbound movement for warehouse+bin+product; lot not modeled on ledger rows. */
  firstInboundAt: string | null;
  ageDays: number | null;
  agingBucket: string;
};

export type Bf91SummaryBucket = {
  bucket: string;
  rowCount: number;
  onHandQty: string;
};

export type Bf91Doc = {
  schemaVersion: typeof BF91_SCHEMA_VERSION;
  generatedAt: string;
  warehouseId: string | null;
  balanceRowLimit: number;
  heuristicNote: string;
  ownershipFilter:
    | ReturnType<typeof echoInventoryOwnershipBf79Filter>
    | null;
  rows: Bf91Row[];
  summaryByBucket: Bf91SummaryBucket[];
};

export function firstInboundKey(warehouseId: string, binId: string, productId: string): string {
  return `${warehouseId}\t${binId}\t${productId}`;
}

/** Build summary totals from rows (deterministic bucket order). */
export function summarizeBf91RowsByBucket(rows: Bf91Row[]): Bf91SummaryBucket[] {
  const order = ["0-30d", "31-90d", "91-180d", "181-365d", "366d+", "UNKNOWN"];
  const idx = new Map(order.map((b, i) => [b, i]));
  const map = new Map<string, { rowCount: number; qty: Prisma.Decimal }>();
  for (const r of rows) {
    const cur = map.get(r.agingBucket) ?? { rowCount: 0, qty: new Prisma.Decimal(0) };
    cur.rowCount += 1;
    cur.qty = cur.qty.plus(new Prisma.Decimal(r.onHandQty));
    map.set(r.agingBucket, cur);
  }
  const keys = [...map.keys()].sort((a, b) => (idx.get(a) ?? 99) - (idx.get(b) ?? 99));
  return keys.map((bucket) => {
    const v = map.get(bucket)!;
    return { bucket, rowCount: v.rowCount, onHandQty: v.qty.toString() };
  });
}

export function inventoryAgingExportBf91ToCsv(doc: Bf91Doc): string {
  const headers = [
    "warehouseCode",
    "binCode",
    "sku",
    "productCode",
    "productName",
    "lotCode",
    "onHandQty",
    "allocatedQty",
    "onHold",
    "inventoryOwnershipSupplierIdBf79",
    "firstInboundAt",
    "ageDays",
    "agingBucket",
    "balanceId",
  ];
  const lines = [headers.join(",")];
  for (const r of doc.rows) {
    const cells = [
      r.warehouseCode,
      r.binCode,
      r.sku ?? "",
      r.productCode ?? "",
      r.productName,
      r.lotCode,
      r.onHandQty,
      r.allocatedQty,
      r.onHold ? "true" : "false",
      r.inventoryOwnershipSupplierIdBf79 ?? "",
      r.firstInboundAt ?? "",
      r.ageDays !== null ? String(r.ageDays) : "",
      r.agingBucket,
      r.balanceId,
    ].map(csvEscapeBf91);
    lines.push(cells.join(","));
  }
  return `${lines.join("\r\n")}\r\n`;
}

function csvEscapeBf91(v: string): string {
  const needsQuote = /[",\n\r]/.test(v);
  const escaped = v.replace(/"/g, '""');
  return needsQuote ? `"${escaped}"` : escaped;
}

export async function loadInventoryAgingExportBf91(
  prisma: PrismaClient,
  tenantId: string,
  actorUserId: string,
  opts: {
    warehouseId?: string | null;
    ownershipFilter?: ParsedInventoryOwnershipBf79BalanceFilter | null;
    limit?: number;
    viewScope?: WmsViewReadScope;
  },
): Promise<{ ok: true; doc: Bf91Doc } | { ok: false; status: number; error: string }> {
  const warehouseId = opts.warehouseId?.trim() || null;
  if (warehouseId) {
    const wh = await prisma.warehouse.findFirst({
      where: { id: warehouseId, tenantId },
      select: { id: true },
    });
    if (!wh) return { ok: false, status: 404, error: "Warehouse not found." };
  }

  const scope = opts.viewScope ?? (await loadWmsViewReadScope(tenantId, actorUserId));

  const ownershipWhere = inventoryOwnershipBf79FilterToWhere(opts.ownershipFilter ?? undefined);

  const balanceWhereBase: Prisma.InventoryBalanceWhereInput = {
    tenantId,
    onHandQty: { gt: new Prisma.Decimal(0) },
    ...(warehouseId ? { warehouseId } : {}),
    ...(scope.inventoryProduct ? { product: scope.inventoryProduct } : {}),
    ...(ownershipWhere ?? {}),
  };

  const limitRaw = opts.limit;
  const balanceRowLimit =
    limitRaw !== undefined && Number.isFinite(limitRaw)
      ? Math.min(10_000, Math.max(1, Math.trunc(limitRaw)))
      : 5000;

  const ownershipEcho =
    opts.ownershipFilter != null ? echoInventoryOwnershipBf79Filter(opts.ownershipFilter) : null;

  const [aggregates, balances] = await Promise.all([
    prisma.inventoryMovement.groupBy({
      by: ["warehouseId", "binId", "productId"],
      where: {
        tenantId,
        binId: { not: null },
        quantity: { gt: new Prisma.Decimal(0) },
        movementType: { in: [...BF91_INBOUND_MOVEMENT_TYPES] },
        ...(warehouseId ? { warehouseId } : {}),
      },
      _min: { createdAt: true },
    }),
    prisma.inventoryBalance.findMany({
      where: balanceWhereBase,
      take: balanceRowLimit,
      orderBy: [{ warehouseId: "asc" }, { binId: "asc" }, { productId: "asc" }, { lotCode: "asc" }],
      select: {
        id: true,
        warehouseId: true,
        binId: true,
        productId: true,
        lotCode: true,
        onHandQty: true,
        allocatedQty: true,
        onHold: true,
        inventoryOwnershipSupplierIdBf79: true,
        warehouse: { select: { code: true } },
        bin: { select: { code: true } },
        product: {
          select: { sku: true, productCode: true, name: true },
        },
      },
    }),
  ]);

  const inboundMin = new Map<string, Date>();
  for (const row of aggregates) {
    const bid = row.binId;
    if (!bid || !row._min.createdAt) continue;
    inboundMin.set(firstInboundKey(row.warehouseId, bid, row.productId), row._min.createdAt);
  }

  const now = new Date();
  const heuristicNote =
    "FIFO-ish stub: aging anchor = MIN(ledger createdAt) over RECEIPT|PUTAWAY|STO_RECEIVE|ADJUSTMENT movements with quantity>0 per warehouse+bin+product. InventoryMovement has no lotCode — split lot balances sharing the same bin+product reuse the same inferred anchor.";

  const rows: Bf91Row[] = balances.map((b) => {
    const key = firstInboundKey(b.warehouseId, b.binId, b.productId);
    const minAt = inboundMin.get(key) ?? null;
    const ageDays = minAt ? ageDaysBetween(minAt, now) : null;
    const agingBucket = agingBucketForAgeDays(ageDays);
    return {
      balanceId: b.id,
      warehouseId: b.warehouseId,
      warehouseCode: b.warehouse.code ?? "",
      binId: b.binId,
      binCode: b.bin.code ?? "",
      productId: b.productId,
      sku: b.product.sku,
      productCode: b.product.productCode,
      productName: b.product.name,
      lotCode: b.lotCode ?? "",
      onHandQty: b.onHandQty.toString(),
      allocatedQty: b.allocatedQty.toString(),
      onHold: b.onHold,
      inventoryOwnershipSupplierIdBf79: b.inventoryOwnershipSupplierIdBf79 ?? null,
      firstInboundAt: minAt?.toISOString() ?? null,
      ageDays,
      agingBucket,
    };
  });

  const doc: Bf91Doc = {
    schemaVersion: BF91_SCHEMA_VERSION,
    generatedAt: now.toISOString(),
    warehouseId,
    balanceRowLimit,
    heuristicNote,
    ownershipFilter: ownershipEcho,
    rows,
    summaryByBucket: summarizeBf91RowsByBucket(rows),
  };

  return { ok: true, doc };
}
