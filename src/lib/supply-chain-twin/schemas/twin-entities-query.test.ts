import { describe, expect, it } from "vitest";

import { parseTwinEntitiesQuery } from "@/lib/supply-chain-twin/schemas/twin-entities-query";

describe("parseTwinEntitiesQuery", () => {
  it("accepts optional entityKind from allowlist", () => {
    const r = parseTwinEntitiesQuery(new URLSearchParams("entityKind=supplier"));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.query.entityKind).toBe("supplier");
  });

  it("treats blank entityKind as omitted", () => {
    const r = parseTwinEntitiesQuery(new URLSearchParams("entityKind=&q=hi"));
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.query.entityKind).toBeUndefined();
      expect(r.query.q).toBe("hi");
    }
  });

  it("rejects unknown entityKind", () => {
    const r = parseTwinEntitiesQuery(new URLSearchParams("entityKind=not_a_kind"));
    expect(r.ok).toBe(false);
  });

  it("composes entityKind with q and limit", () => {
    const r = parseTwinEntitiesQuery(
      new URLSearchParams("entityKind=site&q=dc&limit=25&cursor=abc"),
    );
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.query.entityKind).toBe("site");
      expect(r.query.q).toBe("dc");
      expect(r.query.limit).toBe(25);
      expect(r.query.cursor).toBe("abc");
    }
  });

  it("defaults fields to summary when omitted", () => {
    const r = parseTwinEntitiesQuery(new URLSearchParams("q=hi"));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.query.fields).toBe("summary");
  });

  it("accepts fields=full case-insensitively", () => {
    const r = parseTwinEntitiesQuery(new URLSearchParams("fields=FuLl"));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.query.fields).toBe("full");
  });

  it("rejects unknown fields", () => {
    const r = parseTwinEntitiesQuery(new URLSearchParams("fields=nope"));
    expect(r.ok).toBe(false);
  });
});
