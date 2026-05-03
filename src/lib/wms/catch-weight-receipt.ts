/**
 * BF-63 — compare `ShipmentItem.catchWeightKg` vs declared `cargoGrossWeightKg`
 * using optional `Shipment.catchWeightTolerancePct` (0–100, %-delta of kg).
 */

export type CatchWeightLineEval = {
  shipmentItemId: string;
  isCatchWeightProduct: boolean;
  declaredKg: string | null;
  receivedKg: string | null;
  deltaAbsKg: number | null;
  deltaPctOfDeclared: number | null;
  /** Line skipped (not a catch-weight SKU or no declared weight). */
  skipped: boolean;
  ok: boolean;
};

export type CatchWeightEvalResult = {
  tolerancePct: number | null;
  policyApplied: boolean;
  withinTolerance: boolean;
  lines: CatchWeightLineEval[];
};

export function evaluateCatchWeightAgainstTolerance(
  lines: Array<{
    shipmentItemId: string;
    isCatchWeightProduct: boolean;
    declaredKg: number | null | undefined;
    receivedKg: number | null | undefined;
  }>,
  tolerancePct: number | null | undefined,
): CatchWeightEvalResult {
  const raw = tolerancePct == null ? null : Number(tolerancePct);
  const policyApplied = raw != null && Number.isFinite(raw);
  const pct = policyApplied ? Math.min(100, Math.max(0, raw as number)) : null;

  const lineResults: CatchWeightLineEval[] = lines.map((li) => {
    const declared =
      li.declaredKg != null && Number.isFinite(Number(li.declaredKg)) ? Number(li.declaredKg) : null;
    const received =
      li.receivedKg != null && Number.isFinite(Number(li.receivedKg)) ? Number(li.receivedKg) : null;

    if (!li.isCatchWeightProduct) {
      return {
        shipmentItemId: li.shipmentItemId,
        isCatchWeightProduct: false,
        declaredKg: declared != null ? declared.toFixed(3) : null,
        receivedKg: received != null ? received.toFixed(3) : null,
        deltaAbsKg: null,
        deltaPctOfDeclared: null,
        skipped: true,
        ok: true,
      };
    }

    if (declared == null || declared <= 0) {
      return {
        shipmentItemId: li.shipmentItemId,
        isCatchWeightProduct: true,
        declaredKg: null,
        receivedKg: received != null ? received.toFixed(3) : null,
        deltaAbsKg: null,
        deltaPctOfDeclared: null,
        skipped: true,
        ok: true,
      };
    }

    const deltaAbsKg = received != null ? Math.abs(received - declared) : null;
    const deltaPctOfDeclared =
      deltaAbsKg != null && declared > 0 ? (deltaAbsKg / declared) * 100 : null;

    let ok = true;
    if (pct != null) {
      if (received == null) {
        ok = false;
      } else if (deltaPctOfDeclared != null) {
        ok = deltaPctOfDeclared <= pct + 1e-9;
      }
    }

    return {
      shipmentItemId: li.shipmentItemId,
      isCatchWeightProduct: true,
      declaredKg: declared.toFixed(3),
      receivedKg: received != null ? received.toFixed(3) : null,
      deltaAbsKg,
      deltaPctOfDeclared,
      skipped: false,
      ok,
    };
  });

  const withinTolerance = !policyApplied || lineResults.every((r) => r.ok);

  return { tolerancePct: pct, withinTolerance, lines: lineResults, policyApplied };
}
