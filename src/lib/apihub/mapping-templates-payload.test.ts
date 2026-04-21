import { describe, expect, it } from "vitest";

import { collectMappingTemplatePatchIssues } from "./mapping-templates-payload";

describe("collectMappingTemplatePatchIssues", () => {
  it("requires at least one of name, description, rules", () => {
    const issues = collectMappingTemplatePatchIssues({ note: "only note" });
    expect(issues.some((i) => i.field === "body" && i.code === "REQUIRED")).toBe(true);
  });

  it("allows description null to clear", () => {
    const issues = collectMappingTemplatePatchIssues({ description: null });
    expect(issues).toHaveLength(0);
  });
});
