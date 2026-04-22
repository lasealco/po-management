import { describe, expect, it } from "vitest";

import { filterCtTrackingMilestonesForPortal, isCustomerVisibleCtTrackingCode } from "./milestone-visibility";

describe("isCustomerVisibleCtTrackingCode", () => {
  it("allows customer-safe operational codes", () => {
    expect(isCustomerVisibleCtTrackingCode("POL_DEPARTURE")).toBe(true);
    expect(isCustomerVisibleCtTrackingCode("BOOKING_CONFIRMED")).toBe(true);
  });

  it("hides internal-only codes", () => {
    expect(isCustomerVisibleCtTrackingCode("CUSTOMS_HOLD")).toBe(false);
    expect(isCustomerVisibleCtTrackingCode("")).toBe(false);
  });
});

describe("filterCtTrackingMilestonesForPortal", () => {
  it("keeps only portal-visible rows", () => {
    const rows = [
      { code: "POL_DEPARTURE", id: "1" },
      { code: "INTERNAL_ONLY", id: "2" },
      { code: "POD_ARRIVAL", id: "3" },
    ];
    expect(filterCtTrackingMilestonesForPortal(rows)).toEqual([
      { code: "POL_DEPARTURE", id: "1" },
      { code: "POD_ARRIVAL", id: "3" },
    ]);
  });
});
