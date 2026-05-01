import { describe, expect, it } from "vitest";

import {
  normalizeWarehouseAisleCode,
  parseMmForWrite,
  resolveBinAisleFieldsForWrite,
} from "./warehouse-aisle";

describe("warehouse-aisle BF-24", () => {
  it("normalizeWarehouseAisleCode uppercases trim", () => {
    expect(normalizeWarehouseAisleCode("  a01 ")).toBe("A01");
  });

  it("resolveBinAisleFieldsForWrite links FK and fills canonical aisle", () => {
    const r = resolveBinAisleFieldsForWrite({
      warehouseId: "wh1",
      requestedWarehouseAisleId: "aisle-row",
      requestedAisleLabel: undefined,
      aisleMaster: { id: "aisle-row", warehouseId: "wh1", code: "a02" },
    });
    expect(r).toEqual({ ok: true, warehouseAisleId: "aisle-row", aisle: "A02" });
  });

  it("resolveBinAisleFieldsForWrite rejects aisle label mismatch", () => {
    const r = resolveBinAisleFieldsForWrite({
      warehouseId: "wh1",
      requestedWarehouseAisleId: "aisle-row",
      requestedAisleLabel: "B09",
      aisleMaster: { id: "aisle-row", warehouseId: "wh1", code: "A01" },
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("must match linked aisle master");
  });

  it("resolveBinAisleFieldsForWrite accepts case-insensitive match", () => {
    const r = resolveBinAisleFieldsForWrite({
      warehouseId: "wh1",
      requestedWarehouseAisleId: "x",
      requestedAisleLabel: "a01",
      aisleMaster: { id: "x", warehouseId: "wh1", code: "A01" },
    });
    expect(r).toEqual({ ok: true, warehouseAisleId: "x", aisle: "A01" });
  });

  it("resolveBinAisleFieldsForWrite rejects wrong warehouse on master", () => {
    const r = resolveBinAisleFieldsForWrite({
      warehouseId: "wh1",
      requestedWarehouseAisleId: "x",
      requestedAisleLabel: undefined,
      aisleMaster: { id: "x", warehouseId: "wh2", code: "A01" },
    });
    expect(r).toEqual({ ok: false, error: "Aisle belongs to a different warehouse." });
  });

  it("parseMmForWrite truncates valid positives", () => {
    expect(parseMmForWrite(1200.9)).toEqual({ ok: true, value: 1200 });
    expect(parseMmForWrite(null)).toEqual({ ok: true, value: null });
    expect(parseMmForWrite(undefined)).toEqual({ ok: true, value: undefined });
  });

  it("parseMmForWrite rejects negatives", () => {
    expect(parseMmForWrite(-1)).toEqual({ ok: false });
  });
});
