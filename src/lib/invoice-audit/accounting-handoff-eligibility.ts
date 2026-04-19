/**
 * Shared rules for when Step 3 — Accounting handoff may be saved (aligned with
 * `setInvoiceIntakeAccountingHandoff`: AUDITED, finance decision not NONE).
 */
export type AccountingHandoffEligibilityInput = {
  status: string;
  reviewDecision: string;
  /** When set (e.g. FAILED audit on intake), overrides default non-ready copy. */
  disabledReason?: string | null;
};

function financeReviewRecorded(reviewDecision: string): boolean {
  return reviewDecision === "APPROVED" || reviewDecision === "OVERRIDDEN";
}

/** Matches server-side `setInvoiceIntakeAccountingHandoff` readiness (plus optional UI barrier). */
export function canRecordAccountingHandoff(input: AccountingHandoffEligibilityInput): boolean {
  return (
    !input.disabledReason?.trim() &&
    input.status === "AUDITED" &&
    financeReviewRecorded(input.reviewDecision)
  );
}

/**
 * Human-facing explanation when the handoff actions are blocked; `null` when
 * {@link canRecordAccountingHandoff} is true (excluding edit-access; pass view-only as `disabledReason` from UI).
 */
export function accountingHandoffBlockedExplanation(input: AccountingHandoffEligibilityInput): string | null {
  const dr = input.disabledReason?.trim();
  if (dr) return dr;
  if (!financeReviewRecorded(input.reviewDecision)) {
    return "Save Step 2 — Finance review as Approve or Override before marking ready for accounting.";
  }
  if (input.status !== "AUDITED") {
    return "Run a successful audit before accounting handoff.";
  }
  return null;
}
