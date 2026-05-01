/**
 * BF-29 — deterministic pack-line scan verification (scanner wedge / manual tokens).
 * Matches multiset of normalized identifiers to picked units per outbound line.
 */

export type OutboundLinePackScanSource = {
  pickedQty: number;
  product: {
    id: string;
    sku: string | null;
    productCode: string | null;
  };
};

/** Primary scan code for a product row (SKU → product code → product id). */
export function primaryPackScanCode(product: OutboundLinePackScanSource["product"]): string {
  const raw = (product.sku?.trim() || product.productCode?.trim() || product.id).trim();
  return normalizePackScanToken(raw);
}

export function normalizePackScanToken(raw: string): string {
  return raw.trim().toUpperCase().replace(/\s+/g, " ");
}

/** Plan for UX: one row per line with integer picked units (floor). */
export function buildOutboundPackScanPlan(lines: OutboundLinePackScanSource[]): Array<{ code: string; qty: number }> {
  const rows: Array<{ code: string; qty: number }> = [];
  for (const line of lines) {
    const units = Math.max(0, Math.floor(Number(line.pickedQty)));
    if (units <= 0) continue;
    const code = primaryPackScanCode(line.product);
    if (!code) continue;
    rows.push({ code, qty: units });
  }
  return rows;
}

/** Flat multiset tokens (one entry per unit). */
export function flattenPackScanExpectations(plan: Array<{ code: string; qty: number }>): string[] {
  const out: string[] = [];
  for (const row of plan) {
    for (let i = 0; i < row.qty; i += 1) out.push(row.code);
  }
  return out.sort((a, b) => a.localeCompare(b));
}

export type PackScanVerifyResult = {
  ok: boolean;
  /** Expected normalized codes still unmatched after consuming scans. */
  missing: string[];
  /** Scans that did not match any remaining expected slot (normalized). */
  unexpected: string[];
};

/** Parse JSON body array from `POST /api/wms` (scanner wedge / manual list). */
export function parsePackScanTokenArray(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((x) => String(x).trim()).filter((x) => x.length > 0);
}

/** Multiset subtract: each scan consumes one matching expected token. */
export function verifyOutboundPackScan(expectedSorted: string[], scannedRaw: string[]): PackScanVerifyResult {
  const expected = [...expectedSorted].sort((a, b) => a.localeCompare(b));
  const scanned = scannedRaw.map(normalizePackScanToken).filter(Boolean);
  const unusedExpected = [...expected];
  const unexpected: string[] = [];

  for (const token of scanned) {
    const idx = unusedExpected.indexOf(token);
    if (idx >= 0) unusedExpected.splice(idx, 1);
    else unexpected.push(token);
  }

  unusedExpected.sort((a, b) => a.localeCompare(b));
  unexpected.sort((a, b) => a.localeCompare(b));

  return {
    ok: unusedExpected.length === 0 && unexpected.length === 0,
    missing: unusedExpected,
    unexpected,
  };
}
