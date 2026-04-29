import { buildAssistantReleaseGate, hasAssistantEvidence, isWeakAssistantAnswer, percent } from "./evidence-quality";

export type AiQualityReleaseInputs = {
  audits: Array<{
    id: string;
    surface: string;
    answerKind: string;
    message: string | null;
    evidence: unknown;
    quality: unknown;
    feedback: string | null;
    objectType: string | null;
    objectId: string | null;
    createdAt: string;
  }>;
  reviewExamples: Array<{ id: string; auditEventId: string; label: string; status: string; correctionNote: string | null }>;
  promptLibrary: Array<{ id: string; title: string; domain: string | null; objectType: string | null; status: string; usageCount: number; updatedAt: string }>;
  releaseGates: Array<{ id: string; gateKey: string; status: string; score: number; threshold: number; notes: string | null; evaluatedAt: string }>;
  automationPolicies: Array<{ id: string; policyKey: string; actionKind: string; label: string; status: string; readinessScore: number; threshold: number; rollbackPlan: string | null; lastEvaluatedAt: string | null }>;
  shadowRuns: Array<{ id: string; actionKind: string; predictedStatus: string; humanStatus: string | null; matched: boolean | null; runMode: string }>;
  observabilityIncidents: Array<{ id: string; title: string; status: string; severity: string; healthScore: number; failureCount: number; driftSignalCount: number; evidenceGapCount: number; automationRiskCount: number }>;
  agentGovernancePackets: Array<{ id: string; title: string; status: string; governanceScore: number; uncertifiedToolCount: number; promptRiskCount: number; observabilityRiskCount: number }>;
  advancedProgramPackets: Array<{ id: string; ampNumber: number; title: string; status: string; score: number; reviewRiskCount: number; rollbackStepCount: number }>;
  actionQueue: Array<{ id: string; actionKind: string; status: string; priority: string; objectType: string | null }>;
};

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function shadowMatchRate(inputs: AiQualityReleaseInputs, actionKind: string) {
  const runs = inputs.shadowRuns.filter((run) => run.actionKind === actionKind && run.matched != null);
  return percent(runs.filter((run) => run.matched).length, runs.length);
}

export function buildEvaluationSuite(inputs: AiQualityReleaseInputs) {
  const feedbackCases = inputs.audits.filter((audit) => audit.feedback != null);
  const weakCases = inputs.audits.filter((audit) => isWeakAssistantAnswer(audit));
  const correctionCases = inputs.reviewExamples.filter((example) => example.correctionNote || example.label !== "GOOD");
  const evalCases = [
    ...feedbackCases.slice(0, 8).map((audit) => ({ type: "FEEDBACK", auditEventId: audit.id, surface: audit.surface, expected: audit.feedback === "helpful" ? "maintain_quality" : "improve_or_block" })),
    ...weakCases.slice(0, 8).map((audit) => ({ type: "WEAK_ANSWER", auditEventId: audit.id, surface: audit.surface, expected: "requires_grounding_or_object_link" })),
    ...correctionCases.slice(0, 8).map((example) => ({ type: "REVIEW_EXAMPLE", auditEventId: example.auditEventId, surface: "review_example", expected: example.label })),
  ];
  const failedEvalCount = weakCases.length + inputs.reviewExamples.filter((example) => example.label === "BAD" || example.label === "UNSAFE").length;
  return {
    evalCaseCount: evalCases.length,
    failedEvalCount,
    feedbackCaseCount: feedbackCases.length,
    weakCaseCount: weakCases.length,
    correctionCaseCount: correctionCases.length,
    evalCases,
    guardrail: "Evaluation suites are release evidence only; they do not train models, update prompts, change tools, or alter production behavior automatically.",
  };
}

