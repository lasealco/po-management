import type { CtRunReportResult } from "@/lib/control-tower/report-engine";
import {
  dimensionLabel,
  formatReportDateWindowLine,
  metricLabel,
} from "@/lib/control-tower/report-labels";

/** Safe subset of a report run for clients (PDF / email / insight UI labeling). */
export type ReportInsightRunSummary = {
  title: string | null;
  measure: string;
  measureLabel: string;
  dimension: string;
  dimensionLabel: string;
  dateWindowLine: string | null;
  compareMeasure: string | null;
  compareMeasureLabel: string | null;
  coverage: {
    shipmentsAggregated: number;
    totalShipmentsQueried: number;
    excludedByDateOrMissingDateField: number;
  };
};

export function buildReportInsightRunSummary(result: CtRunReportResult): ReportInsightRunSummary {
  const cm = result.config.compareMeasure;
  const title = result.config.title?.trim() || null;
  return {
    title,
    measure: result.config.measure,
    measureLabel: metricLabel(result.config.measure),
    dimension: result.config.dimension,
    dimensionLabel: dimensionLabel(result.config.dimension),
    dateWindowLine: formatReportDateWindowLine({
      dateField: result.config.dateField,
      dateFrom: result.config.dateFrom,
      dateTo: result.config.dateTo,
    }),
    compareMeasure: cm,
    compareMeasureLabel: cm ? metricLabel(cm) : null,
    coverage: {
      shipmentsAggregated: result.coverage.shipmentsAggregated,
      totalShipmentsQueried: result.coverage.totalShipmentsQueried,
      excludedByDateOrMissingDateField: result.coverage.excludedByDateOrMissingDateField,
    },
  };
}
