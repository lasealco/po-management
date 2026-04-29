export type EnterpriseRiskControlsInputs = {
  contractPackets: Array<{
    id: string;
    title: string;
    status: string;
    complianceScore: number;
    obligationCount: number;
    renewalRiskCount: number;
    complianceGapCount: number;
  }>;
  governancePackets: Array<{
    id: string;
    title: string;
    status: string;
    governanceScore: number;
    retentionCandidateCount: number;
    legalHoldBlockCount: number;
    privacyRiskCount: number;
  }>;
  riskRooms: Array<{
    id: string;
    title: string;
    status: string;
    severity: string;
    riskScore: number;
  }>;
  auditEvents: Array<{
    id: string;
    surface: string;
    answerKind: string;
    evidencePresent: boolean;
    qualityPresent: boolean;
    feedback: string | null;
  }>;
  actionQueue: Array<{
    id: string;
    actionKind: string;
    status: string;
    priority: string;
  }>;
  externalEvents: Array<{
    id: string;
    eventType: string;
    title: string;
    severity: string;
    confidence: number;
    reviewState: string;
    sourceCount: number;
  }>;
};

function pct(part: number, whole: number) {
  if (whole <= 0) return 0;
  return Math.round((part / whole) * 100);
}

function severityWeight(value: string) {
  if (value === "CRITICAL") return 100;
  if (value === "HIGH") return 75;
  if (value === "MEDIUM") return 45;
  return 20;
}

export function buildObligationGraph(inputs: EnterpriseRiskControlsInputs) {
  const contractObligations = inputs.contractPackets.map((packet) => ({
    sourceType: "CONTRACT_COMPLIANCE_PACKET",
    sourceId: packet.id,
    title: packet.title,
    obligationCount: packet.obligationCount,
    riskCount: packet.renewalRiskCount + packet.complianceGapCount,
    status: packet.status,
  }));
  const governanceObligations = inputs.governancePackets.map((packet) => ({
    sourceType: "GOVERNANCE_PACKET",
    sourceId: packet.id,
    title: packet.title,
    obligationCount: packet.retentionCandidateCount + packet.legalHoldBlockCount + packet.privacyRiskCount,
    riskCount: packet.legalHoldBlockCount + packet.privacyRiskCount,
    status: packet.status,
  }));
  const obligations = [...contractObligations, ...governanceObligations];
  return {
    obligationCount: obligations.reduce((sum, item) => sum + item.obligationCount, 0),
    sourceCount: obligations.length,
    obligations,
    ownerGroups: ["Legal", "Compliance", "Risk", "Audit", "Control owner"],
  };
}

export function buildControlTesting(inputs: EnterpriseRiskControlsInputs) {
  const highPriorityOpen = inputs.actionQueue.filter((item) => item.status === "PENDING" && item.priority === "HIGH");
  const weakGovernance = inputs.governancePackets.filter((packet) => packet.governanceScore < 75 || packet.legalHoldBlockCount > 0);
  const weakContracts = inputs.contractPackets.filter((packet) => packet.complianceScore < 75 || packet.complianceGapCount > 0);
  const gaps = [
    ...highPriorityOpen.map((item) => ({ sourceType: "ACTION_QUEUE", sourceId: item.id, control: item.actionKind, severity: "HIGH", finding: "High-priority control work remains pending." })),
    ...weakGovernance.map((packet) => ({ sourceType: "GOVERNANCE_PACKET", sourceId: packet.id, control: packet.title, severity: "MEDIUM", finding: "Governance score or legal-hold posture requires control owner review." })),
    ...weakContracts.map((packet) => ({ sourceType: "CONTRACT_COMPLIANCE_PACKET", sourceId: packet.id, control: packet.title, severity: "MEDIUM", finding: "Contract compliance score or evidence gaps require remediation." })),
  ];
  return {
    testedControlCount: inputs.actionQueue.length + inputs.governancePackets.length + inputs.contractPackets.length,
    controlGapCount: gaps.length,
    gaps,
    guardrail: "Control tests create review evidence only; control records and operational source systems are not changed automatically.",
  };
}

export function buildAuditEvidence(inputs: EnterpriseRiskControlsInputs) {
  const evidenceBacked = inputs.auditEvents.filter((event) => event.evidencePresent || event.qualityPresent);
  const weak = inputs.auditEvents.filter((event) => !event.evidencePresent && !event.qualityPresent);
  return {
    auditEventCount: inputs.auditEvents.length,
    evidenceBackedCount: evidenceBacked.length,
    weakEvidenceCount: weak.length,
    evidenceCoveragePct: pct(evidenceBacked.length, inputs.auditEvents.length),
    weakEvidence: weak.slice(0, 12).map((event) => ({ auditEventId: event.id, surface: event.surface, answerKind: event.answerKind })),
  };
}

export function buildContractPerformance(inputs: EnterpriseRiskControlsInputs) {
  const riskPackets = inputs.contractPackets.filter((packet) => packet.complianceScore < 80 || packet.renewalRiskCount > 0 || packet.complianceGapCount > 0);
  return {
    packetCount: inputs.contractPackets.length,
    riskPacketCount: riskPackets.length,
    obligationCount: inputs.contractPackets.reduce((sum, packet) => sum + packet.obligationCount, 0),
    renewalRiskCount: inputs.contractPackets.reduce((sum, packet) => sum + packet.renewalRiskCount, 0),
    complianceGapCount: inputs.contractPackets.reduce((sum, packet) => sum + packet.complianceGapCount, 0),
    riskPackets: riskPackets.slice(0, 10).map((packet) => ({
      packetId: packet.id,
      title: packet.title,
      complianceScore: packet.complianceScore,
      renewalRiskCount: packet.renewalRiskCount,
      complianceGapCount: packet.complianceGapCount,
    })),
  };
}

