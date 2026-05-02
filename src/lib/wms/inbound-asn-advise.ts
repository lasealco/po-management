import { Prisma } from "@prisma/client";

/** BF-59 — normalized line from JSON pre-advise (stored in `WmsInboundAsnAdvise.linesJson`). */
export type InboundAsnAdviseLineParsed = {
  lineNo: number | null;
  productSku: string | null;
  productCode: string | null;
  quantityExpected: string;
  uom: string | null;
  lotCode: string | null;
};

function trimOrNull(v: unknown, maxLen: number): string | null {
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  if (!s) return null;
  return s.slice(0, maxLen);
}

/**
 * Parse and normalize `lines` from POST body. Each line needs a positive `quantityExpected`.
 */
export function parseInboundAsnAdviseLines(
  input: unknown,
): { ok: true; lines: InboundAsnAdviseLineParsed[] } | { ok: false; error: string } {
  if (!Array.isArray(input)) {
    return { ok: false, error: "lines must be a non-empty array." };
  }
  if (input.length === 0) {
    return { ok: false, error: "lines must include at least one advised line." };
  }
  const lines: InboundAsnAdviseLineParsed[] = [];
  for (let i = 0; i < input.length; i++) {
    const row = input[i];
    if (!row || typeof row !== "object") {
      return { ok: false, error: `lines[${i}] must be an object.` };
    }
    const o = row as Record<string, unknown>;
    const qtyRaw = o.quantityExpected ?? o.qty ?? o.expectedQty;
    const q = Number(qtyRaw);
    if (!Number.isFinite(q) || q <= 0) {
      return { ok: false, error: `lines[${i}].quantityExpected must be a positive number.` };
    }
    const lineNoRaw = o.lineNo;
    let lineNo: number | null = null;
    if (lineNoRaw !== undefined && lineNoRaw !== null) {
      const ln = Number(lineNoRaw);
      if (!Number.isFinite(ln) || ln < 0 || Math.trunc(ln) !== ln) {
        return { ok: false, error: `lines[${i}].lineNo must be a non-negative integer when provided.` };
      }
      lineNo = ln;
    }
    lines.push({
      lineNo,
      productSku: trimOrNull(o.productSku, 128),
      productCode: trimOrNull(o.productCode ?? o.sku, 128),
      quantityExpected: q.toFixed(3),
      uom: trimOrNull(o.uom, 32),
      lotCode: trimOrNull(o.lotCode ?? o.lot, 120),
    });
  }
  return { ok: true, lines };
}

export function inboundAsnAdviseLinesToPrismaJson(
  lines: InboundAsnAdviseLineParsed[],
): Prisma.InputJsonValue {
  return lines as unknown as Prisma.InputJsonValue;
}
