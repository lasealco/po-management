import { AccessDenied } from "@/components/access-denied";
import { getViewerGrantSet, viewerHas } from "@/lib/authz";
import { getDemoTenant } from "@/lib/demo-tenant";
import { getOrdersServedDefaultPreference } from "@/lib/orders-served-default-pref";
import { prisma } from "@/lib/prisma";
import { nextSalesOrderNumber } from "@/lib/sales-orders";

import { SalesOrderCreateForm } from "@/components/sales-order-create-form";

export const dynamic = "force-dynamic";

export default async function NewSalesOrderPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const access = await getViewerGrantSet();
  if (!access?.user) {
    return (
      <div className="min-h-screen bg-zinc-50 px-6 py-16">
        <AccessDenied title="Create sales order" message="Choose an active demo user: open Settings → Demo session (/settings/demo)." />
      </div>
    );
  }
  if (!viewerHas(access.grantSet, "org.orders", "edit")) {
    return (
      <div className="min-h-screen bg-zinc-50 px-6 py-16">
        <AccessDenied title="Create sales order" message="You need org.orders → edit." />
      </div>
    );
  }

  const tenant = await getDemoTenant();
  if (!tenant) {
    return (
      <div className="min-h-screen bg-zinc-50 px-6 py-16">
        <AccessDenied title="Create sales order" message="Tenant not found." />
      </div>
    );
  }

  const sp = (await (searchParams ?? Promise.resolve({}))) as Record<string, string | string[] | undefined>;
  const rawShipmentId = Array.isArray(sp.shipmentId) ? sp.shipmentId[0] : sp.shipmentId;
  const shipmentId = typeof rawShipmentId === "string" ? rawShipmentId.trim() : "";

  const [soNumberHint, shipmentHint] = await Promise.all([
    nextSalesOrderNumber(tenant.id),
    shipmentId
      ? prisma.shipment.findFirst({
          where: { id: shipmentId, order: { tenantId: tenant.id } },
          select: {
            id: true,
            shipmentNo: true,
            order: { select: { shipToName: true, requestedDeliveryDate: true } },
          },
        })
      : Promise.resolve(null),
  ]);
  const [crmAccounts, forwarderSuppliers, orgUnits, servedDefault] = await Promise.all([
    prisma.crmAccount.findMany({
      where: { tenantId: tenant.id, lifecycle: "ACTIVE" },
      orderBy: { name: "asc" },
      select: { id: true, name: true, legalName: true, accountType: true },
    }),
    prisma.supplier.findMany({
      where: {
        tenantId: tenant.id,
        isActive: true,
        approvalStatus: "approved",
        srmCategory: "logistics",
      },
      orderBy: { name: "asc" },
      select: { id: true, name: true, legalName: true },
    }),
    prisma.orgUnit.findMany({
      where: { tenantId: tenant.id },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { id: true, name: true, code: true, kind: true },
    }),
    getOrdersServedDefaultPreference(tenant.id, access.user.id),
  ]);

  return (
    <div className="min-h-screen bg-zinc-50">
      <SalesOrderCreateForm
        soNumberHint={soNumberHint}
        shipmentHint={shipmentHint}
        crmAccounts={crmAccounts}
        forwarderSuppliers={forwarderSuppliers}
        orgUnits={orgUnits}
        defaultServedOrgFromPref={servedDefault.defaultOrg}
      />
    </div>
  );
}
