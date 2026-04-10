import { fetchSupplierPerformanceSummary } from "@/lib/supplier-order-analytics";
import type { ReportDefinition } from "@/lib/reports/types";

export const supplierPerformanceReport: ReportDefinition = {
  id: "supplier_performance",
  title: "Supplier performance (SLA-style)",
  description:
    "On-time shipping, confirmation timing, and engagement by supplier (parent POs only).",
  category: "orders",
  requires: [
    { resource: "org.orders", action: "view" },
    { resource: "org.suppliers", action: "view" },
  ],
  run: async (ctx) => {
    const suppliers = await ctx.prisma.supplier.findMany({
      where: { tenantId: ctx.tenantId, isActive: true },
      select: { id: true, name: true, code: true },
      orderBy: { name: "asc" },
    });

    const rows: Record<string, string | number | null>[] = [];
    for (const s of suppliers) {
      const { parentOrderCount, performance: p } = await fetchSupplierPerformanceSummary(
        ctx.prisma,
        ctx.tenantId,
        s.id,
      );
      if (parentOrderCount === 0) continue;

      const denomConfirm = p.confirmation.ordersSentToSupplier;
      const confirmRate =
        denomConfirm > 0
          ? Math.round((p.confirmation.ordersConfirmedAfterSend / denomConfirm) * 1000) / 10
          : null;

      rows.push({
        supplierName: s.name,
        supplierCode: s.code ?? "",
        parentOrders: parentOrderCount,
        sentToSupplier: p.confirmation.ordersSentToSupplier,
        confirmedAfterSend: p.confirmation.ordersConfirmedAfterSend,
        confirmRatePct: confirmRate,
        avgHoursToConfirm: p.confirmation.avgHoursToConfirm,
        onTimeShipPct: p.shippingVsRequested.onTimeShipPct,
        onTimeLinePct: p.lineShipVsPlanned.onTimeLinePct,
        supplierPortalMsgsAfterSend: p.supplierPortal.ordersWithSupplierPortalMessageAfterSend,
        avgHrsSupplierPortalFirstMsg: p.supplierPortal.avgHoursToFirstSupplierPortalMessage,
      });
    }

    return {
      title: "Supplier performance (SLA-style)",
      description: supplierPerformanceReport.description,
      columns: [
        { key: "supplierName", label: "Supplier" },
        { key: "supplierCode", label: "Code" },
        { key: "parentOrders", label: "Parent POs", format: "number", align: "right" },
        { key: "sentToSupplier", label: "Sent to supplier", format: "number", align: "right" },
        {
          key: "confirmedAfterSend",
          label: "Confirmed (after send)",
          format: "number",
          align: "right",
        },
        {
          key: "confirmRatePct",
          label: "Confirm rate %",
          format: "number",
          align: "right",
        },
        {
          key: "avgHoursToConfirm",
          label: "Avg hrs to confirm",
          format: "number",
          align: "right",
        },
        {
          key: "onTimeShipPct",
          label: "On-time ship % (header due)",
          format: "number",
          align: "right",
        },
        {
          key: "onTimeLinePct",
          label: "On-time lines % (planned ship)",
          format: "number",
          align: "right",
        },
        {
          key: "supplierPortalMsgsAfterSend",
          label: "Supplier portal msgs (post-send)",
          format: "number",
          align: "right",
        },
        {
          key: "avgHrsSupplierPortalFirstMsg",
          label: "Avg hrs to 1st portal msg",
          format: "number",
          align: "right",
        },
      ],
      rows,
    };
  },
};
