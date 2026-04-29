import { describe, expect, it } from "vitest";

import { warehouseZoneParentWouldCycle } from "./zone-hierarchy";

describe("zone-hierarchy", () => {
  it("allows null parent", () => {
    expect(
      warehouseZoneParentWouldCycle("a", null, [
        { id: "a", parentZoneId: null },
        { id: "b", parentZoneId: null },
      ]),
    ).toBe(false);
  });

  it("rejects self-parent", () => {
    expect(warehouseZoneParentWouldCycle("a", "a", [{ id: "a", parentZoneId: null }])).toBe(true);
  });

  it("detects cycle A→B→C→A", () => {
    const rows = [
      { id: "a", parentZoneId: null },
      { id: "b", parentZoneId: "a" },
      { id: "c", parentZoneId: "b" },
    ];
    expect(warehouseZoneParentWouldCycle("a", "c", rows)).toBe(true);
  });

  it("allows valid tree assignment", () => {
    const rows = [
      { id: "root", parentZoneId: null },
      { id: "child", parentZoneId: null },
    ];
    expect(warehouseZoneParentWouldCycle("child", "root", rows)).toBe(false);
  });
});
