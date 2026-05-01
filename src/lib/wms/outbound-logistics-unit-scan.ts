/**
 * BF-43 — outbound logistics unit (SSCC/LPN) scan normalization + BF-29 multiset substitution.
 */

import {
  normalizePackScanToken,
  primaryPackScanCode,
  verifyOutboundPackScan,
  type OutboundLinePackScanSource,
  type PackScanVerifyResult,
} from "./pack-scan-verify";

export type OutboundLogisticsUnitForPackScan = {
  scanCode: string;
  outboundOrderLineId: string | null;
  containedQty: number | null;
  product: OutboundLinePackScanSource["product"] | null;
};

/** Normalize stored scan keys: 18-digit SSCC core from numeric payloads; otherwise SKU-style token. */
export function normalizeOutboundLogisticsUnitScanCode(raw: string): string {
  const d = raw.replace(/\D/g, "");
  if (d.length >= 18) return d.slice(-18);
  return normalizePackScanToken(raw.trim());
}

export function mapOutboundLogisticsUnitsForPackScan(
  rows: Array<{
    scanCode: string;
    outboundOrderLineId: string | null;
    containedQty: unknown;
    outboundOrderLine: {
      product: { id: string; sku: string | null; productCode: string | null };
    } | null;
  }>,
): OutboundLogisticsUnitForPackScan[] {
  return rows.map((r) => ({
    scanCode: r.scanCode,
    outboundOrderLineId: r.outboundOrderLineId,
    containedQty: r.containedQty != null && r.containedQty !== "" ? Number(r.containedQty) : null,
    product: r.outboundOrderLine?.product ?? null,
  }));
}

function lookupOutboundLogisticsUnitByScan(
  unitsByScan: Map<string, OutboundLogisticsUnitForPackScan>,
  scannedRaw: string,
): OutboundLogisticsUnitForPackScan | undefined {
  const sscc = normalizeOutboundLogisticsUnitScanCode(scannedRaw);
  const bySscc = unitsByScan.get(sscc);
  if (bySscc) return bySscc;
  const tokenish = normalizePackScanToken(scannedRaw);
  return unitsByScan.get(tokenish);
}

/**
 * Multiset verify like {@link verifyOutboundPackScan}, but scans matching a leaf LU bound to a line
 * consume `floor(containedQty)` slots of that line's primary pack-scan code. Structural-only LUs do not
 * consume picks unless the scan also matches a product token by coincidence.
 */
export function verifyOutboundPackScanWithLogisticsUnits(
  expectedSorted: string[],
  scannedRaw: string[],
  units: OutboundLogisticsUnitForPackScan[],
): PackScanVerifyResult {
  if (units.length === 0) return verifyOutboundPackScan(expectedSorted, scannedRaw);

  const unitsByScan = new Map<string, OutboundLogisticsUnitForPackScan>();
  for (const u of units) unitsByScan.set(u.scanCode, u);

  const unusedExpected = [...expectedSorted].sort((a, b) => a.localeCompare(b));
  const unexpected: string[] = [];

  const scanned = scannedRaw.map((s) => String(s).trim()).filter((s) => s.length > 0);

  for (const rawScan of scanned) {
    const lu = lookupOutboundLogisticsUnitByScan(unitsByScan, rawScan);
    const displayToken = normalizePackScanToken(rawScan) || rawScan.trim();

    const qty =
      lu?.containedQty != null && Number.isFinite(Number(lu.containedQty))
        ? Math.floor(Number(lu.containedQty))
        : 0;
    if (
      lu?.outboundOrderLineId &&
      lu.product &&
      qty > 0
    ) {
      const pcode = primaryPackScanCode(lu.product);
      const indices: number[] = [];
      let ok = true;
      for (let n = 0; n < qty; n += 1) {
        const ix = unusedExpected.indexOf(pcode);
        if (ix < 0) {
          ok = false;
          break;
        }
        indices.push(ix);
      }
      if (ok && indices.length === qty) {
        indices.sort((a, b) => b - a);
        for (const ix of indices) unusedExpected.splice(ix, 1);
      } else {
        unexpected.push(displayToken);
      }
      continue;
    }

    const token = normalizePackScanToken(rawScan);
    if (!token) continue;
    const idx = unusedExpected.indexOf(token);
    if (idx >= 0) unusedExpected.splice(idx, 1);
    else unexpected.push(displayToken);
  }

  unusedExpected.sort((a, b) => a.localeCompare(b));
  unexpected.sort((a, b) => a.localeCompare(b));

  return {
    ok: unusedExpected.length === 0 && unexpected.length === 0,
    missing: unusedExpected,
    unexpected,
  };
}
