import { describe, expect, it } from "vitest";

import { buildPrivacySecurityTrustPacket, type PrivacySecurityTrustInputs } from "./privacy-security-trust";

const inputs: PrivacySecurityTrustInputs = {
  governancePackets: [
    {
      id: "gov-1",
      title: "Governance packet: privacy review",
      status: "REVIEW_QUEUED",
      governanceScore: 68,
      exportRecordCount: 3,
      deletionRequestCount: 2,
      legalHoldBlockCount: 1,
      privacyRiskCount: 4,
    },
  ],
  agentGovernancePackets: [
    {
      id: "agent-1",
      title: "Agent governance packet",
      status: "DRAFT",
      governanceScore: 64,
      highRiskAgentCount: 1,
      toolScopeCount: 5,
      promptAssetCount: 8,
    },
  ],
  observabilityIncidents: [
    {
      id: "incident-1",
      title: "Security answer evidence gap",
      status: "OPEN",
      severity: "HIGH",
      healthScore: 45,
      failureCount: 2,
      evidenceGapCount: 3,
      automationRiskCount: 1,
    },
  ],
  audits: [
    { id: "audit-1", surface: "privacy_consent", answerKind: "consent_summary", objectType: "customer", objectId: "customer-1", evidencePresent: false, qualityPresent: false, feedback: null },
    { id: "audit-2", surface: "identity_security", answerKind: "access_review", objectType: "user", objectId: "user-1", evidencePresent: true, qualityPresent: true, feedback: "not_helpful" },
  ],
  actionQueue: [
    { id: "action-1", actionKind: "security_exception_review", status: "PENDING", priority: "HIGH", objectType: "assistant_security_exception" },
    { id: "action-2", actionKind: "identity_access_review", status: "PENDING", priority: "MEDIUM", objectType: "user" },
  ],
  automationPolicies: [
    {
      id: "policy-1",
      actionKind: "identity_access_grant",
      label: "Identity access grant",
      status: "ENABLED",
      readinessScore: 72,
      threshold: 85,
      rollbackPlan: "Pause identity access automation.",
    },
  ],
  externalEvents: [
    { id: "event-1", eventType: "DATA_TRANSFER_REGULATORY_CHANGE", title: "Cross-border data transfer change", severity: "HIGH", confidence: 90, reviewState: "ACTION_REQUIRED" },
    { id: "event-2", eventType: "THREAT_EXPOSURE", title: "Identity threat campaign", severity: "CRITICAL", confidence: 95, reviewState: "UNDER_REVIEW" },
  ],
};

describe("privacy security trust sprint helpers", () => {
  it("builds a durable Sprint 3 packet across privacy, DSR, transfers, identity, exceptions, and threats", () => {
    const packet = buildPrivacySecurityTrustPacket(inputs);

    expect(packet.trustScore).toBeLessThan(75);
    expect(packet.consentPosture.consentReviewCandidates).toHaveLength(1);
    expect(packet.dataSubjectRights.requestCount).toBe(5);
    expect(packet.dataTransfer.transferRiskCount).toBe(1);
    expect(packet.identityAccess.identityRiskCount).toBeGreaterThanOrEqual(3);
    expect(packet.securityExceptions.exceptionCount).toBeGreaterThanOrEqual(2);
    expect(packet.threatExposure.threatSignalCount).toBeGreaterThanOrEqual(2);
  });

  it("keeps privacy and security remediation review-only", () => {
    const packet = buildPrivacySecurityTrustPacket(inputs);

    expect(packet.trustAssurance.status).toBe("TRUST_REVIEW_REQUIRED");
    expect(packet.responsePlan.status).toBe("PRIVACY_SECURITY_REVIEW");
    expect(packet.rollbackPlan.steps[0]).toContain("Keep consent records, DSR artifacts");
    expect(packet.leadershipSummary).toContain("does not mutate consent");
  });
});
