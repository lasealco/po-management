/**
 * Client-safe CSV builder for Control Tower report runs (no Prisma / server deps).
 * Measure keys must stay aligned with `CT_REPORT_MEASURES` in `report-engine.ts`.
 */
export const REPORT_CSV_MEASURES = [
  "shipments",
  "volumeCbm",
  "weightKg",
  "shippingSpend",
  "onTimePct",
  "avgDelayDays",
] as const;

export type ReportCsvRow = { label: string; metrics: Record<string, number> };

export type ReportCsvBuildInput = {
  rows: ReportCsvRow[];
  fullSeriesRows: ReportCsvRow[];
  totals: Record<string, number>;
};

function escapeCsvField(value: string): string {
  if (/[",\n\r]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

/** UTF-8 CSV (bucket + all measures + TOTAL row). Prefers `fullSeriesRows` when non-empty. */
export function buildControlTowerReportCsv(input: ReportCsvBuildInput): string {
  const dataRows = input.fullSeriesRows.length > 0 ? input.fullSeriesRows : input.rows;
  const header = ["bucket", ...REPORT_CSV_MEASURES];
  const lines = [header.join(",")];
  for (const row of dataRows) {
    lines.push(
      [
        escapeCsvField(row.label),
        ...REPORT_CSV_MEASURES.map((m) => {
          const n = row.metrics[m] ?? 0;
          return Number.isFinite(n) ? String(n) : "0";
        }),
      ].join(","),
    );
  }
  lines.push(
    [
      escapeCsvField("TOTAL"),
      ...REPORT_CSV_MEASURES.map((m) => {
        const n = input.totals[m] ?? 0;
        return Number.isFinite(n) ? String(n) : "0";
      }),
    ].join(","),
  );
  return lines.join("\n");
}
