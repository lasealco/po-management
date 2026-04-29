export type PlatformReliabilityInputs = {
  observabilityIncidents: Array<{
    id: string;
    title: string;
    status: string;
    severity: string;
    healthScore: number;
    failureCount: number;
    driftSignalCount: number;
    evidenceGapCount: number;
    automationRiskCount: number;
  }>;
  privacySecurityPackets: Array<{
    id: string;
    title: string;
    status: string;
    trustScore: number;
    privacyRiskCount: number;
    identityRiskCount: number;
    securityExceptionCount: number;
    threatSignalCount: number;
  }>;
  aiQualityReleasePackets: Array<{
    id: string;
    title: string;
    status: string;
    qualityScore: number;
    failedEvalCount: number;
    automationRiskCount: number;
    observabilityRiskCount: number;
    releaseBlockerCount: number;
  }>;
  adminControls: Array<{ id: string; controlKey: string; rolloutMode: string; packetStatus: string; updatedAt: string }>;
  connectors: Array<{ id: string; name: string; sourceKind: string; authMode: string; authState: string; status: string; lastSyncAt: string | null; healthSummary: string | null }>;
  ingestionRuns: Array<{ id: string; connectorId: string | null; connectorName: string | null; status: string; triggerKind: string; errorCode: string | null; errorMessage: string | null; enqueuedAt: string; finishedAt: string | null }>;
  automationPolicies: Array<{ id: string; policyKey: string; actionKind: string; label: string; status: string; readinessScore: number; threshold: number; rollbackPlan: string | null; lastEvaluatedAt: string | null }>;
  shadowRuns: Array<{ id: string; actionKind: string; predictedStatus: string; humanStatus: string | null; matched: boolean | null; runMode: string }>;
  auditEvents: Array<{ id: string; surface: string; answerKind: string; feedback: string | null; evidencePresent: boolean; qualityPresent: boolean; createdAt: string }>;
  actionQueue: Array<{ id: string; actionKind: string; status: string; priority: string; objectType: string | null }>;
  nowIso?: string;
};

function pct(part: number, whole: number) {
  if (whole <= 0) return 0;
  return Math.round((part / whole) * 100);
}

function daysSince(dateIso: string | null, nowIso: string) {
  if (!dateIso) return null;
  const days = Math.floor((Date.parse(nowIso) - Date.parse(dateIso)) / 86_400_000);
  return Number.isFinite(days) ? days : null;
}

function severityWeight(value: string) {
  if (value === "CRITICAL") return 100;
  if (value === "HIGH") return 75;
  if (value === "MEDIUM") return 45;
  return 20;
}

function shadowMatchRate(inputs: PlatformReliabilityInputs, actionKind: string) {
  const runs = inputs.shadowRuns.filter((run) => run.actionKind === actionKind && run.matched != null);
  return pct(runs.filter((run) => run.matched === true).length, runs.length);
}

export function buildReliabilityPosture(inputs: PlatformReliabilityInputs) {
  const openIncidents = inputs.observabilityIncidents.filter((incident) => incident.status !== "RESOLVED" && incident.status !== "CLOSED");
  const highSeverity = openIncidents.filter((incident) => incident.severity === "HIGH" || incident.severity === "CRITICAL" || incident.healthScore < 70);
  const evidenceBacked = inputs.auditEvents.filter((event) => event.evidencePresent || event.qualityPresent).length;
  const negativeFeedback = inputs.auditEvents.filter((event) => event.feedback === "not_helpful").length;
  return {
    openIncidentCount: openIncidents.length,
    highSeverityIncidentCount: highSeverity.length,
    averageHealthScore: inputs.observabilityIncidents.length === 0 ? 100 : Math.round(inputs.observabilityIncidents.reduce((sum, item) => sum + item.healthScore, 0) / inputs.observabilityIncidents.length),
    evidenceCoveragePct: pct(evidenceBacked, inputs.auditEvents.length),
    negativeFeedbackRatePct: pct(negativeFeedback, inputs.auditEvents.length),
    severeIncidents: highSeverity
      .toSorted((a, b) => severityWeight(b.severity) - severityWeight(a.severity) || a.healthScore - b.healthScore)
      .slice(0, 12)
      .map((incident) => ({ incidentId: incident.id, title: incident.title, severity: incident.severity, healthScore: incident.healthScore, failureCount: incident.failureCount, driftSignalCount: incident.driftSignalCount })),
    guardrail: "Reliability posture is review evidence only; incidents, degraded mode, runtime flags, and production traffic are not changed automatically.",
  };
}

