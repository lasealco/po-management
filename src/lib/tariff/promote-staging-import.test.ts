import { describe, expect, it } from "vitest";

import { promoteStagingImportAmountPresent } from "@/lib/tariff/promote-staging-import";

describe("promoteStagingImportAmountPresent", () => {
  it("treats numeric zero and string zero as present", () => {
    expect(promoteStagingImportAmountPresent(0)).toBe(true);
    expect(promoteStagingImportAmountPresent("0")).toBe(true);
    expect(promoteStagingImportAmountPresent("  0  ")).toBe(true);
  });

  it("accepts finite numbers and numeric strings", () => {
    expect(promoteStagingImportAmountPresent(1250.5)).toBe(true);
    expect(promoteStagingImportAmountPresent("  99  ")).toBe(true);
    expect(promoteStagingImportAmountPresent("-12.35")).toBe(true);
    expect(promoteStagingImportAmountPresent("1e3")).toBe(true);
  });

  it("rejects blank and non-numeric strings, NaN/infinite values, null, undefined, and objects", () => {
    expect(promoteStagingImportAmountPresent("")).toBe(false);
    expect(promoteStagingImportAmountPresent("   ")).toBe(false);
    expect(promoteStagingImportAmountPresent("abc")).toBe(false);
    expect(promoteStagingImportAmountPresent("12,000")).toBe(false);
    expect(promoteStagingImportAmountPresent(Number.NaN)).toBe(false);
    expect(promoteStagingImportAmountPresent(Number.POSITIVE_INFINITY)).toBe(false);
    expect(promoteStagingImportAmountPresent(Number.NEGATIVE_INFINITY)).toBe(false);
    expect(promoteStagingImportAmountPresent(null)).toBe(false);
    expect(promoteStagingImportAmountPresent(undefined)).toBe(false);
    expect(promoteStagingImportAmountPresent({})).toBe(false);
  });
});
