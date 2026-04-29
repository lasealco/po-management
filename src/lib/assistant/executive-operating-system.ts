export type ExecutiveOperatingSystemInputs = {
  operatingReports: Array<{ id: string; title: string; status: string; score: number; summary: string }>;
  valuePackets: Array<{ id: string; title: string; status: string; valueScore: number; adoptionScore: number; totalEstimatedValue: number; roiPct: number }>;
  revenuePackets: Array<{ id: string; title: string; status: string; revenueScore: number; pipelineValue: number; feasibilityRiskCount: number; pricingRiskCount: number }>;
  autonomousLoops: Array<{ id: string; title: string; status: string; loopScore: number; automationMode: string; decisionCount: number; anomalyCount: number; learningCount: number }>;
  riskPackets: Array<{ id: string; title: string; status: string; riskScore: number; controlGapCount: number; externalRiskCount: number }>;
  trustPackets: Array<{ id: string; title: string; status: string; trustScore: number; securityExceptionCount: number; threatSignalCount: number }>;
  audits: Array<{ id: string; surface: string; answerKind: string; feedback: string | null; evidencePresent: boolean; qualityPresent: boolean }>;
  actionQueue: Array<{ id: string; actionKind: string; status: string; priority: string; objectType: string | null }>;
};

function avg(values: number[]) {
  if (values.length === 0) return 0;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function money(value: number) {
  return Math.round(value).toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

export function buildBoardBrief(inputs: ExecutiveOperatingSystemInputs) {
  const latestOperating = inputs.operatingReports[0] ?? null;
  const totalValue = inputs.valuePackets.reduce((sum, packet) => sum + packet.totalEstimatedValue, 0);
  const pipelineValue = inputs.revenuePackets.reduce((sum, packet) => sum + packet.pipelineValue, 0);
  const openHighPriority = inputs.actionQueue.filter((item) => item.status === "PENDING" && item.priority === "HIGH").length;
  const metrics = [
    { label: "Assistant operating score", value: latestOperating?.score ?? 0, source: latestOperating?.title ?? "No operating report" },
    { label: "Average value score", value: avg(inputs.valuePackets.map((packet) => packet.valueScore)), source: `${inputs.valuePackets.length} value packet(s)` },
    { label: "Estimated realized value", value: totalValue, source: "Value realization packets", format: "currency" },
    { label: "Pipeline under executive review", value: pipelineValue, source: "Revenue operations packets", format: "currency" },
    { label: "High-priority executive actions", value: openHighPriority, source: "Assistant action queue" },
  ];
  return {
    metricCount: metrics.length,
    readiness: openHighPriority > 5 ? "BOARD_REVIEW_WITH_OPEN_ACTIONS" : "BOARD_READY_DRAFT",
    metrics,
    summaryBullets: [
      latestOperating?.summary ?? "No operating report is available yet.",
      `Value realization totals ${money(totalValue)} with average ROI ${avg(inputs.valuePackets.map((packet) => packet.roiPct))}%.`,
      `Revenue pipeline in assistant review totals ${money(pipelineValue)}.`,
    ],
    guardrail: "Board brief is a draft packet; it is not sent, exported, or published automatically.",
  };
}

export function buildInvestorNarrative(inputs: ExecutiveOperatingSystemInputs) {
  const valueScore = avg(inputs.valuePackets.map((packet) => packet.valueScore));
  const trustScore = avg(inputs.trustPackets.map((packet) => packet.trustScore));
  const riskScore = avg(inputs.riskPackets.map((packet) => packet.riskScore));
  const narrativeRisks = [
    ...(valueScore > 0 && valueScore < 65 ? ["Value realization is below investor-story threshold."] : []),
    ...(trustScore > 0 && trustScore < 75 ? ["Trust posture requires review before external claims."] : []),
    ...(riskScore >= 70 ? ["Enterprise risk score is elevated and needs disclosure-safe framing."] : []),
    ...((inputs.audits.filter((audit) => audit.feedback === "not_helpful").length > 0) ? ["Negative feedback exists in recent assistant audit events."] : []),
  ];
  return {
    narrativeRiskCount: narrativeRisks.length,
    audience: ["BOARD", "INVESTOR_RELATIONS", "CUSTOMER_EXECUTIVE"],
    thesis: "The assistant operating system is review-gated, evidence-backed, and expanding from operational execution into executive decision support.",
    proofPoints: [
      `${inputs.operatingReports.length} operating report(s) and ${inputs.valuePackets.length} value packet(s) are available.`,
      `${inputs.autonomousLoops.length} autonomous loop packet(s) show policy, outcome, rollback, and learning controls.`,
      `${inputs.trustPackets.length} trust packet(s) and ${inputs.riskPackets.length} risk packet(s) provide control posture evidence.`,
    ],
    narrativeRisks,
    guardrail: "Investor narrative is role-safe draft language; no external disclosure or customer/investor message is sent automatically.",
  };
}

export function buildCorpDevRadar(inputs: ExecutiveOperatingSystemInputs) {
  const highValueDomains = inputs.valuePackets.filter((packet) => packet.valueScore >= 70 || packet.roiPct >= 50);
  const revenueOpportunities = inputs.revenuePackets.filter((packet) => packet.revenueScore >= 65 && packet.pipelineValue > 0);
  const automationAssets = inputs.autonomousLoops.filter((loop) => loop.loopScore >= 60 || loop.automationMode === "CONTROLLED_AUTOMATION");
  return {
    signalCount: highValueDomains.length + revenueOpportunities.length + automationAssets.length,
    buildPartnerBuySignals: [
      ...highValueDomains.slice(0, 5).map((packet) => ({ sourceType: "VALUE", sourceId: packet.id, title: packet.title, reason: `Value score ${packet.valueScore}/100, ROI ${packet.roiPct}%.` })),
      ...revenueOpportunities.slice(0, 5).map((packet) => ({ sourceType: "REVENUE", sourceId: packet.id, title: packet.title, reason: `Pipeline ${money(packet.pipelineValue)} with score ${packet.revenueScore}/100.` })),
      ...automationAssets.slice(0, 5).map((loop) => ({ sourceType: "AUTONOMY", sourceId: loop.id, title: loop.title, reason: `Loop score ${loop.loopScore}/100 in ${loop.automationMode}.` })),
    ],
    guardrail: "Corp-dev radar is prioritization evidence only; partnerships, investments, acquisition outreach, or commitments require separate approval.",
  };
}

export function buildExecutiveTwin(inputs: ExecutiveOperatingSystemInputs) {
  const dimensions = {
    growth: avg(inputs.revenuePackets.map((packet) => packet.revenueScore)),
    value: avg(inputs.valuePackets.map((packet) => packet.valueScore)),
    control: Math.max(0, 100 - avg(inputs.riskPackets.map((packet) => packet.riskScore))),
    trust: avg(inputs.trustPackets.map((packet) => packet.trustScore)),
    autonomy: avg(inputs.autonomousLoops.map((loop) => loop.loopScore)),
  };
  const weakDimensions = Object.entries(dimensions)
    .filter(([, value]) => value > 0 && value < 65)
    .map(([dimension, value]) => ({ dimension, score: value, recommendation: `Run executive review for ${dimension}.` }));
  return {
    dimensions,
    weakDimensionCount: weakDimensions.length,
    weakDimensions,
    scenarioPrompts: [
      "What if executive pipeline review prioritizes the top revenue packet?",
      "What if trust and risk blockers must be cleared before investor narrative approval?",
      "What if automation expansion remains in review-only mode for the next operating cycle?",
    ],
    guardrail: "Executive twin scenarios are decision support only; strategy, budget, headcount, and external commitments are not changed automatically.",
  };
}

export function buildStrategyExecution(inputs: ExecutiveOperatingSystemInputs) {
  const actionBacklog = inputs.actionQueue.filter((item) => item.status === "PENDING");
  const strategyRisks = [
    ...inputs.riskPackets.filter((packet) => packet.riskScore >= 70).map((packet) => ({ sourceType: "RISK", sourceId: packet.id, title: packet.title, severity: "HIGH", issue: `${packet.controlGapCount} control gap(s), ${packet.externalRiskCount} external risk signal(s).` })),
    ...inputs.trustPackets.filter((packet) => packet.trustScore < 75).map((packet) => ({ sourceType: "TRUST", sourceId: packet.id, title: packet.title, severity: "HIGH", issue: `${packet.securityExceptionCount} security exception(s), ${packet.threatSignalCount} threat signal(s).` })),
    ...inputs.revenuePackets.filter((packet) => packet.feasibilityRiskCount + packet.pricingRiskCount > 0).map((packet) => ({ sourceType: "REVENUE", sourceId: packet.id, title: packet.title, severity: "MEDIUM", issue: `${packet.feasibilityRiskCount + packet.pricingRiskCount} commercial/feasibility risk(s).` })),
  ];
  return {
    strategyRiskCount: strategyRisks.length,
    actionBacklogCount: actionBacklog.length,
    strategyRisks: strategyRisks.slice(0, 15),
    executionSteps: [
      "Review top board metrics and confirm accountable owners.",
      "Clear trust/risk blockers before external narrative approval.",
      "Prioritize revenue, value, and autonomous-loop decisions for the next operating cadence.",
      "Queue executive decisions through action review; do not mutate source systems from packet creation.",
    ],
  };
}

export function buildDecisionLedger(inputs: ExecutiveOperatingSystemInputs) {
  const decisions = [
    ...inputs.autonomousLoops.flatMap((loop) => Array.from({ length: Math.min(3, loop.decisionCount) }, (_, index) => ({ sourceType: "AUTONOMOUS_LOOP", sourceId: loop.id, title: `${loop.title} decision ${index + 1}`, status: loop.status }))),
    ...inputs.actionQueue.filter((item) => item.priority === "HIGH").slice(0, 10).map((item) => ({ sourceType: "ACTION_QUEUE", sourceId: item.id, title: item.actionKind, status: item.status })),
  ];
  return {
    decisionCount: decisions.length,
    decisions,
    guardrail: "Decision ledger records review candidates only; approvals, rejects, strategy changes, and external commitments require human action.",
  };
}

export function buildLearningLoop(inputs: ExecutiveOperatingSystemInputs) {
  const auditCorrections = inputs.audits.filter((audit) => audit.feedback === "not_helpful" || (!audit.evidencePresent && !audit.qualityPresent));
  const loopLearnings = inputs.autonomousLoops.reduce((sum, loop) => sum + loop.learningCount, 0);
  const learningSignals = [
    ...auditCorrections.slice(0, 10).map((audit) => ({ sourceType: "AUDIT", sourceId: audit.id, learning: `${audit.surface}:${audit.answerKind} needs evidence, quality, or correction review.` })),
    ...inputs.autonomousLoops.filter((loop) => loop.learningCount > 0).map((loop) => ({ sourceType: "LOOP", sourceId: loop.id, learning: `${loop.learningCount} loop learning signal(s) from ${loop.title}.` })),
  ];
  return {
    learningSignalCount: learningSignals.length + loopLearnings,
    learningSignals,
    nextReview: "Review learning signals before expanding executive narrative, automation, or strategy scope.",
  };
}

export function buildExecutiveOperatingSystemPacket(inputs: ExecutiveOperatingSystemInputs) {
  const boardBrief = buildBoardBrief(inputs);
  const investorNarrative = buildInvestorNarrative(inputs);
  const corpDevRadar = buildCorpDevRadar(inputs);
  const executiveTwin = buildExecutiveTwin(inputs);
  const strategyExecution = buildStrategyExecution(inputs);
  const decisionLedger = buildDecisionLedger(inputs);
  const learningLoop = buildLearningLoop(inputs);
  const sourceSummary = {
    operatingReports: inputs.operatingReports.length,
    valuePackets: inputs.valuePackets.length,
    revenuePackets: inputs.revenuePackets.length,
    autonomousLoops: inputs.autonomousLoops.length,
    riskPackets: inputs.riskPackets.length,
    trustPackets: inputs.trustPackets.length,
    auditEvents: inputs.audits.length,
    actionQueueItems: inputs.actionQueue.length,
  };
  const executiveScore = Math.max(
    0,
    Math.min(
      100,
      Math.round(
        55 +
          Math.min(15, boardBrief.metricCount * 2) +
          Math.min(15, corpDevRadar.signalCount * 3) +
          Math.min(10, decisionLedger.decisionCount) -
          Math.min(20, investorNarrative.narrativeRiskCount * 5) -
          Math.min(20, strategyExecution.strategyRiskCount * 3) -
          Math.min(10, executiveTwin.weakDimensionCount * 3),
      ),
    ),
  );
  const operatingCadence = {
    status: executiveScore >= 80 ? "EXECUTIVE_READY" : executiveScore >= 60 ? "EXECUTIVE_REVIEW_REQUIRED" : "NEEDS_OPERATING_WORK",
    cadence: ["Weekly executive review", "Monthly board packet", "Quarterly investor narrative", "Strategy learning loop"],
    owners: ["CEO", "COO", "CFO", "Strategy", "Investor relations", "Product leadership"],
  };
  const rollbackPlan = {
    steps: [
      "Keep board materials, investor narrative, corp-dev signals, strategy decisions, budgets, customer/investor communications, automation policies, and source records unchanged until downstream approval.",
      "If review rejects the packet, preserve evidence and notes for audit without publishing or exporting the packet.",
      "Create a new packet when value, revenue, risk, trust, or autonomous-loop evidence changes materially.",
      "Use action queue approval before any executive decision changes source systems or external messages.",
    ],
  };
  const leadershipSummary = [
    `Sprint 4 Executive Operating System score is ${executiveScore}/100 with ${boardBrief.metricCount} board metric${boardBrief.metricCount === 1 ? "" : "s"}, ${decisionLedger.decisionCount} decision candidate${decisionLedger.decisionCount === 1 ? "" : "s"}, and ${learningLoop.learningSignalCount} learning signal${learningLoop.learningSignalCount === 1 ? "" : "s"}.`,
    `${investorNarrative.narrativeRiskCount} investor narrative risk${investorNarrative.narrativeRiskCount === 1 ? "" : "s"}, ${corpDevRadar.signalCount} corp-dev signal${corpDevRadar.signalCount === 1 ? "" : "s"}, and ${strategyExecution.strategyRiskCount} strategy execution risk${strategyExecution.strategyRiskCount === 1 ? "" : "s"} require review.`,
    "Packet creation does not publish board materials, send investor/customer communications, create corp-dev commitments, change strategy, mutate budgets, execute automation, or update source records.",
  ].join("\n\n");
  return {
    title: `Sprint 4 Executive Operating System packet: score ${executiveScore}/100`,
    status: "DRAFT",
    executiveScore,
    sourceSummary,
    boardBrief,
    investorNarrative,
    corpDevRadar,
    executiveTwin,
    strategyExecution,
    decisionLedger,
    learningLoop,
    operatingCadence,
    rollbackPlan,
    leadershipSummary,
  };
}
