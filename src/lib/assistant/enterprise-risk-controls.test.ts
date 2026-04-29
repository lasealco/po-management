import { describe, expect, it } from "vitest";

import { buildEnterpriseRiskControlsPacket, type EnterpriseRiskControlsInputs } from "./enterprise-risk-controls";

const inputs: EnterpriseRiskControlsInputs = {
  contractPackets: [
    {
      id: "contract-1",
      title: "Contract compliance packet: score 62/100",
      status: "REVIEW_QUEUED",
      complianceScore: 62,
      obligationCount: 8,
      renewalRiskCount: 2,
      complianceGapCount: 3,
    },
  ],
  governancePackets: [
    {
      id: "governance-1",
      title: "Governance packet: score 70/100",
      status: "DRAFT",
      governanceScore: 70,
      retentionCandidateCount: 4,
      legalHoldBlockCount: 1,
      privacyRiskCount: 2,
    },
  ],
  riskRooms: [{ id: "risk-room-1", title: "Risk war room: customs strike", status: "DRAFT", severity: "HIGH", riskScore: 82 }],
  auditEvents: [
    { id: "audit-1", surface: "assistant_contract_compliance", answerKind: "contract_compliance_packet", evidencePresent: true, qualityPresent: true, feedback: null },
    { id: "audit-2", surface: "assistant_governance", answerKind: "retention_packet", evidencePresent: false, qualityPresent: false, feedback: null },
  ],
  actionQueue: [
    { id: "action-1", actionKind: "contract_compliance_review", status: "PENDING", priority: "HIGH" },
    { id: "action-2", actionKind: "governance_review", status: "COMPLETED", priority: "MEDIUM" },
  ],
  externalEvents: [
    { id: "event-1", eventType: "REGULATORY_CHANGE", title: "New customs compliance filing", severity: "HIGH", confidence: 88, reviewState: "ACTION_REQUIRED", sourceCount: 4 },
    { id: "event-2", eventType: "GEOPOLITICAL_RISK", title: "Port disruption", severity: "MEDIUM", confidence: 72, reviewState: "WATCH", sourceCount: 3 },
  ],
};

describe("enterprise risk controls sprint helpers", () => {
  it("builds a durable Sprint 2 packet across obligations, controls, evidence, contracts, and external risk", () => {
    const packet = buildEnterpriseRiskControlsPacket(inputs);

    expect(packet.riskScore).toBeGreaterThanOrEqual(60);
    expect(packet.obligationGraph.obligationCount).toBe(15);
    expect(packet.controlTesting.controlGapCount).toBeGreaterThanOrEqual(3);
    expect(packet.auditEvidence.evidenceCoveragePct).toBe(50);
    expect(packet.contractPerformance.riskPacketCount).toBe(1);
    expect(packet.regulatoryHorizon.eventCount).toBe(1);
    expect(packet.externalRisk.highRiskRoomCount).toBe(1);
  });

  it("keeps remediation review-only and source-system safe", () => {
    const packet = buildEnterpriseRiskControlsPacket(inputs);

    expect(packet.responsePlan.status).toBe("CONTROL_OWNER_REVIEW");
    expect(packet.controlTesting.guardrail).toContain("not changed automatically");
    expect(packet.rollbackPlan.steps[0]).toContain("Keep obligations, controls, contracts");
    expect(packet.leadershipSummary).toContain("does not mutate obligations");
  });
});
