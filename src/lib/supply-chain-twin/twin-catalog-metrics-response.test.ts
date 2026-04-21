import { describe, expect, it } from "vitest";

import { parseTwinCatalogMetricsResponseJson } from "./twin-catalog-metrics-response";

describe("parseTwinCatalogMetricsResponseJson", () => {
  it("accepts a valid metrics payload", () => {
    const r = parseTwinCatalogMetricsResponseJson({
      entities: 1,
      edges: 0,
      events: 3,
      scenarioDrafts: 2,
      riskSignals: 0,
    });
    expect(r).toEqual({
      ok: true,
      data: { entities: 1, edges: 0, events: 3, scenarioDrafts: 2, riskSignals: 0 },
    });
  });

  it("rejects invalid shapes", () => {
    expect(parseTwinCatalogMetricsResponseJson({ entities: -1 })).toEqual({ ok: false });
    expect(parseTwinCatalogMetricsResponseJson(null)).toEqual({ ok: false });
  });
});
