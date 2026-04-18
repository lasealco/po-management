export type ComplianceReviewDueState = "overdue" | "due_soon" | null;

const DEFAULT_SOON_MS = 14 * 86400000;

/**
 * UI hint from `nextReviewDue` on the latest compliance review (periodic review discipline — not automation).
 */
export function complianceReviewDueState(
  nextReviewDueIso: string | null,
  nowMs: number = Date.now(),
  soonMs: number = DEFAULT_SOON_MS,
): ComplianceReviewDueState {
  if (!nextReviewDueIso) return null;
  const t = new Date(nextReviewDueIso).getTime();
  if (Number.isNaN(t)) return null;
  if (t < nowMs) return "overdue";
  if (t - nowMs <= soonMs) return "due_soon";
  return null;
}