export function buildGroundingQuality(inputs: AiQualityReleaseInputs) {
  const evidenceBacked = inputs.audits.filter((audit) => hasAssistantEvidence(audit)).length;
  const weak = inputs.audits.filter((audit) => isWeakAssistantAnswer(audit));
  const negativeFeedback = inputs.audits.filter((audit) => audit.feedback === "not_helpful");
  const bySurface = inputs.audits.reduce<Record<string, { total: number; evidenceBacked: number; weak: number }>>((acc, audit) => {
    const row = acc[audit.surface] ?? { total: 0, evidenceBacked: 0, weak: 0 };
    row.total += 1;
    if (hasAssistantEvidence(audit)) row.evidenceBacked += 1;
    if (isWeakAssistantAnswer(audit)) row.weak += 1;
    acc[audit.surface] = row;
    return acc;
  }, {});
  return {
    auditEventCount: inputs.audits.length,
    evidenceCoveragePct: percent(evidenceBacked, inputs.audits.length),
    weakAnswerCount: weak.length,
    weakAnswerRatePct: percent(weak.length, inputs.audits.length),
    negativeFeedbackCount: negativeFeedback.length,
    negativeFeedbackRatePct: percent(negativeFeedback.length, inputs.audits.length),
    bySurface: Object.entries(bySurface).map(([surface, row]) => ({ surface, ...row, evidenceCoveragePct: percent(row.evidenceBacked, row.total), weakRatePct: percent(row.weak, row.total) })),
    weakExamples: weak.slice(0, 12).map((audit) => ({ auditEventId: audit.id, surface: audit.surface, answerKind: audit.answerKind, objectType: audit.objectType, objectId: audit.objectId })),
    guardrail: "Grounding quality review does not rewrite answers, export training data, alter customer-visible text, or publish prompt changes automatically.",
  };
}

export function buildPromptModelChangeRisk(inputs: AiQualityReleaseInputs) {
  const draftPrompts = inputs.promptLibrary.filter((prompt) => prompt.status !== "APPROVED");
  const staleApproved = inputs.promptLibrary.filter((prompt) => prompt.status === "APPROVED" && Date.now() - Date.parse(prompt.updatedAt) > 90 * 86_400_000);
  const agentRisks = inputs.agentGovernancePackets.filter((packet) => packet.status !== "CERTIFIED" || packet.uncertifiedToolCount > 0 || packet.promptRiskCount > 0);
  const advancedRisks = inputs.advancedProgramPackets.filter((packet) => packet.status !== "APPROVED" || packet.reviewRiskCount > 0 || packet.rollbackStepCount === 0);
  return {
    promptRiskCount: draftPrompts.length + staleApproved.length + agentRisks.length + advancedRisks.length,
    promptCount: inputs.promptLibrary.length,
    approvedPromptCount: inputs.promptLibrary.filter((prompt) => prompt.status === "APPROVED").length,
    draftPrompts: draftPrompts.slice(0, 12).map((prompt) => ({ promptId: prompt.id, title: prompt.title, status: prompt.status, domain: prompt.domain })),
    staleApprovedPrompts: staleApproved.slice(0, 12).map((prompt) => ({ promptId: prompt.id, title: prompt.title, updatedAt: prompt.updatedAt })),
    agentRisks: agentRisks.slice(0, 8).map((packet) => ({ packetId: packet.id, title: packet.title, status: packet.status, governanceScore: packet.governanceScore, uncertifiedToolCount: packet.uncertifiedToolCount })),
    advancedProgramRisks: advancedRisks.slice(0, 8).map((packet) => ({ packetId: packet.id, title: packet.title, status: packet.status, score: packet.score, reviewRiskCount: packet.reviewRiskCount })),
    guardrail: "Prompt/model/tool change review does not publish prompts, switch models, grant tools, certify agents, or roll out advanced programs automatically.",
  };
}

export function buildAutomationRegression(inputs: AiQualityReleaseInputs) {
  const risks = inputs.automationPolicies
    .map((policy) => {
      const matchRate = shadowMatchRate(inputs, policy.actionKind);
      const shadowCount = inputs.shadowRuns.filter((run) => run.actionKind === policy.actionKind && run.matched != null).length;
      const riskReasons = [
        ...(policy.status === "ENABLED" && matchRate < 80 ? ["enabled_low_shadow_match"] : []),
        ...(policy.readinessScore < policy.threshold ? ["below_readiness_threshold"] : []),
        ...(policy.status === "ENABLED" && !policy.rollbackPlan ? ["missing_rollback_plan"] : []),
      ];
      return {
        policyId: policy.id,
        policyKey: policy.policyKey,
        actionKind: policy.actionKind,
        label: policy.label,
        status: policy.status,
        readinessScore: policy.readinessScore,
        threshold: policy.threshold,
        shadowMatchRatePct: matchRate,
        shadowCount,
        riskReasons,
        rollbackPlan: policy.rollbackPlan ?? `Pause ${policy.actionKind} and route all actions to human review.`,
      };
    })
    .filter((policy) => policy.riskReasons.length > 0);
  return {
    automationPolicyCount: inputs.automationPolicies.length,
    shadowRunCount: inputs.shadowRuns.length,
    automationRiskCount: risks.length,
    risks,
    guardrail: "Automation regression review does not enable, pause, disable, or execute automations automatically.",
  };
}

