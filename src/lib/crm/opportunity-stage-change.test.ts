import { describe, expect, it } from "vitest";

import {
  buildInvalidStageMessage,
  isCrmOpportunityStage,
  validateOpportunityStageChange,
} from "./opportunity-stage-change";

describe("isCrmOpportunityStage", () => {
  it("accepts known stages", () => {
    expect(isCrmOpportunityStage("IDENTIFIED")).toBe(true);
    expect(isCrmOpportunityStage("WON_LIVE")).toBe(true);
  });

  it("rejects unknown stages", () => {
    expect(isCrmOpportunityStage("INVALID_STAGE")).toBe(false);
  });
});

describe("buildInvalidStageMessage", () => {
  it("includes the bad value and allowed values", () => {
    const message = buildInvalidStageMessage("BAD_STAGE");
    expect(message).toContain("BAD_STAGE");
    expect(message).toContain("IDENTIFIED");
    expect(message).toContain("ON_HOLD");
  });
});

describe("validateOpportunityStageChange", () => {
  it("allows normal transitions from non-terminal stages", () => {
    expect(validateOpportunityStageChange("DISCOVERY", "NEGOTIATION")).toEqual({ ok: true });
  });

  it("allows no-op stage updates", () => {
    expect(validateOpportunityStageChange("LOST", "LOST")).toEqual({ ok: true });
  });

  it("allows reopening terminal stages only through ON_HOLD", () => {
    expect(validateOpportunityStageChange("LOST", "ON_HOLD")).toEqual({ ok: true });
    expect(validateOpportunityStageChange("WON_LIVE", "ON_HOLD")).toEqual({ ok: true });
  });

  it("rejects direct transitions away from LOST", () => {
    expect(validateOpportunityStageChange("LOST", "NEGOTIATION")).toEqual({
      ok: false,
      error: "Cannot move an opportunity out of LOST directly. Move it to ON_HOLD first.",
    });
  });

  it("rejects direct transitions away from WON_LIVE", () => {
    expect(validateOpportunityStageChange("WON_LIVE", "QUALIFIED")).toEqual({
      ok: false,
      error: "Cannot move an opportunity out of WON_LIVE directly. Move it to ON_HOLD first.",
    });
  });
});
