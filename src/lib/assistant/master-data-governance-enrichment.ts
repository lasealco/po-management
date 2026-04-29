export type MasterDataGovernanceInputs = {
  masterDataRuns: Array<{
    id: string;
    title: string;
    duplicateCount: number;
    gapCount: number;
    staleCount: number;
    conflictCount: number;
  }>;
  openStagingBatches: Array<{ id: string; title: string | null; rowCount: number }>;
  stagingRowsWithIssueFlags: number;
  hubReviews: Array<{ id: string; title: string; status: string; severity: string }>;
  failedMappingJobs: Array<{ id: string; status: string }>;
  failedIngestionRuns: Array<{ id: string; status: string }>;
};

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

export function buildDuplicateClusterSignals(inputs: MasterDataGovernanceInputs) {
  const focused = inputs.masterDataRuns.filter((run) => run.duplicateCount > 0);
  const duplicateClusterRiskCount = focused.length;
  return {
    duplicateClusterRiskCount,
    duplicateRuns: focused.slice(0, 16).map((run) => ({
      runId: run.id,
      title: run.title,
      duplicateCount: run.duplicateCount,
    })),
    guardrail:
      "Duplicate cluster overlays summarize AMP21 master-data quality scans — they do not merge records, collapse clusters, or overwrite canonical keys automatically.",
  };
}

export function buildStaleRecordSignals(inputs: MasterDataGovernanceInputs) {
  const focused = inputs.masterDataRuns.filter((run) => run.staleCount > 0);
  const staleRecordRiskCount = focused.length;
  return {
    staleRecordRiskCount,
    staleRuns: focused.slice(0, 16).map((run) => ({
      runId: run.id,
      title: run.title,
      staleCount: run.staleCount,
    })),
    guardrail:
      "Stale-record cues reference AMP21 sweep outputs — they do not archive masters, pause integrations, or mutate ERP/WMS endpoints automatically.",
  };
}

export function buildStagingConflictSignals(inputs: MasterDataGovernanceInputs) {
  const openRows = inputs.openStagingBatches.length;
  const stagingConflictRiskCount = openRows + Math.min(inputs.stagingRowsWithIssueFlags, 48);
  return {
    stagingConflictRiskCount,
    openBatches: inputs.openStagingBatches.slice(0, 14).map((batch) => ({
      batchId: batch.id,
      title: batch.title ?? "Staging batch",
      rowCount: batch.rowCount,
    })),
    stagingRowsFlagged: inputs.stagingRowsWithIssueFlags,
    guardrail:
      "Staging overlays cite API Hub batches and row-level issue JSON — they do not promote rows, apply ingest, or publish staging to production masters automatically.",
  };
}

export function buildHubReviewQueueSignals(inputs: MasterDataGovernanceInputs) {
  const openAll = inputs.hubReviews.filter((item) => item.status === "OPEN");
  const hubReviewRiskCount = openAll.length;
  return {
    hubReviewRiskCount,
    openReviews: openAll.slice(0, 18).map((item) => ({
      reviewId: item.id,
      title: item.title,
      severity: item.severity,
    })),
    guardrail:
      "Integration review items remain advisory — they do not apply connectors, edit mappings, retry ingestion, or close assistant evidence automatically.",
  };
}

export function buildCanonicalConflictSignals(inputs: MasterDataGovernanceInputs) {
  const mdConflictRuns = inputs.masterDataRuns.filter((run) => run.conflictCount > 0).length;
  const canonicalConflictRiskCount =
    mdConflictRuns + inputs.failedMappingJobs.length + inputs.failedIngestionRuns.length;
  return {
    canonicalConflictRiskCount,
    mdConflictRuns,
    failedMappingJobs: inputs.failedMappingJobs.slice(0, 12).map((job) => ({ jobId: job.id, status: job.status })),
    failedIngestionRuns: inputs.failedIngestionRuns.slice(0, 12).map((run) => ({ runId: run.id, status: run.status })),
    guardrail:
      "Canonical conflict cues aggregate AMP21 conflicts plus failed mapping/ingestion jobs — they do not replay jobs, reconcile merges, or overwrite golden records automatically.",
  };
}

export function buildEnrichmentQueueSignals(inputs: MasterDataGovernanceInputs) {
  const focused = inputs.masterDataRuns.filter((run) => run.gapCount > 0);
  const enrichmentQueueRiskCount = focused.length;
  return {
    enrichmentQueueRiskCount,
    gapRuns: focused.slice(0, 16).map((run) => ({
      runId: run.id,
      title: run.title,
      gapCount: run.gapCount,
    })),
    guardrail:
      "Enrichment queue overlays highlight AMP21 gap analyses — they do not publish enrichment, sync MDM exports, or elevate staging drafts into canonical tables automatically.",
  };
}

