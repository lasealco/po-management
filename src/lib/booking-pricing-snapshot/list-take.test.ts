import { describe, expect, it } from "vitest";

import { clampSnapshotListTake } from "@/lib/booking-pricing-snapshot/booking-pricing-snapshots";

describe("clampSnapshotListTake", () => {
  it("defaults to 100", () => {
    expect(clampSnapshotListTake(undefined)).toBe(100);
  });

  it("clamps to 1..300", () => {
    expect(clampSnapshotListTake(0)).toBe(1);
    expect(clampSnapshotListTake(-5)).toBe(1);
    expect(clampSnapshotListTake(500)).toBe(300);
    expect(clampSnapshotListTake(200)).toBe(200);
  });
});
