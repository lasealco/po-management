import { Prisma } from "@prisma/client";

import { FUNGIBLE_LOT_CODE, normalizeLotCode } from "./lot-code";

/** Allocate a tenant-unique human-readable STO reference (collision-resistant). */
export async function allocateUniqueStockTransferReferenceCode(tx: Prisma.TransactionClient): Promise<string> {
  for (let attempt = 0; attempt < 16; attempt++) {
    const suffix = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`.toUpperCase();
    const referenceCode = `STO-${suffix}`;
    const clash = await tx.wmsStockTransfer.findUnique({
      where: { referenceCode },
      select: { id: true },
    });
    if (!clash) return referenceCode;
  }
  throw new Error("stock_transfer_reference_alloc_failed");
}

export type ParsedStockTransferLineInput = {
  productId: string;
  fromBinId: string;
  quantity: Prisma.Decimal;
  lotCode: string;
};

/** Parse create body line; returns null when invalid. */
export function parseStockTransferLineInput(raw: unknown): ParsedStockTransferLineInput | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const productId = typeof o.productId === "string" ? o.productId.trim() : "";
  const fromBinId = typeof o.fromBinId === "string" ? o.fromBinId.trim() : "";
  if (!productId || !fromBinId) return null;
  const qtyRaw = o.quantity;
  const n = typeof qtyRaw === "number" ? qtyRaw : Number(String(qtyRaw ?? "").trim());
  if (!Number.isFinite(n) || n <= 0) return null;
  let qty: Prisma.Decimal;
  try {
    qty = new Prisma.Decimal(n);
  } catch {
    return null;
  }
  if (qty.lte(0)) return null;
  const lcRaw = o.lotCode;
  const lotCode =
    lcRaw == null || lcRaw === ""
      ? FUNGIBLE_LOT_CODE
      : normalizeLotCode(typeof lcRaw === "string" ? lcRaw : String(lcRaw));
  return { productId, fromBinId, quantity: qty, lotCode };
}

export function truncateStockTransferNote(raw: string | null | undefined, max = 500): string | null {
  if (raw == null) return null;
  const t = raw.trim();
  if (!t.length) return null;
  return t.length > max ? t.slice(0, max) : t;
}
