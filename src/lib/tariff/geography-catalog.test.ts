import { describe, expect, it } from "vitest";

import { normalizeUnlocCodesForCatalogCheck, TARIFF_GEO_CATALOG_CHECK_MAX_CODES } from "./geography-catalog";

describe("normalizeUnlocCodesForCatalogCheck", () => {
  it("trims, uppercases, dedupes, and drops blanks", () => {
    expect(normalizeUnlocCodesForCatalogCheck([" deham ", "DEHAM", "", "  uschi  "])).toEqual(["DEHAM", "USCHI"]);
  });

  it("documents the catalog-check cap used by the API", () => {
    expect(TARIFF_GEO_CATALOG_CHECK_MAX_CODES).toBe(500);
  });
});
