import { describe, expect, it } from "vitest";

import type { CtRunReportResult } from "./report-engine";
import { buildReportInsightContext } from "./report-insight-llm";

function baseResult(overrides: Partial<CtRunReportResult> = {}): CtRunReportResult {
  return {
    config: {
      chartType: "bar",
      dimension: "month",
      measure: "shipments",
      compareMeasure: "onTimePct",
      dateField: "shippedAt",
      dateFrom: null,
      dateTo: null,
      topN: 10,
      title: "Q1",
    },
    rows: [{ key: "k1", label: "Jan", metrics: baseMetrics({ shipments: 5 }) }],
    fullSeriesRows: [],
    coverage: {
      totalShipmentsQueried: 50,
      shipmentsAggregated: 40,
      excludedByDateOrMissingDateField: 0,
      dimensionGroupsTotal: 12,
      dimensionGroupsShown: 10,
    },
    totals: baseMetrics({ shipments: 40, onTimePct: 91.2 }),
    generatedAt: "2026-04-01T00:00:00.000Z",
    ...overrides,
  };
}

function baseMetrics(p: Partial<Record<string, number>>) {
  return {
    shipments: 0,
    volumeCbm: 0,
    weightKg: 0,
    shippingSpend: 0,
    onTimePct: 0,
    avgDelayDays: 0,
    openExceptions: 0,
    openExceptionRatePct: 0,
    ...p,
  };
}

describe("buildReportInsightContext", () => {
  it("prefers fullSeriesRows, maps measure labels, and trims user question", () => {
    const ctx = buildReportInsightContext(
      baseResult({
        fullSeriesRows: [
          { key: "a", label: "  Bucket A  ", metrics: baseMetrics({ volumeCbm: 3 }) },
          { key: "b", label: "Bucket B", metrics: baseMetrics({ volumeCbm: 7 }) },
        ],
        config: { ...baseResult().config, measure: "volumeCbm" },
      }),
      "  what changed?  ",
    );
    expect(ctx.topRows).toEqual([
      { label: "Bucket A", value: 3 },
      { label: "Bucket B", value: 7 },
    ]);
    expect(ctx.measureLabel).toBe("Volume (cbm)");
    expect(ctx.compareMeasureLabel).toBe("On-time %");
    expect(ctx.userQuestion).toBe("what changed?");
    expect(ctx.fullSeriesRowCount).toBe(2);
  });

  it("uses unknown measure key as label when not in map", () => {
    const r = baseResult({
      config: { ...baseResult().config, measure: "shipments" },
    });
    const ctx = buildReportInsightContext(
      {
        ...r,
        config: { ...r.config, measure: "customMetric" as typeof r.config.measure },
      },
      null,
    );
    expect(ctx.measure).toBe("customMetric");
    expect(ctx.measureLabel).toBe("customMetric");
    expect(ctx.userQuestion).toBeNull();
  });
});
