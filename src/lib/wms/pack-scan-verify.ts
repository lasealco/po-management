/**
 * BF-29 / BF-81 — deterministic pack-line scan verification (scanner wedge / manual tokens).
 * Matches multiset of normalized identifiers to picked units per outbound line.
 * Optional per-scan candidate expansion supports RFID / GTIN / SSCC URI wedges.
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

function dedupeNormalizedCandidates(candidates: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const c of candidates) {
    const t = normalizePackScanToken(c);
    if (!t || seen.has(t)) continue;
    seen.add(t);
    out.push(t);
  }
  return out;
}

/** Multiset subtract: each scan consumes one matching expected token (first matching expanded candidate wins). */
export function verifyOutboundPackScan(
  expectedSorted: string[],
  scannedRaw: string[],
  expandRaw?: (raw: string) => string[],
): PackScanVerifyResult {
  const expand =
    expandRaw ??
    ((r: string) => {
      const t = normalizePackScanToken(r);
      return t ? [t] : [];
    });

  const expected = [...expectedSorted].sort((a, b) => a.localeCompare(b));
  const scanned = scannedRaw.map((x) => String(x).trim()).filter((x) => x.length > 0);
  const unusedExpected = [...expected];
  const unexpected: string[] = [];

  for (const raw of scanned) {
    const candidates = dedupeNormalizedCandidates(expand(raw));
    let matched = false;
    for (const token of candidates) {
      const idx = unusedExpected.indexOf(token);
      if (idx >= 0) {
        unusedExpected.splice(idx, 1);
        matched = true;
        break;
      }
    }
    if (!matched) {
      const display = normalizePackScanToken(raw) || raw;
      unexpected.push(display);
    }
  }

  unusedExpected.sort((a, b) => a.localeCompare(b));
  unexpected.sort((a, b) => a.localeCompare(b));

  return {
    ok: unusedExpected.length === 0 && unexpected.length === 0,
    missing: unusedExpected,
    unexpected,
  };
}
