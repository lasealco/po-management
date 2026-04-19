import { describe, expect, it } from "vitest";

import { TariffRepoError } from "@/lib/tariff/tariff-repo-error";

import { assertValidChargeCatalogCode, normalizeChargeCatalogCode } from "./normalized-charge-catalog-shared";

describe("normalizeChargeCatalogCode", () => {
  it("uppercases and collapses spaces to underscores", () => {
    expect(normalizeChargeCatalogCode("  wh handling  ")).toBe("WH_HANDLING");
  });
});

describe("assertValidChargeCatalogCode", () => {
  it("accepts valid codes", () => {
    expect(() => assertValidChargeCatalogCode("OHC")).not.toThrow();
    expect(() => assertValidChargeCatalogCode("DOC_FEE")).not.toThrow();
  });

  it("rejects invalid patterns", () => {
    expect(() => assertValidChargeCatalogCode("x")).toThrow(TariffRepoError);
    expect(() => assertValidChargeCatalogCode("bad-code!")).toThrow(TariffRepoError);
  });
});
