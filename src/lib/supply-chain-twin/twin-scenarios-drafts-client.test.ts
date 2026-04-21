import { describe, expect, it } from "vitest";

import {
  parseTwinScenarioDraftsListPayload,
  type TwinScenarioDraftListRow,
} from "@/lib/supply-chain-twin/twin-scenarios-drafts-client";

describe("parseTwinScenarioDraftsListPayload", () => {
  it("parses empty list", () => {
    const r = parseTwinScenarioDraftsListPayload({ items: [] });
    expect(r).toEqual({ ok: true, items: [], nextCursor: null });
  });

  it("parses items and nextCursor", () => {
    const items: TwinScenarioDraftListRow[] = [
      { id: "a", title: "One", status: "draft", updatedAt: "2026-01-01T00:00:00.000Z" },
    ];
    const r = parseTwinScenarioDraftsListPayload({ items, nextCursor: "cursor-token" });
    expect(r).toEqual({ ok: true, items, nextCursor: "cursor-token" });
  });

  it("allows omitting nextCursor", () => {
    const r = parseTwinScenarioDraftsListPayload({
      items: [{ id: "b", title: null, status: "draft", updatedAt: "2026-01-02T00:00:00.000Z" }],
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.nextCursor).toBeNull();
  });

  it("rejects invalid row shape", () => {
    const r = parseTwinScenarioDraftsListPayload({
      items: [{ id: "x", title: null, status: "draft" }],
    });
    expect(r.ok).toBe(false);
  });

  it("rejects empty nextCursor string", () => {
    const r = parseTwinScenarioDraftsListPayload({
      items: [{ id: "a", title: null, status: "draft", updatedAt: "2026-01-01T00:00:00.000Z" }],
      nextCursor: "",
    });
    expect(r.ok).toBe(false);
  });
});
