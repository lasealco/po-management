import { buildApiHubConnectorReadinessSummary } from "@/lib/apihub/connector-readiness";

export type DataIntegrationInputs = {
  connectors: Array<{
    id: string;
    name: string;
    sourceKind: string;
    authMode: string;
    authState: string | null;
    authConfigRef: string | null;
    status: string;
    lastSyncAt: string | null;
    healthSummary: string | null;
  }>;
  ingestionRuns: Array<{ id: string; connectorId: string | null; status: string; triggerKind: string; errorCode: string | null; errorMessage: string | null; appliedAt: string | null; finishedAt: string | null }>;
  mappingTemplates: Array<{ id: string; name: string; description: string | null; ruleCount: number }>;
  mappingJobs: Array<{ id: string; status: string; errorMessage: string | null; hasProposal: boolean; stagingBatchCount: number }>;
  stagingBatches: Array<{ id: string; title: string | null; status: string; rowCount: number; appliedAt: string | null; hasApplySummary: boolean }>;
  stagingRows: Array<{ id: string; batchId: string; rowIndex: number; hasMappedRecord: boolean; issueCount: number; targetDomain: string | null; label: string }>;
  assistantReviewItems: Array<{ id: string; sourceType: string; sourceId: string | null; title: string; severity: string; status: string }>;
  masterDataRuns: Array<{ id: string; title: string; status: string; qualityScore: number; duplicateCount: number; gapCount: number; staleCount: number; conflictCount: number }>;
  twinIngestEvents: Array<{ id: string; type: string; hasIdempotencyKey: boolean; createdAt: string }>;
  actionQueue: Array<{ id: string; actionKind: string; status: string; priority: string; objectType: string | null }>;
};

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function ageHours(iso: string | null) {
  if (!iso) return null;
  const ms = Date.now() - Date.parse(iso);
  return Number.isFinite(ms) ? Math.max(0, Math.floor(ms / 3_600_000)) : null;
}

export function buildConnectorReadiness(inputs: DataIntegrationInputs) {
  const connectors = inputs.connectors.map((connector) => {
    const readiness = buildApiHubConnectorReadinessSummary({
      status: connector.status,
      authMode: connector.authMode,
      authState: connector.authState,
      authConfigRef: connector.authConfigRef,
      lastSyncAt: connector.lastSyncAt ? new Date(connector.lastSyncAt) : null,
    });
    const runs = inputs.ingestionRuns.filter((run) => run.connectorId === connector.id);
    const failedRuns = runs.filter((run) => run.status === "failed" || run.errorCode || run.errorMessage);
    return {
      connectorId: connector.id,
      name: connector.name,
      sourceKind: connector.sourceKind,
      status: connector.status,
      authMode: connector.authMode,
      healthSummary: connector.healthSummary,
      readiness,
      runCount: runs.length,
      failedRunCount: failedRuns.length,
      lastSyncAgeHours: ageHours(connector.lastSyncAt),
    };
  });
  return {
    connectorCount: connectors.length,
    readyConnectorCount: connectors.filter((connector) => connector.readiness.overall === "ready").length,
    attentionConnectorCount: connectors.filter((connector) => connector.readiness.overall === "attention").length,
    blockedConnectorCount: connectors.filter((connector) => connector.readiness.overall === "blocked").length,
    failedRunCount: connectors.reduce((sum, connector) => sum + connector.failedRunCount, 0),
    connectors: connectors.toSorted((a, b) => {
      const order = { blocked: 0, attention: 1, ready: 2 };
      return order[a.readiness.overall] - order[b.readiness.overall] || b.failedRunCount - a.failedRunCount || a.name.localeCompare(b.name);
    }),
    guardrail: "Connector readiness is review evidence only; it does not activate connectors, change credentials, start sync jobs, expose partner access, or apply data automatically.",
  };
}

