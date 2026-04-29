export type EnterpriseOsInputs = {
  operatingReports: Array<{ id: string; title: string; status: string; score: number }>;
  autonomousLoops: Array<{ id: string; title: string; status: string; loopScore: number; automationMode: string; observedSignalCount: number; proposedActionCount: number; anomalyCount: number; learningCount: number }>;
  valuePackets: Array<{ id: string; title: string; status: string; valueScore: number; adoptionScore: number; totalEstimatedValue: number; roiPct: number }>;
  executivePackets: Array<{ id: string; title: string; status: string; executiveScore: number; strategyRiskCount: number; decisionCount: number; learningSignalCount: number }>;
  agentGovernancePackets: Array<{ id: string; title: string; status: string; governanceScore: number; highRiskAgentCount: number; observabilitySignalCount: number }>;
  aiQualityPackets: Array<{ id: string; title: string; status: string; qualityScore: number; failedEvalCount: number; releaseBlockerCount: number; automationRiskCount: number }>;
  platformReliabilityPackets: Array<{ id: string; title: string; status: string; reliabilityScore: number; openIncidentCount: number; securityRiskCount: number; connectorRiskCount: number; automationRiskCount: number; changeBlockerCount: number }>;
  tenantRolloutPackets: Array<{ id: string; title: string; status: string; rolloutScore: number; adoptionRiskCount: number; supportRiskCount: number; cutoverBlockerCount: number }>;
  financePackets: Array<{ id: string; title: string; status: string; financeScore: number; accountingBlockerCount: number; billingExceptionCount: number; closeControlGapCount: number }>;
  productLifecyclePackets: Array<{ id: string; title: string; status: string; lifecycleScore: number; passportGapCount: number; supplierComplianceGapCount: number; sustainabilityGapCount: number }>;
  advancedProgramPackets: Array<{ id: string; ampNumber: number; programKey: string; programTitle: string; title: string; status: string; programScore: number; riskCount: number; recommendationCount: number; approvalStepCount: number }>;
  auditEvents: Array<{ id: string; surface: string; answerKind: string; feedback: string | null; evidencePresent: boolean; qualityPresent: boolean; createdAt: string }>;
  actionQueue: Array<{ id: string; actionKind: string; status: string; priority: string; objectType: string | null }>;
};

