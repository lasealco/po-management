import { Prisma } from "@prisma/client";

export type ParsedWorkOrderBomLine = {
  lineNo: number;
  componentProductId: string;
  plannedQty: Prisma.Decimal;
  lineNote: string | null;
};

export function parseReplaceWorkOrderBomLinesPayload(bomLinesRaw: unknown):
  | { ok: true; lines: ParsedWorkOrderBomLine[] }
  | { ok: false; message: string } {
  if (!Array.isArray(bomLinesRaw)) {
    return { ok: false, message: "bomLines must be an array." };
  }
  const lines: ParsedWorkOrderBomLine[] = [];
  const usedLineNos = new Set<number>();
  const maxDec = new Prisma.Decimal("999999999999.999");

  for (let i = 0; i < bomLinesRaw.length; i++) {
    const row = bomLinesRaw[i];
    if (!row || typeof row !== "object") {
      return { ok: false, message: `bomLines[${i}] must be an object.` };
    }
    const o = row as Record<string, unknown>;

    let lineNo: number;
    if (o.lineNo !== undefined && o.lineNo !== null) {
      const n = typeof o.lineNo === "number" ? o.lineNo : Number(o.lineNo);
      if (!Number.isFinite(n) || !Number.isInteger(n) || n < 1) {
        return { ok: false, message: `bomLines[${i}].lineNo must be a positive integer.` };
      }
      lineNo = n;
    } else {
      lineNo = i + 1;
    }
    if (usedLineNos.has(lineNo)) {
      return { ok: false, message: `Duplicate lineNo ${lineNo} in bomLines.` };
    }
    usedLineNos.add(lineNo);

    const componentProductId =
      typeof o.componentProductId === "string" ? o.componentProductId.trim() : "";
    if (!componentProductId) {
      return { ok: false, message: `bomLines[${i}].componentProductId required.` };
    }

    const pqRaw = o.plannedQty;
    if (pqRaw === undefined || pqRaw === null) {
      return { ok: false, message: `bomLines[${i}].plannedQty required.` };
    }
    const pqNum = typeof pqRaw === "number" ? pqRaw : Number(pqRaw);
    if (!Number.isFinite(pqNum) || pqNum <= 0) {
      return { ok: false, message: `bomLines[${i}].plannedQty must be > 0.` };
    }
    const plannedQty = new Prisma.Decimal(String(pqNum));
    if (plannedQty.gt(maxDec)) {
      return { ok: false, message: `bomLines[${i}].plannedQty out of range.` };
    }

    let lineNote: string | null = null;
    if (o.lineNote !== undefined && o.lineNote !== null) {
      if (typeof o.lineNote !== "string") {
        return { ok: false, message: `bomLines[${i}].lineNote must be a string or null.` };
      }
      const trimmed = o.lineNote.trim();
      lineNote = trimmed ? trimmed.slice(0, 500) : null;
    }

    lines.push({ lineNo, componentProductId, plannedQty, lineNote });
  }

  lines.sort((a, b) => a.lineNo - b.lineNo);
  return { ok: true, lines };
}

export function parseConsumeWorkOrderBomQuantity(raw: unknown): { ok: true; qty: Prisma.Decimal } | { ok: false; message: string } {
  if (raw === undefined || raw === null) {
    return { ok: false, message: "quantity required." };
  }
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n) || n <= 0) {
    return { ok: false, message: "quantity must be > 0." };
  }
  const qty = new Prisma.Decimal(String(n));
  const maxDec = new Prisma.Decimal("999999999999.999");
  if (qty.gt(maxDec)) {
    return { ok: false, message: "quantity out of range." };
  }
  return { ok: true, qty };
}