export function buildObservabilityWatch(inputs: AiQualityReleaseInputs) {
  const openIncidents = inputs.observabilityIncidents.filter((incident) => incident.status !== "RESOLVED" && incident.status !== "CLOSED");
  const severe = openIncidents.filter((incident) => incident.severity === "HIGH" || incident.healthScore < 70);
  return {
    incidentCount: inputs.observabilityIncidents.length,
    openIncidentCount: openIncidents.length,
    observabilityRiskCount: severe.reduce((sum, incident) => sum + incident.failureCount + incident.driftSignalCount + incident.evidenceGapCount + incident.automationRiskCount + 1, 0),
    severeIncidents: severe.slice(0, 10).map((incident) => ({ incidentId: incident.id, title: incident.title, severity: incident.severity, healthScore: incident.healthScore, failureCount: incident.failureCount })),
    guardrail: "Observability watch does not close incidents, change degraded mode, pause tools, or change runtime behavior automatically.",
  };
}

export function buildReleaseGate(inputs: AiQualityReleaseInputs, grounding = buildGroundingQuality(inputs), promptRisk = buildPromptModelChangeRisk(inputs), automation = buildAutomationRegression(inputs), observability = buildObservabilityWatch(inputs)) {
  const computed = buildAssistantReleaseGate({
    auditTotal: inputs.audits.length,
    evidenceBacked: inputs.audits.filter((audit) => hasAssistantEvidence(audit)).length,
    feedbackCount: inputs.audits.filter((audit) => audit.feedback != null).length,
    weakCount: grounding.weakAnswerCount,
    approvedPromptCount: promptRisk.approvedPromptCount,
  });
  const persistedBlocked = inputs.releaseGates.filter((gate) => gate.status === "BLOCKED");
  const releaseBlockers = [
    ...computed.checks.filter((check) => !check.passed).map((check) => ({ type: "COMPUTED_CHECK", key: check.key, detail: check.metric })),
    ...persistedBlocked.map((gate) => ({ type: "PERSISTED_GATE", key: gate.gateKey, detail: `${gate.status} ${gate.score}/${gate.threshold}` })),
    ...(automation.automationRiskCount > 0 ? [{ type: "AUTOMATION_REGRESSION", key: "automation", detail: `${automation.automationRiskCount} automation risk(s).` }] : []),
    ...(observability.openIncidentCount > 0 ? [{ type: "OBSERVABILITY_INCIDENT", key: "observability", detail: `${observability.openIncidentCount} open incident(s).` }] : []),
  ];
  return {
    computed,
    persistedGates: inputs.releaseGates.slice(0, 10),
    releaseBlockerCount: releaseBlockers.length,
    releaseBlockers,
    releaseDecision: releaseBlockers.length === 0 && computed.status === "PASSED" ? "READY_FOR_REVIEW" : "BLOCK_RELEASE",
    guardrail: "Release gate output blocks or queues review only; it does not roll out prompts, models, tools, automations, or runtime changes automatically.",
  };
}

export function buildRollbackDrill(inputs: AiQualityReleaseInputs, automation = buildAutomationRegression(inputs), observability = buildObservabilityWatch(inputs)) {
  const pendingQualityActions = inputs.actionQueue.filter((item) => item.status === "PENDING" && /quality|eval|release|prompt|model|tool|automation|observability|rollback/i.test(`${item.actionKind} ${item.objectType ?? ""}`));
  const steps = [
    "Freeze prompt/model/tool promotion until release review is approved.",
    "Route assistant-proposed actions to human review queue for affected surfaces.",
    "Retain current approved prompt library, release gates, automation policies, and rollback notes as the recovery baseline.",
    "Review weak-answer examples and negative feedback before any new rollout.",
    ...automation.risks.slice(0, 5).map((risk) => risk.rollbackPlan),
    ...observability.severeIncidents.slice(0, 5).map((incident) => `Review observability incident ${incident.title} before resuming release.`),
  ];
  return {
    rollbackStepCount: steps.length,
    pendingQualityActions: pendingQualityActions.slice(0, 12).map((item) => ({ actionQueueItemId: item.id, actionKind: item.actionKind, priority: item.priority })),
    steps,
    guardrail: "Rollback drills are review evidence only; they do not revert deployments, change prompts, switch models, alter tools, or pause automations automatically.",
  };
}

