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

  it("treats blank severity as omitted", () => {
    const r = parseTwinRiskSignalsListQuery(new URLSearchParams("severity=&limit=10"));
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.query.severity).toBeUndefined();
      expect(r.query.limit).toBe(10);
    }
  });

  it("composes severity with limit and cursor string", () => {
    const r = parseTwinRiskSignalsListQuery(
      new URLSearchParams("severity=HIGH&limit=25&cursor=opaque-token"),
    );
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.query.severity).toBe("HIGH");
      expect(r.query.limit).toBe(25);
      expect(r.query.cursor).toBe("opaque-token");
    }
  });

  it("accepts each TwinRiskSeverity enum value", () => {
    for (const sev of ["INFO", "LOW", "MEDIUM", "HIGH", "CRITICAL"] as const) {
      const r = parseTwinRiskSignalsListQuery(new URLSearchParams(`severity=${sev}`));
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.query.severity).toBe(sev);
    }
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
