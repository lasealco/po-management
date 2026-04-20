import { describe, expect, it } from "vitest";

import { parseSrmListQuery } from "./list-query";

describe("parseSrmListQuery", () => {
  it("defaults to product and empty query", () => {
    expect(parseSrmListQuery({})).toEqual({
      kind: "product",
      q: "",
    });
  });

  it("accepts logistics kind and trims q", () => {
    expect(parseSrmListQuery({ kind: "logistics", q: "  acme  " })).toEqual({
      kind: "logistics",
      q: "acme",
    });
  });

  it("uses first value from arrays", () => {
    expect(parseSrmListQuery({ kind: ["product", "logistics"], q: ["x", "y"] })).toEqual({
      kind: "product",
      q: "x",
    });
  });
});
