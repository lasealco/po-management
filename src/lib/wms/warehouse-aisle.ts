/** BF-24 — normalize aisle labels for bin ↔ aisle-master consistency. */
export function normalizeWarehouseAisleCode(label: string): string {
  return label.trim().toUpperCase();
}

export type ResolvedBinAisleWrite =
  | { ok: true; warehouseAisleId: string | null; aisle: string | null }
  | { ok: false; error: string };

/**
 * When `warehouseAisleId` is set, bin text `aisle` must match the master code (case-insensitive).
 * When no FK, optional free-text aisle is normalized to uppercase trimmed or null if empty.
 */
export function resolveBinAisleFieldsForWrite(opts: {
  warehouseId: string;
  requestedWarehouseAisleId: string | null | undefined;
  requestedAisleLabel: string | null | undefined;
  aisleMaster:
    | {
        id: string;
        warehouseId: string;
        code: string;
      }
    | null
    | undefined;
}): ResolvedBinAisleWrite {
  const fid = opts.requestedWarehouseAisleId?.trim();
  if (!fid) {
    const raw = opts.requestedAisleLabel;
    if (raw === undefined || raw === null || String(raw).trim() === "") {
      return { ok: true, warehouseAisleId: null, aisle: null };
    }
    return {
      ok: true,
      warehouseAisleId: null,
      aisle: normalizeWarehouseAisleCode(String(raw)),
    };
  }

  const master = opts.aisleMaster;
  if (!master || master.id !== fid) {
    return { ok: false, error: "warehouseAisleId not found." };
  }
  if (master.warehouseId !== opts.warehouseId) {
    return { ok: false, error: "Aisle belongs to a different warehouse." };
  }

  const canonical = normalizeWarehouseAisleCode(master.code);
  const reqRaw = opts.requestedAisleLabel;
  if (reqRaw !== undefined && reqRaw !== null && String(reqRaw).trim() !== "") {
    const req = normalizeWarehouseAisleCode(String(reqRaw));
    if (req !== canonical) {
      return {
        ok: false,
        error: `Bin aisle label must match linked aisle master (${canonical}).`,
      };
    }
  }

  return { ok: true, warehouseAisleId: fid, aisle: canonical };
}

const MM_MAX = 100_000_000;

/** undefined = omit field; null = SQL NULL on PATCH; invalid numeric → `{ ok: false }`. */
export function parseMmForWrite(raw: unknown):
  | { ok: true; value: number | null | undefined }
  | { ok: false } {
  if (raw === undefined) return { ok: true, value: undefined };
  if (raw === null) return { ok: true, value: null };
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n) || n < 0 || n > MM_MAX) return { ok: false };
  return { ok: true, value: Math.trunc(n) };
}
