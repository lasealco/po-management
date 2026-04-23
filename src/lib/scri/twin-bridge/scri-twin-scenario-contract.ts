/**
 * SCRI → Supply Chain Twin scenario seed contract (Phase F / R6).
 *
 * - **Risk signal:** `SupplyChainTwinRiskSignal` upserted with stable `code = scriRiskSignalCodeFromIngestKey(ingestKey)`.
 * - **Scenario draft:** `SupplyChainTwinScenarioDraft.draftJson` shape {@link TWIN_SCENARIO_SEED_FROM_SCRI_V1}.
 * - **Ingest spine:** append-only row `type = "scri_scenario_launch"` (audit / integrations).
 *
 * Bump `version` / `proto` only with intentional migrations of consumers.
 */
export const TWIN_SCENARIO_SEED_PROTO = "twin_scenario_seed_from_scri_v1" as const;

export type TwinScenarioSeedFromScriV1 = {
  version: 1;
  proto: typeof TWIN_SCENARIO_SEED_PROTO;
  origin: "SCRI_EVENT";
  scri: {
    eventId: string;
    ingestKey: string;
    clusterKey: string | null;
    eventType: string;
    severity: string;
    title: string;
    shortSummary: string | null;
    discoveredTime: string;
    eventTime: string | null;
    geographySummary: { countryCode: string | null; region: string | null; portUnloc: string | null; label: string | null }[];
    affectedEntities: {
      objectType: string;
      objectId: string;
      matchType: string;
      matchConfidence: number;
      impactLevel: string | null;
    }[];
  };
  twin: {
    riskSignalCode: string;
  };
  notes: string;
};

/** Stable, tenant-unique risk code for upsert (ties SCRI event ↔ twin signal). */
export function scriRiskSignalCodeFromIngestKey(ingestKey: string): string {
  return `SCRI:${ingestKey.trim()}`;
}
