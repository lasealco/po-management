import { describe, expect, it } from "vitest";

import {
  DOCK_TRANSPORT_LIMITS,
  normalizeDockCode,
  parseDockYardMilestone,
  rangesOverlap,
  truncateDockTransportField,
} from "./dock-appointment";

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

  it("truncates transport fields", () => {
    expect(truncateDockTransportField(undefined, DOCK_TRANSPORT_LIMITS.carrierName)).toBe(null);
    expect(truncateDockTransportField("  ", DOCK_TRANSPORT_LIMITS.carrierName)).toBe(null);
    expect(truncateDockTransportField("ACME", DOCK_TRANSPORT_LIMITS.carrierName)).toBe("ACME");
    const long = "x".repeat(DOCK_TRANSPORT_LIMITS.carrierReference + 5);
    expect(truncateDockTransportField(long, DOCK_TRANSPORT_LIMITS.carrierReference)?.length).toBe(
      DOCK_TRANSPORT_LIMITS.carrierReference,
    );
  });

  it("parses yard milestones", () => {
    expect(parseDockYardMilestone("GATE_IN")).toBe("GATE_IN");
    expect(parseDockYardMilestone("AT_DOCK")).toBe("AT_DOCK");
    expect(parseDockYardMilestone("DEPARTED")).toBe("DEPARTED");
    expect(parseDockYardMilestone("OTHER")).toBe(null);
  });
});
