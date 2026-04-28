import { describe, expect, it } from "vitest";

import {
  buildGreenerRecommendations,
  buildSustainabilityPacket,
  estimateShipmentEmissions,
  findSustainabilityDataGaps,
  type SustainabilityInputs,
} from "./sustainability";

const inputs: SustainabilityInputs = {
  shipments: [
    {
      id: "ship-air",
      shipmentNo: "SHP-AIR",
      mode: "AIR",
      carrierLabel: "Fast Air",
      customerLabel: "Acme",
      originCode: "FRA",
      destinationCode: "CHI",
      estimatedWeightKg: 2000,
      estimatedVolumeCbm: 4,
      chargeableWeightKg: null,
      status: "IN_TRANSIT",
    },
    {
      id: "ship-gap",
      shipmentNo: "SHP-GAP",
      mode: "UNKNOWN",
      carrierLabel: null,
      customerLabel: null,
      originCode: null,
      destinationCode: "NYC",
      estimatedWeightKg: null,
      estimatedVolumeCbm: null,
      chargeableWeightKg: null,
      status: "BOOKING_DRAFT",
    },
  ],
  warehouseActivity: [
    { id: "wms-1", warehouseLabel: "WH-DEMO-DC1", movementType: "RECEIPT", quantity: 100, occurredAt: "2026-04-28T00:00:00.000Z" },
  ],
  suppliers: [
    { id: "supplier-ok", name: "Green Parts", countryCode: "DE", category: "product" },
    { id: "supplier-gap", name: "Unknown Origin", countryCode: null, category: "logistics" },
  ],
};

describe("sustainability assistant helpers", () => {
  it("estimates emissions with visible factor provenance", () => {
    const rows = estimateShipmentEmissions(inputs.shipments);

    expect(rows[0]).toMatchObject({
      shipmentId: "ship-air",
      mode: "AIR",
      distanceKm: 6500,
      factorKgCo2ePerTonneKm: 0.602,
    });
    expect(rows[0].estimatedCo2eKg).toBeGreaterThan(7000);
    expect(rows[0].assumption).toContain("default mode factor");
  });

  it("flags missing mode, carrier, lane, weight, and supplier country", () => {
    const gaps = findSustainabilityDataGaps(inputs);

    expect(gaps.map((gap) => gap.gap)).toEqual(
      expect.arrayContaining([
        "Missing transport mode.",
        "Missing carrier label.",
        "Missing origin or destination code.",
        "Missing weight or volume basis for emissions estimate.",
        "Missing supplier country for ESG region reporting.",
      ]),
    );
  });

  it("compares greener execution options without claiming automatic changes", () => {
    const emissions = estimateShipmentEmissions(inputs.shipments);
    const gaps = findSustainabilityDataGaps(inputs);
    const recommendations = buildGreenerRecommendations(emissions, gaps);

    expect(recommendations[0]).toMatchObject({ type: "MODE_SHIFT", shipmentId: "ship-air" });
    expect(recommendations[0].estimatedSavingsKg).toBeGreaterThan(0);
    expect(recommendations[0].guardrail).toContain("approval");
    expect(recommendations.some((item) => item.type === "DATA_COMPLETION")).toBe(true);
  });

  it("builds a board-ready packet with no-overclaim guardrails", () => {
    const packet = buildSustainabilityPacket(inputs);

    expect(packet.sustainabilityScore).toBeGreaterThan(0);
    expect(packet.estimatedCo2eKg).toBeGreaterThan(0);
    expect(packet.potentialSavingsKg).toBeGreaterThan(0);
    expect(packet.missingDataCount).toBeGreaterThan(0);
    expect(packet.leadershipSummary).toContain("human approval");
    expect(packet.assumptions.guardrail).toContain("Do not publish");
  });
});
