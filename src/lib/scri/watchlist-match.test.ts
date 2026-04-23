import { describe, expect, it } from "vitest";

import { eventMatchesWatchlistRule } from "@/lib/scri/watchlist-match";
import type { WatchlistRuleDto } from "@/lib/scri/watchlist-repo";

const baseRule = (over: Partial<WatchlistRuleDto>): WatchlistRuleDto => ({
  id: "r1",
  name: "Test",
  isActive: true,
  minSeverity: null,
  eventTypes: [],
  countryCodes: [],
  sortOrder: 0,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  ...over,
});

describe("eventMatchesWatchlistRule", () => {
  it("matches when filters are empty (active)", () => {
    const hit = eventMatchesWatchlistRule(
      {
        eventType: "PORT_CONGESTION",
        severity: "MEDIUM",
        geographies: [{ countryCode: "US" }],
      },
      baseRule({}),
    );
    expect(hit).toBe(true);
  });

  it("respects event type filter", () => {
    const miss = eventMatchesWatchlistRule(
      { eventType: "FLOOD", severity: "HIGH", geographies: [] },
      baseRule({ eventTypes: ["PORT_CONGESTION"] }),
    );
    expect(miss).toBe(false);
  });

  it("respects country filter", () => {
    const hit = eventMatchesWatchlistRule(
      { eventType: "STRIKE", severity: "LOW", geographies: [{ countryCode: "cn" }] },
      baseRule({ countryCodes: ["CN"] }),
    );
    expect(hit).toBe(true);
  });
});
