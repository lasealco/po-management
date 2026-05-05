import { describe, expect, it } from "vitest";

import {
  findFirstMatchingRmaDispositionRuleBf85,
  haystackForRmaDispositionRuleBf85,
  normalizeBf85MatchText,
  ruleMatchesBf85Pattern,
} from "./rma-disposition-rules-bf85";

describe("rma-disposition-rules-bf85", () => {
  it("normalizes case and trim", () => {
    expect(normalizeBf85MatchText("  Foo ")).toBe("foo");
  });

  it("matches EXACT / PREFIX / CONTAINS", () => {
    expect(ruleMatchesBf85Pattern("EXACT", "ab", "ab")).toBe(true);
    expect(ruleMatchesBf85Pattern("EXACT", "ab", "abc")).toBe(false);
    expect(ruleMatchesBf85Pattern("PREFIX", "ab", "abc")).toBe(true);
    expect(ruleMatchesBf85Pattern("CONTAINS", "b", "abc")).toBe(true);
    expect(ruleMatchesBf85Pattern("CONTAINS", "", "abc")).toBe(false);
  });

  it("selects haystack by field", () => {
    const ctx = {
      orderLineDescription: "Damaged lens — customer fault",
      productSku: "SKU-1",
      productCode: "PC-A",
      shipmentRmaReference: "RMA-99",
    };
    expect(haystackForRmaDispositionRuleBf85("ORDER_LINE_DESCRIPTION", ctx)).toContain("lens");
    expect(haystackForRmaDispositionRuleBf85("PRODUCT_SKU", ctx)).toBe("SKU-1");
    expect(haystackForRmaDispositionRuleBf85("PRODUCT_CODE", ctx)).toBe("PC-A");
    expect(haystackForRmaDispositionRuleBf85("SHIPMENT_RMA_REFERENCE", ctx)).toBe("RMA-99");
  });

  it("first match wins by priority then id", () => {
    const rules = [
      {
        id: "b",
        priority: 10,
        matchField: "ORDER_LINE_DESCRIPTION" as const,
        matchMode: "CONTAINS" as const,
        pattern: "bad",
        applyDisposition: "SCRAP" as const,
        receivingDispositionTemplateId: null,
      },
      {
        id: "a",
        priority: 10,
        matchField: "ORDER_LINE_DESCRIPTION" as const,
        matchMode: "CONTAINS" as const,
        pattern: "bad",
        applyDisposition: "RESTOCK" as const,
        receivingDispositionTemplateId: null,
      },
      {
        id: "c",
        priority: 20,
        matchField: "ORDER_LINE_DESCRIPTION" as const,
        matchMode: "CONTAINS" as const,
        pattern: "bad",
        applyDisposition: "QUARANTINE" as const,
        receivingDispositionTemplateId: null,
      },
    ];
    const ctx = {
      orderLineDescription: "bad batch",
      productSku: null,
      productCode: null,
      shipmentRmaReference: null,
    };
    const hit = findFirstMatchingRmaDispositionRuleBf85(rules, ctx);
    expect(hit?.id).toBe("a");
  });

  it("lower priority number runs before higher", () => {
    const rules = [
      {
        id: "late",
        priority: 50,
        matchField: "ORDER_LINE_DESCRIPTION" as const,
        matchMode: "CONTAINS" as const,
        pattern: "x",
        applyDisposition: "RESTOCK" as const,
        receivingDispositionTemplateId: null,
      },
      {
        id: "early",
        priority: 5,
        matchField: "ORDER_LINE_DESCRIPTION" as const,
        matchMode: "CONTAINS" as const,
        pattern: "x",
        applyDisposition: "SCRAP" as const,
        receivingDispositionTemplateId: null,
      },
    ];
    const hit = findFirstMatchingRmaDispositionRuleBf85(rules, {
      orderLineDescription: "xx",
      productSku: null,
      productCode: null,
      shipmentRmaReference: null,
    });
    expect(hit?.id).toBe("early");
  });
});
