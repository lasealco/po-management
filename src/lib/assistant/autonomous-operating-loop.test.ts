import { describe, expect, it } from "vitest";

import {
  buildActPlan,
  buildAutonomousOperatingLoop,
  buildDecisionPlan,
  buildLearnPlan,
  buildObserveSnapshot,
  buildPolicyEnvelope,
  buildRollbackPlan,
  type LoopInputs,
} from "./autonomous-operating-loop";

const inputs: LoopInputs = {
  signals: [
    { id: "action-1", sourceType: "ACTION", domain: "shipment", severity: "HIGH", status: "PENDING", detail: "Shipment recovery pending." },
    { id: "audit-1", sourceType: "AUDIT", domain: "invoice", severity: "HIGH", status: "not_helpful", detail: "Weak finance answer." },
    { id: "value-1", sourceType: "VALUE", domain: "value_realization", severity: "LOW", status: "DRAFT", detail: "Positive value signal." },
    { id: "gate-1", sourceType: "RELEASE_GATE", domain: "release_gate", severity: "CRITICAL", status: "BLOCKED", detail: "Gate blocked." },
  ],
  policies: [
    { id: "policy-1", actionKind: "shipment_recovery", status: "ENABLED", readinessScore: 70, threshold: 80, rollbackPlan: "Pause shipment recovery automation." },
    { id: "policy-2", actionKind: "invoice_review", status: "SHADOW", readinessScore: 85, threshold: 80, rollbackPlan: null },
  ],
  shadowRuns: [
    { actionKind: "shipment_recovery", matched: false, runMode: "SHADOW" },
    { actionKind: "invoice_review", matched: true, runMode: "SHADOW" },
  ],
  releaseGate: { status: "BLOCKED", score: 60, threshold: 75 },
  killSwitchActive: false,
};

describe("assistant autonomous operating loop helpers", () => {
  it("observes signals and identifies anomalies by domain", () => {
    const observe = buildObserveSnapshot(inputs);

    expect(observe.signalCount).toBe(4);
    expect(observe.anomalyCount).toBe(3);
    expect(observe.byDomain.shipment).toMatchObject({ count: 1, maxSeverity: "HIGH" });
  });

  it("decides recovery versus monitor actions from observed severity", () => {
    const decisions = buildDecisionPlan(inputs);

    expect(decisions.decisions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ domain: "shipment", decision: "ESCALATE_AND_PROPOSE_RECOVERY" }),
        expect.objectContaining({ domain: "value_realization", decision: "MONITOR_AND_LEARN" }),
      ]),
    );
  });

  it("keeps automation review-only when gates or policies are unsafe", () => {
    const policy = buildPolicyEnvelope(inputs);
    const act = buildActPlan(inputs, buildDecisionPlan(inputs), policy);

    expect(policy.automationMode).toBe("REVIEW_ONLY");
    expect(policy.blockedReasons).toEqual(expect.arrayContaining(["Release gate is not passed.", "1 enabled policy below readiness threshold."]));
    expect(act.proposedActions.every((action) => action.executionMode === "REVIEW_ONLY")).toBe(true);
  });

  it("captures learning and rollback steps", () => {
    const learn = buildLearnPlan(inputs);
    const rollback = buildRollbackPlan(inputs);

    expect(learn.learnings.map((item) => item.type)).toEqual(expect.arrayContaining(["FEEDBACK_CORRECTION", "SHADOW_MISMATCH", "VALUE_PATTERN"]));
    expect(rollback.steps).toContain("Pause shipment recovery automation.");
  });

  it("builds a governed loop packet without executing automation", () => {
    const loop = buildAutonomousOperatingLoop(inputs);

    expect(loop.automationMode).toBe("REVIEW_ONLY");
    expect(loop.proposedActionCount).toBeGreaterThan(0);
    expect(loop.approvedAutomationCount).toBe(0);
    expect(loop.leadershipSummary).toContain("does not mutate source systems");
  });
});
