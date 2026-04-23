import type { ScriEventGeography, TwinRiskSeverity } from "@prisma/client";

import { scriSeverityGte } from "@/lib/scri/scri-severity";
import type { WatchlistRuleDto } from "@/lib/scri/watchlist-repo";

export function eventMatchesWatchlistRule(
  event: {
    eventType: string;
    severity: TwinRiskSeverity;
    geographies: Pick<ScriEventGeography, "countryCode">[];
  },
  rule: WatchlistRuleDto,
): boolean {
  if (!rule.isActive) return false;
  if (rule.minSeverity != null && !scriSeverityGte(event.severity, rule.minSeverity)) {
    return false;
  }
  if (rule.eventTypes.length > 0 && !rule.eventTypes.includes(event.eventType)) {
    return false;
  }
  if (rule.countryCodes.length > 0) {
    const set = new Set(rule.countryCodes);
    const countries = event.geographies
      .map((g) => g.countryCode?.trim().toUpperCase() ?? "")
      .filter(Boolean);
    if (!countries.some((c) => set.has(c))) {
      return false;
    }
  }
  return true;
}

export function eventMatchesAnyActiveWatchlist(
  event: {
    eventType: string;
    severity: TwinRiskSeverity;
    geographies: Pick<ScriEventGeography, "countryCode">[];
  },
  rules: WatchlistRuleDto[],
): boolean {
  return rules.some((r) => r.isActive && eventMatchesWatchlistRule(event, r));
}
