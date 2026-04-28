export type GovernanceRecordSignal = {
  id: string;
  sourceType: "AUDIT_EVENT" | "EVIDENCE_RECORD" | "REVIEW_EXAMPLE" | "PROMPT" | "OPERATING_REPORT" | "EMAIL_THREAD";
  title: string;
  status: string | null;
  createdAt: string;
  archivedAt: string | null;
  hasPersonalData: boolean;
  hasExportPayload: boolean;
  legalHold: boolean;
  objectType: string | null;
  objectId: string | null;
};

export type GovernanceInputs = {
  records: GovernanceRecordSignal[];
  retentionDays: number;
};

function ageDays(createdAt: string) {
  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) return 0;
  return Math.max(0, Math.floor((Date.now() - date.getTime()) / 86_400_000));
}

export function buildRetentionPlan(inputs: GovernanceInputs) {
  const candidates = inputs.records
    .filter((record) => !record.archivedAt && ageDays(record.createdAt) >= inputs.retentionDays)
    .map((record) => ({
      sourceId: record.id,
      sourceType: record.sourceType,
      title: record.title,
      ageDays: ageDays(record.createdAt),
      legalHold: record.legalHold,
      recommendedAction: record.legalHold ? "HOLD" : "ARCHIVE_REVIEW",
      reason: record.legalHold ? "Legal hold blocks retention action." : `Older than ${inputs.retentionDays} day retention window.`,
    }));
  return {
    retentionDays: inputs.retentionDays,
    candidateCount: candidates.length,
    candidates,
    guardrail: "Retention output is a dry-run until a governance review action is approved.",
  };
}

export function buildPrivacyReview(records: GovernanceRecordSignal[]) {
  const risks = records
    .filter((record) => record.hasPersonalData)
    .map((record) => ({
      sourceId: record.id,
      sourceType: record.sourceType,
      title: record.title,
      risk: "Potential personal or sensitive data in assistant-governed content.",
      displayTitle: `${record.sourceType}:${record.id.slice(0, 8)}`,
      safeExcerpt: "[privacy-safe excerpt withheld until export approval]",
    }));
  return {
    riskCount: risks.length,
    risks,
    displayMode: "PRIVACY_SAFE",
  };
}

export function buildExportManifest(records: GovernanceRecordSignal[]) {
  const exportable = records
    .filter((record) => record.hasExportPayload || record.sourceType === "AUDIT_EVENT" || record.sourceType === "OPERATING_REPORT")
    .map((record) => ({
      sourceId: record.id,
      sourceType: record.sourceType,
      title: record.hasPersonalData ? `${record.sourceType}:${record.id.slice(0, 8)}` : record.title,
      objectType: record.objectType,
      objectId: record.objectId,
      privacySafe: record.hasPersonalData,
      includedFields: record.hasPersonalData ? ["id", "sourceType", "status", "createdAt", "objectRef", "redactedSummary"] : ["id", "sourceType", "title", "status", "createdAt", "objectRef"],
    }));
  return {
    schemaVersion: 1,
    recordCount: exportable.length,
    records: exportable,
    guardrail: "Export manifest is privacy-safe metadata only until approved.",
  };
}

export function buildDeletionRequests(records: GovernanceRecordSignal[]) {
  const requests = records
    .filter((record) => record.hasPersonalData && !record.legalHold && record.archivedAt)
    .map((record) => ({
      sourceId: record.id,
      sourceType: record.sourceType,
      title: `${record.sourceType}:${record.id.slice(0, 8)}`,
      status: "READY_FOR_REVIEW",
      reason: "Archived personal-data record can be reviewed for deletion/anonymization.",
    }));
  return {
    requestCount: requests.length,
    requests,
    guardrail: "Deletion requests require approval and audit; source records are not deleted by packet creation.",
  };
}

export function buildLegalHoldReview(records: GovernanceRecordSignal[]) {
  const holds = records
    .filter((record) => record.legalHold)
    .map((record) => ({
      sourceId: record.id,
      sourceType: record.sourceType,
      title: record.title,
      blocks: ["RETENTION_ARCHIVE", "DELETION"],
      reason: "Record is linked to legal/audit hold context.",
    }));
  return {
    holdCount: holds.length,
    holds,
  };
}

