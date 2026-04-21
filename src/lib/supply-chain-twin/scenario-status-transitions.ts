import type { TwinScenarioDraftPatchStatus } from "@/lib/supply-chain-twin/schemas/twin-scenario-draft-patch";

export const TWIN_SCENARIO_STATUS_TRANSITION_MAP = {
  draft: ["draft", "archived"],
  archived: ["*"],
} as const;

/**
 * Returns whether status transition is allowed for scenario lifecycle updates.
 * `archived` is always allowed as a terminal sink for legacy and current states.
 */
export function canTransitionTwinScenarioStatus(
  current: string,
  next: TwinScenarioDraftPatchStatus,
): boolean {
  const allowed = TWIN_SCENARIO_STATUS_TRANSITION_MAP[next] as readonly string[];
  return allowed.includes("*") || allowed.includes(current as "draft" | "archived");
}

export function getTwinScenarioStatusTransitionError(
  current: string,
  next: TwinScenarioDraftPatchStatus,
): string | null {
  if (canTransitionTwinScenarioStatus(current, next)) {
    return null;
  }
  return "Cannot set status to draft unless the scenario is archived or already draft.";
}
