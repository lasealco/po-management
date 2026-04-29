import { describe, expect, it } from "vitest";

import { buildPlatformReliabilityPacket, type PlatformReliabilityInputs } from "./platform-reliability-security";

function sampleInputs(): PlatformReliabilityInputs {
  return {
    nowIso: "2026-04-29T00:00:00.000Z",
    observabilityIncidents: [
      { id: "obs-1", title: "Release gate drift", status: "OPEN", severity: "HIGH", healthScore: 62, failureCount: 2, driftSignalCount: 1, evidenceGapCount: 3, automationRiskCount: 1 },
      { id: "obs-2", title: "Evidence recovery", status: "RESOLVED", severity: "LOW", healthScore: 91, failureCount: 0, driftSignalCount: 0, evidenceGapCount: 0, automationRiskCount: 0 },
    ],
    privacySecurityPackets: [
      { id: "trust-1", title: "Trust packet", status: "DRAFT", trustScore: 67, privacyRiskCount: 2, identityRiskCount: 1, securityExceptionCount: 1, threatSignalCount: 1 },
    ],
    aiQualityReleasePackets: [
      { id: "quality-1", title: "AI release packet", status: "DRAFT", qualityScore: 72, failedEvalCount: 2, automationRiskCount: 1, observabilityRiskCount: 2, releaseBlockerCount: 1 },
    ],
    adminControls: [{ id: "admin-1", controlKey: "assistant-rollout", rolloutMode: "PILOT", packetStatus: "DRAFT", updatedAt: "2026-04-28T00:00:00.000Z" }],
    connectors: [
      { id: "conn-1", name: "ERP orders", sourceKind: "api", authMode: "oauth", authState: "not_configured", status: "draft", lastSyncAt: null, healthSummary: "Auth pending" },
      { id: "conn-2", name: "WMS stock", sourceKind: "api", authMode: "token", authState: "configured", status: "active", lastSyncAt: "2026-04-20T00:00:00.000Z", healthSummary: "Stale sync" },
    ],
    ingestionRuns: [
      { id: "run-1", connectorId: "conn-1", connectorName: "ERP orders", status: "failed", triggerKind: "api", errorCode: "AUTH", errorMessage: "Auth failed", enqueuedAt: "2026-04-28T00:00:00.000Z", finishedAt: "2026-04-28T00:01:00.000Z" },
    ],
    automationPolicies: [
      { id: "policy-1", policyKey: "queue-review", actionKind: "queue_review", label: "Queue review", status: "ENABLED", readinessScore: 70, threshold: 85, rollbackPlan: null, lastEvaluatedAt: null },
      { id: "policy-2", policyKey: "draft-only", actionKind: "draft_answer", label: "Draft answer", status: "SHADOW", readinessScore: 92, threshold: 80, rollbackPlan: "Keep shadow-only.", lastEvaluatedAt: null },
    ],
    shadowRuns: [
      { id: "shadow-1", actionKind: "queue_review", predictedStatus: "APPROVE", humanStatus: "REJECT", matched: false, runMode: "SHADOW" },
      { id: "shadow-2", actionKind: "queue_review", predictedStatus: "APPROVE", humanStatus: "APPROVE", matched: true, runMode: "SHADOW" },
    ],
    auditEvents: [
      { id: "audit-1", surface: "assistant", answerKind: "platform", feedback: "not_helpful", evidencePresent: false, qualityPresent: false, createdAt: "2026-04-28T00:00:00.000Z" },
      { id: "audit-2", surface: "assistant", answerKind: "platform", feedback: "helpful", evidencePresent: true, qualityPresent: false, createdAt: "2026-04-28T00:05:00.000Z" },
    ],
    actionQueue: [
      { id: "action-1", actionKind: "security_review", status: "PENDING", priority: "HIGH", objectType: "assistant_privacy_security_packet" },
      { id: "action-2", actionKind: "connector_retry_review", status: "PENDING", priority: "HIGH", objectType: "apihub_ingestion_run" },
    ],
  };
}

describe("platform reliability and security assistant", () => {
  it("builds a durable platform reliability packet from ops and security evidence", () => {
    const packet = buildPlatformReliabilityPacket(sampleInputs());

    expect(packet.title).toContain("Sprint 14 Platform Reliability");
    expect(packet.openIncidentCount).toBe(1);
    expect(packet.securityRiskCount).toBeGreaterThan(0);
    expect(packet.connectorRiskCount).toBeGreaterThan(0);
    expect(packet.automationRiskCount).toBe(1);
    expect(packet.changeBlockerCount).toBeGreaterThan(0);
    expect(packet.operationalActionCount).toBeGreaterThan(0);
    expect(packet.reliabilityScore).toBeLessThan(100);
    expect(packet.responsePlan.status).toBe("PLATFORM_OPS_REVIEW_REQUIRED");
  });

  it("keeps platform, security, connector, automation, and release operations approval-gated", () => {
    const packet = buildPlatformReliabilityPacket(sampleInputs());

    expect(packet.sourceSummary.guardrail).toContain("never mutated silently");
    expect(packet.reliabilityPosture.guardrail).toContain("not changed automatically");
    expect(packet.securityOperations.guardrail).toContain("not changed automatically");
    expect(packet.connectorHealth.guardrail).toContain("does not activate connectors");
    expect(packet.automationSafety.guardrail).toContain("does not enable, pause, disable");
    expect(packet.incidentReadiness.guardrail).toContain("require approval");
    expect(packet.releaseChangeControl.guardrail).toContain("not changed automatically");
    expect(packet.rollbackPlan.guardrail).toContain("does not revert deployments");
  });
});
