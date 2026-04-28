export type ObservabilityAuditSignal = {
  id: string;
  surface: string;
  answerKind: string;
  message: string | null;
  feedback: string | null;
  evidencePresent: boolean;
  qualityPresent: boolean;
  objectType: string | null;
  objectId: string | null;
  createdAt: string;
};

export type ObservabilityActionSignal = {
  id: string;
  actionKind: string;
  status: string;
  priority: string;
  objectType: string | null;
  objectId: string | null;
  createdAt: string;
};

export type ObservabilityAutomationSignal = {
  id: string;
  actionKind: string;
  status: string;
  readinessScore: number;
  threshold: number;
  rollbackPlan: string | null;
};

export type ObservabilityShadowSignal = {
  id: string;
  actionKind: string;
  predictedStatus: string;
  humanStatus: string | null;
  matched: boolean | null;
  runMode: string;
};

export type ObservabilityInputs = {
  audits: ObservabilityAuditSignal[];
  actions: ObservabilityActionSignal[];
  automations: ObservabilityAutomationSignal[];
  shadowRuns: ObservabilityShadowSignal[];
  releaseGate: { status: string; score: number; threshold: number } | null;
};

function percent(part: number, whole: number) {
  if (whole <= 0) return 0;
  return Math.round((part / whole) * 100);
}

export function buildHealthSnapshot(inputs: ObservabilityInputs) {
  const evidenceBacked = inputs.audits.filter((audit) => audit.evidencePresent || audit.qualityPresent).length;
  const negativeFeedback = inputs.audits.filter((audit) => audit.feedback === "not_helpful").length;
  const pendingActions = inputs.actions.filter((action) => action.status === "PENDING").length;
  const rejectedActions = inputs.actions.filter((action) => action.status === "REJECTED").length;
  const shadowTotal = inputs.shadowRuns.filter((run) => run.matched != null).length;
  const shadowMatched = inputs.shadowRuns.filter((run) => run.matched === true).length;
  return {
    auditEventCount: inputs.audits.length,
    evidenceCoveragePct: percent(evidenceBacked, inputs.audits.length),
    negativeFeedbackRatePct: percent(negativeFeedback, inputs.audits.length),
    pendingActionCount: pendingActions,
    rejectedActionCount: rejectedActions,
    shadowMatchRatePct: percent(shadowMatched, shadowTotal),
    releaseGateStatus: inputs.releaseGate?.status ?? "UNKNOWN",
    releaseGateScore: inputs.releaseGate?.score ?? 0,
  };
}

export function buildFailureSignals(inputs: ObservabilityInputs) {
  const failures = [];
  const health = buildHealthSnapshot(inputs);
  if (health.negativeFeedbackRatePct >= 15) failures.push({ type: "FEEDBACK_SPIKE", severity: "HIGH", detail: `${health.negativeFeedbackRatePct}% negative feedback rate.` });
  if (health.pendingActionCount >= 20) failures.push({ type: "ACTION_BACKLOG", severity: "MEDIUM", detail: `${health.pendingActionCount} pending assistant actions.` });
  if (health.rejectedActionCount >= 5) failures.push({ type: "REJECTED_ACTIONS", severity: "HIGH", detail: `${health.rejectedActionCount} rejected assistant actions.` });
  if (inputs.releaseGate?.status === "BLOCKED") failures.push({ type: "RELEASE_GATE_BLOCKED", severity: "HIGH", detail: `Release gate score ${inputs.releaseGate.score}/${inputs.releaseGate.threshold}.` });
  return failures;
}

export function buildDriftSignals(inputs: ObservabilityInputs) {
  const bySurface = new Map<string, { total: number; weak: number }>();
  for (const audit of inputs.audits) {
    const row = bySurface.get(audit.surface) ?? { total: 0, weak: 0 };
    row.total += 1;
    if (!audit.evidencePresent && !audit.qualityPresent) row.weak += 1;
    bySurface.set(audit.surface, row);
  }
  return Array.from(bySurface.entries())
    .map(([surface, row]) => ({
      surface,
      weakRatePct: percent(row.weak, row.total),
      eventCount: row.total,
      severity: percent(row.weak, row.total) >= 50 ? "HIGH" : "MEDIUM",
      detail: `${row.weak}/${row.total} recent answers lack evidence or quality metadata.`,
    }))
    .filter((row) => row.weakRatePct >= 25 || row.eventCount >= 10)
    .sort((a, b) => b.weakRatePct - a.weakRatePct || b.eventCount - a.eventCount);
}

export function buildEvidenceCoverage(inputs: ObservabilityInputs) {
  const gaps = inputs.audits
    .filter((audit) => !audit.evidencePresent && !audit.qualityPresent)
    .slice(0, 20)
    .map((audit) => ({
      auditEventId: audit.id,
      surface: audit.surface,
      answerKind: audit.answerKind,
      objectType: audit.objectType,
      objectId: audit.objectId,
      gap: !audit.objectType || !audit.objectId ? "Missing object link and evidence metadata." : "Missing evidence or quality metadata.",
    }));
  return {
    coveragePct: buildHealthSnapshot(inputs).evidenceCoveragePct,
    gapCount: gaps.length,
    gaps,
  };
}

