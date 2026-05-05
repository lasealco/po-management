import { describe, expect, it } from "vitest";

import {
  SCRAP_VALUE_PER_UNIT_CENTS_BF95_MAX,
  parseScrapValuePerUnitCentsBf95,
} from "./scrap-valuation-bf95";

describe("parseScrapValuePerUnitCentsBf95", () => {
  it("omits when undefined", () => {
    expect(parseScrapValuePerUnitCentsBf95(undefined)).toEqual({ ok: true, mode: "omit" });
  });

  it("clears when null or empty string", () => {
    expect(parseScrapValuePerUnitCentsBf95(null)).toEqual({ ok: true, mode: "clear" });
    expect(parseScrapValuePerUnitCentsBf95("")).toEqual({ ok: true, mode: "clear" });
  });

  it("parses integers", () => {
    expect(parseScrapValuePerUnitCentsBf95(42)).toEqual({ ok: true, mode: "set", cents: 42 });
    expect(parseScrapValuePerUnitCentsBf95("99")).toEqual({ ok: true, mode: "set", cents: 99 });
  });

  it("rejects non-integers and overflow", () => {
    expect(parseScrapValuePerUnitCentsBf95(1.2).ok).toBe(false);
    expect(parseScrapValuePerUnitCentsBf95(-1).ok).toBe(false);
    expect(parseScrapValuePerUnitCentsBf95(SCRAP_VALUE_PER_UNIT_CENTS_BF95_MAX + 1).ok).toBe(false);
  });
});
