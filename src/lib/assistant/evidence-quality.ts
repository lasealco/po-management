export type AssistantEvidenceItem = {
  label: string;
  href: string | null;
  excerpt: string | null;
};

export type AssistantQualityEvent = {
  evidence: unknown;
  quality: unknown;
  feedback: string | null;
  objectType: string | null;
  objectId: string | null;
};

export type AssistantReleaseGateCheck = {
  key: string;
  label: string;
  passed: boolean;
  metric: string;
  weight: number;
};

export function extractAssistantEvidenceItems(value: unknown): AssistantEvidenceItem[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item): AssistantEvidenceItem | null => {
      if (!item || typeof item !== "object") return null;
      const record = item as Record<string, unknown>;
      const label = typeof record.label === "string" ? record.label.trim() : "";
      const href = typeof record.href === "string" && record.href.trim() ? record.href.trim() : null;
      const excerpt = typeof record.excerpt === "string" && record.excerpt.trim() ? record.excerpt.trim() : null;
      if (!label && !href && !excerpt) return null;
      return { label: label || href || "Evidence", href, excerpt };
    })
    .filter((item): item is AssistantEvidenceItem => item != null)
    .slice(0, 20);
}

export function hasAssistantEvidence(event: AssistantQualityEvent) {
  return extractAssistantEvidenceItems(event.evidence).length > 0 || event.quality != null;
}

export function isWeakAssistantAnswer(event: AssistantQualityEvent) {
  return !hasAssistantEvidence(event) || event.feedback === "not_helpful" || !event.objectType || !event.objectId;
}

export function percent(part: number, whole: number) {
  if (whole <= 0) return 0;
  return Math.round((part / whole) * 100);
}

export function buildAssistantReleaseGate(params: {
  auditTotal: number;
  evidenceBacked: number;
  feedbackCount: number;
  weakCount: number;
  approvedPromptCount: number;
  threshold?: number;
}) {
  const threshold = params.threshold ?? 75;
  const evidenceCoverage = percent(params.evidenceBacked, params.auditTotal);
  const feedbackCoverage = percent(params.feedbackCount, params.auditTotal);
  const weakRate = percent(params.weakCount, params.auditTotal);
  const promptReady = params.approvedPromptCount >= 3;
  const checks: AssistantReleaseGateCheck[] = [
    {
      key: "evidence_coverage",
      label: "Evidence coverage",
      passed: evidenceCoverage >= 70,
      metric: `${evidenceCoverage}% evidence-backed answers`,
      weight: 35,
    },
    {
      key: "feedback_coverage",
      label: "Feedback coverage",
      passed: feedbackCoverage >= 30,
      metric: `${feedbackCoverage}% reviewed answers`,
      weight: 20,
    },
    {
      key: "weak_answer_backlog",
      label: "Weak-answer backlog",
      passed: weakRate <= 35,
      metric: `${weakRate}% weak / no-evidence / unlinked answers`,
      weight: 25,
    },
    {
      key: "prompt_library",
      label: "Prompt library",
      passed: promptReady,
      metric: `${params.approvedPromptCount} approved prompt starters`,
      weight: 20,
    },
  ];
  const score = checks.reduce((sum, check) => sum + (check.passed ? check.weight : 0), 0);
  return {
    score,
    threshold,
    status: score >= threshold && checks.every((check) => check.passed || check.weight < 25) ? "PASSED" : "BLOCKED",
    checks,
  };
}
