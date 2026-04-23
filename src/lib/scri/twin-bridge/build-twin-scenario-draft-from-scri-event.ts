import type { ScriEventAffectedEntity, ScriEventGeography, ScriExternalEvent } from "@prisma/client";

import {
  scriRiskSignalCodeFromIngestKey,
  type TwinScenarioSeedFromScriV1,
  TWIN_SCENARIO_SEED_PROTO,
} from "@/lib/scri/twin-bridge/scri-twin-scenario-contract";

const MAX_AFFECTED_IN_DRAFT = 80;

type EventRow = Pick<
  ScriExternalEvent,
  | "id"
  | "ingestKey"
  | "clusterKey"
  | "eventType"
  | "severity"
  | "title"
  | "shortSummary"
  | "discoveredTime"
  | "eventTime"
>;

export type BuildTwinScenarioFromScriResult = {
  title: string;
  riskSignalTitle: string;
  riskSignalDetail: string;
  draft: TwinScenarioSeedFromScriV1;
};

function trimDetail(s: string, max: number): string {
  if (s.length <= max) return s;
  return `${s.slice(0, max - 1)}…`;
}

/**
 * Builds twin scenario draft JSON + risk signal copy from a loaded SCRI event (server-only).
 */
export function buildTwinScenarioDraftFromScriEvent(
  event: EventRow,
  geographies: ScriEventGeography[],
  affectedEntities: ScriEventAffectedEntity[],
): BuildTwinScenarioFromScriResult {
  const riskSignalCode = scriRiskSignalCodeFromIngestKey(event.ingestKey);
  const geoSummary = geographies.map((g) => ({
    countryCode: g.countryCode,
    region: g.region,
    portUnloc: g.portUnloc,
    label: g.label,
  }));
  const affected = affectedEntities
    .slice()
    .sort((a, b) => b.matchConfidence - a.matchConfidence)
    .slice(0, MAX_AFFECTED_IN_DRAFT)
    .map((a) => ({
      objectType: a.objectType,
      objectId: a.objectId,
      matchType: a.matchType,
      matchConfidence: a.matchConfidence,
      impactLevel: a.impactLevel,
    }));

  const draft: TwinScenarioSeedFromScriV1 = {
    version: 1,
    proto: TWIN_SCENARIO_SEED_PROTO,
    origin: "SCRI_EVENT",
    scri: {
      eventId: event.id,
      ingestKey: event.ingestKey,
      clusterKey: event.clusterKey,
      eventType: event.eventType,
      severity: event.severity,
      title: event.title,
      shortSummary: event.shortSummary,
      discoveredTime: event.discoveredTime.toISOString(),
      eventTime: event.eventTime?.toISOString() ?? null,
      geographySummary: geoSummary,
      affectedEntities: affected,
    },
    twin: { riskSignalCode },
    notes:
      "Seeded from Supply Chain Risk Intelligence. Refine assumptions in the twin workspace; graph solver not run automatically.",
  };

  const titleBase = `[SCRI] ${event.title}`.trim();
  const title = titleBase.length > 200 ? titleBase.slice(0, 200) : titleBase;

  const riskSignalTitle = trimDetail(`SCRI: ${event.title}`, 512);
  const detailParts = [
    event.shortSummary?.trim() || null,
    `Type: ${event.eventType} · Severity: ${event.severity}`,
    affectedEntities.length
      ? `R2 matches: ${affectedEntities.length} (top ${affected.length} embedded in scenario draft).`
      : "No R2 matches yet — scenario still carries geography and classification.",
  ].filter(Boolean);
  const riskSignalDetail = trimDetail(detailParts.join("\n"), 8000);

  return {
    title,
    riskSignalTitle,
    riskSignalDetail,
    draft,
  };
}
