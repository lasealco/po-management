import { describe, expect, it } from "vitest";

import {
  decodeTwinScenariosListCursor,
  encodeTwinScenariosListCursor,
  parseTwinScenariosListQuery,
} from "@/lib/supply-chain-twin/schemas/twin-scenarios-list-query";

describe("parseTwinScenariosListQuery", () => {
  it("defaults limit to 50", () => {
    const r = parseTwinScenariosListQuery(new URLSearchParams());
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.query.limit).toBe(50);
  });

  it("rejects limit over 100", () => {
    const r = parseTwinScenariosListQuery(new URLSearchParams("limit=101"));
    expect(r.ok).toBe(false);
  });

  it("trims empty cursor to undefined", () => {
    const r = parseTwinScenariosListQuery(new URLSearchParams("cursor=   "));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.query.cursor).toBeUndefined();
  });
});

describe("twin scenarios list cursor", () => {
  it("roundtrips encode/decode", () => {
    const updatedAt = new Date("2026-03-01T08:00:00.000Z");
    const id = "sc-1";
    const cursor = encodeTwinScenariosListCursor({ updatedAt, id });
    const decoded = decodeTwinScenariosListCursor(cursor);
    expect(decoded).toEqual({ ok: true, updatedAt, id });
  });

  it("rejects invalid cursor", () => {
    expect(decodeTwinScenariosListCursor("not-base64!!!")).toEqual({ ok: false });
  });
});
