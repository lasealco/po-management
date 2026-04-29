import { describe, expect, it } from "vitest";

import { normalizeDockCode, rangesOverlap } from "./dock-appointment";

describe("dock-appointment helpers", () => {
  it("normalizes dock code", () => {
    expect(normalizeDockCode("  dock-a  ")).toBe("DOCK-A");
    expect(normalizeDockCode("")).toBe("");
  });

  it("detects interval overlap", () => {
    const a = new Date("2026-05-01T10:00:00Z");
    const b = new Date("2026-05-01T11:00:00Z");
    const c = new Date("2026-05-01T10:30:00Z");
    const d = new Date("2026-05-01T12:00:00Z");
    expect(rangesOverlap(a, b, c, d)).toBe(true);
    const laterStart = new Date("2026-05-01T12:00:00Z");
    const laterEnd = new Date("2026-05-01T13:00:00Z");
    expect(rangesOverlap(a, b, laterStart, laterEnd)).toBe(false);
  });
});
