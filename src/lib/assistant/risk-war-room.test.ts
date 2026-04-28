import { describe, expect, it } from "vitest";

import {
  buildRiskExposureMap,
  buildRiskWarRoomDraft,
  clusterRiskEvents,
  scoreRiskWarRoom,
  type RiskWarRoomEventSignal,
} from "./risk-war-room";

function event(overrides: Partial<RiskWarRoomEventSignal> = {}): RiskWarRoomEventSignal {
  return {
    id: "event-1",
    ingestKey: "ingest-1",
    clusterKey: "port:nlrot",
    eventType: "PORT_DISRUPTION",
    title: "Rotterdam port disruption",
    shortSummary: "Labor disruption at terminal.",
    severity: "HIGH",
    confidence: 84,
    reviewState: "ACTION_REQUIRED",
    discoveredTime: "2026-04-28T08:00:00.000Z",
    sourceCount: 3,
    geographyLabels: ["Rotterdam"],
    affectedEntities: [
      {
        objectType: "SHIPMENT",
        objectId: "ship-1",
        matchType: "LANE_PORT",
        matchConfidence: 91,
        impactLevel: "HIGH",
        rationale: "Shipment uses affected port.",
      },
    ],
    recommendations: [
      {
        id: "rec-1",
        recommendationType: "EXPEDITE_ALTERNATE_PORT",
        targetObjectType: "SHIPMENT",
        targetObjectId: "ship-1",
        priority: 92,
        confidence: 76,
        expectedEffect: "Reduce delay exposure.",
        status: "ACTIVE",
      },
    ],
    ...overrides,
  };
}

describe("AMP20 risk war room helpers", () => {
  it("clusters related SCRI events by cluster key", () => {
    const clusters = clusterRiskEvents([
      event({ id: "event-1", title: "Port disruption A" }),
      event({ id: "event-2", ingestKey: "ingest-2", title: "Port disruption B", severity: "CRITICAL" }),
    ]);

    expect(clusters).toHaveLength(1);
    expect(clusters[0]).toMatchObject({ clusterKey: "port:nlrot", eventCount: 2, severity: "CRITICAL" });
  });

  it("builds an exposure map with high-exposure internal objects", () => {
    const exposure = buildRiskExposureMap([
      event(),
      event({
        id: "event-2",
        ingestKey: "ingest-2",
        affectedEntities: [
          {
            objectType: "SUPPLIER",
            objectId: "supplier-1",
            matchType: "GEO",
            matchConfidence: 78,
            impactLevel: "MEDIUM",
            rationale: "Supplier in disrupted region.",
          },
        ],
      }),
    ]);

    expect(exposure.totalObjects).toBe(2);
    expect(exposure.objectTypeCounts).toMatchObject({ SHIPMENT: 1, SUPPLIER: 1 });
    expect(exposure.highExposureCount).toBeGreaterThan(0);
  });

  it("scores risk using severity, exposure, and active recommendations", () => {
    const events = [event({ severity: "CRITICAL" })];
    const exposure = buildRiskExposureMap(events);
    const score = scoreRiskWarRoom(events, exposure);

    expect(score.severity).toBe("CRITICAL");
    expect(score.riskScore).toBeGreaterThanOrEqual(90);
  });

  it("drafts scenario proposal, mitigation plan, and sanitized communications without source mutations", () => {
    const draft = buildRiskWarRoomDraft({ events: [event()], prompt: "Port disruption customer protection" });

    expect(draft.title).toBe("Port disruption customer protection");
    expect(draft.scenarioProposal.origin).toBe("ASSISTANT_RISK_WAR_ROOM");
    expect(draft.mitigationPlan.steps.map((step) => step.step)).toContain("Queue mitigations");
    expect(draft.communicationDraft.customer).toContain("after human review");
    expect(draft.communicationDraft.internal).toContain("Queue mitigations for approval");
  });
});
