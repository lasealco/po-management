export type RiskWarRoomSeverity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export type RiskWarRoomEventSignal = {
  id: string;
  ingestKey: string;
  clusterKey: string | null;
  eventType: string;
  title: string;
  shortSummary: string | null;
  severity: RiskWarRoomSeverity;
  confidence: number;
  reviewState: string;
  discoveredTime: string;
  sourceCount: number;
  geographyLabels: string[];
  affectedEntities: RiskWarRoomAffectedEntity[];
  recommendations: RiskWarRoomRecommendation[];
};

export type RiskWarRoomAffectedEntity = {
  objectType: string;
  objectId: string;
  matchType: string;
  matchConfidence: number;
  impactLevel: string | null;
  rationale: string;
};

export type RiskWarRoomRecommendation = {
  id: string;
  recommendationType: string;
  targetObjectType: string | null;
  targetObjectId: string | null;
  priority: number;
  confidence: number;
  expectedEffect: string | null;
  status: string;
};

const SEVERITY_SCORE: Record<RiskWarRoomSeverity, number> = {
  LOW: 20,
  MEDIUM: 45,
  HIGH: 72,
  CRITICAL: 94,
};

function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function topSeverity(events: RiskWarRoomEventSignal[]): RiskWarRoomSeverity {
  return events.reduce<RiskWarRoomSeverity>((highest, event) => (SEVERITY_SCORE[event.severity] > SEVERITY_SCORE[highest] ? event.severity : highest), "LOW");
}

export function clusterRiskEvents(events: RiskWarRoomEventSignal[]) {
  const groups = new Map<string, RiskWarRoomEventSignal[]>();
  for (const event of events) {
    const geo = event.geographyLabels[0]?.toLowerCase() ?? "global";
    const key = event.clusterKey?.trim() || `${event.eventType}:${event.severity}:${geo}`;
    groups.set(key, [...(groups.get(key) ?? []), event]);
  }
  return Array.from(groups.entries())
    .map(([clusterKey, items]) => ({
      clusterKey,
      eventCount: items.length,
      eventIds: items.map((event) => event.id),
      titles: items.map((event) => event.title).slice(0, 6),
      eventTypes: Array.from(new Set(items.map((event) => event.eventType))).sort(),
      geographies: Array.from(new Set(items.flatMap((event) => event.geographyLabels))).sort(),
      severity: topSeverity(items),
      confidence: clampScore(items.reduce((sum, event) => sum + event.confidence, 0) / Math.max(1, items.length)),
    }))
    .sort((a, b) => SEVERITY_SCORE[b.severity] - SEVERITY_SCORE[a.severity] || b.eventCount - a.eventCount);
}

export function buildRiskExposureMap(events: RiskWarRoomEventSignal[]) {
  const objectMap = new Map<string, RiskWarRoomAffectedEntity & { eventIds: string[]; exposureScore: number }>();
  for (const event of events) {
    for (const entity of event.affectedEntities) {
      const key = `${entity.objectType}:${entity.objectId}`;
      const previous = objectMap.get(key);
      const exposureScore = clampScore(SEVERITY_SCORE[event.severity] * 0.55 + entity.matchConfidence * 0.35 + (entity.impactLevel ? 8 : 0));
      objectMap.set(key, {
        ...(previous ?? entity),
        eventIds: Array.from(new Set([...(previous?.eventIds ?? []), event.id])),
        exposureScore: Math.max(previous?.exposureScore ?? 0, exposureScore),
      });
    }
  }
  const objects = Array.from(objectMap.values()).sort((a, b) => b.exposureScore - a.exposureScore || a.objectType.localeCompare(b.objectType));
  const objectTypeCounts = objects.reduce<Record<string, number>>((acc, object) => {
    acc[object.objectType] = (acc[object.objectType] ?? 0) + 1;
    return acc;
  }, {});
  return {
    totalObjects: objects.length,
    objectTypeCounts,
    topObjects: objects.slice(0, 20),
    highExposureCount: objects.filter((object) => object.exposureScore >= 70).length,
  };
}

export function scoreRiskWarRoom(events: RiskWarRoomEventSignal[], exposure: ReturnType<typeof buildRiskExposureMap>) {
  if (events.length === 0) return { severity: "LOW" as RiskWarRoomSeverity, riskScore: 0 };
  const severityScore = SEVERITY_SCORE[topSeverity(events)];
  const confidencePressure = Math.min(12, events.reduce((sum, event) => sum + event.confidence, 0) / Math.max(1, events.length) / 8);
  const exposurePressure = Math.min(22, exposure.totalObjects * 2 + exposure.highExposureCount * 4);
  const recommendationPressure = Math.min(14, events.flatMap((event) => event.recommendations).filter((rec) => rec.status === "ACTIVE").length * 3);
  const riskScore = clampScore(severityScore + confidencePressure + exposurePressure + recommendationPressure);
  const severity: RiskWarRoomSeverity = riskScore >= 90 ? "CRITICAL" : riskScore >= 70 ? "HIGH" : riskScore >= 40 ? "MEDIUM" : "LOW";
  return { severity, riskScore };
}

