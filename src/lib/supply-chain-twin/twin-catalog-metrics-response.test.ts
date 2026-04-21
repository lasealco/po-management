import { describe, expect, it } from "vitest";

import { TWIN_ENTITY_KINDS } from "@/lib/supply-chain-twin/types";

import { parseTwinCatalogMetricsResponseJson } from "./twin-catalog-metrics-response";

function zeroEntityCountsByKind(): Record<string, number> {
  return Object.fromEntries([...TWIN_ENTITY_KINDS, "other"].map((k) => [k, 0]));
}

describe("parseTwinCatalogMetricsResponseJson", () => {
  it("accepts a valid metrics payload", () => {
    const generatedAt = "2026-04-21T12:00:00.000Z";
    const entityCountsByKind = { ...zeroEntityCountsByKind(), supplier: 1 };
    const r = parseTwinCatalogMetricsResponseJson({
      entities: 1,
      edges: 0,
      events: 3,
      scenarioDrafts: 2,
      riskSignals: 0,
      entityCountsByKind,
      generatedAt,
    });
    expect(r).toEqual({
      ok: true,
      data: {
        entities: 1,
        edges: 0,
        events: 3,
        scenarioDrafts: 2,
        riskSignals: 0,
        entityCountsByKind,
        generatedAt,
      },
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
        entityCountsByKind: zeroEntityCountsByKind(),
      }),
    ).toEqual({ ok: false });
  });

  it("rejects payloads without entityCountsByKind", () => {
    expect(
      parseTwinCatalogMetricsResponseJson({
        entities: 1,
        edges: 0,
        events: 3,
        scenarioDrafts: 2,
        riskSignals: 0,
        generatedAt: "2026-04-21T12:00:00.000Z",
      }),
    ).toEqual({ ok: false });
  });

  it("rejects invalid shapes", () => {
    expect(parseTwinCatalogMetricsResponseJson({ entities: -1 })).toEqual({ ok: false });
    expect(parseTwinCatalogMetricsResponseJson(null)).toEqual({ ok: false });
  });
});
