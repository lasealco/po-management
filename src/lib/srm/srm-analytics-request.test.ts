import { describe, expect, it } from "vitest";

import { parseSrmAnalyticsQuery } from "@/lib/srm/srm-analytics-request";

describe("parseSrmAnalyticsQuery", () => {
  it("rejects from after to", () => {
    const u = new URL("http://x/api?from=2026-02-10&to=2026-02-01");
    const r = parseSrmAnalyticsQuery(u);
    expect(r.ok).toBe(false);
  });

  it("defaults kind to product and parses range", () => {
    const u = new URL("http://x/api?from=2026-01-01&to=2026-01-31&kind=logistics");
    const r = parseSrmAnalyticsQuery(u, new Date("2026-04-15T12:00:00.000Z"));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.kind).toBe("logistics");
    expect(r.from.toISOString().slice(0, 10)).toBe("2026-01-01");
    expect(r.to.getUTCHours()).toBe(23);
  });
});
