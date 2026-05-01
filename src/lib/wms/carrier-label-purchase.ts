import { purchaseHttpJsonCarrierLabel } from "./carrier-label-http-json-adapter";
import { purchaseDemoParcelCarrierLabel } from "./carrier-label-demo-adapter";
import type { CarrierLabelPurchaseInput, CarrierLabelPurchaseResult } from "./carrier-label-types";

/** Build router input from an outbound row loaded with `warehouse` select (post-actions / jobs). */
export function carrierLabelPurchaseInputForOutbound(
  order: {
    id: string;
    outboundNo: string;
    asnReference: string | null;
    shipToName: string | null;
    shipToLine1: string | null;
    shipToCity: string | null;
    shipToCountryCode: string | null;
    warehouse: { code: string | null; name: string };
  },
  sscc18: string | null,
): CarrierLabelPurchaseInput {
  const shipBits = [
    order.shipToName,
    order.shipToLine1,
    order.shipToCity,
    order.shipToCountryCode,
  ].filter(Boolean);
  return {
    outboundOrderId: order.id,
    outboundNo: order.outboundNo,
    warehouseLabel: order.warehouse.code || order.warehouse.name,
    barcodePayload: order.outboundNo,
    shipToSummary: shipBits.length ? shipBits.join(" · ") : "—",
    shipToName: order.shipToName,
    shipToLine1: order.shipToLine1,
    shipToCity: order.shipToCity,
    shipToCountryCode: order.shipToCountryCode,
    asnReference: order.asnReference,
    sscc18,
  };
}

/**
 * Resolves adapter from `WMS_CARRIER_LABEL_ADAPTER`:
 * - `demo_parcel` (default) — BF-29 synthetic label
 * - `http_json` — BF-39 HTTPS JSON bridge (`WMS_CARRIER_LABEL_HTTP_URL`, optional token)
 */
export async function purchaseCarrierLabel(
  input: CarrierLabelPurchaseInput,
  fetchImpl?: typeof fetch,
): Promise<CarrierLabelPurchaseResult> {
  const mode = (process.env.WMS_CARRIER_LABEL_ADAPTER ?? "demo_parcel").trim().toLowerCase();
  if (mode === "http_json") {
    return purchaseHttpJsonCarrierLabel(input, fetchImpl ?? fetch);
  }
  return Promise.resolve(purchaseDemoParcelCarrierLabel(input));
}
