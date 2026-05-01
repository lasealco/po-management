import { describe, expect, it } from "vitest";

import { effectiveAvailableUnits } from "./soft-reservation";

describe("effectiveAvailableUnits", () => {
  it("subtracts allocated and soft-reserved from on-hand", () => {
    expect(effectiveAvailableUnits(100, 30, 20)).toBe(50);
  });

  it("never returns negative", () => {
    expect(effectiveAvailableUnits(10, 50, 50)).toBe(0);
  });
});