function avg(values: number[], fallback = 0) {
  if (values.length === 0) return fallback;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function pct(part: number, whole: number) {
  if (whole <= 0) return 0;
  return Math.round((part / whole) * 100);
}

export function buildEnterpriseTelemetry(inputs: EnterpriseOsInputs) {
  const evidenceBacked = inputs.auditEvents.filter((event) => event.evidencePresent || event.qualityPresent).length;
  const negativeFeedback = inputs.auditEvents.filter((event) => event.feedback === "not_helpful").length;
  const pendingActions = inputs.actionQueue.filter((item) => item.status === "PENDING");
  return {
    operatingSignalCount: inputs.auditEvents.length + inputs.actionQueue.length + inputs.autonomousLoops.reduce((sum, loop) => sum + loop.observedSignalCount, 0),
    auditEventCount: inputs.auditEvents.length,
    actionQueueCount: inputs.actionQueue.length,
    pendingActionCount: pendingActions.length,
    highPriorityActionCount: pendingActions.filter((item) => item.priority === "HIGH").length,
    evidenceCoveragePct: pct(evidenceBacked, inputs.auditEvents.length),
    negativeFeedbackRatePct: pct(negativeFeedback, inputs.auditEvents.length),
    operatingReportScore: avg(inputs.operatingReports.map((report) => report.score), 0),
    guardrail: "Enterprise telemetry is read-only evidence; audit logs, action queue records, operating reports, and source systems are not changed automatically.",
  };
}

export function buildAutonomyReadiness(inputs: EnterpriseOsInputs) {
  const loopScore = avg(inputs.autonomousLoops.map((loop) => loop.loopScore), 0);
  const controlled = inputs.autonomousLoops.filter((loop) => loop.automationMode === "CONTROLLED_AUTOMATION");
  const riskyLoops = inputs.autonomousLoops.filter((loop) => loop.status !== "APPROVED" || loop.anomalyCount > 0 || loop.proposedActionCount > 0 || loop.loopScore < 75);
  const qualityRisks = inputs.aiQualityPackets.filter((packet) => packet.status !== "APPROVED" || packet.qualityScore < 85 || packet.releaseBlockerCount > 0 || packet.failedEvalCount > 0 || packet.automationRiskCount > 0);
  const platformRisks = inputs.platformReliabilityPackets.filter((packet) => packet.status !== "APPROVED" || packet.reliabilityScore < 85 || packet.openIncidentCount > 0 || packet.automationRiskCount > 0 || packet.changeBlockerCount > 0);
  const autonomyMode = qualityRisks.length > 0 || platformRisks.length > 0 || riskyLoops.length > 0 ? "REVIEW_ONLY" : controlled.length > 0 ? "CONTROLLED_AUTOMATION_READY" : "SHADOW_ONLY";
  return {
    autonomyMode,
    loopCount: inputs.autonomousLoops.length,
    averageLoopScore: loopScore,
    controlledLoopCount: controlled.length,
    autonomyRiskCount: riskyLoops.length + qualityRisks.length + platformRisks.length,
    riskyLoops: riskyLoops.slice(0, 10).map((loop) => ({ loopId: loop.id, title: loop.title, loopScore: loop.loopScore, automationMode: loop.automationMode, anomalyCount: loop.anomalyCount, proposedActionCount: loop.proposedActionCount })),
    qualityRisks: qualityRisks.slice(0, 10).map((packet) => ({ packetId: packet.id, title: packet.title, qualityScore: packet.qualityScore, releaseBlockerCount: packet.releaseBlockerCount, failedEvalCount: packet.failedEvalCount })),
    platformRisks: platformRisks.slice(0, 10).map((packet) => ({ packetId: packet.id, title: packet.title, reliabilityScore: packet.reliabilityScore, openIncidentCount: packet.openIncidentCount, changeBlockerCount: packet.changeBlockerCount })),
    guardrail: "Autonomy readiness does not expand automation, approve loops, publish releases, alter runtime flags, or execute source-system actions automatically.",
  };
}

export function buildGovernanceReliability(inputs: EnterpriseOsInputs) {
  const governanceRisks = inputs.agentGovernancePackets.filter((packet) => packet.status !== "CERTIFIED" || packet.governanceScore < 85 || packet.highRiskAgentCount > 0 || packet.observabilitySignalCount > 0);
  const reliabilityRisks = inputs.platformReliabilityPackets.filter((packet) => packet.openIncidentCount > 0 || packet.securityRiskCount > 0 || packet.connectorRiskCount > 0 || packet.changeBlockerCount > 0);
  const executiveRisks = inputs.executivePackets.filter((packet) => packet.status !== "APPROVED" || packet.executiveScore < 80 || packet.strategyRiskCount > 0);
  return {
    governanceRiskCount: governanceRisks.length + reliabilityRisks.length + executiveRisks.length,
    certifiedAgentPacketCount: inputs.agentGovernancePackets.filter((packet) => packet.status === "CERTIFIED").length,
    reliabilityPacketCount: inputs.platformReliabilityPackets.length,
    executivePacketCount: inputs.executivePackets.length,
    governanceRisks: governanceRisks.slice(0, 10).map((packet) => ({ packetId: packet.id, title: packet.title, governanceScore: packet.governanceScore, highRiskAgentCount: packet.highRiskAgentCount })),
    reliabilityRisks: reliabilityRisks.slice(0, 10).map((packet) => ({ packetId: packet.id, title: packet.title, reliabilityScore: packet.reliabilityScore, openIncidentCount: packet.openIncidentCount, securityRiskCount: packet.securityRiskCount })),
    executiveRisks: executiveRisks.slice(0, 10).map((packet) => ({ packetId: packet.id, title: packet.title, executiveScore: packet.executiveScore, strategyRiskCount: packet.strategyRiskCount })),
    guardrail: "Governance and reliability output is advisory; agent certification, security controls, incident state, board materials, and reliability operations remain human-approved.",
  };
}

export function buildValueExecution(inputs: EnterpriseOsInputs) {
  const valueRiskPackets = inputs.valuePackets.filter((packet) => packet.status !== "APPROVED" || packet.valueScore < 75 || packet.adoptionScore < 70);
  const rolloutRisks = inputs.tenantRolloutPackets.filter((packet) => packet.status !== "APPROVED" || packet.rolloutScore < 80 || packet.adoptionRiskCount > 0 || packet.supportRiskCount > 0 || packet.cutoverBlockerCount > 0);
  const financeRisks = inputs.financePackets.filter((packet) => packet.status !== "APPROVED" || packet.financeScore < 80 || packet.accountingBlockerCount > 0 || packet.billingExceptionCount > 0 || packet.closeControlGapCount > 0);
  const totalEstimatedValue = Math.round(inputs.valuePackets.reduce((sum, packet) => sum + packet.totalEstimatedValue, 0));
  return {
    valueRiskCount: valueRiskPackets.length + financeRisks.length,
    rolloutRiskCount: rolloutRisks.length,
    totalEstimatedValue,
    averageRoiPct: avg(inputs.valuePackets.map((packet) => packet.roiPct), 0),
    averageAdoptionScore: avg(inputs.valuePackets.map((packet) => packet.adoptionScore), 0),
    valueRisks: valueRiskPackets.slice(0, 10).map((packet) => ({ packetId: packet.id, title: packet.title, valueScore: packet.valueScore, adoptionScore: packet.adoptionScore, roiPct: packet.roiPct })),
    rolloutRisks: rolloutRisks.slice(0, 10).map((packet) => ({ packetId: packet.id, title: packet.title, rolloutScore: packet.rolloutScore, adoptionRiskCount: packet.adoptionRiskCount, cutoverBlockerCount: packet.cutoverBlockerCount })),
    financeRisks: financeRisks.slice(0, 10).map((packet) => ({ packetId: packet.id, title: packet.title, financeScore: packet.financeScore, accountingBlockerCount: packet.accountingBlockerCount, closeControlGapCount: packet.closeControlGapCount })),
    guardrail: "Value execution does not book savings, change accounting state, enable tenants, send communications, close finance controls, or mutate adoption telemetry automatically.",
  };
}

export function buildDomainOrchestration(inputs: EnterpriseOsInputs) {
  const domainPrograms = inputs.advancedProgramPackets.filter((packet) => packet.status !== "APPROVED" || packet.programScore < 75 || packet.riskCount > 0 || packet.approvalStepCount === 0);
  const productRisks = inputs.productLifecyclePackets.filter((packet) => packet.status !== "APPROVED" || packet.lifecycleScore < 80 || packet.passportGapCount > 0 || packet.supplierComplianceGapCount > 0 || packet.sustainabilityGapCount > 0);
  const domainControlCount = inputs.advancedProgramPackets.length + inputs.productLifecyclePackets.length + inputs.financePackets.length + inputs.tenantRolloutPackets.length;
  return {
    domainControlCount,
    domainRiskCount: domainPrograms.length + productRisks.length,
    approvedProgramCount: inputs.advancedProgramPackets.filter((packet) => packet.status === "APPROVED").length,
    productLifecyclePacketCount: inputs.productLifecyclePackets.length,
    programRisks: domainPrograms.slice(0, 15).map((packet) => ({ packetId: packet.id, ampNumber: packet.ampNumber, programTitle: packet.programTitle, programScore: packet.programScore, riskCount: packet.riskCount, recommendationCount: packet.recommendationCount })),
    productRisks: productRisks.slice(0, 10).map((packet) => ({ packetId: packet.id, title: packet.title, lifecycleScore: packet.lifecycleScore, passportGapCount: packet.passportGapCount, supplierComplianceGapCount: packet.supplierComplianceGapCount })),
    guardrail: "Domain orchestration reviews program and product controls only; it does not mutate product records, supplier records, finance records, tenant settings, or operational domain systems.",
  };
}

export function buildCommandCouncil(input: {
  autonomy: ReturnType<typeof buildAutonomyReadiness>;
  governance: ReturnType<typeof buildGovernanceReliability>;
  value: ReturnType<typeof buildValueExecution>;
  domains: ReturnType<typeof buildDomainOrchestration>;
  telemetry: ReturnType<typeof buildEnterpriseTelemetry>;
}) {
  const blockers = [
    input.autonomy.autonomyRiskCount > 0 ? `${input.autonomy.autonomyRiskCount} autonomy/release/platform blocker(s).` : null,
    input.governance.governanceRiskCount > 0 ? `${input.governance.governanceRiskCount} governance/reliability/executive risk(s).` : null,
    input.value.valueRiskCount > 0 ? `${input.value.valueRiskCount} value/finance risk(s).` : null,
    input.value.rolloutRiskCount > 0 ? `${input.value.rolloutRiskCount} rollout risk(s).` : null,
    input.domains.domainRiskCount > 0 ? `${input.domains.domainRiskCount} domain/product risk(s).` : null,
    input.telemetry.highPriorityActionCount > 0 ? `${input.telemetry.highPriorityActionCount} high-priority action(s) waiting.` : null,
  ].filter((item): item is string => Boolean(item));
  return {
    status: blockers.length > 0 ? "ENTERPRISE_COUNCIL_REVIEW" : "READY_FOR_CONTROLLED_EXPANSION",
    blockerCount: blockers.length,
    blockers,
    owners: ["CEO/COO", "AI platform owner", "SRE/security", "Finance/controller", "Product/compliance", "Tenant rollout", "Domain owners"],
    cadence: ["Daily exception standup", "Weekly autonomy/release review", "Monthly value and controls council", "Quarterly board-ready operating report"],
    guardrail: "Command council coordinates review; it does not approve budgets, certify agents, change tenant rollout, execute automations, publish reports, or mutate source records automatically.",
  };
}

export function buildEnterpriseOsPacket(inputs: EnterpriseOsInputs) {
  const enterpriseTelemetry = buildEnterpriseTelemetry(inputs);
  const autonomyReadiness = buildAutonomyReadiness(inputs);
  const governanceReliability = buildGovernanceReliability(inputs);
  const valueExecution = buildValueExecution(inputs);
  const domainOrchestration = buildDomainOrchestration(inputs);
  const commandCouncil = buildCommandCouncil({ autonomy: autonomyReadiness, governance: governanceReliability, value: valueExecution, domains: domainOrchestration, telemetry: enterpriseTelemetry });
  const executionActionCount = enterpriseTelemetry.pendingActionCount + autonomyReadiness.autonomyRiskCount + commandCouncil.blockerCount;
  const enterpriseScore = Math.max(
    0,
    Math.min(
      100,
      Math.round(
        100 -
          Math.min(22, autonomyReadiness.autonomyRiskCount * 4) -
          Math.min(20, governanceReliability.governanceRiskCount * 3) -
          Math.min(18, valueExecution.valueRiskCount * 4) -
          Math.min(18, valueExecution.rolloutRiskCount * 4) -
          Math.min(18, domainOrchestration.domainRiskCount * 3) -
          Math.min(12, enterpriseTelemetry.highPriorityActionCount * 3) -
          Math.min(12, Math.max(0, 80 - enterpriseTelemetry.evidenceCoveragePct)),
      ),
    ),
  );
  const sourceSummary = {
    operatingReports: inputs.operatingReports.length,
    autonomousLoops: inputs.autonomousLoops.length,
    valuePackets: inputs.valuePackets.length,
    executivePackets: inputs.executivePackets.length,
    agentGovernancePackets: inputs.agentGovernancePackets.length,
    aiQualityPackets: inputs.aiQualityPackets.length,
    platformReliabilityPackets: inputs.platformReliabilityPackets.length,
    tenantRolloutPackets: inputs.tenantRolloutPackets.length,
    financePackets: inputs.financePackets.length,
    productLifecyclePackets: inputs.productLifecyclePackets.length,
    advancedProgramPackets: inputs.advancedProgramPackets.length,
    auditEvents: inputs.auditEvents.length,
    actionQueueItems: inputs.actionQueue.length,
    guardrail: "Sprint 15 creates review packets only; enterprise automation, budgets, finance state, tenant rollout, product records, security operations, runtime flags, deployments, and source systems are never mutated silently.",
  };
  const responsePlan = {
    status: enterpriseScore < 70 ? "ENTERPRISE_OS_REVIEW_REQUIRED" : enterpriseScore < 85 ? "EXECUTIVE_CONTROL_REVIEW" : "MONITOR_FOR_CONTROLLED_EXPANSION",
    owners: commandCouncil.owners,
    steps: [
      "Review autonomy, AI release, platform reliability, and action queue blockers before expanding automation.",
      "Confirm agent governance, executive strategy, and reliability controls before board/customer-facing claims.",
      "Validate value, finance, rollout, product lifecycle, and domain program evidence before enterprise-wide operating changes.",
      "Use command council cadence and action queue approval before budgets, rollouts, automations, releases, communications, or source-system changes.",
    ],
    guardrail: "Response plan is review-only and does not execute automations, approve spend, change finance/product/tenant records, publish reports, or alter production behavior automatically.",
  };
  const rollbackPlan = {
    steps: [
      "Keep enterprise OS v2 in review-only mode when autonomy, release, reliability, governance, value, rollout, finance, product, or domain blockers exist.",
      "Leave budgets, tenant settings, finance state, product records, supplier records, security operations, runtime flags, deployments, prompts, models, tools, and source systems unchanged until downstream approval.",
      "If review rejects the packet, preserve the evidence snapshot and notes for audit without executing enterprise operating changes.",
      "Create a fresh packet when operating loops, reliability, governance, value, rollout, finance, product, program, audit, or action evidence changes materially.",
    ],
    guardrail: "Rollback plan is governance guidance only; it does not revert deployments, pause automations, alter policies, revoke access, change tenants, post finance entries, or mutate production records automatically.",
  };
  const leadershipSummary = [
    `Autonomous Enterprise OS v2 score ${enterpriseScore}/100 in ${autonomyReadiness.autonomyMode} mode across ${enterpriseTelemetry.operatingSignalCount} operating signal${enterpriseTelemetry.operatingSignalCount === 1 ? "" : "s"} and ${domainOrchestration.domainControlCount} domain control${domainOrchestration.domainControlCount === 1 ? "" : "s"}.`,
    `${governanceReliability.governanceRiskCount} governance/reliability risk${governanceReliability.governanceRiskCount === 1 ? "" : "s"}, ${valueExecution.valueRiskCount} value/finance risk${valueExecution.valueRiskCount === 1 ? "" : "s"}, ${valueExecution.rolloutRiskCount} rollout risk${valueExecution.rolloutRiskCount === 1 ? "" : "s"}, ${domainOrchestration.domainRiskCount} domain risk${domainOrchestration.domainRiskCount === 1 ? "" : "s"}, and ${executionActionCount} execution action${executionActionCount === 1 ? "" : "s"} require review.`,
    "The packet is approval-gated and does not mutate enterprise automation, budgets, finance state, tenant rollout, product records, security operations, runtime flags, deployments, communications, or source systems automatically.",
  ].join("\n\n");
  return {
    title: `Sprint 15 Autonomous Enterprise OS v2 packet: score ${enterpriseScore}/100`,
    status: "DRAFT",
    enterpriseScore,
    autonomyMode: autonomyReadiness.autonomyMode,
    operatingSignalCount: enterpriseTelemetry.operatingSignalCount,
    domainControlCount: domainOrchestration.domainControlCount,
    governanceRiskCount: governanceReliability.governanceRiskCount,
    valueRiskCount: valueExecution.valueRiskCount,
    rolloutRiskCount: valueExecution.rolloutRiskCount,
    executionActionCount,
    sourceSummary,
    enterpriseTelemetry,
    autonomyReadiness,
    governanceReliability,
    valueExecution,
    domainOrchestration,
    commandCouncil,
    responsePlan,
    rollbackPlan,
    leadershipSummary,
  };
}
