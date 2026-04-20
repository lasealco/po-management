import { describe, expect, it } from "vitest";

import {
  addTariffShipmentApplicationSourceLabel,
  labelTariffShipmentApplicationSource,
} from "@/lib/tariff/tariff-shipment-application-labels";

describe("labelTariffShipmentApplicationSource", () => {
  it("maps documented sources to readable labels", () => {
    expect(labelTariffShipmentApplicationSource("MANUAL")).toBe("Manual");
    expect(labelTariffShipmentApplicationSource("RATING_ENGINE")).toBe("Rating engine");
    expect(labelTariffShipmentApplicationSource("SNAPSHOT")).toBe("Snapshot");
  });

  it("title-cases unknown underscore tokens", () => {
    expect(labelTariffShipmentApplicationSource("CUSTOM_IMPORT")).toBe("Custom Import");
  });
});

describe("addTariffShipmentApplicationSourceLabel", () => {
  it("preserves fields and adds sourceLabel", () => {
    const row = { id: "1", source: "RATING_ENGINE", n: 2 };
    expect(addTariffShipmentApplicationSourceLabel(row)).toEqual({
      id: "1",
      source: "RATING_ENGINE",
      n: 2,
      sourceLabel: "Rating engine",
    });
  });
});
