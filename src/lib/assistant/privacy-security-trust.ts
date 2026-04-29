export type PrivacySecurityTrustInputs = {
  governancePackets: Array<{
    id: string;
    title: string;
    status: string;
    governanceScore: number;
    exportRecordCount: number;
    deletionRequestCount: number;
    legalHoldBlockCount: number;
    privacyRiskCount: number;
  }>;
  agentGovernancePackets: Array<{
    id: string;
    title: string;
    status: string;
    governanceScore: number;
    highRiskAgentCount: number;
    toolScopeCount: number;
    promptAssetCount: number;
  }>;
  observabilityIncidents: Array<{
    id: string;
    title: string;
    status: string;
    severity: string;
    healthScore: number;
    failureCount: number;
    evidenceGapCount: number;
    automationRiskCount: number;
  }>;
  audits: Array<{
    id: string;
    surface: string;
    answerKind: string;
    objectType: string | null;
    objectId: string | null;
    evidencePresent: boolean;
    qualityPresent: boolean;
    feedback: string | null;
  }>;
  actionQueue: Array<{
    id: string;
    actionKind: string;
    status: string;
    priority: string;
    objectType: string | null;
  }>;
  automationPolicies: Array<{
    id: string;
    actionKind: string;
    label: string;
    status: string;
    readinessScore: number;
    threshold: number;
    rollbackPlan: string | null;
  }>;
  externalEvents: Array<{
    id: string;
    eventType: string;
    title: string;
    severity: string;
    confidence: number;
    reviewState: string;
  }>;
};

function pct(part: number, whole: number) {
  if (whole <= 0) return 0;
  return Math.round((part / whole) * 100);
}

function isPrivacySignal(text: string) {
  return /privacy|consent|subject|dsr|delete|deletion|export|retention|personal|sensitive|cookie/i.test(text);
}

function isSecuritySignal(text: string) {
  return /security|zero.?trust|identity|entitlement|access|privileg|threat|attack|exception|incident|dlp|secret|token/i.test(text);
}

function severityWeight(value: string) {
  if (value === "CRITICAL") return 100;
  if (value === "HIGH") return 75;
  if (value === "MEDIUM") return 45;
  return 20;
}

export function buildConsentPosture(inputs: PrivacySecurityTrustInputs) {
  const privacyAudits = inputs.audits.filter((audit) => isPrivacySignal(`${audit.surface} ${audit.answerKind} ${audit.objectType ?? ""}`));
  const missingEvidence = privacyAudits.filter((audit) => !audit.evidencePresent && !audit.qualityPresent);
  return {
    auditSignalCount: privacyAudits.length,
    evidenceCoveragePct: pct(privacyAudits.length - missingEvidence.length, privacyAudits.length),
    consentReviewCandidates: missingEvidence.slice(0, 12).map((audit) => ({
      auditEventId: audit.id,
      surface: audit.surface,
      answerKind: audit.answerKind,
      reason: "Privacy-sensitive assistant output needs evidence or quality metadata before consent posture can be trusted.",
    })),
    guardrail: "Consent posture is privacy-safe metadata only; consent records and customer/user preferences are not changed by packet creation.",
  };
}

export function buildDataSubjectRights(inputs: PrivacySecurityTrustInputs) {
  const requests = inputs.governancePackets.flatMap((packet) => {
    const items = [];
    if (packet.exportRecordCount > 0) items.push({ packetId: packet.id, title: packet.title, requestType: "EXPORT_REVIEW", count: packet.exportRecordCount, status: packet.status });
    if (packet.deletionRequestCount > 0) items.push({ packetId: packet.id, title: packet.title, requestType: "DELETE_OR_ANONYMIZE_REVIEW", count: packet.deletionRequestCount, status: packet.status });
    return items;
  });
  const blocked = inputs.governancePackets.filter((packet) => packet.legalHoldBlockCount > 0);
  return {
    requestCount: requests.reduce((sum, item) => sum + item.count, 0),
    workflowCount: requests.length,
    legalHoldBlockCount: blocked.reduce((sum, item) => sum + item.legalHoldBlockCount, 0),
    requests,
    blockedByLegalHold: blocked.map((packet) => ({ packetId: packet.id, title: packet.title, legalHoldBlockCount: packet.legalHoldBlockCount })),
    guardrail: "DSR workflows require human review; exports, deletion, anonymization, and legal-hold changes are not executed automatically.",
  };
}

export function buildDataTransferReview(inputs: PrivacySecurityTrustInputs) {
  const transferEvents = inputs.externalEvents.filter((event) => /transfer|cross.?border|privacy|regulat|sanction|data/i.test(`${event.eventType} ${event.title}`));
  return {
    transferRiskCount: transferEvents.length,
    events: transferEvents
      .toSorted((a, b) => severityWeight(b.severity) - severityWeight(a.severity) || b.confidence - a.confidence)
      .slice(0, 10)
      .map((event) => ({
        eventId: event.id,
        title: event.title,
        eventType: event.eventType,
        severity: event.severity,
        confidence: event.confidence,
        reviewState: event.reviewState,
      })),
    requiredReviews: ["Transfer impact assessment", "Processor/subprocessor scope", "Regional disclosure readiness", "Legal basis review"],
    guardrail: "Transfer review drafts readiness work only; policies, notices, filings, and external communications require approval.",
  };
}

