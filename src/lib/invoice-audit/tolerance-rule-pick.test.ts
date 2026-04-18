import { describe, expect, it } from "vitest";

import { pickToleranceRuleFromOrderedActiveRules } from "@/lib/invoice-audit/tolerance-rule-pick";

function rule(
  id: string,
  priority: number,
  currencyScope: string | null,
): Parameters<typeof pickToleranceRuleFromOrderedActiveRules>[0][number] {
  return {
    id,
    tenantId: "t1",
    name: id,
    priority,
    active: true,
    amountAbsTolerance: null,
    percentTolerance: null,
    currencyScope,
    categoryScope: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

describe("pickToleranceRuleFromOrderedActiveRules", () => {
  it("prefers currency-scoped rule over higher-priority global", () => {
    const picked = pickToleranceRuleFromOrderedActiveRules(
      [rule("global", 100, null), rule("usd", 1, "USD")],
      "usd",
    );
    expect(picked?.id).toBe("usd");
  });

  it("falls back to global when no scope matches", () => {
    const picked = pickToleranceRuleFromOrderedActiveRules(
      [rule("eur", 99, "EUR"), rule("global", 10, null)],
      "USD",
    );
    expect(picked?.id).toBe("global");
  });

  it("returns null for an empty list", () => {
    expect(pickToleranceRuleFromOrderedActiveRules([], "USD")).toBeNull();
  });

  it("when no global and no scope match, uses first rule in priority order (legacy behavior)", () => {
    const picked = pickToleranceRuleFromOrderedActiveRules(
      [rule("eur-high", 100, "EUR"), rule("gbp-low", 50, "GBP")],
      "USD",
    );
    expect(picked?.id).toBe("eur-high");
  });
});
