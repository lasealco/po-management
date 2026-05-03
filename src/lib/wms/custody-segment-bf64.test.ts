import { describe, expect, it } from "vitest";

import {
  custodySegmentIndicatesBreach,
  parseCustodySegmentJsonForPatch,
} from "./custody-segment-bf64";

describe("parseCustodySegmentJsonForPatch", () => {
  it("omits when undefined", () => {
    expect(parseCustodySegmentJsonForPatch(undefined)).toEqual({ ok: true, mode: "omit" });
  });

  it("clears when null", () => {
    expect(parseCustodySegmentJsonForPatch(null)).toEqual({ ok: true, mode: "clear" });
  });

  it("rejects arrays", () => {
    const r = parseCustodySegmentJsonForPatch([]);
    expect(r.ok).toBe(false);
  });

  it("accepts plain objects", () => {
    const r = parseCustodySegmentJsonForPatch({ minTempC: 2, maxTempC: 8 });
    expect(r.ok).toBe(true);
    if (r.ok && r.mode === "set") {
      expect(r.value).toEqual({ minTempC: 2, maxTempC: 8 });
    }
  });
});

describe("custodySegmentIndicatesBreach", () => {
  it("detects explicit breach flags", () => {
    expect(custodySegmentIndicatesBreach({ breached: true })).toBe(true);
    expect(custodySegmentIndicatesBreach({ breach: true })).toBe(true);
  });

  it("detects probe outside band", () => {
    expect(
      custodySegmentIndicatesBreach({ minTempC: 2, maxTempC: 8, probeTempC: 1.5 }),
    ).toBe(true);
    expect(
      custodySegmentIndicatesBreach({ minTempC: 2, maxTempC: 8, probeTempC: 9 }),
    ).toBe(true);
    expect(
      custodySegmentIndicatesBreach({ minTempC: 2, maxTempC: 8, probeTempC: 5 }),
    ).toBe(false);
  });
});
