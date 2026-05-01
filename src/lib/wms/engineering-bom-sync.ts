import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

import type { ParsedWorkOrderBomLine } from "./work-order-bom";

export type EngineeringBomLineRow = {
  sku: string;
  plannedQty: number;
  lineNo: number;
  lineNote?: string;
};

/** Parses CRM `CrmQuoteLine.engineeringBomLines` JSON before persistence or WMS sync. */
export function parseEngineeringBomLinesJson(raw: unknown):
  | { ok: true; lines: EngineeringBomLineRow[] }
  | { ok: false; message: string } {
  if (raw === null || raw === undefined) {
    return { ok: true, lines: [] };
  }
  if (!Array.isArray(raw)) {
    return { ok: false, message: "engineeringBomLines must be an array or null." };
  }
  const lines: EngineeringBomLineRow[] = [];
  const usedLineNos = new Set<number>();
  const maxDec = new Prisma.Decimal("999999999999.999");

  for (let i = 0; i < raw.length; i++) {
    const row = raw[i];
    if (!row || typeof row !== "object") {
      return { ok: false, message: `engineeringBomLines[${i}] must be an object.` };
    }
    const o = row as Record<string, unknown>;

    let lineNo: number;
    if (o.lineNo !== undefined && o.lineNo !== null) {
      const n = typeof o.lineNo === "number" ? o.lineNo : Number(o.lineNo);
      if (!Number.isFinite(n) || !Number.isInteger(n) || n < 1) {
        return { ok: false, message: `engineeringBomLines[${i}].lineNo must be a positive integer.` };
      }
      lineNo = n;
    } else {
      lineNo = i + 1;
    }
    if (usedLineNos.has(lineNo)) {
      return { ok: false, message: `Duplicate lineNo ${lineNo} in engineeringBomLines.` };
    }
    usedLineNos.add(lineNo);

    const skuRaw = o.sku ?? o.componentSku;
    const sku = typeof skuRaw === "string" ? skuRaw.trim() : "";
    if (!sku) {
      return { ok: false, message: `engineeringBomLines[${i}].sku required.` };
    }

    const pqRaw = o.plannedQty;
    if (pqRaw === undefined || pqRaw === null) {
      return { ok: false, message: `engineeringBomLines[${i}].plannedQty required.` };
    }
    const pqNum = typeof pqRaw === "number" ? pqRaw : Number(pqRaw);
    if (!Number.isFinite(pqNum) || pqNum <= 0) {
      return { ok: false, message: `engineeringBomLines[${i}].plannedQty must be > 0.` };
    }
    const plannedQtyDec = new Prisma.Decimal(String(pqNum));
    if (plannedQtyDec.gt(maxDec)) {
      return { ok: false, message: `engineeringBomLines[${i}].plannedQty out of range.` };
    }

    let lineNote: string | undefined;
    if (o.lineNote !== undefined && o.lineNote !== null) {
      if (typeof o.lineNote !== "string") {
        return { ok: false, message: `engineeringBomLines[${i}].lineNote must be a string or null.` };
      }
      const trimmed = o.lineNote.trim();
      lineNote = trimmed ? trimmed.slice(0, 500) : undefined;
    }

    lines.push({ sku: sku.slice(0, 128), plannedQty: pqNum, lineNo, lineNote });
  }

  lines.sort((a, b) => (a.lineNo ?? 0) - (b.lineNo ?? 0));
  return { ok: true, lines };
}

/** Maps engineering rows (tenant `Product.sku`) to BF-18 BOM snapshot lines. */
export async function engineeringBomLinesToParsedWorkOrderLines(
  tenantId: string,
  rows: EngineeringBomLineRow[],
): Promise<{ ok: true; lines: ParsedWorkOrderBomLine[] } | { ok: false; message: string }> {
  const uniqueSkus = [...new Set(rows.map((r) => r.sku.trim()).filter(Boolean))];
  if (uniqueSkus.length === 0) {
    return { ok: true, lines: [] };
  }

  const products = await prisma.product.findMany({
    where: { tenantId, sku: { in: uniqueSkus } },
    select: { id: true, sku: true },
  });
  const skuToId = new Map<string, string>();
  for (const p of products) {
    if (p.sku) skuToId.set(p.sku.trim(), p.id);
  }

  const missing: string[] = [];
  for (const s of uniqueSkus) {
    if (!skuToId.has(s)) missing.push(s);
  }
  if (missing.length > 0) {
    return {
      ok: false,
      message: `Unknown component SKU(s) for tenant: ${missing.slice(0, 8).join(", ")}${missing.length > 8 ? "…" : ""}`,
    };
  }

  const lines: ParsedWorkOrderBomLine[] = [];
  for (const r of rows) {
    const sku = r.sku.trim();
    const componentProductId = skuToId.get(sku)!;
    const pqNum = r.plannedQty;
    const plannedQty = new Prisma.Decimal(String(pqNum));
    let lineNote: string | null = null;
    if (r.lineNote !== undefined && r.lineNote !== null) {
      const t = String(r.lineNote).trim();
      lineNote = t ? t.slice(0, 500) : null;
    }
    lines.push({
      lineNo: r.lineNo,
      componentProductId,
      plannedQty,
      lineNote,
    });
  }
  lines.sort((a, b) => a.lineNo - b.lineNo);

  return { ok: true, lines };
}
