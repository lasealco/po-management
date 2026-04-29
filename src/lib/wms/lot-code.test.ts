import { describe, expect, it } from "vitest";

import { FUNGIBLE_LOT_CODE, normalizeLotCode } from "./lot-code";

describe("normalizeLotCode", () => {
  it("treats blank as fungible bucket", () => {
    expect(normalizeLotCode("")).toBe(FUNGIBLE_LOT_CODE);
    expect(normalizeLotCode("   ")).toBe(FUNGIBLE_LOT_CODE);
    expect(normalizeLotCode(null)).toBe(FUNGIBLE_LOT_CODE);
    expect(normalizeLotCode(undefined)).toBe(FUNGIBLE_LOT_CODE);
  });

  it("trims and caps length", () => {
    expect(normalizeLotCode("  LOT-A  ")).toBe("LOT-A");
    const long = "x".repeat(200);
    expect(normalizeLotCode(long).length).toBe(120);
  });
});
