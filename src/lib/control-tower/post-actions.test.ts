import { describe, expect, it } from "vitest";

import { parseBulkShipmentIds } from "@/lib/control-tower/post-actions";

describe("parseBulkShipmentIds", () => {
  it("returns unique trimmed IDs", () => {
    expect(parseBulkShipmentIds([" ship-1 ", "ship-1", "ship-2"])).toEqual(["ship-1", "ship-2"]);
  });

  it("rejects non-array values", () => {
    expect(parseBulkShipmentIds("ship-1")).toBe("invalid");
    expect(parseBulkShipmentIds(null)).toBe("invalid");
  });

  it("rejects empty lists after trimming", () => {
    expect(parseBulkShipmentIds(["   ", ""])).toBe("invalid");
  });

  it("rejects lists over 100 shipment IDs", () => {
    const overLimit = Array.from({ length: 101 }, (_, i) => `ship-${i + 1}`);
    expect(parseBulkShipmentIds(overLimit)).toBe("invalid");
  });
});
