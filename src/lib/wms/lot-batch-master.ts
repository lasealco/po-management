import { FUNGIBLE_LOT_CODE, normalizeLotCode } from "./lot-code";

/** Ensures lot batch registry rows always use a non-fungible code (matches `InventoryBalance.lotCode`). */
export function requireNonFungibleLotBatchCode(raw: string | null | undefined): string {
  const n = normalizeLotCode(raw);
  if (n === FUNGIBLE_LOT_CODE) {
    throw new Error("lotCode must be non-empty for lot batch master rows.");
  }
  return n;
}

export type LotBatchExpiryUpdate =
  | { mode: "omit" }
  | { mode: "clear" }
  | { mode: "set"; date: Date };

/** Parses POST body fields for `set_wms_lot_batch`: omit → leave unchanged; clear → null; set → date (UTC calendar day). */
export function parseLotBatchExpiryInput(raw: string | null | undefined): LotBatchExpiryUpdate {
  if (raw === undefined) return { mode: "omit" };
  if (raw === null) return { mode: "clear" };
  const s = String(raw).trim();
  if (s === "") return { mode: "clear" };
  const d = new Date(s);
  if (!Number.isFinite(d.getTime())) {
    throw new Error("batchExpiryDate must be a valid ISO date.");
  }
  const utc = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  return { mode: "set", date: utc };
}

export function truncateLotBatchCountry(raw: string | null | undefined): string | null | undefined {
  if (raw === undefined) return undefined;
  if (raw === null) return null;
  const s = String(raw).trim().slice(0, 80);
  return s === "" ? null : s;
}

export function truncateLotBatchNotes(raw: string | null | undefined): string | null | undefined {
  if (raw === undefined) return undefined;
  if (raw === null) return null;
  const s = String(raw).trim().slice(0, 2000);
  return s === "" ? null : s;
}
