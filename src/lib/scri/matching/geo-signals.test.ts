import type { ScriEventGeography } from "@prisma/client";
import { describe, expect, it } from "vitest";

import {
  buildGeoSignalsFromGeographies,
  normCountry,
  normUnloc,
  regionLooselyMatches,
} from "@/lib/scri/matching/geo-signals";

describe("buildGeoSignalsFromGeographies", () => {
  it("normalizes countries and UN/LOCs", () => {
    const s = buildGeoSignalsFromGeographies([
      {
        id: "1",
        eventId: "e",
        countryCode: "cn",
        region: null,
        portUnloc: " cnsha ",
        label: null,
        raw: null,
      },
    ] as ScriEventGeography[]);
    expect(s.countries.has("CN")).toBe(true);
    expect(s.unlocs.has("CNSHA")).toBe(true);
  });
});

describe("normUnloc / normCountry", () => {
  it("trims and uppercases", () => {
    expect(normUnloc("  usnyc ")).toBe("USNYC");
    expect(normCountry("de")).toBe("DE");
    expect(normUnloc("")).toBe(null);
  });
});

describe("regionLooselyMatches", () => {
  it("matches substring either way", () => {
    expect(regionLooselyMatches("Southwest US", ["southwest"])).toBe(true);
    expect(regionLooselyMatches("Northeast", ["east"])).toBe(true);
    expect(regionLooselyMatches("Midwest", ["southwest"])).toBe(false);
  });
});
