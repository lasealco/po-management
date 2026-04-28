export type LoopSignal = {
  id: string;
  sourceType: "ACTION" | "AUDIT" | "OBSERVABILITY" | "VALUE" | "POLICY" | "RELEASE_GATE" | "PLAYBOOK";
  domain: string;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  status: string;
  detail: string;
};

export type LoopPolicySignal = {
  id: string;
  actionKind: string;
  status: string;
  readinessScore: number;
  threshold: number;
  rollbackPlan: string | null;
};

export type LoopInputs = {
  signals: LoopSignal[];
  policies: LoopPolicySignal[];
  shadowRuns: Array<{ actionKind: string; matched: boolean | null; runMode: string }>;
  releaseGate: { status: string; score: number; threshold: number } | null;
  killSwitchActive: boolean;
};

const severityWeight: Record<LoopSignal["severity"], number> = {
  LOW: 1,
  MEDIUM: 2,
  HIGH: 3,
  CRITICAL: 4,
};

export function buildObserveSnapshot(inputs: LoopInputs) {
  const byDomain = inputs.signals.reduce<Record<string, { count: number; maxSeverity: LoopSignal["severity"] }>>((acc, signal) => {
    const current = acc[signal.domain] ?? { count: 0, maxSeverity: "LOW" as const };
    current.count += 1;
    if (severityWeight[signal.severity] > severityWeight[current.maxSeverity]) current.maxSeverity = signal.severity;
    acc[signal.domain] = current;
    return acc;
  }, {});
  const anomalies = inputs.signals.filter((signal) => signal.severity === "HIGH" || signal.severity === "CRITICAL");
  return {
    signalCount: inputs.signals.length,
    anomalyCount: anomalies.length,
    byDomain,
    anomalies: anomalies.slice(0, 10),
  };
}

export function buildDecisionPlan(inputs: LoopInputs, observe = buildObserveSnapshot(inputs)) {
  const decisions = Object.entries(observe.byDomain).map(([domain, summary]) => {
    const highSeverity = summary.maxSeverity === "HIGH" || summary.maxSeverity === "CRITICAL";
    return {
      domain,
      decision: highSeverity ? "ESCALATE_AND_PROPOSE_RECOVERY" : "MONITOR_AND_LEARN",
      severity: summary.maxSeverity,
      confidence: summary.count >= 3 ? "HIGH" : "MEDIUM",
      reason: `${summary.count} signal${summary.count === 1 ? "" : "s"} observed for ${domain}.`,
    };
  });
  return {
    decisionCount: decisions.length,
    decisions,
  };
}

export function buildPolicyEnvelope(inputs: LoopInputs) {
  const enabledSafePolicies = inputs.policies.filter((policy) => policy.status === "ENABLED" && policy.readinessScore >= policy.threshold);
  const riskyPolicies = inputs.policies.filter((policy) => policy.status === "ENABLED" && policy.readinessScore < policy.threshold);
  const shadowMatches = inputs.shadowRuns.filter((run) => run.matched === true).length;
  const shadowTotal = inputs.shadowRuns.filter((run) => run.matched != null).length;
  const shadowMatchRatePct = shadowTotal ? Math.round((shadowMatches / shadowTotal) * 100) : 0;
  const releaseReady = inputs.releaseGate?.status === "PASSED" && inputs.releaseGate.score >= inputs.releaseGate.threshold;
  const automationMode = inputs.killSwitchActive || !releaseReady || riskyPolicies.length > 0 ? "REVIEW_ONLY" : enabledSafePolicies.length > 0 ? "CONTROLLED_AUTOMATION" : "SHADOW_ONLY";
  return {
    automationMode,
    releaseReady,
    killSwitchActive: inputs.killSwitchActive,
    enabledSafeCount: enabledSafePolicies.length,
    riskyPolicyCount: riskyPolicies.length,
    shadowMatchRatePct,
    allowedActions:
      automationMode === "CONTROLLED_AUTOMATION"
        ? ["queue_review", "run_shadow", "execute_low_risk_after_approval"]
        : automationMode === "SHADOW_ONLY"
          ? ["queue_review", "run_shadow"]
          : ["queue_review"],
    blockedReasons: [
      ...(inputs.killSwitchActive ? ["Kill switch is active."] : []),
      ...(!releaseReady ? ["Release gate is not passed."] : []),
      ...(riskyPolicies.length ? [`${riskyPolicies.length} enabled policy below readiness threshold.`] : []),
    ],
  };
}

export function buildActPlan(inputs: LoopInputs, decisions = buildDecisionPlan(inputs), policy = buildPolicyEnvelope(inputs)) {
  const proposedActions = decisions.decisions
    .filter((decision) => decision.decision === "ESCALATE_AND_PROPOSE_RECOVERY")
    .map((decision) => ({
      actionKind: `autonomous_${decision.domain}_recovery_review`,
      domain: decision.domain,
      priority: decision.severity === "CRITICAL" ? "HIGH" : "MEDIUM",
      executionMode: policy.automationMode === "CONTROLLED_AUTOMATION" ? "APPROVAL_REQUIRED_CONTROLLED" : "REVIEW_ONLY",
      guardrail: "No source-system mutation occurs until a human approves the queued loop review.",
    }));
  return {
    proposedActionCount: proposedActions.length,
    approvedAutomationCount: policy.automationMode === "CONTROLLED_AUTOMATION" ? policy.enabledSafeCount : 0,
    proposedActions,
  };
}

