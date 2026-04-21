import { describe, expect, it } from "vitest";

import {
  parseTwinEventsQuery,
  twinEventsTypePrismaFilter,
  TWIN_EVENTS_QUERY_MAX_WINDOW_DAYS,
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

  it("accepts optional since and until together (ISO-8601)", () => {
    const r = parseTwinEventsQuery(
      new URLSearchParams("since=2026-01-01T00:00:00.000Z&until=2026-01-02T00:00:00.000Z"),
    );
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.query.since).toBe("2026-01-01T00:00:00.000Z");
      expect(r.query.until).toBe("2026-01-02T00:00:00.000Z");
    }
  });

  it("rejects when only since is provided", () => {
    const r = parseTwinEventsQuery(new URLSearchParams("since=2026-01-01T00:00:00.000Z"));
    expect(r.ok).toBe(false);
  });

  it("rejects when only until is provided", () => {
    const r = parseTwinEventsQuery(new URLSearchParams("until=2026-01-02T00:00:00.000Z"));
    expect(r.ok).toBe(false);
  });

  it("rejects when since is after until", () => {
    const r = parseTwinEventsQuery(
      new URLSearchParams("since=2026-02-02T00:00:00.000Z&until=2026-01-01T00:00:00.000Z"),
    );
    expect(r.ok).toBe(false);
  });

  it("rejects when window exceeds max days", () => {
    const r = parseTwinEventsQuery(
      new URLSearchParams("since=2026-01-01T00:00:00.000Z&until=2026-02-02T00:00:00.000Z"),
    );
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).toMatch(new RegExp(String(TWIN_EVENTS_QUERY_MAX_WINDOW_DAYS)));
    }
  });

  it("accepts a window exactly at the max day span", () => {
    const r = parseTwinEventsQuery(
      new URLSearchParams("since=2026-01-01T00:00:00.000Z&until=2026-02-01T00:00:00.000Z"),
    );
    expect(r.ok).toBe(true);
  });

  it("defaults includePayload to true when omitted", () => {
    const r = parseTwinEventsQuery(new URLSearchParams("limit=10"));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.query.includePayload).toBe(true);
  });

  it("coerces includePayload from common string forms", () => {
    const rFalse = parseTwinEventsQuery(new URLSearchParams("includePayload=false"));
    expect(rFalse.ok).toBe(true);
    if (rFalse.ok) expect(rFalse.query.includePayload).toBe(false);
    const r0 = parseTwinEventsQuery(new URLSearchParams("includePayload=0"));
    expect(r0.ok).toBe(true);
    if (r0.ok) expect(r0.query.includePayload).toBe(false);
    const r1 = parseTwinEventsQuery(new URLSearchParams("includePayload=1"));
    expect(r1.ok).toBe(true);
    if (r1.ok) expect(r1.query.includePayload).toBe(true);
  });

  it("rejects invalid includePayload values", () => {
    expect(parseTwinEventsQuery(new URLSearchParams("includePayload=nope")).ok).toBe(false);
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
