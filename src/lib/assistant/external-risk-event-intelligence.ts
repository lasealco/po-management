export type ExternalRiskEventInputs = {
  events: Array<{
    id: string;
    title: string;
    severity: string;
    reviewState: string;
    confidence: number;
    ownerUserId: string | null;
    discoveredTime: Date;
    sourceTrustScore: number | null;
    sourceCount: number;
    affectedEntityCount: number;
    affectedEntities: Array<{ matchConfidence: number }>;
    activeRecommendationCount: number;
  }>;
  twinSignals: Array<{ id: string; acknowledged: boolean }>;
  twinInsights: Array<{ id: string; status: string }>;
  warRooms: Array<{ id: string; status: string; riskScore: number }>;
  taskLinkCount: number;
};

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function severityTier(severity: string): number {
  const normalized = severity.toUpperCase();
  if (normalized === "CRITICAL") return 4;
  if (normalized === "HIGH") return 3;
  if (normalized === "MEDIUM") return 2;
  if (normalized === "LOW") return 1;
  return 0;
}

export function buildExternalEventReviewSignals(inputs: ExternalRiskEventInputs) {
  const hotRows = inputs.events.filter((event) => {
    const tier = severityTier(event.severity);
    const staleDaysMs = 14 * 86_400_000;
    const stale = Date.now() - event.discoveredTime.getTime() > staleDaysMs;
    const needsReview =
      event.reviewState === "NEW" ||
      event.reviewState === "UNDER_REVIEW" ||
      event.reviewState === "WATCH" ||
      event.reviewState === "ACTION_REQUIRED";
    const urgentSeverity = tier >= 3 && needsReview;
    const needsOwner = event.reviewState === "ACTION_REQUIRED" && !event.ownerUserId;
    const lowConfidenceQueue = event.reviewState === "NEW" && event.confidence < 52 && tier >= 2;
    const staleNew = event.reviewState === "NEW" && stale && tier >= 2;
    return urgentSeverity || needsOwner || lowConfidenceQueue || staleNew;
  });
  const eventReviewRiskCount = hotRows.length;
  return {
    eventReviewRiskCount,
    reviewSignals: hotRows.slice(0, 18).map((event) => ({
      eventId: event.id,
      title: event.title,
      severity: event.severity,
      reviewState: event.reviewState,
      reason:
        event.reviewState === "ACTION_REQUIRED" && !event.ownerUserId ? "ACTION_REQUIRED without assigned owner." : "Event remains in active triage or escalation posture.",
    })),
    guardrail:
      "External event overlays summarize SCRI triage posture — they do not advance review states, assign owners, dismiss events, or resolve ingest pipelines automatically.",
  };
}

export function buildExposureMappingSignals(inputs: ExternalRiskEventInputs) {
  const gaps = inputs.events.filter(
    (event) =>
      event.affectedEntityCount === 0 ||
      event.affectedEntities.some((entity) => entity.matchConfidence < 48 || Number.isNaN(entity.matchConfidence)),
  );
  const exposureLinkageRiskCount = gaps.length;
  return {
    exposureLinkageRiskCount,
    exposureGaps: gaps.slice(0, 16).map((event) => ({
      eventId: event.id,
      title: event.title,
      affectedEntityCount: event.affectedEntityCount,
      minConfidence:
        event.affectedEntities.length > 0 ? Math.min(...event.affectedEntities.map((entity) => entity.matchConfidence)) : null,
    })),
    guardrail:
      "Exposure linkage summaries cite deterministic SCRI matches — they do not add/remove entities, re-score corridors, or invoke deterministic matchers automatically.",
  };
}

export function buildTwinScenarioSignals(inputs: ExternalRiskEventInputs) {
  const twinOpen = inputs.twinSignals.filter((signal) => !signal.acknowledged).length;
  const insightsOpen = inputs.twinInsights.filter((insight) => insight.status === "OPEN").length;
  const twinScenarioRiskCount = twinOpen + insightsOpen;
  return {
    twinScenarioRiskCount,
    twinSignalsOpen: twinOpen,
    twinInsightsOpen: insightsOpen,
    guardrail:
      "Twin and scenario cues stay informational — they do not acknowledge risk signals, publish scenarios, or trigger mitigation workflows automatically.",
  };
}

export function buildMitigationPortfolioSignals(inputs: ExternalRiskEventInputs) {
  const backlog = inputs.events.reduce((total, event) => total + event.activeRecommendationCount, 0);
  const mitigationRecommendationRiskCount = Math.min(backlog, 240);
  return {
    mitigationRecommendationRiskCount,
    recommendationSignals: inputs.events
      .filter((event) => event.activeRecommendationCount > 0)
      .slice(0, 14)
      .map((event) => ({ eventId: event.id, title: event.title, activeRecommendationCount: event.activeRecommendationCount })),
    guardrail:
      "Mitigation portfolios summarize ACTIVE recommendation rows — they do not accept, reject, or execute mitigation outcomes automatically.",
  };
}

export function buildEscalationCadenceSignals(inputs: ExternalRiskEventInputs) {
  const warRoomsHot = inputs.warRooms.filter((room) => room.status !== "APPROVED" && room.riskScore >= 56).length;
  const actionOwnersMissing = inputs.events.filter((event) => event.reviewState === "ACTION_REQUIRED" && !event.ownerUserId).length;
  const coordinationEscalationRiskCount = warRoomsHot + Math.min(inputs.taskLinkCount, 40) + Math.min(actionOwnersMissing, 24);
  return {
    coordinationEscalationRiskCount,
    warRoomsHot,
    taskLinksTracked: inputs.taskLinkCount,
    actionOwnersMissing,
    guardrail:
      "Escalation overlays combine war rooms, SCRI task bridges, and ACTION_REQUIRED ownership gaps — they do not notify partners, create tickets, or page operators automatically.",
  };
}