export function buildSecurityOperations(inputs: PlatformReliabilityInputs) {
  const riskyTrustPackets = inputs.privacySecurityPackets.filter((packet) => packet.trustScore < 80 || packet.identityRiskCount > 0 || packet.securityExceptionCount > 0 || packet.threatSignalCount > 0 || packet.privacyRiskCount > 0);
  const securityActions = inputs.actionQueue.filter((item) => item.status === "PENDING" && /security|privacy|trust|identity|access|threat|incident|governance|release/i.test(`${item.actionKind} ${item.objectType ?? ""}`));
  const securityRiskCount = riskyTrustPackets.reduce((sum, packet) => sum + packet.privacyRiskCount + packet.identityRiskCount + packet.securityExceptionCount + packet.threatSignalCount, 0) + securityActions.length;
  return {
    trustPacketCount: inputs.privacySecurityPackets.length,
    riskyTrustPacketCount: riskyTrustPackets.length,
    securityRiskCount,
    riskyTrustPackets: riskyTrustPackets.slice(0, 12).map((packet) => ({
      packetId: packet.id,
      title: packet.title,
      trustScore: packet.trustScore,
      privacyRiskCount: packet.privacyRiskCount,
      identityRiskCount: packet.identityRiskCount,
      securityExceptionCount: packet.securityExceptionCount,
      threatSignalCount: packet.threatSignalCount,
    })),
    pendingSecurityActions: securityActions.slice(0, 12).map((item) => ({ actionQueueItemId: item.id, actionKind: item.actionKind, priority: item.priority, objectType: item.objectType })),
    guardrail: "Security operations output queues review only; access, roles, tools, policies, security exceptions, incident state, and external notices are not changed automatically.",
  };
}

export function buildConnectorHealth(inputs: PlatformReliabilityInputs) {
  const nowIso = inputs.nowIso ?? new Date().toISOString();
  const failedRuns = inputs.ingestionRuns.filter((run) => /fail|error|dead|cancel/i.test(run.status) || run.errorCode || run.errorMessage);
  const staleConnectors = inputs.connectors.filter((connector) => {
    const age = daysSince(connector.lastSyncAt, nowIso);
    return connector.status !== "active" || connector.authState !== "configured" || connector.lastSyncAt == null || (age != null && age > 7);
  });
  return {
    connectorCount: inputs.connectors.length,
    ingestionRunCount: inputs.ingestionRuns.length,
    connectorRiskCount: staleConnectors.length + failedRuns.length,
    staleOrUnreadyConnectors: staleConnectors.slice(0, 15).map((connector) => ({
      connectorId: connector.id,
      name: connector.name,
      sourceKind: connector.sourceKind,
      authMode: connector.authMode,
      authState: connector.authState,
      status: connector.status,
      lastSyncAt: connector.lastSyncAt,
      healthSummary: connector.healthSummary,
    })),
    failedRuns: failedRuns.slice(0, 15).map((run) => ({ runId: run.id, connectorName: run.connectorName, status: run.status, errorCode: run.errorCode, errorMessage: run.errorMessage })),
    guardrail: "Connector health review does not activate connectors, rotate credentials, retry ingestion, apply staging rows, or mutate downstream systems automatically.",
  };
}

export function buildAutomationSafety(inputs: PlatformReliabilityInputs) {
  const risks = inputs.automationPolicies
    .map((policy) => {
      const matchRate = shadowMatchRate(inputs, policy.actionKind);
      const shadowCount = inputs.shadowRuns.filter((run) => run.actionKind === policy.actionKind && run.matched != null).length;
      const riskReasons = [
        policy.status === "ENABLED" && matchRate < 85 ? "enabled_low_shadow_match" : null,
        policy.readinessScore < policy.threshold ? "below_threshold" : null,
        policy.status === "ENABLED" && !policy.rollbackPlan ? "missing_rollback_plan" : null,
        policy.status === "ENABLED" ? "enabled_requires_ops_watch" : null,
      ].filter((item): item is string => Boolean(item));
      return { ...policy, shadowMatchRatePct: matchRate, shadowCount, riskReasons };
    })
    .filter((policy) => policy.riskReasons.length > 0);
  return {
    automationPolicyCount: inputs.automationPolicies.length,
    shadowRunCount: inputs.shadowRuns.length,
    automationRiskCount: risks.length,
    risks: risks.slice(0, 15).map((policy) => ({
      policyId: policy.id,
      policyKey: policy.policyKey,
      actionKind: policy.actionKind,
      status: policy.status,
      readinessScore: policy.readinessScore,
      threshold: policy.threshold,
      shadowMatchRatePct: policy.shadowMatchRatePct,
      shadowCount: policy.shadowCount,
      riskReasons: policy.riskReasons,
      rollbackPlan: policy.rollbackPlan ?? `Pause ${policy.actionKind} and route proposed actions to human review.`,
    })),
    guardrail: "Automation safety review does not enable, pause, disable, execute, or change automation policies automatically.",
  };
}

