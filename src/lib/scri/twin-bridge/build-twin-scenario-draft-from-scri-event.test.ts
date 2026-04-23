import { describe, expect, it } from "vitest";

import { buildTwinScenarioDraftFromScriEvent } from "@/lib/scri/twin-bridge/build-twin-scenario-draft-from-scri-event";
import { TWIN_SCENARIO_SEED_PROTO } from "@/lib/scri/twin-bridge/scri-twin-scenario-contract";

describe("buildTwinScenarioDraftFromScriEvent", () => {
  it("embeds contract proto, risk code, and caps affected rows", () => {
    const discovered = new Date("2026-01-15T12:00:00.000Z");
    const affected = Array.from({ length: 100 }, (_, i) => ({
      id: `ae-${i}`,
      tenantId: "t1",
      eventId: "evt1",
      objectType: "SHIPMENT",
      objectId: `s-${i}`,
      matchType: "PORT_UNLOC",
      matchConfidence: 50 + (i % 40),
      impactLevel: "MEDIUM",
      rationale: "test",
      createdAt: discovered,
      updatedAt: discovered,
    }));

    const out = buildTwinScenarioDraftFromScriEvent(
      {
        id: "evt1",
        ingestKey: "ingest-abc",
        clusterKey: null,
        eventType: "PORT_CONGESTION",
        severity: "HIGH",
        title: "Delay at port",
        shortSummary: "Summary line",
        discoveredTime: discovered,
        eventTime: null,
      },
      [
        {
          id: "g1",
          eventId: "evt1",
          countryCode: "US",
          region: null,
          portUnloc: "USNYC",
          label: "NYC",
          raw: null,
        },
      ],
      affected,
    );

    expect(out.draft.version).toBe(1);
    expect(out.draft.proto).toBe(TWIN_SCENARIO_SEED_PROTO);
    expect(out.draft.twin.riskSignalCode).toBe("SCRI:ingest-abc");
    expect(out.draft.scri.affectedEntities.length).toBe(80);
    expect(out.title.startsWith("[SCRI]")).toBe(true);
    expect(out.riskSignalTitle).toContain("Delay at port");
  });
});