export function buildMasterDataGovernancePacket(inputs: MasterDataGovernanceInputs) {
  const duplicateClustersJson = buildDuplicateClusterSignals(inputs);
  const staleRecordsJson = buildStaleRecordSignals(inputs);
  const stagingConflictsJson = buildStagingConflictSignals(inputs);
  const hubReviewQueueJson = buildHubReviewQueueSignals(inputs);
  const canonicalConflictJson = buildCanonicalConflictSignals(inputs);
  const enrichmentQueueJson = buildEnrichmentQueueSignals(inputs);

  const duplicateClusterRiskCount = duplicateClustersJson.duplicateClusterRiskCount;
  const staleRecordRiskCount = staleRecordsJson.staleRecordRiskCount;
  const stagingConflictRiskCount = stagingConflictsJson.stagingConflictRiskCount;
  const hubReviewRiskCount = hubReviewQueueJson.hubReviewRiskCount;
  const canonicalConflictRiskCount = canonicalConflictJson.canonicalConflictRiskCount;
  const enrichmentQueueRiskCount = enrichmentQueueJson.enrichmentQueueRiskCount;

  const governanceScore = clamp(
    Math.round(
      100 -
        Math.min(18, duplicateClusterRiskCount * 3) -
        Math.min(16, staleRecordRiskCount * 3) -
        Math.min(18, stagingConflictRiskCount * 2) -
        Math.min(18, hubReviewRiskCount * 2) -
        Math.min(16, canonicalConflictRiskCount * 3) -
        Math.min(16, enrichmentQueueRiskCount * 3),
    ),
  );

  const sourceSummary = {
    masterDataRunsSampled: inputs.masterDataRuns.length,
    openStagingBatches: inputs.openStagingBatches.length,
    stagingRowsWithIssues: inputs.stagingRowsWithIssueFlags,
    hubReviewsSampled: inputs.hubReviews.length,
    failedMappingJobs: inputs.failedMappingJobs.length,
    failedIngestionRuns: inputs.failedIngestionRuns.length,
    guardrail:
      "Sprint 21 packets unify AMP21 master-data quality posture, API Hub staging friction, integration review backlog, canonical conflict telemetry, and enrichment gaps — data stewards approve merges, staging promotion, and enrichment publishes outside this sprint.",
  };

  const responsePlan = {
    status:
      governanceScore < 66 ? "MASTER_DATA_GOVERNANCE_REVIEW_REQUIRED" : governanceScore < 82 ? "MDM_DESK_REVIEW" : "MONITOR",
    owners: ["Data steward", "API Hub operator", "Integration engineering", "Product/supplier MDM", "Analytics"],
    steps: [
      "Separate duplicate resolutions from staging promotions — avoid mixing API Hub apply with MDM merges.",
      "Confirm canonical conflicts against authoritative connectors before referencing merges externally.",
      "Route enrichment publishes through governed MDM workflows — assistant packets stay descriptive.",
      "Escalate ingestion failures through connector credentials and mapping health checks.",
    ],
    guardrail: "Governance recommendations remain advisory until stewards execute approved MDM/API Hub workflows.",
  };

  const rollbackPlan = {
    steps: [
      "Rejecting a packet does not revert staging batches, ingestion runs, master-data scans, or enrichment drafts.",
      "Open a fresh packet after merges, staging promotions, or connector upgrades.",
      "Manual approvals remain mandatory before production canonical updates.",
    ],
    guardrail: "Rollback preserves advisory narratives — operational MDM records are never auto-reverted here.",
  };

  const leadershipSummary = [
    `Sprint 21 Master Data Governance & Enrichment score is ${governanceScore}/100 with ${duplicateClusterRiskCount} duplicate cluster cue(s), ${staleRecordRiskCount} stale-record cue(s), ${stagingConflictRiskCount} staging conflict cue(s), ${hubReviewRiskCount} integration review cue(s), ${canonicalConflictRiskCount} canonical conflict cue(s), and ${enrichmentQueueRiskCount} enrichment queue cue(s).`,
    stagingConflictsJson.guardrail,
    sourceSummary.guardrail,
  ].join("\n\n");

  return {
    title: `Sprint 21 Master Data Governance & Enrichment: score ${governanceScore}/100`,
    status: "DRAFT" as const,
    governanceScore,
    duplicateClusterRiskCount,
    staleRecordRiskCount,
    stagingConflictRiskCount,
    hubReviewRiskCount,
    canonicalConflictRiskCount,
    enrichmentQueueRiskCount,
    sourceSummary,
    duplicateClustersJson,
    staleRecordsJson,
    stagingConflictsJson,
    hubReviewQueueJson,
    canonicalConflictJson,
    enrichmentQueueJson,
    responsePlan,
    rollbackPlan,
    leadershipSummary,
  };
}
