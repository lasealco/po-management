import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  classifyTariffUnlocsAgainstLocationCatalog,
  normalizeUnlocCodesForCatalogCheck,
  TARIFF_GEO_CATALOG_CHECK_MAX_CODES,
} from "./geography-catalog";

const prismaMock = vi.hoisted(() => ({
  locationCode: { findMany: vi.fn() },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock,
}));

describe("normalizeUnlocCodesForCatalogCheck", () => {
  it("trims, uppercases, dedupes, and drops blanks", () => {
    expect(normalizeUnlocCodesForCatalogCheck([" deham ", "DEHAM", "", "  uschi  "])).toEqual(["DEHAM", "USCHI"]);
  });

  it("returns empty list when all inputs are blank", () => {
    expect(normalizeUnlocCodesForCatalogCheck(["", "   ", "\t"])).toEqual([]);
  });

  it("documents the catalog-check cap used by the API", () => {
    expect(TARIFF_GEO_CATALOG_CHECK_MAX_CODES).toBe(500);
  });
});

describe("classifyTariffUnlocsAgainstLocationCatalog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("short-circuits without querying when normalized codes are empty", async () => {
    const r = await classifyTariffUnlocsAgainstLocationCatalog({ tenantId: "t1", codes: ["", "  "] });
    expect(r).toEqual({ known: [], unknown: [] });
    expect(prismaMock.locationCode.findMany).not.toHaveBeenCalled();
  });

  it("partitions codes using active tenant location rows (case-insensitive hit match)", async () => {
    prismaMock.locationCode.findMany.mockResolvedValue([{ code: "deham" }]);
    const r = await classifyTariffUnlocsAgainstLocationCatalog({
      tenantId: "tenant-a",
      codes: ["DEHAM", "zzzz", "deham"],
    });
    expect(r).toEqual({ known: ["DEHAM"], unknown: ["ZZZZ"] });
    expect(prismaMock.locationCode.findMany).toHaveBeenCalledWith({
      where: { tenantId: "tenant-a", isActive: true, code: { in: ["DEHAM", "ZZZZ"] } },
      select: { code: true },
    });
  });
});
