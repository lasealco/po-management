import { TariffChargeFamily, TariffTransportMode } from "@prisma/client";
import { describe, expect, it } from "vitest";

import { TariffRepoError } from "@/lib/tariff/tariff-repo-error";

import {
  TARIFF_CHARGE_FAMILY_OPTIONS,
  TARIFF_TRANSPORT_MODE_OPTIONS,
  assertValidChargeCatalogCode,
  normalizeChargeCatalogCode,
} from "./normalized-charge-catalog-shared";

describe("normalizeChargeCatalogCode", () => {
  it("trims, uppercases, and collapses whitespace to underscores", () => {
    expect(normalizeChargeCatalogCode("  doc fee  ")).toBe("DOC_FEE");
    expect(normalizeChargeCatalogCode("thc")).toBe("THC");
  });
});

describe("assertValidChargeCatalogCode", () => {
  it("accepts 2–32 char A–Z / digit / underscore codes", () => {
    expect(() => assertValidChargeCatalogCode("AB")).not.toThrow();
    expect(() => assertValidChargeCatalogCode("DOC_FEE_01")).not.toThrow();
  });

  it("throws BAD_INPUT for too short or invalid characters", () => {
    expect(() => assertValidChargeCatalogCode("A")).toThrow(TariffRepoError);
    try {
      assertValidChargeCatalogCode("doc-fee");
      expect.fail("expected throw");
    } catch (e) {
      expect(e).toMatchObject({ code: "BAD_INPUT" });
    }
  });
});

describe("option lists", () => {
  it("exposes charge families and transport modes aligned with Prisma enums", () => {
    expect(TARIFF_CHARGE_FAMILY_OPTIONS).toContain("MAIN_CARRIAGE");
    expect(TARIFF_TRANSPORT_MODE_OPTIONS).toContain("OCEAN");
    expect(TARIFF_TRANSPORT_MODE_OPTIONS).toHaveLength(6);
  });

  it("lists every TariffChargeFamily and TariffTransportMode exactly once (UI selects stay in sync)", () => {
    const prismaFamilies = new Set<string>(Object.values(TariffChargeFamily));
    const libFamilies = new Set<string>(TARIFF_CHARGE_FAMILY_OPTIONS);
    expect(libFamilies).toEqual(prismaFamilies);

    const prismaModes = new Set<string>(Object.values(TariffTransportMode));
    const libModes = new Set<string>(TARIFF_TRANSPORT_MODE_OPTIONS);
    expect(libModes).toEqual(prismaModes);
  });
});
