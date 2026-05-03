import { describe, expect, it } from "vitest";

import {
  parseCo2eEstimateGramsForPatch,
  parseCo2eStubJsonForPatch,
  parseProductWmsCo2eFactorGramsPerKgKmForPatch,
} from "./carbon-intensity-bf69";

describe("parseCo2eEstimateGramsForPatch", () => {
  it("omits and clears", () => {
    expect(parseCo2eEstimateGramsForPatch(undefined)).toEqual({ ok: true, mode: "omit" });
    expect(parseCo2eEstimateGramsForPatch(null)).toEqual({ ok: true, mode: "clear" });
  });

  it("accepts non-negative decimals", () => {
    const r = parseCo2eEstimateGramsForPatch("1250.5");
    expect(r.ok).toBe(true);
    if (r.ok && r.mode === "set") expect(r.value.toString()).toBe("1250.5");
  });

  it("rejects negative", () => {
    const r = parseCo2eEstimateGramsForPatch(-1);
    expect(r.ok).toBe(false);
  });
});

describe("parseCo2eStubJsonForPatch", () => {
  it("builds trimmed stub", () => {
    const r = parseCo2eStubJsonForPatch({
      transportModeStub: " ROAD ",
      distanceKm: 120,
      note: " demo ",
    });
    expect(r.ok).toBe(true);
    if (r.ok && r.mode === "set") {
      expect(r.value).toEqual({
        transportModeStub: "ROAD",
        distanceKm: 120,
        note: "demo",
      });
    }
  });

  it("rejects unknown keys", () => {
    const r = parseCo2eStubJsonForPatch({ mode: "X" });
    expect(r.ok).toBe(false);
  });

  it("rejects empty object", () => {
    const r = parseCo2eStubJsonForPatch({});
    expect(r.ok).toBe(false);
  });
});

describe("parseProductWmsCo2eFactorGramsPerKgKmForPatch", () => {
  it("accepts small factors", () => {
    const r = parseProductWmsCo2eFactorGramsPerKgKmForPatch(12.5);
    expect(r.ok).toBe(true);
  });
});
