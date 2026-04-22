import { describe, expect, it } from "vitest";

import {
  applyApiHubMappingRules,
  applyApiHubMappingRulesBatch,
  tryParseApiHubCurrencyAmount,
  validateApiHubMappingRulesInput,
  validateApiHubMappingSourcePathSyntax,
} from "./mapping-engine";

describe("tryParseApiHubCurrencyAmount", () => {
  it("parses symbols and grouping like apply currency", () => {
    expect(tryParseApiHubCurrencyAmount("$1,234.50")).toBe(1234.5);
    expect(tryParseApiHubCurrencyAmount("€ 10")).toBe(10);
    expect(tryParseApiHubCurrencyAmount(42)).toBe(42);
  });

  it("returns null for non-amounts", () => {
    expect(tryParseApiHubCurrencyAmount("nope")).toBeNull();
    expect(tryParseApiHubCurrencyAmount("")).toBeNull();
  });
});

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

  it("maps boolean transform deterministically", () => {
    expect(
      applyApiHubMappingRules({ a: true }, [{ targetField: "x", sourcePath: "a", transform: "boolean" }]).mapped,
    ).toEqual({ x: true });
    expect(
      applyApiHubMappingRules({ b: "NO" }, [{ targetField: "x", sourcePath: "b", transform: "boolean" }]).mapped,
    ).toEqual({ x: false });
    expect(
      applyApiHubMappingRules({ c: 1 }, [{ targetField: "x", sourcePath: "c", transform: "boolean" }]).mapped,
    ).toEqual({ x: true });
    const bad = applyApiHubMappingRules({ b: "maybe" }, [{ targetField: "x", sourcePath: "b", transform: "boolean" }]);
    expect(bad.mapped.x).toBeNull();
    expect(bad.issues[0]?.code).toBe("INVALID_BOOLEAN");
    expect(bad.issues[0]?.severity).toBe("error");
  });

  it("maps currency transform with US-style grouping", () => {
    const r = applyApiHubMappingRules(
      { a: "$1,234.50", b: 99.1, c: "€ 10" },
      [
        { targetField: "x", sourcePath: "a", transform: "currency" },
        { targetField: "y", sourcePath: "b", transform: "currency" },
        { targetField: "z", sourcePath: "c", transform: "currency" },
      ],
    );
    expect(r.issues).toEqual([]);
    expect(r.mapped).toEqual({ x: 1234.5, y: 99.1, z: 10 });
  });

  it("emits INVALID_CURRENCY for non-parsable amounts", () => {
    const r = applyApiHubMappingRules({ a: "not-a-number" }, [{ targetField: "x", sourcePath: "a", transform: "currency" }]);
    expect(r.issues[0]?.code).toBe("INVALID_CURRENCY");
    expect(r.issues[0]?.severity).toBe("error");
    expect(r.mapped.x).toBeNull();
  });

  it("emits warn when string transforms receive a non-string", () => {
    const r = applyApiHubMappingRules({ n: 7 }, [{ targetField: "t", sourcePath: "n", transform: "trim" }]);
    expect(r.mapped.t).toBe(7);
    expect(r.issues).toEqual([
      {
        field: "t",
        code: "COERCION_NON_STRING",
        message: "trim expected a string; value left unchanged.",
        severity: "warn",
      },
    ]);
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
        severity: "error",
      },
      {
        field: "amount",
        code: "INVALID_NUMBER",
        message: "Value cannot be converted to number.",
        severity: "error",
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
