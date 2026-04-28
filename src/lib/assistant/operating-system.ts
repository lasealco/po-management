export type AssistantOperatingSignals = {
  auditTotal: number;
  evidenceRecordCount: number;
  pendingActionCount: number;
  completedActionCount: number;
  activePlaybookCount: number;
  completedPlaybookCount: number;
  approvedPromptCount: number;
  releaseGateScore: number;
  releaseGatePassed: boolean;
  enabledAutomationCount: number;
  adminPacketReady: boolean;
  apiHubOpenReviewCount: number;
  twinOpenInsightCount: number;
};

export function percent(part: number, whole: number) {
  if (whole <= 0) return 0;
  return Math.round((part / whole) * 100);
}

export function computeAssistantOperatingScore(signals: AssistantOperatingSignals) {
  const evidenceScore = Math.min(100, percent(signals.evidenceRecordCount, Math.max(1, signals.auditTotal)));
  const workScore = signals.pendingActionCount === 0 ? 100 : Math.max(0, 100 - signals.pendingActionCount * 5);
  const playbookScore = Math.min(100, percent(signals.completedPlaybookCount + signals.activePlaybookCount, 5));
  const governanceScore = Math.round(
    (signals.releaseGateScore + (signals.releaseGatePassed ? 20 : 0) + (signals.adminPacketReady ? 20 : 0)) / 1.4,
  );
  const integrationScore = Math.max(0, 100 - signals.apiHubOpenReviewCount * 6 - signals.twinOpenInsightCount * 4);
  return Math.max(0, Math.min(100, Math.round((evidenceScore + workScore + playbookScore + governanceScore + integrationScore) / 5)));
}

export function buildAssistantDemoScript(signals: AssistantOperatingSignals) {
  return [
    {
      step: 1,
      title: "Open the assistant as the operating layer",
      href: "/assistant",
      talkTrack: `Start with chat and show ${signals.auditTotal} recorded assistant interactions tied to evidence and actions.`,
    },
    {
      step: 2,
      title: "Show work execution and human control",
      href: "/assistant/work-engine",
      talkTrack: `Review ${signals.pendingActionCount} pending and ${signals.completedActionCount} completed action-queue items with playbook state.`,
    },
    {
      step: 3,
      title: "Prove quality and governance",
      href: "/assistant/evidence-quality",
      talkTrack: `Show ${signals.evidenceRecordCount} evidence records, approved prompts, release gates, and reviewer feedback.`,
    },
    {
      step: 4,
      title: "Show controlled automation",
      href: "/assistant/governed-automation",
      talkTrack: `Explain ${signals.enabledAutomationCount} enabled automation policies and why unsafe policies remain shadowed or paused.`,
    },
    {
      step: 5,
      title: "Open admin and compliance packet",
      href: "/assistant/admin",
      talkTrack: signals.adminPacketReady
        ? "Exported admin packet is ready for customer review."
        : "Admin packet is not ready yet; show blockers before rollout.",
    },
    {
      step: 6,
      title: "Close with API Hub and Supply Chain Twin",
      href: "/assistant/operating-system",
      talkTrack: `Connect external data review (${signals.apiHubOpenReviewCount} open API Hub items) and twin insights (${signals.twinOpenInsightCount} open).`,
    },
  ];
}

export function buildAssistantBoardReport(input: {
  generatedAt: string;
  tenantName: string;
  signals: AssistantOperatingSignals;
}) {
  const score = computeAssistantOperatingScore(input.signals);
  const status = score >= 80 ? "CUSTOMER_READY" : score >= 60 ? "PILOT_READY" : "NEEDS_WORK";
  return {
    reportType: "AMP12_ASSISTANT_OPERATING_SYSTEM_REPORT",
    generatedAt: input.generatedAt,
    tenantName: input.tenantName,
    status,
    score,
    executiveSummary: [
      `Assistant operating score is ${score}/100 (${status}).`,
      `${input.signals.auditTotal} interactions, ${input.signals.evidenceRecordCount} evidence records, ${input.signals.completedActionCount} completed actions.`,
      `Governance: release gate ${input.signals.releaseGatePassed ? "passed" : "not passed"}, admin packet ${input.signals.adminPacketReady ? "ready" : "not ready"}.`,
    ].join(" "),
    demoScript: buildAssistantDemoScript(input.signals),
    metrics: input.signals,
    limitations: [
      "Assistant proposes and queues work; high-impact mutations require human approval.",
      "Demo readiness depends on seeded tenant data and current permission grants.",
      "Automation remains governed by AMP8 policy guardrails and AMP11 admin controls.",
    ],
  };
}
