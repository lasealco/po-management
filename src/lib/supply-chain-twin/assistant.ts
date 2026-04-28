export type TwinAssistantGraphMetrics = {
  entityCount: number;
  edgeCount: number;
  entityKinds: Array<{ entityKind: string; count: number }>;
  openRiskCount: number;
  scenarioCount: number;
};

export function percent(part: number, whole: number) {
  if (whole <= 0) return 0;
  return Math.round((part / whole) * 100);
}

export function computeTwinGraphConfidence(metrics: TwinAssistantGraphMetrics) {
  const kindCoverage = percent(metrics.entityKinds.length, 6);
  const edgeDensity = percent(metrics.edgeCount, Math.max(1, metrics.entityCount));
  const scenarioCoverage = percent(metrics.scenarioCount, 3);
  const riskPenalty = Math.min(25, metrics.openRiskCount * 5);
  return Math.max(0, Math.min(100, Math.round(kindCoverage * 0.35 + edgeDensity * 0.3 + scenarioCoverage * 0.2 + 15 - riskPenalty)));
}

export function buildTwinAssistantSummary(metrics: TwinAssistantGraphMetrics) {
  const confidence = computeTwinGraphConfidence(metrics);
  const topKinds = metrics.entityKinds
    .slice(0, 5)
    .map((row) => `${row.entityKind}: ${row.count}`)
    .join(" · ");
  return [
    `Twin graph confidence is ${confidence}/100 across ${metrics.entityCount} entities and ${metrics.edgeCount} edges.`,
    topKinds ? `Entity coverage: ${topKinds}.` : "No entity-kind coverage yet.",
    `${metrics.openRiskCount} open risk signal${metrics.openRiskCount === 1 ? "" : "s"} and ${metrics.scenarioCount} scenario draft${metrics.scenarioCount === 1 ? "" : "s"}.`,
  ].join("\n");
}

export function buildTwinScenarioDraftFromPrompt(input: {
  prompt: string;
  confidenceScore: number;
  openRiskCount: number;
  entityKinds: Array<{ entityKind: string; count: number }>;
}) {
  const trimmedPrompt = input.prompt.trim().slice(0, 2000);
  return {
    source: "AMP10_TWIN_ASSISTANT",
    prompt: trimmedPrompt,
    confidenceScore: input.confidenceScore,
    assumptions: [
      "Scenario is a draft only; no graph or transaction rows are mutated.",
      "Operator must validate impacted entities and risk links before action.",
    ],
    signals: {
      openRiskCount: input.openRiskCount,
      entityKinds: input.entityKinds.slice(0, 10),
    },
    steps: [
      "Review graph confidence and missing entity kinds.",
      "Link relevant risk signals and operational objects.",
      "Create assistant work item for owner review.",
      "Compare against another scenario before making operational changes.",
    ],
  };
}

export function buildTwinRiskPlaybookSummary(risk: {
  code: string;
  severity: string;
  title: string;
  detail: string | null;
}) {
  return [
    `${risk.severity} twin risk ${risk.code}: ${risk.title}.`,
    risk.detail ?? "No detail captured.",
    "Recommended flow: link affected entities, create scenario draft, assign human review, then acknowledge only after mitigation is accepted.",
  ].join("\n");
}