export function buildDataContracts(inputs: DataIntegrationInputs, connectorReadiness = buildConnectorReadiness(inputs)) {
  const sourceKinds = Array.from(new Set(inputs.connectors.map((connector) => connector.sourceKind || "unspecified")));
  const runTriggerKinds = Array.from(new Set(inputs.ingestionRuns.map((run) => run.triggerKind || "unknown")));
  const missingContractSignals = [
    ...connectorReadiness.connectors
      .filter((connector) => connector.readiness.overall !== "ready")
      .map((connector) => ({
        type: "CONNECTOR_CONTRACT_GAP",
        sourceId: connector.connectorId,
        label: connector.name,
        reason: connector.readiness.reasons.join(", ") || "Connector is not ready.",
      })),
    ...inputs.mappingTemplates.length === 0
      ? [{ type: "MAPPING_TEMPLATE_GAP", sourceId: null, label: "Mapping templates", reason: "No API Hub mapping templates exist for repeatable integration contracts." }]
      : [],
    ...inputs.stagingRows.filter((row) => !row.targetDomain || row.targetDomain === "UNKNOWN").slice(0, 10).map((row) => ({
      type: "UNKNOWN_TARGET_DOMAIN",
      sourceId: row.id,
      label: row.label,
      reason: "Staging row lacks a clear target domain contract.",
    })),
  ];
  return {
    sourceKinds,
    runTriggerKinds,
    mappingTemplateCount: inputs.mappingTemplates.length,
    contractGapCount: missingContractSignals.length,
    missingContractSignals,
    guardrail: "Data contract review does not change connector schemas, mapping templates, staging rows, source records, or partner access automatically.",
  };
}

export function buildMappingReview(inputs: DataIntegrationInputs) {
  const failedJobs = inputs.mappingJobs.filter((job) => job.status === "failed" || job.errorMessage);
  const proposalJobs = inputs.mappingJobs.filter((job) => job.hasProposal);
  const weakTemplates = inputs.mappingTemplates.filter((template) => template.ruleCount === 0);
  const mappingGapCount = failedJobs.length + weakTemplates.length + inputs.stagingRows.filter((row) => row.hasMappedRecord && row.issueCount > 0).length;
  return {
    mappingJobCount: inputs.mappingJobs.length,
    proposalJobCount: proposalJobs.length,
    failedJobCount: failedJobs.length,
    mappingTemplateCount: inputs.mappingTemplates.length,
    weakTemplateCount: weakTemplates.length,
    mappingGapCount,
    failedJobs: failedJobs.slice(0, 12).map((job) => ({ mappingJobId: job.id, errorMessage: job.errorMessage })),
    weakTemplates: weakTemplates.slice(0, 12).map((template) => ({ templateId: template.id, name: template.name })),
    guardrail: "Mapping review can propose fixes only; it does not edit mapping templates, alter staging rows, or apply transformed data automatically.",
  };
}

export function buildStagingReview(inputs: DataIntegrationInputs) {
  const riskyRows = inputs.stagingRows
    .filter((row) => row.issueCount > 0 || !row.hasMappedRecord)
    .map((row) => ({
      stagingRowId: row.id,
      batchId: row.batchId,
      rowIndex: row.rowIndex,
      label: row.label,
      targetDomain: row.targetDomain ?? "UNKNOWN",
      issueCount: row.issueCount,
      reason: row.issueCount > 0 ? "Staging row has mapping or validation issues." : "Staging row has no mapped record.",
    }));
  const openBatches = inputs.stagingBatches.filter((batch) => batch.status === "open");
  const appliedBatchesWithoutSummary = inputs.stagingBatches.filter((batch) => batch.appliedAt && !batch.hasApplySummary);
  return {
    stagingBatchCount: inputs.stagingBatches.length,
    openBatchCount: openBatches.length,
    stagingRowCount: inputs.stagingRows.length,
    stagingRiskCount: riskyRows.length + appliedBatchesWithoutSummary.length,
    riskyRows: riskyRows.slice(0, 20),
    appliedBatchesWithoutSummary: appliedBatchesWithoutSummary.slice(0, 12).map((batch) => ({ batchId: batch.id, title: batch.title })),
    guardrail: "Staging review does not promote, discard, apply, delete, or mutate API Hub staging batches or rows automatically.",
  };
}

export function buildMasterDataQuality(inputs: DataIntegrationInputs) {
  const latest = inputs.masterDataRuns[0] ?? null;
  const activeRisks = inputs.masterDataRuns.filter((run) => run.qualityScore < 85 || run.duplicateCount > 0 || run.gapCount > 0 || run.conflictCount > 0);
  return {
    masterDataRunCount: inputs.masterDataRuns.length,
    latest: latest
      ? {
          runId: latest.id,
          title: latest.title,
          status: latest.status,
          qualityScore: latest.qualityScore,
          duplicateCount: latest.duplicateCount,
          gapCount: latest.gapCount,
          staleCount: latest.staleCount,
          conflictCount: latest.conflictCount,
        }
      : null,
    masterDataRiskCount: activeRisks.reduce((sum, run) => sum + run.duplicateCount + run.gapCount + run.conflictCount + (run.qualityScore < 85 ? 1 : 0), 0),
    activeRisks: activeRisks.slice(0, 10).map((run) => ({ runId: run.id, title: run.title, qualityScore: run.qualityScore, duplicateCount: run.duplicateCount, gapCount: run.gapCount, conflictCount: run.conflictCount })),
    guardrail: "Master data quality review does not merge, overwrite, enrich, delete, or publish canonical product, supplier, customer, location, or integration records automatically.",
  };
}