export function buildAutomationRisks(inputs: ObservabilityInputs) {
  return inputs.automations
    .filter((policy) => policy.status === "ENABLED" || policy.readinessScore < policy.threshold)
    .map((policy) => {
      const runs = inputs.shadowRuns.filter((run) => run.actionKind === policy.actionKind && run.matched != null);
      const matchRate = percent(runs.filter((run) => run.matched).length, runs.length);
      return {
        policyId: policy.id,
        actionKind: policy.actionKind,
        status: policy.status,
        readinessScore: policy.readinessScore,
        threshold: policy.threshold,
        shadowMatchRatePct: matchRate,
        severity: policy.status === "ENABLED" && matchRate < 80 ? "HIGH" : policy.readinessScore < policy.threshold ? "MEDIUM" : "LOW",
        risk: policy.status === "ENABLED" ? "Enabled automation needs monitoring against human decisions." : "Policy is below readiness threshold.",
        rollbackPlan: policy.rollbackPlan ?? `Pause automation for ${policy.actionKind} and route actions to human review.`,
      };
    })
    .filter((risk) => risk.severity !== "LOW");
}

export function buildDegradedMode(failures: ReturnType<typeof buildFailureSignals>, drift: ReturnType<typeof buildDriftSignals>, automationRisks: ReturnType<typeof buildAutomationRisks>) {
  const shouldDegrade = failures.some((failure) => failure.severity === "HIGH") || drift.some((signal) => signal.severity === "HIGH") || automationRisks.some((risk) => risk.severity === "HIGH");
  return {
    status: shouldDegrade ? "DEGRADED_REVIEW_ONLY" : "NORMAL_MONITORING",
    message: shouldDegrade
      ? "Assistant should operate in review-only mode for risky surfaces until evidence, feedback, and automation risks are reviewed."
      : "Assistant can remain in normal monitored mode.",
    allowedActions: shouldDegrade ? ["draft_answers", "queue_review", "show_evidence"] : ["draft_answers", "queue_review", "show_evidence", "run_low_risk_playbooks"],
  };
}

export function buildRollbackPlan(automationRisks: ReturnType<typeof buildAutomationRisks>) {
  const steps = [
    "Freeze new controlled automation enablement until incident review completes.",
    "Route assistant-proposed actions to human review queue.",
    "Inspect weak-answer and negative-feedback examples before re-enabling.",
  ];
  for (const risk of automationRisks.slice(0, 5)) steps.push(risk.rollbackPlan);
  return { steps };
}

export function scoreObservabilityHealth(inputs: ObservabilityInputs) {
  const health = buildHealthSnapshot(inputs);
  const failures = buildFailureSignals(inputs);
  const drift = buildDriftSignals(inputs);
  const automationRisks = buildAutomationRisks(inputs);
  const score =
    100 -
    Math.min(35, failures.length * 10) -
    Math.min(25, drift.length * 6) -
    Math.min(25, automationRisks.length * 8) -
    Math.min(20, Math.max(0, 70 - health.evidenceCoveragePct));
  return Math.max(0, Math.min(100, Math.round(score)));
}

export function buildObservabilityIncident(inputs: ObservabilityInputs) {
  const healthSnapshot = buildHealthSnapshot(inputs);
  const failureSignals = buildFailureSignals(inputs);
  const driftSignals = buildDriftSignals(inputs);
  const evidenceCoverage = buildEvidenceCoverage(inputs);
  const automationRisks = buildAutomationRisks(inputs);
  const degradedMode = buildDegradedMode(failureSignals, driftSignals, automationRisks);
  const rollbackPlan = buildRollbackPlan(automationRisks);
  const healthScore = scoreObservabilityHealth(inputs);
  const severity = healthScore < 45 || failureSignals.some((signal) => signal.severity === "HIGH") ? "HIGH" : healthScore < 70 ? "MEDIUM" : "LOW";
  const postmortem = {
    summary: `Assistant health score ${healthScore}/100 with ${failureSignals.length} failure signal(s), ${driftSignals.length} drift signal(s), and ${automationRisks.length} automation risk(s).`,
    timeline: inputs.audits.slice(0, 8).map((audit) => ({ at: audit.createdAt, surface: audit.surface, answerKind: audit.answerKind, feedback: audit.feedback })),
    rootCauseHypotheses: [
      evidenceCoverage.coveragePct < 70 ? "Evidence coverage below release target." : null,
      healthSnapshot.negativeFeedbackRatePct >= 15 ? "Negative feedback rate above tolerance." : null,
      automationRisks.length > 0 ? "Automation readiness or shadow-match risk needs review." : null,
    ].filter((item): item is string => Boolean(item)),
    followUp: "Review incident packet, pause risky automation where needed, and close only after evidence and feedback are rechecked.",
  };
  const leadershipSummary = [
    `Assistant observability health is ${healthScore}/100 (${severity}) across ${inputs.audits.length} recent audit event${inputs.audits.length === 1 ? "" : "s"}.`,
    `${failureSignals.length} failure signal${failureSignals.length === 1 ? "" : "s"}, ${driftSignals.length} drift signal${driftSignals.length === 1 ? "" : "s"}, ${evidenceCoverage.gapCount} evidence gap${evidenceCoverage.gapCount === 1 ? "" : "s"}, and ${automationRisks.length} automation risk${automationRisks.length === 1 ? "" : "s"} were found.`,
    `Recommended mode: ${degradedMode.status}. Rollback and postmortem steps are drafted for human approval; no automation policy is paused automatically.`,
  ].join("\n\n");
  return {
    title: `Assistant observability incident: score ${healthScore}/100`,
    status: "OPEN",
    severity,
    healthScore,
    auditEventCount: inputs.audits.length,
    failureCount: failureSignals.length,
    driftSignalCount: driftSignals.length,
    evidenceGapCount: evidenceCoverage.gapCount,
    automationRiskCount: automationRisks.length,
    healthSnapshot,
    failureSignals,
    driftSignals,
    evidenceCoverage,
    automationRisks,
    degradedMode,
    rollbackPlan,
    postmortem,
    leadershipSummary,
  };
}
