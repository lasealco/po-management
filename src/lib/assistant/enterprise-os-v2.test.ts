import { describe, expect, it } from "vitest";

import { buildEnterpriseOsPacket, type EnterpriseOsInputs } from "./enterprise-os-v2";

function sampleInputs(): EnterpriseOsInputs {
  return {
    operatingReports: [{ id: "report-1", title: "Operating report", status: "DRAFT", score: 70 }],
    autonomousLoops: [{ id: "loop-1", title: "Loop", status: "DRAFT", loopScore: 68, automationMode: "REVIEW_ONLY", observedSignalCount: 12, proposedActionCount: 2, anomalyCount: 1, learningCount: 2 }],
    valuePackets: [{ id: "value-1", title: "Value", status: "DRAFT", valueScore: 72, adoptionScore: 65, totalEstimatedValue: 250000, roiPct: 140 }],
    executivePackets: [{ id: "exec-1", title: "Executive", status: "DRAFT", executiveScore: 74, strategyRiskCount: 2, decisionCount: 3, learningSignalCount: 2 }],
    agentGovernancePackets: [{ id: "agent-1", title: "Agents", status: "DRAFT", governanceScore: 70, highRiskAgentCount: 1, observabilitySignalCount: 2 }],
    aiQualityPackets: [{ id: "quality-1", title: "Quality", status: "DRAFT", qualityScore: 72, failedEvalCount: 2, releaseBlockerCount: 1, automationRiskCount: 1 }],
    platformReliabilityPackets: [{ id: "platform-1", title: "Platform", status: "DRAFT", reliabilityScore: 68, openIncidentCount: 1, securityRiskCount: 3, connectorRiskCount: 1, automationRiskCount: 1, changeBlockerCount: 1 }],
    tenantRolloutPackets: [{ id: "rollout-1", title: "Rollout", status: "DRAFT", rolloutScore: 71, adoptionRiskCount: 2, supportRiskCount: 1, cutoverBlockerCount: 1 }],
    financePackets: [{ id: "finance-1", title: "Finance", status: "DRAFT", financeScore: 76, accountingBlockerCount: 1, billingExceptionCount: 1, closeControlGapCount: 1 }],
    productLifecyclePackets: [{ id: "product-1", title: "Product", status: "DRAFT", lifecycleScore: 75, passportGapCount: 1, supplierComplianceGapCount: 1, sustainabilityGapCount: 1 }],
    advancedProgramPackets: [{ id: "program-1", ampNumber: 401, programKey: "domain-control", programTitle: "Domain Control", title: "Domain", status: "DRAFT", programScore: 70, riskCount: 2, recommendationCount: 3, approvalStepCount: 0 }],
    auditEvents: [
      { id: "audit-1", surface: "assistant", answerKind: "enterprise", feedback: "not_helpful", evidencePresent: false, qualityPresent: false, createdAt: "2026-04-29T00:00:00.000Z" },
      { id: "audit-2", surface: "assistant", answerKind: "enterprise", feedback: "helpful", evidencePresent: true, qualityPresent: false, createdAt: "2026-04-29T00:05:00.000Z" },
    ],
    actionQueue: [
      { id: "action-1", actionKind: "enterprise_os_review", status: "PENDING", priority: "HIGH", objectType: "assistant_enterprise_os_packet" },
      { id: "action-2", actionKind: "finance_close_review", status: "PENDING", priority: "MEDIUM", objectType: "assistant_finance_cash_control_packet" },
    ],
  };
}

describe("enterprise OS v2 assistant", () => {
  it("builds a durable enterprise OS packet across autonomous and domain controls", () => {
    const packet = buildEnterpriseOsPacket(sampleInputs());

    expect(packet.title).toContain("Sprint 15 Autonomous Enterprise OS v2");
    expect(packet.autonomyMode).toBe("REVIEW_ONLY");
    expect(packet.operatingSignalCount).toBeGreaterThan(0);
    expect(packet.domainControlCount).toBeGreaterThan(0);
    expect(packet.governanceRiskCount).toBeGreaterThan(0);
    expect(packet.valueRiskCount).toBeGreaterThan(0);
    expect(packet.rolloutRiskCount).toBeGreaterThan(0);
    expect(packet.executionActionCount).toBeGreaterThan(0);
    expect(packet.enterpriseScore).toBeLessThan(100);
    expect(packet.commandCouncil.status).toBe("ENTERPRISE_COUNCIL_REVIEW");
  });

  it("keeps enterprise automation, finance, rollout, product, security, and source records approval-gated", () => {
    const packet = buildEnterpriseOsPacket(sampleInputs());

    expect(packet.sourceSummary.guardrail).toContain("never mutated silently");
    expect(packet.enterpriseTelemetry.guardrail).toContain("not changed automatically");
    expect(packet.autonomyReadiness.guardrail).toContain("does not expand automation");
    expect(packet.governanceReliability.guardrail).toContain("remain human-approved");
    expect(packet.valueExecution.guardrail).toContain("does not book savings");
    expect(packet.domainOrchestration.guardrail).toContain("does not mutate product records");
    expect(packet.commandCouncil.guardrail).toContain("does not approve budgets");
    expect(packet.rollbackPlan.guardrail).toContain("does not revert deployments");
  });
});
