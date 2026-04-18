/**
 * Shared rules for when Step 2 — Finance review may be saved (UI + docs/tests stay aligned with
 * `setInvoiceIntakeReview`, which only accepts `status === "AUDITED"`).
 */
export type FinanceReviewEligibilityInput = {
  status: string;
  /** When set (e.g. FAILED audit engine on intake), takes precedence over the default non-AUDITED copy. */
  disabledReason?: string | null;
};

/** Matches server-side `setInvoiceIntakeReview` gate (AUDITED only). */
export function canRecordFinanceReview(input: FinanceReviewEligibilityInput): boolean {
  return !input.disabledReason?.trim() && input.status === "AUDITED";
}

/**
 * Human-facing explanation when the form is blocked; `null` when {@link canRecordFinanceReview} is true.
 */
export function financeReviewBlockedExplanation(input: FinanceReviewEligibilityInput): string | null {
  const dr = input.disabledReason?.trim();
  if (dr) return dr;
  if (input.status !== "AUDITED") {
    return "Run a successful audit before recording approval or override.";
  }
  return null;
}
