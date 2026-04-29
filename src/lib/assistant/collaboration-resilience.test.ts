import { describe, expect, it } from "vitest";

import { buildCollaborationResiliencePacket, type CollaborationResilienceInputs } from "./collaboration-resilience";

const inputs: CollaborationResilienceInputs = {
  partnerPackets: [
    { id: "partner-1", title: "Partner launch packet", status: "DRAFT", readinessScore: 61, partnerCount: 4, mappingIssueCount: 2, openReviewCount: 1 },
  ],
  customerBriefs: [
    { id: "brief-1", title: "Customer promise brief", status: "DRAFT", serviceScore: 58 },
    { id: "brief-2", title: "Stable account", status: "APPROVED", serviceScore: 92 },
  ],
  exceptionIncidents: [
    { id: "incident-1", title: "Late ocean delivery", status: "OPEN", severity: "HIGH", severityScore: 80, customerImpact: "Promised delivery at risk." },
  ],
  sustainabilityPackets: [
    { id: "esg-1", title: "ESG data gap", status: "DRAFT", sustainabilityScore: 64, estimatedCo2eKg: 1200, missingDataCount: 3, recommendationCount: 2 },
  ],
  frontlinePackets: [
    { id: "frontline-1", title: "Warehouse mobile review", status: "DRAFT", readinessScore: 66, frontlineTaskCount: 5, evidenceGapCount: 2, offlineRiskCount: 1, exceptionCount: 1 },
  ],
  supplierTasks: [
    { id: "task-1", title: "Upload safety certificate", done: false, dueAt: "2020-01-01T00:00:00.000Z", supplierName: "Northwind Components" },
  ],
  productSignals: [
    { id: "product-1", sku: "SKU-1", name: "Battery Kit", hasCategory: true, hasDimensions: false, hasTraceability: false },
    { id: "product-2", sku: "SKU-2", name: "Complete Product", hasCategory: true, hasDimensions: true, hasTraceability: true },
  ],
  externalEvents: [
    { id: "event-1", eventType: "WATER_SHORTAGE", title: "Regional water restriction", severity: "HIGH", confidence: 82, reviewState: "WATCH" },
    { id: "event-2", eventType: "SAFETY", title: "Warehouse heat advisory", severity: "MEDIUM", confidence: 76, reviewState: "UNDER_REVIEW" },
  ],
  actionQueue: [
    { id: "action-1", actionKind: "customer_promise_review", status: "PENDING", priority: "HIGH", objectType: "shipment" },
    { id: "action-2", actionKind: "frontline_safety_review", status: "PENDING", priority: "HIGH", objectType: "wms_task" },
  ],
};

describe("buildCollaborationResiliencePacket", () => {
  it("aggregates collaboration, promise, resilience, passport, workforce, and safety risks", () => {
    const packet = buildCollaborationResiliencePacket(inputs);

    expect(packet.resilienceScore).toBeLessThan(90);
    expect(packet.collaborationHub.partnerGapCount).toBe(2);
    expect(packet.promiseReconciliation.promiseRiskCount).toBe(3);
    expect(packet.resiliencePlan.climateRiskCount).toBe(3);
    expect(packet.passportReadiness.passportGapCount).toBe(1);
    expect(packet.workforceSafety.workforceRiskCount).toBe(2);
    expect(packet.workforceSafety.safetySignalCount).toBe(1);
    expect(packet.responsePlan.status).toBe("RESILIENCE_REVIEW_REQUIRED");
    expect(packet.leadershipSummary).toContain("Sprint 5 Collaboration & Resilience score");
  });

  it("keeps all operational changes review-only", () => {
    const packet = buildCollaborationResiliencePacket(inputs);

    expect(packet.collaborationHub.guardrail).toContain("not changed automatically");
    expect(packet.promiseReconciliation.guardrail).toContain("not changed automatically");
    expect(packet.resiliencePlan.guardrail).toContain("do not change routes");
    expect(packet.passportReadiness.guardrail).toContain("not changed automatically");
    expect(packet.workforceSafety.guardrail).toContain("remain human-approved");
    expect(packet.rollbackPlan.steps.join(" ")).toContain("source records unchanged");
  });
});
