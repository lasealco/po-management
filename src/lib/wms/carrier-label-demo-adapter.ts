/**
 * BF-29 — demo carrier label adapter (no vendor SDK). Synthetic tracking + ZPL.
 * BF-39 — implements shared {@link CarrierLabelPurchaseResult} for router parity.
 */

import type { CarrierLabelPurchaseInput, CarrierLabelPurchaseResult } from "./carrier-label-types";
import { buildShipStationZpl, sanitizeZplFdLine, type ShipStationZplInput } from "@/lib/wms/ship-station-zpl";

export type DemoCarrierLabelAdapterId = "DEMO_PARCEL";

/** @deprecated Use {@link CarrierLabelPurchaseInput.outboundOrderId} — alias for tests / legacy callers. */
export type DemoCarrierLabelInput = ShipStationZplInput & {
  outboundId: string;
};

/** Deterministic fake tracking (not carrier-valid). */
export function buildDemoParcelTrackingNo(outboundOrderId: string): string {
  const hex = Array.from(outboundOrderId.replace(/[^a-fA-F0-9]/g, ""))
    .slice(-12)
    .join("")
    .toUpperCase();
  const core = (hex + "000000000000").slice(0, 12);
  return `DEMO1Z${core}`;
}

export function purchaseDemoParcelCarrierLabel(input: CarrierLabelPurchaseInput): CarrierLabelPurchaseResult {
  const trackingNo = buildDemoParcelTrackingNo(input.outboundOrderId);
  const zplBase = buildShipStationZpl({
    outboundNo: input.outboundNo,
    warehouseLabel: input.warehouseLabel,
    barcodePayload: trackingNo,
    shipToSummary: input.shipToSummary,
    asnReference: input.asnReference,
    sscc18: input.sscc18,
  });
  const demoLine = sanitizeZplFdLine(`DEMO CARRIER ${trackingNo}`, 56);
  const zpl = zplBase.replace(
    /\^XZ\r\n$/,
    `^FO32,200\r\n^CF0,22\r\n^FD${demoLine}^FS\r\n^XZ\r\n`,
  );

  return {
    adapterId: "DEMO_PARCEL",
    trackingNo,
    zpl,
    disclaimer:
      "Synthetic DEMO_PARCEL label for integration testing only — not a purchasable carrier shipment.",
  };
}

/** @deprecated Prefer {@link purchaseDemoParcelCarrierLabel} — accepts legacy `outboundId` field name. */
export function requestDemoCarrierLabel(input: DemoCarrierLabelInput): CarrierLabelPurchaseResult {
  return purchaseDemoParcelCarrierLabel({
    outboundOrderId: input.outboundId,
    outboundNo: input.outboundNo,
    warehouseLabel: input.warehouseLabel,
    barcodePayload: input.barcodePayload,
    shipToSummary: input.shipToSummary,
    shipToName: null,
    shipToLine1: null,
    shipToCity: null,
    shipToCountryCode: null,
    asnReference: input.asnReference,
    sscc18: input.sscc18,
  });
}
