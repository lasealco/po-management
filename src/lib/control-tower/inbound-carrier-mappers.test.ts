import { describe, expect, it } from "vitest";

import { mapSeaPortTrackEventToGenericCarrierPayload, SEA_PORT_TRACK_V1_FORMAT } from "./inbound-carrier-mappers";

describe("mapSeaPortTrackEventToGenericCarrierPayload", () => {
  it("maps known activities to internal milestone codes", () => {
    const r = mapSeaPortTrackEventToGenericCarrierPayload({
      consignmentCuid: "ship-1",
      activityType: "BERTH",
      eventTimestamp: "2026-02-10T14:00:00.000Z",
    });
    expect(r).toEqual({
      ok: true,
      carrierPayload: {
        shipment_id: "ship-1",
        event_code: "BERTH_ARR",
        event_time: "2026-02-10T14:00:00.000Z",
      },
    });
  });

  it("uses SPT_ prefix for unknown activities", () => {
    const r = mapSeaPortTrackEventToGenericCarrierPayload({
      shipment_id: "s2",
      activity_type: "weirdCustom",
      event_utc: "2026-01-01T00:00:00.000Z",
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.carrierPayload.event_code).toBe("SPT_WEIRDCUSTOM");
    }
  });

  it("includes message and external_ref when present", () => {
    const r = mapSeaPortTrackEventToGenericCarrierPayload({
      shipmentId: "s3",
      activityType: "LOAD",
      eventUtc: "2026-03-15T08:00:00.000Z",
      freeText: "Laden on board",
      portalRef: "sp-ref-9",
    });
    expect(r).toEqual({
      ok: true,
      carrierPayload: {
        shipment_id: "s3",
        event_code: "PORT_LOAD",
        event_time: "2026-03-15T08:00:00.000Z",
        message: "Laden on board",
        external_ref: "sp-ref-9",
      },
    });
  });

  it("rejects missing shipment id, activity, or timestamp", () => {
    expect(mapSeaPortTrackEventToGenericCarrierPayload({ activityType: "X", eventTimestamp: "2026-01-01T00:00:00.000Z" })).toMatchObject({
      ok: false,
    });
    expect(
      mapSeaPortTrackEventToGenericCarrierPayload({
        consignmentCuid: "a",
        eventTimestamp: "2026-01-01T00:00:00.000Z",
      }),
    ).toMatchObject({ ok: false });
    expect(
      mapSeaPortTrackEventToGenericCarrierPayload({ consignmentCuid: "a", activityType: "DISCH" }),
    ).toMatchObject({ ok: false });
  });
});

describe("SEA_PORT_TRACK_V1_FORMAT", () => {
  it("is stable for payloadFormat and docs", () => {
    expect(SEA_PORT_TRACK_V1_FORMAT).toBe("sea_port_track_v1");
  });
});
