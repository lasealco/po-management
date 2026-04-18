/** Stable keys stored in `audit_results.discrepancyCategories` (JSON string array). */
export const DISCREPANCY_CATEGORY = {
  AMOUNT_MATCH_WITHIN_TOLERANCE: "AMOUNT_MATCH_WITHIN_TOLERANCE",
  AMOUNT_MINOR_DISCREPANCY: "AMOUNT_MINOR_DISCREPANCY",
  AMOUNT_MAJOR_DISCREPANCY: "AMOUNT_MAJOR_DISCREPANCY",
  NO_SNAPSHOT_LINE_MATCH: "NO_SNAPSHOT_LINE_MATCH",
  CURRENCY_MISMATCH: "CURRENCY_MISMATCH",
  AMBIGUOUS_SNAPSHOT_MATCH: "AMBIGUOUS_SNAPSHOT_MATCH",
  SNAPSHOT_PARSE_ERROR: "SNAPSHOT_PARSE_ERROR",
  /** Invoice equipment / snapshot equipment conflict — no eligible rate bucket. */
  EQUIPMENT_MISMATCH: "EQUIPMENT_MISMATCH",
  /** POL/POD or geography scope does not align with intake ports (soft or hard). */
  GEO_SCOPE_MISMATCH: "GEO_SCOPE_MISMATCH",
  /** Unit basis differs between invoice line and matched snapshot line. */
  UNIT_BASIS_MISMATCH: "UNIT_BASIS_MISMATCH",
  /** Matched using all-in basket vs separated snapshot (or RFQ total). */
  ALL_IN_BASKET_MATCH: "ALL_IN_BASKET_MATCH",
  ALL_IN_BASKET_MINOR_VARIANCE: "ALL_IN_BASKET_MINOR_VARIANCE",
  ALL_IN_BASKET_MAJOR_VARIANCE: "ALL_IN_BASKET_MAJOR_VARIANCE",
  /** Top candidate score below confidence floor — not enough evidence to pick a line. */
  MATCH_CONFIDENCE_LOW: "MATCH_CONFIDENCE_LOW",
  /** Clear best line but tie-breaker used secondary signals (equipment/geo/unit). */
  MATCH_RESOLVED_WITH_WARNINGS: "MATCH_RESOLVED_WITH_WARNINGS",
} as const;

export type DiscrepancyCategoryKey = (typeof DISCREPANCY_CATEGORY)[keyof typeof DISCREPANCY_CATEGORY];

/** Short labels for intake-level rollup / demos (keys still stored verbatim on audit rows). */
const CATEGORY_LABELS: Record<string, string> = {
  [DISCREPANCY_CATEGORY.AMOUNT_MATCH_WITHIN_TOLERANCE]: "Amount within tolerance",
  [DISCREPANCY_CATEGORY.AMOUNT_MINOR_DISCREPANCY]: "Amount — minor vs snapshot",
  [DISCREPANCY_CATEGORY.AMOUNT_MAJOR_DISCREPANCY]: "Amount — major vs snapshot",
  [DISCREPANCY_CATEGORY.NO_SNAPSHOT_LINE_MATCH]: "No confident snapshot line",
  [DISCREPANCY_CATEGORY.CURRENCY_MISMATCH]: "Currency mismatch",
  [DISCREPANCY_CATEGORY.AMBIGUOUS_SNAPSHOT_MATCH]: "Ambiguous snapshot match",
  [DISCREPANCY_CATEGORY.SNAPSHOT_PARSE_ERROR]: "Snapshot parse error",
  [DISCREPANCY_CATEGORY.EQUIPMENT_MISMATCH]: "Equipment mismatch",
  [DISCREPANCY_CATEGORY.GEO_SCOPE_MISMATCH]: "Geography / POL-POD mismatch",
  [DISCREPANCY_CATEGORY.UNIT_BASIS_MISMATCH]: "Unit basis mismatch",
  [DISCREPANCY_CATEGORY.ALL_IN_BASKET_MATCH]: "All-in basket match",
  [DISCREPANCY_CATEGORY.ALL_IN_BASKET_MINOR_VARIANCE]: "All-in basket — minor variance",
  [DISCREPANCY_CATEGORY.ALL_IN_BASKET_MAJOR_VARIANCE]: "All-in basket — major variance",
  [DISCREPANCY_CATEGORY.MATCH_CONFIDENCE_LOW]: "Low match confidence",
  [DISCREPANCY_CATEGORY.MATCH_RESOLVED_WITH_WARNINGS]: "Match with soft warnings",
};

export function formatDiscrepancyCategoryLabel(key: string): string {
  if (CATEGORY_LABELS[key]) return CATEGORY_LABELS[key]!;
  return key.replace(/_/g, " ").toLowerCase();
}
