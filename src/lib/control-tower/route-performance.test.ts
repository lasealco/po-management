import { describe, expect, it } from "vitest";

import { buildRoutePerformance } from "./route-performance";

const d = (iso: string) => new Date(iso);

describe("buildRoutePerformance", () => {
  it("returns guidance when PO requested date is missing", () => {
    const r = buildRoutePerformance({
      requestedDeliveryDate: null,
      booking: null,
      legs: [],
      shipmentReceivedAt: null,
      shipmentStatus: "IN_TRANSIT",
    });
    expect(r.legs).toEqual([]);
    expect(r.plannedVsRequestedStatus).toBe("unknown");
    expect(r.summary).toContain("requested delivery date");
  });

  it("synthesizes a single leg from booking when no CtShipmentLeg rows", () => {
    const r = buildRoutePerformance({
      requestedDeliveryDate: d("2025-07-01T00:00:00.000Z"),
      booking: {
        etd: d("2025-06-20T08:00:00.000Z"),
        eta: d("2025-06-28T18:00:00.000Z"),
        latestEta: null,
        originCode: "DEHAM",
        destinationCode: "USCHI",
      },
      legs: [],
      shipmentReceivedAt: null,
      shipmentStatus: "IN_TRANSIT",
    });
    expect(r.hasSyntheticLeg).toBe(true);
    expect(r.legs).toHaveLength(1);
    expect(r.legs[0].originCode).toBe("DEHAM");
    expect(r.legs[0].destinationCode).toBe("USCHI");
    expect(r.plannedDepartureAt).toBe(r.bookingEtd);
    expect(r.plannedArrivalAt).toBe(r.bookingEta);
  });

  it("uses first and last real legs for planned departure and arrival", () => {
    const r = buildRoutePerformance({
      requestedDeliveryDate: d("2025-07-10T00:00:00.000Z"),
      booking: {
        etd: d("2025-06-01T00:00:00.000Z"),
        eta: d("2025-06-30T00:00:00.000Z"),
        latestEta: null,
        originCode: "X",
        destinationCode: "Y",
      },
      legs: [
        {
          legNo: 2,
          originCode: "DEHAM",
          destinationCode: "NLRTM",
          plannedEtd: d("2025-06-15T10:00:00.000Z"),
          plannedEta: d("2025-06-16T12:00:00.000Z"),
          actualAtd: null,
          actualAta: null,
        },
        {
          legNo: 1,
          originCode: "CNSHA",
          destinationCode: "DEHAM",
          plannedEtd: d("2025-06-10T08:00:00.000Z"),
          plannedEta: d("2025-06-14T20:00:00.000Z"),
          actualAtd: d("2025-06-10T09:00:00.000Z"),
          actualAta: null,
        },
      ],
      shipmentReceivedAt: null,
      shipmentStatus: "IN_TRANSIT",
    });
    const sortedFirst = r.legs.find((l) => l.legNo === 1);
    const sortedLast = r.legs.find((l) => l.legNo === 2);
    expect(r.plannedDepartureAt).toBe(sortedFirst?.plannedEtd ?? null);
    expect(r.plannedArrivalAt).toBe(sortedLast?.plannedEta ?? null);
    expect(r.actualDepartureAt).toBe(d("2025-06-10T09:00:00.000Z").toISOString());
  });

  it("marks at_risk when planned arrival is after PO date and not yet delivered", () => {
    const r = buildRoutePerformance({
      requestedDeliveryDate: d("2025-06-10T00:00:00.000Z"),
      booking: {
        etd: d("2025-06-05T00:00:00.000Z"),
        eta: d("2025-06-15T00:00:00.000Z"),
        latestEta: null,
        originCode: "A",
        destinationCode: "B",
      },
      legs: [],
      shipmentReceivedAt: null,
      shipmentStatus: "IN_TRANSIT",
    });
    expect((r.plannedVsRequestedDays ?? 0) > 0).toBe(true);
    expect(r.plannedVsRequestedStatus).toBe("at_risk");
  });

  it("marks late when delivered after PO requested day", () => {
    const r = buildRoutePerformance({
      requestedDeliveryDate: d("2025-06-10T00:00:00.000Z"),
      booking: {
        etd: d("2025-06-05T00:00:00.000Z"),
        eta: d("2025-06-20T00:00:00.000Z"),
        latestEta: null,
        originCode: "A",
        destinationCode: "B",
      },
      legs: [],
      shipmentReceivedAt: d("2025-06-12T00:00:00.000Z"),
      shipmentStatus: "RECEIVED",
    });
    expect(r.plannedVsRequestedStatus).toBe("late");
    expect((r.actualVsRequestedDays ?? 0) > 0).toBe(true);
    expect(r.summary).toMatch(/after PO requested/);
  });
});
