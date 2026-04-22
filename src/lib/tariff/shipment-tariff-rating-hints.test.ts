import type { TransportMode } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  getShipmentTariffRatingHints,
  mapBookingModeToTariffMode,
} from "@/lib/tariff/shipment-tariff-rating-hints";

const prismaMock = vi.hoisted(() => ({
  shipment: { findFirst: vi.fn() },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock,
}));

describe("mapBookingModeToTariffMode", () => {
  it("maps ROAD to TRUCK", () => {
    expect(mapBookingModeToTariffMode("ROAD")).toBe("TRUCK");
  });

  it("passes through AIR and RAIL", () => {
    expect(mapBookingModeToTariffMode("AIR")).toBe("AIR");
    expect(mapBookingModeToTariffMode("RAIL")).toBe("RAIL");
  });

  it("defaults to OCEAN for OCEAN and unknown / missing", () => {
    expect(mapBookingModeToTariffMode("OCEAN")).toBe("OCEAN");
    expect(mapBookingModeToTariffMode(undefined)).toBe("OCEAN");
    expect(mapBookingModeToTariffMode(null)).toBe("OCEAN");
    expect(mapBookingModeToTariffMode("MULTIMODAL" as TransportMode)).toBe("OCEAN");
  });
});

describe("getShipmentTariffRatingHints", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("throws NOT_FOUND when shipment is missing for tenant", async () => {
    prismaMock.shipment.findFirst.mockResolvedValue(null);
    await expect(getShipmentTariffRatingHints({ tenantId: "t1", shipmentId: "missing" })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    expect(prismaMock.shipment.findFirst).toHaveBeenCalledWith({
      where: { id: "missing", order: { tenantId: "t1" } },
      select: {
        id: true,
        transportMode: true,
        booking: { select: { originCode: true, destinationCode: true, mode: true } },
      },
    });
  });

  it("uppercases POL/POD, maps ROAD to TRUCK, and trims booking codes in the response", async () => {
    prismaMock.shipment.findFirst.mockResolvedValue({
      id: "ship-1",
      transportMode: "OCEAN",
      booking: { originCode: " deham ", destinationCode: " USCHI ", mode: "ROAD" },
    });
    const r = await getShipmentTariffRatingHints({ tenantId: "t1", shipmentId: "ship-1" });
    expect(r).toEqual({
      shipmentId: "ship-1",
      pol: "DEHAM",
      pod: "USCHI",
      equipment: "40HC",
      transportMode: "TRUCK",
      bookingOriginCode: "deham",
      bookingDestinationCode: "USCHI",
    });
  });

  it("uses shipment transportMode when booking is absent", async () => {
    prismaMock.shipment.findFirst.mockResolvedValue({
      id: "ship-2",
      transportMode: "AIR",
      booking: null,
    });
    const r = await getShipmentTariffRatingHints({ tenantId: "t1", shipmentId: "ship-2" });
    expect(r.pol).toBeNull();
    expect(r.pod).toBeNull();
    expect(r.transportMode).toBe("AIR");
    expect(r.bookingOriginCode).toBeNull();
    expect(r.bookingDestinationCode).toBeNull();
  });
});