export function buildIdentityAccessReview(inputs: PrivacySecurityTrustInputs) {
  const riskyAgents = inputs.agentGovernancePackets.filter((packet) => packet.highRiskAgentCount > 0 || packet.governanceScore < 75);
  const identityPolicies = inputs.automationPolicies.filter((policy) => isSecuritySignal(`${policy.actionKind} ${policy.label}`));
  const weakPolicies = identityPolicies.filter((policy) => policy.status === "ENABLED" || policy.readinessScore < policy.threshold);
  const accessActions = inputs.actionQueue.filter((item) => isSecuritySignal(`${item.actionKind} ${item.objectType ?? ""}`) && item.status === "PENDING");
  return {
    identityRiskCount: riskyAgents.length + weakPolicies.length + accessActions.length,
    riskyAgents: riskyAgents.map((packet) => ({ packetId: packet.id, title: packet.title, highRiskAgentCount: packet.highRiskAgentCount, governanceScore: packet.governanceScore })),
    weakPolicies: weakPolicies.map((policy) => ({ policyId: policy.id, actionKind: policy.actionKind, status: policy.status, readinessScore: policy.readinessScore, threshold: policy.threshold })),
    pendingAccessActions: accessActions.map((item) => ({ actionQueueItemId: item.id, actionKind: item.actionKind, priority: item.priority })),
    guardrail: "Identity and entitlement review is advisory; role grants, tool scopes, and automation policies are not changed automatically.",
  };
}

export function buildSecurityExceptions(inputs: PrivacySecurityTrustInputs) {
  const exceptionActions = inputs.actionQueue.filter((item) => item.status === "PENDING" && (item.priority === "HIGH" || isSecuritySignal(item.actionKind)));
  const incidents = inputs.observabilityIncidents.filter((incident) => incident.status !== "RESOLVED" && (incident.severity === "HIGH" || incident.automationRiskCount > 0 || incident.evidenceGapCount > 0));
  return {
    exceptionCount: exceptionActions.length + incidents.length,
    queue: exceptionActions.slice(0, 12).map((item) => ({ actionQueueItemId: item.id, actionKind: item.actionKind, priority: item.priority, objectType: item.objectType })),
    incidents: incidents.slice(0, 10).map((incident) => ({
      incidentId: incident.id,
      title: incident.title,
      severity: incident.severity,
      healthScore: incident.healthScore,
      failureCount: incident.failureCount,
      evidenceGapCount: incident.evidenceGapCount,
      automationRiskCount: incident.automationRiskCount,
    })),
    guardrail: "Security exceptions are routed for review; no incident is closed and no automation is paused or enabled by packet creation.",
  };
}

export function buildThreatExposure(inputs: PrivacySecurityTrustInputs) {
  const threatEvents = inputs.externalEvents.filter((event) => isSecuritySignal(`${event.eventType} ${event.title}`));
  const negativeSecurityAudits = inputs.audits.filter((audit) => isSecuritySignal(`${audit.surface} ${audit.answerKind}`) && audit.feedback === "not_helpful");
  return {
    threatSignalCount: threatEvents.length + negativeSecurityAudits.length,
    externalThreats: threatEvents
      .toSorted((a, b) => severityWeight(b.severity) - severityWeight(a.severity) || b.confidence - a.confidence)
      .slice(0, 10)
      .map((event) => ({ eventId: event.id, title: event.title, severity: event.severity, confidence: event.confidence, reviewState: event.reviewState })),
    weakTrustSignals: negativeSecurityAudits.slice(0, 10).map((audit) => ({ auditEventId: audit.id, surface: audit.surface, answerKind: audit.answerKind })),
    guardrail: "Threat exposure output is triage evidence only; blocking, notification, enforcement, and response execution require approved downstream work.",
  };
}

export function buildTrustAssurance(
  consentPosture: ReturnType<typeof buildConsentPosture>,
  dsr: ReturnType<typeof buildDataSubjectRights>,
  identityAccess: ReturnType<typeof buildIdentityAccessReview>,
  securityExceptions: ReturnType<typeof buildSecurityExceptions>,
  threatExposure: ReturnType<typeof buildThreatExposure>,
) {
  const blockers = [
    consentPosture.consentReviewCandidates.length > 0 ? `${consentPosture.consentReviewCandidates.length} privacy/consent signal(s) lack evidence.` : null,
    dsr.legalHoldBlockCount > 0 ? `${dsr.legalHoldBlockCount} DSR/legal-hold blocker(s) require review.` : null,
    identityAccess.identityRiskCount > 0 ? `${identityAccess.identityRiskCount} identity/access risk signal(s) need control-owner review.` : null,
    securityExceptions.exceptionCount > 0 ? `${securityExceptions.exceptionCount} security exception signal(s) remain open.` : null,
    threatExposure.threatSignalCount > 0 ? `${threatExposure.threatSignalCount} threat/trust signal(s) need triage.` : null,
  ].filter((item): item is string => Boolean(item));
  return {
    status: blockers.length > 0 ? "TRUST_REVIEW_REQUIRED" : "TRUST_READY",
    owners: ["Privacy", "Security", "Legal", "IT admin", "Risk owner"],
    blockers,
    assuranceChecklist: [
      "Confirm privacy-sensitive assistant outputs have evidence or quality metadata.",
      "Review DSR export/deletion candidates against legal holds before action.",
      "Validate data transfer and regional disclosure posture.",
      "Review identity, entitlement, tool-scope, and automation-policy risks.",
      "Triage security exceptions and threat exposure before enforcement or communications.",
    ],
  };
}

