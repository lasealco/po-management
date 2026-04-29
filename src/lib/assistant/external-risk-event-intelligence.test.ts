import { describe, expect, it } from "vitest";

import { buildExternalRiskEventPacket, type ExternalRiskEventInputs } from "./external-risk-event-intelligence";

function sampleInputs(): ExternalRiskEventInputs {
  const stale = new Date(Date.now() - 20 * 86_400_000);
  return {
    events: [
      {
        id: "ev-1",
        title: "Port congestion cluster",
        severity: "HIGH",
        reviewState: "NEW",
        confidence: 48,
        ownerUserId: null,
        discoveredTime: stale,
        sourceTrustScore: 40,
        sourceCount: 1,
        affectedEntityCount: 0,
        affectedEntities: [],
        activeRecommendationCount: 2,
      },
      {
        id: "ev-2",
        title: "Fuel surcharge spike",
        severity: "MEDIUM",
        reviewState: "ACTION_REQUIRED",
        confidence: 70,
        ownerUserId: null,
        discoveredTime: new Date(),
        sourceTrustScore: 80,
        sourceCount: 3,
        affectedEntityCount: 2,
        affectedEntities: [{ matchConfidence: 44 }],
        activeRecommendationCount: 1,
      },
    ],
    twinSignals: [{ id: "tw-1", acknowledged: false }],
    twinInsights: [{ id: "ins-1", status: "OPEN" }],
    warRooms: [{ id: "war-1", status: "DRAFT", riskScore: 78 }],
    taskLinkCount: 4,
  };
}

describe("external risk event intelligence", () => {
  it("builds Sprint 20 packet across SCRI, exposure, Twin, mitigation, coordination, and credibility signals", () => {
    const packet = buildExternalRiskEventPacket(sampleInputs());

    expect(packet.title).toContain("Sprint 20 External Risk");
    expect(packet.eventIntelligenceScore).toBeLessThan(100);
    expect(packet.eventReviewRiskCount).toBeGreaterThan(0);
    expect(packet.exposureLinkageRiskCount).toBeGreaterThan(0);
    expect(packet.twinScenarioRiskCount).toBeGreaterThan(0);
    expect(packet.mitigationRecommendationRiskCount).toBeGreaterThan(0);
    expect(packet.coordinationEscalationRiskCount).toBeGreaterThan(0);
    expect(packet.credibilityRiskCount).toBeGreaterThan(0);
    expect(packet.responsePlan.status).toContain("REVIEW");
  });

  it("does not imply SCRI/Twin mutations or partner notifications", () => {
    const packet = buildExternalRiskEventPacket(sampleInputs());

    expect(packet.sourceSummary.guardrail).toContain("before acknowledging");
    expect(packet.externalEventJson.guardrail).toContain("do not advance review states");
    expect(packet.exposureMappingJson.guardrail).toContain("do not add/remove entities");
    expect(packet.twinScenarioJson.guardrail).toContain("do not acknowledge");
    expect(packet.mitigationPortfolioJson.guardrail).toContain("do not accept");
    expect(packet.escalationCadenceJson.guardrail).toContain("do not notify");
    expect(packet.rollbackPlan.guardrail).toContain("never auto-reverted");
  });
});
