import { describe, expect, it } from "vitest";

import { applyApiHubMappingRules, applyApiHubMappingRulesBatch } from "./mapping-engine";

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

describe("applyApiHubMappingRulesBatch", () => {
  it("applies identical rule set across records", () => {
    const out = applyApiHubMappingRulesBatch(
      [{ v: "a" }, { v: "b" }],
      [{ targetField: "upperV", sourcePath: "v", transform: "upper" }],
    );
    expect(out.map((x) => x.mapped.upperV)).toEqual(["A", "B"]);
  });
});
