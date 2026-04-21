import { describe, expect, it } from "vitest";

import { parseTwinCatalogMetricsResponseJson } from "./twin-catalog-metrics-response";

describe("parseTwinCatalogMetricsResponseJson", () => {
  it("accepts a valid metrics payload", () => {
    const generatedAt = "2026-04-21T12:00:00.000Z";
    const r = parseTwinCatalogMetricsResponseJson({
      entities: 1,
      edges: 0,
      events: 3,
      scenarioDrafts: 2,
      riskSignals: 0,
      generatedAt,
    });
    expect(r).toEqual({
      ok: true,
      data: { entities: 1, edges: 0, events: 3, scenarioDrafts: 2, riskSignals: 0, generatedAt },
    });
  });

  it("rejects payloads without generatedAt", () => {
    expect(
      parseTwinCatalogMetricsResponseJson({
        entities: 1,
        edges: 0,
        events: 3,
        scenarioDrafts: 2,
        riskSignals: 0,
      }),
    ).toEqual({ ok: false });
  });

  it("rejects invalid shapes", () => {
    expect(parseTwinCatalogMetricsResponseJson({ entities: -1 })).toEqual({ ok: false });
    expect(parseTwinCatalogMetricsResponseJson(null)).toEqual({ ok: false });
  });
});