export function buildRiskWarRoomDraft(input: { events: RiskWarRoomEventSignal[]; prompt?: string | null }) {
  const events = [...input.events].sort((a, b) => b.discoveredTime.localeCompare(a.discoveredTime));
  const clusters = clusterRiskEvents(events);
  const exposure = buildRiskExposureMap(events);
  const score = scoreRiskWarRoom(events, exposure);
  const primary = events.toSorted((a, b) => SEVERITY_SCORE[b.severity] - SEVERITY_SCORE[a.severity] || b.confidence - a.confidence)[0] ?? null;
  const activeRecommendations = events.flatMap((event) => event.recommendations.filter((rec) => rec.status === "ACTIVE"));
  const title = input.prompt?.trim() || (primary ? `Risk war room: ${primary.title}` : "Risk intelligence war room");
  const geographies = Array.from(new Set(events.flatMap((event) => event.geographyLabels))).sort();
  const eventCluster = {
    eventCount: events.length,
    clusters,
    primaryEventId: primary?.id ?? null,
    topEventTitles: events.map((event) => event.title).slice(0, 8),
    geographies,
  };
  const scenarioProposal = {
    title: primary ? `[War room] ${primary.title}`.slice(0, 200) : "Risk war room scenario",
    origin: "ASSISTANT_RISK_WAR_ROOM",
    primaryScriEventId: primary?.id ?? null,
    assumptions: [
      `${events.length} external risk event${events.length === 1 ? "" : "s"} remain under human triage.`,
      `${exposure.totalObjects} matched internal object${exposure.totalObjects === 1 ? "" : "s"} may need Twin scenario validation.`,
      "Scenario is drafted only; Twin solver and source-record mutations require separate approval.",
    ],
    affectedObjects: exposure.topObjects.slice(0, 12),
  };
  const mitigationPlan = {
    activeRecommendationCount: activeRecommendations.length,
    steps: [
      { step: "Triage cluster", owner: "Risk owner", action: "Confirm event grouping, severity, and current review state before operational action." },
      { step: "Validate exposure", owner: "Operations", action: "Review top affected shipments, suppliers, orders, and other matched objects against live module data." },
      { step: "Run scenario", owner: "Twin planner", action: "Create a Twin draft from the primary event and compare mitigation assumptions." },
      { step: "Queue mitigations", owner: "Domain leads", action: "Approve recovery, supplier, customer, or transport work in the action queue; no silent mutations." },
      { step: "Communicate", owner: "Account / supplier owner", action: "Edit and approve drafted updates before sending externally." },
    ],
    recommendations: activeRecommendations
      .sort((a, b) => b.priority - a.priority || b.confidence - a.confidence)
      .slice(0, 10)
      .map((rec) => ({
        recommendationType: rec.recommendationType,
        targetObjectType: rec.targetObjectType,
        targetObjectId: rec.targetObjectId,
        priority: rec.priority,
        confidence: rec.confidence,
        expectedEffect: rec.expectedEffect,
      })),
  };
  const communicationDraft = {
    customer: [
      `We are monitoring a supply-chain risk event affecting ${geographies.slice(0, 3).join(", ") || "the network"}.`,
      `Current operational review covers ${exposure.totalObjects} potentially affected object${exposure.totalObjects === 1 ? "" : "s"}.`,
      "We will provide confirmed recovery timing after human review. This update excludes internal supplier, cost, and risk-scoring details.",
    ].join("\n\n"),
    supplier: [
      `Please review potential exposure for ${primary?.title ?? "the current risk event"}.`,
      "Confirm capacity, lead-time, and contingency options for affected lanes or materials. Do not treat this as an automated PO or shipment change.",
    ].join("\n\n"),
    internal: [
      `${score.severity} risk war room scored ${score.riskScore}/100 for ${events.length} event${events.length === 1 ? "" : "s"}.`,
      `Exposure: ${exposure.totalObjects} objects, ${exposure.highExposureCount} high-exposure matches, ${activeRecommendations.length} active recommendations.`,
      "Queue mitigations for approval before changing source records.",
    ].join("\n\n"),
  };

  return {
    title,
    severity: score.severity,
    riskScore: score.riskScore,
    primaryScriEventId: primary?.id ?? null,
    eventCluster,
    exposureMap: exposure,
    scenarioProposal,
    mitigationPlan,
    communicationDraft,
  };
}
