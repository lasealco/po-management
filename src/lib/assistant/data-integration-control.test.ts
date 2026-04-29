import { describe, expect, it } from "vitest";

import { buildDataIntegrationPacket, type DataIntegrationInputs } from "./data-integration-control";

const inputs: DataIntegrationInputs = {
  connectors: [
    { id: "conn-1", name: "ERP Orders", sourceKind: "api", authMode: "oauth", authState: "configured", authConfigRef: "vault://erp", status: "active", lastSyncAt: "2026-04-29T00:00:00.000Z", healthSummary: "Healthy" },
    { id: "conn-2", name: "WMS Feed", sourceKind: "file", authMode: "api_key", authState: "error", authConfigRef: null, status: "error", lastSyncAt: null, healthSummary: "Auth failed" },
  ],
  ingestionRuns: [
    { id: "run-1", connectorId: "conn-1", status: "succeeded", triggerKind: "api", errorCode: null, errorMessage: null, appliedAt: null, finishedAt: "2026-04-29T00:10:00.000Z" },
    { id: "run-2", connectorId: "conn-2", status: "failed", triggerKind: "manual", errorCode: "AUTH", errorMessage: "Auth failed", appliedAt: null, finishedAt: "2026-04-29T00:05:00.000Z" },
  ],
  mappingTemplates: [{ id: "template-1", name: "Orders map", description: "ERP order mapping", ruleCount: 0 }],
  mappingJobs: [{ id: "job-1", status: "failed", errorMessage: "Missing target field", hasProposal: false, stagingBatchCount: 1 }],
  stagingBatches: [{ id: "batch-1", title: "ERP import", status: "open", rowCount: 2, appliedAt: null, hasApplySummary: false }],
  stagingRows: [
    { id: "row-1", batchId: "batch-1", rowIndex: 1, hasMappedRecord: true, issueCount: 2, targetDomain: "ORDER", label: "Order A" },
    { id: "row-2", batchId: "batch-1", rowIndex: 2, hasMappedRecord: false, issueCount: 0, targetDomain: null, label: "Order B" },
  ],
  assistantReviewItems: [{ id: "review-1", sourceType: "staging", sourceId: "batch-1", title: "Review staging", severity: "HIGH", status: "OPEN" }],
  masterDataRuns: [{ id: "mdm-1", title: "MDM run", status: "DRAFT", qualityScore: 72, duplicateCount: 1, gapCount: 2, staleCount: 0, conflictCount: 1 }],
  twinIngestEvents: [{ id: "event-1", type: "entity_upsert", hasIdempotencyKey: false, createdAt: "2026-04-29T00:00:00.000Z" }],
  actionQueue: [{ id: "action-1", actionKind: "api_hub_staging_review", status: "PENDING", priority: "HIGH", objectType: "api_hub_staging_batch" }],
};

describe("buildDataIntegrationPacket", () => {
  it("aggregates connector, mapping, staging, MDM, twin ingest, and launch risks", () => {
    const packet = buildDataIntegrationPacket(inputs);

    expect(packet.connectorReadiness.connectorCount).toBe(2);
    expect(packet.connectorReadiness.blockedConnectorCount).toBe(1);
    expect(packet.mappingReview.mappingGapCount).toBeGreaterThanOrEqual(2);
    expect(packet.stagingReview.stagingRiskCount).toBe(2);
    expect(packet.masterDataQuality.masterDataRiskCount).toBeGreaterThan(0);
    expect(packet.twinIngest.twinIngestRiskCount).toBeGreaterThan(0);
    expect(packet.launchChecklist.launchActionCount).toBeGreaterThanOrEqual(7);
    expect(packet.leadershipSummary).toContain("Sprint 9 Data & Integration Control score");
  });

  it("keeps integration rollout execution review-gated", () => {
    const packet = buildDataIntegrationPacket(inputs);

    expect(packet.connectorReadiness.guardrail).toContain("does not activate connectors");
    expect(packet.dataContract.guardrail).toContain("does not change connector schemas");
    expect(packet.mappingReview.guardrail).toContain("does not edit mapping templates");
    expect(packet.stagingReview.guardrail).toContain("does not promote");
    expect(packet.masterDataQuality.guardrail).toContain("does not merge");
    expect(packet.twinIngest.guardrail).toContain("does not append ingest events");
    expect(packet.launchChecklist.guardrail).toContain("does not activate connectors");
    expect(packet.rollbackPlan.steps.join(" ")).toContain("downstream source records unchanged");
  });
});
