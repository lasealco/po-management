import { describe, expect, it } from "vitest";

import {
  findDuplicatePromotableRows,
  isSupportedPromoteRateType,
  promoteStagingImportAmountPresent,
} from "@/lib/tariff/promote-staging-import";

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

describe("findDuplicatePromotableRows", () => {
  it("flags duplicate normalized payloads for equivalent approved rows", () => {
    const duplicate = findDuplicatePromotableRows([
      {
        id: "row-1",
        rowType: "RATE_LINE_CANDIDATE",
        normalizedPayload: { rateType: "BASE_RATE", currency: "USD", unitBasis: "CONTAINER", amount: "100" },
      },
      {
        id: "row-2",
        rowType: "RATE_LINE_CANDIDATE",
        normalizedPayload: { unitBasis: "CONTAINER", amount: "100", currency: "USD", rateType: "BASE_RATE" },
      },
    ]);
    expect(duplicate).toEqual({ firstRowId: "row-1", duplicateRowId: "row-2" });
  });

  it("treats different row types or payload values as non-duplicates", () => {
    expect(
      findDuplicatePromotableRows([
        {
          id: "row-1",
          rowType: "RATE_LINE_CANDIDATE",
          normalizedPayload: { rateType: "BASE_RATE", currency: "USD", unitBasis: "CONTAINER", amount: "100" },
        },
        {
          id: "row-2",
          rowType: "CHARGE_LINE_CANDIDATE",
          normalizedPayload: { rawChargeName: "BAF", currency: "USD", unitBasis: "CONTAINER", amount: "100" },
        },
        {
          id: "row-3",
          rowType: "RATE_LINE_CANDIDATE",
          normalizedPayload: { rateType: "BASE_RATE", currency: "USD", unitBasis: "CONTAINER", amount: "101" },
        },
      ]),
    ).toBeNull();
  });

  it("ignores malformed normalized payload objects", () => {
    expect(
      findDuplicatePromotableRows([
        { id: "row-1", rowType: "RATE_LINE_CANDIDATE", normalizedPayload: null },
        { id: "row-2", rowType: "RATE_LINE_CANDIDATE", normalizedPayload: [] },
      ]),
    ).toBeNull();
  });
});

describe("isSupportedPromoteRateType", () => {
  it("accepts known tariff line rate type enums", () => {
    expect(isSupportedPromoteRateType("BASE_RATE")).toBe(true);
    expect(isSupportedPromoteRateType("ALL_IN")).toBe(true);
  });

  it("rejects unsupported or malformed values", () => {
    expect(isSupportedPromoteRateType("NOT_A_REAL_RATE_TYPE")).toBe(false);
    expect(isSupportedPromoteRateType("base_rate")).toBe(false);
    expect(isSupportedPromoteRateType(123)).toBe(false);
    expect(isSupportedPromoteRateType(null)).toBe(false);
  });
});
