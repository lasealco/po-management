import { describe, expect, it } from "vitest";

import {
  buildOpportunitiesListSearch,
  parseOpportunitiesListQuery,
} from "./opportunities-list-query";

describe("parseOpportunitiesListQuery", () => {
  it("reads stage, owner, q and stale", () => {
    const sp = new URLSearchParams("stage=QUALIFIED&owner=u1&q=acme&stale=1");
    expect(parseOpportunitiesListQuery(sp)).toEqual({
      stage: "QUALIFIED",
      owner: "u1",
      q: "acme",
      stale: true,
    });
  });

  it("trims values and defaults stale", () => {
    const sp = new URLSearchParams("stage=%20DISCOVERY%20&owner=&q=%20");
    expect(parseOpportunitiesListQuery(sp)).toEqual({
      stage: "DISCOVERY",
      owner: "",
      q: "",
      stale: false,
    });
  });
});

describe("buildOpportunitiesListSearch", () => {
  it("sets non-empty keys and removes empty ones", () => {
    const base = new URLSearchParams("stale=1&foo=bar");
    const out = buildOpportunitiesListSearch(base, { stage: "LOST", owner: "", q: "x" });
    const next = new URLSearchParams(out);
    expect(next.get("stale")).toBe("1");
    expect(next.get("foo")).toBe("bar");
    expect(next.get("stage")).toBe("LOST");
    expect(next.has("owner")).toBe(false);
    expect(next.get("q")).toBe("x");
  });

  it("clears q when patched to whitespace", () => {
    const base = new URLSearchParams("q=old");
    const out = buildOpportunitiesListSearch(base, { q: "   " });
    expect(new URLSearchParams(out).has("q")).toBe(false);
  });
});
