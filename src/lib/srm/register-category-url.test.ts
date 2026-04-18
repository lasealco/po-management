import { describe, expect, it } from "vitest";

import {
  SRM_REGISTER_CATEGORY_QUERY,
  mergeDocumentsWorkspaceQuery,
  parseRegisterCategorySearchParam,
} from "./register-category-url";

describe("SRM_REGISTER_CATEGORY_QUERY", () => {
  it("is stable for links and router.delete", () => {
    expect(SRM_REGISTER_CATEGORY_QUERY).toBe("registerCategory");
  });
});

describe("mergeDocumentsWorkspaceQuery", () => {
  it("srm-documents-tab sets tab and optional registerCategory", () => {
    const empty = mergeDocumentsWorkspaceQuery({
      currentSearch: "",
      mode: "srm-documents-tab",
      focus: "insurance",
    });
    const q1 = new URLSearchParams(empty);
    expect(q1.get("tab")).toBe("documents");
    expect(q1.get(SRM_REGISTER_CATEGORY_QUERY)).toBe("insurance");

    const cleared = mergeDocumentsWorkspaceQuery({
      currentSearch: "tab=onboarding&registerCategory=license",
      mode: "srm-documents-tab",
      focus: null,
    });
    const q2 = new URLSearchParams(cleared);
    expect(q2.get("tab")).toBe("documents");
    expect(q2.get(SRM_REGISTER_CATEGORY_QUERY)).toBeNull();
  });

  it("register-only preserves other keys and sets registerCategory", () => {
    const s = mergeDocumentsWorkspaceQuery({
      currentSearch: "foo=1",
      mode: "register-only",
      focus: "certificate",
    });
    const q = new URLSearchParams(s);
    expect(q.get("foo")).toBe("1");
    expect(q.get(SRM_REGISTER_CATEGORY_QUERY)).toBe("certificate");
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
