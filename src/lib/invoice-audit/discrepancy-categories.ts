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

/** One-line reviewer guidance; raw keys still stored on audit rows. */
const CATEGORY_REVIEW_HINTS: Partial<Record<string, string>> = {
  [DISCREPANCY_CATEGORY.AMOUNT_MATCH_WITHIN_TOLERANCE]:
    "Invoice amount aligns with the matched snapshot charge within the active tolerance band.",
  [DISCREPANCY_CATEGORY.AMOUNT_MINOR_DISCREPANCY]:
    "Difference vs snapshot is material but still inside the warn band — often acceptable commercially.",
  [DISCREPANCY_CATEGORY.AMOUNT_MAJOR_DISCREPANCY]:
    "Difference exceeds the warn band vs the matched snapshot charge — investigate before finance sign-off.",
  [DISCREPANCY_CATEGORY.NO_SNAPSHOT_LINE_MATCH]:
    "Engine could not pick a snapshot line with enough confidence — check labels, equipment, and POL/POD hints.",
  [DISCREPANCY_CATEGORY.CURRENCY_MISMATCH]:
    "Invoice line currency does not match the comparable snapshot currency for this charge.",
  [DISCREPANCY_CATEGORY.AMBIGUOUS_SNAPSHOT_MATCH]:
    "Multiple snapshot candidates scored closely — tie-breakers or manual review may be needed.",
  [DISCREPANCY_CATEGORY.SNAPSHOT_PARSE_ERROR]:
    "Frozen snapshot JSON could not be interpreted for this comparison — fix snapshot data, not the invoice text.",
  [DISCREPANCY_CATEGORY.EQUIPMENT_MISMATCH]:
    "Invoice equipment (e.g. 40HC) does not fit an eligible snapshot rate bucket for this line.",
  [DISCREPANCY_CATEGORY.GEO_SCOPE_MISMATCH]:
    "POL/POD or geography on the invoice does not align with the snapshot rate scope for this match.",
  [DISCREPANCY_CATEGORY.UNIT_BASIS_MISMATCH]:
    "Unit basis (e.g. per container vs per BL) differs between invoice wording and the matched snapshot line.",
  [DISCREPANCY_CATEGORY.ALL_IN_BASKET_MATCH]:
    "All-in basket comparison to snapshot/RFQ basket landed within tolerance.",
  [DISCREPANCY_CATEGORY.ALL_IN_BASKET_MINOR_VARIANCE]:
    "All-in basket total differs slightly from snapshot basket — still in warn band.",
  [DISCREPANCY_CATEGORY.ALL_IN_BASKET_MAJOR_VARIANCE]:
    "All-in basket total differs materially from snapshot basket — outside warn band.",
  [DISCREPANCY_CATEGORY.MATCH_CONFIDENCE_LOW]:
    "Top scoring snapshot candidate was below the confidence floor — treat as UNKNOWN-style triage.",
  [DISCREPANCY_CATEGORY.MATCH_RESOLVED_WITH_WARNINGS]:
    "A best snapshot line was chosen using secondary signals (equipment, geo, unit) — read explanation text.",
};

export function formatDiscrepancyCategoryReviewHint(key: string): string {
  if (CATEGORY_REVIEW_HINTS[key]) return CATEGORY_REVIEW_HINTS[key]!;
  return `Stored key ${key}. Use the line explanation and snapshotMatchedJson for engine detail.`;
}

export type DiscrepancyCategoryTone = "neutral" | "attention" | "critical";

export function discrepancyCategoryTone(key: string): DiscrepancyCategoryTone {
  if (
    key === DISCREPANCY_CATEGORY.AMOUNT_MATCH_WITHIN_TOLERANCE ||
    key === DISCREPANCY_CATEGORY.ALL_IN_BASKET_MATCH
  ) {
    return "neutral";
  }
  if (
    key === DISCREPANCY_CATEGORY.AMOUNT_MAJOR_DISCREPANCY ||
    key === DISCREPANCY_CATEGORY.ALL_IN_BASKET_MAJOR_VARIANCE ||
    key === DISCREPANCY_CATEGORY.NO_SNAPSHOT_LINE_MATCH ||
    key === DISCREPANCY_CATEGORY.CURRENCY_MISMATCH ||
    key === DISCREPANCY_CATEGORY.SNAPSHOT_PARSE_ERROR
  ) {
    return "critical";
  }
  return "attention";
}
