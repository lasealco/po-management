import { actorIsSupplierPortalRestricted } from "@/lib/authz";
import { purchaseOrderWhereWithViewerScope } from "@/lib/org-scope";
import type { ReportDefinition } from "@/lib/reports/types";

export const overdueOrdersReport: ReportDefinition = {
  id: "overdue_orders",
  title: "Overdue by requested delivery",
  description:
    "Parent orders whose requested delivery date is before today (date-only compare, UTC).",
  category: "orders",
  requires: [{ resource: "org.orders", action: "view" }],
  run: async (ctx) => {
    const startOfTodayUtc = new Date();
    startOfTodayUtc.setUTCHours(0, 0, 0, 0);

    const isSupplier = await actorIsSupplierPortalRestricted(ctx.actorUserId);
    const where = await purchaseOrderWhereWithViewerScope(
      ctx.tenantId,
      ctx.actorUserId,
      {
        tenantId: ctx.tenantId,
        splitParentId: null,
        requestedDeliveryDate: { lt: startOfTodayUtc },
      },
      { isSupplierPortalUser: isSupplier },
    );

    const orders = await ctx.prisma.purchaseOrder.findMany({
      where,
      orderBy: [{ requestedDeliveryDate: "asc" }],
      select: {
        orderNumber: true,
        title: true,
        currency: true,
        totalAmount: true,
        requestedDeliveryDate: true,
        status: { select: { label: true, code: true } },
        supplier: { select: { name: true } },
      },
    });

    const now = Date.now();
    const rows = orders.map((o) => {
      const due = o.requestedDeliveryDate?.getTime() ?? 0;
      const daysOverdue =
        due > 0 ? Math.max(0, Math.floor((now - due) / (86400 * 1000))) : null;
      return {
        orderNumber: o.orderNumber,
        title: o.title ?? "",
        status: o.status.label,
        supplier: o.supplier?.name ?? "—",
        requestedDeliveryDate: o.requestedDeliveryDate?.toISOString().slice(0, 10) ?? "",
        daysOverdue: daysOverdue ?? 0,
        currency: o.currency,
        totalAmount: o.totalAmount.toString(),
      };
    });

    return {
      title: "Overdue by requested delivery",
      description: overdueOrdersReport.description,
      columns: [
        { key: "orderNumber", label: "PO #" },
        { key: "title", label: "Title" },
        { key: "status", label: "Status" },
        { key: "supplier", label: "Supplier" },
        { key: "requestedDeliveryDate", label: "Due date", format: "date" },
        { key: "daysOverdue", label: "Days overdue", format: "number", align: "right" },
        { key: "currency", label: "Curr." },
        { key: "totalAmount", label: "Total", format: "currency", align: "right" },
      ],
      rows,
    };
  },
};
