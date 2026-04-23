import type { ScriEventGeography, ScriEventSource, ScriExternalEvent } from "@prisma/client";

export type ScriEventListItemDto = ReturnType<typeof toScriEventListItemDto>;

export function toScriEventListItemDto(
  row: ScriExternalEvent & {
    sources: ScriEventSource[];
    geographies: ScriEventGeography[];
  },
) {
  return {
    id: row.id,
    ingestKey: row.ingestKey,
    clusterKey: row.clusterKey,
    eventType: row.eventType,
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
  };
}

export function toScriEventDetailDto(row: Parameters<typeof toScriEventListItemDto>[0]) {
  return {
    ...toScriEventListItemDto(row),
    longSummary: row.longSummary,
    aiSummary: row.aiSummary,
    structuredPayload: row.structuredPayload,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
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
  };
}

function summarizeGeographies(geos: ScriEventGeography[]): string | null {
  if (!geos.length) return null;
  const parts = geos.map((g) => g.label || g.portUnloc || g.region || g.countryCode).filter(Boolean);
  return parts.length ? parts.slice(0, 3).join(" · ") : null;
}
