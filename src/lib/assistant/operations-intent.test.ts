import { describe, expect, it } from "vitest";

import { extractProductQueryHint, isOperationsQuestion } from "./operations-intent";

describe("isOperationsQuestion", () => {
  it("treats stock and inventory questions as operations", () => {
    expect(isOperationsQuestion("How much corr-roll is in stock?")).toBe(true);
    expect(isOperationsQuestion("Do we have PKG-CORR-ROLL in the warehouse?")).toBe(true);
    expect(isOperationsQuestion("What is the inventory of SKU-1 for demo warehouse?")).toBe(true);
  });

  it("treats live order / pricing scenarios as sales, not operations", () => {
    expect(
      isOperationsQuestion(
        "John from ABC customer called and wants 100 corr-roll for 100 USD a piece. Pickup tuesday.",
      ),
    ).toBe(false);
  });

  it("treats short trace-style SKU questions as operations", () => {
    expect(isOperationsQuestion("Where is PKG-DEMO-1")).toBe(true);
  });
});

describe("extractProductQueryHint", () => {
  it("extracts from natural phrasing and corr-roll heuristics", () => {
    const h = extractProductQueryHint("How much corr-roll is in the demo warehouse?");
    expect(h.toLowerCase()).toContain("corr");
  });
});
