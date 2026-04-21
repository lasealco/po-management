import { describe, expect, it } from "vitest";

import {
  canTransitionTwinScenarioStatus,
  getTwinScenarioStatusTransitionError,
  TWIN_SCENARIO_STATUS_TRANSITION_MAP,
} from "@/lib/supply-chain-twin/scenario-status-transitions";

describe("scenario status transition map", () => {
  it("exposes central transition map for lifecycle mutators", () => {
    expect(TWIN_SCENARIO_STATUS_TRANSITION_MAP).toEqual({
      draft: ["draft", "archived"],
      archived: ["*"],
    });
  });

  it("allows legal draft transitions", () => {
    expect(canTransitionTwinScenarioStatus("draft", "draft")).toBe(true);
    expect(canTransitionTwinScenarioStatus("archived", "draft")).toBe(true);
    expect(canTransitionTwinScenarioStatus("draft", "archived")).toBe(true);
  });

  it("rejects illegal transition back to draft from other statuses", () => {
    expect(canTransitionTwinScenarioStatus("published", "draft")).toBe(false);
    expect(getTwinScenarioStatusTransitionError("published", "draft")).toBe(
      "Cannot set status to draft unless the scenario is archived or already draft.",
    );
  });

  it("allows archived as terminal sink from unknown legacy statuses", () => {
    expect(canTransitionTwinScenarioStatus("published", "archived")).toBe(true);
    expect(getTwinScenarioStatusTransitionError("published", "archived")).toBeNull();
  });
});
