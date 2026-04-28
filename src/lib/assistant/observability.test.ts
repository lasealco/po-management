import { describe, expect, it } from "vitest";

import {
  buildAutomationRisks,
  buildDegradedMode,
  buildDriftSignals,
  buildFailureSignals,
  buildHealthSnapshot,
  buildObservabilityIncident,
  type ObservabilityInputs,
} from "./observability";

const inputs: ObservabilityInputs = {
  audits: [
    {
      id: "audit-1",
      surface: "assistant_chat",
      answerKind: "context",
      message: "No evidence answer",
      feedback: "not_helpful",
      evidencePresent: false,
      qualityPresent: false,
      objectType: null,
      objectId: null,
      createdAt: "2026-04-28T00:00:00.000Z",
    },
    {
      id: "audit-2",
      surface: "assistant_chat",
      answerKind: "context",
      message: "Weak answer",
      feedback: null,
      evidencePresent: false,
      qualityPresent: false,
      objectType: "shipment",
      objectId: "ship-1",
      createdAt: "2026-04-28T00:01:00.000Z",
    },
    {
      id: "audit-3",
      surface: "assistant_frontline",
      answerKind: "frontline_packet",
      message: "Grounded answer",
      feedback: "helpful",
      evidencePresent: true,
      qualityPresent: true,
      objectType: "assistant_frontline_packet",
      objectId: "packet-1",
      createdAt: "2026-04-28T00:02:00.000Z",
    },
  ],
  actions: [
    { id: "action-1", actionKind: "frontline_review", status: "PENDING", priority: "HIGH", objectType: "shipment", objectId: "ship-1", createdAt: "2026-04-28T00:00:00.000Z" },
    { id: "action-2", actionKind: "frontline_review", status: "REJECTED", priority: "MEDIUM", objectType: "shipment", objectId: "ship-2", createdAt: "2026-04-28T00:00:00.000Z" },
  ],
  automations: [
    { id: "policy-1", actionKind: "frontline_review", status: "ENABLED", readinessScore: 72, threshold: 80, rollbackPlan: "Pause frontline automation." },
  ],
  shadowRuns: [
    { id: "shadow-1", actionKind: "frontline_review", predictedStatus: "DONE", humanStatus: "REJECTED", matched: false, runMode: "SHADOW" },
    { id: "shadow-2", actionKind: "frontline_review", predictedStatus: "DONE", humanStatus: "DONE", matched: true, runMode: "SHADOW" },
  ],
  releaseGate: { status: "BLOCKED", score: 60, threshold: 75 },
};

describe("observability assistant helpers", () => {
  it("computes health metrics from assistant telemetry", () => {
    const health = buildHealthSnapshot(inputs);

    expect(health.auditEventCount).toBe(3);
    expect(health.evidenceCoveragePct).toBe(33);
    expect(health.negativeFeedbackRatePct).toBe(33);
    expect(health.releaseGateStatus).toBe("BLOCKED");
  });

  it("detects failures, drift, and automation risk", () => {
    expect(buildFailureSignals(inputs).map((item) => item.type)).toEqual(expect.arrayContaining(["FEEDBACK_SPIKE", "RELEASE_GATE_BLOCKED"]));
    expect(buildDriftSignals(inputs)[0]).toMatchObject({ surface: "assistant_chat", weakRatePct: 100 });
    expect(buildAutomationRisks(inputs)[0]).toMatchObject({ actionKind: "frontline_review", severity: "HIGH" });
  });

  it("recommends degraded review-only mode when high-risk signals exist", () => {
    const degraded = buildDegradedMode(buildFailureSignals(inputs), buildDriftSignals(inputs), buildAutomationRisks(inputs));

    expect(degraded.status).toBe("DEGRADED_REVIEW_ONLY");
    expect(degraded.allowedActions).not.toContain("run_low_risk_playbooks");
  });

  it("builds an incident with rollback and postmortem without auto-pausing", () => {
    const incident = buildObservabilityIncident(inputs);

    expect(incident.healthScore).toBeLessThan(70);
    expect(incident.severity).toBe("HIGH");
    expect(incident.rollbackPlan.steps).toEqual(expect.arrayContaining(["Pause frontline automation."]));
    expect(incident.postmortem.rootCauseHypotheses).toContain("Evidence coverage below release target.");
    expect(incident.leadershipSummary).toContain("no automation policy is paused automatically");
  });
});
