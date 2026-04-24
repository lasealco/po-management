import { actorIsSupplierPortalRestricted } from "@/lib/authz";
import { purchaseOrderWhereWithViewerScope } from "@/lib/org-scope";
import type { ReportDefinition } from "@/lib/reports/types";

export const ordersByStatusReport: ReportDefinition = {
  id: "orders_by_status",
  title: "Orders by status",
  description:
    "Parent purchase orders only (excludes split children), grouped by workflow status and currency.",
  category: "orders",
  requires: [{ resource: "org.orders", action: "view" }],
  run: async (ctx) => {
    const isSupplier = await actorIsSupplierPortalRestricted(ctx.actorUserId);
    const where = await purchaseOrderWhereWithViewerScope(
      ctx.tenantId,
      ctx.actorUserId,
      { tenantId: ctx.tenantId, splitParentId: null },
      { isSupplierPortalUser: isSupplier },
    );
    const grouped = await ctx.prisma.purchaseOrder.groupBy({
      by: ["statusId", "currency"],
      where,
      _count: { _all: true },
      _sum: { totalAmount: true },
    });
    const statusIds = [...new Set(grouped.map((g) => g.statusId))];
    const statuses = await ctx.prisma.workflowStatus.findMany({
      where: { id: { in: statusIds } },
      select: { id: true, code: true, label: true },
    });
    const labelById = new Map(statuses.map((s) => [s.id, s.label]));
    const codeById = new Map(statuses.map((s) => [s.id, s.code]));

    const rows = grouped
      .map((g) => ({
        statusLabel: labelById.get(g.statusId) ?? g.statusId,
        statusCode: codeById.get(g.statusId) ?? "",
        currency: g.currency,
        orderCount: g._count._all,
        totalAmount: g._sum.totalAmount?.toString() ?? "0",
      }))
      .sort((a, b) =>
        a.statusLabel.localeCompare(b.statusLabel) || a.currency.localeCompare(b.currency),
      );

    return {
      title: "Orders by status",
      description: ordersByStatusReport.description,
      columns: [
        { key: "statusLabel", label: "Status" },
        { key: "statusCode", label: "Code" },
        { key: "currency", label: "Currency" },
        { key: "orderCount", label: "Orders", format: "number", align: "right" },
        { key: "totalAmount", label: "Total amount", format: "currency", align: "right" },
      ],
      rows,
    };
  },
};
