import { actorIsSupplierPortalRestricted } from "@/lib/authz";
import { formatOperatingRolesShort, mapRoleAssignmentsToRoles } from "@/lib/org-unit-operating-roles";
import { purchaseOrderWhereWithViewerScope } from "@/lib/org-scope";
import type { ReportDefinition } from "@/lib/reports/types";

export const ordersByServedOrgReport: ReportDefinition = {
  id: "orders_by_served_org",
  title: "Open orders by “order for” org",
  description:
    "Parent purchase orders in non-terminal status, grouped by the optional served org (Phase 2 document context) and currency. Includes operating role tags (Phase 1) on the served org node when set.",
  category: "orders",
  requires: [{ resource: "org.orders", action: "view" }],
  run: async (ctx) => {
    const isSupplier = await actorIsSupplierPortalRestricted(ctx.actorUserId);
    const where = await purchaseOrderWhereWithViewerScope(
      ctx.tenantId,
      ctx.actorUserId,
      {
        tenantId: ctx.tenantId,
        splitParentId: null,
        status: { isEnd: false },
      },
      { isSupplierPortalUser: isSupplier },
    );
    const grouped = await ctx.prisma.purchaseOrder.groupBy({
      by: ["servedOrgUnitId", "currency"],
      where,
      _count: { _all: true },
      _sum: { totalAmount: true },
    });
    const orgIds = grouped
      .map((g) => g.servedOrgUnitId)
      .filter((id): id is string => id != null);
    const orgs = await ctx.prisma.orgUnit.findMany({
      where: { id: { in: orgIds }, tenantId: ctx.tenantId },
      select: {
        id: true,
        name: true,
        code: true,
        kind: true,
        roleAssignments: { select: { role: true } },
      },
    });
    const orgById = new Map(orgs.map((o) => [o.id, o]));

    const rows = grouped
      .map((g) => {
        const sid = g.servedOrgUnitId;
        if (!sid) {
          return {
            servedOrgName: "— Not specified —",
            servedOrgCode: "",
            orgKind: "",
            operatingTags: "—",
            currency: g.currency,
            orderCount: g._count._all,
            totalAmount: g._sum.totalAmount?.toString() ?? "0",
          };
        }
        const ou = orgById.get(sid);
        const roleTags = mapRoleAssignmentsToRoles(ou?.roleAssignments ?? []);
        return {
          servedOrgName: ou?.name ?? sid,
          servedOrgCode: ou?.code ?? "",
          orgKind: ou?.kind ?? "",
          operatingTags: formatOperatingRolesShort(roleTags, 5),
          currency: g.currency,
          orderCount: g._count._all,
          totalAmount: g._sum.totalAmount?.toString() ?? "0",
        };
      })
      .sort(
        (a, b) =>
          a.servedOrgName.localeCompare(b.servedOrgName) || a.currency.localeCompare(b.currency),
      );

    return {
      title: "Open orders by “order for” org",
      description: ordersByServedOrgReport.description,
      columns: [
        { key: "servedOrgName", label: "Order for (org)" },
        { key: "servedOrgCode", label: "Code" },
        { key: "orgKind", label: "Kind" },
        { key: "operatingTags", label: "Operating tags" },
        { key: "currency", label: "Currency" },
        { key: "orderCount", label: "Orders", format: "number", align: "right" },
        { key: "totalAmount", label: "Open amount", format: "currency", align: "right" },
      ],
      rows,
    };
  },
};
