import { describe, expect, it } from "vitest";

import {
  TARIFF_MAIN_LEG_RATE_TYPES,
  mainLegPolPodMatch,
  normalizeEquipmentType,
} from "@/lib/tariff/rating-engine";

describe("normalizeEquipmentType", () => {
  it("normalizes 40' HC variants", () => {
    expect(normalizeEquipmentType("40' HC")).toBe("40HC");
    expect(normalizeEquipmentType("40hc")).toBe("40HC");
  });

  it("normalizes 20' and 45' cube aliases", () => {
    expect(normalizeEquipmentType("20 GP")).toBe("20GP");
    expect(normalizeEquipmentType("20' standard")).toBe("20GP");
    expect(normalizeEquipmentType("20DC")).toBe("20GP");
    expect(normalizeEquipmentType("45 high cube")).toBe("45HC");
  });

  it("passes through unknown tokens uppercased", () => {
    expect(normalizeEquipmentType("45G1")).toBe("45G1");
  });

  it("normalizes spaced and quoted 40 high cube spellings", () => {
    expect(normalizeEquipmentType("40 HIGH CUBE")).toBe("40HC");
    expect(normalizeEquipmentType(`40' HIGH CUBE`)).toBe("40HC");
  });

  it("trims whitespace before normalization", () => {
    expect(normalizeEquipmentType("  40hc  ")).toBe("40HC");
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
    expect(mainLegPolPodMatch(null, null, "DEHAM", "USCHI")).toEqual({ ok: true, score: 40 });
    expect(mainLegPolPodMatch(undefined, undefined, "DEHAM", "USCHI")).toEqual({ ok: true, score: 40 });
  });

  it("rejects when POD missing from destination scope", () => {
    const origin = { members: [{ memberCode: "DEHAM" }] };
    const dest = { members: [{ memberCode: "USNYC" }] };
    expect(mainLegPolPodMatch(origin, dest, "DEHAM", "USCHI")).toEqual({ ok: false, score: 0 });
  });

  it("scores 70 when one scope is wildcard and the other matches", () => {
    const strict = { members: [{ memberCode: "DEHAM" }] };
    const wild = { members: [] as { memberCode: string }[] };
    expect(mainLegPolPodMatch(wild, strict, "deham", "DEHAM")).toEqual({ ok: true, score: 70 });
    expect(mainLegPolPodMatch(strict, wild, "deham", "USCHI")).toEqual({ ok: true, score: 70 });
  });

  it("matches UNLOC case-insensitively", () => {
    const origin = { members: [{ memberCode: "deham" }] };
    const dest = { members: [{ memberCode: "UsChi" }] };
    expect(mainLegPolPodMatch(origin, dest, "DEHAM", "uschi")).toEqual({ ok: true, score: 100 });
  });

  it("rejects when POL missing from origin scope (strict destination)", () => {
    const origin = { members: [{ memberCode: "USNYC" }] };
    const dest = { members: [{ memberCode: "USCHI" }] };
    expect(mainLegPolPodMatch(origin, dest, "DEHAM", "USCHI")).toEqual({ ok: false, score: 0 });
  });
});

describe("TARIFF_MAIN_LEG_RATE_TYPES", () => {
  it("includes BASE_RATE and ALL_IN for main-leg selection", () => {
    expect(TARIFF_MAIN_LEG_RATE_TYPES).toContain("BASE_RATE");
    expect(TARIFF_MAIN_LEG_RATE_TYPES).toContain("ALL_IN");
    expect(TARIFF_MAIN_LEG_RATE_TYPES).toHaveLength(2);
  });
});
