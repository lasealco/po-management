/**
 * BF-95 — optional scrap / liquidation valuation hints (integer USD cents per inventory unit).
 * Preview-only; not posted to billing / ERP.
 */

export const SCRAP_VALUE_PER_UNIT_CENTS_BF95_MAX = 999_999_999;

export type ScrapValuePerUnitCentsBf95Patch =
  | { mode: "omit" }
  | { mode: "clear" }
  | { mode: "set"; cents: number };

export type ParseScrapValueBf95Result =
  | ({ ok: true } & ScrapValuePerUnitCentsBf95Patch)
  | { ok: false; message: string };

/** `undefined` → omit; `null` → clear column; non-negative integer → set. */
export function parseScrapValuePerUnitCentsBf95(raw: unknown): ParseScrapValueBf95Result {
  if (raw === undefined) {
    return { ok: true, mode: "omit" };
  }
  if (raw === null || raw === "") {
    return { ok: true, mode: "clear" };
  }
  const n = typeof raw === "number" ? raw : typeof raw === "string" ? Number(String(raw).trim()) : NaN;
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < 0 || n > SCRAP_VALUE_PER_UNIT_CENTS_BF95_MAX) {
    return {
      ok: false,
      message: `scrapValuePerUnitCents must be null or an integer from 0 to ${SCRAP_VALUE_PER_UNIT_CENTS_BF95_MAX}.`,
    };
  }
  return { ok: true, mode: "set", cents: n };
}
