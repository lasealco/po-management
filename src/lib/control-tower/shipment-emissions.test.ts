import { describe, expect, it } from "vitest";

import { computeShipmentEmissionsSummary, haversineKm } from "./shipment-emissions";

describe("haversineKm", () => {
  it("returns positive distance between two points", () => {
    const km = haversineKm(53.55, 9.99, 51.92, 4.48);
    expect(km).toBeGreaterThan(350);
    expect(km).toBeLessThan(450);
  });
});

describe("computeShipmentEmissionsSummary", () => {
  it("uses great-circle distance when codes resolve and computes CO2e from tonnage", () => {
    const r = computeShipmentEmissionsSummary({
      shipmentTransportMode: "OCEAN",
      cargoChargeableWeightKg: { toString: () => "2000" },
      estimatedWeightKg: null,
      lineCargoGrossKg: [],
      legs: [
        {
          legNo: 1,
          originCode: "DEHAM",
          destinationCode: "NLRTM",
          transportMode: "OCEAN",
          plannedEtd: null,
          plannedEta: null,
          actualAtd: null,
          actualAta: null,
        },
      ],
    });
    expect(r.tonnageKg).toBe(2000);
    expect(r.tonnageSource).toBe("chargeable");
    expect(r.legs[0].distanceSource).toBe("coordinates");
    expect(r.legs[0].distanceKm).not.toBeNull();
    expect(r.totalDistanceKm).not.toBeNull();
    expect(r.totalKgCo2e).not.toBeNull();
    expect((r.totalKgCo2e ?? 0) > 0).toBe(true);
    expect(r.methodology).toContain("Indicative");
  });

  it("falls back tonnage to estimated then line sum", () => {
    const est = computeShipmentEmissionsSummary({
      shipmentTransportMode: "OCEAN",
      cargoChargeableWeightKg: null,
      estimatedWeightKg: { toString: () => "500" },
      lineCargoGrossKg: [],
      legs: [],
    });
    expect(est.tonnageSource).toBe("estimated_shipment");

    const lines = computeShipmentEmissionsSummary({
      shipmentTransportMode: "OCEAN",
      cargoChargeableWeightKg: null,
      estimatedWeightKg: null,
      lineCargoGrossKg: [{ toString: () => "100" }, { toString: () => "50" }],
      legs: [],
    });
    expect(lines.tonnageKg).toBe(150);
    expect(lines.tonnageSource).toBe("sum_line_cargo");
  });

  it("uses time×speed distance when coordinates unknown but leg window exists", () => {
    const etd = new Date("2025-01-01T00:00:00.000Z");
    const eta = new Date("2025-01-01T10:00:00.000Z");
    const r = computeShipmentEmissionsSummary({
      shipmentTransportMode: "AIR",
      cargoChargeableWeightKg: { toString: () => "1000" },
      estimatedWeightKg: null,
      lineCargoGrossKg: [],
      legs: [
        {
          legNo: 1,
          originCode: "ZZZ999",
          destinationCode: "AAA000",
          transportMode: "AIR",
          plannedEtd: etd,
          plannedEta: eta,
          actualAtd: null,
          actualAta: null,
        },
      ],
    });
    expect(r.legs[0].distanceSource).toBe("time_speed");
    expect((r.legs[0].distanceKm ?? 0) > 0).toBe(true);
  });
});
