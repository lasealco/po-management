import { describe, expect, it } from "vitest";

import {
  decodeTwinRiskSignalsListCursor,
  encodeTwinRiskSignalsListCursor,
  parseTwinRiskSignalsListQuery,
} from "@/lib/supply-chain-twin/schemas/twin-risk-signals-list-query";

describe("parseTwinRiskSignalsListQuery", () => {
  it("defaults limit to 50", () => {
    const r = parseTwinRiskSignalsListQuery(new URLSearchParams());
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.query.limit).toBe(50);
  });

  it("accepts valid severity", () => {
    const r = parseTwinRiskSignalsListQuery(new URLSearchParams("severity=MEDIUM"));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.query.severity).toBe("MEDIUM");
  });

  it("rejects invalid severity", () => {
    const r = parseTwinRiskSignalsListQuery(new URLSearchParams("severity=NOPE"));
    expect(r.ok).toBe(false);
  });

  it("rejects limit over 100", () => {
    const r = parseTwinRiskSignalsListQuery(new URLSearchParams("limit=101"));
    expect(r.ok).toBe(false);
  });
});

describe("twin risk signals list cursor", () => {
  it("roundtrips encode/decode", () => {
    const createdAt = new Date("2026-04-01T12:00:00.000Z");
    const id = "risk-1";
    const cursor = encodeTwinRiskSignalsListCursor({ createdAt, id });
    expect(decodeTwinRiskSignalsListCursor(cursor)).toEqual({ ok: true, createdAt, id });
  });
});