export function buildLearnPlan(inputs: LoopInputs) {
  const negativeFeedback = inputs.signals.filter((signal) => signal.sourceType === "AUDIT" && /not_helpful|weak|failed/i.test(signal.status)).length;
  const shadowMismatches = inputs.shadowRuns.filter((run) => run.matched === false).length;
  const valueWins = inputs.signals.filter((signal) => signal.sourceType === "VALUE" && signal.severity === "LOW").length;
  const learnings = [
    ...(negativeFeedback > 0 ? [{ type: "FEEDBACK_CORRECTION", count: negativeFeedback, recommendation: "Add correction examples before expanding automation." }] : []),
    ...(shadowMismatches > 0 ? [{ type: "SHADOW_MISMATCH", count: shadowMismatches, recommendation: "Keep matching action kinds in shadow mode." }] : []),
    ...(valueWins > 0 ? [{ type: "VALUE_PATTERN", count: valueWins, recommendation: "Promote high-value workflows into rollout playbooks." }] : []),
  ];
  return {
    learningCount: learnings.length,
    learnings,
  };
}

export function buildOutcomeMeasurement(inputs: LoopInputs, actPlan = buildActPlan(inputs)) {
  const pendingActions = inputs.signals.filter((signal) => signal.sourceType === "ACTION" && signal.status === "PENDING").length;
  const doneActions = inputs.signals.filter((signal) => signal.sourceType === "ACTION" && signal.status === "DONE").length;
  return {
    pendingActions,
    doneActions,
    proposedActions: actPlan.proposedActionCount,
    successMetric: "Review-loop closure rate and shadow-match improvement before controlled automation.",
  };
}

export function buildRollbackPlan(inputs: LoopInputs, policy = buildPolicyEnvelope(inputs)) {
  const policyRollbacks = inputs.policies
    .filter((policySignal) => policySignal.rollbackPlan)
    .map((policySignal) => policySignal.rollbackPlan as string)
    .slice(0, 5);
  const steps = [
    "Keep autonomous loop in review-only mode when kill switch, release gate, or policy readiness blocks exist.",
    "Pause or downgrade enabled automation policies before source-system execution.",
    "Route proposed actions through AssistantActionQueueItem for human review.",
    "Record audit evidence and outcome notes before expanding loop scope.",
    ...policyRollbacks,
  ];
  return {
    stepCount: steps.length,
    steps,
    killSwitchActive: inputs.killSwitchActive,
    automationMode: policy.automationMode,
  };
}

export function scoreAutonomousLoop(
  observe: ReturnType<typeof buildObserveSnapshot>,
  policy: ReturnType<typeof buildPolicyEnvelope>,
  learn: ReturnType<typeof buildLearnPlan>,
) {
  const safety = policy.automationMode === "CONTROLLED_AUTOMATION" ? 35 : policy.automationMode === "SHADOW_ONLY" ? 25 : 15;
  const signalCoverage = Math.min(30, observe.signalCount * 2);
  const anomalyPenalty = Math.min(25, observe.anomalyCount * 5);
  const learning = Math.min(20, learn.learningCount * 7);
  return Math.max(0, Math.min(100, safety + signalCoverage + learning - anomalyPenalty));
}

export function buildAutonomousOperatingLoop(inputs: LoopInputs) {
  const observe = buildObserveSnapshot(inputs);
  const decide = buildDecisionPlan(inputs, observe);
  const policy = buildPolicyEnvelope(inputs);
  const act = buildActPlan(inputs, decide, policy);
  const learn = buildLearnPlan(inputs);
  const outcome = buildOutcomeMeasurement(inputs, act);
  const rollback = buildRollbackPlan(inputs, policy);
  const loopScore = scoreAutonomousLoop(observe, policy, learn);
  const leadershipSummary = [
    `Autonomous operating loop score is ${loopScore}/100 in ${policy.automationMode} mode with ${observe.signalCount} observed signal${observe.signalCount === 1 ? "" : "s"} and ${observe.anomalyCount} anomal${observe.anomalyCount === 1 ? "y" : "ies"}.`,
    `${decide.decisionCount} decision${decide.decisionCount === 1 ? "" : "s"}, ${act.proposedActionCount} proposed action${act.proposedActionCount === 1 ? "" : "s"}, and ${learn.learningCount} learning signal${learn.learningCount === 1 ? "" : "s"} are ready for review.`,
    "Loop creation does not mutate source systems, execute automation, change policies, or bypass human approval.",
  ].join("\n\n");
  return {
    title: `Autonomous loop: ${policy.automationMode}`,
    status: "DRAFT",
    loopScore,
    automationMode: policy.automationMode,
    observedSignalCount: observe.signalCount,
    decisionCount: decide.decisionCount,
    proposedActionCount: act.proposedActionCount,
    approvedAutomationCount: act.approvedAutomationCount,
    anomalyCount: observe.anomalyCount,
    learningCount: learn.learningCount,
    observe,
    decide,
    act,
    learn,
    policy,
    outcome,
    rollback,
    leadershipSummary,
  };
}
