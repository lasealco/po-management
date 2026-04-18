import { describe, expect, it } from "vitest";

import { dateIso, decString } from "@/lib/booking-pricing-snapshot/serialize";

describe("booking-pricing-snapshot serialize", () => {
  it("decString returns null for absent values", () => {
    expect(decString(null)).toBeNull();
    expect(decString(undefined)).toBeNull();
  });

  it("decString stringifies decimal-like values", () => {
    expect(decString({ toString: () => "12.50" })).toBe("12.50");
  });

  it("dateIso returns ISO strings or null", () => {
    expect(dateIso(null)).toBeNull();
    expect(dateIso(undefined)).toBeNull();
    const d = new Date("2024-06-01T12:00:00.000Z");
    expect(dateIso(d)).toBe("2024-06-01T12:00:00.000Z");
  });
});
