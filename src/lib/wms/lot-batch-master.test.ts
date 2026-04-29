import { describe, expect, it } from "vitest";

import {
  parseLotBatchExpiryInput,
  requireNonFungibleLotBatchCode,
  truncateLotBatchCountry,
  truncateLotBatchNotes,
} from "./lot-batch-master";

describe("lot-batch-master", () => {
  it("requireNonFungibleLotBatchCode rejects empty / whitespace", () => {
    expect(() => requireNonFungibleLotBatchCode("")).toThrow();
    expect(() => requireNonFungibleLotBatchCode("   ")).toThrow();
    expect(requireNonFungibleLotBatchCode(" BATCH-A ")).toBe("BATCH-A");
  });

  it("parseLotBatchExpiryInput handles omit, clear, set", () => {
    expect(parseLotBatchExpiryInput(undefined)).toEqual({ mode: "omit" });
    expect(parseLotBatchExpiryInput(null)).toEqual({ mode: "clear" });
    expect(parseLotBatchExpiryInput("")).toEqual({ mode: "clear" });
    const r = parseLotBatchExpiryInput("2026-06-15");
    expect(r.mode).toBe("set");
    if (r.mode === "set") {
      expect(r.date.toISOString().slice(0, 10)).toBe("2026-06-15");
    }
  });

  it("truncateLotBatchCountry and truncateLotBatchNotes", () => {
    expect(truncateLotBatchCountry(undefined)).toBeUndefined();
    expect(truncateLotBatchCountry(null)).toBeNull();
    expect(truncateLotBatchCountry(" US ")).toBe("US");
    expect(truncateLotBatchNotes(undefined)).toBeUndefined();
    expect(truncateLotBatchNotes(" x ".repeat(900))).toHaveLength(2000);
  });
});