export function buildRegulatoryHorizon(inputs: EnterpriseRiskControlsInputs) {
  const regulatory = inputs.externalEvents.filter((event) => /regulat|compliance|sanction|legal|customs|policy/i.test(`${event.eventType} ${event.title}`));
  return {
    eventCount: regulatory.length,
    events: regulatory.slice(0, 10).map((event) => ({
      eventId: event.id,
      title: event.title,
      eventType: event.eventType,
      severity: event.severity,
      confidence: event.confidence,
      reviewState: event.reviewState,
    })),
    guardrail: "Regulatory horizon output drafts readiness work only; filings, policies, and external communications require approval.",
  };
}

export function buildExternalRisk(inputs: EnterpriseRiskControlsInputs) {
  const activeEvents = inputs.externalEvents.filter((event) => ["NEW", "UNDER_REVIEW", "WATCH", "ACTION_REQUIRED"].includes(event.reviewState));
  const highRooms = inputs.riskRooms.filter((room) => room.riskScore >= 70 || room.severity === "HIGH" || room.severity === "CRITICAL");
  return {
    activeEventCount: activeEvents.length,
    highRiskRoomCount: highRooms.length,
    topEvents: activeEvents
      .toSorted((a, b) => severityWeight(b.severity) - severityWeight(a.severity) || b.confidence - a.confidence)
      .slice(0, 10)
      .map((event) => ({ eventId: event.id, title: event.title, severity: event.severity, confidence: event.confidence, sourceCount: event.sourceCount })),
    highRiskRooms: highRooms.slice(0, 10).map((room) => ({ roomId: room.id, title: room.title, severity: room.severity, riskScore: room.riskScore, status: room.status })),
  };
}

export function buildEnterpriseRiskControlsPacket(inputs: EnterpriseRiskControlsInputs) {
  const obligationGraph = buildObligationGraph(inputs);
  const controlTesting = buildControlTesting(inputs);
  const auditEvidence = buildAuditEvidence(inputs);
  const contractPerformance = buildContractPerformance(inputs);
  const regulatoryHorizon = buildRegulatoryHorizon(inputs);
  const externalRisk = buildExternalRisk(inputs);
  const sourceSummary = {
    contractPackets: inputs.contractPackets.length,
    governancePackets: inputs.governancePackets.length,
    riskRooms: inputs.riskRooms.length,
    auditEvents: inputs.auditEvents.length,
    actionQueueItems: inputs.actionQueue.length,
    externalEvents: inputs.externalEvents.length,
  };
  const riskScore = Math.max(
    0,
    Math.min(
      100,
      Math.round(
        25 +
          Math.min(20, controlTesting.controlGapCount * 3) +
          Math.min(20, contractPerformance.riskPacketCount * 5) +
          Math.min(18, externalRisk.highRiskRoomCount * 6 + externalRisk.activeEventCount) +
          Math.min(12, regulatoryHorizon.eventCount * 3) +
          Math.min(15, Math.max(0, 75 - auditEvidence.evidenceCoveragePct)),
      ),
    ),
  );
  const responsePlan = {
    status: riskScore >= 75 ? "EXECUTIVE_REVIEW_REQUIRED" : riskScore >= 50 ? "CONTROL_OWNER_REVIEW" : "MONITOR",
    owners: ["Risk", "Compliance", "Audit", "Legal", "Control owner"],
    steps: [
      "Review obligation graph and assign accountable owners for high-risk obligations.",
      "Validate control gaps against audit evidence before remediation work starts.",
      "Review contract performance risks and renewal blockers with legal/procurement owners.",
      "Assess regulatory horizon and external risk events before policy, filing, or communication changes.",
      "Queue control remediation for human approval; do not mutate source systems from packet creation.",
    ],
  };
  const rollbackPlan = {
    steps: [
      "Keep obligations, controls, contracts, policies, external events, audit evidence, and operational source records unchanged until separate downstream approval.",
      "If review rejects the packet, preserve evidence and action queue notes for audit.",
      "Create a fresh packet when contract, governance, audit, or external risk evidence changes materially.",
      "Use AssistantAuditEvent records to explain approvals, rejections, and superseded control decisions.",
    ],
  };
  const leadershipSummary = [
    `Sprint 2 Enterprise Risk & Controls score is ${riskScore}/100 across ${obligationGraph.obligationCount} obligation signal${obligationGraph.obligationCount === 1 ? "" : "s"}, ${controlTesting.controlGapCount} control gap${controlTesting.controlGapCount === 1 ? "" : "s"}, and ${externalRisk.activeEventCount} active external risk event${externalRisk.activeEventCount === 1 ? "" : "s"}.`,
    `${contractPerformance.riskPacketCount} contract performance packet${contractPerformance.riskPacketCount === 1 ? "" : "s"}, ${regulatoryHorizon.eventCount} regulatory horizon event${regulatoryHorizon.eventCount === 1 ? "" : "s"}, and ${auditEvidence.weakEvidenceCount} weak-evidence audit event${auditEvidence.weakEvidenceCount === 1 ? "" : "s"} require review.`,
    "Packet creation does not mutate obligations, controls, contracts, policies, risk events, audit evidence, action queue decisions, or operational source records.",
  ].join("\n\n");
  return {
    title: `Sprint 2 Enterprise Risk & Controls packet: score ${riskScore}/100`,
    status: "DRAFT",
    riskScore,
    sourceSummary,
    obligationGraph,
    controlTesting,
    auditEvidence,
    contractPerformance,
    regulatoryHorizon,
    externalRisk,
    responsePlan,
    rollbackPlan,
    leadershipSummary,
  };
}
