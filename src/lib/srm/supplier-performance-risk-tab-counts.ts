/**
 * Lightweight tab hints for SRM 360 (foundation scope only — no rollups or trends).
 */

export function countNonClosedSupplierRiskRecords(
  rows: ReadonlyArray<{ status: string }>,
): number {
  return rows.filter((r) => r.status !== "closed").length;
}

/** Period row exists but neither core metric is set yet (buyer should complete the row). */
export function countScorecardsMissingCoreMetrics(
  rows: ReadonlyArray<{
    onTimeDeliveryPct: string | null;
    qualityRating: number | null;
  }>,
): number {
  return rows.filter((r) => r.onTimeDeliveryPct == null && r.qualityRating == null).length;
}