export function buildPrivacySecurityTrustPacket(inputs: PrivacySecurityTrustInputs) {
  const consentPosture = buildConsentPosture(inputs);
  const dataSubjectRights = buildDataSubjectRights(inputs);
  const dataTransfer = buildDataTransferReview(inputs);
  const identityAccess = buildIdentityAccessReview(inputs);
  const securityExceptions = buildSecurityExceptions(inputs);
  const threatExposure = buildThreatExposure(inputs);
  const trustAssurance = buildTrustAssurance(consentPosture, dataSubjectRights, identityAccess, securityExceptions, threatExposure);
  const sourceSummary = {
    governancePackets: inputs.governancePackets.length,
    agentGovernancePackets: inputs.agentGovernancePackets.length,
    observabilityIncidents: inputs.observabilityIncidents.length,
    auditEvents: inputs.audits.length,
    actionQueueItems: inputs.actionQueue.length,
    automationPolicies: inputs.automationPolicies.length,
    externalEvents: inputs.externalEvents.length,
  };
  const trustScore = Math.max(
    0,
    Math.min(
      100,
      Math.round(
        100 -
          Math.min(22, consentPosture.consentReviewCandidates.length * 4) -
          Math.min(18, dataSubjectRights.legalHoldBlockCount * 5 + dataSubjectRights.workflowCount * 2) -
          Math.min(16, dataTransfer.transferRiskCount * 4) -
          Math.min(18, identityAccess.identityRiskCount * 3) -
          Math.min(18, securityExceptions.exceptionCount * 3) -
          Math.min(14, threatExposure.threatSignalCount * 3),
      ),
    ),
  );
  const responsePlan = {
    status: trustScore < 70 ? "PRIVACY_SECURITY_REVIEW" : trustScore < 85 ? "TRUST_OWNER_REVIEW" : "MONITOR",
    owners: trustAssurance.owners,
    steps: [
      "Review consent posture and privacy-sensitive evidence gaps.",
      "Route DSR export, deletion, anonymization, and legal-hold blockers to human review.",
      "Validate data transfer risks before policy, notice, or external communication changes.",
      "Review identity, entitlement, tool-scope, and automation-policy risks before granting access.",
      "Triage security exceptions and threat exposure; queue approved remediation separately.",
    ],
  };
  const rollbackPlan = {
    steps: [
      "Keep consent records, DSR artifacts, data-transfer posture, role grants, entitlements, security exceptions, threat responses, and operational source records unchanged until downstream approval.",
      "If the packet is rejected, preserve the packet and audit event as review evidence without executing remediation.",
      "Create a fresh packet when governance, agent, observability, audit, automation, or external threat evidence changes materially.",
      "Use the action queue for any approved privacy, security, identity, or trust remediation.",
    ],
  };
  const leadershipSummary = [
    `Sprint 3 Privacy, Security & Trust score is ${trustScore}/100 with ${consentPosture.consentReviewCandidates.length} consent/evidence gap${consentPosture.consentReviewCandidates.length === 1 ? "" : "s"}, ${dataSubjectRights.requestCount} DSR signal${dataSubjectRights.requestCount === 1 ? "" : "s"}, and ${identityAccess.identityRiskCount} identity/access risk${identityAccess.identityRiskCount === 1 ? "" : "s"}.`,
    `${dataTransfer.transferRiskCount} transfer risk${dataTransfer.transferRiskCount === 1 ? "" : "s"}, ${securityExceptions.exceptionCount} security exception${securityExceptions.exceptionCount === 1 ? "" : "s"}, and ${threatExposure.threatSignalCount} threat/trust signal${threatExposure.threatSignalCount === 1 ? "" : "s"} require review.`,
    "Packet creation does not mutate consent, DSR, data-transfer, identity, entitlement, security exception, threat response, automation policy, or operational source records.",
  ].join("\n\n");
  return {
    title: `Sprint 3 Privacy, Security & Trust packet: score ${trustScore}/100`,
    status: "DRAFT",
    trustScore,
    sourceSummary,
    consentPosture,
    dataSubjectRights,
    dataTransfer,
    identityAccess,
    securityExceptions,
    threatExposure,
    trustAssurance,
    responsePlan,
    rollbackPlan,
    leadershipSummary,
  };
}
