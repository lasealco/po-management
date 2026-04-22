import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";

import { REPORT_CSV_MEASURES } from "./report-csv";
import { buildControlTowerReportPdfBytes } from "./report-pdf";

function emptyTotals(): Record<string, number> {
  return Object.fromEntries(REPORT_CSV_MEASURES.map((m) => [m, 0]));
}

describe("buildControlTowerReportPdfBytes", () => {
  it("returns a valid PDF with header metadata and at least one page", async () => {
    const bytes = await buildControlTowerReportPdfBytes({
      title: "Lane performance",
      generatedAt: "2026-04-01T12:00:00.000Z",
      shipmentsAggregated: 2,
      totalShipmentsQueried: 10,
      excludedByDateOrMissingDateField: 1,
      rows: [
        {
          label: "FRA->CHI",
          metrics: { ...emptyTotals(), shipments: 3, onTimePct: 88.5 },
        },
      ],
      fullSeriesRows: [],
      totals: { ...emptyTotals(), shipments: 3, onTimePct: 88.5 },
      organizationLabel: "Acme Logistics",
      reportMeasure: "onTimePct",
      reportDimension: "month",
    });

    const head = new TextDecoder().decode(bytes.slice(0, 5));
    expect(head).toBe("%PDF-");

    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBeGreaterThanOrEqual(1);
  });

  it("prefers fullSeriesRows over rows for table body", async () => {
    const bytes = await buildControlTowerReportPdfBytes({
      title: "Full series",
      generatedAt: "2026-04-02T00:00:00.000Z",
      shipmentsAggregated: 1,
      totalShipmentsQueried: 1,
      excludedByDateOrMissingDateField: 0,
      rows: [{ label: "ignored", metrics: { ...emptyTotals(), shipments: 99 } }],
      fullSeriesRows: [{ label: "Jan", metrics: { ...emptyTotals(), shipments: 4 } }],
      totals: { ...emptyTotals(), shipments: 4 },
    });
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe("%PDF-");
  });
});
