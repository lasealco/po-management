import { describe, expect, it } from "vitest";

import { importAssistantConfidenceForRule } from "./import-assistant-rule-confidence";

describe("importAssistantConfidenceForRule", () => {
  it("flags identity as needs_confirmation without inference note", () => {
    const c = importAssistantConfidenceForRule(
      { sourcePath: "a", targetField: "a", transform: "identity", required: false },
      [],
    );
    expect(c).toBe("needs_confirmation");
  });

  it("high confidence for inferred number", () => {
    const c = importAssistantConfidenceForRule(
      { sourcePath: "totals.amount", targetField: "totals_amount", transform: "number", required: true },
      ["totals.amount: Inferred number transform from string/numeric samples."],
    );
    expect(c).toBe("high");
  });

  it("high for currency transform", () => {
    const c = importAssistantConfidenceForRule(
      { sourcePath: "x", targetField: "x", transform: "currency", required: false },
      [],
    );
    expect(c).toBe("high");
  });
});
