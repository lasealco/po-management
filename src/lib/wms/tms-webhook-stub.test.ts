import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";

import {
  parseTmsWebhookPayload,
  verifyTmsWebhookBearer,
  verifyTmsWebhookBodySignature,
} from "./tms-webhook-stub";

describe("verifyTmsWebhookBearer", () => {
  it("accepts matching Bearer secret", () => {
    expect(verifyTmsWebhookBearer("Bearer abc", "abc")).toBe(true);
  });

  it("rejects wrong secret", () => {
    expect(verifyTmsWebhookBearer("Bearer abc", "xyz")).toBe(false);
  });

  it("rejects missing header", () => {
    expect(verifyTmsWebhookBearer(null, "abc")).toBe(false);
  });
});

describe("verifyTmsWebhookBodySignature", () => {
  it("accepts sha256=<hex> over UTF-8 body", () => {
    const secret = "carrier-shared-secret";
    const raw = '{"dockAppointmentId":"x"}';
    const hex = createHmac("sha256", secret).update(raw, "utf8").digest("hex");
    expect(verifyTmsWebhookBodySignature(`sha256=${hex}`, raw, secret)).toBe(true);
  });

  it("rejects wrong signature", () => {
    const raw = "{}";
    expect(
      verifyTmsWebhookBodySignature(
        "sha256=" + "a".repeat(64),
        raw,
        "secret",
      ),
    ).toBe(false);
  });
});

describe("parseTmsWebhookPayload", () => {
  it("requires dockAppointmentId", () => {
    expect(parseTmsWebhookPayload({ tenantSlug: "demo-company" })).toBeNull();
  });

  it("defaults tenant slug to demo-company", () => {
    const p = parseTmsWebhookPayload({ dockAppointmentId: "apt1" });
    expect(p?.tenantSlug).toBe("demo-company");
  });

  it("parses yard milestone", () => {
    const p = parseTmsWebhookPayload({
      dockAppointmentId: "apt1",
      yardMilestone: "AT_DOCK",
    });
    expect(p?.yardMilestone).toBe("AT_DOCK");
  });

  it("parses optional externalEventId capped", () => {
    const longId = "e".repeat(200);
    const p = parseTmsWebhookPayload({
      dockAppointmentId: "apt1",
      externalEventId: longId,
    });
    expect(p?.externalEventId?.length).toBe(128);
  });
});
