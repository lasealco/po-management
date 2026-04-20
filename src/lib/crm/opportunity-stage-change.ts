import type { CrmOpportunityStage } from "@prisma/client";

export const CRM_OPPORTUNITY_STAGES: readonly CrmOpportunityStage[] = [
  "IDENTIFIED",
  "QUALIFIED",
  "DISCOVERY",
  "SOLUTION_DESIGN",
  "PROPOSAL_SUBMITTED",
  "NEGOTIATION",
  "VERBAL_AGREEMENT",
  "WON_IMPLEMENTATION_PENDING",
  "WON_LIVE",
  "LOST",
  "ON_HOLD",
];

type StageValidationResult =
  | { ok: true }
  | {
      ok: false;
      error: string;
    };

const CLOSABLE_STAGES = new Set<CrmOpportunityStage>(["WON_LIVE", "LOST"]);

export function isCrmOpportunityStage(value: string): value is CrmOpportunityStage {
  return CRM_OPPORTUNITY_STAGES.includes(value as CrmOpportunityStage);
}

export function buildInvalidStageMessage(value: string): string {
  return `Invalid stage '${value}'. Expected one of: ${CRM_OPPORTUNITY_STAGES.join(", ")}.`;
}

export function validateOpportunityStageChange(
  currentStage: CrmOpportunityStage,
  requestedStage: CrmOpportunityStage,
): StageValidationResult {
  if (currentStage === requestedStage) {
    return { ok: true };
  }

  if (!CLOSABLE_STAGES.has(currentStage)) {
    return { ok: true };
  }

  if (requestedStage === "ON_HOLD") {
    return { ok: true };
  }

  return {
    ok: false,
    error:
      currentStage === "WON_LIVE"
        ? "Cannot move an opportunity out of WON_LIVE directly. Move it to ON_HOLD first."
        : "Cannot move an opportunity out of LOST directly. Move it to ON_HOLD first.",
  };
}
