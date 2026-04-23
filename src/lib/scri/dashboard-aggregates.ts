import type { TwinRiskSeverity } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { scriSeverityGte } from "@/lib/scri/scri-severity";
import type { ScriTuningDto } from "@/lib/scri/tuning-repo";
import { eventMatchesAnyActiveWatchlist } from "@/lib/scri/watchlist-match";
import type { WatchlistRuleDto } from "@/lib/scri/watchlist-repo";

const RECENT_DAYS = 30;

export type ScriDashboardStats = {
  totalEvents: number;
  bySeverity: Record<string, number>;
  criticalRecent: number;
  lowTrustCount: number;
  highlightSeverityCount: number;
  watchlistMatchRecentCount: number;
  impactedByType: Record<string, number>;
  recentSince: string;
};

export async function getScriDashboardStats(
  tenantId: string,
  tuning: ScriTuningDto,
  watchlistRules: WatchlistRuleDto[],
): Promise<ScriDashboardStats> {
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - RECENT_DAYS);

  const [totalEvents, bySev, criticalRecent, affectedGroups, recentEvents] = await Promise.all([
    prisma.scriExternalEvent.count({ where: { tenantId } }),
    prisma.scriExternalEvent.groupBy({
      by: ["severity"],
      where: { tenantId },
      _count: { _all: true },
    }),
    prisma.scriExternalEvent.count({
      where: {
        tenantId,
        severity: "CRITICAL",
        discoveredTime: { gte: since },
      },
    }),
    prisma.scriEventAffectedEntity.groupBy({
      by: ["objectType"],
      where: {
        tenantId,
        event: { discoveredTime: { gte: since } },
      },
      _count: { _all: true },
    }),
    prisma.scriExternalEvent.findMany({
      where: { tenantId, discoveredTime: { gte: since } },
      select: {
        eventType: true,
        severity: true,
        geographies: { select: { countryCode: true } },
        sourceTrustScore: true,
      },
      take: 200,
      orderBy: { discoveredTime: "desc" },
    }),
  ]);

  const bySeverity: Record<string, number> = {};
  for (const row of bySev) {
    bySeverity[row.severity] = row._count._all;
  }

  const trustMin = tuning.sourceTrustMin;
  const lowTrustCount =
    trustMin == null
      ? 0
      : recentEvents.filter(
          (e) => e.sourceTrustScore != null && e.sourceTrustScore < trustMin,
        ).length;

  const floor: TwinRiskSeverity | null = tuning.severityHighlightMin;
  const highlightSeverityCount =
    floor == null
      ? 0
      : recentEvents.filter((e) => scriSeverityGte(e.severity, floor)).length;

  const watchlistMatchRecentCount = recentEvents.filter((e) =>
    eventMatchesAnyActiveWatchlist(e, watchlistRules),
  ).length;

  const impactedByType: Record<string, number> = {};
  for (const g of affectedGroups) {
    impactedByType[g.objectType] = g._count._all;
  }

  return {
    totalEvents,
    bySeverity,
    criticalRecent,
    lowTrustCount,
    highlightSeverityCount,
    watchlistMatchRecentCount,
    impactedByType,
    recentSince: since.toISOString(),
  };
}
