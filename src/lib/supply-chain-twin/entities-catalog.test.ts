import { describe, expect, it } from "vitest";

import {
  decodeTwinEntitiesCursor,
  encodeTwinEntitiesCursor,
  parseTwinEntitiesQuery,
} from "@/lib/supply-chain-twin/entities-catalog";

describe("twinEntitiesQuerySchema via parseTwinEntitiesQuery", () => {
  it("defaults limit to 100", () => {
    const r = parseTwinEntitiesQuery(new URLSearchParams(""));
    expect(r.ok && r.query.limit).toBe(100);
  });

  it("accepts limit at cap", () => {
    const r = parseTwinEntitiesQuery(new URLSearchParams("limit=100"));
    expect(r.ok && r.query.limit).toBe(100);
  });

  it("rejects limit above 100", () => {
    const r = parseTwinEntitiesQuery(new URLSearchParams("limit=101"));
    expect(r.ok).toBe(false);
  });

  it("round-trips cursor encode/decode", () => {
    const updatedAt = new Date("2026-01-02T03:04:05.000Z");
    const id = "clxyz123";
    const token = encodeTwinEntitiesCursor({ updatedAt, id });
    const decoded = decodeTwinEntitiesCursor(token);
    expect(decoded.ok).toBe(true);
    if (decoded.ok) {
      expect(decoded.id).toBe(id);
      expect(decoded.updatedAt.toISOString()).toBe(updatedAt.toISOString());
    }
  });
});
