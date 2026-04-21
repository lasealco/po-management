import type { TwinRiskSeverity as PrismaTwinRiskSeverity } from "@prisma/client";

/** Re-export Prisma enum for app code and API DTOs. */
export type TwinRiskSeverity = PrismaTwinRiskSeverity;

/** Runtime ordering for UI / sorts (lowest alert weight first). */
export const TWIN_RISK_SEVERITY_ORDER: readonly TwinRiskSeverity[] = [
  "INFO",
  "LOW",
  "MEDIUM",
  "HIGH",
  "CRITICAL",
] as const;
