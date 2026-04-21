import { prisma } from "@/lib/prisma";

export type TwinRetentionPolicy = {
  ingestEventsDays: number;
  scenarioRevisionsDays: number;
  archivedScenarioDraftsDays: number;
};

export type TwinRetentionDryRunBucket = {
  cutoffIso: string;
  eligibleCount: number;
  sampleIds: string[];
};

export type TwinRetentionDryRunSummary = {
  checkedAt: string;
  tenantId: string;
  dryRun: true;
  policy: TwinRetentionPolicy;
  candidates: {
    ingestEvents: TwinRetentionDryRunBucket;
    scenarioRevisions: TwinRetentionDryRunBucket;
    archivedScenarioDrafts: TwinRetentionDryRunBucket;
  };
  deferred: string[];
};

const DEFAULT_POLICY: TwinRetentionPolicy = {
  ingestEventsDays: 180,
  scenarioRevisionsDays: 365,
  archivedScenarioDraftsDays: 365,
};

function parseRetentionDays(raw: string | undefined, fallback: number): number {
  const parsed = Number.parseInt((raw ?? "").trim(), 10);
  if (!Number.isFinite(parsed) || parsed < 1 || parsed > 3650) {
    return fallback;
  }
  return parsed;
}

/**
 * Environment-driven policy scaffold for future retention automation.
 * Invalid values fall back to safe defaults.
 */
export function resolveTwinRetentionPolicyFromEnv(): TwinRetentionPolicy {
  return {
    ingestEventsDays: parseRetentionDays(process.env.SCTWIN_RETENTION_INGEST_EVENTS_DAYS, DEFAULT_POLICY.ingestEventsDays),
    scenarioRevisionsDays: parseRetentionDays(
      process.env.SCTWIN_RETENTION_SCENARIO_REVISIONS_DAYS,
      DEFAULT_POLICY.scenarioRevisionsDays,
    ),
    archivedScenarioDraftsDays: parseRetentionDays(
      process.env.SCTWIN_RETENTION_ARCHIVED_SCENARIOS_DAYS,
      DEFAULT_POLICY.archivedScenarioDraftsDays,
    ),
  };
}

function cutoffFromDays(days: number): Date {
  const now = Date.now();
  return new Date(now - days * 24 * 60 * 60 * 1000);
}

/**
 * Read-only retention report for one tenant.
 * This does not delete data; it only reports eligible rows and sample ids.
 */
export async function getTwinRetentionDryRunForTenant(
  tenantId: string,
  options: { policy?: TwinRetentionPolicy; sampleLimit?: number } = {},
): Promise<TwinRetentionDryRunSummary> {
  const policy = options.policy ?? resolveTwinRetentionPolicyFromEnv();
  const sampleLimit = Math.min(Math.max(options.sampleLimit ?? 20, 1), 100);

  const ingestCutoff = cutoffFromDays(policy.ingestEventsDays);
  const revisionsCutoff = cutoffFromDays(policy.scenarioRevisionsDays);
  const archivedCutoff = cutoffFromDays(policy.archivedScenarioDraftsDays);

  const [ingestCount, ingestSample, revisionsCount, revisionsSample, archivedCount, archivedSample] = await Promise.all([
    prisma.supplyChainTwinIngestEvent.count({
      where: { tenantId, createdAt: { lt: ingestCutoff } },
    }),
    prisma.supplyChainTwinIngestEvent.findMany({
      where: { tenantId, createdAt: { lt: ingestCutoff } },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      select: { id: true },
      take: sampleLimit,
    }),
    prisma.supplyChainTwinScenarioRevision.count({
      where: { tenantId, createdAt: { lt: revisionsCutoff } },
    }),
    prisma.supplyChainTwinScenarioRevision.findMany({
      where: { tenantId, createdAt: { lt: revisionsCutoff } },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      select: { id: true },
      take: sampleLimit,
    }),
    prisma.supplyChainTwinScenarioDraft.count({
      where: { tenantId, status: "archived", updatedAt: { lt: archivedCutoff } },
    }),
    prisma.supplyChainTwinScenarioDraft.findMany({
      where: { tenantId, status: "archived", updatedAt: { lt: archivedCutoff } },
      orderBy: [{ updatedAt: "asc" }, { id: "asc" }],
      select: { id: true },
      take: sampleLimit,
    }),
  ]);

  return {
    checkedAt: new Date().toISOString(),
    tenantId,
    dryRun: true,
    policy,
    candidates: {
      ingestEvents: {
        cutoffIso: ingestCutoff.toISOString(),
        eligibleCount: ingestCount,
        sampleIds: ingestSample.map((row) => row.id),
      },
      scenarioRevisions: {
        cutoffIso: revisionsCutoff.toISOString(),
        eligibleCount: revisionsCount,
        sampleIds: revisionsSample.map((row) => row.id),
      },
      archivedScenarioDrafts: {
        cutoffIso: archivedCutoff.toISOString(),
        eligibleCount: archivedCount,
        sampleIds: archivedSample.map((row) => row.id),
      },
    },
    deferred: [
      "No delete/apply path in this slice (dry-run only).",
      "No tenant policy UI/DB override yet; env-driven scaffold only.",
      "No cascading retention for related records beyond listed buckets.",
    ],
  };
}
