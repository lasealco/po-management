/**
 * BF-78 — STO header export (JSON + CSV) including landed-cost / FX narrative columns.
 */

import type { PrismaClient } from "@prisma/client";

import {
  type LandedCostNotesBf78V1,
  parseStoredLandedCostNotesBf78Json,
} from "@/lib/wms/landed-cost-notes-bf78";

export const STO_EXPORT_BF78_SCHEMA_VERSION = "bf78.v1" as const;

export type StockTransferExportBf78Row = {
  id: string;
  referenceCode: string;
  status: string;
  note: string | null;
  releasedAt: string | null;
  shippedAt: string | null;
  receivedAt: string | null;
  updatedAt: string;
  fromWarehouseCode: string | null;
  fromWarehouseName: string;
  toWarehouseCode: string | null;
  toWarehouseName: string;
  landedCostNotesBf78: LandedCostNotesBf78V1 | null;
  landedCostNotesBf78Notice: string | null;
};

export type StockTransferExportBf78Doc = {
  schemaVersion: typeof STO_EXPORT_BF78_SCHEMA_VERSION;
  generatedAt: string;
  warehouseId: string | null;
  transfers: StockTransferExportBf78Row[];
};

function csvEscape(v: string): string {
  if (/[",\n\r]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
  return v;
}

export function stockTransferExportBf78ToCsv(doc: StockTransferExportBf78Doc): string {
  const header = [
    "referenceCode",
    "status",
    "fromWarehouseCode",
    "toWarehouseCode",
    "releasedAt",
    "shippedAt",
    "receivedAt",
    "updatedAt",
    "operatorNote",
    "landedCostNotes",
    "fxBaseCurrency",
    "fxQuoteCurrency",
    "fxRate",
    "fxRateSourceNarrative",
    "landedCostParseNotice",
  ].join(",");
  const lines: string[] = [header];
  for (const t of doc.transfers) {
    const lc = t.landedCostNotesBf78;
    lines.push(
      [
        csvEscape(t.referenceCode),
        csvEscape(t.status),
        csvEscape(t.fromWarehouseCode ?? ""),
        csvEscape(t.toWarehouseCode ?? ""),
        csvEscape(t.releasedAt ?? ""),
        csvEscape(t.shippedAt ?? ""),
        csvEscape(t.receivedAt ?? ""),
        csvEscape(t.updatedAt),
        csvEscape(t.note ?? ""),
        csvEscape(lc?.notes ?? ""),
        csvEscape(lc?.fxBaseCurrency ?? ""),
        csvEscape(lc?.fxQuoteCurrency ?? ""),
        csvEscape(lc?.fxRate ?? ""),
        csvEscape(lc?.fxRateSourceNarrative ?? ""),
        csvEscape(t.landedCostNotesBf78Notice ?? ""),
      ].join(","),
    );
  }
  return `${lines.join("\n")}\n`;
}

export async function loadStockTransferExportBf78(
  prisma: PrismaClient,
  tenantId: string,
  opts: { warehouseId?: string | null; limit?: number },
): Promise<StockTransferExportBf78Doc> {
  const wid = opts.warehouseId?.trim() || null;
  let limit = opts.limit ?? 200;
  if (!Number.isFinite(limit)) limit = 200;
  limit = Math.min(500, Math.max(1, Math.floor(limit)));

  const where = {
    tenantId,
    ...(wid
      ? {
          OR: [{ fromWarehouseId: wid }, { toWarehouseId: wid }],
        }
      : {}),
  };

  const rows = await prisma.wmsStockTransfer.findMany({
    where,
    orderBy: { updatedAt: "desc" },
    take: limit,
    select: {
      id: true,
      referenceCode: true,
      status: true,
      note: true,
      landedCostNotesBf78Json: true,
      releasedAt: true,
      shippedAt: true,
      receivedAt: true,
      updatedAt: true,
      fromWarehouse: { select: { code: true, name: true } },
      toWarehouse: { select: { code: true, name: true } },
    },
  });

  const transfers: StockTransferExportBf78Row[] = rows.map((st) => {
    const parsed = parseStoredLandedCostNotesBf78Json(st.landedCostNotesBf78Json);
    return {
      id: st.id,
      referenceCode: st.referenceCode,
      status: st.status,
      note: st.note,
      releasedAt: st.releasedAt?.toISOString() ?? null,
      shippedAt: st.shippedAt?.toISOString() ?? null,
      receivedAt: st.receivedAt?.toISOString() ?? null,
      updatedAt: st.updatedAt.toISOString(),
      fromWarehouseCode: st.fromWarehouse.code,
      fromWarehouseName: st.fromWarehouse.name,
      toWarehouseCode: st.toWarehouse.code,
      toWarehouseName: st.toWarehouse.name,
      landedCostNotesBf78: parsed.doc,
      landedCostNotesBf78Notice: parsed.notice,
    };
  });

  return {
    schemaVersion: STO_EXPORT_BF78_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    warehouseId: wid,
    transfers,
  };
}
