import { describe, expect, it } from "vitest";

import { parseTmsWebhookPayload, verifyTmsWebhookBearer } from "./tms-webhook-stub";

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
});
