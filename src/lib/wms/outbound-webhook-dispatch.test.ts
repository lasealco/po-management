import { describe, expect, it } from "vitest";

import {
  computeOutboundWebhookBackoffMs,
  parseOutboundWebhookEventTypes,
  signOutboundWebhookBody,
} from "./outbound-webhook-dispatch";
import { verifyTmsWebhookBodySignature } from "./tms-webhook-stub";

describe("BF-44 outbound webhook dispatch", () => {
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
});
