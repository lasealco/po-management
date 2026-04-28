export const ASSISTANT_AUTOMATION_POLICY_STATUSES = ["SHADOW", "ENABLED", "PAUSED", "DISABLED"] as const;
export type AssistantAutomationPolicyStatus = (typeof ASSISTANT_AUTOMATION_POLICY_STATUSES)[number];

export type AssistantAutomationReadinessInput = {
  recentCount: number;
  completedCount: number;
  rejectedCount: number;
  shadowRunCount: number;
  shadowMatchCount: number;
  evidenceCoveragePct: number;
  releaseGatePassed: boolean;
};

export function parseAssistantAutomationPolicyStatus(value: unknown): AssistantAutomationPolicyStatus | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toUpperCase();
  return ASSISTANT_AUTOMATION_POLICY_STATUSES.includes(normalized as AssistantAutomationPolicyStatus)
    ? (normalized as AssistantAutomationPolicyStatus)
    : null;
}

export function percent(part: number, whole: number) {
  if (whole <= 0) return 0;
  return Math.round((part / whole) * 100);
}

export function computeAutomationReadiness(input: AssistantAutomationReadinessInput) {
  const completionPct = percent(input.completedCount, input.recentCount);
  const rejectionPct = percent(input.rejectedCount, input.recentCount);
  const shadowMatchPct = percent(input.shadowMatchCount, input.shadowRunCount);
  const score = Math.max(
    0,
    Math.min(
      100,
      Math.round(
        completionPct * 0.35 +
          input.evidenceCoveragePct * 0.25 +
          shadowMatchPct * 0.25 +
          (input.releaseGatePassed ? 15 : 0) -
          Math.min(20, rejectionPct * 0.3),
      ),
    ),
  );
  const guardrails = [
    {
      key: "human_completion_history",
      label: "Human completion history",
      passed: input.recentCount >= 3 && completionPct >= 60,
      detail: `${input.completedCount}/${input.recentCount} recent actions completed`,
    },
    {
      key: "shadow_match_rate",
      label: "Shadow match rate",
      passed: input.shadowRunCount === 0 ? false : shadowMatchPct >= 70,
      detail: `${shadowMatchPct}% shadow decisions matched humans`,
    },
    {
      key: "evidence_coverage",
      label: "Evidence coverage",
      passed: input.evidenceCoveragePct >= 70,
      detail: `${input.evidenceCoveragePct}% recent answers have evidence or quality metadata`,
    },
    {
      key: "release_gate",
      label: "AMP7 release gate",
      passed: input.releaseGatePassed,
      detail: input.releaseGatePassed ? "Latest quality gate passed" : "Quality gate is not passed",
    },
    {
      key: "low_rejection_rate",
      label: "Low rejection rate",
      passed: rejectionPct <= 20,
      detail: `${rejectionPct}% rejected`,
    },
  ];
  return {
    score,
    completionPct,
    rejectionPct,
    shadowMatchPct,
    guardrails,
    canEnable: score >= 80 && guardrails.every((guardrail) => guardrail.passed),
  };
}

export function defaultRollbackPlan(actionKind: string) {
  return [
    `Pause policy for ${actionKind}.`,
    "Return all new proposed work to the human action queue.",
    "Review the last 10 shadow/controlled runs and mark mismatches.",
    "Require a fresh AMP7 release-gate pass before re-enabling.",
  ].join("\n");
}
