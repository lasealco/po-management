import Link from "next/link";

import { getActorUserId, getViewerGrantSet, viewerHas } from "@/lib/authz";
import { ControlTowerWorkbench } from "@/components/control-tower-workbench";
import { getControlTowerPortalContext } from "@/lib/control-tower/viewer";
import { getDemoTenant } from "@/lib/demo-tenant";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function ControlTowerWorkbenchPage() {
  const access = await getViewerGrantSet();
  const canEdit = Boolean(
    access?.user && viewerHas(access.grantSet, "org.controltower", "edit"),
  );
  const actorId = await getActorUserId();
  const ctx =
    actorId !== null
      ? await getControlTowerPortalContext(actorId)
      : { isRestrictedView: false, isSupplierPortal: false, customerCrmAccountId: null };
  const tenant = await getDemoTenant();
  const [supplierChoices, crmAccountChoices] = tenant
    ? await Promise.all([
        prisma.supplier.findMany({
          where: { tenantId: tenant.id, isActive: true },
          orderBy: { name: "asc" },
          select: { id: true, name: true },
          take: 500,
        }),
        prisma.crmAccount.findMany({
          where: { tenantId: tenant.id, lifecycle: "ACTIVE" },
          orderBy: { name: "asc" },
          select: { id: true, name: true },
          take: 500,
        }),
      ])
    : [[], []];

  return (
    <main className="mx-auto w-full max-w-7xl px-6 py-10">
      <header className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900">Tracking workbench</h1>
          <p className="mt-1 text-sm text-zinc-600">
          High-volume list with status, mode, and text search across PO numbers, tracking, carriers, and saved B/L
          references. Filters sync to the URL (debounced) for sharing. The first column prefers the PO when the stored
          shipment number looks like an ASN-style ref (e.g. ASN-GEN-…).
          {ctx.isRestrictedView
            ? " Your view is scoped to customer or supplier-visible shipments."
            : null}
          </p>
        </div>
        {!ctx.isRestrictedView ? (
          <div className="flex shrink-0 gap-2">
            <Link
              href="/sales-orders"
              className="inline-flex items-center justify-center rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-50"
            >
              Sales orders
            </Link>
            {canEdit ? (
              <Link
                href="/control-tower/shipments/new"
                className="inline-flex items-center justify-center rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
              >
                New logistics shipment
              </Link>
            ) : null}
          </div>
        ) : null}
      </header>
      <ControlTowerWorkbench
        canEdit={canEdit}
        restrictedView={ctx.isRestrictedView}
        supplierChoices={supplierChoices}
        crmAccountChoices={crmAccountChoices}
      />
    </main>
  );
}
