import { describe, expect, it } from "vitest";

import type { CtRunReportResult } from "./report-engine";
import { buildControlTowerReportCsv as buildCsvFromEngineResult } from "./report-engine";
import { buildControlTowerReportCsv } from "./report-csv";

/** `report-engine` re-exports CSV generation for run payloads; output must match `report-csv`. */
describe("buildControlTowerReportCsv (report-engine vs report-csv)", () => {
  it("produces identical CSV for the same row/totals inputs", () => {
    const rows = [{ label: "Mar", metrics: { shipments: 3, onTimePct: 88 } }];
    const csvInput = {
      rows,
      fullSeriesRows: [] as typeof rows,
      totals: { shipments: 3, onTimePct: 88 },
    };
    const fromCsv = buildControlTowerReportCsv(csvInput);

    const asRunResult = {
      config: {
        chartType: "bar",
        dimension: "month",
        measure: "shipments",
        compareMeasure: null,
        dateField: "shippedAt" as const,
        dateFrom: null,
        dateTo: null,
        topN: 12,
      },
      rows: rows.map((r) => ({ key: r.label, label: r.label, metrics: { ...zeroMetrics(), ...r.metrics } })),
      fullSeriesRows: [] as CtRunReportResult["fullSeriesRows"],
      coverage: {
        totalShipmentsQueried: 0,
        shipmentsAggregated: 0,
        excludedByDateOrMissingDateField: 0,
        dimensionGroupsTotal: 0,
        dimensionGroupsShown: 0,
      },
      totals: { ...zeroMetrics(), ...csvInput.totals },
      generatedAt: "2026-01-01T00:00:00.000Z",
    } satisfies CtRunReportResult;

    const fromEngine = buildCsvFromEngineResult(asRunResult);
    expect(fromEngine).toBe(fromCsv);
  });
});

function zeroMetrics() {
  return {
    shipments: 0,
    volumeCbm: 0,
    weightKg: 0,
    shippingSpend: 0,
    onTimePct: 0,
    avgDelayDays: 0,
    openExceptions: 0,
    openExceptionRatePct: 0,
  };
}
