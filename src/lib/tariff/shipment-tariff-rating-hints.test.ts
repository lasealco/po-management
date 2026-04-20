import { describe, expect, it } from "vitest";

import { mapBookingModeToTariffMode } from "@/lib/tariff/shipment-tariff-rating-hints";

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
  });
});
