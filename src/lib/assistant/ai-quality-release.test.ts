import { describe, expect, it } from "vitest";

import { buildAiQualityReleasePacket, type AiQualityReleaseInputs } from "./ai-quality-release";

const inputs: AiQualityReleaseInputs = {
  audits: [
    { id: "audit-1", surface: "assistant_chat", answerKind: "answer", message: "Weak answer", evidence: null, quality: null, feedback: "not_helpful", objectType: null, objectId: null, createdAt: "2026-04-29T00:00:00.000Z" },
    { id: "audit-2", surface: "assistant_chat", answerKind: "answer", message: "Grounded answer", evidence: [{ label: "Order", href: "/orders/1" }], quality: { score: 90 }, feedback: "helpful", objectType: "order", objectId: "1", createdAt: "2026-04-29T00:05:00.000Z" },
  ],
  reviewExamples: [{ id: "example-1", auditEventId: "audit-1", label: "BAD", status: "QUEUED", correctionNote: "Missing source evidence." }],
  promptLibrary: [
    { id: "prompt-1", title: "Approved", domain: "orders", objectType: "order", status: "APPROVED", usageCount: 3, updatedAt: "2026-04-29T00:00:00.000Z" },
    { id: "prompt-2", title: "Draft", domain: "wms", objectType: "task", status: "DRAFT", usageCount: 0, updatedAt: "2026-04-29T00:00:00.000Z" },
  ],
  releaseGates: [{ id: "gate-1", gateKey: "assistant_release", status: "BLOCKED", score: 60, threshold: 75, notes: "Evidence low", evaluatedAt: "2026-04-29T00:00:00.000Z" }],
  automationPolicies: [{ id: "policy-1", policyKey: "auto-1", actionKind: "approve_low_risk", label: "Approve low risk", status: "ENABLED", readinessScore: 70, threshold: 80, rollbackPlan: null, lastEvaluatedAt: "2026-04-29T00:00:00.000Z" }],
  shadowRuns: [{ id: "shadow-1", actionKind: "approve_low_risk", predictedStatus: "APPROVED", humanStatus: "REJECTED", matched: false, runMode: "SHADOW" }],
  observabilityIncidents: [{ id: "incident-1", title: "Feedback spike", status: "OPEN", severity: "HIGH", healthScore: 55, failureCount: 1, driftSignalCount: 1, evidenceGapCount: 1, automationRiskCount: 1 }],
  agentGovernancePackets: [{ id: "agent-1", title: "Agent governance", status: "DRAFT", governanceScore: 62, uncertifiedToolCount: 1, promptRiskCount: 1, observabilityRiskCount: 1 }],
  advancedProgramPackets: [{ id: "amp-1", ampNumber: 37, title: "Advanced program", status: "DRAFT", score: 60, reviewRiskCount: 1, rollbackStepCount: 0 }],
  actionQueue: [{ id: "action-1", actionKind: "ai_quality_release_review", status: "PENDING", priority: "HIGH", objectType: "assistant_release" }],
};

describe("buildAiQualityReleasePacket", () => {
  it("aggregates eval, grounding, prompt, automation, observability, and release gate risks", () => {
    const packet = buildAiQualityReleasePacket(inputs);

    expect(packet.evaluationSuite.evalCaseCount).toBeGreaterThan(0);
    expect(packet.evaluationSuite.failedEvalCount).toBeGreaterThan(0);
    expect(packet.groundingQuality.weakAnswerCount).toBe(1);
    expect(packet.promptModelChange.promptRiskCount).toBeGreaterThanOrEqual(3);
    expect(packet.automationRegression.automationRiskCount).toBe(1);
    expect(packet.observabilityWatch.openIncidentCount).toBe(1);
    expect(packet.releaseGate.releaseBlockerCount).toBeGreaterThan(0);
    expect(packet.rollbackDrill.rollbackStepCount).toBeGreaterThan(4);
    expect(packet.leadershipSummary).toContain("Sprint 10 AI Quality & Release score");
  });

  it("keeps release execution review-gated", () => {
    const packet = buildAiQualityReleasePacket(inputs);

    expect(packet.evaluationSuite.guardrail).toContain("do not train models");
    expect(packet.groundingQuality.guardrail).toContain("does not rewrite answers");
    expect(packet.promptModelChange.guardrail).toContain("does not publish prompts");
    expect(packet.automationRegression.guardrail).toContain("does not enable");
    expect(packet.observabilityWatch.guardrail).toContain("does not close incidents");
    expect(packet.releaseGate.guardrail).toContain("does not roll out prompts");
    expect(packet.rollbackDrill.guardrail).toContain("do not revert deployments");
    expect(packet.responsePlan.guardrail).toContain("review-only");
  });
});
