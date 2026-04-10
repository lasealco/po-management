import type { ReportDefinition } from "@/lib/reports/types";

export const ordersBySupplierReport: ReportDefinition = {
  id: "orders_by_supplier",
  title: "Orders by supplier",
  description:
    "Open parent POs grouped by supplier and currency (blank supplier = unassigned).",
  category: "orders",
  requires: [{ resource: "org.orders", action: "view" }],
  run: async (ctx) => {
    const grouped = await ctx.prisma.purchaseOrder.groupBy({
      by: ["supplierId", "currency"],
      where: { tenantId: ctx.tenantId, splitParentId: null },
      _count: { _all: true },
      _sum: { totalAmount: true },
    });
    const supplierIds = grouped
      .map((g) => g.supplierId)
      .filter((id): id is string => id != null);
    const suppliers = await ctx.prisma.supplier.findMany({
      where: { id: { in: supplierIds }, tenantId: ctx.tenantId },
      select: { id: true, name: true, code: true },
    });
    const nameById = new Map(suppliers.map((s) => [s.id, s.name]));
    const codeById = new Map(suppliers.map((s) => [s.id, s.code ?? ""]));

    const rows = grouped
      .map((g) => {
        const sid = g.supplierId;
        return {
          supplierName: sid ? (nameById.get(sid) ?? sid) : "— Unassigned —",
          supplierCode: sid ? (codeById.get(sid) ?? "") : "",
          currency: g.currency,
          orderCount: g._count._all,
          totalAmount: g._sum.totalAmount?.toString() ?? "0",
        };
      })
      .sort(
        (a, b) =>
          a.supplierName.localeCompare(b.supplierName) || a.currency.localeCompare(b.currency),
      );

    return {
      title: "Orders by supplier",
      description: ordersBySupplierReport.description,
      columns: [
        { key: "supplierName", label: "Supplier" },
        { key: "supplierCode", label: "Code" },
        { key: "currency", label: "Currency" },
        { key: "orderCount", label: "Orders", format: "number", align: "right" },
        { key: "totalAmount", label: "Total amount", format: "currency", align: "right" },
      ],
      rows,
    };
  },
};
