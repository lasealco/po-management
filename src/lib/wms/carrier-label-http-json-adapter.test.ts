import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { purchaseHttpJsonCarrierLabel } from "./carrier-label-http-json-adapter";
import type { CarrierLabelPurchaseInput } from "./carrier-label-types";

const baseInput: CarrierLabelPurchaseInput = {
  outboundOrderId: "out1",
  outboundNo: "OB-1",
  warehouseLabel: "WH",
  barcodePayload: "OB-1",
  shipToSummary: "Acme · US",
  shipToName: "Acme",
  shipToLine1: "1 Main",
  shipToCity: "Chicago",
  shipToCountryCode: "US",
  asnReference: "ASN-1",
  sscc18: null,
};

describe("carrier-label-http-json-adapter", () => {
  beforeEach(() => {
    process.env.WMS_CARRIER_LABEL_HTTP_URL = "https://bridge.example/v1/labels";
    delete process.env.WMS_CARRIER_LABEL_HTTP_TOKEN;
    delete process.env.WMS_CARRIER_LABEL_HTTP_TIMEOUT_MS;
  });

  afterEach(() => {
    delete process.env.WMS_CARRIER_LABEL_HTTP_URL;
    delete process.env.WMS_CARRIER_LABEL_HTTP_TOKEN;
    delete process.env.WMS_CARRIER_LABEL_HTTP_TIMEOUT_MS;
    vi.restoreAllMocks();
  });

  it("posts JSON and maps tracking, zpl, and carrierId", async () => {
    const fetchMock = vi.fn(async (_url: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      expect(init?.method).toBe("POST");
      const parsed = JSON.parse(String(init?.body));
      expect(parsed.schemaVersion).toBe(1);
      expect(parsed.outboundOrderId).toBe("out1");
      expect(parsed.shipTo.line1).toBe("1 Main");
      return new Response(
        JSON.stringify({
          trackingNo: "1ZTRACK99",
          zpl: "^XA\n^FDHello^FS\n^XZ\n",
          carrierId: "FEDEX_STUB",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    });

    const r = await purchaseHttpJsonCarrierLabel(baseInput, fetchMock as unknown as typeof fetch);
    expect(r.trackingNo).toBe("1ZTRACK99");
    expect(r.adapterId).toBe("FEDEX_STUB");
    expect(r.zpl).toContain("^XA");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("sends bearer token when WMS_CARRIER_LABEL_HTTP_TOKEN is set", async () => {
    process.env.WMS_CARRIER_LABEL_HTTP_TOKEN = "secret";
    const fetchMock = vi.fn(async (_url: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const headers = init?.headers as Record<string, string>;
      expect(headers.Authorization).toBe("Bearer secret");
      return new Response(JSON.stringify({ trackingNo: "T1", zpl: "^XA^XZ" }), { status: 200 });
    });
    await purchaseHttpJsonCarrierLabel(baseInput, fetchMock as unknown as typeof fetch);
  });

  it("surfaces HTTP errors with optional error field", async () => {
    const fetchMock = vi.fn(async (): Promise<Response> => {
      return new Response(JSON.stringify({ error: "rate limited" }), {
        status: 429,
        headers: { "Content-Type": "application/json" },
      });
    });
    await expect(
      purchaseHttpJsonCarrierLabel(baseInput, fetchMock as unknown as typeof fetch),
    ).rejects.toThrow(/429.*rate limited/i);
  });

  it("rejects responses without valid ZPL markers", async () => {
    const fetchMock = vi.fn(async (): Promise<Response> => {
      return new Response(JSON.stringify({ trackingNo: "OK", zpl: "plain text" }), { status: 200 });
    });
    await expect(
      purchaseHttpJsonCarrierLabel(baseInput, fetchMock as unknown as typeof fetch),
    ).rejects.toThrow(/\^XA/);
  });
});
