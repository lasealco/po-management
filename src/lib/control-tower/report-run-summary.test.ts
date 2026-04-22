import { describe, expect, it } from "vitest";

import type { CtRunReportResult } from "./report-engine";
import { buildReportInsightRunSummary } from "./report-run-summary";

function baseResult(
  overrides: Partial<CtRunReportResult> & Pick<CtRunReportResult, "config" | "coverage">,
): CtRunReportResult {
  return {
    rows: [],
    fullSeriesRows: [],
    totals: {} as CtRunReportResult["totals"],
    generatedAt: "2026-04-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("buildReportInsightRunSummary", () => {
  it("maps config and coverage for insight / PDF labeling", () => {
    const summary = buildReportInsightRunSummary(
      baseResult({
        config: {
          chartType: "bar",
          dimension: "status",
          measure: "onTimePct",
          compareMeasure: "volumeCbm",
          dateField: "bookingEta",
          dateFrom: "2026-01-10",
          dateTo: "2026-01-20",
          topN: 12,
          title: "  Ops snapshot  ",
        },
        coverage: {
          shipmentsAggregated: 3,
          totalShipmentsQueried: 100,
          excludedByDateOrMissingDateField: 5,
          dimensionGroupsTotal: 20,
          dimensionGroupsShown: 10,
        },
      }),
    );
    expect(summary.title).toBe("Ops snapshot");
    expect(summary.measure).toBe("onTimePct");
    expect(summary.measureLabel).toBe("On-time %");
    expect(summary.dimension).toBe("status");
    expect(summary.dimensionLabel).toBe("Status");
    expect(summary.compareMeasure).toBe("volumeCbm");
    expect(summary.compareMeasureLabel).toBe("Volume (CBM)");
    expect(summary.dateWindowLine).toBe(
      "Date window (Booking ETA, UTC): 2026-01-10 … 2026-01-20",
    );
    expect(summary.coverage).toEqual({
      shipmentsAggregated: 3,
      totalShipmentsQueried: 100,
      excludedByDateOrMissingDateField: 5,
    });
  });

  it("uses null title when config title is blank", () => {
    const summary = buildReportInsightRunSummary(
      baseResult({
        config: {
          chartType: "line",
          dimension: "none",
          measure: "shipments",
          compareMeasure: null,
          dateField: "shippedAt",
          dateFrom: null,
          dateTo: null,
          topN: 10,
          title: "   ",
        },
        coverage: {
          shipmentsAggregated: 0,
          totalShipmentsQueried: 0,
          excludedByDateOrMissingDateField: 0,
          dimensionGroupsTotal: 0,
          dimensionGroupsShown: 0,
        },
      }),
    );
    expect(summary.title).toBeNull();
    expect(summary.compareMeasureLabel).toBeNull();
    expect(summary.dateWindowLine).toBeNull();
  });
});
