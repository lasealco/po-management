import { describe, expect, it } from "vitest";

import {
  SRM_REGISTER_CATEGORY_QUERY,
  parseRegisterCategorySearchParam,
} from "./register-category-url";

describe("SRM_REGISTER_CATEGORY_QUERY", () => {
  it("is stable for links and router.delete", () => {
    expect(SRM_REGISTER_CATEGORY_QUERY).toBe("registerCategory");
  });
});

describe("parseRegisterCategorySearchParam", () => {
  it("returns null for empty or unknown", () => {
    expect(parseRegisterCategorySearchParam(null)).toBeNull();
    expect(parseRegisterCategorySearchParam("")).toBeNull();
    expect(parseRegisterCategorySearchParam("   ")).toBeNull();
    expect(parseRegisterCategorySearchParam("other")).toBeNull();
    expect(parseRegisterCategorySearchParam("INSURANCE_EXTRA")).toBeNull();
  });

  it("accepts allowed categories case-insensitively", () => {
    expect(parseRegisterCategorySearchParam("insurance")).toBe("insurance");
    expect(parseRegisterCategorySearchParam(" Insurance ")).toBe("insurance");
    expect(parseRegisterCategorySearchParam("LICENSE")).toBe("license");
    expect(parseRegisterCategorySearchParam("certificate")).toBe("certificate");
    expect(parseRegisterCategorySearchParam("compliance_other")).toBe(
      "compliance_other",
    );
    expect(parseRegisterCategorySearchParam("Commercial_Other")).toBe(
      "commercial_other",
    );
  });
});
