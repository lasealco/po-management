import { describe, expect, it } from "vitest";

import {
  normalizeWmsSavedLedgerFilters,
  parseWmsSavedLedgerName,
  wmsSavedLedgerFiltersToPrismaJson,
} from "./saved-ledger-filters";

describe("normalizeWmsSavedLedgerFilters", () => {
  const wh = new Set(["wh-1"]);

  it("normalizes empty filters to defaults", () => {
    const f = normalizeWmsSavedLedgerFilters(
      {
        warehouseId: null,
        movementType: null,
        sinceIso: null,
        untilIso: null,
        limit: null,
        sortBy: "createdAt",
        sortDir: "desc",
      },
      wh,
    );
    expect(f.warehouseId).toBeNull();
    expect(f.sortBy).toBe("createdAt");
    expect(f.sortDir).toBe("desc");
  });

  it("rejects unknown warehouseId", () => {
    expect(() =>
      normalizeWmsSavedLedgerFilters({ warehouseId: "other" }, wh),
    ).toThrow(/warehouse/);
  });

  it("accepts known warehouseId", () => {
    const f = normalizeWmsSavedLedgerFilters({ warehouseId: "wh-1" }, wh);
    expect(f.warehouseId).toBe("wh-1");
  });

  it("coerces invalid sort to createdAt desc", () => {
    const f = normalizeWmsSavedLedgerFilters({ sortBy: "x", sortDir: "y" }, wh);
    expect(f.sortBy).toBe("createdAt");
    expect(f.sortDir).toBe("desc");
  });
});

describe("parseWmsSavedLedgerName", () => {
  it("trims and validates", () => {
    expect(parseWmsSavedLedgerName("  Daily  ")).toBe("Daily");
  });

  it("throws when empty", () => {
    expect(() => parseWmsSavedLedgerName("   ")).toThrow();
  });
});

describe("wmsSavedLedgerFiltersToPrismaJson", () => {
  it("round-trips structure", () => {
    const j = wmsSavedLedgerFiltersToPrismaJson({
      warehouseId: null,
      movementType: "PICK",
      sinceIso: null,
      untilIso: null,
      limit: "50",
      sortBy: "createdAt",
      sortDir: "asc",
    });
    expect(j).toMatchObject({ movementType: "PICK", limit: "50" });
  });
});
