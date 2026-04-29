import { describe, expect, it } from "vitest";

import { buildMasterDataGovernancePacket, type MasterDataGovernanceInputs } from "./master-data-governance-enrichment";

function sampleInputs(): MasterDataGovernanceInputs {
  return {
    masterDataRuns: [
      { id: "md-1", title: "Supplier MD sweep", duplicateCount: 4, gapCount: 2, staleCount: 1, conflictCount: 1 },
      { id: "md-2", title: "SKU alignment", duplicateCount: 0, gapCount: 3, staleCount: 0, conflictCount: 0 },
    ],
    openStagingBatches: [{ id: "sb-1", title: "ERP delta", rowCount: 120 }],
    stagingRowsWithIssueFlags: 14,
    hubReviews: [
      { id: "hub-1", title: "Mapping drift", status: "OPEN", severity: "WARN" },
      { id: "hub-2", title: "Schema bump", status: "CLOSED", severity: "INFO" },
    ],
    failedMappingJobs: [{ id: "job-1", status: "failed" }],
    failedIngestionRuns: [{ id: "run-1", status: "failed" }],
  };
}

describe("master data governance enrichment", () => {
  it("builds Sprint 21 packet across MDM, staging, hub reviews, jobs, and enrichment cues", () => {
    const packet = buildMasterDataGovernancePacket(sampleInputs());

    expect(packet.title).toContain("Sprint 21 Master Data Governance");
    expect(packet.governanceScore).toBeLessThan(100);
    expect(packet.duplicateClusterRiskCount).toBeGreaterThan(0);
    expect(packet.staleRecordRiskCount).toBeGreaterThan(0);
    expect(packet.stagingConflictRiskCount).toBeGreaterThan(0);
    expect(packet.hubReviewRiskCount).toBeGreaterThan(0);
    expect(packet.canonicalConflictRiskCount).toBeGreaterThan(0);
    expect(packet.enrichmentQueueRiskCount).toBeGreaterThan(0);
    expect(packet.responsePlan.status).toContain("REVIEW");
  });

  it("keeps merges, staging apply, and enrichment publishes workflow-owned", () => {
    const packet = buildMasterDataGovernancePacket(sampleInputs());

    expect(packet.sourceSummary.guardrail).toContain("approve merges");
    expect(packet.duplicateClustersJson.guardrail).toContain("do not merge");
    expect(packet.stagingConflictsJson.guardrail).toContain("do not promote");
    expect(packet.hubReviewQueueJson.guardrail).toContain("do not apply connectors");
    expect(packet.enrichmentQueueJson.guardrail).toContain("do not publish enrichment");
    expect(packet.rollbackPlan.guardrail).toContain("never auto-reverted");
  });
});