export function buildIncidentReadiness(inputs: PlatformReliabilityInputs) {
  const reliabilityActions = inputs.actionQueue.filter((item) => item.status === "PENDING" && /incident|reliability|rollback|security|connector|automation|release|quality|observability/i.test(`${item.actionKind} ${item.objectType ?? ""}`));
  const unresolvedIncidents = inputs.observabilityIncidents.filter((incident) => incident.status !== "RESOLVED" && incident.status !== "CLOSED");
  return {
    unresolvedIncidentCount: unresolvedIncidents.length,
    pendingReliabilityActionCount: reliabilityActions.length,
    postmortemNeededCount: unresolvedIncidents.filter((incident) => incident.severity === "HIGH" || incident.failureCount > 0 || incident.automationRiskCount > 0).length,
    incidents: unresolvedIncidents.slice(0, 12).map((incident) => ({ incidentId: incident.id, title: incident.title, status: incident.status, severity: incident.severity, healthScore: incident.healthScore })),
    pendingActions: reliabilityActions.slice(0, 15).map((item) => ({ actionQueueItemId: item.id, actionKind: item.actionKind, priority: item.priority, objectType: item.objectType })),
    guardrail: "Incident readiness drafts runbook and postmortem work only; incident closure, paging, traffic changes, connector retries, and runtime rollback require approval.",
  };
}

export function buildReleaseChangeControl(inputs: PlatformReliabilityInputs) {
  const blockedReleasePackets = inputs.aiQualityReleasePackets.filter((packet) => packet.status !== "APPROVED" || packet.qualityScore < 85 || packet.releaseBlockerCount > 0 || packet.failedEvalCount > 0 || packet.automationRiskCount > 0 || packet.observabilityRiskCount > 0);
  const rolloutControls = inputs.adminControls.filter((control) => control.rolloutMode !== "PRODUCTION" || control.packetStatus !== "APPROVED");
  const changeBlockerCount = blockedReleasePackets.reduce((sum, packet) => sum + packet.releaseBlockerCount + packet.failedEvalCount + packet.automationRiskCount + packet.observabilityRiskCount, 0) + rolloutControls.length;
  return {
    releasePacketCount: inputs.aiQualityReleasePackets.length,
    blockedReleasePacketCount: blockedReleasePackets.length,
    rolloutControlCount: inputs.adminControls.length,
    changeBlockerCount,
    blockedReleasePackets: blockedReleasePackets.slice(0, 12).map((packet) => ({
      packetId: packet.id,
      title: packet.title,
      status: packet.status,
      qualityScore: packet.qualityScore,
      failedEvalCount: packet.failedEvalCount,
      releaseBlockerCount: packet.releaseBlockerCount,
    })),
    rolloutControls: rolloutControls.slice(0, 12).map((control) => ({ controlId: control.id, controlKey: control.controlKey, rolloutMode: control.rolloutMode, packetStatus: control.packetStatus, updatedAt: control.updatedAt })),
    guardrail: "Release and change control output blocks or queues review only; deployments, runtime flags, prompts, models, tools, tenant rollout mode, and production behavior are not changed automatically.",
  };
}

