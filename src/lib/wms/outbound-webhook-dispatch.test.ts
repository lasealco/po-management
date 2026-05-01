import { afterEach, describe, expect, it, vi } from "vitest";

import {
  computeOutboundWebhookBackoffMs,
  parseOutboundWebhookEventTypes,
  postOutboundWebhookDeliveryOnce,
  signOutboundWebhookBody,
} from "./outbound-webhook-dispatch";
import { verifyTmsWebhookBodySignature } from "./tms-webhook-stub";

describe("BF-44 outbound webhook dispatch", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("computes capped exponential backoff", () => {
    expect(computeOutboundWebhookBackoffMs(0)).toBe(2000);
    expect(computeOutboundWebhookBackoffMs(1)).toBe(4000);
    expect(computeOutboundWebhookBackoffMs(10)).toBe(300_000);
  });

  it("signs bodies compatibly with BF-25 verify helper", () => {
    const secret = " tenant-hmac ";
    const body = '{"event":"RECEIPT_CLOSED"}';
    const sig = signOutboundWebhookBody(secret, body);
    expect(verifyTmsWebhookBodySignature(sig, body, secret)).toBe(true);
  });

  it("parses event type arrays with dedupe", () => {
    expect(parseOutboundWebhookEventTypes(["receipt_closed", "OUTBOUND_SHIPPED", "unknown"])).toEqual([
      "RECEIPT_CLOSED",
      "OUTBOUND_SHIPPED",
    ]);
  });

  it("posts webhook delivery when fetch succeeds", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      text: async () => "",
    }));
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);
    const r = await postOutboundWebhookDeliveryOnce(
      "http://127.0.0.1/hook",
      "secret",
      "RECEIPT_CLOSED",
      "del_test",
      { schemaVersion: 1, hello: "world" },
    );
    expect(r.ok).toBe(true);
    expect(r.httpStatus).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
