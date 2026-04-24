import { loadPlansByStatusReport } from "@/lib/reports/definitions/load-plans-by-status";
import { ordersByServedOrgReport } from "@/lib/reports/definitions/orders-by-served-org";
import { ordersByStatusReport } from "@/lib/reports/definitions/orders-by-status";
import { ordersBySupplierReport } from "@/lib/reports/definitions/orders-by-supplier";
import { overdueOrdersReport } from "@/lib/reports/definitions/overdue-orders";
import { shipmentStatusSummaryReport } from "@/lib/reports/definitions/shipment-status-summary";
import { supplierPerformanceReport } from "@/lib/reports/definitions/supplier-performance";
import type { ReportDefinition, ReportListItem } from "@/lib/reports/types";

const REPORTS: ReportDefinition[] = [
  ordersByStatusReport,
  ordersBySupplierReport,
  ordersByServedOrgReport,
  supplierPerformanceReport,
  overdueOrdersReport,
  shipmentStatusSummaryReport,
  loadPlansByStatusReport,
];

const byId = new Map(REPORTS.map((r) => [r.id, r]));

export function listReportDefinitions(): ReportDefinition[] {
  return [...REPORTS];
}

export function getReportDefinition(id: string): ReportDefinition | null {
  return byId.get(id) ?? null;
}

export function toReportListItem(def: ReportDefinition): ReportListItem {
  return {
    id: def.id,
    title: def.title,
    description: def.description,
    category: def.category,
    params: def.params,
  };
}
