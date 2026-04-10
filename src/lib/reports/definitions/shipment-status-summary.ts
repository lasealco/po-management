import type { ReportDefinition } from "@/lib/reports/types";

export const shipmentStatusSummaryReport: ReportDefinition = {
  id: "shipment_status_summary",
  title: "ASN / shipment status summary",
  description: "Count of shipment rows by status for this tenant (via linked orders).",
  category: "logistics",
  requires: [{ resource: "org.orders", action: "view" }],
  run: async (ctx) => {
    const grouped = await ctx.prisma.shipment.groupBy({
      by: ["status"],
      where: { order: { tenantId: ctx.tenantId } },
      _count: { _all: true },
    });

    const rows = grouped
      .map((g) => ({
        status: g.status,
        shipmentCount: g._count._all,
      }))
      .sort((a, b) => a.status.localeCompare(b.status));

    return {
      title: "ASN / shipment status summary",
      description: shipmentStatusSummaryReport.description,
      columns: [
        { key: "status", label: "Shipment status" },
        { key: "shipmentCount", label: "Count", format: "number", align: "right" },
      ],
      rows,
    };
  },
};
