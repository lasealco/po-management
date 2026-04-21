import { describe, expect, it } from "vitest";

import {
  applyApiHubMappingRules,
  applyApiHubMappingRulesBatch,
  validateApiHubMappingRulesInput,
  validateApiHubMappingSourcePathSyntax,
} from "./mapping-engine";

describe("applyApiHubMappingRules", () => {
  it("maps nested source paths with deterministic transforms", () => {
    const result = applyApiHubMappingRules(
      {
        shipment: { id: " sh-1 " },
        totals: { amount: "42.5" },
        events: [{ date: "2026-05-01" }],
      },
      [
        { targetField: "shipmentId", sourcePath: "shipment.id", transform: "trim", required: true },
        { targetField: "amount", sourcePath: "totals.amount", transform: "number", required: true },
        { targetField: "eventDate", sourcePath: "events[0].date", transform: "iso_date" },
      ],
    );

    expect(result.issues).toEqual([]);
    expect(result.mapped).toEqual({
      shipmentId: "sh-1",
      amount: 42.5,
      eventDate: "2026-05-01T00:00:00.000Z",
    });
  });

  it("emits issues for missing required and invalid transform inputs", () => {
    const result = applyApiHubMappingRules(
      { shipment: { amount: "NaN?" } },
      [
        { targetField: "shipmentId", sourcePath: "shipment.id", required: true },
        { targetField: "amount", sourcePath: "shipment.amount", transform: "number" },
      ],
    );

    expect(result.issues).toEqual([
      {
        field: "shipmentId",
        code: "MISSING_REQUIRED",
        message: "Required source value missing at path 'shipment.id'.",
      },
      {
        field: "amount",
        code: "INVALID_NUMBER",
        message: "Value cannot be converted to number.",
      },
    ]);
  });
});

describe("validateApiHubMappingSourcePathSyntax", () => {
  it("accepts dotted paths and numeric bracket segments", () => {
    expect(validateApiHubMappingSourcePathSyntax("shipment.id")).toBeNull();
    expect(validateApiHubMappingSourcePathSyntax("events[0].date")).toBeNull();
    expect(validateApiHubMappingSourcePathSyntax("foo-bar.baz_1")).toBeNull();
  });

  it("rejects empty segments and illegal characters", () => {
    expect(validateApiHubMappingSourcePathSyntax("a..b")).not.toBeNull();
    expect(validateApiHubMappingSourcePathSyntax(".a")).not.toBeNull();
    expect(validateApiHubMappingSourcePathSyntax("a.")).not.toBeNull();
    expect(validateApiHubMappingSourcePathSyntax("a b.c")).not.toBeNull();
    expect(validateApiHubMappingSourcePathSyntax("a[xy].c")).not.toBeNull();
  });
});

describe("validateApiHubMappingRulesInput", () => {
  it("flags duplicate targetField across rules", () => {
    const issues = validateApiHubMappingRulesInput([
      { sourcePath: "a", targetField: "id" },
      { sourcePath: "b", targetField: "id" },
    ]);
    expect(issues.some((i) => i.code === "DUPLICATE_TARGET" && i.field === "rules[1].targetField")).toBe(true);
  });

  it("flags invalid sourcePath when non-empty", () => {
    const issues = validateApiHubMappingRulesInput([{ sourcePath: "bad..path", targetField: "x" }]);
    expect(issues.some((i) => i.code === "INVALID_SOURCE_PATH")).toBe(true);
  });
});

describe("applyApiHubMappingRulesBatch", () => {
  it("applies identical rule set across records", () => {
    const out = applyApiHubMappingRulesBatch(
      [{ v: "a" }, { v: "b" }],
      [{ targetField: "upperV", sourcePath: "v", transform: "upper" }],
    );
    expect(out.map((x) => x.mapped.upperV)).toEqual(["A", "B"]);
  });
});
