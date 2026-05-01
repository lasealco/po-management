/**
 * BF-29 — demo carrier label adapter (no vendor SDK). Returns synthetic tracking + ZPL suitable for ship-station tests.
 */

import { buildShipStationZpl, sanitizeZplFdLine, type ShipStationZplInput } from "@/lib/wms/ship-station-zpl";

export type DemoCarrierLabelAdapterId = "DEMO_PARCEL";

export type DemoCarrierLabelInput = ShipStationZplInput & {
  outboundId: string;
};

/** Deterministic fake tracking (not carrier-valid). */
export function buildDemoParcelTrackingNo(outboundId: string): string {
  const hex = Array.from(outboundId.replace(/[^a-fA-F0-9]/g, ""))
    .slice(-12)
    .join("")
    .toUpperCase();
  const core = (hex + "000000000000").slice(0, 12);
  return `DEMO1Z${core}`;
}

export type DemoCarrierLabelResult = {
  carrierId: DemoCarrierLabelAdapterId;
  trackingNo: string;
  zpl: string;
  disclaimer: string;
};

export function requestDemoCarrierLabel(input: DemoCarrierLabelInput): DemoCarrierLabelResult {
  const trackingNo = buildDemoParcelTrackingNo(input.outboundId);
  const zplBase = buildShipStationZpl({
    ...input,
    barcodePayload: trackingNo,
  });
  const demoLine = sanitizeZplFdLine(`DEMO CARRIER ${trackingNo}`, 56);
  const zpl = zplBase.replace(
    /\^XZ\r\n$/,
    `^FO32,200\r\n^CF0,22\r\n^FD${demoLine}^FS\r\n^XZ\r\n`,
  );

  return {
    carrierId: "DEMO_PARCEL",
    trackingNo,
    zpl,
    disclaimer:
      "Synthetic DEMO_PARCEL label for integration testing only — not a purchasable carrier shipment.",
  };
}
