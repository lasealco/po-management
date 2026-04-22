import { describe, expect, it } from "vitest";

import { exceptionCatalogBucket, normalizeExceptionTypeKey } from "./report-engine";

describe("normalizeExceptionTypeKey", () => {
  it("trims and lowercases", () => {
    expect(normalizeExceptionTypeKey("  DELAY.V1  ")).toBe("delay.v1");
  });
});

describe("exceptionCatalogBucket", () => {
  it("returns blank bucket for empty type", () => {
    expect(
      exceptionCatalogBucket({
        rawType: "   ",
        catalogByNormalizedCode: new Map(),
      }),
    ).toEqual({ rowKey: "(blank)", rowLabel: "Blank type" });
  });

  it("uses catalog code and label when normalized key matches", () => {
    const catalog = new Map([
      ["delay.v1", { code: "DELAY.V1", label: "Carrier delay" }],
    ]);
    expect(
      exceptionCatalogBucket({
        rawType: "Delay.v1",
        catalogByNormalizedCode: catalog,
      }),
    ).toEqual({
      rowKey: "DELAY.V1",
      rowLabel: "Carrier delay (DELAY.V1)",
    });
  });

  it("falls back to raw type for unlisted codes", () => {
    expect(
      exceptionCatalogBucket({
        rawType: "CUSTOM-XYZ",
        catalogByNormalizedCode: new Map(),
      }),
    ).toEqual({
      rowKey: "CUSTOM-XYZ",
      rowLabel: "Unlisted (CUSTOM-XYZ)",
    });
  });
});
