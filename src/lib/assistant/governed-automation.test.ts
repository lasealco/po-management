import { describe, expect, it } from "vitest";

import {
  computeAutomationReadiness,
  defaultRollbackPlan,
  parseAssistantAutomationPolicyStatus,
} from "./governed-automation";

describe("governed automation helpers", () => {
  it("parses policy statuses", () => {
    expect(parseAssistantAutomationPolicyStatus("enabled")).toBe("ENABLED");
    expect(parseAssistantAutomationPolicyStatus("auto")).toBeNull();
  });

  it("requires all guardrails before enablement", () => {
    const ready = computeAutomationReadiness({
      recentCount: 10,
      completedCount: 9,
      rejectedCount: 0,
      shadowRunCount: 10,
      shadowMatchCount: 9,
      evidenceCoveragePct: 90,
      releaseGatePassed: true,
    });
    expect(ready.canEnable).toBe(true);

    const blocked = computeAutomationReadiness({
      recentCount: 10,
      completedCount: 9,
      rejectedCount: 0,
      shadowRunCount: 10,
      shadowMatchCount: 9,
      evidenceCoveragePct: 90,
      releaseGatePassed: false,
    });
    expect(blocked.canEnable).toBe(false);
  });

  it("builds a rollback plan", () => {
    expect(defaultRollbackPlan("copy_text")).toContain("Pause policy");
  });
});
