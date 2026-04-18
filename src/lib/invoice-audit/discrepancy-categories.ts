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
