import { Prisma } from "@prisma/client";

export type KitBuildTaskPayloadV1 = {
  v: 1;
  bomRepresentsOutputUnits: number;
  lines: Array<{ bomLineId: string; binId: string; lotCode: string }>;
};

/** JSON stored on `WmsTask.note` for `KIT_BUILD` tasks (BF-62). */
export function serializeKitBuildTaskPayload(p: KitBuildTaskPayloadV1): string {
  return JSON.stringify({ bf62KitBuild: p });
}

export function parseKitBuildTaskNote(note: string | null | undefined): KitBuildTaskPayloadV1 | null {
  if (!note || !String(note).trim()) return null;
  try {
    const j = JSON.parse(String(note)) as { bf62KitBuild?: KitBuildTaskPayloadV1 };
    const p = j.bf62KitBuild;
    if (!p || p.v !== 1 || !Number.isInteger(p.bomRepresentsOutputUnits) || p.bomRepresentsOutputUnits < 1) {
      return null;
    }
    if (!Array.isArray(p.lines)) return null;
    for (const row of p.lines) {
      if (!row || typeof row !== "object") return null;
      if (typeof row.bomLineId !== "string" || !row.bomLineId.trim()) return null;
      if (typeof row.binId !== "string" || !row.binId.trim()) return null;
      if (typeof row.lotCode !== "string") return null;
    }
    return p;
  } catch {
    return null;
  }
}

export type BomLineQtyRow = {
  id: string;
  plannedQty: Prisma.Decimal;
  consumedQty: Prisma.Decimal;
};

/**
 * Per-BOM-line consumption for this kit posting: `plannedQty * kitQuantity / bomRepresentsOutputUnits`,
 * capped by remaining plan. Lines with no remaining get zero delta (no pick row needed).
 */
export function computeKitBuildLineDeltas(
  bomLines: BomLineQtyRow[],
  kitQuantity: number,
  bomRepresentsOutputUnits: number,
): { ok: true; deltas: Map<string, Prisma.Decimal> } | { ok: false; message: string } {
  if (!Number.isFinite(kitQuantity) || kitQuantity <= 0) {
    return { ok: false, message: "kitQuantity must be > 0." };
  }
  if (!Number.isInteger(bomRepresentsOutputUnits) || bomRepresentsOutputUnits < 1) {
    return { ok: false, message: "bomRepresentsOutputUnits must be a positive integer." };
  }

  const br = new Prisma.Decimal(bomRepresentsOutputUnits);
  const kq = new Prisma.Decimal(kitQuantity);
  const deltas = new Map<string, Prisma.Decimal>();

  for (const line of bomLines) {
    const planned = new Prisma.Decimal(line.plannedQty);
    const consumed = new Prisma.Decimal(line.consumedQty);
    const room = planned.sub(consumed);
    if (room.lte(0)) {
      deltas.set(line.id, new Prisma.Decimal(0));
      continue;
    }
    const raw = planned.mul(kq).div(br);
    if (raw.gt(room)) {
      return {
        ok: false,
        message: "kitQuantity exceeds remaining quantity on one or more BOM lines for this scale.",
      };
    }
    if (raw.lte(0)) {
      return { ok: false, message: "Non-positive consumption computed for a BOM line." };
    }
    deltas.set(line.id, raw);
  }

  return { ok: true, deltas };
}

/** Every line with positive delta must have exactly one pick row; no extras. */
export function validateKitBuildLinePicks(
  deltas: Map<string, Prisma.Decimal>,
  kitBuildLines: Array<{ bomLineId: string; binId: string; lotCode: string }>,
): { ok: true } | { ok: false; message: string } {
  const need = new Set<string>();
  for (const [bomLineId, d] of deltas) {
    if (d.gt(0)) need.add(bomLineId);
  }
  const seen = new Set<string>();
  for (const row of kitBuildLines) {
    const id = row.bomLineId.trim();
    if (seen.has(id)) return { ok: false, message: "Duplicate bomLineId in kitBuildLines." };
    seen.add(id);
    if (!need.has(id)) {
      return { ok: false, message: "kitBuildLines includes a BOM line that does not need picks for this build." };
    }
  }
  for (const id of need) {
    if (!seen.has(id)) return { ok: false, message: "kitBuildLines must include every BOM line with consumption > 0." };
  }
  return { ok: true };
}
