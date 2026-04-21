import { beforeEach, describe, expect, it, vi } from "vitest";

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    supplyChainTwinIngestEvent: { count: vi.fn(), findMany: vi.fn() },
    supplyChainTwinScenarioRevision: { count: vi.fn(), findMany: vi.fn() },
    supplyChainTwinScenarioDraft: { count: vi.fn(), findMany: vi.fn() },
  },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock,
}));

import { getTwinRetentionDryRunForTenant, resolveTwinRetentionPolicyFromEnv } from "@/lib/supply-chain-twin/retention-dry-run";

describe("resolveTwinRetentionPolicyFromEnv", () => {
  beforeEach(() => {
    delete process.env.SCTWIN_RETENTION_INGEST_EVENTS_DAYS;
    delete process.env.SCTWIN_RETENTION_SCENARIO_REVISIONS_DAYS;
    delete process.env.SCTWIN_RETENTION_ARCHIVED_SCENARIOS_DAYS;
  });

  it("falls back to defaults for invalid values", () => {
    process.env.SCTWIN_RETENTION_INGEST_EVENTS_DAYS = "0";
    process.env.SCTWIN_RETENTION_SCENARIO_REVISIONS_DAYS = "bad";
    process.env.SCTWIN_RETENTION_ARCHIVED_SCENARIOS_DAYS = "99999";

    expect(resolveTwinRetentionPolicyFromEnv()).toEqual({
      ingestEventsDays: 180,
      scenarioRevisionsDays: 365,
      archivedScenarioDraftsDays: 365,
    });
  });
});

describe("getTwinRetentionDryRunForTenant", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns eligible counts and sample ids for each bucket", async () => {
    prismaMock.supplyChainTwinIngestEvent.count.mockResolvedValue(2);
    prismaMock.supplyChainTwinIngestEvent.findMany.mockResolvedValue([{ id: "evt_1" }, { id: "evt_2" }]);
    prismaMock.supplyChainTwinScenarioRevision.count.mockResolvedValue(1);
    prismaMock.supplyChainTwinScenarioRevision.findMany.mockResolvedValue([{ id: "rev_1" }]);
    prismaMock.supplyChainTwinScenarioDraft.count.mockResolvedValue(3);
    prismaMock.supplyChainTwinScenarioDraft.findMany.mockResolvedValue([{ id: "draft_a" }, { id: "draft_b" }]);

    const out = await getTwinRetentionDryRunForTenant("tenant-1", {
      policy: {
        ingestEventsDays: 30,
        scenarioRevisionsDays: 60,
        archivedScenarioDraftsDays: 90,
      },
      sampleLimit: 2,
    });

    expect(out.tenantId).toBe("tenant-1");
    expect(out.dryRun).toBe(true);
    expect(out.candidates.ingestEvents.eligibleCount).toBe(2);
    expect(out.candidates.ingestEvents.sampleIds).toEqual(["evt_1", "evt_2"]);
    expect(out.candidates.scenarioRevisions.eligibleCount).toBe(1);
    expect(out.candidates.scenarioRevisions.sampleIds).toEqual(["rev_1"]);
    expect(out.candidates.archivedScenarioDrafts.eligibleCount).toBe(3);
    expect(out.candidates.archivedScenarioDrafts.sampleIds).toEqual(["draft_a", "draft_b"]);
    expect(out.deferred.length).toBeGreaterThan(0);
  });
});
