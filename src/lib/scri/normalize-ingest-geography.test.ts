import { describe, expect, it } from "vitest";

import { normalizeIngestGeography } from "@/lib/scri/normalize-ingest-geography";

describe("normalizeIngestGeography", () => {
  it("uppercases ISO country and UN/LOC", () => {
    const n = normalizeIngestGeography({
      countryCode: " cn ",
      portUnloc: "cnsha",
      region: "  East  China ",
      label: " Shanghai ",
    });
    expect(n.countryCode).toBe("CN");
    expect(n.portUnloc).toBe("CNSHA");
    expect(n.region).toBe("East China");
    expect(n.label).toBe("Shanghai");
  });

  it("clears invalid country and records invalidCountryCode in raw", () => {
    const n = normalizeIngestGeography({ countryCode: "XXZ" });
    expect(n.countryCode).toBeNull();
    expect(n.raw).toEqual({ invalidCountryCode: "XXZ" });
  });

  it("merges client raw with invalid country note", () => {
    const n = normalizeIngestGeography({
      countryCode: "bad",
      raw: { source: "unit-test" },
    });
    expect(n.raw).toEqual({ source: "unit-test", invalidCountryCode: "bad" });
  });
});
