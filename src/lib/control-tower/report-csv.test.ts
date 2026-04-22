import { describe, expect, it } from "vitest";

import { REPORT_CSV_MEASURES, buildControlTowerReportCsv } from "./report-csv";

describe("buildControlTowerReportCsv", () => {
  it("prefers fullSeriesRows when non-empty", () => {
    const csv = buildControlTowerReportCsv({
      rows: [{ label: "skip", metrics: { shipments: 1 } }],
      fullSeriesRows: [{ label: "Jan", metrics: { shipments: 10 } }],
      totals: { shipments: 10 },
    });
    expect(csv).toContain("Jan");
    expect(csv).not.toContain("skip");
  });

  it("escapes labels with comma and quotes", () => {
    const csv = buildControlTowerReportCsv({
      rows: [{ label: `Line, with "quotes"`, metrics: { shipments: 1 } }],
      fullSeriesRows: [],
      totals: { shipments: 1 },
    });
    const lines = csv.split("\n");
    expect(lines[0]).toBe(`bucket,${REPORT_CSV_MEASURES.join(",")}`);
    expect(lines[1]).toMatch(/^"/);
    expect(lines[1]).toContain('""quotes""');
  });

  it("appends TOTAL row and defaults missing metrics to 0", () => {
    const csv = buildControlTowerReportCsv({
      rows: [{ label: "A", metrics: {} }],
      fullSeriesRows: [],
      totals: { shipments: 5, onTimePct: 90.5 },
    });
    const last = csv.split("\n").pop()!;
    expect(last.startsWith("TOTAL,")).toBe(true);
    expect(last).toContain("5");
    expect(last).toContain("90.5");
  });

  it("uses 0 for non-finite metric values in data rows", () => {
    const csv = buildControlTowerReportCsv({
      rows: [{ label: "X", metrics: { shipments: Number.NaN as unknown as number } }],
      fullSeriesRows: [],
      totals: {},
    });
    const dataLine = csv.split("\n")[1];
    expect(dataLine).toMatch(/^X,0,/);
  });
});
