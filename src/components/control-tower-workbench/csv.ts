import { classifyShipmentHealth, healthLabel } from "@/components/control-tower-workbench/health";
import type { WorkbenchRow } from "@/components/control-tower-workbench/types";
import type { WorkbenchTogglableColumn } from "@/lib/control-tower/workbench-column-prefs";

type CsvOptions = {
  rows: WorkbenchRow[];
  colVis: Record<WorkbenchTogglableColumn, boolean>;
  restrictedView: boolean;
  listTruncated: boolean;
  listLimit: number | null;
  nowMs: number;
};

function csvEscape(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

export function buildWorkbenchCsv({
  rows,
  colVis,
  restrictedView,
  listTruncated,
  listLimit,
  nowMs,
}: CsvOptions): string {
  const colOn = (column: WorkbenchTogglableColumn): boolean => {
    if (column === "owner" && restrictedView) return false;
    return colVis[column] !== false;
  };

  const headers: string[] = ["shipmentId", "orderNumber", "shipmentNo"];
  if (colOn("status")) headers.push("status");
  if (colOn("mode")) headers.push("mode");
  if (colOn("health")) headers.push("health");
  if (colOn("customer")) headers.push("customer");
  if (colOn("lane")) headers.push("lane");
  if (colOn("eta")) headers.push("eta");
  if (colOn("ataDelay")) headers.push("ata", "etaVsAtaDays");
  if (colOn("qtyWt")) headers.push("quantityRef", "weightKgRef", "cbmRef");
  if (colOn("owner")) headers.push("owner", "openAlerts", "openExceptions");
  if (colOn("route")) headers.push("routeProgressPct");
  if (colOn("nextAction")) headers.push("nextAction");
  if (colOn("milestone")) headers.push("milestoneSummary");
  if (colOn("updated")) headers.push("updatedAt");

  const csvRows = rows.map((row) => {
    const cells: string[] = [csvEscape(row.id), csvEscape(row.orderNumber), csvEscape(row.shipmentNo || "")];
    if (colOn("status")) cells.push(csvEscape(row.status));
    if (colOn("mode")) cells.push(csvEscape(row.transportMode || ""));
    if (colOn("health")) {
      const health = classifyShipmentHealth(row, nowMs);
      cells.push(csvEscape(healthLabel(health)));
    }
    if (colOn("customer")) {
      cells.push(csvEscape(row.customerCrmAccountName || row.customerCrmAccountId || ""));
    }
    if (colOn("lane")) {
      cells.push(csvEscape(`${row.originCode || ""} → ${row.destinationCode || ""}`));
    }
    if (colOn("eta")) {
      cells.push(csvEscape(row.eta || row.latestEta || ""));
    }
    if (colOn("ataDelay")) {
      cells.push(csvEscape(row.receivedAt || ""));
      cells.push(
        csvEscape(
          (() => {
            const etaIso = row.latestEta || row.eta;
            if (!etaIso || !row.receivedAt) return "";
            const deltaMs = new Date(row.receivedAt).getTime() - new Date(etaIso).getTime();
            return (deltaMs / 86_400_000).toFixed(1);
          })(),
        ),
      );
    }
    if (colOn("qtyWt")) {
      cells.push(csvEscape(row.quantityRef || ""));
      cells.push(csvEscape(row.weightKgRef || ""));
      cells.push(csvEscape(row.cbmRef || ""));
    }
    if (colOn("owner")) {
      cells.push(csvEscape(row.dispatchOwner?.name || "Unassigned"));
      cells.push(csvEscape(String(row.openQueueCounts?.openAlerts ?? 0)));
      cells.push(csvEscape(String(row.openQueueCounts?.openExceptions ?? 0)));
    }
    if (colOn("route")) {
      cells.push(csvEscape(row.routeProgressPct == null ? "" : String(row.routeProgressPct)));
    }
    if (colOn("nextAction")) cells.push(csvEscape(row.nextAction || ""));
    if (colOn("milestone")) {
      const parts: string[] = [];
      if (row.latestMilestone) {
        parts.push(`${row.latestMilestone.code}${row.latestMilestone.hasActual ? " ✓" : ""}`);
      }
      if (row.trackingMilestoneSummary?.next?.code) {
        parts.push(`next:${row.trackingMilestoneSummary.next.code}`);
      }
      cells.push(csvEscape(parts.length > 0 ? parts.join("; ") : ""));
    }
    if (colOn("updated")) cells.push(csvEscape(row.updatedAt));
    return cells.join(",");
  });

  const metadata =
    listTruncated && listLimit != null
      ? [
          `# control-tower-workbench export: list truncated at ${listLimit} rows for current filters; more shipments may match — narrow filters and re-export.`,
        ]
      : [];
  return [...metadata, headers.join(","), ...csvRows].join("\n");
}
