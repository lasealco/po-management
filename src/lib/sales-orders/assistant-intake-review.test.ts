import { describe, expect, it } from "vitest";

import { parseSalesOrderAssistantLines, parseSalesOrderAssistantReviewStatus } from "./assistant-intake-review";

describe("parseSalesOrderAssistantReviewStatus", () => {
  it("normalizes valid review statuses", () => {
    expect(parseSalesOrderAssistantReviewStatus("approved")).toBe("APPROVED");
    expect(parseSalesOrderAssistantReviewStatus("NEEDS_CHANGES")).toBe("NEEDS_CHANGES");
  });

  it("rejects invalid review statuses", () => {
    expect(parseSalesOrderAssistantReviewStatus("sent")).toBeNull();
    expect(parseSalesOrderAssistantReviewStatus(null)).toBeNull();
  });
});

describe("parseSalesOrderAssistantLines", () => {
  it("parses editable lines", () => {
    const parsed = parseSalesOrderAssistantLines([
      { productId: "p1", description: "Corrugated roll", quantity: "100", unitPrice: "12.5", currency: "usd" },
    ]);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.lines[0]).toMatchObject({
        productId: "p1",
        description: "Corrugated roll",
        quantity: 100,
        unitPrice: 12.5,
        currency: "USD",
      });
    }
  });

  it("rejects invalid quantities", () => {
    const parsed = parseSalesOrderAssistantLines([{ description: "Bad", quantity: 0, unitPrice: 1 }]);
    expect(parsed.ok).toBe(false);
  });
});