export function buildPlatformReliabilityPacket(inputs: PlatformReliabilityInputs) {
  const reliabilityPosture = buildReliabilityPosture(inputs);
  const securityOperations = buildSecurityOperations(inputs);
  const connectorHealth = buildConnectorHealth(inputs);
  const automationSafety = buildAutomationSafety(inputs);
  const incidentReadiness = buildIncidentReadiness(inputs);
  const releaseChangeControl = buildReleaseChangeControl(inputs);
  const operationalActionCount = incidentReadiness.pendingReliabilityActionCount + securityOperations.pendingSecurityActions.length + automationSafety.automationRiskCount + connectorHealth.connectorRiskCount;
  const reliabilityScore = Math.max(
    0,
    Math.min(
      100,
      Math.round(
        100 -
          Math.min(24, reliabilityPosture.openIncidentCount * 5 + reliabilityPosture.highSeverityIncidentCount * 7) -
          Math.min(20, securityOperations.securityRiskCount * 2) -
          Math.min(18, connectorHealth.connectorRiskCount * 3) -
          Math.min(18, automationSafety.automationRiskCount * 4) -
          Math.min(18, releaseChangeControl.changeBlockerCount * 2) -
          Math.min(12, Math.max(0, 80 - reliabilityPosture.evidenceCoveragePct)),
      ),
    ),
  );
  const sourceSummary = {
    observabilityIncidents: inputs.observabilityIncidents.length,
    privacySecurityPackets: inputs.privacySecurityPackets.length,
    aiQualityReleasePackets: inputs.aiQualityReleasePackets.length,
    adminControls: inputs.adminControls.length,
    connectors: inputs.connectors.length,
    ingestionRuns: inputs.ingestionRuns.length,
    automationPolicies: inputs.automationPolicies.length,
    shadowRuns: inputs.shadowRuns.length,
    auditEvents: inputs.auditEvents.length,
    actionQueueItems: inputs.actionQueue.length,
    guardrail: "Sprint 14 creates review packets only; incidents, access, secrets, connectors, ingestion, automation policies, runtime flags, releases, deployments, traffic, and security responses are never mutated silently.",
  };
  const responsePlan = {
    status: reliabilityScore < 70 ? "PLATFORM_OPS_REVIEW_REQUIRED" : reliabilityScore < 85 ? "SRE_SECURITY_OWNER_REVIEW" : "MONITOR",
    owners: ["Platform/SRE", "Security", "AI release owner", "Integration owner", "Tenant operations", "Product leadership"],
    steps: [
      "Review open observability incidents, health score, evidence coverage, and negative feedback.",
      "Triage security/trust packets and pending security actions before access, policy, or incident changes.",
      "Review connector auth, sync freshness, and failed ingestion evidence before retries or credential work.",
      "Validate automation shadow-match, readiness thresholds, and rollback plans before any enable/pause/change.",
      "Block release/change work until AI quality gates, rollout controls, and rollback evidence are approved.",
    ],
    guardrail: "Response plan is review-only and does not page teams, change runtime behavior, alter security controls, retry connectors, pause automations, or deploy releases automatically.",
  };
  const rollbackPlan = {
    steps: [
      "Keep incidents, connectors, secrets, ingestion runs, access controls, automation policies, rollout modes, prompts, models, tools, runtime flags, deployments, and traffic unchanged until downstream approval.",
      "If review rejects the packet, preserve the evidence snapshot and notes for audit without executing platform operations.",
      "Use action queue approval before pausing automation, retrying ingestion, rotating credentials, changing rollout mode, rolling back runtime behavior, or sending security/customer communications.",
      "Create a fresh packet when observability, trust/security, connector, automation, release, admin, or audit evidence changes materially.",
    ],
    guardrail: "Rollback plan is operational guidance only; it does not revert deployments, disable connectors, rotate credentials, revoke access, pause automation, or mutate production state automatically.",
  };
  const leadershipSummary = [
    `Platform Reliability & Security Operations score ${reliabilityScore}/100 across ${inputs.observabilityIncidents.length} observability incident${inputs.observabilityIncidents.length === 1 ? "" : "s"}, ${inputs.connectors.length} connector${inputs.connectors.length === 1 ? "" : "s"}, and ${inputs.automationPolicies.length} automation polic${inputs.automationPolicies.length === 1 ? "y" : "ies"}.`,
    `${reliabilityPosture.openIncidentCount} open incident${reliabilityPosture.openIncidentCount === 1 ? "" : "s"}, ${securityOperations.securityRiskCount} security risk signal${securityOperations.securityRiskCount === 1 ? "" : "s"}, ${connectorHealth.connectorRiskCount} connector risk${connectorHealth.connectorRiskCount === 1 ? "" : "s"}, ${automationSafety.automationRiskCount} automation risk${automationSafety.automationRiskCount === 1 ? "" : "s"}, and ${releaseChangeControl.changeBlockerCount} change blocker${releaseChangeControl.changeBlockerCount === 1 ? "" : "s"} require review.`,
    "The packet is approval-gated and does not mutate incidents, access, secrets, connectors, ingestion, automations, rollout controls, runtime flags, deployments, traffic, or security/customer communications automatically.",
  ].join("\n\n");
  return {
    title: `Sprint 14 Platform Reliability & Security Operations packet: score ${reliabilityScore}/100`,
    status: "DRAFT",
    reliabilityScore,
    openIncidentCount: reliabilityPosture.openIncidentCount,
    securityRiskCount: securityOperations.securityRiskCount,
    connectorRiskCount: connectorHealth.connectorRiskCount,
    automationRiskCount: automationSafety.automationRiskCount,
    changeBlockerCount: releaseChangeControl.changeBlockerCount,
    operationalActionCount,
    sourceSummary,
    reliabilityPosture,
    securityOperations,
    connectorHealth,
    automationSafety,
    incidentReadiness,
    releaseChangeControl,
    responsePlan,
    rollbackPlan,
    leadershipSummary,
  };
}
