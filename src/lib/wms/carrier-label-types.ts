/** BF-39 — vendor-neutral carrier label purchase contract (demo + HTTP JSON adapter). */

export type CarrierLabelPurchaseInput = {
  outboundOrderId: string;
  outboundNo: string;
  warehouseLabel: string;
  barcodePayload: string;
  shipToSummary: string;
  shipToName: string | null;
  shipToLine1: string | null;
  shipToCity: string | null;
  shipToCountryCode: string | null;
  asnReference: string | null;
  sscc18: string | null;
};

export type CarrierLabelPurchaseResult = {
  adapterId: string;
  trackingNo: string;
  zpl: string;
  /** Operator-facing note (e.g. demo disclaimer). */
  disclaimer?: string;
};
