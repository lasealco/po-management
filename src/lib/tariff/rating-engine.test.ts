import { describe, expect, it } from "vitest";

import { mainLegPolPodMatch, normalizeEquipmentType } from "@/lib/tariff/rating-engine";

describe("normalizeEquipmentType", () => {
  it("normalizes 40' HC variants", () => {
    expect(normalizeEquipmentType("40' HC")).toBe("40HC");
    expect(normalizeEquipmentType("40hc")).toBe("40HC");
  });

  it("passes through unknown tokens uppercased", () => {
    expect(normalizeEquipmentType("45G1")).toBe("45G1");
  });
});

describe("mainLegPolPodMatch", () => {
  it("scores strict match when both scopes list POL/POD", () => {
    const origin = { members: [{ memberCode: "DEHAM" }] };
    const dest = { members: [{ memberCode: "USCHI" }] };
    expect(mainLegPolPodMatch(origin, dest, "deham", "uschi")).toEqual({ ok: true, score: 100 });
  });

  it("allows double wildcard with lower score", () => {
    expect(mainLegPolPodMatch({ members: [] }, { members: [] }, "DEHAM", "USCHI")).toEqual({ ok: true, score: 40 });
  });

  it("rejects when POD missing from destination scope", () => {
    const origin = { members: [{ memberCode: "DEHAM" }] };
    const dest = { members: [{ memberCode: "USNYC" }] };
    expect(mainLegPolPodMatch(origin, dest, "DEHAM", "USCHI")).toEqual({ ok: false, score: 0 });
  });
});
