import type { TwinRiskSeverity } from "@prisma/client";

const RANK: Record<TwinRiskSeverity, number> = {
  INFO: 0,
  LOW: 1,
  MEDIUM: 2,
  HIGH: 3,
  CRITICAL: 4,
};

export function scriSeverityGte(a: TwinRiskSeverity, min: TwinRiskSeverity): boolean {
  return RANK[a] >= RANK[min];
}
