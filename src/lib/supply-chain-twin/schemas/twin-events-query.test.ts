import { describe, expect, it } from "vitest";

import {
  parseTwinEventsQuery,
  twinEventsTypePrismaFilter,
} from "@/lib/supply-chain-twin/schemas/twin-events-query";

describe("parseTwinEventsQuery", () => {
  it("parses type as exact filter token", () => {
    const r = parseTwinEventsQuery(new URLSearchParams("type=entity_upsert&limit=10"));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.query.type).toBe("entity_upsert");
  });

  it("accepts trailing * for prefix mode", () => {
    const r = parseTwinEventsQuery(new URLSearchParams("type=entity_*"));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.query.type).toBe("entity_*");
  });

  it("rejects type that is only *", () => {
    const r = parseTwinEventsQuery(new URLSearchParams("type=*"));
    expect(r.ok).toBe(false);
  });

  it("rejects empty prefix before *", () => {
    expect(parseTwinEventsQuery(new URLSearchParams("type=**")).ok).toBe(false);
  });

  it("falls back to legacy eventType when type is absent", () => {
    const r = parseTwinEventsQuery(new URLSearchParams("eventType=signal"));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.query.type).toBe("signal");
  });

  it("prefers type over eventType when both are set", () => {
    const r = parseTwinEventsQuery(new URLSearchParams("type=a&eventType=b"));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.query.type).toBe("a");
  });
});

describe("twinEventsTypePrismaFilter", () => {
  it("uses equals when no trailing wildcard", () => {
    expect(twinEventsTypePrismaFilter("edge_upsert")).toEqual({ equals: "edge_upsert" });
  });

  it("uses startsWith when value ends with *", () => {
    expect(twinEventsTypePrismaFilter("entity_*")).toEqual({ startsWith: "entity_" });
  });
});
