/**
 * BF-31 — compare rolled-up `ShipmentItem.quantityReceived` vs `quantityShipped`
 * using optional `Shipment.asnQtyTolerancePct` (0–100, %-delta allowed per line).
 */

export type AsnToleranceLineResult = {
  shipmentItemId: string;
  quantityShipped: number;
  quantityReceived: number;
  deltaAbs: number;
  /** `null` when shipped qty is 0 (cannot compute %-delta vs shipped). */
  deltaPctOfShipped: number | null;
  ok: boolean;
};

export function evaluateShipmentReceiveAgainstAsnTolerance(
  lines: Array<{ shipmentItemId: string; quantityShipped: number; quantityReceived: number }>,
  tolerancePct: number | null | undefined,
): {
  tolerancePct: number | null;
  withinTolerance: boolean;
  lines: AsnToleranceLineResult[];
  policyApplied: boolean;
} {
  const raw = tolerancePct == null ? null : Number(tolerancePct);
  const policyApplied = raw != null && Number.isFinite(raw);
  const pct = policyApplied ? Math.min(100, Math.max(0, raw as number)) : null;

  const results: AsnToleranceLineResult[] = lines.map((li) => {
    const shipped = li.quantityShipped;
    const received = li.quantityReceived;
    const deltaAbs = Math.abs(received - shipped);
    const deltaPctOfShipped = shipped > 0 ? (deltaAbs / shipped) * 100 : null;

    let ok = true;
    if (pct != null) {
      if (shipped > 0 && deltaPctOfShipped != null) {
        ok = deltaPctOfShipped <= pct + 1e-9;
      } else if (shipped <= 0) {
        ok = received === 0;
      }
    }

    return {
      shipmentItemId: li.shipmentItemId,
      quantityShipped: shipped,
      quantityReceived: received,
      deltaAbs,
      deltaPctOfShipped,
      ok,
    };
  });

  const withinTolerance = !policyApplied || results.every((r) => r.ok);

  return { tolerancePct: pct, withinTolerance, lines: results, policyApplied };
}

/** BF-31 — `GRN-YYYYMMDD-xxxxxxx` using receipt id tail for stability in demos. */
export function generateDockGrnReference(receiptId: string, closedAt: Date): string {
  const y = closedAt.getUTCFullYear();
  const m = String(closedAt.getUTCMonth() + 1).padStart(2, "0");
  const d = String(closedAt.getUTCDate()).padStart(2, "0");
  const tail = receiptId.replace(/[^a-zA-Z0-9]/g, "").slice(-7).toUpperCase();
  const suffix = tail.length >= 7 ? tail : receiptId.slice(-7).toUpperCase();
  return `GRN-${y}${m}${d}-${suffix}`;
}
