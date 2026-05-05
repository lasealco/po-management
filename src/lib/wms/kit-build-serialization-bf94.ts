/**
 * BF-94 — optional serialized genealogy on `complete_kit_build_task`
 * (output SN registration + component SN ↔ consumption movement links).
 */

import { Prisma } from "@prisma/client";

import { InventorySerialNoError, normalizeInventorySerialNo } from "@/lib/wms/inventory-serial-no";

export type KitBuildBf94ParsedInput = {
  outputSerialNos: string[];
  consumedSerials: Array<{ bomLineId: string; serialNo: string }>;
};

export function decimalIsPositiveInteger(d: Prisma.Decimal): boolean {
  return d.gt(0) && d.mod(1).equals(0);
}

/** Normalize BF-94 fields from POST body; omit both arrays → empty. */
export function parseKitBuildBf94BodyFields(input: {
  kitBuildBf94OutputSerialNos?: unknown;
  kitBuildBf94ConsumedSerials?: unknown;
}): { ok: true; value: KitBuildBf94ParsedInput } | { ok: false; message: string } {
  let outputSerialNos: string[] = [];
  const outRaw = input.kitBuildBf94OutputSerialNos;
  if (outRaw !== undefined && outRaw !== null) {
    if (!Array.isArray(outRaw)) return { ok: false, message: "kitBuildBf94OutputSerialNos must be an array." };
    outputSerialNos = [];
    for (const x of outRaw) {
      if (typeof x !== "string" || !String(x).trim()) {
        return { ok: false, message: "Each kitBuildBf94OutputSerialNos entry must be a non-empty string." };
      }
      try {
        outputSerialNos.push(normalizeInventorySerialNo(String(x).trim()));
      } catch (e) {
        return {
          ok: false,
          message: e instanceof InventorySerialNoError ? e.message : "Invalid kitBuildBf94OutputSerialNos entry.",
        };
      }
    }
    const seen = new Set<string>();
    for (const s of outputSerialNos) {
      if (seen.has(s)) return { ok: false, message: "Duplicate serial in kitBuildBf94OutputSerialNos." };
      seen.add(s);
    }
  }

  let consumedSerials: Array<{ bomLineId: string; serialNo: string }> = [];
  const consRaw = input.kitBuildBf94ConsumedSerials;
  if (consRaw !== undefined && consRaw !== null) {
    if (!Array.isArray(consRaw)) return { ok: false, message: "kitBuildBf94ConsumedSerials must be an array." };
    consumedSerials = [];
    for (let i = 0; i < consRaw.length; i += 1) {
      const row = consRaw[i];
      if (!row || typeof row !== "object") {
        return { ok: false, message: `kitBuildBf94ConsumedSerials[${i}] must be an object.` };
      }
      const r = row as Record<string, unknown>;
      const bomLineId = typeof r.bomLineId === "string" ? r.bomLineId.trim() : "";
      const serialRaw = typeof r.serialNo === "string" ? r.serialNo.trim() : "";
      if (!bomLineId || !serialRaw) {
        return { ok: false, message: `kitBuildBf94ConsumedSerials[${i}] needs bomLineId and serialNo.` };
      }
      let serialNo: string;
      try {
        serialNo = normalizeInventorySerialNo(serialRaw);
      } catch (e) {
        return {
          ok: false,
          message:
            e instanceof InventorySerialNoError
              ? e.message
              : `Invalid serialNo at kitBuildBf94ConsumedSerials[${i}].`,
        };
      }
      consumedSerials.push({ bomLineId, serialNo });
    }
  }

  return { ok: true, value: { outputSerialNos, consumedSerials } };
}

/** Structural consistency vs BOM deltas + kit quantity (caller validates BOM ids exist). */
export function validateBf94AgainstKitDeltas(params: {
  kitQty: Prisma.Decimal;
  deltas: Map<string, Prisma.Decimal>;
  bf94: KitBuildBf94ParsedInput;
}): { ok: true } | { ok: false; message: string } {
  const { kitQty, deltas, bf94 } = params;

  const consumingLines = [...deltas.entries()].filter(([, d]) => d.gt(0)).map(([id]) => id);

  if (bf94.outputSerialNos.length > 0) {
    if (!decimalIsPositiveInteger(kitQty)) {
      return {
        ok: false,
        message: "BF-94 output serial numbers require a positive integer kit quantity on the task.",
      };
    }
    const k = kitQty.toNumber();
    if (!Number.isSafeInteger(k) || k < 1) {
      return { ok: false, message: "Kit quantity out of range for BF-94 output serial linking." };
    }
    if (bf94.outputSerialNos.length !== k) {
      return {
        ok: false,
        message: `BF-94 expects kitBuildBf94OutputSerialNos length ${k} to match kit quantity.`,
      };
    }
  }

  if (bf94.consumedSerials.length === 0) {
    return { ok: true };
  }

  const byLine = new Map<string, string[]>();
  for (const row of bf94.consumedSerials) {
    const arr = byLine.get(row.bomLineId) ?? [];
    arr.push(row.serialNo);
    byLine.set(row.bomLineId, arr);
  }

  for (const bomLineId of consumingLines) {
    const d = deltas.get(bomLineId)!;
    if (!decimalIsPositiveInteger(d)) {
      return {
        ok: false,
        message:
          "BF-94 consumed serials require integer component consumption quantities per BOM line for this completion.",
      };
    }
    const need = d.toNumber();
    const got = byLine.get(bomLineId);
    if (!got || got.length !== need) {
      return {
        ok: false,
        message: `BF-94 consumed serial count mismatch for BOM line ${bomLineId.slice(0, 8)}… (expected ${need}).`,
      };
    }
    const seen = new Set<string>();
    for (const sn of got) {
      if (seen.has(sn)) return { ok: false, message: "Duplicate consumed serialNo within the same BOM line." };
      seen.add(sn);
    }
  }

  for (const key of byLine.keys()) {
    if (!consumingLines.includes(key)) {
      return {
        ok: false,
        message: "kitBuildBf94ConsumedSerials references a BOM line that has no consumption in this kit completion.",
      };
    }
  }

  return { ok: true };
}
