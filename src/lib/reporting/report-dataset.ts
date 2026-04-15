import type { ReportDataset } from "@prisma/client";

const ALLOWED = new Set<string>(["CONTROL_TOWER", "PO", "CRM", "WMS"]);

export function parseReportDatasetQuery(raw: string | null): ReportDataset | null {
  if (!raw || !ALLOWED.has(raw)) return null;
  return raw as ReportDataset;
}

/** Saved reports that use the Control Tower shipment report engine and can pin to CT dashboards. */
export const DASHBOARD_PIN_DATASET: ReportDataset = "CONTROL_TOWER";
