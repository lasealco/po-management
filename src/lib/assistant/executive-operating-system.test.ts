import { describe, expect, it } from "vitest";

import { buildExecutiveOperatingSystemPacket, type ExecutiveOperatingSystemInputs } from "./executive-operating-system";

const inputs: ExecutiveOperatingSystemInputs = {
  operatingReports: [{ id: "report-1", title: "Operating report", status: "DRAFT", score: 78, summary: "Assistant operating score is 78/100." }],
  valuePackets: [{ id: "value-1", title: "Value packet", status: "APPROVED", valueScore: 82, adoptionScore: 76, totalEstimatedValue: 125000, roiPct: 64 }],
  revenuePackets: [{ id: "revenue-1", title: "Strategic account quote", status: "DRAFT", revenueScore: 72, pipelineValue: 250000, feasibilityRiskCount: 1, pricingRiskCount: 1 }],
  autonomousLoops: [{ id: "loop-1", title: "Autonomous loop", status: "DRAFT", loopScore: 68, automationMode: "REVIEW_ONLY", decisionCount: 3, anomalyCount: 1, learningCount: 2 }],
  riskPackets: [{ id: "risk-1", title: "Enterprise risk packet", status: "REVIEW_QUEUED", riskScore: 76, controlGapCount: 2, externalRiskCount: 1 }],
  trustPackets: [{ id: "trust-1", title: "Trust packet", status: "DRAFT", trustScore: 66, securityExceptionCount: 1, threatSignalCount: 2 }],
  audits: [
    { id: "audit-1", surface: "assistant_executive", answerKind: "board_brief", feedback: "not_helpful", evidencePresent: false, qualityPresent: false },
    { id: "audit-2", surface: "assistant_value", answerKind: "roi", feedback: "helpful", evidencePresent: true, qualityPresent: true },
  ],
  actionQueue: [
    { id: "action-1", actionKind: "executive_review", status: "PENDING", priority: "HIGH", objectType: "assistant_executive" },
    { id: "action-2", actionKind: "strategy_review", status: "DONE", priority: "MEDIUM", objectType: "assistant_strategy" },
  ],
};

describe("executive operating system sprint helpers", () => {
  it("builds a durable Sprint 4 packet across board, investor, corp-dev, twin, strategy, decisions, and learning", () => {
    const packet = buildExecutiveOperatingSystemPacket(inputs);

    expect(packet.executiveScore).toBeGreaterThan(40);
    expect(packet.boardBrief.metricCount).toBe(5);
    expect(packet.investorNarrative.narrativeRiskCount).toBeGreaterThanOrEqual(2);
    expect(packet.corpDevRadar.signalCount).toBeGreaterThanOrEqual(2);
    expect(packet.executiveTwin.weakDimensionCount).toBeGreaterThanOrEqual(1);
    expect(packet.strategyExecution.strategyRiskCount).toBeGreaterThanOrEqual(3);
    expect(packet.decisionLedger.decisionCount).toBeGreaterThanOrEqual(1);
    expect(packet.learningLoop.learningSignalCount).toBeGreaterThanOrEqual(1);
  });

  it("keeps executive outputs review-only and source-system safe", () => {
    const packet = buildExecutiveOperatingSystemPacket(inputs);

    expect(packet.operatingCadence.status).toMatch(/EXECUTIVE|NEEDS/);
    expect(packet.boardBrief.guardrail).toContain("not sent");
    expect(packet.investorNarrative.guardrail).toContain("is sent automatically");
    expect(packet.rollbackPlan.steps[0]).toContain("Keep board materials");
    expect(packet.leadershipSummary).toContain("does not publish board materials");
  });
});
