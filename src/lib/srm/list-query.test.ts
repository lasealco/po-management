import { describe, expect, it } from "vitest";

import { parseSrmListQuery } from "./list-query";

describe("parseSrmListQuery", () => {
  it("defaults to product and empty query", () => {
    expect(parseSrmListQuery({})).toEqual({
      kind: "product",
      q: "",
      onboardingMine: false,
    });
  });

  it("accepts logistics kind and trims q", () => {
    expect(parseSrmListQuery({ kind: "logistics", q: "  acme  " })).toEqual({
      kind: "logistics",
      q: "acme",
      onboardingMine: false,
    });
  });

  it("uses first value from arrays", () => {
    expect(parseSrmListQuery({ kind: ["product", "logistics"], q: ["x", "y"] })).toEqual({
      kind: "product",
      q: "x",
      onboardingMine: false,
    });
  });

  it("parses onboardingMine", () => {
    expect(parseSrmListQuery({ onboardingMine: "1" }).onboardingMine).toBe(true);
    expect(parseSrmListQuery({ onboardingMine: "true" }).onboardingMine).toBe(true);
    expect(parseSrmListQuery({ onboardingMine: "0" }).onboardingMine).toBe(false);
  });
});
