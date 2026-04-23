import type {
  ScriEventAffectedEntity,
  ScriEventGeography,
  ScriEventSource,
  ScriExternalEvent,
} from "@prisma/client";

import {
  scriImpactLevelLabel,
  scriMatchTier,
} from "@/lib/scri/matching/impact-level";
import { scriEventTypeLabel } from "@/lib/scri/event-type-taxonomy";

export type ScriEventListItemDto = ReturnType<typeof toScriEventListItemDto>;

type ListRow = ScriExternalEvent & {
  sources: ScriEventSource[];
  geographies: ScriEventGeography[];
  affectedEntities: Pick<ScriEventAffectedEntity, "objectType">[];
};

type DetailRow = ScriExternalEvent & {
  sources: ScriEventSource[];
  geographies: ScriEventGeography[];
  affectedEntities: ScriEventAffectedEntity[];
};

export function toScriEventListItemDto(row: ListRow) {
  return {
    id: row.id,
    ingestKey: row.ingestKey,
    clusterKey: row.clusterKey,
    eventType: row.eventType,
    eventTypeLabel: scriEventTypeLabel(row.eventType),
    title: row.title,
    shortSummary: row.shortSummary,
    eventTime: row.eventTime?.toISOString() ?? null,
    discoveredTime: row.discoveredTime.toISOString(),
    severity: row.severity,
    confidence: row.confidence,
    reviewState: row.reviewState,
    sourceCount: row.sourceCount,
    sourceTrustScore: row.sourceTrustScore,
    geographySummary: summarizeGeographies(row.geographies),
    sources: row.sources.map(toSourceDto),
    geographies: row.geographies.map(toGeoDto),
    affectedCounts: summarizeAffectedCounts(row.affectedEntities.map((a) => a.objectType)),
    affectedTotal: row.affectedEntities.length,
  };
}

export function toScriEventDetailDto(row: DetailRow) {
  const listPart = toScriEventListItemDto({
    ...row,
    affectedEntities: row.affectedEntities.map((a) => ({ objectType: a.objectType })),
  });
  return {
    ...listPart,
    longSummary: row.longSummary,
    aiSummary: row.aiSummary,
    structuredPayload: row.structuredPayload,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    affectedEntities: row.affectedEntities.map(toAffectedDto),
  };
}

function toAffectedDto(a: ScriEventAffectedEntity) {
  const matchTier = scriMatchTier(a.matchConfidence, a.matchType);
  return {
    id: a.id,
    objectType: a.objectType,
    objectId: a.objectId,
    matchType: a.matchType,
    matchConfidence: a.matchConfidence,
    impactLevel: a.impactLevel,
    impactLevelLabel: scriImpactLevelLabel(a.impactLevel),
    matchTier,
    rationale: a.rationale,
  };
}

function summarizeAffectedCounts(objectTypes: string[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const t of objectTypes) {
    out[t] = (out[t] ?? 0) + 1;
  }
  return out;
}

function toSourceDto(s: ScriEventSource) {
  return {
    id: s.id,
    sourceType: s.sourceType,
    publisher: s.publisher,
    url: s.url,
    headline: s.headline,
    publishedAt: s.publishedAt?.toISOString() ?? null,
    extractionConfidence: s.extractionConfidence,
  };
}

function toGeoDto(g: ScriEventGeography) {
  return {
    id: g.id,
    countryCode: g.countryCode,
    region: g.region,
    portUnloc: g.portUnloc,
    label: g.label,
    raw: g.raw,
  };
}

function summarizeGeographies(geos: ScriEventGeography[]): string | null {
  if (!geos.length) return null;
  const parts = geos.map((g) => g.label || g.portUnloc || g.region || g.countryCode).filter(Boolean);
  return parts.length ? parts.slice(0, 3).join(" · ") : null;
}
