import { describe, expect, it } from "vitest";

import {
  defaultTrailerChecklistPayload,
  parseTrailerChecklistJson,
  trailerChecklistAllowsDepart,
  trailerChecklistFromDb,
} from "./dock-trailer-checklist";

describe("parseTrailerChecklistJson", () => {
  it("accepts valid checklist", () => {
    const r = parseTrailerChecklistJson({
      items: [{ id: "a", label: "One", required: true, done: false }],
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect((r.value as { items: unknown[] }).items).toHaveLength(1);
  });

  it("rejects non-object", () => {
    const r = parseTrailerChecklistJson([]);
    expect(r.ok).toBe(false);
  });

  it("rejects missing items array", () => {
    const r = parseTrailerChecklistJson({});
    expect(r.ok).toBe(false);
  });
});

describe("trailerChecklistAllowsDepart", () => {
  it("allows when no checklist", () => {
    expect(trailerChecklistAllowsDepart(null)).toBe(true);
    expect(trailerChecklistAllowsDepart(undefined)).toBe(true);
  });

  it("blocks when required item not done", () => {
    const p = defaultTrailerChecklistPayload();
    expect(trailerChecklistAllowsDepart(p)).toBe(false);
    const done = {
      items: p.items.map((it) => ({ ...it, done: true })),
    };
    expect(trailerChecklistAllowsDepart(done)).toBe(true);
  });
});

describe("trailerChecklistFromDb", () => {
  it("normalizes DB JSON", () => {
    const x = trailerChecklistFromDb({
      items: [{ id: "x", label: "L", required: true, done: true }],
    });
    expect(x?.items[0]?.done).toBe(true);
  });
});
