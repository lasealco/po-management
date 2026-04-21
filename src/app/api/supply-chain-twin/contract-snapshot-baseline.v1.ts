export const twinApiContractSnapshotV1 = {
  version: "v1",
  endpoints: {
    readiness: {
      status: 200,
      body: {
        ok: true,
        reasons: [],
        healthIndex: {
          mode: "stub",
          score: 72,
          disclaimer: "non_production",
        },
        hasTwinData: true,
      },
    },
    entitiesSummary: {
      status: 200,
      body: {
        items: [
          {
            id: "snap_1",
            ref: {
              kind: "supplier",
              id: "SUP-001",
            },
          },
        ],
      },
    },
    scenariosList: {
      status: 200,
      body: {
        items: [
          {
            id: "scn_1",
            title: "Scenario A",
            status: "draft",
            updatedAt: "2026-01-01T00:00:00.000Z",
          },
        ],
      },
    },
    riskSignalsList: {
      status: 200,
      body: {
        items: [
          {
            id: "risk_1",
            code: "DELAY",
            severity: "HIGH",
            title: "Delay detected",
            detail: "Synthetic detail",
            createdAt: "2026-01-01T00:00:00.000Z",
            updatedAt: "2026-01-01T00:00:00.000Z",
          },
        ],
      },
    },
    eventsExportJson: {
      status: 200,
      body: {
        events: [
          {
            id: "evt_1",
            type: "entity_upsert",
            createdAt: "2026-01-01T00:00:00.000Z",
          },
        ],
      },
    },
  },
} as const;
