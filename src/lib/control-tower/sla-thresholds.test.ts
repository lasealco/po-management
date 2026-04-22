import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  ctSlaAgeHours,
  ctSlaBreached,
  ctSlaState,
  ctSlaThresholdHours,
} from "./sla-thresholds";

describe("ctSlaThresholdHours", () => {
  it("maps severities to hour windows", () => {
    expect(ctSlaThresholdHours("CRITICAL")).toBe(24);
    expect(ctSlaThresholdHours("WARN")).toBe(48);
    expect(ctSlaThresholdHours("INFO")).toBe(72);
  });
});

describe("ctSlaAgeHours and breach helpers", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-06-15T12:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("computes floored age in whole hours", () => {
    const created = new Date("2025-06-15T10:30:00.000Z");
    expect(ctSlaAgeHours(created)).toBe(1);
  });

  it("ctSlaBreached compares age to threshold", () => {
    const old = new Date("2025-06-10T12:00:00.000Z");
    expect(ctSlaBreached(old, "CRITICAL")).toBe(true);
    const recent = new Date("2025-06-15T11:00:00.000Z");
    expect(ctSlaBreached(recent, "CRITICAL")).toBe(false);
  });

  it("ctSlaState parses ISO strings and treats invalid dates as age 0", () => {
    const r = ctSlaState("2025-06-15T11:00:00.000Z", "CRITICAL");
    expect(r.ageHours).toBe(1);
    expect(r.threshold).toBe(24);
    expect(r.breached).toBe(false);
    const bad = ctSlaState("not-a-date", "WARN");
    expect(bad.ageHours).toBe(0);
    expect(bad.threshold).toBe(48);
    expect(bad.breached).toBe(false);
  });

  it("defaults unknown severity to WARN threshold in ctSlaState", () => {
    const r = ctSlaState(new Date("2025-06-15T11:00:00.000Z"), "");
    expect(r.threshold).toBe(48);
  });
});
