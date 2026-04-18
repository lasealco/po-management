import type { SupplierComplianceReviewOutcome } from "@prisma/client";

/** Outcomes that should show the suggested follow-up strip (R1 — narrative + navigation, not a persisted plan). */
export function complianceReviewOutcomeNeedsFollowUp(
  outcome: SupplierComplianceReviewOutcome,
): boolean {
  return outcome === "action_required" || outcome === "failed";
}

/** Value for `<input type="date" />` from stored ISO (UTC date portion; same contract as create form). */
export function complianceReviewNextDueInputValue(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

/**
 * Remount key for uncontrolled summary `<textarea>` after PATCH so `defaultValue` matches server row.
 */
export function complianceReviewSummaryFieldKey(
  id: string,
  summary: string,
  nextDueIso: string | null,
): string {
  let h = 0;
  for (let i = 0; i < summary.length; i++) h = (h * 31 + summary.charCodeAt(i)) | 0;
  return `${id}-sm-${h}-${nextDueIso ?? ""}`;
}
