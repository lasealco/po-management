import type { InvoiceToleranceRule } from "@prisma/client";

/**
 * Chooses which active tolerance rule applies to an intake currency, given rules already
 * sorted by priority descending (same contract as `pickToleranceRuleForIntake`).
 */
export function pickToleranceRuleFromOrderedActiveRules(
  rulesOrderedDesc: InvoiceToleranceRule[],
  currency: string,
): InvoiceToleranceRule | null {
  if (rulesOrderedDesc.length === 0) return null;
  const cur = currency.toUpperCase().slice(0, 3);
  const scoped = rulesOrderedDesc.find((r) => r.currencyScope && r.currencyScope.toUpperCase() === cur);
  if (scoped) return scoped;
  const global = rulesOrderedDesc.find((r) => !r.currencyScope);
  return global ?? rulesOrderedDesc[0] ?? null;
}
