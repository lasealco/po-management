/**
 * BF-39 — production integration via HTTPS JSON bridge: POST outbound context to your carrier
 * microservice; response must include tracking + ZPL. No vendor SDK in-repo.
 */

import type { CarrierLabelPurchaseInput, CarrierLabelPurchaseResult } from "./carrier-label-types";

const DEFAULT_TIMEOUT_MS = 15_000;

function parsePositiveInt(raw: string | undefined, fallback: number): number {
  if (!raw?.trim()) return fallback;
  const n = Number(raw.trim());
  return Number.isFinite(n) && n > 0 ? Math.min(Math.trunc(n), 120_000) : fallback;
}

/** Purchase label by POSTing JSON to `WMS_CARRIER_LABEL_HTTP_URL`. */
export async function purchaseHttpJsonCarrierLabel(
  input: CarrierLabelPurchaseInput,
  fetchImpl: typeof fetch = fetch,
): Promise<CarrierLabelPurchaseResult> {
  const url = process.env.WMS_CARRIER_LABEL_HTTP_URL?.trim();
  if (!url) {
    throw new Error("WMS_CARRIER_LABEL_HTTP_URL is not set for http_json adapter.");
  }

  const token = process.env.WMS_CARRIER_LABEL_HTTP_TOKEN?.trim();
  const timeoutMs = parsePositiveInt(process.env.WMS_CARRIER_LABEL_HTTP_TIMEOUT_MS, DEFAULT_TIMEOUT_MS);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const body = {
    schemaVersion: 1 as const,
    outboundOrderId: input.outboundOrderId,
    outboundNo: input.outboundNo,
    warehouseLabel: input.warehouseLabel,
    barcodePayload: input.barcodePayload,
    shipToSummary: input.shipToSummary,
    shipTo: {
      name: input.shipToName,
      line1: input.shipToLine1,
      city: input.shipToCity,
      countryCode: input.shipToCountryCode,
    },
    asnReference: input.asnReference,
    sscc18: input.sscc18,
  };

  let res: Response;
  try {
    res = await fetchImpl(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }

  const text = await res.text();
  let json: unknown;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    throw new Error(`Carrier label HTTP bridge returned non-JSON (HTTP ${res.status}).`);
  }

  if (!res.ok) {
    const msg =
      json && typeof json === "object" && json !== null && "error" in json
        ? String((json as { error?: unknown }).error ?? "")
        : "";
    throw new Error(
      msg.trim()
        ? `Carrier label bridge HTTP ${res.status}: ${msg.slice(0, 500)}`
        : `Carrier label bridge HTTP ${res.status}.`,
    );
  }

  if (!json || typeof json !== "object") {
    throw new Error("Carrier label bridge returned empty or invalid JSON body.");
  }

  const row = json as Record<string, unknown>;
  const trackingNo = typeof row.trackingNo === "string" ? row.trackingNo.trim() : "";
  const zpl = typeof row.zpl === "string" ? row.zpl : "";
  const carrierId =
    typeof row.carrierId === "string" && row.carrierId.trim()
      ? row.carrierId.trim().slice(0, 64)
      : "HTTP_JSON";

  if (!trackingNo || trackingNo.length > 128) {
    throw new Error("Carrier label bridge must return trackingNo (non-empty string, max 128 chars).");
  }
  if (!zpl.includes("^XA") || !zpl.includes("^XZ")) {
    throw new Error("Carrier label bridge must return zpl containing ^XA and ^XZ.");
  }

  return {
    adapterId: carrierId,
    trackingNo,
    zpl,
  };
}
