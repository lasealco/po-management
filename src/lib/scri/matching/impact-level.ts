/** Human-readable impact for R2 rows (aligned with `ScriEventAffectedEntity.impactLevel`). */
export function scriImpactLevelLabel(level: string | null | undefined): string | null {
  switch (level) {
    case "HIGH":
      return "High impact";
    case "MEDIUM":
      return "Medium impact";
    case "LOW":
      return "Low impact";
    default:
      return null;
  }
}

/** UI / API tier: tentative matches need clearer review (low score or region-only heuristics). */
export function scriMatchTier(
  matchConfidence: number,
  matchType: string,
): "CONFIRMED" | "TENTATIVE" {
  if (matchConfidence < 55) return "TENTATIVE";
  if (matchType.includes("REGION")) return "TENTATIVE";
  return "CONFIRMED";
}
