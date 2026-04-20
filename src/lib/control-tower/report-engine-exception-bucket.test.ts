import { describe, expect, it } from "vitest";

import { exceptionCatalogBucket, normalizeExceptionTypeKey } from "./report-engine";

describe("normalizeExceptionTypeKey", () => {
  it("trims and lowercases", () => {
    expect(normalizeExceptionTypeKey("  LATE_DOC  ")).toBe("late_doc");
  });
});

describe("exceptionCatalogBucket", () => {
  const catalog = new Map<string, { code: string; label: string }>([
    ["late_doc", { code: "LATE_DOC", label: "Late documentation" }],
  ]);

  it("maps raw type to catalog code and label", () => {
    expect(
      exceptionCatalogBucket({
        rawType: "late_doc",
        catalogByNormalizedCode: catalog,
      }),
    ).toEqual({ rowKey: "LATE_DOC", rowLabel: "Late documentation (LATE_DOC)" });
  });

  it("matches catalog by case-insensitive code", () => {
    expect(
      exceptionCatalogBucket({
        rawType: "LaTe_DoC",
        catalogByNormalizedCode: catalog,
      }),
    ).toEqual({ rowKey: "LATE_DOC", rowLabel: "Late documentation (LATE_DOC)" });
  });

  it("returns unlisted bucket when not in catalog", () => {
    expect(
      exceptionCatalogBucket({
        rawType: "CUSTOM-XYZ",
        catalogByNormalizedCode: catalog,
      }),
    ).toEqual({ rowKey: "CUSTOM-XYZ", rowLabel: "Unlisted (CUSTOM-XYZ)" });
  });

  it("handles blank raw type", () => {
    expect(
      exceptionCatalogBucket({
        rawType: "   ",
        catalogByNormalizedCode: catalog,
      }),
    ).toEqual({ rowKey: "(blank)", rowLabel: "Blank type" });
  });
});
