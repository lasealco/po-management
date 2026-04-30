import { describe, expect, it } from "vitest";

import { buildWarehouseMapPins } from "./map-layers";

describe("buildWarehouseMapPins", () => {
  it("returns pins when city + country resolve", () => {
    const pins = buildWarehouseMapPins([
      {
        id: "wh1",
        code: "DC1",
        name: "Chicago DC",
        city: "Chicago",
        region: "IL",
        countryCode: "US",
      },
    ]);
    expect(pins).toHaveLength(1);
    expect(pins[0].title).toContain("Chicago DC");
    expect(pins[0].href).toBe("/wms/setup");
    expect(Number.isFinite(pins[0].lat)).toBe(true);
    expect(Number.isFinite(pins[0].lng)).toBe(true);
  });

  it("skips rows with no mappable geography", () => {
    const pins = buildWarehouseMapPins([
      {
        id: "wh-x",
        code: null,
        name: "Unknown Site XYZ123",
        city: null,
        region: null,
        countryCode: null,
      },
    ]);
    expect(pins).toHaveLength(0);
  });

  it("uses name hints when city missing", () => {
    const pins = buildWarehouseMapPins([
      {
        id: "wh-sz",
        code: null,
        name: "Shenzhen fulfillment node",
        city: null,
        region: null,
        countryCode: null,
      },
    ]);
    expect(pins.length).toBeGreaterThanOrEqual(1);
  });
});
