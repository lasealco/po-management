import { AccessDenied } from "@/components/access-denied";
import { getViewerGrantSet, viewerHas } from "@/lib/authz";
import { getDemoTenant } from "@/lib/demo-tenant";
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
        <AccessDenied title="Create sales order" message="Choose an active user in the header first." />
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

  return (
    <div className="min-h-screen bg-zinc-50">
      <SalesOrderCreateForm soNumberHint={soNumberHint} shipmentHint={shipmentHint} />
    </div>
  );
}