export function buildTwinIngest(inputs: DataIntegrationInputs) {
  const eventsByType = inputs.twinIngestEvents.reduce<Record<string, number>>((acc, event) => {
    acc[event.type] = (acc[event.type] ?? 0) + 1;
    return acc;
  }, {});
  const nonIdempotent = inputs.twinIngestEvents.filter((event) => !event.hasIdempotencyKey);
  const staleIngest = inputs.twinIngestEvents.length === 0 || inputs.twinIngestEvents.every((event) => (ageHours(event.createdAt) ?? 9999) > 72);
  return {
    ingestEventCount: inputs.twinIngestEvents.length,
    eventsByType,
    nonIdempotentEventCount: nonIdempotent.length,
    staleIngest,
    twinIngestRiskCount: nonIdempotent.length + (staleIngest ? 1 : 0),
    nonIdempotentEvents: nonIdempotent.slice(0, 10).map((event) => ({ ingestEventId: event.id, type: event.type, createdAt: event.createdAt })),
    guardrail: "Twin ingest review does not append ingest events, upsert twin graph records, acknowledge risks, or expose partner data automatically.",
  };
}

export function buildLaunchChecklist(
  inputs: DataIntegrationInputs,
  connectorReadiness = buildConnectorReadiness(inputs),
  dataContract = buildDataContracts(inputs, connectorReadiness),
  mappingReview = buildMappingReview(inputs),
  stagingReview = buildStagingReview(inputs),
  masterDataQuality = buildMasterDataQuality(inputs),
  twinIngest = buildTwinIngest(inputs),
) {
  const pendingReviews = inputs.assistantReviewItems.filter((item) => item.status === "OPEN");
  const pendingActions = inputs.actionQueue.filter((item) => item.status === "PENDING" && /api|integration|connector|staging|mapping|master|data|twin|sync/i.test(`${item.actionKind} ${item.objectType ?? ""}`));
  const steps = [
    { key: "connector_readiness", status: connectorReadiness.blockedConnectorCount === 0 ? "PASS" : "BLOCKED", detail: `${connectorReadiness.blockedConnectorCount} connector(s) blocked.` },
    { key: "data_contracts", status: dataContract.contractGapCount === 0 ? "PASS" : "REVIEW", detail: `${dataContract.contractGapCount} data contract gap(s).` },
    { key: "mapping_review", status: mappingReview.mappingGapCount === 0 ? "PASS" : "REVIEW", detail: `${mappingReview.mappingGapCount} mapping gap(s).` },
    { key: "staging_review", status: stagingReview.stagingRiskCount === 0 ? "PASS" : "REVIEW", detail: `${stagingReview.stagingRiskCount} staging risk(s).` },
    { key: "master_data_quality", status: masterDataQuality.masterDataRiskCount === 0 ? "PASS" : "REVIEW", detail: `${masterDataQuality.masterDataRiskCount} MDM risk(s).` },
    { key: "twin_ingest", status: twinIngest.twinIngestRiskCount === 0 ? "PASS" : "REVIEW", detail: `${twinIngest.twinIngestRiskCount} twin ingest risk(s).` },
  ];
  const launchActionCount = steps.filter((step) => step.status !== "PASS").length + pendingReviews.length + pendingActions.length;
  return {
    launchActionCount,
    steps,
    pendingReviews: pendingReviews.slice(0, 12).map((item) => ({ reviewItemId: item.id, title: item.title, severity: item.severity, sourceType: item.sourceType })),
    pendingActions: pendingActions.slice(0, 12).map((item) => ({ actionQueueItemId: item.id, actionKind: item.actionKind, priority: item.priority })),
    guardrail: "Launch checklist approval does not activate connectors, apply staging rows, alter master data, create partner access, or trigger sync execution automatically.",
  };
}

