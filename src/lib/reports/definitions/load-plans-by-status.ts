import { getControlTowerPortalContext, controlTowerShipmentAccessWhere } from "@/lib/control-tower/viewer";
import type { ReportDefinition } from "@/lib/reports/types";

export const loadPlansByStatusReport: ReportDefinition = {
  id: "load_plans_by_status",
  title: "Load plans by status",
  description: "Consolidation load plans grouped by workflow status.",
  category: "planning",
  requires: [{ resource: "org.orders", action: "view" }],
  run: async (ctx) => {
    const portalCtx = await getControlTowerPortalContext(ctx.actorUserId);
    const shipmentWhere = await controlTowerShipmentAccessWhere(ctx.tenantId, portalCtx, ctx.actorUserId);
    const grouped = await ctx.prisma.loadPlan.groupBy({
      by: ["status"],
      where: {
        tenantId: ctx.tenantId,
        assignments: { some: { shipment: shipmentWhere } },
      },
      _count: { _all: true },
    });

    const rows = grouped
      .map((g) => ({
        status: g.status,
        planCount: g._count._all,
      }))
      .sort((a, b) => a.status.localeCompare(b.status));

    return {
      title: "Load plans by status",
      description: loadPlansByStatusReport.description,
      columns: [
        { key: "status", label: "Load plan status" },
        { key: "planCount", label: "Plans", format: "number", align: "right" },
      ],
      rows,
    };
  },
};