export function buildGovernanceAuditPlan(
  retentionPlan: ReturnType<typeof buildRetentionPlan>,
  deletionRequests: ReturnType<typeof buildDeletionRequests>,
  legalHoldReview: ReturnType<typeof buildLegalHoldReview>,
) {
  return {
    steps: [
      "Review retention dry-run candidates and remove legal-hold records from archive actions.",
      "Approve privacy-safe export manifest before exposing record details.",
      "Route deletion/anonymization candidates to governance review with audit note.",
      "Verify legal-hold blockers before any destructive action.",
    ],
    blockedActions:
      legalHoldReview.holdCount > 0
        ? [`${legalHoldReview.holdCount} legal-hold record(s) block archive/delete actions.`]
        : [],
    reviewLoad: retentionPlan.candidateCount + deletionRequests.requestCount,
  };
}

export function scoreGovernance(inputs: GovernanceInputs) {
  const retentionPlan = buildRetentionPlan(inputs);
  const privacyReview = buildPrivacyReview(inputs.records);
  const deletionRequests = buildDeletionRequests(inputs.records);
  const legalHoldReview = buildLegalHoldReview(inputs.records);
  const archiveCoverage = inputs.records.length ? inputs.records.filter((record) => record.archivedAt).length / inputs.records.length : 0;
  const score =
    80 +
    Math.round(archiveCoverage * 10) -
    Math.min(25, privacyReview.riskCount * 3) -
    Math.min(20, retentionPlan.candidateCount * 2) -
    Math.min(20, deletionRequests.requestCount * 4) -
    Math.min(15, legalHoldReview.holdCount * 3);
  return Math.max(0, Math.min(100, score));
}

export function buildGovernancePacket(inputs: GovernanceInputs) {
  const retentionPlan = buildRetentionPlan(inputs);
  const privacyReview = buildPrivacyReview(inputs.records);
  const exportManifest = buildExportManifest(inputs.records);
  const deletionRequests = buildDeletionRequests(inputs.records);
  const legalHoldReview = buildLegalHoldReview(inputs.records);
  const auditPlan = buildGovernanceAuditPlan(retentionPlan, deletionRequests, legalHoldReview);
  const governanceScore = scoreGovernance(inputs);
  const sourceSummary = {
    recordCount: inputs.records.length,
    archivedCount: inputs.records.filter((record) => record.archivedAt).length,
    personalDataCount: inputs.records.filter((record) => record.hasPersonalData).length,
    legalHoldCount: legalHoldReview.holdCount,
    bySourceType: inputs.records.reduce<Record<string, number>>((acc, record) => {
      acc[record.sourceType] = (acc[record.sourceType] ?? 0) + 1;
      return acc;
    }, {}),
  };
  const leadershipSummary = [
    `Governance score is ${governanceScore}/100 across ${inputs.records.length} assistant-governed record${inputs.records.length === 1 ? "" : "s"}.`,
    `${retentionPlan.candidateCount} retention candidate${retentionPlan.candidateCount === 1 ? "" : "s"}, ${privacyReview.riskCount} privacy risk${privacyReview.riskCount === 1 ? "" : "s"}, ${deletionRequests.requestCount} deletion request${deletionRequests.requestCount === 1 ? "" : "s"}, and ${legalHoldReview.holdCount} legal-hold block${legalHoldReview.holdCount === 1 ? "" : "s"} are ready for review.`,
    "All archive, export, deletion, and legal-hold actions are review-only; packet creation does not mutate source records.",
  ].join("\n\n");
  return {
    title: `Governance packet: score ${governanceScore}/100`,
    status: "DRAFT",
    governanceScore,
    retentionCandidateCount: retentionPlan.candidateCount,
    exportRecordCount: exportManifest.recordCount,
    deletionRequestCount: deletionRequests.requestCount,
    legalHoldBlockCount: legalHoldReview.holdCount,
    privacyRiskCount: privacyReview.riskCount,
    sourceSummary,
    retentionPlan,
    exportManifest,
    deletionRequests,
    legalHoldReview,
    privacyReview,
    auditPlan,
    leadershipSummary,
  };
}
