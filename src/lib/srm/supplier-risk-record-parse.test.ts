import { describe, expect, it } from "vitest";

import { parseRiskRecordCreateBody, parseRiskRecordPatchBody } from "./supplier-risk-record-parse";

describe("parseRiskRecordCreateBody", () => {
  it("requires title and category", () => {
    expect(parseRiskRecordCreateBody({ title: "", category: "x", severity: "low" }).ok).toBe(false);
  });

  it("accepts minimal create", () => {
    const r = parseRiskRecordCreateBody({
      title: "Late shipments",
      category: "Delivery",
      severity: "high",
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data.severity).toBe("high");
  });
});

describe("parseRiskRecordPatchBody", () => {
  it("accepts status", () => {
    const r = parseRiskRecordPatchBody({ status: "closed" });
    expect(r.ok).toBe(true);
  });
});
