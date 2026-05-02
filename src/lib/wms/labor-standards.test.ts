import { describe, expect, it } from "vitest";

import { buildLaborTimingSummary } from "./labor-standards";

function d(iso: string): Date {
  return new Date(iso);
}

describe("buildLaborTimingSummary", () => {
  it("returns nulls when no rows", () => {
    const s = buildLaborTimingSummary([]);
    expect(s.sampleCount).toBe(0);
    expect(s.avgActualMinutes).toBeNull();
    expect(s.efficiencyVsStandardPercent).toBeNull();
  });

  it("averages actual elapsed minutes", () => {
    const s = buildLaborTimingSummary([
      {
        startedAt: d("2026-01-01T12:00:00.000Z"),
        completedAt: d("2026-01-01T12:10:00.000Z"),
        standardMinutes: null,
      },
      {
        startedAt: d("2026-01-01T12:00:00.000Z"),
        completedAt: d("2026-01-01T12:20:00.000Z"),
        standardMinutes: null,
      },
    ]);
    expect(s.sampleCount).toBe(2);
    expect(s.avgActualMinutes).toBe(15);
    expect(s.avgStandardMinutes).toBeNull();
    expect(s.efficiencyVsStandardPercent).toBeNull();
  });

  it("computes efficiency when standards present", () => {
    const s = buildLaborTimingSummary([
      {
        startedAt: d("2026-01-01T12:00:00.000Z"),
        completedAt: d("2026-01-01T12:10:00.000Z"),
        standardMinutes: 10,
      },
    ]);
    expect(s.avgActualMinutes).toBe(10);
    expect(s.avgStandardMinutes).toBe(10);
    expect(s.efficiencyVsStandardPercent).toBe(100);
  });

  it("efficiency above 100 when faster than standard", () => {
    const s = buildLaborTimingSummary([
      {
        startedAt: d("2026-01-01T12:00:00.000Z"),
        completedAt: d("2026-01-01T12:05:00.000Z"),
        standardMinutes: 10,
      },
    ]);
    expect(s.avgActualMinutes).toBe(5);
    expect(s.avgStandardMinutes).toBe(10);
    expect(s.efficiencyVsStandardPercent).toBe(200);
  });
});