export function buildAiQualityReleasePacket(inputs: AiQualityReleaseInputs) {
  const evaluationSuite = buildEvaluationSuite(inputs);
  const groundingQuality = buildGroundingQuality(inputs);
  const promptModelChange = buildPromptModelChangeRisk(inputs);
  const automationRegression = buildAutomationRegression(inputs);
  const observabilityWatch = buildObservabilityWatch(inputs);
  const releaseGate = buildReleaseGate(inputs, groundingQuality, promptModelChange, automationRegression, observabilityWatch);
  const rollbackDrill = buildRollbackDrill(inputs, automationRegression, observabilityWatch);
  const sourceSummary = {
    audits: inputs.audits.length,
    reviewExamples: inputs.reviewExamples.length,
    promptLibraryItems: inputs.promptLibrary.length,
    releaseGates: inputs.releaseGates.length,
    automationPolicies: inputs.automationPolicies.length,
    shadowRuns: inputs.shadowRuns.length,
    observabilityIncidents: inputs.observabilityIncidents.length,
    agentGovernancePackets: inputs.agentGovernancePackets.length,
    advancedProgramPackets: inputs.advancedProgramPackets.length,
    actionQueueItems: inputs.actionQueue.length,
  };
  const qualityScore = clamp(
    96 -
      Math.min(24, evaluationSuite.failedEvalCount * 4) -
      Math.min(24, Math.max(0, 75 - groundingQuality.evidenceCoveragePct)) -
      Math.min(20, promptModelChange.promptRiskCount * 3) -
      Math.min(22, automationRegression.automationRiskCount * 5) -
      Math.min(22, observabilityWatch.openIncidentCount * 6) -
      Math.min(24, releaseGate.releaseBlockerCount * 4),
  );
  const responsePlan = {
    status: qualityScore < 70 || releaseGate.releaseDecision === "BLOCK_RELEASE" ? "RELEASE_REVIEW_BLOCKED" : qualityScore < 88 ? "QUALITY_OWNER_REVIEW" : "MONITOR",
    owners: ["AI quality owner", "Assistant platform owner", "Prompt owner", "Security", "Operations", "Product leadership"],
    steps: [
      "Review eval cases, failed examples, feedback, and grounding coverage.",
      "Approve prompt/model/tool changes only after release gates and observability risks are clear.",
      "Validate automation shadow-match and rollback evidence before enabling or expanding automation.",
      "Queue separate approved release work before changing prompts, models, tools, policies, runtime flags, or production behavior.",
    ],
    guardrail: "Response plan is review-only and does not release prompt, model, tool, automation, or runtime changes automatically.",
  };
  const leadershipSummary = [
    `Sprint 10 AI Quality & Release score is ${qualityScore}/100 across ${inputs.audits.length} audit event(s), ${evaluationSuite.evalCaseCount} eval case(s), and ${inputs.releaseGates.length} release gate(s).`,
    `${evaluationSuite.failedEvalCount} failed eval signal(s), ${promptModelChange.promptRiskCount} prompt/model/tool risk(s), ${automationRegression.automationRiskCount} automation regression risk(s), ${observabilityWatch.openIncidentCount} open observability incident(s), and ${releaseGate.releaseBlockerCount} release blocker(s) need review.`,
    "Packet creation does not publish prompts, switch models, grant tools, enable automation, close incidents, deploy releases, change runtime flags, or mutate production behavior.",
  ].join("\n\n");
  return {
    title: `Sprint 10 AI Quality Release packet: score ${qualityScore}/100`,
    status: "DRAFT",
    qualityScore,
    sourceSummary,
    evaluationSuite,
    groundingQuality,
    promptModelChange,
    automationRegression,
    observabilityWatch,
    releaseGate,
    rollbackDrill,
    responsePlan,
    leadershipSummary,
  };
}
