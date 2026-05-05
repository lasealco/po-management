import { describe, expect, it } from "vitest";

import {
  parseYardGeofenceWebhookPayload,
  YARD_GEOFENCE_WEBHOOK_SCHEMA_VERSION,
} from "./yard-geofence-webhook-bf74";

describe("yard-geofence-webhook-bf74", () => {
  it("parses minimal payload with required externalEventId", () => {
    const p = parseYardGeofenceWebhookPayload({
      dockAppointmentId: " appt1 ",
      externalEventId: "evt-1",
      yardMilestone: "GATE_IN",
    });
    expect(p).not.toBeNull();
    expect(p!.dockAppointmentId).toBe("appt1");
    expect(p!.externalEventId).toBe("evt-1");
    expect(p!.tenantSlug).toBe("demo-company");
    expect(p!.yardMilestone).toBe("GATE_IN");
  });

  it("rejects missing externalEventId", () => {
    expect(
      parseYardGeofenceWebhookPayload({
        dockAppointmentId: "a",
        yardMilestone: "GATE_IN",
      }),
    ).toBeNull();
  });

  it("rejects wrong schemaVersion when provided", () => {
    expect(
      parseYardGeofenceWebhookPayload({
        dockAppointmentId: "a",
        externalEventId: "e",
        yardMilestone: "AT_DOCK",
        schemaVersion: "bf73.v1",
      }),
    ).toBeNull();
  });

  it("accepts explicit bf74 schemaVersion", () => {
    const p = parseYardGeofenceWebhookPayload({
      schemaVersion: YARD_GEOFENCE_WEBHOOK_SCHEMA_VERSION,
      dockAppointmentId: "x",
      externalEventId: "e",
      tenantSlug: " acme ",
      yardMilestone: "DEPARTED",
    });
    expect(p?.tenantSlug).toBe("acme");
    expect(p?.schemaVersion).toBe(YARD_GEOFENCE_WEBHOOK_SCHEMA_VERSION);
  });
});