export function buildCredibilitySignals(inputs: ExternalRiskEventInputs) {
  const weak = inputs.events.filter((event) => {
    const trustGap = event.sourceTrustScore != null && event.sourceTrustScore < 46;
    const confidenceGap = event.confidence < 42;
    const sourceGap = event.sourceCount === 0;
    return trustGap || confidenceGap || sourceGap;
  });
  const credibilityRiskCount = weak.length;
  return {
    credibilityRiskCount,
    credibilityGaps: weak.slice(0, 14).map((event) => ({
      eventId: event.id,
      title: event.title,
      confidence: event.confidence,
      sourceTrustScore: event.sourceTrustScore,
      sourceCount: event.sourceCount,
    })),
    guardrail:
      "Credibility cues highlight ingest confidence and connector trust — they do not hide feeds, edit trust floors, or mutate SCRI tuning automatically.",
  };
}

export function buildExternalRiskEventPacket(inputs: ExternalRiskEventInputs) {
  const externalEventJson = buildExternalEventReviewSignals(inputs);
  const exposureMappingJson = buildExposureMappingSignals(inputs);
  const twinScenarioJson = buildTwinScenarioSignals(inputs);
  const mitigationPortfolioJson = buildMitigationPortfolioSignals(inputs);
  const escalationCadenceJson = buildEscalationCadenceSignals(inputs);
  const credibilityJson = buildCredibilitySignals(inputs);

  const eventReviewRiskCount = externalEventJson.eventReviewRiskCount;
  const exposureLinkageRiskCount = exposureMappingJson.exposureLinkageRiskCount;
  const twinScenarioRiskCount = twinScenarioJson.twinScenarioRiskCount;
  const mitigationRecommendationRiskCount = mitigationPortfolioJson.mitigationRecommendationRiskCount;
  const coordinationEscalationRiskCount = escalationCadenceJson.coordinationEscalationRiskCount;
  const credibilityRiskCount = credibilityJson.credibilityRiskCount;

  const eventIntelligenceScore = clamp(
    Math.round(
      100 -
        Math.min(20, eventReviewRiskCount * 3) -
        Math.min(18, exposureLinkageRiskCount * 3) -
        Math.min(18, twinScenarioRiskCount * 3) -
        Math.min(14, Math.floor(mitigationRecommendationRiskCount / 3)) -
        Math.min(18, coordinationEscalationRiskCount * 2) -
        Math.min(14, credibilityRiskCount * 3),
    ),
  );

  const sourceSummary = {
    scriEventsSampled: inputs.events.length,
    twinSignalsSampled: inputs.twinSignals.length,
    twinInsightsSampled: inputs.twinInsights.length,
    warRoomsSampled: inputs.warRooms.length,
    taskLinksTracked: inputs.taskLinkCount,
    guardrail:
      "Sprint 20 packets unify SCRI external events, deterministic exposure links, Twin posture, ACTIVE mitigation recommendations, escalation bridges, and ingest credibility — leadership reviews outcomes before acknowledging risks, publishing Twin scenarios, notifying partners, or executing mitigations.",
  };

  const responsePlan = {
    status:
      eventIntelligenceScore < 66 ? "EXTERNAL_RISK_REVIEW_REQUIRED" : eventIntelligenceScore < 82 ? "SCR_OPS_DESK_REVIEW" : "MONITOR",
    owners: ["SCRI operations", "Twin reliability", "Risk council", "Carrier/supplier desk", "Executive communications"],
    steps: [
      "Confirm SCRI triage ownership before referencing ACTION_REQUIRED items externally.",
      "Validate exposure gaps against latest deterministic matchers — avoid manual entity edits from assistant packets.",
      "Treat Twin acknowledgements and Twin insight closures as separate governed workflows.",
      "Route mitigation recommendation acceptance through SCRI tooling — assistant packets stay narrative-only.",
    ],
    guardrail: "External risk plans remain advisory until SCRI and Twin councils execute governed workflows.",
  };

  const rollbackPlan = {
    steps: [
      "Rejecting a packet does not alter SCRI review states, Twin signals, war rooms, or mitigation statuses.",
      "Open a fresh packet after major ingest batches or twin scenario refreshes.",
      "Escalation narratives never retroactively edit SCRI audit logs or connector evidence.",
    ],
    guardrail: "Rollback keeps advisory overlays reversible — SCRI and Twin source records are never auto-reverted here.",
  };

  const leadershipSummary = [
    `Sprint 20 External Risk & Event Intelligence score is ${eventIntelligenceScore}/100 with ${eventReviewRiskCount} SCRI triage cue(s), ${exposureLinkageRiskCount} exposure linkage cue(s), ${twinScenarioRiskCount} Twin/scenario cue(s), ${mitigationRecommendationRiskCount} mitigation recommendation signal(s), ${coordinationEscalationRiskCount} coordination escalation cue(s), and ${credibilityRiskCount} credibility cue(s).`,
    escalationCadenceJson.guardrail,
    sourceSummary.guardrail,
  ].join("\n\n");

  return {
    title: `Sprint 20 External Risk & Event Intelligence: score ${eventIntelligenceScore}/100`,
    status: "DRAFT" as const,
    eventIntelligenceScore,
    eventReviewRiskCount,
    exposureLinkageRiskCount,
    twinScenarioRiskCount,
    mitigationRecommendationRiskCount,
    coordinationEscalationRiskCount,
    credibilityRiskCount,
    sourceSummary,
    externalEventJson,
    exposureMappingJson,
    twinScenarioJson,
    mitigationPortfolioJson,
    escalationCadenceJson,
    credibilityJson,
    responsePlan,
    rollbackPlan,
    leadershipSummary,
  };
}
