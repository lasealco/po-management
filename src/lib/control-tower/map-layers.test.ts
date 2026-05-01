import { describe, expect, it } from "vitest";

import { buildCrmAccountMapPins, buildWarehouseMapPins } from "./map-layers";

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

describe("buildCrmAccountMapPins", () => {
  it("emits a pin for valid coordinates", () => {
    const pins = buildCrmAccountMapPins([
      { id: "crm1", name: "Acme", legalName: "Acme BV", mapLatitude: 51.9, mapLongitude: 4.47 },
    ]);
    expect(pins).toHaveLength(1);
    expect(pins[0].title).toContain("Acme");
    expect(pins[0].href).toBe("/crm/accounts/crm1");
  });

  it("drops rows outside lat/lng range", () => {
    expect(
      buildCrmAccountMapPins([
        { id: "bad", name: "X", legalName: null, mapLatitude: 999, mapLongitude: 0 },
      ]),
    ).toHaveLength(0);
  });
});
