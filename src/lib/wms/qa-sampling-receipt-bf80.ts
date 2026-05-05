/**
 * BF-80 — gate `close_wms_receipt` when BF-42 disposition template + QA sampling hints imply
 * documented inspection before closing the dock receipt.
 */

export type EvaluateWmsReceiptQaSamplingBf80ShipmentItem = {
  shipmentItemId: string;
  wmsReceivingDispositionTemplateId: string | null;
  wmsQaSamplingSkipLot: boolean;
  /** Parsed 0–100 or null when unset. */
  wmsQaSamplingPct: number | null;
  wmsVarianceNote: string | null;
};

export type EvaluateWmsReceiptQaSamplingBf80ReceiptLine = {
  shipmentItemId: string;
  wmsVarianceNote: string | null;
};

/** Template-linked line with positive sample % and not skip-lot requires documentation. */
export function shipmentItemDemandsQaSamplingBf80(
  row: Pick<
    EvaluateWmsReceiptQaSamplingBf80ShipmentItem,
    | "wmsReceivingDispositionTemplateId"
    | "wmsQaSamplingSkipLot"
    | "wmsQaSamplingPct"
  >,
): boolean {
  if (row.wmsReceivingDispositionTemplateId == null) return false;
  if (row.wmsQaSamplingSkipLot) return false;
  const pct = row.wmsQaSamplingPct;
  return pct != null && Number.isFinite(pct) && pct > 0;
}

function hasVarianceDocumentation(
  shipmentVarianceNote: string | null | undefined,
  receiptLineNote: string | null | undefined,
): boolean {
  const a = shipmentVarianceNote?.trim() ?? "";
  const b = receiptLineNote?.trim() ?? "";
  return a.length > 0 || b.length > 0;
}

/**
 * @param shipmentItems — all lines on the inbound shipment (same scope as dock receipt).
 * @param receiptLinesByShipmentItemId — dock receipt lines keyed by `shipmentItemId` (may be partial).
 */
export function evaluateWmsReceiptQaSamplingBf80(input: {
  shipmentItems: EvaluateWmsReceiptQaSamplingBf80ShipmentItem[];
  receiptLinesByShipmentItemId: Map<string, EvaluateWmsReceiptQaSamplingBf80ReceiptLine>;
}): {
  policyApplied: boolean;
  complete: boolean;
  incompleteShipmentItemIds: string[];
} {
  const incompleteShipmentItemIds: string[] = [];
  let policyApplied = false;

  for (const si of input.shipmentItems) {
    if (!shipmentItemDemandsQaSamplingBf80(si)) continue;
    policyApplied = true;

    const rl = input.receiptLinesByShipmentItemId.get(si.shipmentItemId);
    const ok = hasVarianceDocumentation(si.wmsVarianceNote, rl?.wmsVarianceNote ?? null);
    if (!ok) {
      incompleteShipmentItemIds.push(si.shipmentItemId);
    }
  }

  return {
    policyApplied,
    complete: incompleteShipmentItemIds.length === 0,
    incompleteShipmentItemIds,
  };
}
