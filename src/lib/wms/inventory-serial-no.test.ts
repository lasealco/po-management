import { describe, expect, it } from "vitest";

import { InventorySerialNoError, normalizeInventorySerialNo } from "./inventory-serial-no";

describe("normalizeInventorySerialNo", () => {
  it("trims and uppercases", () => {
    expect(normalizeInventorySerialNo("  abc-12  ")).toBe("ABC-12");
  });

  it("rejects empty", () => {
    expect(() => normalizeInventorySerialNo("   ")).toThrow(InventorySerialNoError);
  });

  it("rejects too long", () => {
    expect(() => normalizeInventorySerialNo("x".repeat(121))).toThrow(InventorySerialNoError);
  });
});