export function buildDataIntegrationPacket(inputs: DataIntegrationInputs) {
  const connectorReadiness = buildConnectorReadiness(inputs);
  const dataContract = buildDataContracts(inputs, connectorReadiness);
  const mappingReview = buildMappingReview(inputs);
  const stagingReview = buildStagingReview(inputs);
  const masterDataQuality = buildMasterDataQuality(inputs);
  const twinIngest = buildTwinIngest(inputs);
  const launchChecklist = buildLaunchChecklist(inputs, connectorReadiness, dataContract, mappingReview, stagingReview, masterDataQuality, twinIngest);
  const sourceSummary = {
    connectors: inputs.connectors.length,
    ingestionRuns: inputs.ingestionRuns.length,
    mappingTemplates: inputs.mappingTemplates.length,
    mappingJobs: inputs.mappingJobs.length,
    stagingBatches: inputs.stagingBatches.length,
    stagingRows: inputs.stagingRows.length,
    assistantReviewItems: inputs.assistantReviewItems.length,
    masterDataRuns: inputs.masterDataRuns.length,
    twinIngestEvents: inputs.twinIngestEvents.length,
    actionQueueItems: inputs.actionQueue.length,
  };
  const integrationScore = clamp(
    94 -
      Math.min(30, connectorReadiness.blockedConnectorCount * 10 + connectorReadiness.attentionConnectorCount * 4) -
      Math.min(18, dataContract.contractGapCount * 4) -
      Math.min(20, mappingReview.mappingGapCount * 3) -
      Math.min(22, stagingReview.stagingRiskCount * 3) -
      Math.min(22, masterDataQuality.masterDataRiskCount * 2) -
      Math.min(16, twinIngest.twinIngestRiskCount * 4) +
      Math.min(8, connectorReadiness.readyConnectorCount * 2),
  );
  const responsePlan = {
    status: integrationScore < 65 ? "INTEGRATION_LAUNCH_BLOCKED" : integrationScore < 85 ? "INTEGRATION_OWNER_REVIEW" : "MONITOR",
    owners: ["Integration owner", "API Hub operator", "Data governance", "Security", "Master data owner", "Platform operations"],
    steps: [
      "Review connector lifecycle, auth state, sync history, and failed ingestion runs.",
      "Validate data contract and mapping gaps before staging apply or partner access changes.",
      "Resolve staging row risks and master-data quality blockers before launch.",
      "Confirm twin ingest idempotency and event freshness before relying on graph automations.",
      "Queue separate approved work before activating connectors, applying rows, changing master data, exposing partner access, or triggering sync execution.",
    ],
  };
  const rollbackPlan = {
    steps: [
      "Keep connectors, credentials, mapping templates, staging batches, staging rows, master data, twin ingest events, partner access, and downstream source records unchanged until downstream approval.",
      "If packet review is rejected, preserve packet evidence and action queue notes without changing integration configuration.",
      "Create a fresh Sprint 9 packet when connector health, mapping proposals, staging data, master-data posture, or twin ingest evidence changes materially.",
      "Use API Hub, master-data, twin, security, and partner-access workflows for any execution after approval.",
    ],
  };
  const leadershipSummary = [
    `Sprint 9 Data & Integration Control score is ${integrationScore}/100 across ${connectorReadiness.connectorCount} connector(s), ${inputs.stagingBatches.length} staging batch(es), and ${inputs.twinIngestEvents.length} twin ingest event(s).`,
    `${connectorReadiness.blockedConnectorCount} blocked connector(s), ${mappingReview.mappingGapCount} mapping gap(s), ${stagingReview.stagingRiskCount} staging risk(s), ${masterDataQuality.masterDataRiskCount} MDM risk(s), and ${twinIngest.twinIngestRiskCount} twin ingest risk(s) need review.`,
    "Packet creation does not activate connectors, change credentials, apply staging rows, alter master data, append twin ingest events, expose partner access, trigger syncs, or mutate downstream source records.",
  ].join("\n\n");
  return {
    title: `Sprint 9 Data Integration packet: score ${integrationScore}/100`,
    status: "DRAFT",
    integrationScore,
    sourceSummary,
    connectorReadiness,
    dataContract,
    mappingReview,
    stagingReview,
    masterDataQuality,
    twinIngest,
    launchChecklist,
    responsePlan,
    rollbackPlan,
    leadershipSummary,
  };
}
